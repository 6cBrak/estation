from rest_framework.routers import DefaultRouter
from .views import ChargeViewSet

router = DefaultRouter()
router.register("", ChargeViewSet, basename="charge")

urlpatterns = router.urls
