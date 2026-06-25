from datetime import date

from django.http import HttpResponse
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import IsManagerOrAdmin
from apps.stations.models import Station

from .services import (
    cash_report,
    export_sales_excel,
    network_dashboard,
    reconciliation_report,
    sales_report,
    station_dashboard,
    stock_report,
)


def _parse_date(value: str | None, default: date) -> date:
    if value:
        try:
            return date.fromisoformat(value)
        except ValueError:
            pass
    return default


def _get_station(request, station_id: str | None = None) -> Station | None:
    if station_id:
        return Station.objects.filter(pk=station_id, is_active=True).first()
    if request.user.role == "super_admin":
        return None
    return getattr(request.user, "station", None)


class NetworkDashboardView(APIView):
    """Dashboard réseau — Super Admin uniquement."""

    permission_classes = [IsManagerOrAdmin]

    def get(self, request):
        if request.user.role not in ("super_admin",):
            return Response({"detail": "Accès réservé au Super Admin."}, status=403)
        target = _parse_date(request.query_params.get("date"), date.today())
        return Response(network_dashboard(target))


class StationDashboardView(APIView):
    """Dashboard station — Gérant ou Super Admin avec station_id."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        station_id = request.query_params.get("station")
        station = _get_station(request, station_id)
        if station is None:
            return Response({"detail": "Station introuvable ou non autorisée."}, status=404)
        target = _parse_date(request.query_params.get("date"), date.today())
        return Response(station_dashboard(station, target))


class SalesReportView(APIView):
    """Rapport des ventes sur une période."""

    permission_classes = [IsManagerOrAdmin]

    def get(self, request):
        station_id = request.query_params.get("station")
        station = _get_station(request, station_id)
        if station is None:
            return Response({"detail": "Station requise."}, status=400)
        today = date.today()
        date_from = _parse_date(request.query_params.get("date_from"), today.replace(day=1))
        date_to = _parse_date(request.query_params.get("date_to"), today)
        return Response(sales_report(station, date_from, date_to))


class SalesExcelExportView(APIView):
    """Export Excel du rapport ventes."""

    permission_classes = [IsManagerOrAdmin]

    def get(self, request):
        station_id = request.query_params.get("station")
        station = _get_station(request, station_id)
        if station is None:
            return Response({"detail": "Station requise."}, status=400)
        today = date.today()
        date_from = _parse_date(request.query_params.get("date_from"), today.replace(day=1))
        date_to = _parse_date(request.query_params.get("date_to"), today)

        try:
            excel_bytes = export_sales_excel(station, date_from, date_to)
        except Exception as exc:
            return Response({"detail": str(exc)}, status=500)

        response = HttpResponse(
            excel_bytes,
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        filename = f"ventes_{station.code}_{date_from}_{date_to}.xlsx"
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response


class StockReportView(APIView):
    """État des stocks actuels d'une station."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        station_id = request.query_params.get("station")
        station = _get_station(request, station_id)
        if station is None:
            return Response({"detail": "Station introuvable ou non autorisée."}, status=404)
        return Response(stock_report(station))


class CashReportView(APIView):
    """Rapport des clôtures de caisse."""

    permission_classes = [IsManagerOrAdmin]

    def get(self, request):
        station_id = request.query_params.get("station")
        station = _get_station(request, station_id)
        if station is None:
            return Response({"detail": "Station requise."}, status=400)
        today = date.today()
        date_from = _parse_date(request.query_params.get("date_from"), today.replace(day=1))
        date_to = _parse_date(request.query_params.get("date_to"), today)
        return Response(cash_report(station, date_from, date_to))


class ReconciliationReportView(APIView):
    """Rapprochement pompes / caisse / cuves pour une journée."""

    permission_classes = [IsManagerOrAdmin]

    def get(self, request):
        station_id = request.query_params.get("station")
        station = _get_station(request, station_id)
        if station is None:
            return Response({"detail": "Station requise."}, status=400)
        target = _parse_date(request.query_params.get("date"), date.today())
        return Response(reconciliation_report(station, target))
