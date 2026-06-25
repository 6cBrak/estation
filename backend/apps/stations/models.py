from django.db import models
from apps.core.models import BaseModel


class Station(BaseModel):
    code = models.CharField(max_length=20, unique=True)
    name = models.CharField(max_length=100)
    address = models.CharField(max_length=255, blank=True)
    city = models.CharField(max_length=100, blank=True)
    phone = models.CharField(max_length=20, blank=True)
    manager = models.ForeignKey(
        "accounts.User",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="managed_stations",
    )
    gauge_tolerance_pct = models.DecimalField(
        max_digits=5, decimal_places=2, default=2,
        help_text="Écart de jaugeage toléré en %"
    )
    cash_tolerance_xof = models.DecimalField(
        max_digits=10, decimal_places=2, default=500,
        help_text="Écart de caisse toléré en FCFA"
    )

    class Meta:
        verbose_name = "Station"
        verbose_name_plural = "Stations"
        ordering = ["name"]

    def __str__(self) -> str:
        return f"{self.code} — {self.name}"
