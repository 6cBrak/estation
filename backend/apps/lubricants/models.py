from django.db import models
from apps.core.models import BaseModel


class LubricantBrand(models.Model):
    name = models.CharField(max_length=100, unique=True)

    class Meta:
        verbose_name = "Marque lubrifiant"
        verbose_name_plural = "Marques lubrifiants"
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class LubricantProduct(BaseModel):
    brand = models.ForeignKey(LubricantBrand, on_delete=models.PROTECT, related_name="products")
    code = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=150)
    grade = models.CharField(max_length=20, blank=True)
    packaging = models.CharField(max_length=20, blank=True)
    sale_price_boutique_xof = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    sale_price_piste_xof = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    class Meta:
        verbose_name = "Produit lubrifiant"
        verbose_name_plural = "Produits lubrifiants"
        ordering = ["brand", "name"]

    def __str__(self) -> str:
        return f"{self.brand.name} {self.name} {self.grade}"


class LubricantStock(BaseModel):
    product = models.ForeignKey(LubricantProduct, on_delete=models.CASCADE, related_name="stocks")
    station = models.ForeignKey("stations.Station", on_delete=models.CASCADE, related_name="lubricant_stocks")
    quantity = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    class Meta:
        verbose_name = "Stock lubrifiant"
        verbose_name_plural = "Stocks lubrifiants"
        unique_together = [("product", "station")]

    def __str__(self) -> str:
        return f"{self.product} — {self.station.code} ({self.quantity})"
