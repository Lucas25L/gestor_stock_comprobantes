from django.db import models
from django.db.models import Q

from apps.categorias.models import Categoria
from apps.unidades.models import UnidadMedida


class Producto(models.Model):
    nombre = models.CharField(max_length=150)
    descripcion = models.CharField(max_length=255, blank=True)
    precio = models.DecimalField(max_digits=10, decimal_places=2)  # precio por unidad de medida
    stock = models.DecimalField(max_digits=12, decimal_places=3, default=0)
    stock_minimo = models.DecimalField(max_digits=12, decimal_places=3, default=0)
    codigo_barras = models.CharField(max_length=50, blank=True, unique=True, null=True)
    categoria = models.ForeignKey(
        Categoria,
        on_delete=models.PROTECT,
        related_name='productos', # Para obtener productos de una categoría: categoria.productos.all()
    )
    unidad = models.ForeignKey(
        UnidadMedida,
        on_delete=models.PROTECT,
        related_name='productos',
    )
    activo = models.BooleanField(default=True)
    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ('nombre',)
        constraints = [
            models.CheckConstraint(condition=Q(stock__gte=0), name='producto_stock_no_negativo'),
            models.CheckConstraint(
                condition=Q(stock_minimo__gte=0), name='producto_stock_minimo_no_negativo'
            ),
        ]

    def __str__(self):
        return self.nombre
