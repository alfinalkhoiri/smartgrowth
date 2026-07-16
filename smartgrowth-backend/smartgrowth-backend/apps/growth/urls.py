from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import ChildViewSet, GrowthRecordViewSet, RiskAssessmentView, GrowthReferenceView

router = DefaultRouter()
router.register('children', ChildViewSet, basename='child')
router.register('growth-records', GrowthRecordViewSet, basename='growth-record')

urlpatterns = router.urls + [
    path('risk-assessment/<uuid:child_id>/', RiskAssessmentView.as_view(), name='risk-assessment'),
    path('growth-reference/', GrowthReferenceView.as_view(), name='growth-reference'),
]
