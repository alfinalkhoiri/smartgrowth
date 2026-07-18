from django.db import migrations


# Old roles 'kader'/'nakes'/'viewer' no longer exist as choices as of 0002 —
# remap them onto the new 2-role model. 'viewer' has no direct read-only
# equivalent anymore (the old role matrix distinguished read-only from
# create-only from full-CRUD; the new one only distinguishes "sees
# everything" from "sees only linked children"), so it maps to kader_nakes
# too — a production check before writing this migration found 0 viewer
# accounts in use, so this is a theoretical case, not a real demotion.
LEGACY_TO_NEW_ROLE = {
    'kader': 'kader_nakes',
    'nakes': 'kader_nakes',
    'viewer': 'kader_nakes',
}


def migrate_roles_forward(apps, schema_editor):
    User = apps.get_model('accounts', 'User')
    for old_role, new_role in LEGACY_TO_NEW_ROLE.items():
        User.objects.filter(role=old_role).update(role=new_role)


def migrate_roles_backward(apps, schema_editor):
    # Not reversible without losing information (we don't know which
    # kader_nakes users were originally kader vs nakes vs viewer) — no-op.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0002_alter_user_role'),
    ]

    operations = [
        migrations.RunPython(migrate_roles_forward, migrate_roles_backward),
    ]
