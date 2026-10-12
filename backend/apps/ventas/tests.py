from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIClient

from apps.categorias.models import Categoria
from apps.mediospago.models import MedioPago
from apps.productos.models import Producto
from apps.unidades.models import UnidadMedida
from apps.usuarios.models import Rol, Usuario

from .models import DetalleVenta, Venta


class VentasConCantidadesDecimalesTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.cajero = Usuario.objects.create_user(
            username='cajero', password='clave-de-prueba-123',
            rol=Rol.objects.get(nombre='Cajero'),
        )
        categoria = Categoria.objects.create(nombre='Panadería')
        cls.efectivo = MedioPago.objects.get(nombre='Efectivo')
        cls.kilo = UnidadMedida.objects.get(abreviatura='kg')
        cls.unidad = UnidadMedida.objects.get(abreviatura='u')
        cls.pan = Producto.objects.create(
            nombre='Pan', precio=Decimal('1000.00'), stock=Decimal('5.000'),
            categoria=categoria, unidad=cls.kilo,
        )
        cls.alfajor = Producto.objects.create(
            nombre='Alfajor', precio=Decimal('500.00'), stock=Decimal('10'),
            categoria=categoria, unidad=cls.unidad,
        )

    def setUp(self):
        self.cliente = APIClient()
        self.cliente.force_authenticate(user=self.cajero)

    def _vender(self, *items, medio_pago=None):
        cuerpo = {
            'medio_pago': (medio_pago or self.efectivo).pk,
            'items': [{'producto': p.pk, 'cantidad': c} for p, c in items],
        }
        return self.cliente.post('/api/ventas/', cuerpo, format='json')

    def test_venta_por_peso_descuenta_el_stock_decimal_y_calcula_el_subtotal(self):
        respuesta = self._vender((self.pan, '1.250'))
        self.assertEqual(respuesta.status_code, 201, respuesta.data)
        self.pan.refresh_from_db()
        self.assertEqual(self.pan.stock, Decimal('3.750'))
        detalle = DetalleVenta.objects.get()
        self.assertEqual(detalle.cantidad, Decimal('1.250'))
        self.assertEqual(detalle.subtotal, Decimal('1250.00'))
        self.assertEqual(Venta.objects.get().total, Decimal('1250.00'))

    def test_el_subtotal_se_redondea_a_centavos_y_el_total_suma_los_subtotales(self):
        Producto.objects.filter(pk=self.pan.pk).update(precio=Decimal('333.33'))
        respuesta = self._vender((self.pan, '0.333'), (self.alfajor, '2'))
        self.assertEqual(respuesta.status_code, 201, respuesta.data)
        subtotales = sorted(d.subtotal for d in DetalleVenta.objects.all())
        self.assertEqual(subtotales, [Decimal('111.00'), Decimal('1000.00')])
        self.assertEqual(Venta.objects.get().total, Decimal('1111.00'))

    def test_producto_por_unidad_rechaza_cantidades_decimales(self):
        respuesta = self._vender((self.alfajor, '1.5'))
        self.assertEqual(respuesta.status_code, 400)
        self.assertEqual(Venta.objects.count(), 0)

    def test_stock_insuficiente_bloquea_la_venta_y_no_cambia_el_stock(self):
        respuesta = self._vender((self.pan, '5.001'))
        self.assertEqual(respuesta.status_code, 400)
        self.pan.refresh_from_db()
        self.assertEqual(self.pan.stock, Decimal('5.000'))
        self.assertEqual(Venta.objects.count(), 0)

    def test_rechaza_cantidades_en_cero_o_negativas(self):
        self.assertEqual(self._vender((self.pan, '0')).status_code, 400)
        self.assertEqual(self._vender((self.pan, '-1')).status_code, 400)

    def test_la_venta_registra_el_medio_de_pago(self):
        tarjeta = MedioPago.objects.get(nombre='Tarjeta de débito')
        respuesta = self._vender((self.alfajor, '1'), medio_pago=tarjeta)
        self.assertEqual(respuesta.status_code, 201, respuesta.data)
        self.assertEqual(respuesta.data['medio_pago'], tarjeta.pk)
        self.assertEqual(respuesta.data['medio_pago_nombre'], 'Tarjeta de débito')
        self.assertEqual(Venta.objects.get().medio_pago, tarjeta)

    def test_el_medio_de_pago_es_obligatorio(self):
        cuerpo = {'items': [{'producto': self.alfajor.pk, 'cantidad': '1'}]}
        respuesta = self.cliente.post('/api/ventas/', cuerpo, format='json')
        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('medio_pago', respuesta.data)
        self.assertEqual(Venta.objects.count(), 0)

    def test_no_se_puede_vender_con_un_medio_de_pago_desactivado(self):
        MedioPago.objects.filter(pk=self.efectivo.pk).update(activo=False)
        respuesta = self._vender((self.alfajor, '1'))
        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('medio_pago', respuesta.data)
        self.alfajor.refresh_from_db()
        self.assertEqual(self.alfajor.stock, Decimal('10'))
