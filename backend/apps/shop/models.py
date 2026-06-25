from django.db import models
from apps.core.models import BaseModel


class ProductCategory(models.Model):
    name = models.CharField(max_length=100, unique=True)

    class Meta:
        verbose_name = "Catégorie produit"
        verbose_name_plural = "Catégories produits"
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class Product(BaseModel):
    category = models.ForeignKey(
        ProductCategory, on_delete=models.PROTECT, related_name="products"
    )
    code = models.CharField(max_length=50, unique=True)
    barcode = models.CharField(max_length=50, blank=True, db_index=True)
    name = models.CharField(max_length=200)
    purchase_price_xof = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    sale_price_xof = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    vat_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)

    class Meta:
        verbose_name = "Produit boutique"
        verbose_name_plural = "Produits boutique"
        ordering = ["category", "name"]

    def __str__(self) -> str:
        return f"{self.name} ({self.code})"


class ProductStock(BaseModel):
    product = models.ForeignKey(
        Product, on_delete=models.CASCADE, related_name="stocks"
    )
    station = models.ForeignKey(
        "stations.Station", on_delete=models.CASCADE, related_name="product_stocks"
    )
    quantity = models.DecimalField(max_digits=10, decimal_places=3, default=0)
    low_threshold = models.DecimalField(max_digits=10, decimal_places=3, default=0)

    class Meta:
        verbose_name = "Stock produit"
        verbose_name_plural = "Stocks produits"
        unique_together = [("product", "station")]

    def __str__(self) -> str:
        return f"{self.product.name} — {self.station.code} ({self.quantity})"

    @property
    def is_low(self) -> bool:
        return self.quantity <= self.low_threshold
