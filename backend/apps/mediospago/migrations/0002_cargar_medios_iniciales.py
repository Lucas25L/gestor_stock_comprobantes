from django.db import migrations

MEDIOS = (
    ('Efectivo', 'Pago en efectivo'),
    ('Tarjeta de débito', ''),
    ('Tarjeta de crédito', ''),
    ('Transferencia', 'Transferencia bancaria'),
    ('Billetera virtual', 'Pago con billetera virtual o QR'),
)


def crear_medios(apps, schema_editor):
    MedioPago = apps.get_model('mediospago', 'MedioPago')
    for nombre, descripcion in MEDIOS:
        MedioPago.objects.get_or_create(nombre=nombre, defaults={'descripcion': descripcion})


class Migration(migrations.Migration):
    dependencies = [('mediospago', '0001_initial')]
    operations = [migrations.RunPython(crear_medios, migrations.RunPython.noop)]
