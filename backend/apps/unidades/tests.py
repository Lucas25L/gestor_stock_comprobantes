from django.test import TestCase
from rest_framework.test import APIClient

from apps.usuarios.models import Rol, Usuario

from .models import UnidadMedida


class UnidadesDeMedidaApiTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.admin = Usuario.objects.create_user(
            username='admin', password='clave-de-prueba-123',
            rol=Rol.objects.get(nombre='Administrador'),
        )
        cls.cajero = Usuario.objects.create_user(
            username='cajero', password='clave-de-prueba-123',
            rol=Rol.objects.get(nombre='Cajero'),
        )

    def setUp(self):
        self.cliente = APIClient()
        self.cliente.force_authenticate(user=self.admin)

    def _crear(self, nombre='Pack', abreviatura='pk'):
        return self.cliente.post(
            '/api/unidades/', {'nombre': nombre, 'abreviatura': abreviatura}, format='json'
        )

    def test_las_unidades_iniciales_estan_cargadas_y_activas(self):
        iniciales = set(UnidadMedida.objects.filter(activo=True).values_list('abreviatura', flat=True))
        self.assertEqual(iniciales, {'u', 'kg', 'l'})

    def test_el_administrador_crea_una_unidad(self):
        respuesta = self._crear()
        self.assertEqual(respuesta.status_code, 201, respuesta.data)
        self.assertTrue(respuesta.data['activo'])

    def test_rechaza_nombre_o_abreviatura_repetidos_sin_distinguir_mayusculas(self):
        self.assertEqual(self._crear('Pack', 'pk').status_code, 201)
        self.assertEqual(self._crear('PACK', 'otra').status_code, 400)
        self.assertEqual(self._crear('Otro', 'PK').status_code, 400)

    def test_modificar_una_unidad_no_choca_consigo_misma(self):
        creada = self._crear().data
        respuesta = self.cliente.patch(
            f"/api/unidades/{creada['id']}/", {'nombre': 'Pack', 'abreviatura': 'pk'}, format='json'
        )
        self.assertEqual(respuesta.status_code, 200, respuesta.data)

    def test_borrar_desactiva_sin_eliminar_y_se_puede_reactivar(self):
        creada = self._crear().data
        url = f"/api/unidades/{creada['id']}/"
        self.assertEqual(self.cliente.delete(url).status_code, 204)

        self.assertTrue(UnidadMedida.objects.filter(pk=creada['id'], activo=False).exists())
        ids_activas = [u['id'] for u in self.cliente.get('/api/unidades/').data]
        self.assertNotIn(creada['id'], ids_activas)
        ids_todas = [u['id'] for u in self.cliente.get('/api/unidades/', {'incluir_inactivas': 'true'}).data]
        self.assertIn(creada['id'], ids_todas)

        respuesta = self.cliente.post(f'{url}reactivar/')
        self.assertEqual(respuesta.status_code, 200)
        self.assertTrue(respuesta.data['activo'])

    def test_cualquier_rol_consulta_pero_solo_el_administrador_modifica(self):
        cliente = APIClient()
        cliente.force_authenticate(user=self.cajero)
        self.assertEqual(cliente.get('/api/unidades/').status_code, 200)
        self.assertEqual(
            cliente.post('/api/unidades/', {'nombre': 'X', 'abreviatura': 'x'}, format='json').status_code,
            403,
        )