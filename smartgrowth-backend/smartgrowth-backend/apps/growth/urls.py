from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import (
    ChildViewSet, GrowthRecordViewSet, LinkChildView, PosyanduScheduleViewSet, PublicChildDashboardView,
    RiskAssessmentView, GrowthReferenceView,
)

router = DefaultRouter()
router.register('children', ChildViewSet, basename='child')
router.register('growth-records', GrowthRecordViewSet, basename='growth-record')
router.register('posyandu-schedules', PosyanduScheduleViewSet, basename='posyandu-schedule')

urlpatterns = [
    # Must come before router.urls — otherwise DRF tries to parse "link" as
    # a Child pk on GET/DELETE /children/<pk>/ style routes.
    path('children/link/', LinkChildView.as_view(), name='link-child'),
] + router.urls + [
    path('risk-assessment/<uuid:child_id>/', RiskAssessmentView.as_view(), name='risk-assessment'),
    path('growth-reference/', GrowthReferenceView.as_view(), name='growth-reference'),
    path('public/children/<str:token>/', PublicChildDashboardView.as_view(), name='public-child-dashboard'),
]
