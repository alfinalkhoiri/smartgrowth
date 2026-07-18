from django.utils import timezone
from rest_framework import serializers
from apps.accounts.models import Role
from .models import Child, GrowthRecord, PosyanduSchedule, RiskAssessment
from .services.risk_engine import (
    calculate_haz,
    calculate_hcz,
    calculate_waz,
    calculate_whz,
    classify_weight_trend,
    has_2t_alert,
    questionnaire_recommendations,
)

# WHO Anthro / SMART survey's own "implausible value" flags — Z-scores this
# far out are essentially never real measurements, they're data-entry errors
# (wrong unit, misplaced decimal, etc.). Rejecting them here catches mistakes
# at input time instead of silently classifying garbage as "normal" (normal
# range checks in risk_engine only look at the low tail for stunting/wasting,
# not implausible values on the high tail).
_HAZ_PLAUSIBLE_RANGE = (-6, 6)
_WHZ_PLAUSIBLE_RANGE = (-5, 5)
_WAZ_PLAUSIBLE_RANGE = (-6, 5)
_HCZ_PLAUSIBLE_RANGE = (-5, 5)


def _growth_alert_for(child) -> str | None:
    """
    '2T' (see risk_engine.has_2t_alert) if this child's weight failed to
    increase at each of their last two measurements — Indonesia's standard
    posyandu referral trigger, independent of the Z-score status. None if
    there's no alert or fewer than 3 measurements (need 3 points to have two
    consecutive trend comparisons). Shared by ChildSerializer and the public
    (no-login) dashboard serializer so the two never disagree.
    """
    records = list(child.growth_records.order_by('measured_at'))
    if len(records) < 3:
        return None
    trends = [
        classify_weight_trend(records[i - 1].weight_kg, records[i].weight_kg)
        for i in range(1, len(records))
    ]
    return '2T' if has_2t_alert(trends) else None


def _visible_to_kader_nakes_or_linked_parent(obj, context, value):
    """
    Shared gate for link_code/public_token: only kader_nakes/admin (who hand
    these out) or a parent already linked to this specific child (so they
    can pass it on to a second parent) ever see them — knowing either one
    is enough to reach this child's growth data, so anyone else gets None.
    """
    request = context.get('request')
    user = getattr(request, 'user', None)
    if user is None or not user.is_authenticated:
        return None
    if user.is_superuser or getattr(user, 'role', None) == Role.KADER_NAKES:
        return value
    if obj.pk and obj.parents.filter(pk=user.pk).exists():
        return value
    return None


class ChildSerializer(serializers.ModelSerializer):
    growth_alert = serializers.SerializerMethodField()
    link_code = serializers.SerializerMethodField()
    public_token = serializers.SerializerMethodField()

    class Meta:
        model = Child
        fields = [
            'id', 'name', 'birth_date', 'sex',
            'parent_name', 'parent_occupation', 'posyandu_location',
            'exclusive_breastfeeding', 'birth_weight_kg', 'birth_length_cm', 'gestational_age_weeks',
            'growth_alert', 'link_code', 'public_token', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'growth_alert', 'link_code', 'public_token']

    def get_link_code(self, obj):
        return _visible_to_kader_nakes_or_linked_parent(obj, self.context, obj.link_code)

    def get_public_token(self, obj):
        return _visible_to_kader_nakes_or_linked_parent(obj, self.context, obj.public_token)

    def get_growth_alert(self, obj):
        return _growth_alert_for(obj)

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
    weight_trend = serializers.SerializerMethodField()

    class Meta:
        model = GrowthRecord
        fields = [
            'id', 'child_id', 'measured_at', 'weight_kg', 'height_cm', 'head_circumference_cm', 'age_months',
            'photo', 'officer_name', 'location', 'notes',
            'clean_water_access', 'recurrent_illness', 'immunization_complete', 'recommendations',
            'height_for_age_z', 'weight_for_height_z', 'weight_for_age_z', 'head_circumference_z',
            'risk_status', 'weight_trend', 'created_at',
        ]
        read_only_fields = [
            'id', 'height_for_age_z', 'weight_for_height_z', 'weight_for_age_z', 'head_circumference_z',
            'risk_status', 'created_at', 'recommendations', 'weight_trend',
        ]

    def get_recommendations(self, obj):
        return questionnaire_recommendations(obj.child, obj)

    def get_weight_trend(self, obj):
        """
        'naik' / 'tetap_turun' vs. the immediately preceding measurement for
        this child, or None if this is their first measurement (nothing to
        compare against yet). See risk_engine.classify_weight_trend().
        """
        previous = (
            GrowthRecord.objects
            .filter(child_id=obj.child_id, measured_at__lt=obj.measured_at)
            .order_by('-measured_at')
            .first()
        )
        if previous is None:
            return None
        return classify_weight_trend(previous.weight_kg, obj.weight_kg)

    def validate(self, attrs):
        measured_at = attrs.get('measured_at', getattr(self.instance, 'measured_at', None))
        child = attrs.get('child', getattr(self.instance, 'child', None))
        height_cm = attrs.get('height_cm', getattr(self.instance, 'height_cm', None))
        weight_kg = attrs.get('weight_kg', getattr(self.instance, 'weight_kg', None))
        age_months = attrs.get('age_months', getattr(self.instance, 'age_months', None))
        head_circumference_cm = attrs.get(
            'head_circumference_cm', getattr(self.instance, 'head_circumference_cm', None)
        )

        if measured_at and measured_at > timezone.localdate():
            raise serializers.ValidationError(
                {'measured_at': 'Tanggal pengukuran tidak boleh di masa depan.'}
            )
        if measured_at and child and measured_at < child.birth_date:
            raise serializers.ValidationError(
                {'measured_at': 'Tanggal pengukuran tidak boleh sebelum tanggal lahir anak.'}
            )

        # Only re-check plausibility when the measurement itself is actually
        # changing (a create, or an update that touches height/weight/age).
        # Otherwise an update that only saves notes/questionnaire answers on
        # an *already-existing* record would keep re-validating that record's
        # untouched (and possibly already-bad) height/weight and get blocked
        # forever — that's an existing-data cleanup problem, not something an
        # unrelated field save should be stuck on.
        measurement_unchanged = self.instance is not None and (
            attrs.get('height_cm', self.instance.height_cm) == self.instance.height_cm
            and attrs.get('weight_kg', self.instance.weight_kg) == self.instance.weight_kg
            and attrs.get('age_months', self.instance.age_months) == self.instance.age_months
            and attrs.get('head_circumference_cm', self.instance.head_circumference_cm)
            == self.instance.head_circumference_cm
        )

        if child and height_cm is not None and age_months is not None and not measurement_unchanged:
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
                waz = calculate_waz(float(weight_kg), age_months, child.sex)
                if not (_WAZ_PLAUSIBLE_RANGE[0] <= waz <= _WAZ_PLAUSIBLE_RANGE[1]):
                    raise serializers.ValidationError({
                        'weight_kg': (
                            f'Berat {weight_kg}kg pada usia {age_months} bulan menghasilkan Z-score '
                            f'tidak wajar (WAZ={waz:.1f}). Periksa kembali berat dan usia yang diisi.'
                        )
                    })
            if head_circumference_cm is not None:
                hcz = calculate_hcz(float(head_circumference_cm), age_months, child.sex)
                if not (_HCZ_PLAUSIBLE_RANGE[0] <= hcz <= _HCZ_PLAUSIBLE_RANGE[1]):
                    raise serializers.ValidationError({
                        'head_circumference_cm': (
                            f'Lingkar kepala {head_circumference_cm}cm pada usia {age_months} bulan menghasilkan '
                            f'Z-score tidak wajar (HCZ={hcz:.1f}). Periksa kembali lingkar kepala dan usia yang diisi.'
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
        fields = ['id', 'child_id', 'risk_status', 'score', 'reason_codes', 'recommendations', 'assessed_at']
        read_only_fields = fields


class LinkChildSerializer(serializers.Serializer):
    """POST /api/children/link/ — a parent redeems a kader-issued code to see their child's data."""
    code = serializers.CharField(max_length=6, min_length=6)

    def validate_code(self, value):
        try:
            self.child = Child.objects.get(link_code=value)
        except Child.DoesNotExist:
            raise serializers.ValidationError('Kode tidak ditemukan. Periksa kembali kode dari kader/nakes.')
        return value


class PublicGrowthRecordSerializer(serializers.ModelSerializer):
    """
    Read-only slice of GrowthRecord for the no-login parent dashboard —
    deliberately excludes officer_name/location/photo/raw questionnaire
    answers (staff-facing detail a parent doesn't need). `recommendations`
    and `notes` ARE included: the parent dashboard's "Rekomendasi" tab is
    meant to show exactly these (see PublicChildView.tsx / ChildDashboard.tsx
    on the frontend, which render the identical tab from this same data).
    """
    weight_trend = serializers.SerializerMethodField()
    recommendations = serializers.SerializerMethodField()

    class Meta:
        model = GrowthRecord
        fields = [
            'measured_at', 'weight_kg', 'height_cm', 'head_circumference_cm', 'age_months',
            'height_for_age_z', 'weight_for_height_z', 'weight_for_age_z', 'head_circumference_z',
            'risk_status', 'weight_trend', 'recommendations', 'notes',
        ]
        read_only_fields = fields

    def get_recommendations(self, obj):
        return questionnaire_recommendations(obj.child, obj)

    def get_weight_trend(self, obj):
        previous = (
            GrowthRecord.objects
            .filter(child_id=obj.child_id, measured_at__lt=obj.measured_at)
            .order_by('-measured_at')
            .first()
        )
        if previous is None:
            return None
        return classify_weight_trend(previous.weight_kg, obj.weight_kg)


class PublicChildDashboardSerializer(serializers.ModelSerializer):
    """
    GET /api/public/children/<token>/ payload — see PublicChildDashboardView.
    Intentionally minimal: no parent_name/parent_occupation/posyandu_location/
    link_code/public_token/id, just enough for "hasil pengukuran terakhir,
    riwayat pengukuran" (Fase 2 requirement). measured_at is a plain field
    here (not read via update-permission checks) so history renders oldest
    to newest for the chart, same ordering GrowthChart already expects.
    """
    growth_alert = serializers.SerializerMethodField()
    records = serializers.SerializerMethodField()

    class Meta:
        model = Child
        fields = ['name', 'birth_date', 'sex', 'growth_alert', 'records']
        read_only_fields = fields

    def get_growth_alert(self, obj):
        return _growth_alert_for(obj)

    def get_records(self, obj):
        records = obj.growth_records.order_by('measured_at')
        return PublicGrowthRecordSerializer(records, many=True).data


class PosyanduScheduleSerializer(serializers.ModelSerializer):
    class Meta:
        model = PosyanduSchedule
        fields = ['id', 'scheduled_at', 'location', 'notes', 'created_at']
        read_only_fields = ['id', 'created_at']

    def create(self, validated_data):
        validated_data['created_by'] = self.context['request'].user
        return super().create(validated_data)
