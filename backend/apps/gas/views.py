from rest_framework import viewsets
from apps.core.permissions import IsCashier, IsManager, StationFilterMixin
from .models import GasBottleFormat, GasBottleStock
from .serializers import GasBottleFormatSerializer, GasBottleStockSerializer


class GasBottleFormatViewSet(viewsets.ModelViewSet):
    queryset = GasBottleFormat.objects.filter(is_active=True)
    serializer_class = GasBottleFormatSerializer
    permission_classes = [IsManager]


class GasBottleStockViewSet(StationFilterMixin, viewsets.ModelViewSet):
    queryset = GasBottleStock.objects.filter(is_active=True).select_related("format", "station")
    serializer_class = GasBottleStockSerializer

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [IsManager()]
        return [IsCashier()]

    def get_queryset(self):
        return self.get_station_queryset(super().get_queryset())
