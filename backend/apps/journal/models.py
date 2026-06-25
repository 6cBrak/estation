import uuid
from decimal import Decimal
from django.db import models
from django.db.models import Q
from apps.core.models import BaseModel


class StationJournal(BaseModel):
    """
    Journal quotidien d'une station. Un seul journal par station par jour.
    Reprend automatiquement les valeurs du journal de la veille à l'ouverture.
    """

    STATUS_CHOICES = [
        ("draft", "En cours"),
        ("closed", "Clôturé"),
        ("validated", "Validé"),
    ]

    station = models.ForeignKey(
        "stations.Station", on_delete=models.PROTECT, related_name="journals"
    )
    journal_number = models.CharField(max_length=30, unique=True, editable=False)
    journal_date = models.DateField()
    manager = models.ForeignKey(
        "accounts.User", on_delete=models.PROTECT, related_name="journals"
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="draft")
    opened_at = models.DateTimeField(auto_now_add=True)
    closed_at = models.DateTimeField(null=True, blank=True)
    validated_at = models.DateTimeField(null=True, blank=True)
    validated_by = models.ForeignKey(
        "accounts.User",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="validated_journals",
    )
    pdf_url = models.CharField(max_length=500, blank=True)
    pdf_hash = models.CharField(max_length=64, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        verbose_name = "Journal de station"
        verbose_name_plural = "Journaux de station"
        ordering = ["-journal_date"]
        constraints = [
            models.UniqueConstraint(
                fields=["station", "journal_date"],
                condition=Q(is_active=True),
                name="unique_active_journal_per_station_date",
            )
        ]

    def __str__(self) -> str:
        return f"{self.journal_number} — {self.station.code} {self.journal_date}"

    def save(self, *args, **kwargs) -> None:
        if not self.journal_number:
            self.journal_number = self._generate_number()
        super().save(*args, **kwargs)

    def _generate_number(self) -> str:
        last = (
            StationJournal.objects.filter(station=self.station)
            .order_by("-journal_number")
            .values_list("journal_number", flat=True)
            .first()
        )
        if last:
            try:
                seq = int(last.split("-")[-1]) + 1
            except (ValueError, IndexError):
                seq = 1
        else:
            seq = 1
        return f"{self.station.code}-{self.journal_date.strftime('%Y%m')}-{seq:04d}"

    @property
    def is_editable(self) -> bool:
        return self.status == "draft"


class JournalFuelLine(models.Model):
    """
    Une ligne par pistolet dans le journal.
    Les ventes sont calculées depuis les index de compteur, pas depuis les transactions.
    Si deux pistolets partagent la même cuve, le stock jaugé de clôture du premier
    est automatiquement reporté en stock d'ouverture du suivant.
    """

    journal = models.ForeignKey(
        StationJournal, on_delete=models.CASCADE, related_name="fuel_lines"
    )
    nozzle = models.ForeignKey(
        "fuel.Nozzle", on_delete=models.PROTECT, related_name="journal_lines"
    )
    # Index compteur
    index_open = models.DecimalField(max_digits=12, decimal_places=2)
    index_close = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    return_volume = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    # Approvisionnement
    received_volume = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    # Jaugeage cuve
    gauged_stock_open = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    gauged_stock_close = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True
    )
    diff_comment = models.TextField(blank=True)

    class Meta:
        verbose_name = "Ligne carburant"
        verbose_name_plural = "Lignes carburant"
        unique_together = [("journal", "nozzle")]
        ordering = ["nozzle__display_order"]

    def __str__(self) -> str:
        return f"{self.journal} — {self.nozzle.label}"

    @property
    def output_volume(self):
        """Sortie du PV = index_close − index_open."""
        if self.index_close is not None:
            return max(self.index_close - self.index_open, Decimal("0"))
        return None

    @property
    def sold_volume(self):
        """Vente du jour = sortie − retours."""
        if self.output_volume is not None:
            return max(self.output_volume - self.return_volume, Decimal("0"))
        return None

    @property
    def theoretical_stock(self):
        """Stock théorique = stock précédent + appro − ventes."""
        if self.sold_volume is not None:
            return self.gauged_stock_open + self.received_volume - self.sold_volume
        return None

    @property
    def gauge_diff(self):
        """Écart = stock réel − stock théorique."""
        if self.gauged_stock_close is not None and self.theoretical_stock is not None:
            return self.gauged_stock_close - self.theoretical_stock
        return None

    @property
    def amount_xof(self):
        """Montant FCFA = volume vendu × prix unitaire carburant."""
        if self.sold_volume is not None:
            return self.sold_volume * self.nozzle.tank.fuel_type.unit_price
        return None


class JournalLubricantLine(models.Model):
    """Une ligne par produit lubrifiant suivi dans le journal."""

    journal = models.ForeignKey(
        StationJournal, on_delete=models.CASCADE, related_name="lubricant_lines"
    )
    lubricant = models.ForeignKey(
        "lubricants.LubricantProduct",
        on_delete=models.PROTECT,
        related_name="journal_lines",
    )
    stock_open = models.DecimalField(max_digits=10, decimal_places=3, default=0)
    purchased_qty = models.DecimalField(max_digits=10, decimal_places=3, default=0)
    sold_qty = models.DecimalField(max_digits=10, decimal_places=3, default=0)
    gauged_qty = models.DecimalField(
        max_digits=10, decimal_places=3, null=True, blank=True
    )

    class Meta:
        verbose_name = "Ligne lubrifiant"
        verbose_name_plural = "Lignes lubrifiants"
        unique_together = [("journal", "lubricant")]
        ordering = ["lubricant__brand__name", "lubricant__name"]

    def __str__(self) -> str:
        return f"{self.journal} — {self.lubricant}"

    @property
    def stock_cumul(self):
        return self.stock_open + self.purchased_qty

    @property
    def stock_close_theoretical(self):
        return self.stock_cumul - self.sold_qty

    @property
    def diff(self):
        if self.gauged_qty is not None:
            return self.gauged_qty - self.stock_close_theoretical
        return None


class JournalSalesRecap(models.Model):
    """
    Récapitulatif des ventes du jour par catégorie (section 3 du journal papier).
    Inclut le report de la veille et le cumul mensuel.
    """

    CATEGORY_CHOICES = [
        ("super", "Super"),
        ("petrole", "Pétrole"),
        ("gasoil", "Gas-Oil"),
        ("lubs_boutique", "Lubrifiants Boutique"),
        ("lubs_piste", "Lubrifiants Piste"),
        ("graissage", "Graissage"),
        ("vidange", "Vidange"),
        ("lavage", "Lavage"),
        ("autres", "Autres / Divers"),
        ("boutique", "Boutique"),
        ("gaz", "Gaz"),
    ]

    journal = models.ForeignKey(
        StationJournal, on_delete=models.CASCADE, related_name="sales_recaps"
    )
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES)
    qty = models.DecimalField(max_digits=12, decimal_places=3, default=0)
    unit_price_xof = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    daily_value_xof = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    previous_day_cumul_xof = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    monthly_cumul_xof = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    previous_month_total_xof = models.DecimalField(max_digits=14, decimal_places=2, default=0)

    class Meta:
        verbose_name = "Récap ventes"
        verbose_name_plural = "Récaps ventes"
        unique_together = [("journal", "category")]
        ordering = ["journal", "category"]

    def __str__(self) -> str:
        return f"{self.journal} — {self.get_category_display()}"


class JournalPaymentSummary(models.Model):
    """Récapitulatif des encaissements du jour (bas du journal papier)."""

    journal = models.OneToOneField(
        StationJournal, on_delete=models.CASCADE, related_name="payment_summary"
    )
    cash_amount_xof = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    tickets_amount_xof = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    tpe_amount_xof = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    mobile_money_amount_xof = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    credit_amount_xof = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    # Retrait de l'avoir numérique (TPE + Tickets)
    avoir_fuel_xof = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    avoir_cash_xof = models.DecimalField(max_digits=14, decimal_places=2, default=0)

    class Meta:
        verbose_name = "Récap encaissements"
        verbose_name_plural = "Récaps encaissements"

    def __str__(self) -> str:
        return f"Encaissements — {self.journal}"

    @property
    def total_xof(self):
        return (
            self.cash_amount_xof
            + self.tickets_amount_xof
            + self.tpe_amount_xof
            + self.mobile_money_amount_xof
            + self.credit_amount_xof
        )

    @property
    def avoir_total_xof(self):
        """Total numérique disponible = TPE + Tickets."""
        return self.tpe_amount_xof + self.tickets_amount_xof

    @property
    def avoir_solde_xof(self):
        """Solde avoir = Total numérique - retraits."""
        return self.avoir_total_xof - self.avoir_fuel_xof - self.avoir_cash_xof


class AvoirWithdrawal(BaseModel):
    """Retrait de l'avoir numérique (TPE + Tickets) — en carburant ou en liquidités."""

    TYPE_CHOICES = [
        ("fuel", "Carburant"),
        ("cash", "Liquidités"),
    ]

    station = models.ForeignKey(
        "stations.Station", on_delete=models.CASCADE, related_name="avoir_withdrawals"
    )
    withdrawal_date = models.DateField()
    withdrawal_type = models.CharField(max_length=10, choices=TYPE_CHOICES)
    amount_xof = models.DecimalField(max_digits=14, decimal_places=2)
    notes = models.TextField(blank=True)

    class Meta:
        verbose_name = "Retrait avoir"
        verbose_name_plural = "Retraits avoir"
        ordering = ["-withdrawal_date", "-created_at"]

    def __str__(self) -> str:
        return f"{self.get_withdrawal_type_display()} — {self.amount_xof} FCFA ({self.withdrawal_date})"


class JournalExpense(models.Model):
    """Dépense enregistrée dans le journal de la journée."""

    CATEGORY_CHOICES = [
        ("salaire", "Salaires"),
        ("entretien", "Entretien"),
        ("fourniture", "Fournitures"),
        ("autre", "Autre"),
    ]

    journal = models.ForeignKey(
        StationJournal, on_delete=models.CASCADE, related_name="expenses"
    )
    label = models.CharField(max_length=150)
    amount_xof = models.DecimalField(max_digits=12, decimal_places=2)
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default="autre")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Dépense"
        verbose_name_plural = "Dépenses"
        ordering = ["created_at"]

    def __str__(self) -> str:
        return f"{self.label} — {self.amount_xof} FCFA"
