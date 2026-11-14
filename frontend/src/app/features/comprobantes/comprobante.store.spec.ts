import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { Comprobante } from '../../core/api/modelos';
import { ComprobanteStore } from './comprobante.store';

function comprobante(datos: Partial<Comprobante> = {}): Comprobante {
    return {
        id: 1,
        venta: 10,
        numero: 1,
        numero_formateado: '00000001',
        fecha_emision: '2026-11-14T15:00:00-03:00',
        estado: 'emitido',
        contenido: {
            venta_id: 10,
            fecha_venta: '2026-11-14T14:59:00-03:00',
            registrada_por: 'Maria-Sosa-Lopez',
            medio_pago: 'Efectivo',
            lineas: [
                { producto: 'Facturas', unidad: 'u', cantidad: '2.000', precio_unitario: '500.00', subtotal: '1000.00' },
            ],
            impuestos_nacionales: '173.55',
            total: '1000.00',
        },
        ...datos,
    };
}

describe('ComprobanteStore', () => {
    const url = (id: number) => `${environment.apiUrl}/comprobantes/${id}/`;

    let store: ComprobanteStore;
    let http: HttpTestingController;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [provideHttpClient(), provideHttpClientTesting(), ComprobanteStore],
        });
        store = TestBed.inject(ComprobanteStore);
        http = TestBed.inject(HttpTestingController);
    });

    afterEach(() => http.verify());

    it('arranca vacío, sin cargar y sin error', () => {
        expect(store.comprobante()).toBeNull();
        expect(store.cargando()).toBe(false);
        expect(store.errorCarga()).toBeNull();
    });

    it('carga el comprobante por id', () => {
        store.cargar(1);
        expect(store.cargando()).toBe(true);

        http.expectOne(url(1)).flush(comprobante());

        expect(store.cargando()).toBe(false);
        expect(store.comprobante()?.numero_formateado).toBe('00000001');
    });

    it('conserva el estado anulado que informa el servidor', () => {
        store.cargar(1);
        http.expectOne(url(1)).flush(comprobante({ estado: 'anulado' }));

        expect(store.comprobante()?.estado).toBe('anulado');
    });

    it('si falla, informa el error y no deja comprobante', () => {
        store.cargar(99);
        http.expectOne(url(99)).flush({ detail: 'No encontrado.' }, { status: 404, statusText: 'Not Found' });

        expect(store.cargando()).toBe(false);
        expect(store.comprobante()).toBeNull();
        expect(store.errorCarga()).not.toBeNull();
    });

    it('al cargar otro id cancela la carga anterior y vacía el comprobante en pantalla', () => {
        store.cargar(1);
        http.expectOne(url(1)).flush(comprobante());

        store.cargar(2);
        expect(store.comprobante()).toBeNull();

        store.cargar(3);
        const segunda = http.expectOne(url(2));
        expect(segunda.cancelled).toBe(true);
        http.expectOne(url(3)).flush(comprobante({ id: 3, numero: 3, numero_formateado: '00000003' }));

        expect(store.comprobante()?.id).toBe(3);
    });
});
