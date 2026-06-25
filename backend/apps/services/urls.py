from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ServiceCatalogItemViewSet

router = DefaultRouter()
router.register("", ServiceCatalogItemViewSet, basename="service")

urlpatterns = [path("", include(router.urls))]
