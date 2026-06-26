"""
Migration en 2 étapes :
1. Données : assigner les FuelType sans station à la station de leurs cuves.
   Si aucune cuve ne les référence, les supprimer.
2. Schéma : rendre station non-nullable.
"""
import django.db.models.deletion
from django.db import migrations, models


def fix_fueltype_null_stations(apps, schema_editor):
    FuelType = apps.get_model("fuel", "FuelType")
    Tank = apps.get_model("fuel", "Tank")

    for ft in FuelType.objects.filter(station__isnull=True):
        tanks = list(Tank.objects.filter(fuel_type=ft, is_active=True).select_related("station"))

        if not tanks:
            # Aucune cuve ne l'utilise → donnée morte
            ft.delete()
            continue

        # Regrouper les cuves par station
        by_station: dict = {}
        for tank in tanks:
            sid = str(tank.station_id)
            if sid not in by_station:
                by_station[sid] = (tank.station, [])
            by_station[sid][1].append(tank)

        first = True
        for _sid, (station, station_tanks) in by_station.items():
            if first:
                # Rattacher le FuelType existant à la première station
                ft.station = station
                ft.save()
                first = False
            else:
                # Créer un FuelType dédié pour chaque station supplémentaire
                new_ft = FuelType.objects.create(
                    station=station,
                    code=ft.code,
                    name=ft.name,
                    unit_price=ft.unit_price,
                )
                for tank in station_tanks:
                    tank.fuel_type = new_ft
                    tank.save()


class Migration(migrations.Migration):

    dependencies = [
        ("fuel", "0004_migrate_fueltype_to_station"),
        ("stations", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(fix_fueltype_null_stations, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="fueltype",
            name="station",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="fuel_types",
                to="stations.station",
            ),
        ),
    ]
