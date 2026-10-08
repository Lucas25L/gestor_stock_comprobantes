from django.conf import settings
from django.db import models
from django.db.models import Q

from apps.auditoria.models import RegistroInmutableError
from apps.productos.models import Producto

MENSAJE_INMUTABLE = (
    'Los movimientos de stock no pueden modificarse ni eliminarse: '
    'un error se corrige con un movimiento nuevo.'
)


class MovimientoStockQuerySet(models.QuerySet):
    """Bloquea las operaciones masivas que modificarían o borrarían movimientos."""

    def update(self, **kwargs):
        raise RegistroInmutableError(MENSAJE_INMUTABLE)

    def bulk_update(self, objs, fields, batch_size=None):
        raise RegistroInmutableError(MENSAJE_INMUTABLE)

    def delete(self):
        raise RegistroInmutableError(MENSAJE_INMUTABLE)


class MovimientoStock(models.Model):
    class Tipo(models.TextChoices):
        INGRESO = 'ingreso', 'Ingreso de mercadería'
        AJUSTE = 'ajuste', 'Ajuste manual'
        VENTA = 'venta', 'Venta'
        ANULACION_VENTA = 'anulacion_venta', 'Anulación de venta'

    producto = models.ForeignKey(Producto, on_delete=models.PROTECT, related_name='movimientos')
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='movimientos_stock',
    )
    tipo = models.CharField(max_length=20, choices=Tipo.choices, db_index=True)
    # Con signo: positiva suma al stock, negativa resta.
    cantidad = models.DecimalField(max_digits=12, decimal_places=3)
    # Stock del producto inmediatamente después de aplicar el movimiento.
    stock_resultante = models.DecimalField(max_digits=12, decimal_places=3)
    motivo = models.CharField(max_length=255, blank=True)
    # Origen del movimiento, por ejemplo "venta:120" u "ocr:7".
    referencia_origen = models.CharField(max_length=100, blank=True, db_index=True)
    fecha_hora = models.DateTimeField(auto_now_add=True, db_index=True)

    objects = MovimientoStockQuerySet.as_manager()

    class Meta:
        verbose_name = 'Movimiento de stock'
        verbose_name_plural = 'Movimientos de stock'
        ordering = ('-fecha_hora', '-id')
        indexes = [models.Index(fields=['producto', 'fecha_hora'])]
        constraints = [
            models.CheckConstraint(
                condition=(
                    (Q(tipo__in=['ingreso', 'anulacion_venta']) & Q(cantidad__gt=0))
                    | (Q(tipo='venta') & Q(cantidad__lt=0))
                    | (Q(tipo='ajuste') & ~Q(cantidad=0))
                ),
                name='movimiento_signo_segun_tipo',
            ),
            models.CheckConstraint(
                condition=~(Q(tipo__in=['ingreso', 'ajuste']) & Q(motivo='')),
                name='movimiento_motivo_obligatorio',
            ),
            models.CheckConstraint(
                condition=Q(stock_resultante__gte=0),
                name='movimiento_stock_resultante_no_negativo',
            ),
        ]

    def __str__(self):
        return f'{self.get_tipo_display()} {self.cantidad} de {self.producto}'

    def save(self, *args, **kwargs):
        if not self._state.adding:
            raise RegistroInmutableError(MENSAJE_INMUTABLE)
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise RegistroInmutableError(MENSAJE_INMUTABLE)
