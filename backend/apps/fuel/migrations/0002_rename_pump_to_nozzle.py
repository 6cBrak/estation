from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("fuel", "0001_initial"),
    ]

    operations = [
        migrations.RenameModel(
            old_name="Pump",
            new_name="Nozzle",
        ),
        migrations.RenameField(
            model_name="pumpreading",
            old_name="pump",
            new_name="nozzle",
        ),
        migrations.AlterModelOptions(
            name="nozzle",
            options={
                "ordering": ["station", "display_order"],
                "verbose_name": "Pistolet",
                "verbose_name_plural": "Pistolets",
            },
        ),
        migrations.AlterModelOptions(
            name="pumpreading",
            options={
                "ordering": ["-journal_date", "nozzle__display_order"],
                "verbose_name": "Relevé index pistolet",
                "verbose_name_plural": "Relevés index pistolets",
            },
        ),
    ]
