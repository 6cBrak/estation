from decimal import Decimal

from django.db import models
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.mixins import RetrieveModelMixin, UpdateModelMixin
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet, ModelViewSet

from apps.core.permissions import IsManagerOrAdmin, StationFilterMixin

from .models import (
    AvoirWithdrawal,
    JournalExpense,
    JournalFuelLine,
    JournalLubricantLine,
    JournalPaymentSummary,
    JournalSalesRecap,
    StationJournal,
)
from .serializers import (
    AvoirWithdrawalSerializer,
    JournalCloseSerializer,
    JournalExpenseSerializer,
    JournalFuelLineSerializer,
    JournalFuelLineUpdateSerializer,
    JournalLubricantLineSerializer,
    JournalOpenSerializer,
    JournalPaymentSummarySerializer,
    JournalSalesRecapSerializer,
    JournalValidateSerializer,
    StationJournalDetailSerializer,
    StationJournalListSerializer,
)
from .services import (
    JournalServiceError,
    close_journal,
    delete_journal,
    open_journal,
    reopen_journal,
    sync_journal_nozzles,
    validate_journal,
)



class StationJournalViewSet(StationFilterMixin, ModelViewSet):
    """
    ViewSet principal pour les journaux de station.
    Ouverture via POST /journals/ — clôture et validation via actions dédiées.
    """

    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "post", "patch", "head", "options"]

    def get_queryset(self):
        qs = StationJournal.objects.filter(is_active=True).select_related(
            "station", "manager", "validated_by"
        )
        return self.filter_by_station(qs)

    def get_serializer_class(self):
        if self.action == "list":
            return StationJournalListSerializer
        return StationJournalDetailSerializer

    def create(self, request, *args, **kwargs):
        serializer = JournalOpenSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        station = self._get_station_from_request()
        journal_date = serializer.validated_data.get("journal_date")

        try:
            journal = open_journal(
                station=station,
                manager=request.user,
                journal_date=journal_date,
            )
        except JournalServiceError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        out = StationJournalDetailSerializer(journal, context={"request": request})
        return Response(out.data, status=status.HTTP_201_CREATED)

    def partial_update(self, request, *args, **kwargs):
        journal = self.get_object()
        if not journal.is_editable:
            return Response(
                {"detail": "Ce journal ne peut plus être modifié."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        allowed = {k: v for k, v in request.data.items() if k in ("notes",)}
        serializer = StationJournalDetailSerializer(
            journal, data=allowed, partial=True, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="close")
    def close(self, request, pk=None):
        journal = self.get_object()
        serializer = JournalCloseSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        if serializer.validated_data.get("notes"):
            journal.notes = serializer.validated_data["notes"]
            journal.save(update_fields=["notes", "updated_at"])
        try:
            journal = close_journal(journal)
        except JournalServiceError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        out = StationJournalDetailSerializer(journal, context={"request": request})
        return Response(out.data)

    @action(
        detail=True,
        methods=["post"],
        url_path="validate",
        permission_classes=[IsManagerOrAdmin],
    )
    def validate_action(self, request, pk=None):
        journal = self.get_object()
        serializer = JournalValidateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            journal = validate_journal(journal, validated_by=request.user)
        except JournalServiceError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        out = StationJournalDetailSerializer(journal, context={"request": request})
        return Response(out.data)

    @action(
        detail=True,
        methods=["post"],
        url_path="reopen",
        permission_classes=[IsManagerOrAdmin],
    )
    def reopen(self, request, pk=None):
        """Réactive un journal clôturé ou validé. Super admin seulement."""
        if request.user.role != "super_admin":
            return Response(
                {"detail": "Seul un super administrateur peut réactiver un journal."},
                status=status.HTTP_403_FORBIDDEN,
            )
        journal = self.get_object()
        try:
            journal = reopen_journal(journal, reopened_by=request.user)
        except JournalServiceError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        out = StationJournalDetailSerializer(journal, context={"request": request})
        return Response(out.data)

    @action(
        detail=True,
        methods=["post"],
        url_path="sync-nozzles",
        permission_classes=[IsManagerOrAdmin],
    )
    def sync_nozzles(self, request, pk=None):
        """Ajoute les lignes manquantes pour les pistolets créés après l'ouverture du journal."""
        journal = self.get_object()
        try:
            new_lines = sync_journal_nozzles(journal)
        except JournalServiceError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        out = StationJournalDetailSerializer(journal, context={"request": request})
        return Response({
            "journal": out.data,
            "added": len(new_lines),
        })

    @action(
        detail=True,
        methods=["post"],
        url_path="delete",
        permission_classes=[IsManagerOrAdmin],
    )
    def delete_action(self, request, pk=None):
        """Suppression logique d'un journal brouillon. Super admin seulement."""
        if request.user.role != "super_admin":
            return Response(
                {"detail": "Seul un super administrateur peut supprimer un journal."},
                status=status.HTTP_403_FORBIDDEN,
            )
        journal = self.get_object()
        try:
            delete_journal(journal)
        except JournalServiceError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["get"], url_path="pdf")
    def pdf(self, request, pk=None):
        """Génère et retourne le PDF du journal."""
        from django.conf import settings as django_settings
        from django.http import HttpResponse

        from .pdf import generate_journal_pdf, save_journal_pdf

        journal = self.get_object()
        if journal.status == "draft":
            return Response(
                {"detail": "Le journal doit être clôturé avant de générer le PDF."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            relative_path = save_journal_pdf(journal, str(django_settings.MEDIA_ROOT))
            if not journal.pdf_url:
                journal.pdf_url = relative_path
                journal.save(update_fields=["pdf_url", "updated_at"])

            pdf_bytes = generate_journal_pdf(journal)
        except Exception as exc:
            return Response(
                {"detail": f"Erreur génération PDF : {exc}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        response = HttpResponse(pdf_bytes, content_type="application/pdf")
        response["Content-Disposition"] = (
            f'attachment; filename="{journal.journal_number}.pdf"'
        )
        return response

    def _get_station_from_request(self):
        station_id = self.request.query_params.get("station") or self.request.data.get(
            "station"
        )
        if station_id:
            from apps.stations.models import Station

            return get_object_or_404(Station, pk=station_id, is_active=True)
        station = getattr(self.request.user, "station", None)
        if station is None:
            station = self.request.user.managed_stations.filter(is_active=True).first()
        if station is None:
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied("Aucune station associée à cet utilisateur.")
        return station


class _JournalSubModelMixin:
    """Filtre les sous-modèles du journal par station de l'utilisateur."""

    def _station_filter(self, qs):
        user = self.request.user
        if user.role == "super_admin":
            return qs
        if user.station_id:
            return qs.filter(journal__station_id=user.station_id)
        return qs.none()


class JournalFuelLineViewSet(_JournalSubModelMixin, RetrieveModelMixin, UpdateModelMixin, GenericViewSet):
    """Mise à jour des index de fermeture et jaugeage pour une ligne pistolet."""

    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "patch", "head", "options"]

    def get_queryset(self):
        qs = JournalFuelLine.objects.filter(
            journal__is_active=True
        ).select_related("nozzle__tank__fuel_type", "journal__station")
        return self._station_filter(qs)

    def get_serializer_class(self):
        if self.request.method == "PATCH":
            return JournalFuelLineUpdateSerializer
        return JournalFuelLineSerializer

    def partial_update(self, request, *args, **kwargs):
        line = self.get_object()
        if not line.journal.is_editable:
            return Response(
                {"detail": "Le journal associé ne peut plus être modifié."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = JournalFuelLineUpdateSerializer(line, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        out = JournalFuelLineSerializer(line, context={"request": request})
        return Response(out.data)


class JournalLubricantLineViewSet(
    _JournalSubModelMixin, RetrieveModelMixin, UpdateModelMixin, GenericViewSet
):
    """Mise à jour des quantités lubrifiants dans le journal."""

    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "patch", "head", "options"]

    def get_queryset(self):
        qs = JournalLubricantLine.objects.filter(
            journal__is_active=True
        ).select_related("lubricant__brand", "journal__station")
        return self._station_filter(qs)

    def get_serializer_class(self):
        return JournalLubricantLineSerializer

    def partial_update(self, request, *args, **kwargs):
        line = self.get_object()
        if not line.journal.is_editable:
            return Response(
                {"detail": "Le journal associé ne peut plus être modifié."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = JournalLubricantLineSerializer(line, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class JournalSalesRecapViewSet(
    _JournalSubModelMixin, RetrieveModelMixin, UpdateModelMixin, GenericViewSet
):
    """Mise à jour manuelle des récaps ventes (lubrifiants piste, services, etc.)."""

    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "patch", "head", "options"]

    def get_queryset(self):
        qs = JournalSalesRecap.objects.filter(
            journal__is_active=True
        ).select_related("journal__station")
        return self._station_filter(qs)

    def get_serializer_class(self):
        return JournalSalesRecapSerializer

    def partial_update(self, request, *args, **kwargs):
        recap = self.get_object()
        if not recap.journal.is_editable:
            return Response(
                {"detail": "Le journal associé ne peut plus être modifié."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = JournalSalesRecapSerializer(recap, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class JournalPaymentSummaryViewSet(
    _JournalSubModelMixin, RetrieveModelMixin, UpdateModelMixin, GenericViewSet
):
    """Récap des encaissements (bas du journal papier)."""

    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "patch", "head", "options"]

    def get_queryset(self):
        qs = JournalPaymentSummary.objects.filter(
            journal__is_active=True
        ).select_related("journal__station")
        return self._station_filter(qs)

    def get_serializer_class(self):
        return JournalPaymentSummarySerializer

    def partial_update(self, request, *args, **kwargs):
        summary = self.get_object()
        if not summary.journal.is_editable:
            return Response(
                {"detail": "Le journal associé ne peut plus être modifié."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = JournalPaymentSummarySerializer(summary, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class JournalExpenseViewSet(_JournalSubModelMixin, GenericViewSet):
    """Gestion des dépenses liées à un journal (création et suppression)."""

    permission_classes = [IsManagerOrAdmin]
    http_method_names = ["get", "post", "delete", "head", "options"]
    serializer_class = JournalExpenseSerializer

    def get_queryset(self):
        qs = JournalExpense.objects.filter(
            journal__is_active=True
        ).select_related("journal__station")
        return self._station_filter(qs)

    def list(self, request, *args, **kwargs):
        qs = self.get_queryset()
        journal_id = request.query_params.get("journal")
        month = request.query_params.get("month")
        year = request.query_params.get("year")
        if journal_id:
            qs = qs.filter(journal_id=journal_id)
        if month:
            qs = qs.filter(journal__journal_date__month=month)
        if year:
            qs = qs.filter(journal__journal_date__year=year)
        return Response(JournalExpenseSerializer(qs, many=True).data)

    def create(self, request, *args, **kwargs):
        # Création depuis le journal (journal fourni) ou depuis la page dépenses (date fournie)
        data = request.data.copy()
        if "journal" not in data and "expense_date" in data:
            expense_date = data.pop("expense_date")
            journal = StationJournal.objects.filter(
                station=request.user.station,
                journal_date=expense_date,
                is_active=True,
            ).first()
            if not journal:
                return Response(
                    {"detail": f"Aucun journal ouvert pour le {expense_date}. Ouvrez d'abord un journal."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            data["journal"] = str(journal.id)

        serializer = JournalExpenseSerializer(data=data)
        serializer.is_valid(raise_exception=True)
        journal = serializer.validated_data["journal"]
        if not journal.is_editable:
            return Response(
                {"detail": "Le journal associé ne peut plus être modifié."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def destroy(self, request, *args, **kwargs):
        expense = self.get_object()
        if not expense.journal.is_editable:
            return Response(
                {"detail": "Le journal associé ne peut plus être modifié."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        expense.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=["get"], url_path="summary")
    def summary(self, request):
        """Résumé des dépenses par catégorie pour une période."""
        from django.db.models import Sum as DSum
        month = request.query_params.get("month")
        year = request.query_params.get("year")
        if not (month and year):
            return Response({"detail": "Paramètres month et year requis."},
                            status=status.HTTP_400_BAD_REQUEST)
        qs = self.get_queryset().filter(
            journal__journal_date__month=month,
            journal__journal_date__year=year,
        )
        by_category = {}
        for cat, label in JournalExpense.CATEGORY_CHOICES:
            total = qs.filter(category=cat).aggregate(t=DSum("amount_xof"))["t"] or Decimal("0")
            by_category[cat] = {"label": label, "total": str(total)}
        grand_total = qs.aggregate(t=DSum("amount_xof"))["t"] or Decimal("0")
        return Response({"by_category": by_category, "total_xof": str(grand_total)})


class AvoirWithdrawalViewSet(StationFilterMixin, GenericViewSet):
    """Gestion des retraits d'avoir numérique (TPE + Tickets)."""

    permission_classes = [IsManagerOrAdmin]
    serializer_class = AvoirWithdrawalSerializer
    http_method_names = ["get", "post", "delete", "head", "options"]

    def get_queryset(self):
        qs = AvoirWithdrawal.objects.filter(is_active=True).select_related("station")
        qs = self.filter_by_station(qs)
        month = self.request.query_params.get("month")
        year = self.request.query_params.get("year")
        if month and year:
            qs = qs.filter(withdrawal_date__month=month, withdrawal_date__year=year)
        return qs

    def list(self, request, *args, **kwargs):
        qs = self.get_queryset()
        return Response(AvoirWithdrawalSerializer(qs, many=True).data)

    def create(self, request, *args, **kwargs):
        serializer = AvoirWithdrawalSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(created_by=request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def destroy(self, request, *args, **kwargs):
        obj = self.get_object()
        obj.is_active = False
        obj.save(update_fields=["is_active", "updated_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=["get"], url_path="summary")
    def summary(self, request):
        """Résumé avoir pour une période : total entrant, total retiré, solde."""
        from django.db.models import Sum as DSum
        station_id = request.query_params.get("station")
        month = request.query_params.get("month")
        year = request.query_params.get("year")

        if not (station_id and month and year):
            return Response({"detail": "Paramètres station, month et year requis."},
                            status=status.HTTP_400_BAD_REQUEST)

        # Total TPE + Tickets depuis les journaux de la période
        from apps.journal.models import JournalPaymentSummary as JPS
        summaries = JPS.objects.filter(
            journal__station_id=station_id,
            journal__journal_date__month=month,
            journal__journal_date__year=year,
            journal__is_active=True,
        ).aggregate(
            tpe=DSum("tpe_amount_xof"),
            tickets=DSum("tickets_amount_xof"),
        )
        avoir_total = (summaries["tpe"] or Decimal("0")) + (summaries["tickets"] or Decimal("0"))

        # Total retiré par type
        withdrawals = AvoirWithdrawal.objects.filter(
            station_id=station_id,
            withdrawal_date__month=month,
            withdrawal_date__year=year,
            is_active=True,
        ).aggregate(
            fuel=DSum("amount_xof", filter=models.Q(withdrawal_type="fuel")),
            cash=DSum("amount_xof", filter=models.Q(withdrawal_type="cash")),
        )
        w_fuel = withdrawals["fuel"] or Decimal("0")
        w_cash = withdrawals["cash"] or Decimal("0")
        w_total = w_fuel + w_cash

        return Response({
            "avoir_total_xof": str(avoir_total),
            "withdrawals_fuel_xof": str(w_fuel),
            "withdrawals_cash_xof": str(w_cash),
            "withdrawals_total_xof": str(w_total),
            "balance_xof": str(avoir_total - w_total),
        })
