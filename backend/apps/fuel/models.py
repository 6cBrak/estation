from django.db import models
from apps.core.models import BaseModel


class FuelType(models.Model):
    station = models.ForeignKey(
        "stations.Station", on_delete=models.CASCADE,
        related_name="fuel_types"
    )
    code = models.CharField(max_length=20)
    name = models.CharField(max_length=50)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    class Meta:
        verbose_name = "Type de carburant"
        verbose_name_plural = "Types de carburant"
        ordering = ["name"]
        unique_together = [("station", "code")]

    def __str__(self) -> str:
        return self.name


class Tank(BaseModel):
    station = models.ForeignKey("stations.Station", on_delete=models.CASCADE, related_name="tanks")
    fuel_type = models.ForeignKey(FuelType, on_delete=models.PROTECT, related_name="tanks")
    label = models.CharField(max_length=50)
    capacity_liters = models.DecimalField(max_digits=10, decimal_places=2)
    current_level_liters = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    low_threshold_liters = models.DecimalField(max_digits=10, decimal_places=2, default=500)

    class Meta:
        verbose_name = "Cuve"
        verbose_name_plural = "Cuves"
        ordering = ["station", "label"]

    def __str__(self) -> str:
        return f"{self.label} ({self.station.code})"

    @property
    def is_low(self) -> bool:
        return self.current_level_liters <= self.low_threshold_liters


class Nozzle(BaseModel):
    """
    Pistolet : unité de distribution directement liée à une cuve.
    Une même cuve peut alimenter plusieurs pistolets (index indépendants).
    """

    station = models.ForeignKey("stations.Station", on_delete=models.CASCADE, related_name="nozzles")
    tank = models.ForeignKey(Tank, on_delete=models.PROTECT, related_name="nozzles")
    label = models.CharField(max_length=50)
    display_order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        verbose_name = "Pistolet"
        verbose_name_plural = "Pistolets"
        ordering = ["station", "display_order"]

    def __str__(self) -> str:
        return f"{self.label} ({self.station.code})"


class TankReading(BaseModel):
    READING_TYPE_CHOICES = [
        ("morning", "Matin"),
        ("evening", "Soir"),
        ("delivery", "Livraison"),
        ("adjustment", "Ajustement"),
    ]

    tank = models.ForeignKey(Tank, on_delete=models.CASCADE, related_name="readings")
    level_liters = models.DecimalField(max_digits=10, decimal_places=2)
    reading_type = models.CharField(max_length=20, choices=READING_TYPE_CHOICES)
    recorded_at = models.DateTimeField(auto_now_add=True)
    recorded_by = models.ForeignKey(
        "accounts.User", null=True, on_delete=models.SET_NULL, related_name="tank_readings"
    )
    notes = models.TextField(blank=True)

    class Meta:
        verbose_name = "Jaugeage"
        verbose_name_plural = "Jaugeages"
        ordering = ["-recorded_at"]

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        self.tank.current_level_liters = self.level_liters
        self.tank.save(update_fields=["current_level_liters", "updated_at"])


class PumpReading(BaseModel):
    """
    Relevé d'index de compteur pour un pistolet sur une journée.
    Les ventes carburant sont calculées depuis ces index, pas depuis des transactions individuelles.
    volume_vendu = index_fermeture - index_ouverture - retours
    montant_vente = volume_vendu × prix_unitaire_carburant
    """

    nozzle = models.ForeignKey(Nozzle, on_delete=models.PROTECT, related_name="readings")
    journal_date = models.DateField()
    index_open = models.DecimalField(max_digits=12, decimal_places=2)
    index_close = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    return_volume = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    notes = models.TextField(blank=True)

    class Meta:
        verbose_name = "Relevé index pistolet"
        verbose_name_plural = "Relevés index pistolets"
        unique_together = [("nozzle", "journal_date")]
        ordering = ["-journal_date", "nozzle__display_order"]

    def __str__(self) -> str:
        return f"{self.nozzle.label} — {self.journal_date}"

    @property
    def output_volume(self):
        """Sortie du PV = index_fermeture − index_ouverture."""
        if self.index_close is not None and self.index_close >= self.index_open:
            return self.index_close - self.index_open
        return None

    @property
    def volume_sold(self):
        """Vente du jour = sortie − retours."""
        if self.output_volume is not None:
            return self.output_volume - self.return_volume
        return None

    @property
    def amount_xof(self):
        """Montant FCFA = volume_vendu × prix unitaire du carburant."""
        if self.volume_sold is not None:
            return self.volume_sold * self.nozzle.tank.fuel_type.unit_price
        return None
