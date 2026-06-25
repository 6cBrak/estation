import pytest
from apps.suppliers.models import Supplier, PurchaseOrder


@pytest.mark.django_db
class TestSupplierAPI:
    def test_list_suppliers(self, auth_client):
        res = auth_client.get("/api/v1/suppliers/suppliers/")
        assert res.status_code == 200

    def test_create_supplier(self, auth_client):
        res = auth_client.post("/api/v1/suppliers/suppliers/", {
            "code": "TOTAL-BF",
            "name": "Total Burkina",
            "category": "fuel",
            "contact_name": "Jean Dupont",
            "phone": "+226 25 00 00 00",
            "email": "contact@total.bf",
            "address": "Ouagadougou",
        })
        assert res.status_code == 201
        assert res.data["code"] == "TOTAL-BF"
        assert Supplier.objects.filter(code="TOTAL-BF").exists()

    def test_update_supplier(self, auth_client):
        supplier = Supplier.objects.create(
            code="SUP01", name="Fournisseur 1", category="fuel",
        )
        res = auth_client.patch(f"/api/v1/suppliers/suppliers/{supplier.id}/", {
            "name": "Fournisseur Modifié",
        })
        assert res.status_code == 200
        supplier.refresh_from_db()
        assert supplier.name == "Fournisseur Modifié"


@pytest.mark.django_db
class TestPurchaseOrderAPI:
    def test_list_orders(self, auth_client, station):
        res = auth_client.get("/api/v1/suppliers/purchase-orders/")
        assert res.status_code == 200

    def test_create_order(self, auth_client, station):
        supplier = Supplier.objects.create(
            code="SUP01", name="Fournisseur 1", category="fuel",
        )
        res = auth_client.post("/api/v1/suppliers/purchase-orders/", {
            "station": str(station.id),
            "supplier": str(supplier.id),
            "ordered_at": "2026-05-10",
            "notes": "",
            "items": [],
        }, format="json")
        assert res.status_code == 201
        assert res.data["status"] == "draft"

    def test_send_order(self, auth_client, station):
        supplier = Supplier.objects.create(
            code="SUP01", name="Fournisseur 1", category="fuel",
        )
        order = PurchaseOrder.objects.create(
            station=station, supplier=supplier,
            order_number="BC-ST01-202605-0001",
            status="draft", ordered_at="2026-05-10",
        )
        res = auth_client.post(f"/api/v1/suppliers/purchase-orders/{order.id}/send/")
        assert res.status_code == 200
        order.refresh_from_db()
        assert order.status == "sent"
