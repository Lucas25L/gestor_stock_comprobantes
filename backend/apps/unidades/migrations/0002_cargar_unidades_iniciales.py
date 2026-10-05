from django.db import migrations

UNIDADES = (
    ('Unidad', 'u'),
    ('Kilogramo', 'kg'),
    ('Litro', 'l'),
)


def crear_unidades(apps, schema_editor):
    UnidadMedida = apps.get_model('unidades', 'UnidadMedida')
    for nombre, abreviatura in UNIDADES:
        UnidadMedida.objects.get_or_create(nombre=nombre, defaults={'abreviatura': abreviatura})


class Migration(migrations.Migration):
    dependencies = [('unidades', '0001_initial')]
    operations = [migrations.RunPython(crear_unidades, migrations.RunPython.noop)]