from rest_framework_simplejwt.serializers import TokenObtainPairSerializer


class RoleTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Embeds role + is_superuser into the JWT payload so the frontend can
    show/hide role-restricted actions (create/edit/delete) without a separate
    "who am I" request — it decodes these straight from the token it already
    holds. `RoleBasedGrowthPermission` on the backend remains the actual
    authority; these claims are for UI display only, never trust them as a
    security boundary on their own.
    """

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['role'] = user.role
        token['is_superuser'] = user.is_superuser
        token['username'] = user.username
        return token


def tokens_with_claims(user) -> dict:
    """Used by RegisterView, which issues tokens directly (no login form)."""
    token = RoleTokenObtainPairSerializer.get_token(user)
    return {'access': str(token.access_token), 'refresh': str(token)}
