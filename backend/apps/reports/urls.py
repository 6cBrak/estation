from django.urls import path

from .views import (
    CashReportView,
    NetworkDashboardView,
    ReconciliationReportView,
    SalesExcelExportView,
    SalesReportView,
    StationDashboardView,
    StockReportView,
)

urlpatterns = [
    path("dashboard/network/", NetworkDashboardView.as_view(), name="report-network-dashboard"),
    path("dashboard/station/", StationDashboardView.as_view(), name="report-station-dashboard"),
    path("sales/", SalesReportView.as_view(), name="report-sales"),
    path("sales/export/excel/", SalesExcelExportView.as_view(), name="report-sales-excel"),
    path("stocks/", StockReportView.as_view(), name="report-stocks"),
    path("cash/", CashReportView.as_view(), name="report-cash"),
    path("reconciliation/", ReconciliationReportView.as_view(), name="report-reconciliation"),
]
