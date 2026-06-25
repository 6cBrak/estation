from django.db import migrations


def assign_fuel_types_to_stations(apps, schema_editor):
    """
    Pour chaque FuelType global (station=null), trouve les stations
    qui l'utilisent via leurs cuves et crée des copies station-spécifiques.
    """
    FuelType = apps.get_model("fuel", "FuelType")
    Tank = apps.get_model("fuel", "Tank")

    for ft in list(FuelType.objects.filter(station__isnull=True)):
        station_ids = list(
            Tank.objects.filter(fuel_type=ft)
            .values_list("station_id", flat=True)
            .distinct()
        )

        if not station_ids:
            continue  # type non utilisé, on laisse global

        first_station_id = station_ids[0]
        # Associer le type existant à la première station
        ft.station_id = first_station_id
        ft.save(update_fields=["station_id"])

        # Créer des copies pour les autres stations
        for station_id in station_ids[1:]:
            new_ft = FuelType.objects.create(
                station_id=station_id,
                code=ft.code,
                name=ft.name,
                unit_price=ft.unit_price,
            )
            Tank.objects.filter(fuel_type=ft, station_id=station_id).update(
                fuel_type=new_ft
            )


def reverse_assign(apps, schema_editor):
    FuelType = apps.get_model("fuel", "FuelType")
    FuelType.objects.exclude(station__isnull=True).update(station=None)


class Migration(migrations.Migration):
    dependencies = [
        ("fuel", "0003_fueltype_per_station"),
    ]

    operations = [
        migrations.RunPython(assign_fuel_types_to_stations, reverse_code=reverse_assign),
    ]
