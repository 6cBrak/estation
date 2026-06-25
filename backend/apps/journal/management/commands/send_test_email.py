from django.core.management.base import BaseCommand, CommandError

from apps.journal.emails import send_journal_closure_email
from apps.journal.models import StationJournal


class Command(BaseCommand):
    help = "Envoie le mail de clôture pour un journal donné (test SMTP)"

    def add_arguments(self, parser):
        group = parser.add_mutually_exclusive_group(required=True)
        group.add_argument("--journal", metavar="NUMERO", help="Numéro du journal (ex: JNL-2025-0001)")
        group.add_argument("--last", action="store_true", help="Utilise le dernier journal clôturé")

    def handle(self, *args, **options):
        if options["last"]:
            journal = (
                StationJournal.objects.filter(status__in=["closed", "validated"], is_active=True)
                .order_by("-journal_date", "-closed_at")
                .first()
            )
            if not journal:
                raise CommandError("Aucun journal clôturé trouvé.")
        else:
            numero = options["journal"]
            journal = StationJournal.objects.filter(journal_number=numero, is_active=True).first()
            if not journal:
                raise CommandError(f"Journal introuvable : {numero}")

        self.stdout.write(f"Envoi du mail pour {journal.journal_number} — {journal.station.name}...")
        send_journal_closure_email(str(journal.id))
        self.stdout.write(self.style.SUCCESS("Mail envoyé (ou affiché en console si backend=console)."))
