from django.db import models
from apps.core.models import BaseModel


class ServiceCatalogItem(BaseModel):
    """Service proposé par une station : graissage, vidange, lavage, autre."""

    CODE_CHOICES = [
        ("graissage", "Graissage"),
        ("vidange", "Vidange"),
        ("lavage", "Lavage"),
        ("autre", "Autre"),
    ]

    station = models.ForeignKey(
        "stations.Station", on_delete=models.CASCADE, related_name="services"
    )
    code = models.CharField(max_length=20, choices=CODE_CHOICES)
    name = models.CharField(max_length=100)
    default_price_xof = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    class Meta:
        verbose_name = "Service"
        verbose_name_plural = "Services"
        unique_together = [("station", "code")]
        ordering = ["station", "code"]

    def __str__(self) -> str:
        return f"{self.name} — {self.station.code}"
