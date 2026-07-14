from rest_framework.permissions import SAFE_METHODS, BasePermission

from apps.accounts.models import Role


class RoleBasedGrowthPermission(BasePermission):
    """
    Role matrix for Child/GrowthRecord endpoints:
      - admin (Django superuser, or role=admin): full access
      - nakes: full CRUD — validates/corrects kader-submitted data
      - kader: read + create only — field data entry, no edit or delete
      - viewer: read-only

    RiskAssessmentView deliberately stays on the default IsAuthenticated
    permission (no role restriction) — any authenticated role may view an
    assessment, per "Nakes: ... + akses RiskAssessment" implying read access
    to it isn't itself role-gated for the others.
    """

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True

        user = request.user
        if user.is_superuser or getattr(user, 'role', None) in (Role.ADMIN, Role.NAKES):
            return True
        if getattr(user, 'role', None) == Role.KADER:
            return request.method == 'POST'
        return False
