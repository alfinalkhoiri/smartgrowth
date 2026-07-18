import secrets

from django.db import migrations


def generate_public_token() -> str:
    return secrets.token_urlsafe(24)


def backfill_public_tokens(apps, schema_editor):
    """
    Same rationale as 0012_backfill_link_codes: Child.save() auto-generates
    public_token for new rows, but rows created before this field existed
    have public_token=NULL until next saved through the app — assign tokens
    now so every existing balita already has a working QR link.
    """
    Child = apps.get_model('growth', 'Child')
    existing_tokens = set(Child.objects.exclude(public_token=None).values_list('public_token', flat=True))
    for child in Child.objects.filter(public_token__isnull=True):
        token = generate_public_token()
        while token in existing_tokens:
            token = generate_public_token()
        existing_tokens.add(token)
        child.public_token = token
        child.save(update_fields=['public_token'])


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('growth', '0013_child_public_token'),
    ]

    operations = [
        migrations.RunPython(backfill_public_tokens, noop),
    ]
