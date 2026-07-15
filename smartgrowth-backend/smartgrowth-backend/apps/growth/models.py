import uuid
from django.conf import settings
from django.db import models


class Child(models.Model):
    class Sex(models.TextChoices):
        MALE = 'male', 'Laki-laki'
        FEMALE = 'female', 'Perempuan'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=150)
    birth_date = models.DateField()
    sex = models.CharField(max_length=10, choices=Sex.choices)

    # Risk-factor fields used by the Stage 2 predictive layer later on
    exclusive_breastfeeding = models.BooleanField(null=True, blank=True)
    birth_weight_kg = models.DecimalField(max_digits=4, decimal_places=2, null=True, blank=True)

    registered_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='registered_children'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


class GrowthRecord(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    child = models.ForeignKey(Child, on_delete=models.CASCADE, related_name='growth_records')
    measured_at = models.DateField()
    weight_kg = models.DecimalField(max_digits=5, decimal_places=2)
    height_cm = models.DecimalField(max_digits=5, decimal_places=2)
    age_months = models.PositiveIntegerField(help_text='Usia anak saat pengukuran, dalam bulan')
    officer_name = models.CharField(
        max_length=150, blank=True, default='', help_text='Nama petugas yang melakukan pengukuran'
    )
    location = models.CharField(
        max_length=150, blank=True, default='', help_text='Lokasi pengukuran, mis. Posyandu Melati / Klinik Sehat'
    )
    notes = models.TextField(blank=True, default='', help_text='Catatan tambahan dari kader/nakes saat pengukuran')

    # Computed via WHO growth standards at save-time (see services/risk_engine.py)
    height_for_age_z = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    weight_for_height_z = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    risk_status = models.CharField(max_length=10, blank=True)

    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='recorded_growth'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['age_months']
        constraints = [
            models.UniqueConstraint(fields=['child', 'measured_at'], name='unique_measurement_per_day')
        ]

    def __str__(self):
        return f'{self.child.name} @ {self.age_months}mo'


class RiskAssessment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    child = models.ForeignKey(Child, on_delete=models.CASCADE, related_name='risk_assessments')
    risk_status = models.CharField(max_length=10)
    reason_codes = models.JSONField(default=list)  # e.g. ["HAZ_BELOW_-2", "NO_EXCLUSIVE_BF"]
    assessed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-assessed_at']

    def __str__(self):
        return f'{self.child.name}: {self.risk_status} @ {self.assessed_at:%Y-%m-%d}'
