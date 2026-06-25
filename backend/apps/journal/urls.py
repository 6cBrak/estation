from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    AvoirWithdrawalViewSet,
    JournalExpenseViewSet,
    JournalFuelLineViewSet,
    JournalLubricantLineViewSet,
    JournalPaymentSummaryViewSet,
    JournalSalesRecapViewSet,
    StationJournalViewSet,
)

router = DefaultRouter()
router.register("journals", StationJournalViewSet, basename="journal")
router.register("fuel-lines", JournalFuelLineViewSet, basename="journal-fuel-line")
router.register("lubricant-lines", JournalLubricantLineViewSet, basename="journal-lubricant-line")
router.register("sales-recaps", JournalSalesRecapViewSet, basename="journal-sales-recap")
router.register("payment-summaries", JournalPaymentSummaryViewSet, basename="journal-payment-summary")
router.register("expenses", JournalExpenseViewSet, basename="journal-expense")
router.register("avoir-withdrawals", AvoirWithdrawalViewSet, basename="avoir-withdrawal")

urlpatterns = [
    path("", include(router.urls)),
]
