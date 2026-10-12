from django.db import migrations
from django.db.models import Max


def completar(apps, schema_editor):
    Comprobante = apps.get_model('comprobantes', 'Comprobante')
    Contador = apps.get_model('comprobantes', 'ContadorComprobante')
    DetalleVenta = apps.get_model('ventas', 'DetalleVenta')

    # Los comprobantes anteriores no guardaban copia de la venta: se arma con los datos actuales.
    for comprobante in Comprobante.objects.filter(contenido={}).select_related(
        'venta__medio_pago', 'venta__usuario'
    ):
        venta = comprobante.venta
        detalles = DetalleVenta.objects.filter(venta=venta).select_related('producto__unidad').order_by('pk')
        comprobante.contenido = {
            'venta_id': venta.pk,
            'fecha_venta': venta.fecha.isoformat(),
            'registrada_por': venta.usuario.username,
            'medio_pago': venta.medio_pago.nombre,
            'lineas': [
                {
                    'producto': d.producto.nombre,
                    'unidad': d.producto.unidad.abreviatura,
                    'cantidad': f'{d.cantidad:.3f}',
                    'precio_unitario': f'{d.precio_unitario:.2f}',
                    'subtotal': f'{d.subtotal:.2f}',
                }
                for d in detalles
            ],
            'impuestos_nacionales': f'{venta.impuestos_nacionales:.2f}',
            'total': f'{venta.total:.2f}',
        }
        comprobante.save(update_fields=['contenido'])

    # El contador arranca en el mayor número ya emitido, para continuar la numeración.
    ultimo = Comprobante.objects.aggregate(m=Max('numero'))['m'] or 0
    Contador.objects.update_or_create(clave='comprobante', defaults={'ultimo_numero': ultimo})


class Migration(migrations.Migration):

    dependencies = [
        ('comprobantes', '0003_contador_y_contenido'),
        ('ventas', '0008_venta_anulada_con_datos'),
    ]

    operations = [
        migrations.RunPython(completar, migrations.RunPython.noop),
    ]
