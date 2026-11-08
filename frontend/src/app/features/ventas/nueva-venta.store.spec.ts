import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { Comprobante, MedioPago, Producto, Venta } from '../../core/api/modelos';
import { CarritoService } from './carrito.service';
import { NuevaVentaStore } from './nueva-venta.store';

function producto(datos: Partial<Producto>): Producto {
    return {
        id: 1,
        nombre: 'Gaseosa',
        descripcion: '',
        precio: '1500.00',
        stock: '100.000',
        stock_minimo: '0.000',
        codigo_barras: '7790001',
        categoria: 1,
        categoria_nombre: 'Almacén',
        unidad: 1,
        unidad_nombre: 'Unidad',
        unidad_abreviatura: 'u',
        unidad_permite_decimales: false,
        stock_bajo: false,
        faltante: '0.000',
        activo: true,
        creado_en: '',
        actualizado_en: '',
        ...datos,
    };
}

const gaseosa = producto({});
const pan = producto({
    id: 2,
    nombre: 'Pan',
    precio: '2000.00',
    codigo_barras: '7790002',
    unidad: 2,
    unidad_nombre: 'Kilogramo',
    unidad_abreviatura: 'kg',
    unidad_permite_decimales: true,
});
const cafe = producto({ id: 3, nombre: 'Café molido', codigo_barras: '7790999' });

const mediosPago: MedioPago[] = [
    { id: 1, nombre: 'Efectivo', descripcion: '', activo: true },
    { id: 2, nombre: 'Transferencia', descripcion: '', activo: true },
];

const venta = { id: 10, total: '3000.00', comprobante: null, comprobante_numero: null } as Venta;
const comprobante = {
    id: 20,
    venta: 10,
    numero: 1,
    numero_formateado: '00000001',
    estado: 'emitido',
} as Comprobante;

describe('NuevaVentaStore', () => {
    const PRODUCTOS = `${environment.apiUrl}/productos/`;
    const MEDIOS = `${environment.apiUrl}/medios-pago/`;
    const VENTAS = `${environment.apiUrl}/ventas/`;
    const COMPROBANTES = `${environment.apiUrl}/comprobantes/`;

    let store: NuevaVentaStore;
    let carrito: CarritoService;
    let http: HttpTestingController;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [NuevaVentaStore, CarritoService, provideHttpClient(), provideHttpClientTesting()],
        });
        store = TestBed.inject(NuevaVentaStore);
        carrito = TestBed.inject(CarritoService);
        http = TestBed.inject(HttpTestingController);
    });

    afterEach(() => http.verify());

    function cargar(): void {
        store.cargar();
        http.expectOne(PRODUCTOS).flush([gaseosa, pan, cafe]);
        http.expectOne(MEDIOS).flush(mediosPago);
    }

    function registrarVenta(): void {
        carrito.agregar(gaseosa, '2');
        store.seleccionarMedioPago(1);
        store.confirmar();
        http.expectOne(VENTAS).flush(venta);
        http.expectOne(PRODUCTOS).flush([gaseosa, pan, cafe]); // recarga del stock
    }

    it('carga los productos y los medios de pago', () => {
        expect(store.cargando()).toBe(false);
        store.cargar();
        expect(store.cargando()).toBe(true);

        http.expectOne(PRODUCTOS).flush([gaseosa, pan, cafe]);
        http.expectOne(MEDIOS).flush(mediosPago);

        expect(store.cargando()).toBe(false);
        expect(store.productos()).toHaveLength(3);
        expect(store.mediosPago().map((m) => m.nombre)).toEqual(['Efectivo', 'Transferencia']);
        expect(store.errorCarga()).toBeNull();
    });

    it('informa el error si no se pueden cargar los datos', () => {
        store.cargar();
        http.expectOne(MEDIOS).flush(mediosPago);
        http.expectOne(PRODUCTOS).flush('error', { status: 500, statusText: 'Server Error' });

        expect(store.cargando()).toBe(false);
        expect(store.errorCarga()).toContain('problema');
    });

    it('busca por nombre sin importar tildes ni mayúsculas, y por código de barras', () => {
        cargar();

        expect(store.buscar('CAFE').map((p) => p.nombre)).toEqual(['Café molido']);
        expect(store.buscar('pan').map((p) => p.nombre)).toEqual(['Pan']);
        expect(store.buscar('7790001').map((p) => p.nombre)).toEqual(['Gaseosa']);
        expect(store.buscar('   ')).toEqual([]);
        expect(store.buscar('zzz')).toEqual([]);
    });

    it('encuentra un producto solo por código de barras exacto', () => {
        cargar();

        expect(store.porCodigoBarras('7790002')?.nombre).toBe('Pan');
        expect(store.porCodigoBarras(' 7790002 ')?.nombre).toBe('Pan');
        expect(store.porCodigoBarras('7790')).toBeUndefined();
        expect(store.porCodigoBarras('')).toBeUndefined();
    });

    it('solo permite confirmar con productos, medio de pago y stock suficiente', () => {
        expect(store.puedeConfirmar()).toBe(false); // carrito vacío

        carrito.agregar(gaseosa, '2');
        expect(store.puedeConfirmar()).toBe(false); // falta el medio de pago

        store.seleccionarMedioPago(1);
        expect(store.puedeConfirmar()).toBe(true);

        carrito.cambiarCantidad(1, '101'); // el stock es 100
        expect(store.puedeConfirmar()).toBe(false);
    });

    it('registra la venta, vacía el carrito y recarga el stock', () => {
        carrito.agregar(gaseosa, '2');
        carrito.agregar(pan, '1.5');
        store.seleccionarMedioPago(2);
        store.confirmar();

        expect(store.confirmando()).toBe(true);
        const peticion = http.expectOne(VENTAS);
        expect(peticion.request.method).toBe('POST');
        expect(peticion.request.body).toEqual({
            medio_pago: 2,
            items: [
                { producto: 1, cantidad: '2' },
                { producto: 2, cantidad: '1.5' },
            ],
        });
        peticion.flush(venta);
        http.expectOne(PRODUCTOS).flush([gaseosa, pan, cafe]);

        expect(store.ventaRegistrada()).toEqual(venta);
        expect(store.confirmando()).toBe(false);
        expect(carrito.vacio()).toBe(true);
        expect(store.errorVenta()).toBeNull();
    });

    it('no envía la venta dos veces si se confirma de nuevo mientras espera', () => {
        carrito.agregar(gaseosa, '2');
        store.seleccionarMedioPago(1);

        store.confirmar();
        store.confirmar();

        http.expectOne(VENTAS).flush(venta); // expectOne falla si hubiera dos peticiones
        http.expectOne(PRODUCTOS).flush([gaseosa]);
    });

    it('muestra el mensaje del backend y conserva el carrito si la venta es rechazada', () => {
        carrito.agregar(gaseosa, '2');
        store.seleccionarMedioPago(1);
        store.confirmar();

        const mensaje = 'Stock insuficiente para "Gaseosa". Disponible: 1.000, solicitado: 2.000.';
        http.expectOne(VENTAS).flush({ items: [mensaje] }, { status: 400, statusText: 'Bad Request' });
        http.expectOne(PRODUCTOS).flush([gaseosa]);

        expect(store.errorVenta()).toBe(mensaje);
        expect(store.ventaRegistrada()).toBeNull();
        expect(carrito.vacio()).toBe(false);
        expect(store.confirmando()).toBe(false);
    });

    it('si no hay conexión, avisa que revise el historial antes de reintentar', () => {
        carrito.agregar(gaseosa, '2');
        store.seleccionarMedioPago(1);
        store.confirmar();

        http.expectOne(VENTAS).error(new ProgressEvent('error'));
        http.expectOne(PRODUCTOS).flush([gaseosa]);

        expect(store.errorVenta()).toContain('historial');
        expect(carrito.vacio()).toBe(false);
    });

    it('emite el comprobante de la venta registrada una sola vez', () => {
        registrarVenta();

        store.emitirComprobante();
        expect(store.emitiendo()).toBe(true);
        const peticion = http.expectOne(COMPROBANTES);
        expect(peticion.request.method).toBe('POST');
        expect(peticion.request.body).toEqual({ venta: 10 });
        peticion.flush(comprobante);

        expect(store.comprobante()).toEqual(comprobante);
        expect(store.emitiendo()).toBe(false);

        store.emitirComprobante(); // no hace nada: http.verify() falla si enviara otra petición
    });

    it('informa el error al emitir el comprobante y conserva la venta', () => {
        registrarVenta();

        store.emitirComprobante();
        http.expectOne(COMPROBANTES).flush(
            { venta: ['La venta #10 ya tiene un comprobante emitido.'] },
            { status: 400, statusText: 'Bad Request' },
        );

        expect(store.errorComprobante()).toBe('La venta #10 ya tiene un comprobante emitido.');
        expect(store.comprobante()).toBeNull();
        expect(store.ventaRegistrada()).toEqual(venta);
        expect(store.emitiendo()).toBe(false);
    });

    it('nuevaVenta deja la pantalla lista para otra venta', () => {
        registrarVenta();
        store.emitirComprobante();
        http.expectOne(COMPROBANTES).flush(comprobante);

        store.nuevaVenta();

        expect(store.ventaRegistrada()).toBeNull();
        expect(store.comprobante()).toBeNull();
        expect(store.medioPagoId()).toBeNull();
        expect(store.errorVenta()).toBeNull();
        expect(store.errorComprobante()).toBeNull();
        expect(carrito.vacio()).toBe(true);
    });
});
