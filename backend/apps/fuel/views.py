from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from apps.core.permissions import IsManager, IsCashier, StationFilterMixin
from .models import FuelType, Tank, Nozzle, TankReading, PumpReading
from .serializers import FuelTypeSerializer, TankSerializer, NozzleSerializer, TankReadingSerializer, PumpReadingSerializer


class FuelTypeViewSet(StationFilterMixin, viewsets.ModelViewSet):
    serializer_class = FuelTypeSerializer
    permission_classes = [IsManager]

    def get_queryset(self):
        user = self.request.user
        qs = FuelType.objects.all()
        if user.role == "super_admin":
            station_id = self.request.query_params.get("station")
            if station_id:
                qs = qs.filter(station_id=station_id)
        else:
            qs = qs.filter(station=user.station)
        return qs.order_by("name")

    def perform_create(self, serializer):
        user = self.request.user
        station = serializer.validated_data.get("station") or user.station
        serializer.save(station=station)


class TankViewSet(StationFilterMixin, viewsets.ModelViewSet):
    queryset = Tank.objects.filter(is_active=True).select_related("station", "fuel_type")
    serializer_class = TankSerializer
    permission_classes = [IsManager]

    def get_queryset(self):
        return self.get_station_queryset(super().get_queryset())


class NozzleViewSet(StationFilterMixin, viewsets.ModelViewSet):
    queryset = Nozzle.objects.filter(is_active=True).select_related("station", "tank", "tank__fuel_type")
    serializer_class = NozzleSerializer
    permission_classes = [IsManager]

    def get_queryset(self):
        return self.get_station_queryset(super().get_queryset())


class TankReadingViewSet(StationFilterMixin, viewsets.ModelViewSet):
    queryset = TankReading.objects.filter(is_active=True).select_related("tank__station", "recorded_by")
    serializer_class = TankReadingSerializer
    permission_classes = [IsCashier]
    http_method_names = ["get", "post", "head", "options"]

    def get_queryset(self):
        qs = super().get_queryset()
        if self.request.user.role != "super_admin" and self.request.user.station_id:
            qs = qs.filter(tank__station_id=self.request.user.station_id)
        return qs


class PumpReadingViewSet(viewsets.ModelViewSet):
    """
    Relevés d'index de pistolet par journée.
    GET  /fuel-readings/?date=YYYY-MM-DD  → relevés du jour pour la station
    POST /fuel-readings/                  → créer l'ouverture (index_open)
    PATCH /fuel-readings/{id}/            → saisir la fermeture (index_close)
    """

    serializer_class = PumpReadingSerializer
    permission_classes = [IsCashier]
    http_method_names = ["get", "post", "patch", "head", "options"]

    def get_queryset(self):
        user = self.request.user
        qs = PumpReading.objects.select_related(
            "nozzle__tank__fuel_type", "nozzle__station"
        ).filter(is_active=True)

        if user.role != "super_admin" and user.station_id:
            qs = qs.filter(nozzle__station_id=user.station_id)

        date_str = self.request.query_params.get("date")
        if date_str:
            qs = qs.filter(journal_date=date_str)

        return qs.order_by("journal_date", "nozzle__display_order")

    def perform_create(self, serializer):
        user = self.request.user
        nozzle = serializer.validated_data["nozzle"]
        if user.role != "super_admin" and nozzle.station_id != user.station_id:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Ce pistolet n'appartient pas à votre station.")
        serializer.save(created_by=user)
