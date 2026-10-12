from django.conf import settings
from django.db import models
from django.db.models import Q

from apps.mediospago.models import MedioPago
from apps.productos.models import Producto


class Venta(models.Model):
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='ventas',
    )
    medio_pago = models.ForeignKey(
        MedioPago,
        on_delete=models.PROTECT,
        related_name='ventas',
    )
    fecha = models.DateTimeField(auto_now_add=True)
    total = models.DecimalField(max_digits=10, decimal_places=2)
    impuestos_nacionales = models.DecimalField(max_digits=10, decimal_places=2)
    activa = models.BooleanField(default=True)  # False = venta anulada (se conserva en el historial)
    motivo_anulacion = models.CharField(max_length=255, blank=True)
    anulada_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='ventas_anuladas',
        null=True,
        blank=True,
    )
    fecha_anulacion = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ('-fecha',)
        constraints = [
            # Una venta anulada siempre debe indicar motivo, responsable y fecha (RN-25).
            models.CheckConstraint(
                condition=Q(activa=True)
                | (
                    ~Q(motivo_anulacion='')
                    & Q(anulada_por__isnull=False)
                    & Q(fecha_anulacion__isnull=False)
                ),
                name='venta_anulada_con_datos',
            ),
        ]

    @property
    def estado(self):
        return 'confirmada' if self.activa else 'anulada'

    def __str__(self):
        return f'Venta #{self.id} - {self.fecha:%d/%m/%Y %H:%M}'


class DetalleVenta(models.Model):
    venta = models.ForeignKey(
        Venta,
        on_delete=models.PROTECT,
        related_name='detalles',
    )
    producto = models.ForeignKey(
        Producto,
        on_delete=models.PROTECT,
        related_name='detalles_venta',
    )
    cantidad = models.DecimalField(max_digits=12, decimal_places=3)
    precio_unitario = models.DecimalField(max_digits=10, decimal_places=2)
    subtotal = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        ordering = ('id',)
        constraints = [
            models.CheckConstraint(
                condition=Q(cantidad__gt=0), name='detalleventa_cantidad_positiva'
            ),
        ]

    def __str__(self):
        return f'{self.cantidad} x {self.producto.nombre}'
