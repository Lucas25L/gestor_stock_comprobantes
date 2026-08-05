from django.db import models

from apps.ventas.models import Venta


class Comprobante(models.Model):
    venta = models.OneToOneField(
        Venta,
        on_delete=models.PROTECT,
        related_name='comprobante',
    )
    numero = models.PositiveIntegerField(unique=True)
    fecha_emision = models.DateTimeField(auto_now_add=True)
    estado = models.CharField(max_length=20, default='emitido', editable=False)

    class Meta:
        ordering = ('-fecha_emision',)

    def __str__(self):
        return f'Comprobante N° {self.numero:08d}'