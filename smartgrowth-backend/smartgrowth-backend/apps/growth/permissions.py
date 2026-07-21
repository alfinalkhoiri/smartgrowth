from rest_framework.permissions import SAFE_METHODS, BasePermission

from apps.accounts.models import Role


class RoleBasedGrowthPermission(BasePermission):
    """
    Role matrix for Child/PosyanduSchedule endpoints:
      - admin (Django superuser, or role=admin): full access
      - kader_nakes: full CRUD — field data entry and corrections both
      - orangtua: read-only, and only ever sees their own linked child(ren)
        (enforced by visible_children() in the view's get_queryset(), not
        here — this class only gates the HTTP method, not which rows).
        Deliberately still blocked from creating/editing a Child itself
        (that's the kader/nakes registration flow) — see
        GrowthRecordPermission for the narrower carve-out that lets
        orangtua add a *measurement* for a child they're already linked to.
    """

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True

        user = request.user
        return bool(user.is_superuser or getattr(user, 'role', None) in (Role.ADMIN, Role.KADER_NAKES))


class GrowthRecordPermission(RoleBasedGrowthPermission):
    """
    Same matrix as RoleBasedGrowthPermission, plus one narrow carve-out:
    orangtua may POST (self-measurement — "pengukuran mandiri" between
    posyandu visits) but never PUT/PATCH/DELETE an existing record, and
    never touch a child they aren't linked to (that part is enforced by
    GrowthRecordSerializer.validate(), since object-level child scoping
    can't be expressed in has_permission() alone — there's no object yet
    on create).
    """

    def has_permission(self, request, view):
        if super().has_permission(request, view):
            return True
        user = request.user
        return bool(request.method == 'POST' and getattr(user, 'role', None) == Role.ORANGTUA)


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
