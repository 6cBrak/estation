from __future__ import annotations

import hashlib
import json
from datetime import date, timedelta
from decimal import Decimal
from typing import Optional

from django.db import transaction
from django.utils import timezone


from apps.fuel.models import Nozzle
from apps.lubricants.models import LubricantStock

from .models import (
    JournalFuelLine,
    JournalLubricantLine,
    JournalPaymentSummary,
    JournalSalesRecap,
    StationJournal,
)


class JournalServiceError(Exception):
    pass


def _get_previous_journal(station_id, current_date: date) -> Optional[StationJournal]:
    return (
        StationJournal.objects.filter(
            station_id=station_id,
            journal_date__lt=current_date,
            is_active=True,
        )
        .order_by("-journal_date")
        .first()
    )


def _get_previous_fuel_line(prev_journal: StationJournal, nozzle_id) -> Optional[JournalFuelLine]:
    if prev_journal is None:
        return None
    return prev_journal.fuel_lines.filter(nozzle_id=nozzle_id).first()


def _get_previous_lubricant_line(
    prev_journal: StationJournal, lubricant_id
) -> Optional[JournalLubricantLine]:
    if prev_journal is None:
        return None
    return prev_journal.lubricant_lines.filter(lubricant_id=lubricant_id).first()


def _compute_monthly_cumul(journal: StationJournal, category: str) -> Decimal:
    """Somme des daily_value_xof pour la catégorie depuis le 1er du mois jusqu'à J-1."""
    first_day = journal.journal_date.replace(day=1)
    result = (
        JournalSalesRecap.objects.filter(
            journal__station=journal.station,
            journal__journal_date__gte=first_day,
            journal__journal_date__lt=journal.journal_date,
            journal__is_active=True,
            category=category,
        )
        .values_list("daily_value_xof", flat=True)
    )
    return sum(result, Decimal("0"))


def _compute_previous_month_total(journal: StationJournal, category: str) -> Decimal:
    """Total du mois précédent pour la catégorie."""
    first_day_current = journal.journal_date.replace(day=1)
    last_day_prev = first_day_current - timedelta(days=1)
    first_day_prev = last_day_prev.replace(day=1)
    result = (
        JournalSalesRecap.objects.filter(
            journal__station=journal.station,
            journal__journal_date__gte=first_day_prev,
            journal__journal_date__lte=last_day_prev,
            journal__is_active=True,
            category=category,
        )
        .values_list("daily_value_xof", flat=True)
    )
    return sum(result, Decimal("0"))


@transaction.atomic
def open_journal(
    station,
    manager,
    journal_date: Optional[date] = None,
) -> StationJournal:
    """
    Crée un nouveau journal pour la station à la date donnée.
    Reprend automatiquement les valeurs du journal de la veille (index_open, stocks).
    Pour les pistolets partageant une cuve, le stock de clôture du précédent
    initialise le stock d'ouverture du suivant (par display_order).
    """
    if journal_date is None:
        journal_date = timezone.localdate()

    already_exists = StationJournal.objects.filter(
        station=station, journal_date=journal_date, is_active=True
    ).exists()
    if already_exists:
        raise JournalServiceError(
            f"Un journal existe déjà pour la station {station.code} le {journal_date}."
        )

    journal = StationJournal.objects.create(
        station=station,
        manager=manager,
        journal_date=journal_date,
        status="draft",
        created_by=manager,
    )

    prev_journal = _get_previous_journal(station.id, journal_date)

    # Lignes carburant — une par pistolet actif, triées par display_order
    # Le stock d'ouverture d'un pistolet partageant la cuve du précédent reprend
    # le stock de clôture de ce dernier (logique de cascade cuve partagée).
    nozzles = Nozzle.objects.filter(station=station, is_active=True).select_related(
        "tank__fuel_type"
    ).order_by("display_order")

    # Mémoriser le dernier stock de clôture par tank pour la cascade
    last_close_by_tank: dict = {}
    # Tanks déjà initialisés depuis le niveau cuve (premier pistolet du tank, jour J0)
    initialized_tanks: set = set()

    for nozzle in nozzles:
        prev_line = _get_previous_fuel_line(prev_journal, nozzle.id)
        index_open = (
            prev_line.index_close
            if prev_line and prev_line.index_close is not None
            else Decimal("0")
        )

        # Cascade cuve partagée : si un pistolet précédent a déjà fourni un stock
        # de clôture pour cette cuve, l'utiliser comme stock d'ouverture
        if nozzle.tank_id in last_close_by_tank:
            gauged_stock_open = last_close_by_tank[nozzle.tank_id]
        elif prev_line and prev_line.gauged_stock_close is not None:
            gauged_stock_open = prev_line.gauged_stock_close
        elif nozzle.tank_id not in initialized_tanks:
            # Premier journal pour cette cuve : utiliser le niveau actuel de la cuve
            gauged_stock_open = nozzle.tank.current_level_liters
        else:
            # Pistolet suivant sur la même cuve, sans historique : 0
            # (son stock d'ouverture réel sera la clôture du pistolet précédent)
            gauged_stock_open = Decimal("0")

        initialized_tanks.add(nozzle.tank_id)

        JournalFuelLine.objects.create(
            journal=journal,
            nozzle=nozzle,
            index_open=index_open,
            gauged_stock_open=gauged_stock_open,
        )

        # Si ce pistolet a un stock de clôture J-1, l'enregistrer pour la cascade
        if prev_line and prev_line.gauged_stock_close is not None:
            last_close_by_tank[nozzle.tank_id] = prev_line.gauged_stock_close

    # Lignes lubrifiants — un par produit en stock dans la station
    lub_stocks = LubricantStock.objects.filter(
        station=station, is_active=True
    ).select_related("product__brand")
    for lub_stock in lub_stocks:
        prev_line = _get_previous_lubricant_line(prev_journal, lub_stock.product.id)
        if prev_line is not None:
            stock_open = prev_line.stock_close_theoretical or Decimal("0")
        else:
            stock_open = lub_stock.quantity
        JournalLubricantLine.objects.create(
            journal=journal,
            lubricant=lub_stock.product,
            stock_open=stock_open,
        )

    # Récaps ventes — initialiser les cumuls mensuels depuis l'historique
    for category, _ in JournalSalesRecap.CATEGORY_CHOICES:
        monthly_cumul = _compute_monthly_cumul(journal, category)
        previous_month_total = _compute_previous_month_total(journal, category)
        JournalSalesRecap.objects.create(
            journal=journal,
            category=category,
            monthly_cumul_xof=monthly_cumul,
            previous_day_cumul_xof=monthly_cumul,
            previous_month_total_xof=previous_month_total,
        )

    # Récap encaissements vide
    JournalPaymentSummary.objects.create(journal=journal)

    return journal


@transaction.atomic
def close_journal(journal: StationJournal) -> StationJournal:
    """
    Clôture le journal après validation des données saisies.
    Vérifie que tous les index de fermeture sont renseignés.
    Vérifie que les écarts de jaugeage ont un commentaire si > tolérance.
    Met à jour les récaps de ventes.
    """
    if journal.status != "draft":
        raise JournalServiceError(
            f"Le journal {journal.journal_number} ne peut pas être clôturé "
            f"(statut actuel : {journal.status})."
        )

    tolerance_pct = journal.station.gauge_tolerance_pct

    # Vérification des lignes carburant
    for line in journal.fuel_lines.select_related("nozzle__tank__fuel_type"):
        if line.index_close is None:
            raise JournalServiceError(
                f"L'index de fermeture du pistolet « {line.nozzle.label} » n'est pas renseigné."
            )
        if line.gauged_stock_close is None:
            raise JournalServiceError(
                f"Le stock jaugé de fermeture du pistolet « {line.nozzle.label} » "
                f"n'est pas renseigné."
            )
        if line.gauge_diff is not None and line.theoretical_stock and line.theoretical_stock > 0:
            ecart_pct = abs(line.gauge_diff / line.theoretical_stock * 100)
            if ecart_pct > tolerance_pct and not line.diff_comment.strip():
                raise JournalServiceError(
                    f"L'écart de jaugeage du pistolet « {line.nozzle.label} » "
                    f"({ecart_pct:.1f}%) dépasse la tolérance ({tolerance_pct}%). "
                    f"Un commentaire est obligatoire."
                )

    # Mise à jour des récaps ventes carburant depuis les lignes pompes
    _update_fuel_sales_recap(journal)

    # Mise à jour des récaps ventes non-carburant depuis la caisse du jour
    _update_nonfuel_sales_recap(journal)

    # Synchroniser le niveau des cuves depuis le jaugeage de clôture
    # Plusieurs pistolets sur la même cuve → on prend la dernière valeur saisie
    tanks_to_sync: dict = {}
    for line in journal.fuel_lines.select_related("nozzle__tank"):
        if line.gauged_stock_close is not None:
            tank = line.nozzle.tank
            tanks_to_sync[tank.id] = {"tank": tank, "level": line.gauged_stock_close}
    for item in tanks_to_sync.values():
        item["tank"].current_level_liters = item["level"]
        item["tank"].save(update_fields=["current_level_liters", "updated_at"])

    journal.status = "closed"
    journal.closed_at = timezone.now()
    journal.save(update_fields=["status", "closed_at", "updated_at"])
    return journal


def _update_fuel_sales_recap(journal: StationJournal) -> None:
    """Met à jour les lignes récap carburant à partir des JournalFuelLine."""
    FUEL_CODE_TO_CATEGORY = {
        "super": "super", "sp95": "super", "sp98": "super", "essence": "super",
        "petrole": "petrole", "kerosene": "petrole", "kero": "petrole",
        "gasoil": "gasoil", "diesel": "gasoil", "go": "gasoil", "gas-oil": "gasoil",
    }

    totals: dict[str, dict] = {}
    for line in journal.fuel_lines.select_related("nozzle__tank__fuel_type"):
        fuel_code = line.nozzle.tank.fuel_type.code.lower()
        category = FUEL_CODE_TO_CATEGORY.get(fuel_code)
        if category is None:
            continue
        if category not in totals:
            totals[category] = {
                "qty": Decimal("0"),
                "unit_price": line.nozzle.tank.fuel_type.unit_price,
                "amount": Decimal("0"),
            }
        if line.sold_volume is not None:
            totals[category]["qty"] += line.sold_volume
        if line.amount_xof is not None:
            totals[category]["amount"] += line.amount_xof

    for category, data in totals.items():
        recap = JournalSalesRecap.objects.filter(
            journal=journal, category=category
        ).first()
        if recap:
            recap.qty = data["qty"]
            recap.unit_price_xof = data["unit_price"]
            recap.daily_value_xof = data["amount"]
            recap.monthly_cumul_xof = recap.previous_day_cumul_xof + data["amount"]
            recap.save(
                update_fields=[
                    "qty",
                    "unit_price_xof",
                    "daily_value_xof",
                    "monthly_cumul_xof",
                ]
            )


def _update_nonfuel_sales_recap(journal: StationJournal) -> None:
    """
    Met à jour les lignes récap non-carburant depuis les ventes caisse du jour.
    Agrège les SaleItem par type et par sous-catégorie de service.
    """
    from django.db.models import Sum
    from apps.sales.models import Sale, SaleItem

    daily_sales = Sale.objects.filter(
        session__station=journal.station,
        sold_at__date=journal.journal_date,
        status="completed",
    )

    # Mapping item_type → catégorie récap
    TYPE_TO_CATEGORY: dict[str, str] = {
        "lubricant_boutique": "lubs_boutique",
        "lubricant_piste":    "lubs_piste",
        "gas":                "gaz",
        "product":            "boutique",
    }

    # Mapping service.code → catégorie récap
    SERVICE_CODE_TO_CATEGORY: dict[str, str] = {
        "graissage": "graissage",
        "vidange":   "vidange",
        "lavage":    "lavage",
        "autre":     "autres",
    }

    totals: dict[str, dict] = {}

    # Articles non-service : agrégation directe par item_type
    for item_type, category in TYPE_TO_CATEGORY.items():
        result = (
            SaleItem.objects.filter(sale__in=daily_sales, item_type=item_type)
            .aggregate(total_qty=Sum("quantity"), total_amount=Sum("subtotal_xof"))
        )
        if result["total_amount"]:
            totals[category] = {
                "qty":    result["total_qty"] or Decimal("0"),
                "amount": result["total_amount"] or Decimal("0"),
            }

    # Services : agrégation par sous-catégorie (service.code)
    for code, category in SERVICE_CODE_TO_CATEGORY.items():
        result = (
            SaleItem.objects.filter(
                sale__in=daily_sales,
                item_type="service",
                service__code=code,
            )
            .aggregate(total_qty=Sum("quantity"), total_amount=Sum("subtotal_xof"))
        )
        if result["total_amount"]:
            totals[category] = {
                "qty":    result["total_qty"] or Decimal("0"),
                "amount": result["total_amount"] or Decimal("0"),
            }

    # Services sans sous-catégorie renseignée → "Autres / Divers"
    unlinked = (
        SaleItem.objects.filter(
            sale__in=daily_sales,
            item_type="service",
            service__isnull=True,
        )
        .aggregate(total_qty=Sum("quantity"), total_amount=Sum("subtotal_xof"))
    )
    if unlinked["total_amount"]:
        existing = totals.get("autres", {"qty": Decimal("0"), "amount": Decimal("0")})
        totals["autres"] = {
            "qty":    existing["qty"] + (unlinked["total_qty"] or Decimal("0")),
            "amount": existing["amount"] + (unlinked["total_amount"] or Decimal("0")),
        }

    # Mise à jour des lignes récap
    for category, data in totals.items():
        recap = JournalSalesRecap.objects.filter(
            journal=journal, category=category
        ).first()
        if recap:
            recap.qty = data["qty"]
            recap.daily_value_xof = data["amount"]
            recap.monthly_cumul_xof = recap.previous_day_cumul_xof + data["amount"]
            recap.save(update_fields=["qty", "daily_value_xof", "monthly_cumul_xof"])


@transaction.atomic
def sync_journal_nozzles(journal: StationJournal) -> list[JournalFuelLine]:
    """
    Ajoute les lignes manquantes pour les pistolets actifs créés après l'ouverture du journal.
    Ne touche pas aux lignes existantes.
    """
    if journal.status != "draft":
        raise JournalServiceError(
            f"Le journal {journal.journal_number} ne peut pas être synchronisé "
            f"(statut actuel : {journal.status})."
        )

    existing_nozzle_ids = set(journal.fuel_lines.values_list("nozzle_id", flat=True))
    nozzles = Nozzle.objects.filter(
        station=journal.station, is_active=True
    ).select_related("tank__fuel_type").order_by("display_order")

    prev_journal = _get_previous_journal(journal.station_id, journal.journal_date)
    new_lines: list[JournalFuelLine] = []

    for nozzle in nozzles:
        if nozzle.id in existing_nozzle_ids:
            continue
        prev_line = _get_previous_fuel_line(prev_journal, nozzle.id)
        index_open = (
            prev_line.index_close
            if prev_line and prev_line.index_close is not None
            else Decimal("0")
        )
        gauged_stock_open = (
            prev_line.gauged_stock_close
            if prev_line and prev_line.gauged_stock_close is not None
            else Decimal("0")
        )
        line = JournalFuelLine.objects.create(
            journal=journal,
            nozzle=nozzle,
            index_open=index_open,
            gauged_stock_open=gauged_stock_open,
        )
        new_lines.append(line)

    return new_lines


def delete_journal(journal: StationJournal) -> None:
    """Suppression logique d'un journal brouillon. Réservé aux super_admin."""
    if journal.status != "draft":
        raise JournalServiceError(
            f"Seuls les journaux en brouillon peuvent être supprimés "
            f"(statut actuel : {journal.status})."
        )
    journal.is_active = False
    journal.save(update_fields=["is_active", "updated_at"])


@transaction.atomic
def reopen_journal(journal: StationJournal, reopened_by) -> StationJournal:
    """
    Réactive un journal clôturé ou validé pour permettre des corrections.
    Réservé aux super_admin. Efface la validation et repasse en brouillon.
    """
    if journal.status == "draft":
        raise JournalServiceError(
            f"Le journal {journal.journal_number} est déjà en brouillon."
        )

    journal.status = "draft"
    journal.closed_at = None
    journal.validated_at = None
    journal.validated_by = None
    journal.pdf_hash = ""
    journal.pdf_url = ""
    journal.save(
        update_fields=[
            "status", "closed_at", "validated_at", "validated_by",
            "pdf_hash", "pdf_url", "updated_at",
        ]
    )
    return journal


@transaction.atomic
def validate_journal(journal: StationJournal, validated_by) -> StationJournal:
    """
    Valide définitivement le journal clôturé.
    Calcule l'empreinte numérique du contenu pour garantir l'intégrité.
    """
    if journal.status != "closed":
        raise JournalServiceError(
            f"Le journal {journal.journal_number} doit être clôturé avant d'être validé "
            f"(statut actuel : {journal.status})."
        )

    pdf_hash = _compute_journal_hash(journal)

    journal.status = "validated"
    journal.validated_at = timezone.now()
    journal.validated_by = validated_by
    journal.pdf_hash = pdf_hash
    journal.save(
        update_fields=["status", "validated_at", "validated_by", "pdf_hash", "updated_at"]
    )
    return journal


def _compute_journal_hash(journal: StationJournal) -> str:
    """Calcule un SHA-256 du contenu du journal pour garantir l'intégrité."""
    data = {
        "journal_number": journal.journal_number,
        "station": journal.station.code,
        "date": str(journal.journal_date),
        "fuel_lines": [
            {
                "nozzle": line.nozzle.label,
                "index_open": str(line.index_open),
                "index_close": str(line.index_close),
                "return_volume": str(line.return_volume),
                "received_volume": str(line.received_volume),
                "gauged_stock_open": str(line.gauged_stock_open),
                "gauged_stock_close": str(line.gauged_stock_close),
            }
            for line in journal.fuel_lines.select_related("nozzle").order_by("nozzle__display_order")
        ],
        "lubricant_lines": [
            {
                "lubricant": str(line.lubricant),
                "stock_open": str(line.stock_open),
                "purchased_qty": str(line.purchased_qty),
                "sold_qty": str(line.sold_qty),
                "gauged_qty": str(line.gauged_qty),
            }
            for line in journal.lubricant_lines.select_related(
                "lubricant__brand"
            ).order_by("lubricant__brand__name", "lubricant__name")
        ],
        "sales_recaps": [
            {
                "category": recap.category,
                "qty": str(recap.qty),
                "daily_value_xof": str(recap.daily_value_xof),
            }
            for recap in journal.sales_recaps.order_by("category")
        ],
        "payment_summary": {
            "cash": str(journal.payment_summary.cash_amount_xof),
            "tickets": str(journal.payment_summary.tickets_amount_xof),
            "tpe": str(journal.payment_summary.tpe_amount_xof),
            "mobile_money": str(journal.payment_summary.mobile_money_amount_xof),
            "credit": str(journal.payment_summary.credit_amount_xof),
        }
        if hasattr(journal, "payment_summary")
        else {},
    }
    payload = json.dumps(data, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(payload.encode()).hexdigest()
