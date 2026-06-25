from datetime import date

from django.core.management.base import BaseCommand, CommandError

from apps.journal.emails import send_daily_network_email


class Command(BaseCommand):
    help = "Envoie le bilan réseau quotidien (toutes stations) par e-mail"

    def add_arguments(self, parser):
        parser.add_argument(
            "--date",
            metavar="YYYY-MM-DD",
            help="Date du bilan (par défaut : aujourd'hui)",
        )

    def handle(self, *args, **options):
        target: date | None = None
        if options["date"]:
            try:
                target = date.fromisoformat(options["date"])
            except ValueError:
                raise CommandError(f"Format de date invalide : {options['date']} (attendu YYYY-MM-DD)")

        date_str = target.strftime("%d/%m/%Y") if target else "aujourd'hui"
        self.stdout.write(f"Envoi du bilan réseau pour {date_str}...")
        send_daily_network_email(target)
        self.stdout.write(self.style.SUCCESS("Bilan réseau envoyé (ou affiché en console si backend=console)."))
