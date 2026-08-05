from django.contrib import admin

from .models import Producto


@admin.register(Producto)
class ProductoAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'categoria', 'precio', 'stock', 'activo')
    list_filter = ('activo', 'categoria')
    search_fields = ('nombre', 'codigo_barras')
    ordering = ('nombre',)
    autocomplete_fields = ('categoria',)