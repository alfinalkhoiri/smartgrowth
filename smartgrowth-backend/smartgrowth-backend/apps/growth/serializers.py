from django.utils import timezone
from rest_framework import serializers
from .models import Child, GrowthRecord, RiskAssessment


class ChildSerializer(serializers.ModelSerializer):
    class Meta:
        model = Child
        fields = [
            'id', 'name', 'birth_date', 'sex',
            'exclusive_breastfeeding', 'birth_weight_kg',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate_birth_date(self, value):
        if value > timezone.localdate():
            raise serializers.ValidationError('Tanggal lahir tidak boleh di masa depan.')
        return value

    def create(self, validated_data):
        validated_data['registered_by'] = self.context['request'].user
        return super().create(validated_data)


class GrowthRecordSerializer(serializers.ModelSerializer):
    child_id = serializers.PrimaryKeyRelatedField(source='child', queryset=Child.objects.all())

    class Meta:
        model = GrowthRecord
        fields = [
            'id', 'child_id', 'measured_at', 'weight_kg', 'height_cm', 'age_months',
            'officer_name', 'location', 'notes',
            'height_for_age_z', 'weight_for_height_z', 'risk_status', 'created_at',
        ]
        read_only_fields = ['id', 'height_for_age_z', 'weight_for_height_z', 'risk_status', 'created_at']

    def validate(self, attrs):
        measured_at = attrs.get('measured_at', getattr(self.instance, 'measured_at', None))
        child = attrs.get('child', getattr(self.instance, 'child', None))

        if measured_at and measured_at > timezone.localdate():
            raise serializers.ValidationError(
                {'measured_at': 'Tanggal pengukuran tidak boleh di masa depan.'}
            )
        if measured_at and child and measured_at < child.birth_date:
            raise serializers.ValidationError(
                {'measured_at': 'Tanggal pengukuran tidak boleh sebelum tanggal lahir anak.'}
            )
        return attrs

    def create(self, validated_data):
        validated_data['recorded_by'] = self.context['request'].user
        # height_for_age_z / risk_status get filled in by the view after
        # calling the risk_engine service — kept out of the serializer so
        # the scoring logic stays in one place (services/risk_engine.py).
        return super().create(validated_data)


class RiskAssessmentSerializer(serializers.ModelSerializer):
    child_id = serializers.PrimaryKeyRelatedField(source='child', read_only=True)

    class Meta:
        model = RiskAssessment
        fields = ['id', 'child_id', 'risk_status', 'reason_codes', 'assessed_at']
        read_only_fields = fields
