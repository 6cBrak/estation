from django.db import models
from apps.core.models import BaseModel


class Supplier(BaseModel):
    """Fournisseur (carburant, lubrifiants, boutique, gaz)."""

    CATEGORY_CHOICES = [
        ("fuel", "Carburant"),
        ("lubricant", "Lubrifiant"),
        ("shop", "Boutique"),
        ("gas", "Gaz"),
        ("other", "Autre"),
    ]

    code = models.CharField(max_length=30, unique=True)
    name = models.CharField(max_length=150)
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default="other")
    contact_name = models.CharField(max_length=150, blank=True)
    phone = models.CharField(max_length=20, blank=True)
    email = models.EmailField(blank=True)
    address = models.TextField(blank=True)

    class Meta:
        verbose_name = "Fournisseur"
        verbose_name_plural = "Fournisseurs"
        ordering = ["name"]

    def __str__(self) -> str:
        return f"{self.code} — {self.name}"


class PurchaseOrder(BaseModel):
    """Bon de commande envoyé à un fournisseur."""

    STATUS_CHOICES = [
        ("draft", "Brouillon"),
        ("sent", "Envoyé"),
        ("partial", "Partiellement reçu"),
        ("received", "Reçu"),
        ("cancelled", "Annulé"),
    ]

    station = models.ForeignKey(
        "stations.Station", on_delete=models.PROTECT, related_name="purchase_orders"
    )
    supplier = models.ForeignKey(
        Supplier, on_delete=models.PROTECT, related_name="purchase_orders"
    )
    order_number = models.CharField(max_length=40, unique=True, editable=False)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="draft")
    ordered_at = models.DateField()
    expected_delivery_date = models.DateField(null=True, blank=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        verbose_name = "Bon de commande"
        verbose_name_plural = "Bons de commande"
        ordering = ["-ordered_at"]

    def __str__(self) -> str:
        return f"{self.order_number} — {self.supplier.name}"

    def save(self, *args, **kwargs) -> None:
        if not self.order_number:
            self.order_number = self._generate_number()
        super().save(*args, **kwargs)

    def _generate_number(self) -> str:
        from django.utils import timezone
        today = timezone.localdate()
        last = (
            PurchaseOrder.objects.filter(station=self.station)
            .order_by("-order_number")
            .values_list("order_number", flat=True)
            .first()
        )
        if last:
            try:
                seq = int(last.split("-")[-1]) + 1
            except (ValueError, IndexError):
                seq = 1
        else:
            seq = 1
        return f"BC-{self.station.code}-{today.strftime('%Y%m')}-{seq:04d}"

    @property
    def total_xof(self):
        return sum(item.subtotal_xof for item in self.items.all())


class PurchaseOrderItem(models.Model):
    """Ligne d'un bon de commande."""

    ITEM_TYPE_CHOICES = [
        ("fuel", "Carburant"),
        ("lubricant", "Lubrifiant"),
        ("shop", "Boutique"),
        ("gas", "Gaz"),
        ("other", "Autre"),
    ]

    order = models.ForeignKey(PurchaseOrder, on_delete=models.CASCADE, related_name="items")
    item_type = models.CharField(max_length=20, choices=ITEM_TYPE_CHOICES)
    description = models.CharField(max_length=200)
    quantity = models.DecimalField(max_digits=12, decimal_places=3)
    unit = models.CharField(max_length=20, default="unité")
    unit_price_xof = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    # Références optionnelles vers les catalogues
    fuel_type = models.ForeignKey(
        "fuel.FuelType", null=True, blank=True, on_delete=models.SET_NULL
    )
    lubricant = models.ForeignKey(
        "lubricants.LubricantProduct", null=True, blank=True, on_delete=models.SET_NULL
    )
    product = models.ForeignKey(
        "shop.Product", null=True, blank=True, on_delete=models.SET_NULL
    )
    gas_format = models.ForeignKey(
        "gas.GasBottleFormat", null=True, blank=True, on_delete=models.SET_NULL
    )

    class Meta:
        verbose_name = "Ligne BC"
        verbose_name_plural = "Lignes BC"

    def __str__(self) -> str:
        return f"{self.order.order_number} — {self.description}"

    @property
    def subtotal_xof(self):
        return self.quantity * self.unit_price_xof


class Delivery(BaseModel):
    """Réception d'une commande fournisseur (peut couvrir un ou plusieurs BC)."""

    STATUS_CHOICES = [
        ("pending", "En attente"),
        ("confirmed", "Confirmée"),
        ("cancelled", "Annulée"),
    ]

    station = models.ForeignKey(
        "stations.Station", on_delete=models.PROTECT, related_name="deliveries"
    )
    purchase_order = models.ForeignKey(
        PurchaseOrder,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="deliveries",
    )
    supplier = models.ForeignKey(
        Supplier, on_delete=models.PROTECT, related_name="deliveries"
    )
    delivery_number = models.CharField(max_length=40, unique=True, editable=False)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")
    delivered_at = models.DateField()
    confirmed_at = models.DateTimeField(null=True, blank=True)
    confirmed_by = models.ForeignKey(
        "accounts.User",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="confirmed_deliveries",
    )
    # Jaugeage carburant avant/après livraison (si applicable)
    tank_level_before = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True,
        help_text="Niveau cuve avant livraison (litres)"
    )
    tank_level_after = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True,
        help_text="Niveau cuve après livraison (litres)"
    )
    notes = models.TextField(blank=True)

    class Meta:
        verbose_name = "Livraison"
        verbose_name_plural = "Livraisons"
        ordering = ["-delivered_at"]

    def __str__(self) -> str:
        return f"{self.delivery_number} — {self.supplier.name} {self.delivered_at}"

    def save(self, *args, **kwargs) -> None:
        if not self.delivery_number:
            self.delivery_number = self._generate_number()
        super().save(*args, **kwargs)

    def _generate_number(self) -> str:
        from django.utils import timezone
        today = timezone.localdate()
        last = (
            Delivery.objects.filter(station=self.station)
            .order_by("-delivery_number")
            .values_list("delivery_number", flat=True)
            .first()
        )
        if last:
            try:
                seq = int(last.split("-")[-1]) + 1
            except (ValueError, IndexError):
                seq = 1
        else:
            seq = 1
        return f"LIV-{self.station.code}-{today.strftime('%Y%m')}-{seq:04d}"


class DeliveryItem(models.Model):
    """Ligne de livraison avec la quantité réellement reçue vs commandée."""

    delivery = models.ForeignKey(Delivery, on_delete=models.CASCADE, related_name="items")
    order_item = models.ForeignKey(
        PurchaseOrderItem,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="delivery_items",
    )
    item_type = models.CharField(max_length=20, choices=PurchaseOrderItem.ITEM_TYPE_CHOICES)
    description = models.CharField(max_length=200)
    ordered_quantity = models.DecimalField(
        max_digits=12, decimal_places=3, default=0,
        help_text="Quantité commandée (0 si livraison sans BC)"
    )
    received_quantity = models.DecimalField(max_digits=12, decimal_places=3)
    unit_price_xof = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    # Références optionnelles vers les catalogues
    fuel_type = models.ForeignKey(
        "fuel.FuelType", null=True, blank=True, on_delete=models.SET_NULL
    )
    lubricant = models.ForeignKey(
        "lubricants.LubricantProduct", null=True, blank=True, on_delete=models.SET_NULL
    )
    product = models.ForeignKey(
        "shop.Product", null=True, blank=True, on_delete=models.SET_NULL
    )
    gas_format = models.ForeignKey(
        "gas.GasBottleFormat", null=True, blank=True, on_delete=models.SET_NULL
    )

    class Meta:
        verbose_name = "Ligne livraison"
        verbose_name_plural = "Lignes livraison"

    def __str__(self) -> str:
        return f"{self.delivery.delivery_number} — {self.description}"

    @property
    def variance(self):
        """Écart entre commandé et reçu."""
        return self.received_quantity - self.ordered_quantity

    @property
    def subtotal_xof(self):
        return self.received_quantity * self.unit_price_xof
