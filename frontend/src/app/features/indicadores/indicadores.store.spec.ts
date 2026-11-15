import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { IndicadoresStore } from './indicadores.store';

describe('IndicadoresStore', () => {
    const URL = `${environment.apiUrl}/indicadores/`;
    const RESUMEN = {
        cantidad_ventas: 3,
        total_vendido: '4500.00',
        impuestos_nacionales: '780.99',
        ticket_promedio: '1500.00',
    };
    const MEDIOS = [{ medio_pago: 1, nombre: 'Efectivo', cantidad_ventas: 3, total: '4500.00', porcentaje: '100.00' }];
    const PRODUCTOS = [
        {
            producto: 7,
            nombre: 'Pan',
            unidad: 'Kilogramo',
            permite_decimales: true,
            cantidad_vendida: '2.500',
            importe: '4500.00',
        },
    ];
    const CATEGORIAS = [{ categoria: 1, nombre: 'Panadería', importe: '4500.00', porcentaje: '100.00' }];
    const CONSULTA = { periodo: { desde: '2026-11-01', hasta: '2026-11-15' }, limite: 10 };

    let store: IndicadoresStore;
    let http: HttpTestingController;

    const pedir = (ruta: string) => http.expectOne((r) => r.url === `${URL}${ruta}/`);

    function responderTodo(): void {
        pedir('resumen').flush(RESUMEN);
        pedir('por-medio-pago').flush(MEDIOS);
        pedir('productos-mas-vendidos').flush(PRODUCTOS);
        pedir('categorias-mas-vendidas').flush(CATEGORIAS);
    }

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [provideHttpClient(), provideHttpClientTesting(), IndicadoresStore],
        });
        store = TestBed.inject(IndicadoresStore);
        http = TestBed.inject(HttpTestingController);
    });

    // forkJoin cancela las peticiones restantes cuando una falla: no cuentan como pendientes.
    afterEach(() => http.verify({ ignoreCancelled: true }));

    it('carga los cuatro indicadores y deja el estado listo', () => {
        store.cargar(CONSULTA);
        expect(store.cargando()).toBe(true);
        expect(store.consultado()).toBe(false);

        responderTodo();

        expect(store.cargando()).toBe(false);
        expect(store.consultado()).toBe(true);
        expect(store.errorCarga()).toBeNull();
        expect(store.resumen()).toEqual(RESUMEN);
        expect(store.mediosPago()).toEqual(MEDIOS);
        expect(store.productos()).toEqual(PRODUCTOS);
        expect(store.categorias()).toEqual(CATEGORIAS);
    });

    it('envía el límite solo a los rankings y la unidad solo a productos', () => {
        store.cargar({ periodo: { desde: '2026-11-01' }, limite: 5 }, 2);

        const resumen = pedir('resumen');
        const medios = pedir('por-medio-pago');
        const productos = pedir('productos-mas-vendidos');
        const categorias = pedir('categorias-mas-vendidas');

        expect(resumen.request.params.keys()).toEqual(['desde']);
        expect(medios.request.params.keys()).toEqual(['desde']);
        expect(productos.request.params.get('limite')).toBe('5');
        expect(productos.request.params.get('unidad')).toBe('2');
        expect(categorias.request.params.get('limite')).toBe('5');
        expect(categorias.request.params.has('unidad')).toBe(false);

        resumen.flush(RESUMEN);
        medios.flush(MEDIOS);
        productos.flush(PRODUCTOS);
        categorias.flush(CATEGORIAS);
    });

    it('si una consulta falla muestra un error y no deja datos a medias', () => {
        store.cargar(CONSULTA);

        pedir('resumen').flush({ detail: 'No tiene permiso para realizar esta acción.' }, { status: 403, statusText: 'Forbidden' });

        expect(store.errorCarga()).toBeTruthy();
        expect(store.cargando()).toBe(false);
        expect(store.consultado()).toBe(false);
        expect(store.resumen()).toBeNull();
        expect(store.productos()).toEqual([]);
    });

    it('al consultar de nuevo limpia los datos del período anterior', () => {
        store.cargar(CONSULTA);
        responderTodo();
        expect(store.resumen()).not.toBeNull();

        store.cargar({ periodo: { desde: '2026-10-01', hasta: '2026-10-31' }, limite: 10 });

        expect(store.resumen()).toBeNull();
        expect(store.mediosPago()).toEqual([]);
        expect(store.consultado()).toBe(false);
        expect(store.cargando()).toBe(true);
        responderTodo();
    });

    it('una consulta nueva cancela la anterior que seguía en curso', () => {
        store.cargar(CONSULTA);
        store.cargar({ periodo: { desde: '2026-10-01', hasta: '2026-10-31' }, limite: 10 });

        const pedidas = http.match((r) => r.url.startsWith(URL));
        expect(pedidas.length).toBe(8);
        expect(pedidas.slice(0, 4).every((r) => r.cancelled)).toBe(true);
        expect(pedidas.slice(4).every((r) => !r.cancelled)).toBe(true);

        pedidas[4].flush(RESUMEN);
        pedidas[5].flush(MEDIOS);
        pedidas[6].flush(PRODUCTOS);
        pedidas[7].flush(CATEGORIAS);
        expect(store.consultado()).toBe(true);
    });
});
