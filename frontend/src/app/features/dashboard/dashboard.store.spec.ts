import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/services/auth.service';
import { DashboardStore } from './dashboard.store';

describe('DashboardStore', () => {
    const URL_STOCK = `${environment.apiUrl}/productos/stock-bajo/`;
    const URL_RESUMEN = `${environment.apiUrl}/indicadores/resumen/`;
    const AHORA = new Date(2026, 10, 15);
    const RESUMEN = {
        cantidad_ventas: 3,
        total_vendido: '4500.00',
        impuestos_nacionales: '780.99',
        ticket_promedio: '1500.00',
    };

    let http: HttpTestingController;

    function crear(esAdministrador: boolean): DashboardStore {
        TestBed.configureTestingModule({
            providers: [
                provideHttpClient(),
                provideHttpClientTesting(),
                DashboardStore,
                { provide: AuthService, useValue: { tieneRol: () => esAdministrador } },
            ],
        });
        http = TestBed.inject(HttpTestingController);
        return TestBed.inject(DashboardStore);
    }

    const stock = () => http.expectOne((r) => r.url === URL_STOCK);
    const resumenes = () => http.match((r) => r.url === URL_RESUMEN);

    // forkJoin cancela la segunda consulta cuando la primera falla: no cuenta como pendiente.
    afterEach(() => http.verify({ ignoreCancelled: true }));

    it('el Administrador carga el stock bajo y los resúmenes de hoy y del mes', () => {
        const store = crear(true);
        store.cargar(AHORA);

        stock().flush([{ id: 1 }, { id: 2 }]);
        const pedidas = resumenes();
        expect(pedidas.length).toBe(2);

        const hoy = pedidas.find((r) => r.request.params.get('desde') === '2026-11-15');
        const mes = pedidas.find((r) => r.request.params.get('desde') === '2026-11-01');
        expect(hoy?.request.params.get('hasta')).toBe('2026-11-15');
        expect(mes?.request.params.get('hasta')).toBe('2026-11-15');
        hoy?.flush(RESUMEN);
        mes?.flush({ ...RESUMEN, cantidad_ventas: 9 });

        expect(store.cantidadStockBajo()).toBe(2);
        expect(store.resumenHoy()?.cantidad_ventas).toBe(3);
        expect(store.resumenMes()?.cantidad_ventas).toBe(9);
    });

    it('un rol que no es Administrador no consulta indicadores', () => {
        const store = crear(false);
        store.cargar(AHORA);

        stock().flush([]);

        expect(resumenes().length).toBe(0);
        expect(store.cantidadStockBajo()).toBe(0);
        expect(store.resumenHoy()).toBeNull();
    });

    it('si falla el stock bajo, los resúmenes se muestran igual', () => {
        const store = crear(true);
        store.cargar(AHORA);

        stock().flush({ detail: 'Error' }, { status: 500, statusText: 'Server Error' });
        resumenes().forEach((r) => r.flush(RESUMEN));

        expect(store.errorStock()).toBeTruthy();
        expect(store.cantidadStockBajo()).toBeNull();
        expect(store.resumenHoy()).not.toBeNull();
        expect(store.errorVentas()).toBeNull();
    });

    it('si fallan los resúmenes, el stock bajo se muestra igual', () => {
        const store = crear(true);
        store.cargar(AHORA);

        stock().flush([{ id: 1 }]);
        resumenes()[0].flush({ detail: 'Error' }, { status: 500, statusText: 'Server Error' });

        expect(store.errorVentas()).toBeTruthy();
        expect(store.resumenHoy()).toBeNull();
        expect(store.cantidadStockBajo()).toBe(1);
    });
});
