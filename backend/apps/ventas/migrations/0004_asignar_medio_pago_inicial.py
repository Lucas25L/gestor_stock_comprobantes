from django.db import migrations


def asignar_medio_pago_inicial(apps, schema_editor):
    Venta = apps.get_model('ventas', 'Venta')
    MedioPago = apps.get_model('mediospago', 'MedioPago')
    sin_medio = Venta.objects.filter(medio_pago__isnull=True)
    if sin_medio.exists():
        # Las ventas anteriores a este cambio no registraron el medio de pago: se asumen en efectivo.
        sin_medio.update(medio_pago=MedioPago.objects.get(nombre='Efectivo'))


class Migration(migrations.Migration):

    dependencies = [
        ('ventas', '0003_venta_medio_pago'),
        ('mediospago', '0002_cargar_medios_iniciales'),
    ]

    operations = [
        migrations.RunPython(asignar_medio_pago_inicial, migrations.RunPython.noop),
    ]
