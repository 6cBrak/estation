import pytest
from apps.stations.models import Station


@pytest.mark.django_db
class TestStationAPI:
    def test_list_stations_admin(self, auth_client, station):
        res = auth_client.get("/api/v1/stations/")
        assert res.status_code == 200

    def test_list_stations_unauthenticated(self, api_client):
        res = api_client.get("/api/v1/stations/")
        assert res.status_code == 401

    def test_get_station(self, auth_client, station):
        res = auth_client.get(f"/api/v1/stations/{station.id}/")
        assert res.status_code == 200
        assert res.data["code"] == "ST01"
        assert res.data["name"] == "Station Test"

    def test_update_station(self, auth_client, station):
        res = auth_client.patch(f"/api/v1/stations/{station.id}/", {
            "name": "Station Test Modifiée",
        })
        assert res.status_code == 200
        assert res.data["name"] == "Station Test Modifiée"

    def test_manager_sees_only_own_station(self, manager_client, station):
        other = Station.objects.create(
            code="ST02", name="Autre Station",
            gauge_tolerance_pct="2", cash_tolerance_xof="5000",
        )
        res = manager_client.get("/api/v1/stations/")
        assert res.status_code == 200
        codes = [s["code"] for s in res.data.get("results", res.data)]
        assert "ST01" in codes
        assert "ST02" not in codes
