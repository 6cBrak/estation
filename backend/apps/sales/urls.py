from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CashSessionViewSet, SaleViewSet

router = DefaultRouter()
router.register("sessions", CashSessionViewSet, basename="cash-session")
router.register("sales", SaleViewSet, basename="sale")

urlpatterns = [path("", include(router.urls))]
