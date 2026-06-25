from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import DeliveryViewSet, PurchaseOrderViewSet, SupplierViewSet

router = DefaultRouter()
router.register("suppliers", SupplierViewSet, basename="supplier")
router.register("purchase-orders", PurchaseOrderViewSet, basename="purchase-order")
router.register("deliveries", DeliveryViewSet, basename="delivery")

urlpatterns = [
    path("", include(router.urls)),
]
