from django.db import transaction
from django.utils import timezone

from apps.auditoria.models import Auditoria
from apps.auditoria.services import registrar
from apps.stock import services as stock_services

from .models import Venta


class VentaError(Exception):
    """Error de negocio de las ventas. Las vistas lo traducen a una respuesta 400."""


def anular_venta(*, usuario, venta_id, motivo):
    """Anula una venta, repone su stock y deja todo registrado (RF-45 a RF-47).

    Todo ocurre en una sola transacción: si algo falla, la venta sigue como estaba.
    La fila de la venta se bloquea, así dos anulaciones simultáneas de la misma venta
    no pueden reponer el stock dos veces.
    """
    motivo = (motivo or '').strip()
    if not motivo:
        raise VentaError('El motivo de la anulación es obligatorio.')

    with transaction.atomic():
        venta = (
            Venta.objects.select_for_update(of=('self',))
            .select_related('medio_pago')
            .get(pk=venta_id)
        )
        if not venta.activa:
            raise VentaError(f'La venta #{venta.pk} ya está anulada.')

        detalles = list(venta.detalles.select_related('producto').order_by('pk'))
        stock_services.reponer_por_anulacion(
            usuario=usuario,
            lineas=[(detalle.producto, detalle.cantidad) for detalle in detalles],
            referencia=f'venta:{venta.pk}',
        )

        venta.activa = False
        venta.motivo_anulacion = motivo
        venta.anulada_por = usuario
        venta.fecha_anulacion = timezone.now()
        venta.save(update_fields=['activa', 'motivo_anulacion', 'anulada_por', 'fecha_anulacion'])

        # Si la venta tenía comprobante, pasa a figurar como anulado (el contenido no cambia).
        comprobante = getattr(venta, 'comprobante', None)
        if comprobante is not None:
            comprobante.estado = 'anulado'
            comprobante.save(update_fields=['estado'])

        registrar(
            usuario=usuario,
            accion=Auditoria.Accion.VENTA_ANULADA,
            entidad='Venta',
            id_registro=venta.pk,
            detalle={
                'motivo': motivo,
                'total': f'{venta.total:.2f}',
                'lineas_repuestas': len(detalles),
            },
        )
    return venta
