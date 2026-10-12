from django.db import migrations
from django.db.models import F


def completar_ventas_ya_anuladas(apps, schema_editor):
    Venta = apps.get_model('ventas', 'Venta')
    # Las ventas anuladas antes de este cambio no guardaron motivo, responsable ni fecha.
    # Se completan con lo único que se sabe: quién la registró y cuándo.
    Venta.objects.filter(activa=False, motivo_anulacion='').update(
        motivo_anulacion='Anulada antes de que el sistema registrara el motivo.',
        anulada_por=F('usuario'),
        fecha_anulacion=F('fecha'),
    )


class Migration(migrations.Migration):

    dependencies = [('ventas', '0006_venta_datos_de_anulacion')]

    operations = [
        migrations.RunPython(completar_ventas_ya_anuladas, migrations.RunPython.noop),
    ]
