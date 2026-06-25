from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from apps.core.permissions import IsManagerOrAdmin, StationFilterMixin

from .models import Delivery, PurchaseOrder, Supplier
from .serializers import (
    DeliveryDetailSerializer,
    DeliveryListSerializer,
    PurchaseOrderDetailSerializer,
    PurchaseOrderListSerializer,
    SupplierSerializer,
)
from .services import SupplierServiceError, confirm_delivery


class SupplierViewSet(ModelViewSet):
    """CRUD fournisseurs — accessible à tous les managers."""

    serializer_class = SupplierSerializer
    permission_classes = [IsManagerOrAdmin]

    def get_queryset(self):
        qs = Supplier.objects.filter(is_active=True)
        category = self.request.query_params.get("category")
        if category:
            qs = qs.filter(category=category)
        return qs


class PurchaseOrderViewSet(StationFilterMixin, ModelViewSet):
    """Bons de commande par station."""

    permission_classes = [IsManagerOrAdmin]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_queryset(self):
        qs = (
            PurchaseOrder.objects.filter(is_active=True)
            .select_related("station", "supplier")
            .prefetch_related("items")
        )
        qs = self.filter_by_station(qs)
        status_param = self.request.query_params.get("status")
        if status_param:
            qs = qs.filter(status=status_param)
        return qs

    def get_serializer_class(self):
        if self.action == "list":
            return PurchaseOrderListSerializer
        return PurchaseOrderDetailSerializer

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=["post"], url_path="send")
    def send(self, request, pk=None):
        order = self.get_object()
        if order.status != "draft":
            return Response(
                {"detail": "Seul un BC en brouillon peut être envoyé."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        order.status = "sent"
        order.sent_at = timezone.now()
        order.save(update_fields=["status", "sent_at", "updated_at"])
        return Response(
            PurchaseOrderDetailSerializer(order, context={"request": request}).data
        )

    @action(detail=True, methods=["post"], url_path="cancel")
    def cancel(self, request, pk=None):
        order = self.get_object()
        if order.status in ("received", "cancelled"):
            return Response(
                {"detail": f"Un BC '{order.get_status_display()}' ne peut pas être annulé."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        order.status = "cancelled"
        order.save(update_fields=["status", "updated_at"])
        return Response(
            PurchaseOrderDetailSerializer(order, context={"request": request}).data
        )


class DeliveryViewSet(StationFilterMixin, ModelViewSet):
    """Livraisons reçues — la confirmation met à jour les stocks automatiquement."""

    permission_classes = [IsManagerOrAdmin]
    http_method_names = ["get", "post", "patch", "head", "options"]

    def get_queryset(self):
        qs = (
            Delivery.objects.filter(is_active=True)
            .select_related("station", "supplier", "purchase_order", "confirmed_by")
            .prefetch_related("items")
        )
        qs = self.filter_by_station(qs)
        status_param = self.request.query_params.get("status")
        if status_param:
            qs = qs.filter(status=status_param)
        return qs

    def get_serializer_class(self):
        if self.action == "list":
            return DeliveryListSerializer
        return DeliveryDetailSerializer

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=["post"], url_path="confirm")
    def confirm(self, request, pk=None):
        """Confirme la livraison et met à jour les stocks."""
        delivery = self.get_object()
        try:
            delivery = confirm_delivery(delivery, confirmed_by=request.user)
        except SupplierServiceError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(
            DeliveryDetailSerializer(delivery, context={"request": request}).data
        )
