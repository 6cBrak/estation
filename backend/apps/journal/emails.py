from __future__ import annotations

import logging
from datetime import date
from decimal import Decimal

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils import timezone

from .models import JournalSalesRecap, StationJournal

logger = logging.getLogger(__name__)


def _fmt_xof(value: Decimal | int | float | None) -> str:
    if value is None:
        return "—"
    return f"{int(value):,} FCFA".replace(",", " ")


def _fuel_line_amount(line) -> Decimal:
    """Montant = (index_close - index_open - return_volume) × prix unitaire."""
    if line.index_close is None:
        return Decimal("0")
    output = max(line.index_close - line.index_open, Decimal("0"))
    sold = max(output - line.return_volume, Decimal("0"))
    return sold * line.pump.tank.fuel_type.unit_price


def _fuel_line_liters(line) -> Decimal:
    if line.index_close is None:
        return Decimal("0")
    output = max(line.index_close - line.index_open, Decimal("0"))
    return max(output - line.return_volume, Decimal("0"))


def _monthly_xof(journal: StationJournal) -> Decimal:
    first_day = journal.journal_date.replace(day=1)
    values = JournalSalesRecap.objects.filter(
        journal__station=journal.station,
        journal__journal_date__gte=first_day,
        journal__journal_date__lte=journal.journal_date,
        journal__is_active=True,
    ).values_list("daily_value_xof", flat=True)
    return sum(values, Decimal("0"))


def _evolution_pct(journal: StationJournal, monthly: Decimal) -> float | None:
    from datetime import timedelta
    first_day_current = journal.journal_date.replace(day=1)
    last_day_prev = first_day_current - timedelta(days=1)
    first_day_prev = last_day_prev.replace(day=1)
    prev_values = JournalSalesRecap.objects.filter(
        journal__station=journal.station,
        journal__journal_date__gte=first_day_prev,
        journal__journal_date__lte=last_day_prev,
        journal__is_active=True,
    ).values_list("daily_value_xof", flat=True)
    prev = sum(prev_values, Decimal("0"))
    if prev == 0:
        return None
    return float((monthly - prev) / prev * 100)


def _build_network_summary(journal: StationJournal) -> list[dict]:
    from apps.stations.models import Station
    today = journal.journal_date
    stations = Station.objects.filter(is_active=True).order_by("name")
    today_journals = {
        j.station_id: j
        for j in StationJournal.objects.filter(journal_date=today, is_active=True)
        .prefetch_related("fuel_lines__pump__tank__fuel_type")
    }
    rows = []
    for st in stations:
        j = today_journals.get(st.id)
        total_xof: Decimal | None = None
        if j:
            total_xof = sum((_fuel_line_amount(l) for l in j.fuel_lines.all()), Decimal("0"))
        rows.append({
            "name": st.name,
            "status": j.status if j else None,
            "is_current": st.id == journal.station_id,
            "total_xof": total_xof,
            "total_xof_fmt": _fmt_xof(total_xof),
        })
    return rows


def _build_alerts(journal: StationJournal, total_fuel_xof: Decimal, total_encaisse: Decimal) -> list[dict]:
    alerts: list[dict] = []
    tolerance_pct = journal.station.gauge_tolerance_pct

    for line in journal.fuel_lines.select_related("pump__tank__fuel_type"):
        if line.gauge_diff is not None and line.theoretical_stock and line.theoretical_stock > 0:
            ecart_pct = abs(line.gauge_diff / line.theoretical_stock * 100)
            if ecart_pct > tolerance_pct:
                alerts.append({
                    "label": f"Écart de jaugeage {line.pump.label} : {ecart_pct:.1f}% (tolérance {tolerance_pct}%)",
                    "severity": "critical" if ecart_pct > tolerance_pct * 2 else "warning",
                })

    variance = total_encaisse - total_fuel_xof
    tolerance = journal.station.cash_tolerance_xof
    if abs(variance) > tolerance:
        alerts.append({
            "label": f"Écart de caisse : {'+' if variance >= 0 else ''}{_fmt_xof(variance)} (tolérance {_fmt_xof(tolerance)})",
            "severity": "critical",
        })

    return alerts


def send_journal_closure_email(journal_id: str) -> None:
    """Envoie le mail de clôture au boss. Ne propage pas les exceptions."""
    recipients = getattr(settings, "REPORT_RECIPIENTS", [])
    if not recipients:
        logger.info("BOSS_EMAIL non configuré — mail de clôture ignoré.")
        return

    try:
        journal = (
            StationJournal.objects.select_related("station")
            .prefetch_related("fuel_lines__pump__tank__fuel_type", "sales_recaps", "lubricant_lines")
            .get(pk=journal_id)
        )

        payment = getattr(journal, "payment_summary", None)

        # Totaux carburant calculés depuis les champs DB bruts des fuel_lines
        fuel_lines = list(journal.fuel_lines.all())
        total_fuel_xof = sum((_fuel_line_amount(l) for l in fuel_lines), Decimal("0"))
        total_liters_dec = sum((_fuel_line_liters(l) for l in fuel_lines), Decimal("0"))
        total_liters = f"{int(total_liters_dec):,}".replace(",", " ") if total_liters_dec else None

        total_encaisse: Decimal = Decimal("0")
        cash_variance: Decimal | None = None
        cash_alert = False
        payment_rows: list[dict] = []

        if payment:
            total_encaisse = (
                payment.cash_amount_xof
                + payment.tickets_amount_xof
                + payment.tpe_amount_xof
                + payment.mobile_money_amount_xof
                + payment.credit_amount_xof
            )
            cash_variance = total_encaisse - total_fuel_xof
            cash_alert = abs(cash_variance) > journal.station.cash_tolerance_xof
            payment_rows = [
                {"label": "Espèces",        "value": _fmt_xof(payment.cash_amount_xof)},
                {"label": "Tickets",        "value": _fmt_xof(payment.tickets_amount_xof)},
                {"label": "TPE / Carte",    "value": _fmt_xof(payment.tpe_amount_xof)},
                {"label": "Mobile Money",   "value": _fmt_xof(payment.mobile_money_amount_xof)},
                {"label": "Crédit",         "value": _fmt_xof(payment.credit_amount_xof)},
                {"label": "Total encaissé", "value": _fmt_xof(total_encaisse)},
            ]

        # Détail par pompe
        pump_rows = []
        for line in fuel_lines:
            liters = _fuel_line_liters(line)
            amount = _fuel_line_amount(line)
            pump_rows.append({
                "label": line.pump.label,
                "fuel_type": line.pump.tank.fuel_type.name,
                "liters": f"{int(liters):,}".replace(",", " ") if liters else "—",
                "amount": _fmt_xof(amount),
            })

        # Niveaux des cuves
        from apps.fuel.models import Tank
        tanks = Tank.objects.filter(
            station=journal.station, is_active=True
        ).select_related("fuel_type").order_by("label")
        tank_rows = []
        for tank in tanks:
            pct = int(tank.current_level_liters / tank.capacity_liters * 100) if tank.capacity_liters else 0
            pct = min(pct, 100)
            tank_rows.append({
                "label": tank.label,
                "fuel_type": tank.fuel_type.name,
                "current": f"{int(tank.current_level_liters):,}".replace(",", " "),
                "capacity": f"{int(tank.capacity_liters):,}".replace(",", " "),
                "pct": pct,
                "is_low": tank.is_low,
            })

        monthly = _monthly_xof(journal)
        evolution = _evolution_pct(journal, monthly)
        network = _build_network_summary(journal)
        alerts = _build_alerts(journal, total_fuel_xof, total_encaisse)

        context = {
            "journal": journal,
            "total_fuel_xof": _fmt_xof(total_fuel_xof),
            "total_liters": total_liters,
            "total_encaisse": _fmt_xof(total_encaisse),
            "cash_variance": cash_variance,
            "cash_variance_fmt": _fmt_xof(cash_variance),
            "cash_alert": cash_alert,
            "monthly_xof": _fmt_xof(monthly),
            "evolution_pct": evolution,
            "payment": payment,
            "payment_rows": payment_rows,
            "pump_rows": pump_rows,
            "tank_rows": tank_rows,
            "alerts": alerts,
            "network_stations": network,
        }

        html_body = render_to_string("journal/email_journal_closed.html", context)
        date_str = journal.journal_date.strftime("%d/%m/%Y")
        subject = f"[E-Station] Clôture journal — {journal.station.name} — {date_str}"

        msg = EmailMultiAlternatives(
            subject=subject,
            body=f"Clôture du journal {journal.journal_number} — {journal.station.name} ({date_str})",
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=recipients,
        )
        msg.attach_alternative(html_body, "text/html")
        msg.send()

        logger.info("Mail de clôture envoyé pour %s à %s", journal.journal_number, ", ".join(recipients))

    except Exception:
        logger.exception("Erreur lors de l'envoi du mail de clôture (journal %s)", journal_id)


def send_daily_network_email(target_date: date | None = None) -> None:
    """Envoie le bilan quotidien réseau (toutes stations) aux destinataires configurés."""
    recipients = getattr(settings, "REPORT_RECIPIENTS", [])
    if not recipients:
        logger.info("BOSS_EMAIL non configuré — bilan réseau ignoré.")
        return

    if target_date is None:
        target_date = timezone.localdate()

    try:
        from apps.stations.models import Station
        from apps.fuel.models import Tank

        stations = Station.objects.filter(is_active=True).order_by("name")

        journals_map: dict = {
            j.station_id: j
            for j in StationJournal.objects.filter(
                journal_date=target_date, is_active=True
            ).select_related("station")
            .prefetch_related(
                "fuel_lines__pump__tank__fuel_type",
                "lubricant_lines",
                "sales_recaps",
            )
        }

        from apps.charges.models import Charge

        station_rows = []
        net_fuel_xof = Decimal("0")
        net_fuel_liters = Decimal("0")
        net_encaisse = Decimal("0")
        net_charges_xof = Decimal("0")

        for st in stations:
            j = journals_map.get(st.id)
            st_fuel_xof = Decimal("0")
            st_fuel_liters = Decimal("0")
            st_encaisse = Decimal("0")
            st_status = None
            pump_rows = []
            tank_rows = []

            if j:
                st_status = j.status
                for line in j.fuel_lines.all():
                    liters = _fuel_line_liters(line)
                    amount = _fuel_line_amount(line)
                    st_fuel_liters += liters
                    st_fuel_xof += amount
                    pump_rows.append({
                        "label": line.pump.label,
                        "fuel_type": line.pump.tank.fuel_type.name,
                        "liters": f"{int(liters):,}".replace(",", " ") if liters else "—",
                        "amount": _fmt_xof(amount),
                    })

                payment = getattr(j, "payment_summary", None)
                if payment:
                    st_encaisse = (
                        payment.cash_amount_xof
                        + payment.tickets_amount_xof
                        + payment.tpe_amount_xof
                        + payment.mobile_money_amount_xof
                        + payment.credit_amount_xof
                    )

            # Niveaux des cuves
            tanks_qs = Tank.objects.filter(
                station=st, is_active=True
            ).select_related("fuel_type").order_by("label")
            for tank in tanks_qs:
                pct = int(tank.current_level_liters / tank.capacity_liters * 100) if tank.capacity_liters else 0
                pct = min(pct, 100)
                tank_rows.append({
                    "label": tank.label,
                    "fuel_type": tank.fuel_type.name,
                    "current": f"{int(tank.current_level_liters):,}".replace(",", " "),
                    "capacity": f"{int(tank.capacity_liters):,}".replace(",", " "),
                    "pct": pct,
                    "is_low": tank.is_low,
                })

            # Dépenses du jour
            charges_list = list(
                Charge.objects.filter(
                    station=st, charge_date=target_date, is_active=True
                ).order_by("category", "created_at")
            )
            st_charges_xof = sum(
                (c.amount_xof for c in charges_list if c.status == "validated"),
                Decimal("0"),
            )
            charge_rows = [
                {
                    "label": c.label,
                    "category_display": c.get_category_display(),
                    "amount": _fmt_xof(c.amount_xof),
                    "status": c.status,
                    "status_display": c.get_status_display(),
                }
                for c in charges_list
            ]

            net_fuel_xof += st_fuel_xof
            net_fuel_liters += st_fuel_liters
            net_encaisse += st_encaisse
            net_charges_xof += st_charges_xof

            station_rows.append({
                "name": st.name,
                "code": st.code,
                "status": st_status,
                "fuel_xof": _fmt_xof(st_fuel_xof),
                "fuel_liters": f"{int(st_fuel_liters):,}".replace(",", " ") if st_fuel_liters else "—",
                "encaisse_xof": _fmt_xof(st_encaisse),
                "charges_xof": _fmt_xof(st_charges_xof),
                "pump_rows": pump_rows,
                "tank_rows": tank_rows,
                "charge_rows": charge_rows,
                "has_journal": j is not None,
                "has_charges": len(charge_rows) > 0,
            })

        context = {
            "date": target_date,
            "station_rows": station_rows,
            "net_fuel_xof": _fmt_xof(net_fuel_xof),
            "net_fuel_liters": f"{int(net_fuel_liters):,}".replace(",", " ") if net_fuel_liters else "—",
            "net_encaisse_xof": _fmt_xof(net_encaisse),
            "net_charges_xof": _fmt_xof(net_charges_xof),
            "stations_count": len(station_rows),
            "stations_with_journal": sum(1 for r in station_rows if r["has_journal"]),
        }

        html_body = render_to_string("journal/email_daily_network.html", context)
        date_str = target_date.strftime("%d/%m/%Y")
        subject = f"[E-Station] Bilan réseau du {date_str} — {len(station_rows)} station(s)"

        msg = EmailMultiAlternatives(
            subject=subject,
            body=f"Bilan réseau du {date_str} — {len(station_rows)} station(s)",
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=recipients,
        )
        msg.attach_alternative(html_body, "text/html")
        msg.send()

        logger.info("Bilan réseau du %s envoyé à %s", date_str, ", ".join(recipients))

    except Exception:
        logger.exception("Erreur lors de l'envoi du bilan réseau (%s)", target_date)
