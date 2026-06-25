from rest_framework import viewsets
from apps.core.permissions import IsManager, IsCashier, StationFilterMixin
from .models import ServiceCatalogItem
from .serializers import ServiceCatalogItemSerializer


class ServiceCatalogItemViewSet(StationFilterMixin, viewsets.ModelViewSet):
    queryset = ServiceCatalogItem.objects.filter(is_active=True).select_related("station")
    serializer_class = ServiceCatalogItemSerializer
    permission_classes = [IsCashier]

    def get_queryset(self):
        return self.get_station_queryset(super().get_queryset())

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [IsManager()]
        return [IsCashier()]
