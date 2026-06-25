from rest_framework import serializers
from .models import GasBottleFormat, GasBottleStock


class GasBottleFormatSerializer(serializers.ModelSerializer):
    class Meta:
        model = GasBottleFormat
        fields = ["id", "weight_kg", "label", "sale_price_xof", "deposit_xof", "is_active"]
        read_only_fields = ["id"]


class GasBottleStockSerializer(serializers.ModelSerializer):
    format_label = serializers.CharField(source="format.label", read_only=True)
    weight_kg = serializers.DecimalField(source="format.weight_kg", max_digits=5, decimal_places=2, read_only=True)
    sale_price_xof = serializers.DecimalField(source="format.sale_price_xof", max_digits=10, decimal_places=2, read_only=True)
    station_name = serializers.CharField(source="station.name", read_only=True)

    class Meta:
        model = GasBottleStock
        fields = [
            "id", "format", "format_label", "weight_kg", "sale_price_xof",
            "station", "station_name", "quantity",
        ]
        read_only_fields = ["id"]
