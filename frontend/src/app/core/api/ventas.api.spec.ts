import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { VentasApi } from './ventas.api';

describe('VentasApi', () => {
    const URL = `${environment.apiUrl}/ventas/`;
    let api: VentasApi;
    let http: HttpTestingController;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [provideHttpClient(), provideHttpClientTesting()],
        });
        api = TestBed.inject(VentasApi);
        http = TestBed.inject(HttpTestingController);
    });

    afterEach(() => http.verify());

    it('crea la venta enviando las cantidades como texto', () => {
        const venta = { medio_pago: 1, items: [{ producto: 7, cantidad: '2.500' }] };
        api.crear(venta).subscribe();

        const req = http.expectOne(URL);
        expect(req.request.method).toBe('POST');
        expect(req.request.body).toEqual(venta);
        req.flush({});
    });

    it('lista enviando solo los filtros informados', () => {
        api.listar({
            desde: '2026-11-01',
            medio_pago: 2,
            incluir_inactivas: true,
            usuario: undefined,
            search: '',
        }).subscribe();

        const req = http.expectOne((r) => r.url === URL);
        expect(req.request.method).toBe('GET');
        expect(req.request.params.get('desde')).toBe('2026-11-01');
        expect(req.request.params.get('medio_pago')).toBe('2');
        expect(req.request.params.get('incluir_inactivas')).toBe('true');
        expect(req.request.params.has('usuario')).toBe(false);
        expect(req.request.params.has('search')).toBe(false);
        req.flush([]);
    });

    it('anula la venta enviando el motivo', () => {
        api.anular(5, 'Error de carga').subscribe();

        const req = http.expectOne(`${URL}5/anular/`);
        expect(req.request.method).toBe('POST');
        expect(req.request.body).toEqual({ motivo: 'Error de carga' });
        req.flush({});
    });
});
