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
        # Chercher la station via une cuve qui utilise ce type
        tank = Tank.objects.filter(fuel_type=ft, is_active=True).first()
        if tank:
            ft.station = tank.station
            ft.save()
        else:
            ft.delete()


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
