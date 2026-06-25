from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.request import Request
from rest_framework.response import Response
from apps.core.permissions import IsManager, IsSuperAdmin, StationFilterMixin
from .models import Charge
from .serializers import ChargeSerializer, ChargeCreateSerializer, ChargeValidateSerializer


class ChargeViewSet(StationFilterMixin, viewsets.ModelViewSet):
    queryset = Charge.objects.filter(is_active=True).select_related(
        "station", "journal", "created_by", "validated_by"
    )
    serializer_class = ChargeSerializer
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_permissions(self):
        if self.action in ("review",):
            return [IsSuperAdmin()]
        return [IsManager()]

    def get_queryset(self):
        qs = self.filter_by_station(super().get_queryset())

        category = self.request.query_params.get("category")
        if category:
            qs = qs.filter(category=category)

        status_filter = self.request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)

        date_from = self.request.query_params.get("date_from")
        if date_from:
            qs = qs.filter(charge_date__gte=date_from)

        date_to = self.request.query_params.get("date_to")
        if date_to:
            qs = qs.filter(charge_date__lte=date_to)

        journal_id = self.request.query_params.get("journal")
        if journal_id:
            qs = qs.filter(journal_id=journal_id)

        return qs

    def get_serializer_class(self):
        if self.action == "create":
            return ChargeCreateSerializer
        return ChargeSerializer

    def create(self, request: Request) -> Response:
        user = request.user
        if user.role != "super_admin" and not user.station_id:
            return Response(
                {"detail": "Aucune station assignée."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = ChargeCreateSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        charge = serializer.save()
        return Response(ChargeSerializer(charge).data, status=status.HTTP_201_CREATED)

    def update(self, request: Request, pk=None) -> Response:
        charge = self.get_object()
        if charge.status != "pending":
            return Response(
                {"detail": "Seules les charges en attente peuvent être modifiées."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = ChargeCreateSerializer(
            instance=charge, data=request.data, partial=True, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(ChargeSerializer(charge).data)

    def destroy(self, request: Request, pk=None) -> Response:
        charge = self.get_object()
        if charge.status != "pending":
            return Response(
                {"detail": "Seules les charges en attente peuvent être supprimées."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        charge.is_active = False
        charge.save(update_fields=["is_active", "updated_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"], url_path="review", permission_classes=[IsSuperAdmin])
    def review(self, request: Request, pk=None) -> Response:
        charge = self.get_object()
        if charge.status != "pending":
            return Response(
                {"detail": "Cette charge a déjà été traitée."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = ChargeValidateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        charge = serializer.save(charge=charge, validated_by=request.user)
        return Response(ChargeSerializer(charge).data)
