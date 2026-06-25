import pytest
from apps.fuel.models import FuelType, Tank, Nozzle


@pytest.mark.django_db
class TestFuelTypeAPI:
    def test_list_unauthenticated(self, api_client):
        res = api_client.get("/api/v1/fuel/types/")
        assert res.status_code == 401

    def test_list_authenticated(self, auth_client):
        FuelType.objects.create(code="SP", name="Super", unit_price="650")
        res = auth_client.get("/api/v1/fuel/types/")
        assert res.status_code == 200

    def test_create_fuel_type(self, auth_client):
        res = auth_client.post("/api/v1/fuel/types/", {
            "code": "GO",
            "name": "Gasoil",
            "unit_price": "595",
        })
        assert res.status_code == 201
        assert res.data["code"] == "GO"
        assert FuelType.objects.filter(code="GO").exists()

    def test_update_fuel_type(self, auth_client):
        ft = FuelType.objects.create(code="SP", name="Super", unit_price="650")
        res = auth_client.patch(f"/api/v1/fuel/types/{ft.id}/", {"unit_price": "680"})
        assert res.status_code == 200
        ft.refresh_from_db()
        assert ft.unit_price == 680


@pytest.mark.django_db
class TestTankAPI:
    def test_list_tanks_filtered_by_station(self, manager_client, station):
        res = manager_client.get("/api/v1/fuel/tanks/")
        assert res.status_code == 200

    def test_create_tank(self, auth_client, station):
        ft = FuelType.objects.create(code="SP", name="Super", unit_price="650")
        res = auth_client.post("/api/v1/fuel/tanks/", {
            "station": str(station.id),
            "fuel_type": str(ft.id),
            "label": "Cuve SP 1",
            "capacity_liters": "30000",
            "current_level_liters": "15000",
            "low_threshold_liters": "5000",
        })
        assert res.status_code == 201
        assert res.data["label"] == "Cuve SP 1"

    def test_deactivate_tank(self, auth_client, station):
        ft = FuelType.objects.create(code="SP", name="Super", unit_price="650")
        tank = Tank.objects.create(
            station=station, fuel_type=ft, label="Cuve 1",
            capacity_liters=30000, low_threshold_liters=5000,
        )
        res = auth_client.patch(f"/api/v1/fuel/tanks/{tank.id}/", {"is_active": False})
        assert res.status_code == 200
        tank.refresh_from_db()
        assert not tank.is_active


@pytest.mark.django_db
class TestNozzleAPI:
    def test_create_nozzle(self, auth_client, station):
        ft = FuelType.objects.create(code="SP", name="Super", unit_price="650")
        tank = Tank.objects.create(
            station=station, fuel_type=ft, label="Cuve 1",
            capacity_liters=30000, low_threshold_liters=5000,
        )
        res = auth_client.post("/api/v1/fuel/nozzles/", {
            "station": str(station.id),
            "tank": str(tank.id),
            "label": "Pistolet 1",
            "display_order": 1,
        })
        assert res.status_code == 201
        assert res.data["label"] == "Pistolet 1"

    def test_two_nozzles_same_tank(self, auth_client, station):
        """Deux pistolets peuvent partager la même cuve."""
        ft = FuelType.objects.create(code="SP", name="Super", unit_price="650")
        tank = Tank.objects.create(
            station=station, fuel_type=ft, label="Cuve SP",
            capacity_liters=30000, low_threshold_liters=5000,
        )
        n1 = Nozzle.objects.create(station=station, tank=tank, label="SP 1", display_order=1)
        n2 = Nozzle.objects.create(station=station, tank=tank, label="SP 2", display_order=2)
        assert n1.tank_id == n2.tank_id
        assert Nozzle.objects.filter(tank=tank).count() == 2
