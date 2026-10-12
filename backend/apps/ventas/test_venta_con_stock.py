from decimal import Decimal
from unittest import mock

from django.db import DatabaseError
from django.test import TestCase
from rest_framework.test import APIClient

from apps.auditoria.models import Auditoria
from apps.categorias.models import Categoria
from apps.mediospago.models import MedioPago
from apps.productos.models import Producto
from apps.stock.models import MovimientoStock
from apps.unidades.models import UnidadMedida
from apps.usuarios.models import Rol, Usuario

from .models import DetalleVenta, Venta


class VentaConServicioDeStockTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.cajero = Usuario.objects.create_user(
            username='cajero', password='clave-de-prueba-123',
            rol=Rol.objects.get(nombre='Cajero'),
        )
        categoria = Categoria.objects.create(nombre='Almacén')
        cls.efectivo = MedioPago.objects.get(nombre='Efectivo')
        cls.por_unidad = UnidadMedida.objects.get(abreviatura='u')
        cls.por_kilo = UnidadMedida.objects.get(abreviatura='kg')
        cls.gaseosa = Producto.objects.create(
            nombre='Gaseosa', precio=Decimal('1500.00'), stock=Decimal('10'),
            categoria=categoria, unidad=cls.por_unidad,
        )
        cls.pan = Producto.objects.create(
            nombre='Pan', precio=Decimal('2000.00'), stock=Decimal('5.000'),
            categoria=categoria, unidad=cls.por_kilo,
        )

    def setUp(self):
        self.cliente = APIClient()
        self.cliente.force_authenticate(user=self.cajero)

    def _vender(self, *items):
        cuerpo = {
            'medio_pago': self.efectivo.pk,
            'items': [{'producto': p.pk, 'cantidad': c} for p, c in items],
        }
        return self.cliente.post('/api/ventas/', cuerpo, format='json')

    def test_la_venta_deja_un_movimiento_de_stock_por_producto(self):
        respuesta = self._vender((self.gaseosa, '3'), (self.pan, '1.250'))
        self.assertEqual(respuesta.status_code, 201, respuesta.data)
        venta = Venta.objects.get()

        movimientos = MovimientoStock.objects.order_by('producto_id')
        self.assertEqual(movimientos.count(), 2)
        for movimiento in movimientos:
            self.assertEqual(movimiento.tipo, MovimientoStock.Tipo.VENTA)
            self.assertEqual(movimiento.referencia_origen, f'venta:{venta.pk}')
            self.assertEqual(movimiento.usuario, self.cajero)
        por_producto = {m.producto_id: m for m in movimientos}
        self.assertEqual(por_producto[self.gaseosa.pk].cantidad, Decimal('-3'))
        self.assertEqual(por_producto[self.gaseosa.pk].stock_resultante, Decimal('7'))
        self.assertEqual(por_producto[self.pan.pk].cantidad, Decimal('-1.250'))
        self.assertEqual(por_producto[self.pan.pk].stock_resultante, Decimal('3.750'))

    def test_la_venta_queda_auditada(self):
        respuesta = self._vender((self.gaseosa, '2'))
        registro = Auditoria.objects.get(accion=Auditoria.Accion.VENTA_REGISTRADA)
        self.assertEqual(registro.usuario, self.cajero)
        self.assertEqual(registro.entidad, 'Venta')
        self.assertEqual(registro.id_registro_afectado, respuesta.data['id'])
        self.assertEqual(registro.detalle['total'], '3000.00')
        self.assertEqual(registro.detalle['medio_pago'], 'Efectivo')

    def test_un_producto_repetido_en_la_venta_se_suma_antes_de_validar_el_stock(self):
        respuesta = self._vender((self.gaseosa, '6'), (self.gaseosa, '6'))
        self.assertEqual(respuesta.status_code, 400)
        self.gaseosa.refresh_from_db()
        self.assertEqual(self.gaseosa.stock, Decimal('10'))
        self.assertFalse(Venta.objects.exists())
        self.assertFalse(MovimientoStock.objects.exists())

        respuesta = self._vender((self.gaseosa, '4'), (self.gaseosa, '4'))
        self.assertEqual(respuesta.status_code, 201, respuesta.data)
        self.gaseosa.refresh_from_db()
        self.assertEqual(self.gaseosa.stock, Decimal('2'))
        self.assertEqual(DetalleVenta.objects.count(), 2)
        self.assertEqual(MovimientoStock.objects.count(), 1)

    def test_si_falla_una_linea_no_se_descuenta_nada_ni_queda_venta(self):
        respuesta = self._vender((self.gaseosa, '2'), (self.pan, '9'))
        self.assertEqual(respuesta.status_code, 400)
        self.gaseosa.refresh_from_db()
        self.assertEqual(self.gaseosa.stock, Decimal('10'))
        self.assertFalse(Venta.objects.exists())
        self.assertFalse(MovimientoStock.objects.exists())
        self.assertFalse(Auditoria.objects.exists())

    def test_si_falla_la_auditoria_se_deshace_la_venta_completa(self):
        with mock.patch('apps.ventas.serializers.registrar', side_effect=DatabaseError('falla simulada')):
            with self.assertRaises(DatabaseError):
                self._vender((self.gaseosa, '2'))
        self.gaseosa.refresh_from_db()
        self.assertEqual(self.gaseosa.stock, Decimal('10'))
        self.assertFalse(Venta.objects.exists())
        self.assertFalse(MovimientoStock.objects.exists())

    def test_la_venta_conserva_el_precio_historico(self):
        self._vender((self.gaseosa, '1'))
        Producto.objects.filter(pk=self.gaseosa.pk).update(precio=Decimal('9999.00'))
        detalle = DetalleVenta.objects.get()
        self.assertEqual(detalle.precio_unitario, Decimal('1500.00'))
        self.assertEqual(detalle.subtotal, Decimal('1500.00'))

    # --- RN-10: productos desactivados ---
    def test_un_producto_desactivado_se_vende_mientras_tenga_stock(self):
        Producto.objects.filter(pk=self.gaseosa.pk).update(activo=False)
        respuesta = self._vender((self.gaseosa, '10'))
        self.assertEqual(respuesta.status_code, 201, respuesta.data)
        self.gaseosa.refresh_from_db()
        self.assertEqual(self.gaseosa.stock, Decimal('0'))

    def test_un_producto_desactivado_sin_stock_ya_no_se_vende(self):
        Producto.objects.filter(pk=self.gaseosa.pk).update(activo=False, stock=Decimal('1'))
        self.assertEqual(self._vender((self.gaseosa, '1')).status_code, 201)
        respuesta = self._vender((self.gaseosa, '1'))
        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('desactivado', str(respuesta.data))

    def test_un_producto_desactivado_no_puede_vender_mas_que_su_stock(self):
        Producto.objects.filter(pk=self.gaseosa.pk).update(activo=False, stock=Decimal('2'))
        respuesta = self._vender((self.gaseosa, '3'))
        self.assertEqual(respuesta.status_code, 400)
        self.gaseosa.refresh_from_db()
        self.assertEqual(self.gaseosa.stock, Decimal('2'))

    def test_el_stock_total_siempre_coincide_con_la_suma_de_movimientos(self):
        self._vender((self.gaseosa, '3'))
        self._vender((self.gaseosa, '2'), (self.pan, '0.500'))
        for producto, inicial in ((self.gaseosa, Decimal('10')), (self.pan, Decimal('5'))):
            producto.refresh_from_db()
            suma = sum(
                m.cantidad for m in MovimientoStock.objects.filter(producto=producto)
            )
            self.assertEqual(producto.stock, inicial + suma)
