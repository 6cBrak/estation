import uuid
from django.db import models
from apps.core.models import BaseModel


class CashSession(BaseModel):
    """
    Session de caisse d'un caissier pour un shift donné.
    Une seule session 'open' par caissier à la fois (contrainte BDD).
    """

    STATUS_CHOICES = [
        ("open", "Ouverte"),
        ("closed", "Fermée"),
        ("validated", "Validée"),
    ]

    station = models.ForeignKey(
        "stations.Station", on_delete=models.PROTECT, related_name="cash_sessions"
    )
    cashier = models.ForeignKey(
        "accounts.User", on_delete=models.PROTECT, related_name="cash_sessions"
    )
    opened_at = models.DateTimeField(auto_now_add=True)
    closed_at = models.DateTimeField(null=True, blank=True)
    opening_amount_xof = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    counted_cash_xof = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="open")
    notes = models.TextField(blank=True)

    class Meta:
        verbose_name = "Session de caisse"
        verbose_name_plural = "Sessions de caisse"
        ordering = ["-opened_at"]
        constraints = [
            # Un seul caissier ne peut avoir qu'une session ouverte à la fois
            models.UniqueConstraint(
                fields=["cashier"],
                condition=models.Q(status="open"),
                name="unique_open_session_per_cashier",
            )
        ]

    def __str__(self) -> str:
        return f"Session {self.cashier.get_full_name()} — {self.opened_at.date()}"

    @property
    def total_sales_xof(self):
        return self.sales.filter(status="completed").aggregate(
            total=models.Sum("total_xof")
        )["total"] or 0

    @property
    def cash_expected_xof(self):
        """Espèces attendues = fonds de caisse + total paiements cash."""
        cash_in = self.sales.filter(status="completed").aggregate(
            total=models.Sum("payments__amount_xof", filter=models.Q(payments__method="cash"))
        )["total"] or 0
        return self.opening_amount_xof + cash_in

    @property
    def variance_xof(self):
        if self.counted_cash_xof is not None:
            return self.counted_cash_xof - self.cash_expected_xof
        return None


class Sale(BaseModel):
    """
    Vente individuelle enregistrée en caisse.
    Concerne : lubrifiants (boutique et piste), services, gaz, boutique générale.
    Le carburant n'est PAS vendu ici — il est calculé depuis les relevés d'index (PumpReading).
    """

    ITEM_TYPE_CHOICES = [
        ("lubricant_boutique", "Lubrifiant boutique"),
        ("lubricant_piste", "Lubrifiant piste"),
        ("service", "Service"),
        ("gas", "Gaz"),
        ("product", "Produit boutique"),
    ]

    STATUS_CHOICES = [
        ("completed", "Complétée"),
        ("cancelled", "Annulée"),
    ]

    session = models.ForeignKey(CashSession, on_delete=models.PROTECT, related_name="sales")
    sale_number = models.CharField(max_length=30, unique=True, editable=False)
    total_xof = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="completed")
    cancel_reason = models.TextField(blank=True)
    sold_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Vente"
        verbose_name_plural = "Ventes"
        ordering = ["-sold_at"]

    def save(self, *args, **kwargs):
        if not self.sale_number:
            self.sale_number = f"VTE-{uuid.uuid4().hex[:8].upper()}"
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"{self.sale_number} — {self.total_xof} FCFA"


class SaleItem(models.Model):
    """Ligne d'une vente. item_type détermine quelle FK optionnelle est renseignée."""

    sale = models.ForeignKey(Sale, on_delete=models.CASCADE, related_name="items")
    item_type = models.CharField(max_length=25, choices=Sale.ITEM_TYPE_CHOICES)
    label = models.CharField(max_length=150)
    quantity = models.DecimalField(max_digits=10, decimal_places=3)
    unit_price_xof = models.DecimalField(max_digits=10, decimal_places=2)
    subtotal_xof = models.DecimalField(max_digits=12, decimal_places=2)
    lubricant_stock = models.ForeignKey(
        "lubricants.LubricantStock", null=True, blank=True,
        on_delete=models.SET_NULL, related_name="sale_items"
    )
    gas_stock = models.ForeignKey(
        "gas.GasBottleStock", null=True, blank=True,
        on_delete=models.SET_NULL, related_name="sale_items"
    )
    service = models.ForeignKey(
        "services.ServiceCatalogItem", null=True, blank=True,
        on_delete=models.SET_NULL, related_name="sale_items"
    )

    class Meta:
        verbose_name = "Ligne de vente"
        verbose_name_plural = "Lignes de vente"

    def __str__(self) -> str:
        return f"{self.label} x{self.quantity}"


class Payment(BaseModel):
    """Règlement associé à une vente. Une vente peut avoir plusieurs modes de paiement."""

    METHOD_CHOICES = [
        ("cash", "Espèces"),
        ("mobile_money", "Mobile Money"),
        ("card_tpe", "Carte TPE"),
        ("ticket", "Ticket / Bon carburant"),
        ("credit", "Crédit client"),
    ]

    sale = models.ForeignKey(Sale, on_delete=models.CASCADE, related_name="payments")
    method = models.CharField(max_length=20, choices=METHOD_CHOICES)
    amount_xof = models.DecimalField(max_digits=12, decimal_places=2)
    reference = models.CharField(max_length=100, blank=True)

    class Meta:
        verbose_name = "Règlement"
        verbose_name_plural = "Règlements"

    def __str__(self) -> str:
        return f"{self.get_method_display()} — {self.amount_xof} FCFA"
