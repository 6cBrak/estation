from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from apps.core.permissions import IsSuperAdmin, IsManager
from .models import Station
from .serializers import StationSerializer


class StationViewSet(viewsets.ModelViewSet):
    queryset = Station.objects.filter(is_active=True).select_related("manager")
    serializer_class = StationSerializer

    def get_permissions(self):
        if self.action in ("create", "destroy"):
            return [IsSuperAdmin()]
        return [IsManager()]

    def get_queryset(self):
        user = self.request.user
        qs = super().get_queryset()
        if user.role == "super_admin":
            return qs
        if user.station_id:
            return qs.filter(id=user.station_id)
        return qs.none()
