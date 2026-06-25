from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import LubricantBrandViewSet, LubricantProductViewSet, LubricantStockViewSet

router = DefaultRouter()
router.register("brands", LubricantBrandViewSet, basename="lubricant-brand")
router.register("products", LubricantProductViewSet, basename="lubricant-product")
router.register("stocks", LubricantStockViewSet, basename="lubricant-stock")

urlpatterns = [path("", include(router.urls))]
