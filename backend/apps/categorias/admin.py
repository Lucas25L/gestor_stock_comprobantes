from django.contrib import admin

from .models import Categoria


@admin.register(Categoria)
class CategoriaAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'descripcion', 'activa', 'creado_en')
    list_filter = ('activa',)
    search_fields = ('nombre',)
    ordering = ('nombre',)