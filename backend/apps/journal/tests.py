import pytest
from datetime import date
from decimal import Decimal
from apps.journal.models import StationJournal, JournalFuelLine
from apps.fuel.models import FuelType, Tank, Nozzle


@pytest.fixture
def fuel_setup(db, station):
    fuel_type = FuelType.objects.create(code="SP95", name="Sans Plomb 95", unit_price="650.00")
    tank = Tank.objects.create(
        station=station, fuel_type=fuel_type, label="Cuve SP95",
        capacity_liters="20000", current_level_liters="10000",
    )
    nozzle = Nozzle.objects.create(station=station, tank=tank, label="SP 1", display_order=1)
    return {"fuel_type": fuel_type, "tank": tank, "nozzle": nozzle}


@pytest.fixture
def fuel_setup_shared_tank(db, station):
    """Deux pistolets partageant la même cuve."""
    fuel_type = FuelType.objects.create(code="SP95", name="Sans Plomb 95", unit_price="650.00")
    tank = Tank.objects.create(
        station=station, fuel_type=fuel_type, label="Cuve SP95",
        capacity_liters="20000", current_level_liters="10000",
    )
    nozzle1 = Nozzle.objects.create(station=station, tank=tank, label="SP 1", display_order=1)
    nozzle2 = Nozzle.objects.create(station=station, tank=tank, label="SP 2", display_order=2)
    return {"fuel_type": fuel_type, "tank": tank, "nozzle1": nozzle1, "nozzle2": nozzle2}


@pytest.fixture
def journal(db, station, manager_user, fuel_setup):
    j = StationJournal.objects.create(
        station=station,
        journal_date=date(2026, 5, 10),
        manager=manager_user,
        status="draft",
    )
    JournalFuelLine.objects.create(
        journal=j,
        nozzle=fuel_setup["nozzle"],
        index_open=Decimal("0.00"),
        gauged_stock_open=Decimal("10000.00"),
    )
    return j


@pytest.mark.django_db
class TestJournalOpenClose:
    def test_open_journal(self, manager_client, station):
        res = manager_client.post("/api/v1/journal/journals/", {
            "journal_date": "2026-05-11",
        }, format="json")
        assert res.status_code == 201
        assert res.data["status"] == "draft"
        assert StationJournal.objects.filter(journal_date="2026-05-11").exists()

    def test_list_journals(self, manager_client, journal):
        res = manager_client.get("/api/v1/journal/journals/")
        assert res.status_code == 200
        assert res.data["count"] >= 1

    def test_get_journal_detail(self, manager_client, journal):
        res = manager_client.get(f"/api/v1/journal/journals/{journal.id}/")
        assert res.status_code == 200
        assert res.data["status"] == "draft"
        assert len(res.data["fuel_lines"]) == 1

    def test_fuel_line_uses_nozzle_label(self, manager_client, journal):
        res = manager_client.get(f"/api/v1/journal/journals/{journal.id}/")
        assert res.status_code == 200
        line = res.data["fuel_lines"][0]
        assert "nozzle_label" in line
        assert line["nozzle_label"] == "SP 1"

    def test_close_journal_requires_index_close(self, manager_client, journal):
        """Clôture impossible si index_close manquant."""
        res = manager_client.post(f"/api/v1/journal/journals/{journal.id}/close/", {}, format="json")
        assert res.status_code == 400

    def test_close_journal(self, manager_client, journal):
        line = journal.fuel_lines.first()
        line.index_close = Decimal("250.00")
        line.gauged_stock_close = Decimal("9800.00")
        line.save()
        res = manager_client.post(f"/api/v1/journal/journals/{journal.id}/close/", {}, format="json")
        assert res.status_code == 200
        journal.refresh_from_db()
        assert journal.status == "closed"


@pytest.mark.django_db
class TestJournalReopen:
    def test_reopen_validated_journal(self, auth_client, journal):
        """Super admin peut réactiver un journal validé → redevient draft."""
        journal.status = "validated"
        journal.validated_at = "2026-05-10T12:00:00Z"
        journal.save()
        res = auth_client.post(f"/api/v1/journal/journals/{journal.id}/reopen/")
        assert res.status_code == 200
        journal.refresh_from_db()
        assert journal.status == "draft"


@pytest.mark.django_db
class TestSharedTankCascade:
    """Vérifie la cascade de stock entre pistolets partageant la même cuve."""

    def test_cascade_on_patch(self, manager_client, station, manager_user, fuel_setup_shared_tank):
        """Saisir gauged_stock_close sur SP1 → gauged_stock_open de SP2 mis à jour."""
        j = StationJournal.objects.create(
            station=station,
            journal_date=date(2026, 6, 1),
            manager=manager_user,
            status="draft",
        )
        line1 = JournalFuelLine.objects.create(
            journal=j, nozzle=fuel_setup_shared_tank["nozzle1"],
            index_open=Decimal("0.00"), gauged_stock_open=Decimal("10000.00"),
        )
        line2 = JournalFuelLine.objects.create(
            journal=j, nozzle=fuel_setup_shared_tank["nozzle2"],
            index_open=Decimal("0.00"), gauged_stock_open=Decimal("10000.00"),
        )

        res = manager_client.patch(
            f"/api/v1/journal/fuel-lines/{line1.id}/",
            {"gauged_stock_close": "9500.00"},
            format="json",
        )
        assert res.status_code == 200

        line2.refresh_from_db()
        assert line2.gauged_stock_open == Decimal("9500.00")

    def test_no_cascade_different_tanks(self, manager_client, station, manager_user, db):
        """Deux pistolets sur des cuves différentes : pas de cascade."""
        ft = FuelType.objects.create(code="GO", name="Gasoil", unit_price="595.00")
        tank_a = Tank.objects.create(
            station=station, fuel_type=ft, label="Cuve A",
            capacity_liters="20000", current_level_liters="10000",
        )
        tank_b = Tank.objects.create(
            station=station, fuel_type=ft, label="Cuve B",
            capacity_liters="20000", current_level_liters="8000",
        )
        nozzle_a = Nozzle.objects.create(station=station, tank=tank_a, label="GO 1", display_order=1)
        nozzle_b = Nozzle.objects.create(station=station, tank=tank_b, label="GO 2", display_order=2)

        j = StationJournal.objects.create(
            station=station,
            journal_date=date(2026, 6, 2),
            manager=manager_user,
            status="draft",
        )
        line_a = JournalFuelLine.objects.create(
            journal=j, nozzle=nozzle_a,
            index_open=Decimal("0.00"), gauged_stock_open=Decimal("10000.00"),
        )
        line_b = JournalFuelLine.objects.create(
            journal=j, nozzle=nozzle_b,
            index_open=Decimal("0.00"), gauged_stock_open=Decimal("8000.00"),
        )

        manager_client.patch(
            f"/api/v1/journal/fuel-lines/{line_a.id}/",
            {"gauged_stock_close": "9200.00"},
            format="json",
        )

        line_b.refresh_from_db()
        # gauged_stock_open de line_b doit rester inchangé
        assert line_b.gauged_stock_open == Decimal("8000.00")
