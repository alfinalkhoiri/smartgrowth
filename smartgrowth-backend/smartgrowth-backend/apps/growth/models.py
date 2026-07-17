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

    # Parent/guardian info — optional, for contact/record-keeping purposes
    parent_name = models.CharField(max_length=150, blank=True, default='')
    parent_occupation = models.CharField(max_length=150, blank=True, default='')

    # Risk-factor fields used by the Stage 2 predictive layer later on
    exclusive_breastfeeding = models.BooleanField(null=True, blank=True)
    birth_weight_kg = models.DecimalField(max_digits=4, decimal_places=2, null=True, blank=True)
    birth_length_cm = models.DecimalField(max_digits=4, decimal_places=1, null=True, blank=True)
    gestational_age_weeks = models.PositiveSmallIntegerField(
        null=True, blank=True, help_text='Usia kehamilan saat lahir, dalam minggu — indikator prematuritas'
    )

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
    head_circumference_cm = models.DecimalField(
        max_digits=4, decimal_places=1, null=True, blank=True,
        help_text='Lingkar kepala — opsional, standar WHO Head-Circumference-for-Age, indikator tambahan mikrosefali'
    )
    age_months = models.PositiveIntegerField(help_text='Usia anak saat pengukuran, dalam bulan')
    # Documentation only — NOT used for automated size estimation from image.
    # Photo-based anthropometry (e.g. depth/ToF-sensor apps) needs hardware
    # and a labeled dataset this project doesn't have; out of scope here.
    photo = models.ImageField(
        upload_to='growth_photos/%Y/%m/', null=True, blank=True,
        help_text='Foto balita opsional — dokumentasi pertumbuhan, bukan input AI-vision'
    )
    officer_name = models.CharField(
        max_length=150, blank=True, default='', help_text='Nama petugas yang melakukan pengukuran'
    )
    location = models.CharField(
        max_length=150, blank=True, default='', help_text='Lokasi pengukuran, mis. Posyandu Melati / Klinik Sehat'
    )
    notes = models.TextField(blank=True, default='', help_text='Catatan tambahan dari kader/nakes saat pengukuran')

    # Kuesioner faktor risiko stunting tambahan — diisi nakes, null berarti
    # belum ditanyakan/dijawab (beda dari False yang berarti sudah ditanya
    # dan jawabannya negatif). Dipakai risk_engine.questionnaire_recommendations()
    # bersama Child.exclusive_breastfeeding & Child.birth_weight_kg.
    clean_water_access = models.BooleanField(
        null=True, blank=True, help_text='Akses air bersih & sanitasi layak'
    )
    recurrent_illness = models.BooleanField(
        null=True, blank=True, help_text='Riwayat sakit/diare berulang dalam 3 bulan terakhir'
    )
    immunization_complete = models.BooleanField(
        null=True, blank=True, help_text='Imunisasi lengkap sesuai usia'
    )

    # Computed via WHO growth standards at save-time (see services/risk_engine.py)
    height_for_age_z = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    weight_for_height_z = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    weight_for_age_z = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    head_circumference_z = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
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
    score = models.PositiveSmallIntegerField(default=0, help_text='0-100, higher = more severe')
    reason_codes = models.JSONField(default=list)  # e.g. ["HAZ_STUNTED", "NO_EXCLUSIVE_BF"]
    recommendations = models.JSONField(default=list)  # e.g. ["Rujuk ke Puskesmas...", ...]
    assessed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-assessed_at']

    def __str__(self):
        return f'{self.child.name}: {self.risk_status} @ {self.assessed_at:%Y-%m-%d}'


class PosyanduSchedule(models.Model):
    """
    A posyandu visit slot (date/time + location), not tied to a specific
    child — one schedule covers a whole neighborhood's visit, kader/nakes
    post it once and every parent/kader sees the same entry.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    scheduled_at = models.DateTimeField()
    location = models.CharField(max_length=200)
    notes = models.TextField(blank=True, default='')
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='posyandu_schedules'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['scheduled_at']

    def __str__(self):
        return f'{self.location} @ {self.scheduled_at:%Y-%m-%d %H:%M}'
