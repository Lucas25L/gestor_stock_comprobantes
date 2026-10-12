from django.test import TestCase
from rest_framework.test import APIClient

from apps.usuarios.models import Rol, Usuario

from .models import MedioPago


class MediosDePagoApiTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        def crear(nombre):
            return Usuario.objects.create_user(
                username=nombre.lower(), password='clave-de-prueba-123',
                rol=Rol.objects.get(nombre=nombre),
            )

        cls.admin = crear('Administrador')
        cls.cajero = crear('Cajero')
        cls.repositor = crear('Repositor')

    def setUp(self):
        self.cliente = APIClient()
        self.cliente.force_authenticate(user=self.admin)

    def test_los_medios_iniciales_estan_cargados_y_activos(self):
        nombres = set(MedioPago.objects.filter(activo=True).values_list('nombre', flat=True))
        self.assertEqual(
            nombres,
            {'Efectivo', 'Tarjeta de débito', 'Tarjeta de crédito', 'Transferencia', 'Billetera virtual'},
        )

    def test_el_administrador_crea_un_medio_de_pago(self):
        respuesta = self.cliente.post('/api/medios-pago/', {'nombre': 'Cheque'}, format='json')
        self.assertEqual(respuesta.status_code, 201, respuesta.data)
        self.assertTrue(respuesta.data['activo'])

    def test_rechaza_nombre_repetido_sin_distinguir_mayusculas(self):
        respuesta = self.cliente.post('/api/medios-pago/', {'nombre': 'EFECTIVO'}, format='json')
        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('nombre', respuesta.data)

    def test_el_cajero_consulta_pero_no_modifica(self):
        self.cliente.force_authenticate(user=self.cajero)
        self.assertEqual(self.cliente.get('/api/medios-pago/').status_code, 200)
        self.assertEqual(
            self.cliente.post('/api/medios-pago/', {'nombre': 'Cheque'}, format='json').status_code, 403
        )

    def test_el_repositor_no_accede(self):
        self.cliente.force_authenticate(user=self.repositor)
        self.assertEqual(self.cliente.get('/api/medios-pago/').status_code, 403)

    def test_la_baja_es_logica_y_se_puede_reactivar(self):
        medio = MedioPago.objects.get(nombre='Transferencia')
        self.assertEqual(self.cliente.delete(f'/api/medios-pago/{medio.pk}/').status_code, 204)
        medio.refresh_from_db()
        self.assertFalse(medio.activo)

        ids = [m['id'] for m in self.cliente.get('/api/medios-pago/').data]
        self.assertNotIn(medio.pk, ids)
        ids = [m['id'] for m in self.cliente.get('/api/medios-pago/?incluir_inactivos=true').data]
        self.assertIn(medio.pk, ids)

        self.assertEqual(self.cliente.post(f'/api/medios-pago/{medio.pk}/reactivar/').status_code, 200)
        medio.refresh_from_db()
        self.assertTrue(medio.activo)

    def test_activo_no_se_modifica_por_patch(self):
        medio = MedioPago.objects.get(nombre='Efectivo')
        self.cliente.patch(f'/api/medios-pago/{medio.pk}/', {'activo': False}, format='json')
        medio.refresh_from_db()
        self.assertTrue(medio.activo)
