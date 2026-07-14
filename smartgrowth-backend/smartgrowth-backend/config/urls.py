from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import TokenRefreshView

from apps.accounts.views import RegisterView, RoleTokenObtainPairView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/login', RoleTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/auth/refresh', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/auth/register', RegisterView.as_view(), name='register'),
    path('api/', include('apps.growth.urls')),
]
