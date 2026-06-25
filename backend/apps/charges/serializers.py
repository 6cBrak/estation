from django.utils import timezone
from rest_framework import serializers
from .models import Charge


class ChargeSerializer(serializers.ModelSerializer):
    category_display = serializers.CharField(source="get_category_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    payment_method_display = serializers.CharField(source="get_payment_method_display", read_only=True)
    station_name = serializers.CharField(source="station.name", read_only=True)
    created_by_name = serializers.CharField(source="created_by.get_full_name", read_only=True)
    validated_by_name = serializers.CharField(source="validated_by.get_full_name", read_only=True)
    journal_number = serializers.CharField(source="journal.journal_number", read_only=True)

    class Meta:
        model = Charge
        fields = [
            "id", "station", "station_name", "journal", "journal_number",
            "category", "category_display", "label", "amount_xof",
            "charge_date", "payment_method", "payment_method_display",
            "reference", "status", "status_display", "notes",
            "validated_by", "validated_by_name", "validated_at",
            "rejection_reason", "created_by", "created_by_name", "created_at",
        ]
        read_only_fields = [
            "id", "status", "validated_by", "validated_at",
            "rejection_reason", "created_by", "created_at",
        ]


class ChargeCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Charge
        fields = [
            "category", "label", "amount_xof",
            "charge_date", "payment_method", "reference", "journal", "notes",
        ]

    def validate_amount_xof(self, value):
        if value <= 0:
            raise serializers.ValidationError("Le montant doit être positif.")
        return value

    def validate_journal(self, journal):
        if journal:
            user = self.context["request"].user
            if user.role != "super_admin" and journal.station_id != user.station_id:
                raise serializers.ValidationError("Ce journal n'appartient pas à votre station.")
        return journal

    def create(self, validated_data):
        request = self.context["request"]
        user = request.user
        station = user.station if user.role != "super_admin" else validated_data.get("station")
        if not station and user.role == "super_admin":
            raise serializers.ValidationError("station requis pour le super admin.")
        return Charge.objects.create(
            **validated_data,
            station=station,
            created_by=user,
        )


class ChargeValidateSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=["validate", "reject"])
    rejection_reason = serializers.CharField(required=False, allow_blank=True, default="")

    def validate(self, data):
        if data["action"] == "reject" and not data.get("rejection_reason"):
            raise serializers.ValidationError(
                {"rejection_reason": "Un motif de rejet est obligatoire."}
            )
        return data

    def save(self, charge: Charge, validated_by) -> Charge:
        action = self.validated_data["action"]
        if action == "validate":
            charge.status = "validated"
            charge.rejection_reason = ""
            charge.validated_by = validated_by
            charge.validated_at = timezone.now()
        else:
            charge.status = "rejected"
            charge.rejection_reason = self.validated_data["rejection_reason"]
            charge.validated_by = validated_by
            charge.validated_at = timezone.now()
        charge.save(update_fields=["status", "rejection_reason", "validated_by", "validated_at", "updated_at"])
        return charge
