from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from apps.core.permissions import IsManager, IsCashier, StationFilterMixin
from .models import ProductCategory, Product, ProductStock
from .serializers import ProductCategorySerializer, ProductSerializer, ProductStockSerializer


class ProductCategoryViewSet(viewsets.ModelViewSet):
    queryset = ProductCategory.objects.all()
    serializer_class = ProductCategorySerializer
    permission_classes = [IsManager]


class ProductViewSet(viewsets.ModelViewSet):
    queryset = Product.objects.filter(is_active=True).select_related("category")
    serializer_class = ProductSerializer
    permission_classes = [IsManager]

    @action(detail=False, methods=["get"], permission_classes=[IsCashier])
    def by_barcode(self, request) -> Response:
        barcode = request.query_params.get("q", "").strip()
        if not barcode:
            return Response({"detail": "Paramètre 'q' requis."}, status=400)
        try:
            product = Product.objects.select_related("category").get(
                barcode=barcode, is_active=True
            )
            return Response(ProductSerializer(product).data)
        except Product.DoesNotExist:
            return Response({"detail": "Produit introuvable."}, status=404)


class ProductStockViewSet(StationFilterMixin, viewsets.ModelViewSet):
    queryset = (
        ProductStock.objects.filter(is_active=True)
        .select_related("product__category", "station")
    )
    serializer_class = ProductStockSerializer
    permission_classes = [IsCashier]

    def get_queryset(self):
        return self.get_station_queryset(super().get_queryset())
