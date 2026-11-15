import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { MediosPagoApi } from './medios-pago.api';

describe('MediosPagoApi', () => {
    const URL = `${environment.apiUrl}/medios-pago/`;
    let api: MediosPagoApi;
    let http: HttpTestingController;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [provideHttpClient(), provideHttpClientTesting()],
        });
        api = TestBed.inject(MediosPagoApi);
        http = TestBed.inject(HttpTestingController);
    });

    afterEach(() => http.verify());

    it('sin filtros lista solo los activos (comportamiento que usa Nueva venta)', () => {
        api.listar().subscribe();

        const req = http.expectOne((r) => r.url === URL);
        expect(req.request.method).toBe('GET');
        expect(req.request.params.keys()).toEqual([]);
        req.flush([]);
    });

    it('pide los inactivos con incluir_inactivos (masculino)', () => {
        api.listar({ incluir_inactivos: true }).subscribe();

        const req = http.expectOne((r) => r.url === URL);
        expect(req.request.params.get('incluir_inactivos')).toBe('true');
        req.flush([]);
    });

    it('crea un medio de pago', () => {
        const datos = { nombre: 'Transferencia', descripcion: '' };
        api.crear(datos).subscribe();

        const req = http.expectOne(URL);
        expect(req.request.method).toBe('POST');
        expect(req.request.body).toEqual(datos);
        req.flush({});
    });

    it('modifica parcialmente con PATCH', () => {
        api.actualizar(3, { nombre: 'Débito' }).subscribe();

        const req = http.expectOne(`${URL}3/`);
        expect(req.request.method).toBe('PATCH');
        expect(req.request.body).toEqual({ nombre: 'Débito' });
        req.flush({});
    });

    it('desactiva con DELETE y reactiva con POST a /reactivar/', () => {
        api.desactivar(3).subscribe();
        const baja = http.expectOne(`${URL}3/`);
        expect(baja.request.method).toBe('DELETE');
        baja.flush(null);

        api.reactivar(3).subscribe();
        const alta = http.expectOne(`${URL}3/reactivar/`);
        expect(alta.request.method).toBe('POST');
        alta.flush({});
    });
});
