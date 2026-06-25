from django.db import models
from apps.core.models import BaseModel


class Charge(BaseModel):
    """
    Dépense / charge de la station.
    Saisie par le gérant, validée ou rejetée par le super admin.
    """

    CATEGORY_CHOICES = [
        ("operational", "Dépense opérationnelle"),
        ("petite_caisse", "Petite caisse"),
        ("salary", "Salaires"),
        ("other", "Autre"),
    ]

    STATUS_CHOICES = [
        ("pending", "En attente"),
        ("validated", "Validée"),
        ("rejected", "Rejetée"),
    ]

    PAYMENT_METHOD_CHOICES = [
        ("cash", "Espèces"),
        ("bank_transfer", "Virement bancaire"),
        ("mobile_money", "Mobile Money"),
        ("check", "Chèque"),
    ]

    station = models.ForeignKey(
        "stations.Station", on_delete=models.PROTECT, related_name="charges"
    )
    journal = models.ForeignKey(
        "journal.StationJournal",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="charges",
    )
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES)
    label = models.CharField(max_length=200, verbose_name="Libellé")
    amount_xof = models.DecimalField(max_digits=14, decimal_places=2, verbose_name="Montant (FCFA)")
    charge_date = models.DateField(verbose_name="Date de la dépense")
    payment_method = models.CharField(max_length=20, choices=PAYMENT_METHOD_CHOICES, default="cash")
    reference = models.CharField(max_length=100, blank=True, verbose_name="Référence / Reçu")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")
    notes = models.TextField(blank=True, verbose_name="Notes")
    validated_by = models.ForeignKey(
        "accounts.User",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="validated_charges",
    )
    validated_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(blank=True)

    class Meta:
        verbose_name = "Charge"
        verbose_name_plural = "Charges"
        ordering = ["-charge_date", "-created_at"]

    def __str__(self) -> str:
        return f"{self.get_category_display()} — {self.label} ({self.amount_xof} FCFA)"
