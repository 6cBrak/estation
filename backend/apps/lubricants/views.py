from rest_framework import viewsets
from apps.core.permissions import IsCashier, IsManager, StationFilterMixin
from .models import LubricantBrand, LubricantProduct, LubricantStock
from .serializers import LubricantBrandSerializer, LubricantProductSerializer, LubricantStockSerializer


class LubricantBrandViewSet(viewsets.ModelViewSet):
    queryset = LubricantBrand.objects.all()
    serializer_class = LubricantBrandSerializer
    permission_classes = [IsManager]


class LubricantProductViewSet(viewsets.ModelViewSet):
    queryset = LubricantProduct.objects.filter(is_active=True).select_related("brand")
    serializer_class = LubricantProductSerializer
    permission_classes = [IsManager]


class LubricantStockViewSet(StationFilterMixin, viewsets.ModelViewSet):
    queryset = LubricantStock.objects.filter(is_active=True).select_related("product__brand", "station")
    serializer_class = LubricantStockSerializer

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [IsManager()]
        return [IsCashier()]

    def get_queryset(self):
        return self.get_station_queryset(super().get_queryset())
