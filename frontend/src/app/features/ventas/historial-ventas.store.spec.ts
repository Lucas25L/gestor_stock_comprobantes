import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { Comprobante, MedioPago, Venta } from '../../core/api/modelos';
import { HistorialVentasStore } from './historial-ventas.store';

function venta(datos: Partial<Venta>): Venta {
    return {
        id: 1,
        usuario: 1,
        usuario_username: 'cajero',
        medio_pago: 1,
        medio_pago_nombre: 'Efectivo',
        fecha: '2026-11-08T10:00:00-03:00',
        total: '3000.00',
        impuestos_nacionales: '520.66',
        activa: true,
        estado: 'confirmada',
        motivo_anulacion: '',
        anulada_por: null,
        anulada_por_username: null,
        fecha_anulacion: null,
        comprobante: null,
        comprobante_numero: null,
        detalles: [],
        ...datos,
    };
}

const v1 = venta({ id: 1, total: '3000.00' });
const v2 = venta({ id: 2, total: '2000.00' });
const v3 = venta({
    id: 3,
    total: '1500.00',
    activa: false,
    estado: 'anulada',
    motivo_anulacion: 'Error de carga',
});

const mediosPago: MedioPago[] = [{ id: 1, nombre: 'Efectivo', descripcion: '', activo: true }];

describe('HistorialVentasStore', () => {
    const VENTAS = `${environment.apiUrl}/ventas/`;
    const MEDIOS = `${environment.apiUrl}/medios-pago/`;
    const COMPROBANTES = `${environment.apiUrl}/comprobantes/`;
    const HOY = new Date(2026, 10, 8);

    let store: HistorialVentasStore;
    let http: HttpTestingController;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [HistorialVentasStore, provideHttpClient(), provideHttpClientTesting()],
        });
        store = TestBed.inject(HistorialVentasStore);
        http = TestBed.inject(HttpTestingController);
    });

    afterEach(() => http.verify());

    function iniciar(ventas: Venta[] = [v1, v2]): void {
        store.iniciar(HOY);
        http.expectOne(MEDIOS).flush(mediosPago);
        http.expectOne((r) => r.url === VENTAS).flush(ventas);
    }

    it('arranca en el día de hoy y carga las ventas y los medios de pago', () => {
        store.iniciar(HOY);
        expect(store.cargando()).toBe(true);

        http.expectOne(MEDIOS).flush(mediosPago);
        const peticion = http.expectOne((r) => r.url === VENTAS);
        expect(peticion.request.params.get('desde')).toBe('2026-11-08');
        expect(peticion.request.params.get('hasta')).toBe('2026-11-08');
        peticion.flush([v1, v2]);

        expect(store.cargando()).toBe(false);
        expect(store.ventas()).toHaveLength(2);
        expect(store.mediosPago()).toHaveLength(1);
    });

    it('envía solo los filtros informados, con los montos normalizados', () => {
        iniciar();
        store.actualizarFiltros({
            medioPago: 2,
            texto: '  pan ',
            totalMin: '1500,5',
            incluirAnuladas: true,
        });
        store.buscar();

        const params = http.expectOne((r) => r.url === VENTAS).request.params;
        expect(params.get('medio_pago')).toBe('2');
        expect(params.get('search')).toBe('pan');
        expect(params.get('total_min')).toBe('1500.5');
        expect(params.has('total_max')).toBe(false);
        expect(params.get('incluir_inactivas')).toBe('true');
    });

    it('aplica los atajos de período', () => {
        iniciar();
        store.aplicarRango('ultimos7', HOY);

        const params = http.expectOne((r) => r.url === VENTAS).request.params;
        expect(params.get('desde')).toBe('2026-11-02');
        expect(params.get('hasta')).toBe('2026-11-08');
    });

    it('no consulta si los filtros son inválidos y explica por qué', () => {
        iniciar();
        const casos: [Partial<Parameters<typeof store.actualizarFiltros>[0]>, string][] = [
            [{ desde: '' }, 'Elegí el período'],
            [{ desde: '2026-11-09', hasta: '2026-11-08' }, 'anterior a la inicial'],
            [{ desde: '2026-11-08', hasta: '2026-11-08', totalMin: 'abc' }, 'sin separador de miles'],
            [{ totalMin: '5000', totalMax: '1000' }, 'máximo no puede ser menor'],
        ];
        for (const [cambios, texto] of casos) {
            store.actualizarFiltros({ desde: '2026-11-08', hasta: '2026-11-08', totalMin: '', totalMax: '' });
            store.actualizarFiltros(cambios);
            store.buscar();
            expect(store.errorFiltros()).toContain(texto);
        }
        // http.verify() (afterEach) falla si alguno de estos casos hubiera enviado una petición.
    });

    it('cancela la consulta anterior si se busca de nuevo', () => {
        iniciar();
        store.buscar();
        store.buscar();

        const [primera, segunda] = http.match((r) => r.url === VENTAS);
        expect(primera.cancelled).toBe(true);
        segunda.flush([v2]);

        expect(store.ventas().map((v) => v.id)).toEqual([2]);
        expect(store.cargando()).toBe(false);
    });

    it('informa el error si no se puede cargar el historial', () => {
        store.iniciar(HOY);
        http.expectOne(MEDIOS).flush(mediosPago);
        http.expectOne((r) => r.url === VENTAS).flush('x', { status: 500, statusText: 'Server Error' });

        expect(store.errorCarga()).toContain('problema');
        expect(store.cargando()).toBe(false);
    });

    it('el resumen cuenta solo las ventas no anuladas', () => {
        iniciar([v1, v2, v3]);

        expect(store.resumen()).toEqual({ cantidad: 2, total: '5000.00', anuladas: 1 });
    });

    it('exige un motivo para anular y no envía nada sin él', () => {
        iniciar();

        store.anular(v1, '   ');
        expect(store.errorAnulacion()).toContain('obligatorio');

        store.anular(v1, 'x'.repeat(256));
        expect(store.errorAnulacion()).toContain('255');
    });

    it('al anular una venta la quita de la lista si no se muestran anuladas', () => {
        iniciar();
        let cerrado = false;

        store.anular(v1, '  Error de carga ', () => (cerrado = true));
        expect(store.anulando()).toBe(true);
        const peticion = http.expectOne(`${VENTAS}1/anular/`);
        expect(peticion.request.body).toEqual({ motivo: 'Error de carga' });
        peticion.flush({ ...v1, activa: false, estado: 'anulada', motivo_anulacion: 'Error de carga' });

        expect(store.ventas().map((v) => v.id)).toEqual([2]);
        expect(store.anulando()).toBe(false);
        expect(cerrado).toBe(true);
    });

    it('al anular con "incluir anuladas" deja la venta en la lista, marcada como anulada', () => {
        store.actualizarFiltros({ incluirAnuladas: true });
        iniciar();
        store.actualizarFiltros({ incluirAnuladas: true });
        store.buscar();
        http.expectOne((r) => r.url === VENTAS).flush([v1, v2]);

        store.anular(v1, 'Cliente se arrepintió');
        http.expectOne(`${VENTAS}1/anular/`).flush({ ...v1, activa: false, estado: 'anulada' });

        expect(store.ventas().map((v) => [v.id, v.activa])).toEqual([[1, false], [2, true]]);
    });

    it('no anula dos veces si se envía de nuevo mientras espera', () => {
        iniciar();

        store.anular(v1, 'Error');
        store.anular(v1, 'Error');

        http.expectOne(`${VENTAS}1/anular/`).flush({ ...v1, activa: false });
    });

    it('muestra el error del backend al anular y no cierra el diálogo', () => {
        iniciar();
        let cerrado = false;

        store.anular(v1, 'Error', () => (cerrado = true));
        http.expectOne(`${VENTAS}1/anular/`).flush(
            { detail: 'La venta ya está anulada.' },
            { status: 400, statusText: 'Bad Request' },
        );

        expect(store.errorAnulacion()).toBe('La venta ya está anulada.');
        expect(store.anulando()).toBe(false);
        expect(cerrado).toBe(false);
        expect(store.ventas()).toHaveLength(2);
    });

    it('emite el comprobante y actualiza la fila', () => {
        iniciar();
        const comprobante = { id: 20, venta: 1, numero_formateado: '00000003' } as Comprobante;

        store.emitirComprobante(v1);
        expect(store.emitiendoVenta()).toBe(1);
        const peticion = http.expectOne(COMPROBANTES);
        expect(peticion.request.body).toEqual({ venta: 1 });
        peticion.flush(comprobante);

        const fila = store.ventas().find((v) => v.id === 1);
        expect(fila?.comprobante).toBe(20);
        expect(fila?.comprobante_numero).toBe('00000003');
        expect(store.emitiendoVenta()).toBeNull();
    });

    it('no emite si la venta ya tiene comprobante, está anulada o hay una emisión en curso', () => {
        iniciar();

        store.emitirComprobante(venta({ id: 1, comprobante: 5, comprobante_numero: '00000001' }));
        store.emitirComprobante(v3);

        store.emitirComprobante(v1);
        store.emitirComprobante(v2); // hay una emisión en curso
        http.expectOne(COMPROBANTES).flush({ id: 1, numero_formateado: '00000001' });
    });

    it('informa el error al emitir el comprobante', () => {
        iniciar();

        store.emitirComprobante(v1);
        http.expectOne(COMPROBANTES).flush(
            { venta: ['La venta #1 ya tiene un comprobante emitido.'] },
            { status: 400, statusText: 'Bad Request' },
        );

        expect(store.errorComprobante()).toBe('La venta #1 ya tiene un comprobante emitido.');
        expect(store.emitiendoVenta()).toBeNull();
    });
});
