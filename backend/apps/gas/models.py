from django.db import models
from apps.core.models import BaseModel


class GasBottleFormat(BaseModel):
    weight_kg = models.DecimalField(max_digits=5, decimal_places=2, unique=True)
    label = models.CharField(max_length=50)
    sale_price_xof = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    deposit_xof = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    class Meta:
        verbose_name = "Format bouteille gaz"
        verbose_name_plural = "Formats bouteilles gaz"
        ordering = ["weight_kg"]

    def __str__(self) -> str:
        return f"{self.label} ({self.weight_kg} kg)"


class GasBottleStock(BaseModel):
    format = models.ForeignKey(GasBottleFormat, on_delete=models.CASCADE, related_name="stocks")
    station = models.ForeignKey("stations.Station", on_delete=models.CASCADE, related_name="gas_stocks")
    quantity = models.PositiveIntegerField(default=0)

    class Meta:
        verbose_name = "Stock gaz"
        verbose_name_plural = "Stocks gaz"
        unique_together = [("format", "station")]

    def __str__(self) -> str:
        return f"{self.format} — {self.station.code} ({self.quantity})"
