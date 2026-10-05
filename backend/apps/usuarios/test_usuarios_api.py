from django.test import TestCase
from rest_framework.test import APIClient

from .models import Rol, Usuario

CLAVE = 'clave-de-prueba-123'
CLAVE_NUEVA = 'Contrasena-Segura-2026'


class GestionDeUsuariosApiTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.rol_admin = Rol.objects.get(nombre='Administrador')
        cls.rol_cajero = Rol.objects.get(nombre='Cajero')
        cls.rol_repositor = Rol.objects.get(nombre='Repositor')
        cls.admin = Usuario.objects.create_user(
            username='admin', password=CLAVE, rol=cls.rol_admin
        )

    def setUp(self):
        self.cliente = APIClient()
        self.cliente.force_authenticate(user=self.admin)

    def _datos(self, **extra):
        datos = {'username': 'cajera1', 'password': CLAVE_NUEVA, 'rol': self.rol_cajero.pk}
        datos.update(extra)
        return datos

    def _crear(self, **extra):
        respuesta = self.cliente.post('/api/usuarios/', self._datos(**extra), format='json')
        self.assertEqual(respuesta.status_code, 201, respuesta.data)
        return respuesta.data

    def _login(self, username, password):
        return APIClient().post(
            '/api/token/', {'username': username, 'password': password}, format='json'
        )

    def test_crear_usuario_guarda_hash_y_no_expone_la_clave(self):
        creado = self._crear()
        self.assertNotIn('password', creado)
        self.assertEqual(creado['rol_nombre'], 'Cajero')
        usuario = Usuario.objects.get(username='cajera1')
        self.assertTrue(usuario.check_password(CLAVE_NUEVA))
        self.assertNotEqual(usuario.password, CLAVE_NUEVA)

    def test_crear_exige_contrasena(self):
        datos = self._datos()
        del datos['password']
        respuesta = self.cliente.post('/api/usuarios/', datos, format='json')
        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('password', respuesta.data)

    def test_rechaza_contrasena_debil(self):
        respuesta = self.cliente.post('/api/usuarios/', self._datos(password='123'), format='json')
        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('password', respuesta.data)

    def test_rechaza_nombre_de_usuario_repetido(self):
        self._crear()
        respuesta = self.cliente.post('/api/usuarios/', self._datos(), format='json')
        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('username', respuesta.data)

    def test_rechaza_rol_inexistente(self):
        respuesta = self.cliente.post('/api/usuarios/', self._datos(rol=999999), format='json')
        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('rol', respuesta.data)

    def test_modificar_el_rol_de_un_usuario(self):
        creado = self._crear()
        respuesta = self.cliente.patch(
            f"/api/usuarios/{creado['id']}/", {'rol': self.rol_repositor.pk}, format='json'
        )
        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.data['rol_nombre'], 'Repositor')

    def test_modificar_la_contrasena_guarda_el_nuevo_hash(self):
        creado = self._crear()
        respuesta = self.cliente.patch(
            f"/api/usuarios/{creado['id']}/", {'password': 'Otra-Clave-Segura-77'}, format='json'
        )
        self.assertEqual(respuesta.status_code, 200)
        usuario = Usuario.objects.get(pk=creado['id'])
        self.assertTrue(usuario.check_password('Otra-Clave-Segura-77'))

    def test_no_se_puede_borrar_un_usuario(self):
        creado = self._crear()
        respuesta = self.cliente.delete(f"/api/usuarios/{creado['id']}/")
        self.assertEqual(respuesta.status_code, 405)

    def test_no_se_puede_desactivar_al_ultimo_administrador(self):
        respuesta = self.cliente.post(f'/api/usuarios/{self.admin.pk}/desactivar/')
        self.assertEqual(respuesta.status_code, 400)
        self.admin.refresh_from_db()
        self.assertTrue(self.admin.is_active)

    def test_no_se_puede_quitar_el_rol_al_ultimo_administrador(self):
        respuesta = self.cliente.patch(
            f'/api/usuarios/{self.admin.pk}/', {'rol': self.rol_cajero.pk}, format='json'
        )
        self.assertEqual(respuesta.status_code, 400)
        self.admin.refresh_from_db()
        self.assertEqual(self.admin.rol, self.rol_admin)

    def test_con_otro_administrador_activo_si_se_puede_desactivar(self):
        otro = Usuario.objects.create_user(username='admin2', password=CLAVE, rol=self.rol_admin)
        respuesta = self.cliente.post(f'/api/usuarios/{otro.pk}/desactivar/')
        self.assertEqual(respuesta.status_code, 200)
        self.assertFalse(respuesta.data['is_active'])

    def test_usuario_desactivado_no_inicia_sesion_y_al_activarlo_si(self):
        creado = self._crear()
        self.assertEqual(self._login('cajera1', CLAVE_NUEVA).status_code, 200)

        self.cliente.post(f"/api/usuarios/{creado['id']}/desactivar/")
        self.assertEqual(self._login('cajera1', CLAVE_NUEVA).status_code, 401)

        self.cliente.post(f"/api/usuarios/{creado['id']}/activar/")
        self.assertEqual(self._login('cajera1', CLAVE_NUEVA).status_code, 200)

    def test_el_listado_de_roles_muestra_los_tres(self):
        respuesta = self.cliente.get('/api/roles/')
        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(
            [r['nombre'] for r in respuesta.data],
            ['Administrador', 'Cajero', 'Repositor'],
        )

    def test_desactivar_corta_el_acceso_y_la_renovacion_de_sesion(self):
        creado = self._crear()
        cliente_cajera = APIClient()
        login = cliente_cajera.post(
            '/api/token/', {'username': 'cajera1', 'password': CLAVE_NUEVA}, format='json'
        )
        access = login.data['access']

        self.cliente.post(f"/api/usuarios/{creado['id']}/desactivar/")

        renovacion = cliente_cajera.post('/api/token/refresh/', {}, format='json')
        self.assertEqual(renovacion.status_code, 401)

        cliente_cajera.credentials(HTTP_AUTHORIZATION=f'Bearer {access}')
        self.assertEqual(cliente_cajera.get('/api/categorias/').status_code, 401)