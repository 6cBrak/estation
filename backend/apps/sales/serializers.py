from decimal import Decimal
from django.utils import timezone
from rest_framework import serializers
from django.db import transaction
from .models import CashSession, Sale, SaleItem, Payment
from apps.lubricants.models import LubricantStock
from apps.gas.models import GasBottleStock


class CashSessionOpenSerializer(serializers.Serializer):
    opening_amount_xof = serializers.DecimalField(max_digits=12, decimal_places=2, default=0)

    def validate(self, data: dict) -> dict:
        user = self.context["request"].user
        if CashSession.objects.filter(cashier=user, status="open").exists():
            raise serializers.ValidationError("Vous avez déjà une session de caisse ouverte.")
        return data

    def create(self, validated_data: dict) -> CashSession:
        user = self.context["request"].user
        return CashSession.objects.create(
            station=user.station,
            cashier=user,
            opening_amount_xof=validated_data["opening_amount_xof"],
            created_by=user,
        )


class CashSessionCloseSerializer(serializers.Serializer):
    counted_cash_xof = serializers.DecimalField(max_digits=12, decimal_places=2)
    notes = serializers.CharField(required=False, allow_blank=True, default="")

    def validate(self, data: dict) -> dict:
        session = self.instance
        if session.status != "open":
            raise serializers.ValidationError("Cette session n'est pas ouverte.")
        station = session.station
        variance = data["counted_cash_xof"] - session.cash_expected_xof
        tolerance = station.cash_tolerance_xof
        if abs(variance) > tolerance and not data.get("notes"):
            raise serializers.ValidationError(
                f"Écart de {variance:+.0f} FCFA détecté (tolérance {tolerance} FCFA). "
                "Un commentaire est obligatoire."
            )
        return data

    def update(self, instance: CashSession, validated_data: dict) -> CashSession:
        instance.counted_cash_xof = validated_data["counted_cash_xof"]
        instance.notes = validated_data.get("notes", "")
        instance.closed_at = timezone.now()
        instance.status = "closed"
        instance.save(
            update_fields=["counted_cash_xof", "notes", "closed_at", "status", "updated_at"]
        )
        return instance


class CashSessionSerializer(serializers.ModelSerializer):
    cashier_name = serializers.CharField(source="cashier.get_full_name", read_only=True)
    station_name = serializers.CharField(source="station.name", read_only=True)
    total_sales_xof = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    cash_expected_xof = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    variance_xof = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = CashSession
        fields = [
            "id", "station", "station_name", "cashier", "cashier_name",
            "opened_at", "closed_at", "opening_amount_xof",
            "counted_cash_xof", "total_sales_xof", "cash_expected_xof", "variance_xof",
            "status", "notes",
        ]
        read_only_fields = ["id", "opened_at", "closed_at"]


class PaymentInputSerializer(serializers.Serializer):
    method = serializers.ChoiceField(choices=Payment.METHOD_CHOICES)
    amount_xof = serializers.DecimalField(max_digits=12, decimal_places=2)
    reference = serializers.CharField(required=False, allow_blank=True, default="")

    def validate_amount_xof(self, value: Decimal) -> Decimal:
        if value <= 0:
            raise serializers.ValidationError("Le montant doit être positif.")
        return value


class SaleItemInputSerializer(serializers.Serializer):
    item_type = serializers.ChoiceField(choices=Sale.ITEM_TYPE_CHOICES)
    label = serializers.CharField(max_length=150)
    quantity = serializers.DecimalField(max_digits=10, decimal_places=3)
    unit_price_xof = serializers.DecimalField(max_digits=10, decimal_places=2)
    lubricant_stock_id = serializers.UUIDField(required=False, allow_null=True)
    gas_stock_id = serializers.UUIDField(required=False, allow_null=True)
    service_id = serializers.UUIDField(required=False, allow_null=True)

    def validate_quantity(self, value: Decimal) -> Decimal:
        if value <= 0:
            raise serializers.ValidationError("La quantité doit être positive.")
        return value


class SaleCreateSerializer(serializers.Serializer):
    items = SaleItemInputSerializer(many=True, min_length=1)
    payments = PaymentInputSerializer(many=True, min_length=1)

    def validate(self, data: dict) -> dict:
        total_items = sum(
            Decimal(str(i["quantity"])) * Decimal(str(i["unit_price_xof"]))
            for i in data["items"]
        )
        total_payments = sum(Decimal(str(p["amount_xof"])) for p in data["payments"])
        if abs(total_items - total_payments) > Decimal("1"):
            raise serializers.ValidationError(
                f"Le total des règlements ({total_payments} FCFA) "
                f"ne correspond pas au total de la vente ({total_items} FCFA)."
            )
        return data

    @transaction.atomic
    def create(self, validated_data: dict) -> Sale:
        request = self.context["request"]
        user = request.user

        session = CashSession.objects.filter(cashier=user, status="open").first()
        if not session:
            raise serializers.ValidationError(
                "Aucune session de caisse ouverte. Ouvrez une session d'abord."
            )

        items_data = validated_data["items"]
        payments_data = validated_data["payments"]

        total = sum(
            Decimal(str(i["quantity"])) * Decimal(str(i["unit_price_xof"]))
            for i in items_data
        )

        sale = Sale.objects.create(
            session=session,
            total_xof=total,
            created_by=user,
        )

        for item_data in items_data:
            qty = Decimal(str(item_data["quantity"]))
            subtotal = qty * Decimal(str(item_data["unit_price_xof"]))
            lubricant_stock = gas_stock = service = None

            is_lubricant = item_data["item_type"].startswith("lubricant")
            if is_lubricant and item_data.get("lubricant_stock_id"):
                lubricant_stock = LubricantStock.objects.select_for_update().get(
                    id=item_data["lubricant_stock_id"], station=user.station
                )
                if lubricant_stock.quantity < qty:
                    raise serializers.ValidationError(
                        f"Stock insuffisant pour {lubricant_stock.product} : "
                        f"{lubricant_stock.quantity} disponibles."
                    )
                lubricant_stock.quantity -= qty
                lubricant_stock.save(update_fields=["quantity", "updated_at"])

            elif item_data["item_type"] == "gas" and item_data.get("gas_stock_id"):
                gas_stock = GasBottleStock.objects.select_for_update().get(
                    id=item_data["gas_stock_id"], station=user.station
                )
                if gas_stock.quantity < int(qty):
                    raise serializers.ValidationError(
                        f"Stock insuffisant pour {gas_stock.format} : "
                        f"{gas_stock.quantity} disponibles."
                    )
                gas_stock.quantity -= int(qty)
                gas_stock.save(update_fields=["quantity", "updated_at"])

            elif item_data["item_type"] == "service" and item_data.get("service_id"):
                from apps.services.models import ServiceCatalogItem
                try:
                    service = ServiceCatalogItem.objects.get(
                        id=item_data["service_id"], station=user.station
                    )
                except ServiceCatalogItem.DoesNotExist:
                    pass

            SaleItem.objects.create(
                sale=sale,
                item_type=item_data["item_type"],
                label=item_data["label"],
                quantity=qty,
                unit_price_xof=item_data["unit_price_xof"],
                subtotal_xof=subtotal,
                lubricant_stock=lubricant_stock,
                gas_stock=gas_stock,
                service=service,
            )

        for payment_data in payments_data:
            Payment.objects.create(
                sale=sale,
                method=payment_data["method"],
                amount_xof=payment_data["amount_xof"],
                reference=payment_data.get("reference", ""),
                created_by=user,
            )

        return sale


class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = ["id", "method", "amount_xof", "reference"]


class SaleItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = SaleItem
        fields = ["id", "item_type", "label", "quantity", "unit_price_xof", "subtotal_xof"]


class SaleSerializer(serializers.ModelSerializer):
    items = SaleItemSerializer(many=True, read_only=True)
    payments = PaymentSerializer(many=True, read_only=True)
    cashier_name = serializers.CharField(source="session.cashier.get_full_name", read_only=True)
    station_name = serializers.CharField(source="session.station.name", read_only=True)

    class Meta:
        model = Sale
        fields = [
            "id", "sale_number", "station_name", "cashier_name",
            "total_xof", "status", "cancel_reason", "sold_at",
            "items", "payments",
        ]
        read_only_fields = ["id", "sale_number", "sold_at"]
