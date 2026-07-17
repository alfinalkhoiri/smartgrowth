from django.conf import settings
from django.contrib import admin
from django.urls import path, include, re_path
from django.views.static import serve
from rest_framework_simplejwt.views import TokenRefreshView

from apps.accounts.views import RegisterView, RoleTokenObtainPairView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/login', RoleTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/auth/refresh', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/auth/register', RegisterView.as_view(), name='register'),
    path('api/', include('apps.growth.urls')),
    # Served directly by Django (not nginx) — see MEDIA_ROOT comment in
    # settings.py for why that's an acceptable simplification here.
    re_path(r'^media/(?P<path>.*)$', serve, {'document_root': settings.MEDIA_ROOT}),
]
