from rest_framework.permissions import SAFE_METHODS, BasePermission

from apps.accounts.models import Role


class RoleBasedGrowthPermission(BasePermission):
    """
    Role matrix for Child/GrowthRecord/PosyanduSchedule endpoints:
      - admin (Django superuser, or role=admin): full access
      - kader_nakes: full CRUD — field data entry and corrections both
      - orangtua: read-only, and only ever sees their own linked child(ren)
        (enforced by visible_children() in the view's get_queryset(), not
        here — this class only gates the HTTP method, not which rows).
    """

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True

        user = request.user
        return bool(user.is_superuser or getattr(user, 'role', None) in (Role.ADMIN, Role.KADER_NAKES))


def visible_children(user):
    """
    Child queryset scoped to what `user` is allowed to see. kader_nakes/admin
    see every child (that's the job); orangtua only sees children they've
    linked to via Child.link_code — never the whole posyandu's roster.
    """
    from .models import Child

    if user.is_superuser or getattr(user, 'role', None) != Role.ORANGTUA:
        return Child.objects.all()
    return Child.objects.filter(parents=user)
