from django.db import models
from django.db.models import Q

from apps.auditoria.models import RegistroInmutableError
from apps.ventas.models import Venta

MENSAJE_INMUTABLE = (
    'El contenido de un comprobante no puede modificarse ni eliminarse; '
    'solo puede cambiar su estado (por ejemplo, a anulado).'
)


class ComprobanteQuerySet(models.QuerySet):
    def update(self, **kwargs):
        if set(kwargs) - {'estado'}:
            raise RegistroInmutableError(MENSAJE_INMUTABLE)
        return super().update(**kwargs)

    def bulk_update(self, objs, fields, batch_size=None):
        raise RegistroInmutableError(MENSAJE_INMUTABLE)

    def delete(self):
        raise RegistroInmutableError(MENSAJE_INMUTABLE)


class Comprobante(models.Model):
    class Estado(models.TextChoices):
        EMITIDO = 'emitido', 'Emitido'
        ANULADO = 'anulado', 'Anulado'

    venta = models.OneToOneField(Venta, on_delete=models.PROTECT, related_name='comprobante')
    numero = models.PositiveIntegerField(unique=True)
    fecha_emision = models.DateTimeField(auto_now_add=True)
    estado = models.CharField(max_length=20, default=Estado.EMITIDO, editable=False)
    contenido = models.JSONField(default=dict, editable=False)

    objects = ComprobanteQuerySet.as_manager()

    class Meta:
        ordering = ('-fecha_emision',)
        constraints = [
            models.CheckConstraint(
                condition=Q(estado__in=('emitido', 'anulado')),
                name='comprobante_estado_valido',
            ),
        ]

    @property
    def numero_formateado(self):
        return f'{self.numero:08d}'

    def __str__(self):
        return f'Comprobante N° {self.numero_formateado}'

    def save(self, *args, **kwargs):
        if not self._state.adding:
            campos = kwargs.get('update_fields')
            if campos is None or set(campos) - {'estado'}:
                raise RegistroInmutableError(MENSAJE_INMUTABLE)
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise RegistroInmutableError(MENSAJE_INMUTABLE)


class ContadorComprobante(models.Model):
    """Una sola fila que lleva el último número emitido; se bloquea al numerar."""

    clave = models.CharField(max_length=30, unique=True, default='comprobante')
    ultimo_numero = models.PositiveIntegerField(default=0)

    class Meta:
        verbose_name = 'Contador de comprobantes'
        verbose_name_plural = 'Contadores de comprobantes'

    def __str__(self):
        return f'{self.clave}: {self.ultimo_numero}'
