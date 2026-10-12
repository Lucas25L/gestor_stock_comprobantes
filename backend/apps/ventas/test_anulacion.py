from decimal import Decimal
from unittest import mock

from django.db import DatabaseError, IntegrityError, transaction
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.auditoria.models import Auditoria
from apps.categorias.models import Categoria
from apps.comprobantes.models import Comprobante
from apps.mediospago.models import MedioPago
from apps.productos.models import Producto
from apps.stock.models import MovimientoStock
from apps.unidades.models import UnidadMedida
from apps.usuarios.models import Rol, Usuario

from .models import Venta


class AnulacionDeVentasTests(TestCase):
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
        cls.gaseosa = Producto.objects.create(
            nombre='Gaseosa', precio=Decimal('1500.00'), stock=Decimal('10'),
            categoria=categoria, unidad=UnidadMedida.objects.get(abreviatura='u'),
        )
        cls.pan = Producto.objects.create(
            nombre='Pan', precio=Decimal('2000.00'), stock=Decimal('5.000'),
            categoria=categoria, unidad=UnidadMedida.objects.get(abreviatura='kg'),
        )

    def setUp(self):
        self.cliente = APIClient()
        self.cliente.force_authenticate(user=self.cajero)

    def _vender(self, *items):
        cuerpo = {
            'medio_pago': self.efectivo.pk,
            'items': [{'producto': p.pk, 'cantidad': c} for p, c in items],
        }
        respuesta = self.cliente.post('/api/ventas/', cuerpo, format='json')
        self.assertEqual(respuesta.status_code, 201, respuesta.data)
        return respuesta.data['id']

    def _anular(self, venta_id, motivo='Error de carga'):
        return self.cliente.post(f'/api/ventas/{venta_id}/anular/', {'motivo': motivo}, format='json')

    def test_anular_repone_el_stock_y_deja_movimientos(self):
        venta_id = self._vender((self.gaseosa, '3'), (self.pan, '1.250'))
        respuesta = self._anular(venta_id)
        self.assertEqual(respuesta.status_code, 200, respuesta.data)

        self.gaseosa.refresh_from_db()
        self.pan.refresh_from_db()
        self.assertEqual(self.gaseosa.stock, Decimal('10'))
        self.assertEqual(self.pan.stock, Decimal('5.000'))

        reposiciones = MovimientoStock.objects.filter(tipo=MovimientoStock.Tipo.ANULACION_VENTA)
        self.assertEqual(reposiciones.count(), 2)
        for movimiento in reposiciones:
            self.assertEqual(movimiento.referencia_origen, f'venta:{venta_id}')
            self.assertEqual(movimiento.usuario, self.cajero)
            self.assertGreater(movimiento.cantidad, 0)
        # La misma referencia permite ver la venta y su anulación juntas.
        self.assertEqual(MovimientoStock.objects.filter(referencia_origen=f'venta:{venta_id}').count(), 4)

    def test_la_venta_queda_anulada_con_motivo_responsable_y_fecha(self):
        venta_id = self._vender((self.gaseosa, '1'))
        respuesta = self._anular(venta_id, '  Cliente se arrepintió  ')
        self.assertEqual(respuesta.data['estado'], 'anulada')
        self.assertFalse(respuesta.data['activa'])
        self.assertEqual(respuesta.data['motivo_anulacion'], 'Cliente se arrepintió')
        self.assertEqual(respuesta.data['anulada_por_username'], 'cajero')
        self.assertIsNotNone(respuesta.data['fecha_anulacion'])

        venta = Venta.objects.get(pk=venta_id)
        self.assertEqual(venta.anulada_por, self.cajero)

    def test_la_anulacion_queda_auditada(self):
        venta_id = self._vender((self.gaseosa, '2'))
        self._anular(venta_id, 'Precio mal cargado')
        registro = Auditoria.objects.get(accion=Auditoria.Accion.VENTA_ANULADA)
        self.assertEqual(registro.usuario, self.cajero)
        self.assertEqual(registro.entidad, 'Venta')
        self.assertEqual(registro.id_registro_afectado, venta_id)
        self.assertEqual(registro.detalle['motivo'], 'Precio mal cargado')
        self.assertEqual(registro.detalle['total'], '3000.00')

    def test_el_motivo_es_obligatorio(self):
        venta_id = self._vender((self.gaseosa, '1'))
        for cuerpo in ({}, {'motivo': ''}, {'motivo': '   '}):
            with self.subTest(cuerpo=cuerpo):
                respuesta = self.cliente.post(f'/api/ventas/{venta_id}/anular/', cuerpo, format='json')
                self.assertEqual(respuesta.status_code, 400)
                self.assertIn('motivo', respuesta.data)
        self.assertTrue(Venta.objects.get(pk=venta_id).activa)
        self.gaseosa.refresh_from_db()
        self.assertEqual(self.gaseosa.stock, Decimal('9'))

    def test_no_se_puede_anular_dos_veces_ni_reponer_dos_veces(self):
        venta_id = self._vender((self.gaseosa, '4'))
        self.assertEqual(self._anular(venta_id).status_code, 200)
        respuesta = self._anular(venta_id)
        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('ya está anulada', respuesta.data['detail'])
        self.gaseosa.refresh_from_db()
        self.assertEqual(self.gaseosa.stock, Decimal('10'))
        self.assertEqual(
            MovimientoStock.objects.filter(tipo=MovimientoStock.Tipo.ANULACION_VENTA).count(), 1
        )

    def test_venta_inexistente_devuelve_404(self):
        self.assertEqual(self._anular(999999).status_code, 404)

    def test_la_venta_anulada_se_conserva_en_el_historial(self):
        venta_id = self._vender((self.gaseosa, '1'))
        self._anular(venta_id)

        detalle = self.cliente.get(f'/api/ventas/{venta_id}/')
        self.assertEqual(detalle.status_code, 200)
        self.assertEqual(detalle.data['estado'], 'anulada')

        ids = [v['id'] for v in self.cliente.get('/api/ventas/').data]
        self.assertNotIn(venta_id, ids)
        ids = [v['id'] for v in self.cliente.get('/api/ventas/?incluir_inactivas=true').data]
        self.assertIn(venta_id, ids)

    def test_una_venta_no_se_puede_borrar_por_la_api(self):
        venta_id = self._vender((self.gaseosa, '1'))
        self.assertEqual(self.cliente.delete(f'/api/ventas/{venta_id}/').status_code, 405)
        self.assertTrue(Venta.objects.get(pk=venta_id).activa)

    def test_el_administrador_y_el_cajero_anulan_pero_el_repositor_no(self):
        venta_id = self._vender((self.gaseosa, '1'))
        self.cliente.force_authenticate(user=self.repositor)
        self.assertEqual(self._anular(venta_id).status_code, 403)
        self.assertTrue(Venta.objects.get(pk=venta_id).activa)

        self.cliente.force_authenticate(user=self.admin)
        self.assertEqual(self._anular(venta_id).status_code, 200)

    def test_el_comprobante_de_una_venta_anulada_pasa_a_anulado(self):
        venta_id = self._vender((self.gaseosa, '1'))
        comprobante = Comprobante.objects.create(venta_id=venta_id, numero=1)
        self.assertEqual(comprobante.estado, 'emitido')
        self._anular(venta_id)
        comprobante.refresh_from_db()
        self.assertEqual(comprobante.estado, 'anulado')

    def test_anular_repone_el_stock_aunque_el_producto_se_haya_desactivado_despues(self):
        venta_id = self._vender((self.gaseosa, '3'))
        Producto.objects.filter(pk=self.gaseosa.pk).update(activo=False)
        self.assertEqual(self._anular(venta_id).status_code, 200)
        self.gaseosa.refresh_from_db()
        self.assertEqual(self.gaseosa.stock, Decimal('10'))

    def test_si_falla_la_auditoria_la_venta_sigue_vigente_y_sin_reponer(self):
        venta_id = self._vender((self.gaseosa, '3'))
        with mock.patch('apps.ventas.services.registrar', side_effect=DatabaseError('falla simulada')):
            with self.assertRaises(DatabaseError):
                self._anular(venta_id)
        self.assertTrue(Venta.objects.get(pk=venta_id).activa)
        self.gaseosa.refresh_from_db()
        self.assertEqual(self.gaseosa.stock, Decimal('7'))
        self.assertFalse(
            MovimientoStock.objects.filter(tipo=MovimientoStock.Tipo.ANULACION_VENTA).exists()
        )

    def test_la_base_exige_motivo_responsable_y_fecha_en_una_venta_anulada(self):
        venta_id = self._vender((self.gaseosa, '1'))
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                Venta.objects.filter(pk=venta_id).update(activa=False)
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                Venta.objects.filter(pk=venta_id).update(
                    activa=False, motivo_anulacion='x', fecha_anulacion=timezone.now()
                )
        Venta.objects.filter(pk=venta_id).update(
            activa=False, motivo_anulacion='x', anulada_por=self.admin, fecha_anulacion=timezone.now()
        )
        self.assertFalse(Venta.objects.get(pk=venta_id).activa)
