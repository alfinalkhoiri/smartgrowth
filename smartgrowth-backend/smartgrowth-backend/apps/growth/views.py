from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from django_filters.rest_framework import DjangoFilterBackend

from .models import Child, GrowthRecord, RiskAssessment
from .permissions import RoleBasedGrowthPermission
from .serializers import ChildSerializer, GrowthRecordSerializer, RiskAssessmentSerializer
from .services.risk_engine import assess_child_risk, calculate_haz, calculate_whz, classify_growth_record


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
        record.height_for_age_z = haz
        record.weight_for_height_z = whz
        record.risk_status = classify_growth_record(haz, whz)
        record.save(update_fields=['height_for_age_z', 'weight_for_height_z', 'risk_status'])


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
            reason_codes=result.reason_codes,
        )
        return Response(RiskAssessmentSerializer(assessment).data)
