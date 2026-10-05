from django.db import DatabaseError, connection, transaction
from django.test import TestCase
from rest_framework.test import APIClient

from apps.usuarios.models import Rol, Usuario

from .models import Auditoria, RegistroInmutableError
from .services import registrar


class RegistroDeAuditoriaTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.usuario = Usuario.objects.create_user(
            username='admin', password='clave-de-prueba-123',
            rol=Rol.objects.get(nombre='Administrador'),
        )

    def _nuevo_registro(self):
        return registrar(
            usuario=self.usuario,
            accion=Auditoria.Accion.USUARIO_CREADO,
            entidad='Usuario',
            id_registro=7,
            detalle={'username': 'cajera1'},
        )

    def test_registrar_guarda_quien_que_y_cuando(self):
        registro = self._nuevo_registro()
        registro.refresh_from_db()
        self.assertEqual(registro.usuario, self.usuario)
        self.assertEqual(registro.accion, 'usuario_creado')
        self.assertEqual(registro.entidad, 'Usuario')
        self.assertEqual(registro.id_registro_afectado, 7)
        self.assertEqual(registro.detalle, {'username': 'cajera1'})
        self.assertIsNotNone(registro.fecha_hora)

    def test_no_se_puede_modificar_un_registro(self):
        registro = self._nuevo_registro()
        registro.entidad = 'Otra'
        with self.assertRaises(RegistroInmutableError):
            registro.save()

    def test_no_se_puede_borrar_un_registro(self):
        registro = self._nuevo_registro()
        with self.assertRaises(RegistroInmutableError):
            registro.delete()
        self.assertTrue(Auditoria.objects.filter(pk=registro.pk).exists())

    def test_no_se_pueden_modificar_ni_borrar_en_masa(self):
        self._nuevo_registro()
        with self.assertRaises(RegistroInmutableError):
            Auditoria.objects.update(entidad='Otra')
        with self.assertRaises(RegistroInmutableError):
            Auditoria.objects.all().delete()
        self.assertEqual(Auditoria.objects.filter(entidad='Usuario').count(), 1)

    def test_la_base_de_datos_rechaza_update_delete_y_truncate(self):
        if connection.vendor != 'postgresql':
            self.skipTest('Los triggers de protección son propios de PostgreSQL.')
        registro = self._nuevo_registro()
        sentencias = (
            f"UPDATE auditoria_auditoria SET entidad = 'Otra' WHERE id = {registro.pk}",
            f'DELETE FROM auditoria_auditoria WHERE id = {registro.pk}',
            'TRUNCATE auditoria_auditoria',
        )
        for sql in sentencias:
            with self.subTest(sql=sql):
                with self.assertRaises(DatabaseError):
                    with transaction.atomic(), connection.cursor() as cursor:
                        cursor.execute(sql)
        registro.refresh_from_db()
        self.assertEqual(registro.entidad, 'Usuario')


class ConsultaDeAuditoriaApiTests(TestCase):
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
        registrar(usuario=cls.admin, accion='usuario_creado', entidad='Usuario', id_registro=1)
        registrar(usuario=cls.admin, accion='usuario_desactivado', entidad='Usuario', id_registro=1)
        registrar(usuario=cls.cajero, accion='venta_confirmada', entidad='Venta', id_registro=9)

    def setUp(self):
        self.cliente = APIClient()
        self.cliente.force_authenticate(user=self.admin)

    def _listar(self, **params):
        return self.cliente.get('/api/auditoria/', params)

    def test_lista_paginada_y_la_mas_reciente_primero(self):
        respuesta = self._listar()
        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.data['count'], 3)
        self.assertEqual(respuesta.data['results'][0]['accion'], 'venta_confirmada')
        self.assertEqual(respuesta.data['results'][0]['usuario_username'], 'cajero')

    def test_filtra_por_entidad_accion_usuario_y_registro(self):
        self.assertEqual(self._listar(entidad='Venta').data['count'], 1)
        self.assertEqual(self._listar(accion='usuario_creado').data['count'], 1)
        self.assertEqual(self._listar(usuario=self.admin.pk).data['count'], 2)
        self.assertEqual(self._listar(entidad='Usuario', registro=1).data['count'], 2)

    def test_filtra_por_fechas(self):
        self.assertEqual(self._listar(desde='2000-01-01', hasta='2999-12-31').data['count'], 3)
        self.assertEqual(self._listar(desde='2999-01-01').data['count'], 0)

    def test_parametros_invalidos_devuelven_400(self):
        self.assertEqual(self._listar(usuario='abc').status_code, 400)
        self.assertEqual(self._listar(desde='ayer').status_code, 400)
        self.assertEqual(self._listar(hasta='2026-13-45').status_code, 400)

    def test_solo_el_administrador_consulta(self):
        cliente = APIClient()
        cliente.force_authenticate(user=self.cajero)
        self.assertEqual(cliente.get('/api/auditoria/').status_code, 403)
        self.assertEqual(APIClient().get('/api/auditoria/').status_code, 401)

    def test_la_api_no_permite_crear_modificar_ni_borrar(self):
        registro = Auditoria.objects.first()
        self.assertEqual(self.cliente.post('/api/auditoria/', {}, format='json').status_code, 405)
        ruta = f'/api/auditoria/{registro.pk}/'
        self.assertEqual(self.cliente.patch(ruta, {}, format='json').status_code, 405)
        self.assertEqual(self.cliente.put(ruta, {}, format='json').status_code, 405)
        self.assertEqual(self.cliente.delete(ruta).status_code, 405)