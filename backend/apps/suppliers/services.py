from __future__ import annotations

from django.db import transaction
from django.utils import timezone

from .models import Delivery, PurchaseOrder


class SupplierServiceError(Exception):
    pass


@transaction.atomic
def confirm_delivery(delivery: Delivery, confirmed_by) -> Delivery:
    """
    Confirme une livraison et met à jour les stocks correspondants.
    - Carburant : met à jour Tank.current_level_liters
    - Lubrifiant : met à jour LubricantStock.quantity
    - Boutique : met à jour ProductStock.quantity
    - Gaz : met à jour GasBottleStock.quantity
    Passe le statut de la commande associée en 'received' si toutes les lignes sont livrées.
    """
    if delivery.status != "pending":
        raise SupplierServiceError(
            f"La livraison {delivery.delivery_number} est déjà confirmée ou annulée."
        )

    for item in delivery.items.select_related(
        "fuel_type", "lubricant", "product", "gas_format"
    ):
        if item.item_type == "fuel" and item.fuel_type:
            _update_fuel_stock(delivery, item)
        elif item.item_type == "lubricant" and item.lubricant:
            _update_lubricant_stock(delivery, item)
        elif item.item_type == "shop" and item.product:
            _update_product_stock(delivery, item)
        elif item.item_type == "gas" and item.gas_format:
            _update_gas_stock(delivery, item)

    delivery.status = "confirmed"
    delivery.confirmed_at = timezone.now()
    delivery.confirmed_by = confirmed_by
    delivery.save(update_fields=["status", "confirmed_at", "confirmed_by", "updated_at"])

    # Mettre à jour le statut du BC associé
    if delivery.purchase_order:
        _update_order_status(delivery.purchase_order)

    return delivery


def _update_fuel_stock(delivery: Delivery, item) -> None:
    from apps.fuel.models import Tank
    tanks = Tank.objects.filter(
        station=delivery.station,
        fuel_type=item.fuel_type,
        is_active=True,
    )
    if not tanks.exists():
        return
    tank = tanks.first()
    tank.current_level_liters += item.received_quantity
    tank.save(update_fields=["current_level_liters", "updated_at"])


def _update_lubricant_stock(delivery: Delivery, item) -> None:
    from apps.lubricants.models import LubricantStock
    stock, _ = LubricantStock.objects.get_or_create(
        product=item.lubricant,
        station=delivery.station,
        defaults={"quantity": 0},
    )
    stock.quantity += item.received_quantity
    stock.save(update_fields=["quantity", "updated_at"])


def _update_product_stock(delivery: Delivery, item) -> None:
    from apps.shop.models import ProductStock
    stock, _ = ProductStock.objects.get_or_create(
        product=item.product,
        station=delivery.station,
        defaults={"quantity": 0},
    )
    stock.quantity += item.received_quantity
    stock.save(update_fields=["quantity", "updated_at"])


def _update_gas_stock(delivery: Delivery, item) -> None:
    from apps.gas.models import GasBottleStock
    stock, _ = GasBottleStock.objects.get_or_create(
        format=item.gas_format,
        station=delivery.station,
        defaults={"quantity": 0},
    )
    stock.quantity += int(item.received_quantity)
    stock.save(update_fields=["quantity", "updated_at"])


def _update_order_status(order: PurchaseOrder) -> None:
    if order.status in ("cancelled", "received"):
        return
    confirmed_deliveries = order.deliveries.filter(status="confirmed")
    if confirmed_deliveries.exists():
        # Vérifie si toutes les lignes sont couvertes
        ordered_items = set(order.items.values_list("id", flat=True))
        delivered_items = set(
            confirmed_deliveries.values_list("items__order_item_id", flat=True)
        )
        if ordered_items and ordered_items.issubset(delivered_items):
            order.status = "received"
        else:
            order.status = "partial"
        order.save(update_fields=["status", "updated_at"])
