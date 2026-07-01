from decimal import Decimal

from django.db.models import Sum
from rest_framework import serializers

from .models import (
    AvoirWithdrawal,
    JournalExpense,
    JournalFuelLine,
    JournalLubricantLine,
    JournalPaymentSummary,
    JournalSalesRecap,
    StationJournal,
)


class JournalFuelLineSerializer(serializers.ModelSerializer):
    nozzle_label = serializers.CharField(source="nozzle.label", read_only=True)
    tank_id = serializers.UUIDField(source="nozzle.tank_id", read_only=True)
    tank_label = serializers.CharField(source="nozzle.tank.label", read_only=True)
    fuel_type = serializers.CharField(source="nozzle.tank.fuel_type.name", read_only=True)
    is_tank_reference = serializers.SerializerMethodField()
    output_volume = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    sold_volume = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    theoretical_stock = serializers.SerializerMethodField()
    gauge_diff = serializers.SerializerMethodField()
    amount_xof = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    monthly_gauge_diff = serializers.SerializerMethodField()

    def _is_ref(self, obj: JournalFuelLine) -> bool:
        """True si ce pistolet est le premier de sa cuve dans ce journal (display_order le plus bas).
        Résultat mis en cache dans le contexte pour éviter les requêtes répétées."""
        cache_key = f"_tank_ref_{obj.pk}"
        ctx = self.context if hasattr(self, "context") else {}
        if cache_key not in ctx:
            first_id = (
                JournalFuelLine.objects
                .filter(journal_id=obj.journal_id, nozzle__tank_id=obj.nozzle.tank_id)
                .order_by("nozzle__display_order")
                .values_list("nozzle_id", flat=True)
                .first()
            )
            ctx[cache_key] = first_id is not None and str(first_id) == str(obj.nozzle_id)
        return ctx[cache_key]

    def _tank_total_sold(self, obj: JournalFuelLine) -> Decimal:
        """Somme des volumes vendus par tous les pistolets de cette cuve. Mis en cache."""
        cache_key = f"_tank_sold_{obj.journal_id}_{obj.nozzle.tank_id}"
        ctx = self.context if hasattr(self, "context") else {}
        if cache_key not in ctx:
            lines = JournalFuelLine.objects.filter(
                journal_id=obj.journal_id,
                nozzle__tank_id=obj.nozzle.tank_id,
            )
            ctx[cache_key] = sum(line.sold_volume or Decimal("0") for line in lines)
        return ctx[cache_key]

    def get_is_tank_reference(self, obj: JournalFuelLine) -> bool:
        return self._is_ref(obj)

    def get_theoretical_stock(self, obj: JournalFuelLine):
        """Stock théorique au niveau CUVE = stock_ouv + appro − somme(ventes de tous les pistolets).
        Retourné uniquement pour le pistolet de référence (premier de la cuve)."""
        if not self._is_ref(obj):
            return None
        if obj.index_close is None:
            return None
        total_sold = self._tank_total_sold(obj)
        return obj.gauged_stock_open + obj.received_volume - total_sold

    def get_gauge_diff(self, obj: JournalFuelLine):
        """Écart jaugeage = stock_réel − stock_théo (niveau cuve, référence uniquement)."""
        if not self._is_ref(obj):
            return None
        theoretical = self.get_theoretical_stock(obj)
        if obj.gauged_stock_close is None or theoretical is None:
            return None
        return obj.gauged_stock_close - theoretical

    def get_monthly_gauge_diff(self, obj: JournalFuelLine):
        """Cumul mensuel des écarts de jaugeage pour cette cuve (référence uniquement)."""
        if not self._is_ref(obj):
            return None
        from collections import defaultdict
        d = obj.journal.journal_date
        lines = JournalFuelLine.objects.filter(
            journal__station=obj.journal.station,
            journal__journal_date__year=d.year,
            journal__journal_date__month=d.month,
            journal__is_active=True,
            nozzle__tank_id=obj.nozzle.tank_id,
        ).select_related("nozzle")
        # Grouper par journal pour calculer le sold total par jour
        lines_by_journal: dict = defaultdict(list)
        for line in lines:
            lines_by_journal[line.journal_id].append(line)
        total = Decimal("0")
        for jlines in lines_by_journal.values():
            ref = min(jlines, key=lambda l: l.nozzle.display_order)
            if ref.gauged_stock_close is not None and ref.index_close is not None:
                sold_sum = sum(l.sold_volume or Decimal("0") for l in jlines)
                theo = ref.gauged_stock_open + ref.received_volume - sold_sum
                total += ref.gauged_stock_close - theo
        return total

    class Meta:
        model = JournalFuelLine
        fields = [
            "id",
            "nozzle",
            "nozzle_label",
            "tank_id",
            "tank_label",
            "fuel_type",
            "is_tank_reference",
            "index_open",
            "index_close",
            "return_volume",
            "received_volume",
            "gauged_stock_open",
            "gauged_stock_close",
            "diff_comment",
            "output_volume",
            "sold_volume",
            "theoretical_stock",
            "gauge_diff",
            "amount_xof",
            "monthly_gauge_diff",
        ]
        read_only_fields = [
            "id", "nozzle", "nozzle_label", "tank_id", "tank_label",
            "fuel_type", "is_tank_reference", "index_open",
        ]


class JournalFuelLineUpdateSerializer(serializers.ModelSerializer):
    """Serializer pour la saisie des index et jaugeage."""

    class Meta:
        model = JournalFuelLine
        fields = [
            "index_open",
            "index_close",
            "return_volume",
            "received_volume",
            "gauged_stock_open",
            "gauged_stock_close",
            "diff_comment",
        ]

    def validate(self, attrs):
        instance = self.instance
        index_open = attrs.get("index_open", getattr(instance, "index_open", Decimal("0")))
        index_close = attrs.get("index_close", getattr(instance, "index_close", None))
        if index_close is not None and index_open is not None and index_close < index_open:
            raise serializers.ValidationError(
                {
                    "index_close": (
                        f"L'index de fermeture ({index_close}) ne peut pas être "
                        f"inférieur à l'index d'ouverture ({index_open})."
                    )
                }
            )
        # Les champs de jaugeage/appro ne sont autorisés que sur le pistolet de référence (premier de la cuve)
        tank_fields = {"received_volume", "gauged_stock_open", "gauged_stock_close", "diff_comment"}
        if instance and tank_fields & set(attrs.keys()):
            first_nozzle_id = (
                JournalFuelLine.objects
                .filter(journal_id=instance.journal_id, nozzle__tank_id=instance.nozzle.tank_id)
                .order_by("nozzle__display_order")
                .values_list("nozzle_id", flat=True)
                .first()
            )
            if first_nozzle_id is None or str(first_nozzle_id) != str(instance.nozzle_id):
                raise serializers.ValidationError(
                    "Les données de jaugeage et d'approvisionnement ne peuvent être "
                    "saisies que sur le premier pistolet de la cuve."
                )
        return attrs


class JournalLubricantLineSerializer(serializers.ModelSerializer):
    lubricant_name = serializers.CharField(source="lubricant.__str__", read_only=True)
    stock_cumul = serializers.DecimalField(
        max_digits=10, decimal_places=3, read_only=True
    )
    stock_close_theoretical = serializers.DecimalField(
        max_digits=10, decimal_places=3, read_only=True
    )
    diff = serializers.DecimalField(max_digits=10, decimal_places=3, read_only=True)

    class Meta:
        model = JournalLubricantLine
        fields = [
            "id",
            "lubricant",
            "lubricant_name",
            "stock_open",
            "purchased_qty",
            "sold_qty",
            "gauged_qty",
            "stock_cumul",
            "stock_close_theoretical",
            "diff",
        ]
        read_only_fields = ["id", "lubricant", "lubricant_name", "stock_open"]


class JournalSalesRecapSerializer(serializers.ModelSerializer):
    category_display = serializers.CharField(source="get_category_display", read_only=True)

    class Meta:
        model = JournalSalesRecap
        fields = [
            "id",
            "category",
            "category_display",
            "qty",
            "unit_price_xof",
            "daily_value_xof",
            "previous_day_cumul_xof",
            "monthly_cumul_xof",
            "previous_month_total_xof",
        ]
        read_only_fields = [
            "id",
            "category",
            "category_display",
            "previous_day_cumul_xof",
            "monthly_cumul_xof",
            "previous_month_total_xof",
        ]


class JournalPaymentSummarySerializer(serializers.ModelSerializer):
    total_xof = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    avoir_total_xof = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    avoir_solde_xof = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    ecart_encaissement_xof = serializers.SerializerMethodField()
    ecart_encaissement_cumul_xof = serializers.SerializerMethodField()

    def _fuel_total(self, journal) -> Decimal:
        """Somme des montants carburant vendus (calculés depuis les index)."""
        return sum(
            (fl.amount_xof or Decimal("0"))
            for fl in journal.fuel_lines.all()
        )

    def get_ecart_encaissement_xof(self, obj: JournalPaymentSummary) -> Decimal:
        """Écart = Total encaissé − Valeur carburant vendu (du jour)."""
        return obj.total_xof - self._fuel_total(obj.journal)

    def get_ecart_encaissement_cumul_xof(self, obj: JournalPaymentSummary) -> Decimal:
        """Cumul mensuel des écarts encaissement pour cette station."""
        d = obj.journal.journal_date
        journals = StationJournal.objects.filter(
            station=obj.journal.station,
            journal_date__year=d.year,
            journal_date__month=d.month,
            is_active=True,
        ).prefetch_related("fuel_lines__nozzle__tank__fuel_type", "payment_summary")

        total = Decimal("0")
        for j in journals:
            fuel_total = self._fuel_total(j)
            try:
                pay_total = j.payment_summary.total_xof
            except JournalPaymentSummary.DoesNotExist:
                pay_total = Decimal("0")
            total += pay_total - fuel_total
        return total

    class Meta:
        model = JournalPaymentSummary
        fields = [
            "id",
            "cash_amount_xof",
            "tickets_amount_xof",
            "tpe_amount_xof",
            "mobile_money_amount_xof",
            "credit_amount_xof",
            "reimbursements_xof",
            "ecart_pompiste_xof",
            "total_xof",
            "avoir_fuel_xof",
            "avoir_cash_xof",
            "avoir_total_xof",
            "avoir_solde_xof",
            "ecart_encaissement_xof",
            "ecart_encaissement_cumul_xof",
        ]
        read_only_fields = [
            "id",
            "avoir_total_xof",
            "avoir_solde_xof",
            "ecart_encaissement_xof",
            "ecart_encaissement_cumul_xof",
        ]


class AvoirWithdrawalSerializer(serializers.ModelSerializer):
    withdrawal_type_display = serializers.CharField(source="get_withdrawal_type_display", read_only=True)
    station_name = serializers.CharField(source="station.name", read_only=True)

    class Meta:
        model = AvoirWithdrawal
        fields = [
            "id", "station", "station_name", "withdrawal_date",
            "withdrawal_type", "withdrawal_type_display",
            "amount_xof", "notes", "created_at",
        ]
        read_only_fields = ["id", "created_at", "withdrawal_type_display", "station_name"]


class JournalExpenseSerializer(serializers.ModelSerializer):
    category_display = serializers.CharField(source="get_category_display", read_only=True)

    class Meta:
        model = JournalExpense
        fields = ["id", "journal", "label", "amount_xof", "category", "category_display", "created_at"]
        read_only_fields = ["id", "created_at", "category_display"]


class StationJournalListSerializer(serializers.ModelSerializer):
    station_name = serializers.CharField(source="station.name", read_only=True)
    manager_name = serializers.CharField(source="manager.get_full_name", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = StationJournal
        fields = [
            "id",
            "journal_number",
            "journal_date",
            "station",
            "station_name",
            "manager",
            "manager_name",
            "status",
            "status_display",
            "opened_at",
            "closed_at",
            "validated_at",
        ]


class StationJournalDetailSerializer(serializers.ModelSerializer):
    station_name = serializers.CharField(source="station.name", read_only=True)
    manager_name = serializers.CharField(source="manager.get_full_name", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    validated_by_name = serializers.CharField(
        source="validated_by.get_full_name", read_only=True
    )
    fuel_lines = JournalFuelLineSerializer(many=True, read_only=True)
    lubricant_lines = JournalLubricantLineSerializer(many=True, read_only=True)
    sales_recaps = JournalSalesRecapSerializer(many=True, read_only=True)
    payment_summary = JournalPaymentSummarySerializer(read_only=True)
    expenses = JournalExpenseSerializer(many=True, read_only=True)
    monthly_expenses_xof = serializers.SerializerMethodField()
    is_editable = serializers.BooleanField(read_only=True)

    def get_monthly_expenses_xof(self, obj: StationJournal):
        """Cumul mensuel des dépenses pour cette station."""
        d = obj.journal_date
        return (
            JournalExpense.objects.filter(
                journal__station=obj.station,
                journal__journal_date__year=d.year,
                journal__journal_date__month=d.month,
                journal__is_active=True,
            )
            .aggregate(total=Sum("amount_xof"))["total"]
            or Decimal("0")
        )

    class Meta:
        model = StationJournal
        fields = [
            "id",
            "journal_number",
            "journal_date",
            "station",
            "station_name",
            "manager",
            "manager_name",
            "status",
            "status_display",
            "is_editable",
            "opened_at",
            "closed_at",
            "validated_at",
            "validated_by",
            "validated_by_name",
            "notes",
            "pdf_url",
            "pdf_hash",
            "fuel_lines",
            "lubricant_lines",
            "sales_recaps",
            "payment_summary",
            "expenses",
            "monthly_expenses_xof",
        ]


class JournalOpenSerializer(serializers.Serializer):
    """Paramètres pour l'ouverture d'un journal."""
    journal_date = serializers.DateField(required=False)

    def validate_journal_date(self, value):
        from django.utils import timezone
        today = timezone.localdate()
        if value > today:
            raise serializers.ValidationError("La date du journal ne peut pas être dans le futur.")
        return value


class JournalCloseSerializer(serializers.Serializer):
    """Valide que toutes les données sont saisies avant clôture."""
    notes = serializers.CharField(required=False, allow_blank=True)


class JournalValidateSerializer(serializers.Serializer):
    """Confirme la validation définitive du journal."""
    confirm = serializers.BooleanField()

    def validate_confirm(self, value):
        if not value:
            raise serializers.ValidationError(
                "Vous devez confirmer explicitement la validation du journal."
            )
        return value
