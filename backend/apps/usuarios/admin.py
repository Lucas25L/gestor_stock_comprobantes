from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import Rol, Usuario


@admin.register(Rol)
class RolAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'descripcion', 'activo')


@admin.register(Usuario)
class UsuarioAdmin(UserAdmin):
    list_display = ('username', 'email', 'rol', 'is_active')
    list_filter = ('rol', 'is_active')
    fieldsets = UserAdmin.fieldsets + (('Rol en el sistema', {'fields': ('rol',)}),)
    add_fieldsets = UserAdmin.add_fieldsets + ((None, {'fields': ('rol',)}),)