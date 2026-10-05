from types import SimpleNamespace

from django.contrib.auth.models import AnonymousUser
from django.test import TestCase

from .models import Rol, Usuario
from .permissions import EsAdministrador, EsCajero, EsRepositor

# TestCase de Django crea una base de datos temporal (test_sistema_comprobantes), le aplica todas las migraciones, ejecuta los tests y la borra al terminar.
class PermisosPorRolTests(TestCase):
    # setUpTestData arma un usuario por rol una sola vez para toda la clase.
    @classmethod
    def setUpTestData(cls):
        # Los tres roles ya existen: los carga la migración 0002_cargar_roles.
        cls.usuarios = {}
        for nombre in Rol.Nombre.values:
            cls.usuarios[nombre] = Usuario.objects.create_user(
                username=nombre.lower(),
                password='clave-de-prueba-123',
                rol=Rol.objects.get(nombre=nombre),
            )

    # _permite es un método auxiliar que simula una request con un usuario dado y evalúa si el permiso dado permite el acceso.
    def _permite(self, clase_permiso, usuario):
        request = SimpleNamespace(user=usuario)
        return clase_permiso().has_permission(request, None)

    def test_cada_rol_solo_pasa_por_su_permiso(self):
        permisos = {
            'Administrador': EsAdministrador,
            'Cajero': EsCajero,
            'Repositor': EsRepositor,
        }
        for nombre_usuario, usuario in self.usuarios.items():
            for nombre_rol, clase in permisos.items():
                with self.subTest(usuario=nombre_usuario, permiso=clase.__name__):
                    self.assertEqual(
                        self._permite(clase, usuario), nombre_usuario == nombre_rol
                    )

    def test_anonimo_nunca_tiene_permiso(self):
        for clase in (EsAdministrador, EsCajero, EsRepositor):
            with self.subTest(permiso=clase.__name__):
                self.assertFalse(self._permite(clase, AnonymousUser()))

    def test_usuario_desactivado_no_tiene_permiso(self):
        usuario = self.usuarios['Administrador']
        usuario.is_active = False
        self.assertFalse(self._permite(EsAdministrador, usuario))

    def test_rol_desactivado_no_da_permiso(self):
        usuario = self.usuarios['Administrador']
        Rol.objects.filter(pk=usuario.rol_id).update(activo=False)
        usuario = Usuario.objects.get(pk=usuario.pk)
        self.assertFalse(self._permite(EsAdministrador, usuario))

    def test_combinar_permisos_con_o(self):
        permiso = EsAdministrador | EsCajero
        resultado = {
            nombre: permiso().has_permission(SimpleNamespace(user=usuario), None)
            for nombre, usuario in self.usuarios.items()
        }
        self.assertEqual(
            resultado,
            {'Administrador': True, 'Cajero': True, 'Repositor': False},
        )