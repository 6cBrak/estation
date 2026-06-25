from django.contrib import admin
from django.urls import path, include
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/v1/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    path("api/v1/auth/", include("apps.accounts.urls")),
    path("api/v1/stations/", include("apps.stations.urls")),
    path("api/v1/fuel/", include("apps.fuel.urls")),
    path("api/v1/lubricants/", include("apps.lubricants.urls")),
    path("api/v1/gas/", include("apps.gas.urls")),
    path("api/v1/sales/", include("apps.sales.urls")),
    path("api/v1/shop/", include("apps.shop.urls")),
    path("api/v1/services/", include("apps.services.urls")),
    path("api/v1/journal/", include("apps.journal.urls")),
    path("api/v1/suppliers/", include("apps.suppliers.urls")),
    path("api/v1/reports/", include("apps.reports.urls")),
    path("api/v1/charges/", include("apps.charges.urls")),
]
