import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { CatalogosStore } from './catalogos.store';

describe('CatalogosStore', () => {
    let store: CatalogosStore;
    let http: HttpTestingController;

    const pedir = (ruta: string) => http.expectOne((r) => r.url === `${environment.apiUrl}/${ruta}/`);

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [provideHttpClient(), provideHttpClientTesting(), CatalogosStore],
        });
        store = TestBed.inject(CatalogosStore);
        http = TestBed.inject(HttpTestingController);
    });

    afterEach(() => http.verify());

    it('iniciar carga los tres catálogos sin pedir inactivos', () => {
        store.iniciar();
        for (const ruta of ['categorias', 'unidades', 'medios-pago']) {
            const req = pedir(ruta);
            expect(req.request.params.keys()).toEqual([]);
            req.flush([]);
        }
    });

    it('categorías y unidades piden los inactivos con incluir_inactivas (femenino)', () => {
        store.categorias.mostrarInactivos(true);
        store.unidades.mostrarInactivos(true);

        const categorias = pedir('categorias');
        const unidades = pedir('unidades');
        expect(categorias.request.params.get('incluir_inactivas')).toBe('true');
        expect(unidades.request.params.get('incluir_inactivas')).toBe('true');
        categorias.flush([]);
        unidades.flush([]);
    });

    it('medios de pago pide los inactivos con incluir_inactivos (masculino)', () => {
        store.mediosPago.mostrarInactivos(true);

        const req = pedir('medios-pago');
        expect(req.request.params.get('incluir_inactivos')).toBe('true');
        expect(req.request.params.has('incluir_inactivas')).toBe(false);
        req.flush([]);
    });
});
