from django.utils import timezone
from rest_framework import serializers
from .models import Child, GrowthRecord, RiskAssessment
from .services.risk_engine import calculate_haz, calculate_whz, questionnaire_recommendations

# WHO Anthro / SMART survey's own "implausible value" flags — Z-scores this
# far out are essentially never real measurements, they're data-entry errors
# (wrong unit, misplaced decimal, etc.). Rejecting them here catches mistakes
# at input time instead of silently classifying garbage as "normal" (normal
# range checks in risk_engine only look at the low tail for stunting/wasting,
# not implausible values on the high tail).
_HAZ_PLAUSIBLE_RANGE = (-6, 6)
_WHZ_PLAUSIBLE_RANGE = (-5, 5)


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
    recommendations = serializers.SerializerMethodField()

    class Meta:
        model = GrowthRecord
        fields = [
            'id', 'child_id', 'measured_at', 'weight_kg', 'height_cm', 'age_months',
            'officer_name', 'location', 'notes',
            'clean_water_access', 'recurrent_illness', 'immunization_complete', 'recommendations',
            'height_for_age_z', 'weight_for_height_z', 'risk_status', 'created_at',
        ]
        read_only_fields = [
            'id', 'height_for_age_z', 'weight_for_height_z', 'risk_status', 'created_at', 'recommendations',
        ]

    def get_recommendations(self, obj):
        return questionnaire_recommendations(obj.child, obj)

    def validate(self, attrs):
        measured_at = attrs.get('measured_at', getattr(self.instance, 'measured_at', None))
        child = attrs.get('child', getattr(self.instance, 'child', None))
        height_cm = attrs.get('height_cm', getattr(self.instance, 'height_cm', None))
        weight_kg = attrs.get('weight_kg', getattr(self.instance, 'weight_kg', None))
        age_months = attrs.get('age_months', getattr(self.instance, 'age_months', None))

        if measured_at and measured_at > timezone.localdate():
            raise serializers.ValidationError(
                {'measured_at': 'Tanggal pengukuran tidak boleh di masa depan.'}
            )
        if measured_at and child and measured_at < child.birth_date:
            raise serializers.ValidationError(
                {'measured_at': 'Tanggal pengukuran tidak boleh sebelum tanggal lahir anak.'}
            )

        if child and height_cm is not None and age_months is not None:
            haz = calculate_haz(float(height_cm), age_months, child.sex)
            if not (_HAZ_PLAUSIBLE_RANGE[0] <= haz <= _HAZ_PLAUSIBLE_RANGE[1]):
                raise serializers.ValidationError({
                    'height_cm': (
                        f'Tinggi {height_cm}cm pada usia {age_months} bulan menghasilkan Z-score '
                        f'tidak wajar (HAZ={haz:.1f}). Periksa kembali tinggi dan usia yang diisi.'
                    )
                })
            if weight_kg is not None:
                whz = calculate_whz(float(weight_kg), float(height_cm), age_months, child.sex)
                if not (_WHZ_PLAUSIBLE_RANGE[0] <= whz <= _WHZ_PLAUSIBLE_RANGE[1]):
                    raise serializers.ValidationError({
                        'weight_kg': (
                            f'Berat {weight_kg}kg pada tinggi {height_cm}cm menghasilkan Z-score '
                            f'tidak wajar (WHZ={whz:.1f}). Periksa kembali berat dan tinggi yang diisi.'
                        )
                    })

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
