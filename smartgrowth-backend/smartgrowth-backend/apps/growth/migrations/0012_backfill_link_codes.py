import random

from django.db import migrations


def generate_link_code() -> str:
    return ''.join(random.choices('0123456789', k=6))


def backfill_link_codes(apps, schema_editor):
    """
    Child.save() auto-generates link_code for new rows, but rows created
    before this field existed have link_code=NULL and won't get one until
    they're next saved through the app — assign codes now so every existing
    balita is immediately linkable.
    """
    Child = apps.get_model('growth', 'Child')
    existing_codes = set(Child.objects.exclude(link_code=None).values_list('link_code', flat=True))
    for child in Child.objects.filter(link_code__isnull=True):
        code = generate_link_code()
        while code in existing_codes:
            code = generate_link_code()
        existing_codes.add(code)
        child.link_code = code
        child.save(update_fields=['link_code'])


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('growth', '0011_child_link_code_child_parents'),
    ]

    operations = [
        migrations.RunPython(backfill_link_codes, noop),
    ]
