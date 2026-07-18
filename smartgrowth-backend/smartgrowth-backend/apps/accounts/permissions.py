from rest_framework.permissions import BasePermission

from .models import Role


class IsAppAdmin(BasePermission):
    """Superuser or role=admin — used for admin-only endpoints like the invite-code manager."""

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user and user.is_authenticated and (user.is_superuser or getattr(user, 'role', None) == Role.ADMIN)
        )
