from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView

from .serializers import RegisterSerializer
from .tokens import RoleTokenObtainPairSerializer, tokens_with_claims


class RoleTokenObtainPairView(TokenObtainPairView):
    """POST /api/auth/login — same as SimpleJWT's default, with role/is_superuser in the token."""
    serializer_class = RoleTokenObtainPairSerializer


class RegisterView(generics.CreateAPIView):
    """
    POST /api/auth/register — public self-registration for orangtua (no
    gate) or kader_nakes (requires KADER_NAKES_INVITE_CODE, see serializer).
    Returns {access, refresh} directly (same shape as /api/auth/login) so the
    frontend can log the user in immediately without a second request.
    """
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(tokens_with_claims(user), status=status.HTTP_201_CREATED)
