import random
import string

from decouple import config
from django.db import migrations


def _generate_code() -> str:
    alphabet = string.ascii_uppercase + string.digits
    return 'SG-' + ''.join(random.choices(alphabet, k=8))


def seed_invite_code(apps, schema_editor):
    """
    One-time only: carries forward whatever KADER_NAKES_INVITE_CODE was set
    to in .env (e.g. production already had one shared out to real
    kader/nakes) so this migration doesn't silently invalidate it. Fresh
    installs with no such var get a freshly generated code instead. Reads
    the env var directly via decouple rather than settings.KADER_NAKES_
    INVITE_CODE, since that setting no longer exists after this change.
    """
    RegistrationInviteCode = apps.get_model('accounts', 'RegistrationInviteCode')
    if RegistrationInviteCode.objects.filter(pk=1).exists():
        return
    seed = config('KADER_NAKES_INVITE_CODE', default=None)
    RegistrationInviteCode.objects.create(pk=1, code=seed or _generate_code())


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0004_registrationinvitecode'),
    ]

    operations = [
        migrations.RunPython(seed_invite_code, noop),
    ]
