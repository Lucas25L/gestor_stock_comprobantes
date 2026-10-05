from unittest import mock

from django.test import TestCase
from rest_framework.test import APIClient

from apps.auditoria.models import Auditoria

from .models import Rol, Usuario

CLAVE = 'clave-de-prueba-123'
CLAVE_NUEVA = 'Contrasena-Segura-2026'


class AuditoriaDeUsuariosTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.rol_cajero = Rol.objects.get(nombre='Cajero')
        cls.rol_repositor = Rol.objects.get(nombre='Repositor')
        cls.admin = Usuario.objects.create_user(
            username='admin', password=CLAVE, rol=Rol.objects.get(nombre='Administrador')
        )

    def setUp(self):
        self.cliente = APIClient()
        self.cliente.force_authenticate(user=self.admin)

    def _crear(self):
        respuesta = self.cliente.post(
            '/api/usuarios/',
            {'username': 'cajera1', 'password': CLAVE_NUEVA, 'rol': self.rol_cajero.pk},
            format='json',
        )
        self.assertEqual(respuesta.status_code, 201, respuesta.data)
        return respuesta.data

    def _registros(self, accion):
        return Auditoria.objects.filter(accion=accion)

    def test_crear_un_usuario_queda_registrado(self):
        creado = self._crear()
        registro = self._registros('usuario_creado').get()
        self.assertEqual(registro.usuario, self.admin)
        self.assertEqual(registro.entidad, 'Usuario')
        self.assertEqual(registro.id_registro_afectado, creado['id'])
        self.assertEqual(registro.detalle, {'username': 'cajera1', 'rol': 'Cajero'})

    def test_el_registro_nunca_contiene_la_contrasena_ni_su_hash(self):
        creado = self._crear()
        self.cliente.patch(
            f"/api/usuarios/{creado['id']}/", {'password': 'Otra-Clave-Segura-77'}, format='json'
        )
        hash_guardado = Usuario.objects.get(pk=creado['id']).password
        for registro in Auditoria.objects.all():
            texto = str(registro.detalle)
            self.assertNotIn(CLAVE_NUEVA, texto)
            self.assertNotIn('Otra-Clave-Segura-77', texto)
            self.assertNotIn(hash_guardado, texto)

    def test_cambio_de_rol_y_de_datos_queda_registrado_con_antes_y_despues(self):
        creado = self._crear()
        self.cliente.patch(
            f"/api/usuarios/{creado['id']}/",
            {'rol': self.rol_repositor.pk, 'email': 'nueva@ejemplo.com'},
            format='json',
        )
        registro = self._registros('usuario_modificado').get()
        cambios = registro.detalle['cambios']
        self.assertEqual(cambios['rol'], {'de': 'Cajero', 'a': 'Repositor'})
        self.assertEqual(cambios['email'], {'de': '', 'a': 'nueva@ejemplo.com'})
        self.assertEqual(registro.usuario, self.admin)

    def test_cambio_de_contrasena_registra_que_se_modifico_sin_el_valor(self):
        creado = self._crear()
        self.cliente.patch(
            f"/api/usuarios/{creado['id']}/", {'password': 'Otra-Clave-Segura-77'}, format='json'
        )
        registro = self._registros('usuario_modificado').get()
        self.assertEqual(registro.detalle['cambios'], {'password': 'modificada'})

    def test_una_modificacion_sin_cambios_no_genera_registro(self):
        creado = self._crear()
        self.cliente.patch(
            f"/api/usuarios/{creado['id']}/", {'username': 'cajera1'}, format='json'
        )
        self.assertFalse(self._registros('usuario_modificado').exists())

    def test_activar_y_desactivar_quedan_registrados_una_sola_vez_por_cambio(self):
        creado = self._crear()
        url = f"/api/usuarios/{creado['id']}"
        self.cliente.post(f'{url}/desactivar/')
        self.cliente.post(f'{url}/desactivar/')  # ya estaba desactivado: no cambia nada
        self.cliente.post(f'{url}/activar/')
        self.cliente.post(f'{url}/activar/')  # ya estaba activo: no cambia nada
        self.assertEqual(self._registros('usuario_desactivado').count(), 1)
        self.assertEqual(self._registros('usuario_activado').count(), 1)
        self.assertEqual(
            self._registros('usuario_desactivado').get().id_registro_afectado, creado['id']
        )

    def test_una_operacion_rechazada_no_deja_registro(self):
        self.cliente.post(
            '/api/usuarios/',
            {'username': 'x', 'password': '123', 'rol': self.rol_cajero.pk},
            format='json',
        )
        self.cliente.post(f'/api/usuarios/{self.admin.pk}/desactivar/')  # último administrador
        self.assertEqual(Auditoria.objects.count(), 0)

    def test_si_falla_el_registro_la_operacion_se_deshace(self):
        with mock.patch('apps.usuarios.views.registrar', side_effect=RuntimeError('falla')):
            with self.assertRaises(RuntimeError):
                self.cliente.post(
                    '/api/usuarios/',
                    {'username': 'cajera1', 'password': CLAVE_NUEVA, 'rol': self.rol_cajero.pk},
                    format='json',
                )
        self.assertFalse(Usuario.objects.filter(username='cajera1').exists())