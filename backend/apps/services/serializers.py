from rest_framework import serializers
from .models import ServiceCatalogItem


class ServiceCatalogItemSerializer(serializers.ModelSerializer):
    station_name = serializers.CharField(source="station.name", read_only=True)

    class Meta:
        model = ServiceCatalogItem
        fields = ["id", "station", "station_name", "code", "name", "default_price_xof", "is_active"]
        read_only_fields = ["id"]
