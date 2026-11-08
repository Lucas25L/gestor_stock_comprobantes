import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { CategoriasApi } from './categorias.api';
import { UnidadesApi } from './unidades.api';

describe('Catálogos', () => {
    let http: HttpTestingController;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [provideHttpClient(), provideHttpClientTesting()],
        });
        http = TestBed.inject(HttpTestingController);
    });

    afterEach(() => http.verify());

    describe('CategoriasApi', () => {
        const URL = `${environment.apiUrl}/categorias/`;

        it('lista usando "incluir_inactivas" en femenino', () => {
            TestBed.inject(CategoriasApi).listar({ incluir_inactivas: true }).subscribe();

            const req = http.expectOne((r) => r.url === URL);
            expect(req.request.params.get('incluir_inactivas')).toBe('true');
            expect(req.request.params.has('incluir_inactivos')).toBe(false);
            req.flush([]);
        });

        it('crea, edita, desactiva y reactiva con las rutas y métodos del backend', () => {
            const api = TestBed.inject(CategoriasApi);

            api.crear({ nombre: 'Lácteos', descripcion: '' }).subscribe();
            let req = http.expectOne(URL);
            expect(req.request.method).toBe('POST');
            expect(req.request.body).toEqual({ nombre: 'Lácteos', descripcion: '' });
            req.flush({});

            api.actualizar(3, { nombre: 'Lácteos y fiambres' }).subscribe();
            req = http.expectOne(`${URL}3/`);
            expect(req.request.method).toBe('PATCH');
            expect(req.request.body).toEqual({ nombre: 'Lácteos y fiambres' });
            req.flush({});

            api.desactivar(3).subscribe();
            req = http.expectOne(`${URL}3/`);
            expect(req.request.method).toBe('DELETE');
            req.flush(null);

            api.reactivar(3).subscribe();
            req = http.expectOne(`${URL}3/reactivar/`);
            expect(req.request.method).toBe('POST');
            req.flush({});
        });
    });

    describe('UnidadesApi', () => {
        const URL = `${environment.apiUrl}/unidades/`;

        it('lista usando "incluir_inactivas" en femenino', () => {
            TestBed.inject(UnidadesApi).listar({ incluir_inactivas: true, permite_decimales: true }).subscribe();

            const req = http.expectOne((r) => r.url === URL);
            expect(req.request.params.get('incluir_inactivas')).toBe('true');
            expect(req.request.params.get('permite_decimales')).toBe('true');
            req.flush([]);
        });

        it('crea, edita, desactiva y reactiva con las rutas y métodos del backend', () => {
            const api = TestBed.inject(UnidadesApi);
            const unidad = { nombre: 'Metro', abreviatura: 'm', permite_decimales: true };

            api.crear(unidad).subscribe();
            let req = http.expectOne(URL);
            expect(req.request.method).toBe('POST');
            expect(req.request.body).toEqual(unidad);
            req.flush({});

            api.actualizar(4, { permite_decimales: false }).subscribe();
            req = http.expectOne(`${URL}4/`);
            expect(req.request.method).toBe('PATCH');
            expect(req.request.body).toEqual({ permite_decimales: false });
            req.flush({});

            api.desactivar(4).subscribe();
            req = http.expectOne(`${URL}4/`);
            expect(req.request.method).toBe('DELETE');
            req.flush(null);

            api.reactivar(4).subscribe();
            req = http.expectOne(`${URL}4/reactivar/`);
            expect(req.request.method).toBe('POST');
            req.flush({});
        });
    });
});
