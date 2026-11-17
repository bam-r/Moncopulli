from django.contrib.auth.hashers import identify_hasher, make_password
from django.db import migrations


def hash_legacy_passwords(apps, schema_editor):
    Usuario = apps.get_model("inventario", "Usuario")
    database = schema_editor.connection.alias
    queryset = Usuario.objects.using(database).only("id", "contrasena")
    for usuario in queryset.iterator(chunk_size=500):
        try:
            identify_hasher(usuario.contrasena)
        except ValueError:
            usuario.contrasena = make_password(usuario.contrasena)
            usuario.save(using=database, update_fields=["contrasena"])


class Migration(migrations.Migration):

    dependencies = [
        ("inventario", "0006_registroaccesodatos_usuario_objetivo"),
    ]

    operations = [
        migrations.RunPython(hash_legacy_passwords, migrations.RunPython.noop),
    ]
