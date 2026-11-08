import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { DatosProducto } from './modelos';
import { ProductosApi } from './productos.api';

describe('ProductosApi', () => {
    const URL = `${environment.apiUrl}/productos/`;
    const datos: DatosProducto = {
        nombre: 'Pan francés',
        descripcion: '',
        precio: '2000.00',
        stock_minimo: '5',
        codigo_barras: null,
        categoria: 1,
        unidad: 2,
    };

    let api: ProductosApi;
    let http: HttpTestingController;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [provideHttpClient(), provideHttpClientTesting()],
        });
        api = TestBed.inject(ProductosApi);
        http = TestBed.inject(HttpTestingController);
    });

    afterEach(() => http.verify());

    it('lista sin parámetros por defecto (solo productos activos)', () => {
        api.listar().subscribe();

        const req = http.expectOne((r) => r.url === URL);
        expect(req.request.method).toBe('GET');
        expect(req.request.params.keys()).toEqual([]);
        req.flush([]);
    });

    it('envía solo los filtros informados y usa "incluir_inactivos" en masculino', () => {
        api.listar({
            incluir_inactivos: true,
            categoria: 3,
            stock_bajo: false,
            search: '',
            unidad: undefined,
        }).subscribe();

        const req = http.expectOne((r) => r.url === URL);
        expect(req.request.params.get('incluir_inactivos')).toBe('true');
        expect(req.request.params.get('categoria')).toBe('3');
        expect(req.request.params.get('stock_bajo')).toBe('false');
        expect(req.request.params.has('search')).toBe(false);
        expect(req.request.params.has('unidad')).toBe(false);
        expect(req.request.params.has('incluir_inactivas')).toBe(false);
        req.flush([]);
    });

    it('pide la lista de reposición', () => {
        api.stockBajo().subscribe();

        const req = http.expectOne(`${URL}stock-bajo/`);
        expect(req.request.method).toBe('GET');
        req.flush([]);
    });

    it('crea el producto sin enviar stock y con el código de barras en null', () => {
        api.crear(datos).subscribe();

        const req = http.expectOne(URL);
        expect(req.request.method).toBe('POST');
        expect(req.request.body).toEqual(datos);
        expect(req.request.body.codigo_barras).toBeNull();
        expect('stock' in req.request.body).toBe(false);
        req.flush({});
    });

    it('actualiza con PATCH enviando solo los campos que cambian', () => {
        api.actualizar(5, { precio: '2200.00' }).subscribe();

        const req = http.expectOne(`${URL}5/`);
        expect(req.request.method).toBe('PATCH');
        expect(req.request.body).toEqual({ precio: '2200.00' });
        req.flush({});
    });

    it('desactiva con DELETE (baja lógica)', () => {
        api.desactivar(5).subscribe();

        const req = http.expectOne(`${URL}5/`);
        expect(req.request.method).toBe('DELETE');
        req.flush(null);
    });

    it('reactiva con POST a /reactivar/', () => {
        api.reactivar(5).subscribe();

        const req = http.expectOne(`${URL}5/reactivar/`);
        expect(req.request.method).toBe('POST');
        req.flush({});
    });
});
