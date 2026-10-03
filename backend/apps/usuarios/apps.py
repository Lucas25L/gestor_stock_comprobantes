from django.apps import AppConfig


class UsuariosConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField' # define el tipo predeterminado para las pk
    name = 'apps.usuarios' # define el nombre de la aplicación, que se usará para referenciarla en otros lugares del proyecto
