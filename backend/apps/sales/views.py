from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.request import Request
from rest_framework.response import Response
from apps.core.permissions import IsCashier, IsManager, StationFilterMixin
from .models import CashSession, Sale
from .serializers import (
    CashSessionSerializer,
    CashSessionOpenSerializer,
    CashSessionCloseSerializer,
    SaleSerializer,
    SaleCreateSerializer,
)


class CashSessionViewSet(StationFilterMixin, viewsets.ModelViewSet):
    queryset = CashSession.objects.filter(is_active=True).select_related("station", "cashier")
    serializer_class = CashSessionSerializer
    http_method_names = ["get", "post", "head", "options"]

    def get_permissions(self):
        return [IsCashier()]

    def get_queryset(self):
        qs = self.get_station_queryset(super().get_queryset())
        date_str = self.request.query_params.get("date")
        if date_str:
            qs = qs.filter(opened_at__date=date_str)
        return qs

    @action(detail=False, methods=["post"], url_path="open")
    def open_session(self, request: Request) -> Response:
        if not request.user.station_id:
            return Response(
                {"detail": "Aucune station assignée."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = CashSessionOpenSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        session = serializer.save()
        return Response(CashSessionSerializer(session).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="close", permission_classes=[IsManager])
    def close_session(self, request: Request, pk=None) -> Response:
        session = self.get_object()
        serializer = CashSessionCloseSerializer(
            instance=session, data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        session = serializer.save()
        return Response(CashSessionSerializer(session).data)

    @action(detail=True, methods=["post"], url_path="validate", permission_classes=[IsManager])
    def validate_session(self, request: Request, pk=None) -> Response:
        session = self.get_object()
        if session.status != "closed":
            return Response(
                {"detail": "La session doit être clôturée avant validation."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        session.status = "validated"
        session.save(update_fields=["status", "updated_at"])
        return Response(CashSessionSerializer(session).data)


class SaleViewSet(StationFilterMixin, viewsets.ModelViewSet):
    queryset = (
        Sale.objects.filter(is_active=True)
        .select_related("session__station", "session__cashier")
        .prefetch_related("items", "payments")
    )
    serializer_class = SaleSerializer
    http_method_names = ["get", "post", "head", "options"]

    def get_permissions(self):
        if self.action == "cancel":
            return [IsManager()]
        return [IsCashier()]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.role != "super_admin" and user.station_id:
            qs = qs.filter(session__station_id=user.station_id)
        session_id = self.request.query_params.get("session")
        if session_id:
            qs = qs.filter(session_id=session_id)
        elif self.request.query_params.get("date"):
            qs = qs.filter(sold_at__date=self.request.query_params["date"])
        return qs

    def get_serializer_class(self):
        if self.action == "create":
            return SaleCreateSerializer
        return SaleSerializer

    def create(self, request: Request) -> Response:
        if not request.user.station_id:
            return Response(
                {"detail": "Aucune station assignée."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = SaleCreateSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        sale = serializer.save()
        return Response(SaleSerializer(sale).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], permission_classes=[IsManager])
    def cancel(self, request: Request, _pk=None) -> Response:
        sale = self.get_object()
        if sale.status == "cancelled":
            return Response(
                {"detail": "Cette vente est déjà annulée."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        reason = request.data.get("reason", "").strip()
        if not reason:
            return Response(
                {"detail": "Le motif d'annulation est obligatoire."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        sale.status = "cancelled"
        sale.cancel_reason = reason
        sale.save(update_fields=["status", "cancel_reason", "updated_at"])
        return Response(SaleSerializer(sale).data)

    @action(detail=False, methods=["get"], permission_classes=[IsManager])
    def dashboard(self, request: Request) -> Response:
        from django.db.models import Sum, Count
        from apps.fuel.models import Tank, PumpReading
        from apps.lubricants.models import LubricantStock
        from apps.gas.models import GasBottleStock

        today = timezone.localdate()
        user = request.user
        station_filter = {} if user.role == "super_admin" else {"station_id": user.station_id}
        pump_filter = (
            {} if user.role == "super_admin"
            else {"pump__station_id": user.station_id}
        )

        # Ventes boutique/services/gaz du jour
        sales_today = Sale.objects.filter(
            sold_at__date=today, status="completed", **station_filter
        ).aggregate(total=Sum("total_xof"), count=Count("id"))

        # Volumes carburant du jour depuis les relevés d'index
        pump_readings_today = PumpReading.objects.filter(
            journal_date=today, **pump_filter
        ).select_related("pump__tank__fuel_type")

        fuel_summary = []
        for pr in pump_readings_today:
            fuel_summary.append({
                "pump": pr.pump.label,
                "fuel_type": pr.pump.tank.fuel_type.name,
                "index_open": pr.index_open,
                "index_close": pr.index_close,
                "volume_sold": pr.volume_sold,
                "amount_xof": pr.amount_xof,
            })

        tanks = Tank.objects.filter(
            is_active=True, **station_filter
        ).select_related("fuel_type", "station")
        lub_stocks = LubricantStock.objects.filter(
            **station_filter
        ).select_related("product__brand", "station")
        gas_stocks = GasBottleStock.objects.filter(
            **station_filter
        ).select_related("format", "station")

        return Response({
            "today": str(today),
            "other_sales": {
                "total_xof": sales_today["total"] or 0,
                "count": sales_today["count"],
            },
            "fuel_readings": fuel_summary,
            "fuel_tanks": [
                {
                    "id": str(t.id),
                    "label": t.label,
                    "station": t.station.name,
                    "fuel_type": t.fuel_type.name,
                    "current_level_liters": t.current_level_liters,
                    "capacity_liters": t.capacity_liters,
                    "is_low": t.is_low,
                }
                for t in tanks
            ],
            "lubricant_stocks": [
                {
                    "id": str(s.id),
                    "product": str(s.product),
                    "station": s.station.name,
                    "quantity": s.quantity,
                }
                for s in lub_stocks
            ],
            "gas_stocks": [
                {
                    "id": str(s.id),
                    "format": s.format.label,
                    "station": s.station.name,
                    "quantity": s.quantity,
                }
                for s in gas_stocks
            ],
        })
