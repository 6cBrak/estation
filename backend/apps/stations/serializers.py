from rest_framework import serializers
from .models import Station


class StationSerializer(serializers.ModelSerializer):
    manager_name = serializers.CharField(source="manager.get_full_name", read_only=True)

    class Meta:
        model = Station
        fields = [
            "id", "code", "name", "address", "city", "phone",
            "manager", "manager_name",
            "gauge_tolerance_pct", "cash_tolerance_xof",
            "is_active",
        ]
        read_only_fields = ["id"]
