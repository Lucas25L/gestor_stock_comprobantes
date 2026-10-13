from datetime import timedelta

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.usuarios.models import Rol, Usuario

from .models import Auditoria
from .services import registrar

URL = '/api/auditoria/'


def filas(respuesta):
    datos = respuesta.data
    return datos['results'] if isinstance(datos, dict) else datos


class FiltrosDeAuditoriaTests(TestCase):
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
        registrar(usuario=cls.admin, accion=Auditoria.Accion.USUARIO_CREADO,
                  entidad='Usuario', id_registro=7, detalle={'username': 'cajera1'})
        registrar(usuario=cls.admin, accion=Auditoria.Accion.INGRESO_STOCK,
                  entidad='Producto', id_registro=3, detalle={})
        registrar(usuario=cls.cajero, accion=Auditoria.Accion.VENTA_REGISTRADA,
                  entidad='Venta', id_registro=11, detalle={})
        registrar(usuario=cls.cajero, accion=Auditoria.Accion.VENTA_ANULADA,
                  entidad='Venta', id_registro=11, detalle={})

    def setUp(self):
        self.cliente = APIClient()
        self.cliente.force_authenticate(user=self.admin)

    def _acciones(self, **params):
        respuesta = self.cliente.get(URL, params)
        self.assertEqual(respuesta.status_code, 200, respuesta.data)
        return [fila['accion'] for fila in filas(respuesta)]

    def test_el_listado_esta_paginado(self):
        respuesta = self.cliente.get(URL)
        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.data['count'], 4)

    def test_filtro_por_entidad_y_accion(self):
        self.assertCountEqual(self._acciones(entidad='Venta'), ['venta_registrada', 'venta_anulada'])
        self.assertEqual(self._acciones(accion='venta_anulada'), ['venta_anulada'])
        self.assertEqual(self._acciones(entidad='Venta', accion='venta_registrada'), ['venta_registrada'])

    def test_una_accion_inexistente_devuelve_lista_vacia(self):
        self.assertEqual(self._acciones(accion='no_existe'), [])

    def test_filtro_por_usuario_y_por_registro_afectado(self):
        self.assertCountEqual(
            self._acciones(usuario=self.cajero.pk), ['venta_registrada', 'venta_anulada']
        )
        self.assertCountEqual(
            self._acciones(registro=11), ['venta_registrada', 'venta_anulada']
        )
        self.assertEqual(self._acciones(registro=7), ['usuario_creado'])

    def test_rango_de_fechas(self):
        hoy = timezone.localdate()
        ayer = (hoy - timedelta(days=1)).isoformat()
        manana = (hoy + timedelta(days=1)).isoformat()
        self.assertEqual(len(self._acciones(desde=hoy.isoformat(), hasta=hoy.isoformat())), 4)
        self.assertEqual(self._acciones(desde=manana), [])
        self.assertEqual(self._acciones(hasta=ayer), [])

    def test_busqueda_por_entidad_y_accion(self):
        self.assertEqual(self._acciones(search='anulada'), ['venta_anulada'])
        self.assertCountEqual(self._acciones(search='Venta'), ['venta_registrada', 'venta_anulada'])

    def test_orden_por_accion(self):
        self.assertEqual(
            self._acciones(ordering='accion'),
            ['ingreso_stock', 'usuario_creado', 'venta_anulada', 'venta_registrada'],
        )

    def test_valores_invalidos_devuelven_400(self):
        invalidos = ({'usuario': 'abc'}, {'registro': 'abc'}, {'desde': '2026-13-45'}, {'hasta': 'ayer'})
        for parametros in invalidos:
            with self.subTest(parametros=parametros):
                self.assertEqual(self.cliente.get(URL, parametros).status_code, 400)

    def test_solo_el_administrador_puede_consultar_la_auditoria(self):
        for usuario in (self.cajero, self.repositor):
            with self.subTest(rol=usuario.username):
                self.cliente.force_authenticate(user=usuario)
                self.assertEqual(self.cliente.get(URL, {'entidad': 'Venta'}).status_code, 403)
        self.assertEqual(APIClient().get(URL).status_code, 401)
