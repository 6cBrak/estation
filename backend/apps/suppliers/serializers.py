from rest_framework import serializers

from .models import Delivery, DeliveryItem, PurchaseOrder, PurchaseOrderItem, Supplier


class SupplierSerializer(serializers.ModelSerializer):
    category_display = serializers.CharField(source="get_category_display", read_only=True)

    class Meta:
        model = Supplier
        fields = [
            "id", "code", "name", "category", "category_display",
            "contact_name", "phone", "email", "address", "is_active",
        ]


class PurchaseOrderItemSerializer(serializers.ModelSerializer):
    subtotal_xof = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)

    class Meta:
        model = PurchaseOrderItem
        fields = [
            "id", "item_type", "description", "quantity", "unit",
            "unit_price_xof", "subtotal_xof",
            "fuel_type", "lubricant", "product", "gas_format",
        ]


class PurchaseOrderListSerializer(serializers.ModelSerializer):
    supplier_name = serializers.CharField(source="supplier.name", read_only=True)
    station_name = serializers.CharField(source="station.name", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    total_xof = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)

    class Meta:
        model = PurchaseOrder
        fields = [
            "id", "order_number", "station", "station_name",
            "supplier", "supplier_name", "status", "status_display",
            "ordered_at", "expected_delivery_date", "total_xof",
        ]


class PurchaseOrderDetailSerializer(serializers.ModelSerializer):
    supplier_name = serializers.CharField(source="supplier.name", read_only=True)
    station_name = serializers.CharField(source="station.name", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    total_xof = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    items = PurchaseOrderItemSerializer(many=True)

    class Meta:
        model = PurchaseOrder
        fields = [
            "id", "order_number", "station", "station_name",
            "supplier", "supplier_name", "status", "status_display",
            "ordered_at", "expected_delivery_date", "sent_at",
            "notes", "total_xof", "items",
        ]
        read_only_fields = ["id", "order_number", "status", "sent_at"]

    def create(self, validated_data):
        items_data = validated_data.pop("items", [])
        order = PurchaseOrder.objects.create(**validated_data)
        for item_data in items_data:
            PurchaseOrderItem.objects.create(order=order, **item_data)
        return order

    def update(self, instance, validated_data):
        items_data = validated_data.pop("items", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if items_data is not None:
            instance.items.all().delete()
            for item_data in items_data:
                PurchaseOrderItem.objects.create(order=instance, **item_data)
        return instance


class DeliveryItemSerializer(serializers.ModelSerializer):
    variance = serializers.DecimalField(max_digits=12, decimal_places=3, read_only=True)
    subtotal_xof = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)

    class Meta:
        model = DeliveryItem
        fields = [
            "id", "order_item", "item_type", "description",
            "ordered_quantity", "received_quantity", "unit_price_xof",
            "variance", "subtotal_xof",
            "fuel_type", "lubricant", "product", "gas_format",
        ]


class DeliveryListSerializer(serializers.ModelSerializer):
    supplier_name = serializers.CharField(source="supplier.name", read_only=True)
    station_name = serializers.CharField(source="station.name", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    confirmed_by_name = serializers.CharField(source="confirmed_by.get_full_name", read_only=True)
    purchase_order_number = serializers.CharField(source="purchase_order.order_number", read_only=True)

    class Meta:
        model = Delivery
        fields = [
            "id", "delivery_number", "station", "station_name",
            "supplier", "supplier_name", "purchase_order", "purchase_order_number",
            "status", "status_display", "delivered_at",
            "confirmed_at", "confirmed_by_name",
        ]


class DeliveryDetailSerializer(serializers.ModelSerializer):
    supplier_name = serializers.CharField(source="supplier.name", read_only=True)
    station_name = serializers.CharField(source="station.name", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    confirmed_by_name = serializers.CharField(
        source="confirmed_by.get_full_name", read_only=True
    )
    items = DeliveryItemSerializer(many=True)

    class Meta:
        model = Delivery
        fields = [
            "id", "delivery_number", "station", "station_name",
            "supplier", "supplier_name", "purchase_order",
            "status", "status_display", "delivered_at",
            "confirmed_at", "confirmed_by", "confirmed_by_name",
            "tank_level_before", "tank_level_after",
            "notes", "items",
        ]
        read_only_fields = ["id", "delivery_number", "status", "confirmed_at", "confirmed_by"]

    def create(self, validated_data):
        items_data = validated_data.pop("items", [])
        delivery = Delivery.objects.create(**validated_data)
        for item_data in items_data:
            DeliveryItem.objects.create(delivery=delivery, **item_data)
        return delivery
