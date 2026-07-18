from rest_framework import generics, permissions, status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

from .models import RegistrationInviteCode, User, generate_invite_code
from .permissions import IsAppAdmin
from .serializers import InviteCodeSerializer, RegisterSerializer, UserListSerializer
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


class InviteCodeView(APIView):
    """
    GET/POST /api/auth/invite-code — admin-only. GET returns the code
    currently required to self-register as kader_nakes (frontend renders it
    as text + a QR deep link on the "Kode Posyandu" admin page); POST
    regenerates it, immediately invalidating the old one/QR.
    """
    permission_classes = [IsAppAdmin]

    def get(self, request):
        return Response(InviteCodeSerializer(RegistrationInviteCode.load()).data)

    def post(self, request):
        obj = RegistrationInviteCode.load()
        obj.code = generate_invite_code()
        obj.updated_by = request.user
        obj.save()
        return Response(InviteCodeSerializer(obj).data)


class UserListView(generics.ListAPIView):
    """GET /api/auth/users — admin-only, backs the 'List User' page under Setting."""
    queryset = User.objects.all().order_by('username')
    serializer_class = UserListSerializer
    permission_classes = [IsAppAdmin]


class UserDetailView(generics.DestroyAPIView):
    """
    DELETE /api/auth/users/<id> — admin-only. Blocks deleting your own
    account (the one obvious footgun: an admin locking themselves out isn't
    recoverable from the UI, only via `createsuperuser`/shell).
    """
    queryset = User.objects.all()
    serializer_class = UserListSerializer
    permission_classes = [IsAppAdmin]

    def perform_destroy(self, instance):
        if instance.pk == self.request.user.pk:
            raise ValidationError({'detail': 'Tidak bisa menghapus akun sendiri.'})
        instance.delete()
