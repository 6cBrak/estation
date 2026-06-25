from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import FuelTypeViewSet, TankViewSet, NozzleViewSet, TankReadingViewSet, PumpReadingViewSet

router = DefaultRouter()
router.register("types", FuelTypeViewSet, basename="fuel-type")
router.register("tanks", TankViewSet, basename="tank")
router.register("nozzles", NozzleViewSet, basename="nozzle")
router.register("tank-readings", TankReadingViewSet, basename="tank-reading")
router.register("pump-readings", PumpReadingViewSet, basename="pump-reading")

urlpatterns = [path("", include(router.urls))]
