from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import GasBottleFormatViewSet, GasBottleStockViewSet

router = DefaultRouter()
router.register("formats", GasBottleFormatViewSet, basename="gas-format")
router.register("stocks", GasBottleStockViewSet, basename="gas-stock")

urlpatterns = [path("", include(router.urls))]
