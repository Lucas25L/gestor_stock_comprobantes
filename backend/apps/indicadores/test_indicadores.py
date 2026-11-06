from datetime import datetime
from decimal import Decimal

from django.db.models import Sum
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.categorias.models import Categoria
from apps.mediospago.models import MedioPago
from apps.productos.models import Producto
from apps.unidades.models import UnidadMedida
from apps.usuarios.models import Rol, Usuario
from apps.ventas.models import Venta

URL_VENTAS = '/api/ventas/'
URL = '/api/indicadores/'
RUTAS = ('resumen/', 'por-medio-pago/', 'productos-mas-vendidos/', 'categorias-mas-vendidas/')


def local(anio, mes, dia, hora=12, minuto=0):
    """Fecha y hora en la zona horaria del proyecto (Buenos Aires)."""
    return timezone.make_aware(datetime(anio, mes, dia, hora, minuto))


class IndicadoresTests(TestCase):
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
        almacen = Categoria.objects.create(nombre='Almacén')
        panaderia = Categoria.objects.create(nombre='Panadería')
        cls.efectivo = MedioPago.objects.get(nombre='Efectivo')
        cls.transferencia, _ = MedioPago.objects.get_or_create(nombre='Transferencia')
        cls.unidad = UnidadMedida.objects.get(abreviatura='u')
        cls.kilo = UnidadMedida.objects.get(abreviatura='kg')
        cls.gaseosa = Producto.objects.create(
            nombre='Gaseosa', precio=Decimal('1500.00'), stock=Decimal('100'),
            categoria=almacen, unidad=cls.unidad,
        )
        cls.pan = Producto.objects.create(
            nombre='Pan', precio=Decimal('2000.00'), stock=Decimal('100.000'),
            categoria=panaderia, unidad=cls.kilo,
        )

    def _vender(self, usuario, medio, *items):
        self.cliente.force_authenticate(user=usuario)
        cuerpo = {
            'medio_pago': medio.pk,
            'items': [{'producto': p.pk, 'cantidad': c} for p, c in items],
        }
        respuesta = self.cliente.post(URL_VENTAS, cuerpo, format='json')
        self.assertEqual(respuesta.status_code, 201, respuesta.data)
        return respuesta.data['id']

    def setUp(self):
        self.cliente = APIClient()
        self.v1 = self._vender(self.cajero, self.efectivo, (self.gaseosa, '2'))
        self.v2 = self._vender(self.admin, self.transferencia, (self.pan, '1'))
        self.v3 = self._vender(self.cajero, self.transferencia, (self.gaseosa, '1'), (self.pan, '1'))
        self.v4 = self._vender(self.cajero, self.efectivo, (self.gaseosa, '1'))
        self.cliente.force_authenticate(user=self.cajero)
        anulacion = self.cliente.post(
            f'{URL_VENTAS}{self.v4}/anular/', {'motivo': 'Error de carga'}, format='json'
        )
        self.assertEqual(anulacion.status_code, 200, anulacion.data)
        # Fechas fijas. v3 es el 31/10 a las 23:30 locales (ya es 1/11 en UTC).
        fechas = {
            self.v1: local(2026, 10, 10, 10),
            self.v2: local(2026, 10, 20, 15),
            self.v3: local(2026, 10, 31, 23, 30),
            self.v4: local(2026, 10, 20, 9),
        }
        for pk, fecha in fechas.items():
            Venta.objects.filter(pk=pk).update(fecha=fecha)

    def _obtener(self, ruta, **params):
        self.cliente.force_authenticate(user=self.admin)
        respuesta = self.cliente.get(URL + ruta, params)
        self.assertEqual(respuesta.status_code, 200, respuesta.data)
        return respuesta.data

    # --- Permisos ---------------------------------------------------------

    def test_solo_el_administrador_consulta_indicadores(self):
        esperado = ((self.admin, 200), (self.cajero, 403), (self.repositor, 403), (None, 401))
        for ruta in RUTAS:
            for usuario, codigo in esperado:
                with self.subTest(ruta=ruta, usuario=getattr(usuario, 'username', 'anonimo')):
                    self.cliente.force_authenticate(user=usuario)
                    self.assertEqual(self.cliente.get(URL + ruta).status_code, codigo)

    # --- Resumen (RF-43) --------------------------------------------------

    def test_resumen_excluye_las_ventas_anuladas(self):
        datos = self._obtener('resumen/')
        self.assertEqual(datos['cantidad_ventas'], 3)
        self.assertEqual(Decimal(datos['total_vendido']), Decimal('8500.00'))
        self.assertEqual(Decimal(datos['ticket_promedio']), Decimal('2833.33'))
        impuestos = Venta.objects.filter(
            pk__in=[self.v1, self.v2, self.v3]
        ).aggregate(t=Sum('impuestos_nacionales'))['t']
        self.assertEqual(Decimal(datos['impuestos_nacionales']), impuestos)

    def test_resumen_incluye_el_ultimo_dia_en_hora_local(self):
        datos = self._obtener('resumen/', desde='2026-10-15', hasta='2026-10-31')
        self.assertEqual(datos['cantidad_ventas'], 2)  # v2 y v3 (23:30 local del 31/10)
        self.assertEqual(Decimal(datos['total_vendido']), Decimal('5500.00'))

    def test_resumen_solo_con_desde(self):
        datos = self._obtener('resumen/', desde='2026-10-20')
        self.assertEqual(datos['cantidad_ventas'], 2)
        self.assertEqual(Decimal(datos['total_vendido']), Decimal('5500.00'))

    def test_resumen_solo_con_hasta(self):
        datos = self._obtener('resumen/', hasta='2026-10-10')
        self.assertEqual(datos['cantidad_ventas'], 1)
        self.assertEqual(Decimal(datos['total_vendido']), Decimal('3000.00'))

    def test_resumen_de_un_periodo_sin_ventas(self):
        datos = self._obtener('resumen/', desde='2026-10-11', hasta='2026-10-19')
        self.assertEqual(datos['cantidad_ventas'], 0)
        for campo in ('total_vendido', 'impuestos_nacionales', 'ticket_promedio'):
            self.assertEqual(Decimal(datos[campo]), Decimal('0.00'), campo)

    # --- Por medio de pago (RF-44) ---------------------------------------

    def test_por_medio_pago(self):
        datos = self._obtener('por-medio-pago/')
        self.assertEqual(
            [fila['nombre'] for fila in datos],
            [self.transferencia.nombre, self.efectivo.nombre],
        )
        self.assertEqual([fila['cantidad_ventas'] for fila in datos], [2, 1])
        self.assertEqual(
            [Decimal(fila['total']) for fila in datos], [Decimal('5500'), Decimal('3000')]
        )
        self.assertEqual(
            [Decimal(fila['porcentaje']) for fila in datos], [Decimal('64.71'), Decimal('35.29')]
        )

    def test_por_medio_pago_respeta_el_periodo(self):
        datos = self._obtener('por-medio-pago/', desde='2026-10-01', hasta='2026-10-15')
        self.assertEqual(len(datos), 1)
        self.assertEqual(datos[0]['nombre'], self.efectivo.nombre)
        self.assertEqual(Decimal(datos[0]['porcentaje']), Decimal('100.00'))

    # --- Productos más vendidos (RF-45) ----------------------------------

    def test_productos_mas_vendidos_con_su_unidad(self):
        datos = self._obtener('productos-mas-vendidos/')
        self.assertEqual([fila['nombre'] for fila in datos], ['Gaseosa', 'Pan'])
        # La Gaseosa anulada (1 unidad) no cuenta: serían 4 si se colara.
        self.assertEqual(
            [Decimal(fila['cantidad_vendida']) for fila in datos], [Decimal('3'), Decimal('2')]
        )
        self.assertEqual([fila['unidad'] for fila in datos], ['u', 'kg'])
        self.assertEqual([fila['permite_decimales'] for fila in datos], [False, True])
        self.assertEqual(
            [Decimal(fila['importe']) for fila in datos], [Decimal('4500'), Decimal('4000')]
        )

    def test_productos_mas_vendidos_filtra_por_unidad(self):
        datos = self._obtener('productos-mas-vendidos/', unidad=self.kilo.pk)
        self.assertEqual([fila['nombre'] for fila in datos], ['Pan'])

    def test_productos_mas_vendidos_respeta_el_limite(self):
        datos = self._obtener('productos-mas-vendidos/', limite=1)
        self.assertEqual([fila['nombre'] for fila in datos], ['Gaseosa'])

    # --- Categorías más vendidas (RF-46) ---------------------------------

    def test_categorias_mas_vendidas(self):
        datos = self._obtener('categorias-mas-vendidas/')
        self.assertEqual([fila['nombre'] for fila in datos], ['Almacén', 'Panadería'])
        self.assertEqual(
            [Decimal(fila['importe']) for fila in datos], [Decimal('4500'), Decimal('4000')]
        )
        self.assertEqual(
            [Decimal(fila['porcentaje']) for fila in datos], [Decimal('52.94'), Decimal('47.06')]
        )

    def test_categorias_con_limite_conservan_el_porcentaje_sobre_el_total(self):
        datos = self._obtener('categorias-mas-vendidas/', limite=1)
        self.assertEqual(len(datos), 1)
        self.assertEqual(Decimal(datos[0]['porcentaje']), Decimal('52.94'))

    # --- Períodos vacíos y parámetros inválidos --------------------------

    def test_rankings_vacios_en_un_periodo_sin_ventas(self):
        periodo = {'desde': '2026-10-11', 'hasta': '2026-10-19'}
        for ruta in RUTAS[1:]:
            with self.subTest(ruta=ruta):
                self.assertEqual(self._obtener(ruta, **periodo), [])

    def test_periodo_invertido_informa_el_error_en_hasta(self):
        self.cliente.force_authenticate(user=self.admin)
        respuesta = self.cliente.get(URL + 'resumen/', {'desde': '2026-10-31', 'hasta': '2026-10-01'})
        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('hasta', respuesta.data)

    def test_parametros_invalidos_devuelven_400(self):
        casos = (
            ('resumen/', {'desde': 'hola'}),
            ('por-medio-pago/', {'hasta': '31/10/2026'}),
            ('productos-mas-vendidos/', {'limite': 0}),
            ('productos-mas-vendidos/', {'limite': 51}),
            ('productos-mas-vendidos/', {'limite': 'abc'}),
            ('productos-mas-vendidos/', {'unidad': 9999}),
            ('categorias-mas-vendidas/', {'limite': 0}),
        )
        self.cliente.force_authenticate(user=self.admin)
        for ruta, params in casos:
            with self.subTest(ruta=ruta, params=params):
                self.assertEqual(self.cliente.get(URL + ruta, params).status_code, 400)
