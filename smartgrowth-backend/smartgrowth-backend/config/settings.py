from pathlib import Path
from datetime import timedelta
from decouple import config, Csv

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = config('SECRET_KEY')
DEBUG = config('DEBUG', default=False, cast=bool)
ALLOWED_HOSTS = config('ALLOWED_HOSTS', default='localhost,127.0.0.1', cast=Csv())

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'corsheaders',
    'django_filters',

    'apps.accounts',
    'apps.growth',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': config('DB_NAME'),
        'USER': config('DB_USER'),
        'PASSWORD': config('DB_PASSWORD'),
        'HOST': config('DB_HOST', default='localhost'),
        'PORT': config('DB_PORT', default='5432'),
    }
}

AUTH_USER_MODEL = 'accounts.User'

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'id'
TIME_ZONE = 'Asia/Jakarta'
USE_I18N = True
USE_TZ = True

STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'  # populated by `collectstatic`, served by nginx in production
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Growth-record documentation photos (see GrowthRecord.photo). Served
# directly by Django (config/urls.py), not nginx — traffic here is kader
# documentation photos, not public-scale, so skipping a dedicated nginx
# `location /media/` block is an acceptable simplification for now.
MEDIA_URL = 'media/'
MEDIA_ROOT = BASE_DIR / 'media'

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_FILTER_BACKENDS': ('django_filters.rest_framework.DjangoFilterBackend',),
    'DEFAULT_RENDERER_CLASSES': (
        'djangorestframework_camel_case.render.CamelCaseJSONRenderer',
        'djangorestframework_camel_case.render.CamelCaseBrowsableAPIRenderer',
    ),
    'DEFAULT_PARSER_CLASSES': (
        'djangorestframework_camel_case.parser.CamelCaseJSONParser',
        'djangorestframework_camel_case.parser.CamelCaseFormParser',
        'djangorestframework_camel_case.parser.CamelCaseMultiPartParser',
    ),
    # public_child_dashboard: defense in depth on top of the token's own 192
    # bits of entropy — blunts scraping/enumeration from a single IP against
    # the one unauthenticated (AllowAny) endpoint in the API.
    'DEFAULT_THROTTLE_RATES': {
        'public_child_dashboard': '30/min',
    },
}

SIMPLE_JWT = {
    # Short-lived access token — an actively-used session never notices
    # this expiring, since the frontend transparently refreshes on the
    # first 401 it sees (see client.ts). What actually determines "how long
    # can this browser sit unused before it's forced to log in again" is
    # REFRESH_TOKEN_LIFETIME below, not this value.
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=30),
    # This is the real idle-session limit: as long as at least one request
    # happens within any 7-day window, the rotated refresh token keeps the
    # session alive indefinitely; leave the browser genuinely untouched for
    # longer than this and the next visit forces a real login.
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    # Every refresh issues a new refresh token *and* invalidates the one
    # just used (via the blacklist app below) — without blacklisting,
    # rotation alone doesn't actually revoke anything, every refresh token
    # ever issued would stay valid until its own natural expiry.
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
}

CORS_ALLOWED_ORIGINS = config('CORS_ALLOWED_ORIGINS', default='', cast=Csv())

# Behind nginx terminating TLS (see deploy/nginx.conf), Django otherwise has
# no way to know the original request was HTTPS — needed for correct
# is_secure()/redirect behavior and for CSRF checks on the Django admin.
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
CSRF_TRUSTED_ORIGINS = config('CSRF_TRUSTED_ORIGINS', default='', cast=Csv())
