import random
import string

from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.db import models


def generate_invite_code() -> str:
    alphabet = string.ascii_uppercase + string.digits
    return 'SG-' + ''.join(random.choices(alphabet, k=8))


class Role(models.TextChoices):
    ADMIN = 'admin', 'Admin'
    # Kader (data entry di lapangan) dan nakes (validasi/koreksi) dulu 2 role
    # terpisah dengan hak akses berbeda — digabung jadi satu supaya alur
    # kerja posyandu (yang di lapangan memang sama-sama dipercaya penuh)
    # tidak terhambat pemisahan izin yang tidak lagi relevan.
    KADER_NAKES = 'kader_nakes', 'Kader/Nakes'
    # Read-only, dan hanya untuk balita yang ditautkan lewat kode 6-digit
    # (Child.link_code) — lihat apps/growth/permissions.py:visible_children.
    ORANGTUA = 'orangtua', 'Orang Tua'


class User(AbstractUser):
    # Default ke role paling rendah privilese — pendaftaran publik untuk
    # kader_nakes butuh kode undangan (lihat accounts/serializers.py), jadi
    # nilai default di sini praktis tidak pernah dipakai kecuali dari shell.
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.ORANGTUA)
    phone_number = models.CharField(max_length=20, blank=True)
    # Klinik/Posyandu tempat kader/nakes bertugas — informasional saja
    # (bukan dipakai untuk scoping data balita, itu tetap lewat
    # Child.posyandu_location / lokasi per-kunjungan).
    posyandu_location = models.CharField(max_length=150, blank=True, default='')

    def __str__(self):
        return f'{self.username} ({self.role})'


class RegistrationInviteCode(models.Model):
    """
    Singleton (always pk=1) — the code currently required to self-register as
    kader_nakes (see accounts/serializers.RegisterSerializer). Lives in the
    DB rather than a static env var so an admin can view/regenerate it from
    the frontend (Kode Posyandu page) instead of needing SSH access — the
    whole point being it shouldn't be something only a developer remembers.
    """
    code = models.CharField(max_length=32)
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='+'
    )

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def load(cls) -> 'RegistrationInviteCode':
        obj, _ = cls.objects.get_or_create(pk=1, defaults={'code': generate_invite_code()})
        return obj

    def __str__(self):
        return self.code
