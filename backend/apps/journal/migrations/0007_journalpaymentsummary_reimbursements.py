from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("journal", "0006_journalpaymentsummary_ecart_pompiste"),
    ]

    operations = [
        migrations.AddField(
            model_name="journalpaymentsummary",
            name="reimbursements_xof",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=14),
        ),
    ]
