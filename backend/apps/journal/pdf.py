from __future__ import annotations

import os
from decimal import Decimal
from io import BytesIO

from django.template.loader import render_to_string

from .models import StationJournal


def generate_journal_pdf(journal: StationJournal) -> bytes:
    """
    Génère le PDF du journal en utilisant WeasyPrint.
    Retourne le contenu PDF en bytes.
    """
    from weasyprint import HTML

    context = _build_context(journal)
    html_content = render_to_string("journal/journal_pdf.html", context)
    pdf_bytes = HTML(string=html_content, base_url=None).write_pdf()
    return pdf_bytes


def _build_context(journal: StationJournal) -> dict:
    recaps = list(journal.sales_recaps.all())
    total_daily = sum(r.daily_value_xof for r in recaps) or Decimal("0")
    total_prev_day = sum(r.previous_day_cumul_xof for r in recaps) or Decimal("0")
    total_monthly = sum(r.monthly_cumul_xof for r in recaps) or Decimal("0")
    total_prev_month = sum(r.previous_month_total_xof for r in recaps) or Decimal("0")

    return {
        "journal": journal,
        "total_daily": total_daily,
        "total_prev_day": total_prev_day,
        "total_monthly": total_monthly,
        "total_prev_month": total_prev_month,
    }


def save_journal_pdf(journal: StationJournal, media_root: str) -> str:
    """
    Génère et sauvegarde le PDF dans MEDIA_ROOT/journals/.
    Retourne le chemin relatif (pour stocker dans journal.pdf_url).
    """
    pdf_bytes = generate_journal_pdf(journal)

    folder = os.path.join(media_root, "journals")
    os.makedirs(folder, exist_ok=True)

    filename = f"{journal.journal_number}.pdf"
    filepath = os.path.join(folder, filename)
    with open(filepath, "wb") as f:
        f.write(pdf_bytes)

    return f"journals/{filename}"
