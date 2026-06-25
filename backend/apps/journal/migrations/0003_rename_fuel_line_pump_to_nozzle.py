from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("journal", "0002_alter_stationjournal_unique_together_and_more"),
        ("fuel", "0002_rename_pump_to_nozzle"),
    ]

    operations = [
        migrations.RenameField(
            model_name="journalfuelline",
            old_name="pump",
            new_name="nozzle",
        ),
        migrations.AlterModelOptions(
            name="journalfuelline",
            options={
                "ordering": ["nozzle__display_order"],
                "verbose_name": "Ligne carburant",
                "verbose_name_plural": "Lignes carburant",
            },
        ),
    ]
