from django.test import TestCase
from rest_framework.test import APIClient

from .models import Rol, Usuario

TODOS = {'Administrador', 'Cajero', 'Repositor'}
ADMIN = {'Administrador'}
ADMIN_Y_CAJERO = {'Administrador', 'Cajero'}

# (método HTTP, ruta, roles que deben poder pasar)
MATRIZ = [
    ('get', '/api/categorias/', TODOS),
    ('get', '/api/categorias/999999/', TODOS),
    ('post', '/api/categorias/', ADMIN),
    ('patch', '/api/categorias/999999/', ADMIN),
    ('delete', '/api/categorias/999999/', ADMIN),
    ('post', '/api/categorias/999999/reactivar/', ADMIN),
    ('get', '/api/productos/', TODOS),
    ('get', '/api/productos/999999/', TODOS),
    ('post', '/api/productos/', ADMIN),
    ('patch', '/api/productos/999999/', ADMIN),
    ('delete', '/api/productos/999999/', ADMIN),
    ('post', '/api/productos/999999/reactivar/', ADMIN),
    ('get', '/api/ventas/', ADMIN_Y_CAJERO),
    ('post', '/api/ventas/', ADMIN_Y_CAJERO),
    ('delete', '/api/ventas/999999/', ADMIN_Y_CAJERO),
    ('get', '/api/comprobantes/', ADMIN_Y_CAJERO),
    ('post', '/api/comprobantes/', ADMIN_Y_CAJERO),
    
    ('get', '/api/usuarios/', ADMIN),
    ('get', '/api/usuarios/999999/', ADMIN),
    ('post', '/api/usuarios/', ADMIN),
    ('patch', '/api/usuarios/999999/', ADMIN),
    ('post', '/api/usuarios/999999/activar/', ADMIN),
    ('post', '/api/usuarios/999999/desactivar/', ADMIN),
    ('get', '/api/roles/', ADMIN),
]


class MatrizDePermisosApiTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.usuarios = {
            nombre: Usuario.objects.create_user(
                username=nombre.lower(),
                password='clave-de-prueba-123',
                rol=Rol.objects.get(nombre=nombre),
            )
            for nombre in TODOS
        }

    def _pedir(self, usuario, metodo, ruta):
        cliente = APIClient()
        if usuario is not None:
            cliente.force_authenticate(user=usuario)
        return getattr(cliente, metodo)(ruta, {}, format='json')

    def test_matriz_de_permisos(self):
        for metodo, ruta, roles_permitidos in MATRIZ:
            for nombre, usuario in self.usuarios.items():
                with self.subTest(metodo=metodo, ruta=ruta, rol=nombre):
                    respuesta = self._pedir(usuario, metodo, ruta)
                    if nombre in roles_permitidos:
                        self.assertNotIn(respuesta.status_code, (401, 403))
                    else:
                        self.assertEqual(respuesta.status_code, 403)

    def test_sin_autenticar_recibe_401(self):
        for metodo, ruta, _ in MATRIZ:
            with self.subTest(metodo=metodo, ruta=ruta):
                self.assertEqual(self._pedir(None, metodo, ruta).status_code, 401)