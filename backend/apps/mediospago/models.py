from django.db import models


class MedioPago(models.Model):
    nombre = models.CharField(max_length=50, unique=True)
    descripcion = models.CharField(max_length=255, blank=True)
    activo = models.BooleanField(default=True)  # No eliminamos, solo desactivamos

    class Meta:
        verbose_name = 'Medio de pago'
        verbose_name_plural = 'Medios de pago'
        ordering = ('nombre',)

    def __str__(self):
        return self.nombre
