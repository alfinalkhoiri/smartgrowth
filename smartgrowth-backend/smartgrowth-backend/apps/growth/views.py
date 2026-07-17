from rest_framework import viewsets, filters
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from django_filters.rest_framework import DjangoFilterBackend

from .models import Child, GrowthRecord, RiskAssessment
from .permissions import RoleBasedGrowthPermission
from .serializers import ChildSerializer, GrowthRecordSerializer, RiskAssessmentSerializer
from .services.risk_engine import (
    assess_child_risk, calculate_haz, calculate_hcz, calculate_waz, calculate_whz, score_risk,
)
from .services.who_reference import height_range_for_age, weight_range_for_height


class ChildViewSet(viewsets.ModelViewSet):
    queryset = Child.objects.all()
    serializer_class = ChildSerializer
    permission_classes = [IsAuthenticated, RoleBasedGrowthPermission]
    filter_backends = [filters.SearchFilter]
    search_fields = ['name']


class GrowthRecordViewSet(viewsets.ModelViewSet):
    queryset = GrowthRecord.objects.all()
    serializer_class = GrowthRecordSerializer
    permission_classes = [IsAuthenticated, RoleBasedGrowthPermission]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['child']

    def perform_create(self, serializer):
        record = serializer.save()
        self._score(record)

    def perform_update(self, serializer):
        record = serializer.save()
        self._score(record)

    @staticmethod
    def _score(record):
        sex = record.child.sex
        haz = calculate_haz(float(record.height_cm), record.age_months, sex)
        whz = calculate_whz(float(record.weight_kg), float(record.height_cm), record.age_months, sex)
        waz = calculate_waz(float(record.weight_kg), record.age_months, sex)
        hcz = (
            calculate_hcz(float(record.head_circumference_cm), record.age_months, sex)
            if record.head_circumference_cm is not None else None
        )
        record.height_for_age_z = haz
        record.weight_for_height_z = whz
        record.weight_for_age_z = waz
        record.head_circumference_z = hcz
        record.risk_status = score_risk(haz, whz, waz, hcz).risk_status
        record.save(update_fields=[
            'height_for_age_z', 'weight_for_height_z', 'weight_for_age_z', 'head_circumference_z', 'risk_status',
        ])


class RiskAssessmentView(APIView):
    """
    GET /api/risk-assessment/<child_id>/
    Matches growthApi.getRiskAssessment() in the frontend.
    """

    def get(self, request, child_id):
        child = Child.objects.get(id=child_id)
        latest_record = child.growth_records.order_by('-measured_at').first()

        if latest_record is None:
            return Response({
                'child_id': str(child.id),
                'risk_status': None,
                'reason_codes': [],
                'assessed_at': None,
                'message': 'Belum ada data pertumbuhan untuk anak ini.',
            })

        result = assess_child_risk(child, latest_record)

        assessment = RiskAssessment.objects.create(
            child=child,
            risk_status=result.risk_status,
            score=result.score,
            reason_codes=result.reason_codes,
            recommendations=result.recommendations,
        )
        return Response(RiskAssessmentSerializer(assessment).data)


class GrowthReferenceView(APIView):
    """
    GET /api/growth-reference/?sex=male&ageMonths=18&heightCm=80 (heightCm optional)

    Reference guide (WHO -2SD..+2SD band, the same band classify_from_haz/whz
    use for "normal" vs "watch") — helps kader/nakes spot an obviously wrong
    entry (wrong unit, misplaced decimal) before submitting. This is guidance,
    not a hard validation rule; the actual plausibility check still lives in
    GrowthRecordSerializer.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        sex = request.query_params.get('sex')
        if sex not in ('male', 'female'):
            return Response({'detail': "Parameter 'sex' harus 'male' atau 'female'."}, status=400)

        try:
            age_months = float(request.query_params.get('ageMonths'))
        except (TypeError, ValueError):
            return Response({'detail': "Parameter 'ageMonths' wajib diisi angka."}, status=400)

        height_min, height_max = height_range_for_age(age_months, sex)
        data = {
            'age_months': age_months,
            'height_min_cm': round(height_min, 1),
            'height_max_cm': round(height_max, 1),
        }

        height_cm_raw = request.query_params.get('heightCm')
        if height_cm_raw:
            try:
                height_cm = float(height_cm_raw)
            except ValueError:
                return Response({'detail': "Parameter 'heightCm' harus angka."}, status=400)
            weight_min, weight_max = weight_range_for_height(height_cm, age_months, sex)
            data['weight_min_kg'] = round(weight_min, 1)
            data['weight_max_kg'] = round(weight_max, 1)

        return Response(data)
