import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { IndicadoresApi } from './indicadores.api';

describe('IndicadoresApi', () => {
    const URL = `${environment.apiUrl}/indicadores/`;
    let api: IndicadoresApi;
    let http: HttpTestingController;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [provideHttpClient(), provideHttpClientTesting()],
        });
        api = TestBed.inject(IndicadoresApi);
        http = TestBed.inject(HttpTestingController);
    });

    afterEach(() => http.verify());

    it('consulta el resumen con el período', () => {
        api.resumen({ desde: '2026-11-01', hasta: '2026-11-15' }).subscribe();

        const req = http.expectOne((r) => r.url === `${URL}resumen/`);
        expect(req.request.method).toBe('GET');
        expect(req.request.params.get('desde')).toBe('2026-11-01');
        expect(req.request.params.get('hasta')).toBe('2026-11-15');
        req.flush({});
    });

    it('sin período no envía parámetros (período abierto)', () => {
        api.resumen().subscribe();

        const req = http.expectOne((r) => r.url === `${URL}resumen/`);
        expect(req.request.params.keys()).toEqual([]);
        req.flush({});
    });

    it('consulta las ventas por medio de pago', () => {
        api.porMedioPago({ desde: '2026-11-01' }).subscribe();

        const req = http.expectOne((r) => r.url === `${URL}por-medio-pago/`);
        expect(req.request.method).toBe('GET');
        expect(req.request.params.get('desde')).toBe('2026-11-01');
        expect(req.request.params.has('hasta')).toBe(false);
        req.flush([]);
    });

    it('consulta los productos más vendidos con límite y unidad como texto', () => {
        api.productosMasVendidos({ desde: '2026-11-01', hasta: '2026-11-15', limite: 10, unidad: 2 }).subscribe();

        const req = http.expectOne((r) => r.url === `${URL}productos-mas-vendidos/`);
        expect(req.request.method).toBe('GET');
        expect(req.request.params.get('limite')).toBe('10');
        expect(req.request.params.get('unidad')).toBe('2');
        req.flush([]);
    });

    it('omite la unidad cuando no se elige ninguna', () => {
        api.productosMasVendidos({ limite: 10, unidad: undefined }).subscribe();

        const req = http.expectOne((r) => r.url === `${URL}productos-mas-vendidos/`);
        expect(req.request.params.has('unidad')).toBe(false);
        req.flush([]);
    });

    it('consulta las categorías más vendidas con el límite', () => {
        api.categoriasMasVendidas({ hasta: '2026-11-15', limite: 5 }).subscribe();

        const req = http.expectOne((r) => r.url === `${URL}categorias-mas-vendidas/`);
        expect(req.request.method).toBe('GET');
        expect(req.request.params.get('limite')).toBe('5');
        expect(req.request.params.get('hasta')).toBe('2026-11-15');
        req.flush([]);
    });
});
