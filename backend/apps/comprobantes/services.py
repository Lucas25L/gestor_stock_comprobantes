from django.db import transaction

from apps.auditoria.models import Auditoria
from apps.auditoria.services import registrar
from apps.ventas.models import Venta

from .models import Comprobante, ContadorComprobante


class ComprobanteError(Exception):
    """Error de negocio de los comprobantes. Las vistas lo traducen a una respuesta 400."""


def _armar_contenido(venta):
    """Copia de los datos de la venta que se conserva dentro del comprobante (RF-49)."""
    lineas = [
        {
            'producto': detalle.producto.nombre,
            'unidad': detalle.producto.unidad.abreviatura,
            'cantidad': f'{detalle.cantidad:.3f}',
            'precio_unitario': f'{detalle.precio_unitario:.2f}',
            'subtotal': f'{detalle.subtotal:.2f}',
        }
        for detalle in venta.detalles.select_related('producto__unidad').order_by('pk')
    ]
    return {
        'venta_id': venta.pk,
        'fecha_venta': venta.fecha.isoformat(),
        'registrada_por': venta.usuario.username,
        'medio_pago': venta.medio_pago.nombre,
        'lineas': lineas,
        'impuestos_nacionales': f'{venta.impuestos_nacionales:.2f}',
        'total': f'{venta.total:.2f}',
    }


def emitir_comprobante(*, usuario, venta_id):
    """Emite el comprobante interno de una venta confirmada (RF-48, RN-26).

    Se bloquea primero la venta y después el contador. Ese mismo orden lo usa la
    anulación (que bloquea la venta), por lo que no pueden trabarse entre sí. Todo se
    confirma o se deshace junto: si algo falla, el número no se consume.
    """
    with transaction.atomic():
        try:
            venta = (
                Venta.objects.select_for_update(of=('self',))
                .select_related('medio_pago', 'usuario')
                .get(pk=venta_id)
            )
        except Venta.DoesNotExist:
            raise ComprobanteError(f'La venta {venta_id} no existe.')

        if not venta.activa:
            raise ComprobanteError(
                f'La venta #{venta.pk} está anulada, no se puede emitir un comprobante.'
            )
        if Comprobante.objects.filter(venta=venta).exists():
            raise ComprobanteError(f'La venta #{venta.pk} ya tiene un comprobante emitido.')

        contador = ContadorComprobante.objects.select_for_update().get(clave='comprobante')
        contador.ultimo_numero += 1
        contador.save(update_fields=['ultimo_numero'])

        comprobante = Comprobante.objects.create(
            venta=venta, numero=contador.ultimo_numero, contenido=_armar_contenido(venta)
        )
        registrar(
            usuario=usuario,
            accion=Auditoria.Accion.COMPROBANTE_EMITIDO,
            entidad='Comprobante',
            id_registro=comprobante.pk,
            detalle={'numero': comprobante.numero_formateado, 'venta_id': venta.pk},
        )
    return comprobante
