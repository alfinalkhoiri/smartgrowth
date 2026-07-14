from django.contrib import admin
from .models import Child, GrowthRecord, RiskAssessment


@admin.register(Child)
class ChildAdmin(admin.ModelAdmin):
    list_display = ['name', 'sex', 'birth_date', 'registered_by']
    search_fields = ['name']


@admin.register(GrowthRecord)
class GrowthRecordAdmin(admin.ModelAdmin):
    list_display = ['child', 'measured_at', 'age_months', 'weight_kg', 'height_cm', 'risk_status']
    list_filter = ['risk_status']


@admin.register(RiskAssessment)
class RiskAssessmentAdmin(admin.ModelAdmin):
    list_display = ['child', 'risk_status', 'assessed_at']
    list_filter = ['risk_status']
