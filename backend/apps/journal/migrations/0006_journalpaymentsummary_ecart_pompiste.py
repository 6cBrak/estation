from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("journal", "0005_add_avoir_withdrawal"),
    ]

    operations = [
        migrations.AddField(
            model_name="journalpaymentsummary",
            name="ecart_pompiste_xof",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=14),
        ),
    ]
