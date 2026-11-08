import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { MovimientoStock, Pagina } from './modelos';
import { StockApi } from './stock.api';

describe('StockApi', () => {
    const URL = `${environment.apiUrl}/stock/`;
    let api: StockApi;
    let http: HttpTestingController;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [provideHttpClient(), provideHttpClientTesting()],
        });
        api = TestBed.inject(StockApi);
        http = TestBed.inject(HttpTestingController);
    });

    afterEach(() => http.verify());

    it('registra un ingreso con la cantidad como texto', () => {
        const ingreso = { producto: 4, cantidad: '5.250', motivo: 'Compra a proveedor', referencia: 'Remito 123' };
        api.ingresar(ingreso).subscribe();

        const req = http.expectOne(`${URL}ingresos/`);
        expect(req.request.method).toBe('POST');
        expect(req.request.body).toEqual(ingreso);
        req.flush({});
    });

    it('registra un ajuste con la cantidad con signo', () => {
        const ajuste = { producto: 4, cantidad: '-0.250', motivo: 'Merma' };
        api.ajustar(ajuste).subscribe();

        const req = http.expectOne(`${URL}ajustes/`);
        expect(req.request.method).toBe('POST');
        expect(req.request.body).toEqual(ajuste);
        req.flush({});
    });

    it('consulta los movimientos con los filtros y la página, omitiendo los vacíos', () => {
        let respuesta: Pagina<MovimientoStock> | undefined;
        api.movimientos({
            producto: 4,
            tipo: 'ajuste',
            desde: '2026-11-01',
            page: 2,
            search: '',
            usuario: undefined,
        }).subscribe((pagina) => (respuesta = pagina));

        const req = http.expectOne((r) => r.url === `${URL}movimientos/`);
        expect(req.request.method).toBe('GET');
        expect(req.request.params.get('producto')).toBe('4');
        expect(req.request.params.get('tipo')).toBe('ajuste');
        expect(req.request.params.get('desde')).toBe('2026-11-01');
        expect(req.request.params.get('page')).toBe('2');
        expect(req.request.params.has('search')).toBe(false);
        expect(req.request.params.has('usuario')).toBe(false);

        const pagina: Pagina<MovimientoStock> = { count: 0, next: null, previous: null, results: [] };
        req.flush(pagina);
        expect(respuesta).toEqual(pagina);
    });

    it('consulta los movimientos sin parámetros si no hay filtros', () => {
        api.movimientos().subscribe();

        const req = http.expectOne((r) => r.url === `${URL}movimientos/`);
        expect(req.request.params.keys()).toEqual([]);
        req.flush({ count: 0, next: null, previous: null, results: [] });
    });
});
