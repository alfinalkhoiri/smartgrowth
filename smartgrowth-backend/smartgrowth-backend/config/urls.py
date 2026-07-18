from django.conf import settings
from django.contrib import admin
from django.urls import path, include, re_path
from django.views.static import serve
from rest_framework_simplejwt.views import TokenRefreshView

from apps.accounts.views import InviteCodeView, RegisterView, RoleTokenObtainPairView, UserListView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/login', RoleTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/auth/refresh', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/auth/register', RegisterView.as_view(), name='register'),
    path('api/auth/invite-code', InviteCodeView.as_view(), name='invite-code'),
    path('api/auth/users', UserListView.as_view(), name='user-list'),
    path('api/', include('apps.growth.urls')),
    # Served directly by Django (not nginx) — see MEDIA_ROOT comment in
    # settings.py for why that's an acceptable simplification here.
    re_path(r'^media/(?P<path>.*)$', serve, {'document_root': settings.MEDIA_ROOT}),
]
