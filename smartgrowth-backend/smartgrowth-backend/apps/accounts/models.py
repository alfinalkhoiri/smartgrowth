from django.contrib.auth.models import AbstractUser
from django.db import models


class Role(models.TextChoices):
    ADMIN = 'admin', 'Admin'
    KADER = 'kader', 'Kader Posyandu'
    NAKES = 'nakes', 'Tenaga Kesehatan'
    VIEWER = 'viewer', 'Manajemen / Viewer'


class User(AbstractUser):
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.KADER)
    phone_number = models.CharField(max_length=20, blank=True)

    def __str__(self):
        return f'{self.username} ({self.role})'
