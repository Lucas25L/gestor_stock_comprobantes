from django.db import migrations

ROLES = (
    ('Administrador', 'Gestiona usuarios, catálogo, stock, ventas, indicadores y auditoría.'),
    ('Cajero', 'Registra ventas, emite comprobantes y anula ventas.'),
    ('Repositor', 'Registra ingresos y ajustes de stock y procesa comprobantes de proveedores por OCR.'),
)


def crear_roles(apps, schema_editor):
    Rol = apps.get_model('usuarios', 'Rol')
    for nombre, descripcion in ROLES:
        Rol.objects.get_or_create(nombre=nombre, defaults={'descripcion': descripcion})


class Migration(migrations.Migration):
    dependencies = [('usuarios', '0001_initial')]
    operations = [migrations.RunPython(crear_roles, migrations.RunPython.noop)]