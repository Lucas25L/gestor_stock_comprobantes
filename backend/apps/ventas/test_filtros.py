from datetime import timedelta
from decimal import Decimal

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.categorias.models import Categoria
from apps.mediospago.models import MedioPago
from apps.productos.models import Producto
from apps.unidades.models import UnidadMedida
from apps.usuarios.models import Rol, Usuario

from .models import Venta

URL = '/api/ventas/'


def filas(respuesta):
    datos = respuesta.data
    return datos['results'] if isinstance(datos, dict) else datos


class FiltrosDeVentasTests(TestCase):
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
        categoria = Categoria.objects.create(nombre='Almacén')
        cls.efectivo = MedioPago.objects.get(nombre='Efectivo')
        cls.transferencia, _ = MedioPago.objects.get_or_create(nombre='Transferencia')
        cls.gaseosa = Producto.objects.create(
            nombre='Gaseosa', precio=Decimal('1500.00'), stock=Decimal('100'),
            categoria=categoria, unidad=UnidadMedida.objects.get(abreviatura='u'),
        )
        cls.pan = Producto.objects.create(
            nombre='Pan', precio=Decimal('2000.00'), stock=Decimal('100.000'),
            categoria=categoria, unidad=UnidadMedida.objects.get(abreviatura='kg'),
        )

    def _vender(self, usuario, medio, *items):
        self.cliente.force_authenticate(user=usuario)
        cuerpo = {
            'medio_pago': medio.pk,
            'items': [{'producto': p.pk, 'cantidad': c} for p, c in items],
        }
        respuesta = self.cliente.post(URL, cuerpo, format='json')
        self.assertEqual(respuesta.status_code, 201, respuesta.data)
        return respuesta.data['id']

    def setUp(self):
        self.cliente = APIClient()
        # v1 = 3000 (cajero, efectivo) | v2 = 2000 (admin, transferencia)
        # v3 = 3500 (cajero, transferencia) | v4 = 1500 (cajero, efectivo, anulada)
        self.v1 = self._vender(self.cajero, self.efectivo, (self.gaseosa, '2'))
        self.v2 = self._vender(self.admin, self.transferencia, (self.pan, '1'))
        self.v3 = self._vender(self.cajero, self.transferencia, (self.gaseosa, '1'), (self.pan, '1'))
        self.v4 = self._vender(self.cajero, self.efectivo, (self.gaseosa, '1'))
        self.cliente.force_authenticate(user=self.cajero)
        anulacion = self.cliente.post(
            f'{URL}{self.v4}/anular/', {'motivo': 'Error de carga'}, format='json'
        )
        self.assertEqual(anulacion.status_code, 200, anulacion.data)

    def _ids(self, **params):
        respuesta = self.cliente.get(URL, params)
        self.assertEqual(respuesta.status_code, 200, respuesta.data)
        return [fila['id'] for fila in filas(respuesta)]

    def test_filtro_por_usuario(self):
        self.assertCountEqual(self._ids(usuario=self.cajero.pk), [self.v1, self.v3])
        self.assertCountEqual(self._ids(usuario=self.admin.pk), [self.v2])

    def test_filtro_por_medio_de_pago(self):
        self.assertCountEqual(self._ids(medio_pago=self.transferencia.pk), [self.v2, self.v3])
        self.assertCountEqual(self._ids(medio_pago=self.efectivo.pk), [self.v1])

    def test_rango_de_total_incluye_los_extremos(self):
        self.assertCountEqual(self._ids(total_min='3000'), [self.v1, self.v3])
        self.assertCountEqual(self._ids(total_max='2500'), [self.v2])
        self.assertCountEqual(self._ids(total_min='2000', total_max='3000'), [self.v1, self.v2])

    def test_rango_de_fechas_por_dia_calendario(self):
        hoy = timezone.localdate()
        Venta.objects.filter(pk=self.v1).update(fecha=timezone.now() - timedelta(days=10))
        ayer = (hoy - timedelta(days=1)).isoformat()
        manana = (hoy + timedelta(days=1)).isoformat()
        self.assertEqual(self._ids(hasta=ayer), [self.v1])
        self.assertCountEqual(self._ids(desde=hoy.isoformat()), [self.v2, self.v3])
        self.assertCountEqual(
            self._ids(desde=hoy.isoformat(), hasta=hoy.isoformat()), [self.v2, self.v3]
        )
        self.assertEqual(
            self._ids(desde=(hoy - timedelta(days=11)).isoformat(),
                      hasta=(hoy - timedelta(days=9)).isoformat()),
            [self.v1],
        )
        self.assertEqual(self._ids(desde=manana), [])

    def test_las_anuladas_se_ven_solo_con_incluir_inactivas(self):
        self.assertEqual(self._ids(activa='false'), [])
        self.assertEqual(self._ids(activa='false', incluir_inactivas='true'), [self.v4])
        self.assertCountEqual(
            self._ids(incluir_inactivas='true'), [self.v1, self.v2, self.v3, self.v4]
        )

    def test_busqueda_por_producto_vendido_no_duplica_ventas(self):
        # 'a' coincide con Gaseosa y con Pan: la venta v3 tiene ambos y debe salir una sola vez.
        resultado = self._ids(search='a')
        self.assertEqual(len(resultado), len(set(resultado)))
        self.assertCountEqual(resultado, [self.v1, self.v2, self.v3])
        self.assertCountEqual(self._ids(search='Pan'), [self.v2, self.v3])

    def test_busqueda_por_motivo_de_anulacion(self):
        self.assertEqual(self._ids(search='error', incluir_inactivas='true'), [self.v4])
        self.assertEqual(self._ids(search='error'), [])

    def test_orden_por_total(self):
        self.assertEqual(self._ids(ordering='-total'), [self.v3, self.v1, self.v2])
        self.assertEqual(self._ids(ordering='total'), [self.v2, self.v1, self.v3])

    def test_valores_invalidos_devuelven_400(self):
        invalidos = (
            {'total_min': 'abc'}, {'total_max': 'abc'}, {'desde': '2026-13-45'},
            {'hasta': 'ayer'}, {'usuario': '999999'}, {'medio_pago': '999999'},
        )
        for parametros in invalidos:
            with self.subTest(parametros=parametros):
                self.assertEqual(self.cliente.get(URL, parametros).status_code, 400)

    def test_el_repositor_no_puede_consultar_ventas(self):
        self.cliente.force_authenticate(user=self.repositor)
        self.assertEqual(self.cliente.get(URL, {'total_min': '1'}).status_code, 403)
