from django.conf import settings
from django.db import models

MENSAJE_INMUTABLE = 'Los registros de auditoría no pueden modificarse ni eliminarse.'


class RegistroInmutableError(Exception):
    """Se intentó modificar o eliminar un registro de auditoría."""


class AuditoriaQuerySet(models.QuerySet):
    """Bloquea las operaciones masivas que modificarían o borrarían registros."""

    def update(self, **kwargs):
        raise RegistroInmutableError(MENSAJE_INMUTABLE)

    def bulk_update(self, objs, fields, batch_size=None):
        raise RegistroInmutableError(MENSAJE_INMUTABLE)

    def delete(self):
        raise RegistroInmutableError(MENSAJE_INMUTABLE)


class Auditoria(models.Model):
    class Accion(models.TextChoices):
        USUARIO_CREADO = 'usuario_creado', 'Usuario creado'
        USUARIO_MODIFICADO = 'usuario_modificado', 'Usuario modificado'
        USUARIO_ACTIVADO = 'usuario_activado', 'Usuario activado'
        USUARIO_DESACTIVADO = 'usuario_desactivado', 'Usuario desactivado'
        INGRESO_STOCK = 'ingreso_stock', 'Ingreso de stock'
        AJUSTE_STOCK = 'ajuste_stock', 'Ajuste de stock'
        VENTA_REGISTRADA = 'venta_registrada', 'Venta registrada'
        VENTA_ANULADA = 'venta_anulada', 'Venta anulada'
        COMPROBANTE_EMITIDO = 'comprobante_emitido', 'Comprobante emitido'

    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='auditorias',
    )
    accion = models.CharField(max_length=50, db_index=True)
    entidad = models.CharField(max_length=50)
    id_registro_afectado = models.PositiveBigIntegerField(null=True, blank=True)
    fecha_hora = models.DateTimeField(auto_now_add=True, db_index=True)
    detalle = models.JSONField(default=dict, blank=True)

    objects = AuditoriaQuerySet.as_manager()

    class Meta:
        verbose_name = 'Registro de auditoría'
        verbose_name_plural = 'Registros de auditoría'
        ordering = ('-fecha_hora', '-id')
        indexes = [models.Index(fields=['entidad', 'id_registro_afectado'])]

    def __str__(self):
        return f'{self.fecha_hora:%Y-%m-%d %H:%M:%S} {self.usuario} {self.accion}'

    def save(self, *args, **kwargs):
        if not self._state.adding:
            raise RegistroInmutableError(MENSAJE_INMUTABLE)
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise RegistroInmutableError(MENSAJE_INMUTABLE)
