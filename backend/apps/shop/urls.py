from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ProductCategoryViewSet, ProductViewSet, ProductStockViewSet

router = DefaultRouter()
router.register("categories", ProductCategoryViewSet, basename="product-category")
router.register("products", ProductViewSet, basename="product")
router.register("stocks", ProductStockViewSet, basename="product-stock")

urlpatterns = [path("", include(router.urls))]
