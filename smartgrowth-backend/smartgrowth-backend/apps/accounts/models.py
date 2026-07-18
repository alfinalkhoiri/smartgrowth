from django.contrib.auth.models import AbstractUser
from django.db import models


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

    def __str__(self):
        return f'{self.username} ({self.role})'
