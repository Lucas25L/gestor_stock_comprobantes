import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { Producto } from '../../core/api/modelos';
import { ReposicionStore } from './reposicion.store';

function producto(datos: Partial<Producto>): Producto {
    return {
        id: 1,
        nombre: 'Leche',
        descripcion: '',
        precio: '1500.00',
        stock: '10.000',
        stock_minimo: '30.000',
        codigo_barras: null,
        categoria: 1,
        categoria_nombre: 'Lácteos',
        unidad: 1,
        unidad_nombre: 'Unidad',
        unidad_abreviatura: 'u',
        unidad_permite_decimales: false,
        stock_bajo: true,
        faltante: '20.000',
        activo: true,
        creado_en: '',
        actualizado_en: '',
        ...datos,
    };
}

const leche = producto({ id: 1, nombre: 'Leche', faltante: '20.000' });
const pan = producto({ id: 2, nombre: 'Pan', stock: '4.000', stock_minimo: '10.000', faltante: '6.000' });

describe('ReposicionStore', () => {
    const STOCK_BAJO = `${environment.apiUrl}/productos/stock-bajo/`;

    let store: ReposicionStore;
    let http: HttpTestingController;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [ReposicionStore, provideHttpClient(), provideHttpClientTesting()],
        });
        store = TestBed.inject(ReposicionStore);
        http = TestBed.inject(HttpTestingController);
    });

    afterEach(() => http.verify());

    it('empieza sin productos, sin cargar y sin error', () => {
        expect(store.productos()).toEqual([]);
        expect(store.cargando()).toBe(false);
        expect(store.errorCarga()).toBeNull();
    });

    it('guarda la lista en el mismo orden en que la envía el servidor', () => {
        store.cargar();
        http.expectOne(STOCK_BAJO).flush([leche, pan]);

        expect(store.productos().map((p) => p.id)).toEqual([1, 2]);
        expect(store.productos()[0].faltante).toBe('20.000');
    });

    it('marca cargando mientras espera la respuesta y lo apaga al recibirla', () => {
        store.cargar();
        expect(store.cargando()).toBe(true);

        http.expectOne(STOCK_BAJO).flush([leche]);
        expect(store.cargando()).toBe(false);
    });

    it('acepta una lista vacía: no hay nada para reponer y no es un error', () => {
        store.cargar();
        http.expectOne(STOCK_BAJO).flush([]);

        expect(store.productos()).toEqual([]);
        expect(store.errorCarga()).toBeNull();
        expect(store.cargando()).toBe(false);
    });

    it('muestra el mensaje del backend cuando responde 400', () => {
        store.cargar();
        http.expectOne(STOCK_BAJO).flush(
            { detail: 'Parámetro inválido.' },
            { status: 400, statusText: 'Bad Request' },
        );

        expect(store.errorCarga()).toBe('Parámetro inválido.');
        expect(store.cargando()).toBe(false);
    });

    it('informa la falta de conexión cuando no hay respuesta del servidor', () => {
        store.cargar();
        http.expectOne(STOCK_BAJO).error(new ProgressEvent('error'));

        expect(store.errorCarga()).toBe('No se pudo conectar con el servidor. Verificá la conexión.');
        expect(store.cargando()).toBe(false);
    });

    it('si una actualización falla, conserva la lista anterior junto con el error', () => {
        store.cargar();
        http.expectOne(STOCK_BAJO).flush([leche, pan]);

        store.cargar();
        http.expectOne(STOCK_BAJO).flush({}, { status: 500, statusText: 'Server Error' });

        expect(store.productos().map((p) => p.id)).toEqual([1, 2]);
        expect(store.errorCarga()).toBe('El servidor tuvo un problema. Intentá de nuevo en unos minutos.');
    });

    it('una segunda carga cancela la primera y se queda con la última respuesta', () => {
        store.cargar();
        store.cargar();

        const [primera, segunda] = http.match(STOCK_BAJO);
        expect(primera.cancelled).toBe(true);
        expect(segunda.cancelled).toBe(false);

        segunda.flush([pan]);
        expect(store.productos().map((p) => p.id)).toEqual([2]);
        expect(store.cargando()).toBe(false);
    });
});
