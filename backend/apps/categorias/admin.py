from django.contrib import admin

from .models import Categoria


@admin.register(Categoria) # decorador para registrar el modelo en el panel de administración
class CategoriaAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'descripcion', 'activa', 'creado_en')
    list_filter = ('activa',) # Permite filtrar las categorías por su estado (activa o inactiva) en el panel de administración.
    search_fields = ('nombre',) # Permite buscar categorías por su nombre en el panel de administración.
    ordering = ('nombre',) # Define el orden predeterminado de las categorías en el panel de administración, en este caso, por nombre.