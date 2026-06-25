from rest_framework import serializers
from .models import FuelType, Tank, Nozzle, TankReading, PumpReading


class FuelTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = FuelType
        fields = ["id", "station", "code", "name", "unit_price"]


class TankSerializer(serializers.ModelSerializer):
    fuel_type_name = serializers.CharField(source="fuel_type.name", read_only=True)
    station_name = serializers.CharField(source="station.name", read_only=True)
    is_low = serializers.BooleanField(read_only=True)

    class Meta:
        model = Tank
        fields = [
            "id", "station", "station_name", "fuel_type", "fuel_type_name",
            "label", "capacity_liters", "current_level_liters", "low_threshold_liters", "is_low", "is_active",
        ]
        read_only_fields = ["id", "current_level_liters"]


class NozzleSerializer(serializers.ModelSerializer):
    tank_label = serializers.CharField(source="tank.label", read_only=True)
    fuel_type_name = serializers.CharField(source="tank.fuel_type.name", read_only=True)

    class Meta:
        model = Nozzle
        fields = ["id", "station", "tank", "tank_label", "fuel_type_name", "label", "display_order", "is_active"]
        read_only_fields = ["id"]


class TankReadingSerializer(serializers.ModelSerializer):
    tank_label = serializers.CharField(source="tank.label", read_only=True)
    recorded_by_name = serializers.CharField(source="recorded_by.get_full_name", read_only=True)

    class Meta:
        model = TankReading
        fields = [
            "id", "tank", "tank_label", "level_liters", "reading_type",
            "recorded_at", "recorded_by", "recorded_by_name", "notes",
        ]
        read_only_fields = ["id", "recorded_at", "recorded_by"]

    def create(self, validated_data: dict) -> TankReading:
        validated_data["recorded_by"] = self.context["request"].user
        return super().create(validated_data)


class PumpReadingSerializer(serializers.ModelSerializer):
    nozzle_label = serializers.CharField(source="nozzle.label", read_only=True)
    fuel_type_name = serializers.CharField(source="nozzle.tank.fuel_type.name", read_only=True)
    unit_price_xof = serializers.DecimalField(
        source="nozzle.tank.fuel_type.unit_price", max_digits=10, decimal_places=2, read_only=True
    )
    output_volume = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    volume_sold = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    amount_xof = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)

    class Meta:
        model = PumpReading
        fields = [
            "id", "nozzle", "nozzle_label", "fuel_type_name", "journal_date",
            "index_open", "index_close", "return_volume",
            "output_volume", "volume_sold", "unit_price_xof", "amount_xof",
            "notes",
        ]
        read_only_fields = ["id", "output_volume", "volume_sold", "amount_xof"]

    def validate(self, data: dict) -> dict:
        index_close = data.get("index_close")
        index_open = data.get("index_open", getattr(self.instance, "index_open", None))
        if index_close is not None and index_open is not None and index_close < index_open:
            raise serializers.ValidationError(
                {"index_close": "L'index de fermeture ne peut pas être inférieur à l'index d'ouverture."}
            )
        return data
