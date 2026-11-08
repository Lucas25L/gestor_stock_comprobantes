import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { Categoria, Producto, UnidadMedida } from '../../core/api/modelos';
import { FORMULARIO_VACIO, FormularioProducto, formularioDe } from './producto-form';
import { ProductosStore, cambiosDe } from './productos.store';

function producto(datos: Partial<Producto>): Producto {
    return {
        id: 1,
        nombre: 'Gaseosa',
        descripcion: '',
        precio: '1500.00',
        stock: '100.000',
        stock_minimo: '0.000',
        codigo_barras: null,
        categoria: 1,
        categoria_nombre: 'Almacén',
        unidad: 1,
        unidad_nombre: 'Unidad',
        unidad_abreviatura: 'u',
        unidad_permite_decimales: false,
        stock_bajo: false,
        faltante: '0.000',
        activo: true,
        creado_en: '',
        actualizado_en: '',
        ...datos,
    };
}

const categorias: Categoria[] = [
    { id: 1, nombre: 'Panadería', descripcion: '', activa: true, creado_en: '', actualizado_en: '' },
];
const unidades: UnidadMedida[] = [
    { id: 1, nombre: 'Unidad', abreviatura: 'u', permite_decimales: false, activo: true },
    { id: 2, nombre: 'Kilogramo', abreviatura: 'kg', permite_decimales: true, activo: true },
];

const pan = producto({ id: 5, nombre: 'Pan francés', precio: '2000.00', stock_minimo: '5.000', unidad: 2 });

const formularioValido: FormularioProducto = {
    ...FORMULARIO_VACIO,
    nombre: 'Pan francés',
    precio: '2000',
    categoria: 1,
    unidad: 2,
};

describe('ProductosStore', () => {
    const PRODUCTOS = `${environment.apiUrl}/productos/`;
    const CATEGORIAS = `${environment.apiUrl}/categorias/`;
    const UNIDADES = `${environment.apiUrl}/unidades/`;
    const INGRESOS = `${environment.apiUrl}/stock/ingresos/`;
    const ERROR_400 = { status: 400, statusText: 'Bad Request' };

    let store: ProductosStore;
    let http: HttpTestingController;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [ProductosStore, provideHttpClient(), provideHttpClientTesting()],
        });
        store = TestBed.inject(ProductosStore);
        http = TestBed.inject(HttpTestingController);
    });

    afterEach(() => http.verify());

    function iniciar(listado: Producto[] = []): void {
        store.iniciar();
        http.expectOne(CATEGORIAS).flush(categorias);
        http.expectOne(UNIDADES).flush(unidades);
        http.expectOne(PRODUCTOS).flush(listado);
    }

    function recargar(listado: Producto[] = []): void {
        http.expectOne(PRODUCTOS).flush(listado);
    }

    describe('carga', () => {
        it('carga las categorías, las unidades y el listado sin filtros', () => {
            store.iniciar();
            expect(store.cargando()).toBe(true);

            http.expectOne(CATEGORIAS).flush(categorias);
            http.expectOne(UNIDADES).flush(unidades);
            const listado = http.expectOne((r) => r.url === PRODUCTOS);
            expect(listado.request.params.keys()).toEqual([]);
            listado.flush([pan]);

            expect(store.cargando()).toBe(false);
            expect(store.categorias()).toEqual(categorias);
            expect(store.unidades()).toEqual(unidades);
            expect(store.productos()).toEqual([pan]);
        });

        it('informa el error si fallan las categorías o las unidades', () => {
            store.iniciar();
            http.expectOne(CATEGORIAS).flush(categorias);
            http.expectOne(UNIDADES).flush('x', { status: 500, statusText: 'Server Error' });
            http.expectOne(PRODUCTOS).flush([]);

            expect(store.errorCatalogos()).toContain('problema');
        });

        it('informa el error si no se puede cargar el listado', () => {
            store.iniciar();
            http.expectOne(CATEGORIAS).flush(categorias);
            http.expectOne(UNIDADES).flush(unidades);
            http.expectOne(PRODUCTOS).flush('x', { status: 500, statusText: 'Server Error' });

            expect(store.errorCarga()).toContain('problema');
            expect(store.cargando()).toBe(false);
        });

        it('cuenta los productos con stock bajo', () => {
            iniciar([pan, producto({ id: 6, stock_bajo: true }), producto({ id: 7, stock_bajo: true })]);

            expect(store.cantidadStockBajo()).toBe(2);
        });
    });

    describe('filtros', () => {
        it('envía solo los filtros informados', () => {
            iniciar();
            store.actualizarFiltros({
                texto: '  pan ',
                categoria: 3,
                unidad: 2,
                soloStockBajo: true,
                incluirInactivos: true,
            });
            store.buscar();

            const peticion = http.expectOne((r) => r.url === PRODUCTOS);
            const params = peticion.request.params;
            expect(params.get('search')).toBe('pan');
            expect(params.get('categoria')).toBe('3');
            expect(params.get('unidad')).toBe('2');
            expect(params.get('stock_bajo')).toBe('true');
            expect(params.get('incluir_inactivos')).toBe('true');
            peticion.flush([]);
        });

        it('los filtros apagados no viajan en la consulta', () => {
            iniciar();
            store.actualizarFiltros({ categoria: null, soloStockBajo: false, incluirInactivos: false });
            store.buscar();

            const peticion = http.expectOne((r) => r.url === PRODUCTOS);
            expect(peticion.request.params.keys()).toEqual([]);
            peticion.flush([]);
        });

        it('cancela la consulta anterior si se busca de nuevo', () => {
            iniciar();
            store.buscar();
            store.buscar();

            const [primera, segunda] = http.match(PRODUCTOS);
            expect(primera.cancelled).toBe(true);
            segunda.flush([pan]);

            expect(store.productos()).toEqual([pan]);
            expect(store.cargando()).toBe(false);
        });

        it('limpiar vuelve a los filtros iniciales y busca', () => {
            iniciar();
            store.actualizarFiltros({ texto: 'pan', categoria: 1, incluirInactivos: true });

            store.limpiarFiltros();

            expect(store.filtros()).toEqual({
                texto: '',
                categoria: null,
                unidad: null,
                soloStockBajo: false,
                incluirInactivos: false,
            });
            recargar();
        });
    });

    describe('alta', () => {
        it('no consulta al servidor si el formulario es inválido y deja los errores por campo', () => {
            iniciar();
            let terminado = false;

            store.guardar(FORMULARIO_VACIO, null, () => (terminado = true));

            expect(Object.keys(store.erroresCampos()).sort()).toEqual(['categoria', 'nombre', 'precio', 'unidad']);
            expect(store.guardando()).toBe(false);
            expect(terminado).toBe(false);
        });

        it('crea el producto sin stock inicial', () => {
            iniciar();
            let terminado = false;

            store.guardar(formularioValido, null, () => (terminado = true));
            expect(store.guardando()).toBe(true);

            const peticion = http.expectOne(PRODUCTOS);
            expect(peticion.request.method).toBe('POST');
            expect(peticion.request.body).toEqual({
                nombre: 'Pan francés',
                descripcion: '',
                precio: '2000',
                stock_minimo: '0',
                codigo_barras: null,
                categoria: 1,
                unidad: 2,
            });
            peticion.flush(pan);
            recargar([pan]);

            expect(store.guardando()).toBe(false);
            expect(terminado).toBe(true);
            expect(store.aviso()).toBeNull();
        });

        it('crea el producto y carga el stock inicial como un ingreso', () => {
            iniciar();

            store.guardar({ ...formularioValido, stockInicial: '10,5' }, null);
            http.expectOne(PRODUCTOS).flush(pan);

            const ingreso = http.expectOne(INGRESOS);
            expect(ingreso.request.method).toBe('POST');
            expect(ingreso.request.body).toEqual({ producto: 5, cantidad: '10.5', motivo: 'Stock inicial' });
            ingreso.flush({});
            recargar([pan]);

            expect(store.guardando()).toBe(false);
            expect(store.aviso()).toBeNull();
        });

        it('si falla el ingreso inicial conserva el producto y avisa qué hacer', () => {
            iniciar();
            let terminado = false;

            store.guardar({ ...formularioValido, stockInicial: '10' }, null, () => (terminado = true));
            http.expectOne(PRODUCTOS).flush(pan);
            http.expectOne(INGRESOS).flush({ detail: 'Algo falló.' }, ERROR_400);
            recargar([pan]);

            expect(store.aviso()).toContain('El producto "Pan francés" se creó');
            expect(store.aviso()).toContain('Algo falló.');
            expect(store.aviso()).toContain('Stock');
            expect(terminado).toBe(true);
            expect(store.guardando()).toBe(false);

            store.descartarAviso();
            expect(store.aviso()).toBeNull();
        });

        it('traduce el error de código de barras repetido', () => {
            iniciar();
            let terminado = false;

            store.guardar({ ...formularioValido, codigoBarras: '779' }, null, () => (terminado = true));
            http.expectOne(PRODUCTOS).flush(
                { codigo_barras: ['producto with this codigo barras already exists.'] },
                ERROR_400,
            );

            expect(store.errorFormulario()).toBe('Ya existe un producto con ese código de barras.');
            expect(store.guardando()).toBe(false);
            expect(terminado).toBe(false);
        });

        it('muestra el mensaje del backend ante otro error', () => {
            iniciar();

            store.guardar(formularioValido, null);
            http.expectOne(PRODUCTOS).flush({ nombre: ['Este campo no puede estar en blanco.'] }, ERROR_400);

            expect(store.errorFormulario()).toBe('Este campo no puede estar en blanco.');
        });

        it('no envía dos veces si se guarda de nuevo mientras espera', () => {
            iniciar();

            store.guardar(formularioValido, null);
            store.guardar(formularioValido, null);

            http.expectOne(PRODUCTOS).flush(pan); // expectOne falla si hubiera dos peticiones
            recargar([pan]);
        });
    });

    describe('edición', () => {
        it('envía solo los campos que cambian', () => {
            iniciar([pan]);
            let terminado = false;

            store.guardar({ ...formularioDe(pan), precio: '2200' }, pan, () => (terminado = true));

            const peticion = http.expectOne(`${PRODUCTOS}5/`);
            expect(peticion.request.method).toBe('PATCH');
            expect(peticion.request.body).toEqual({ precio: '2200' });
            peticion.flush(pan);
            recargar([pan]);

            expect(terminado).toBe(true);
            expect(store.guardando()).toBe(false);
        });

        it('vaciar el código de barras lo envía como null', () => {
            const conCodigo = producto({ ...pan, codigo_barras: '779' });
            iniciar([conCodigo]);

            store.guardar({ ...formularioDe(conCodigo), codigoBarras: '' }, conCodigo);

            const peticion = http.expectOne(`${PRODUCTOS}5/`);
            expect(peticion.request.body).toEqual({ codigo_barras: null });
            peticion.flush(conCodigo);
            recargar([conCodigo]);
        });

        it('sin cambios no consulta al servidor y cierra el formulario', () => {
            iniciar([pan]);
            let terminado = false;

            store.guardar(formularioDe(pan), pan, () => (terminado = true));

            expect(terminado).toBe(true);
            expect(store.guardando()).toBe(false);
        });
    });

    describe('baja y reactivación', () => {
        it('desactiva con DELETE y recarga el listado', () => {
            iniciar([pan]);

            store.desactivar(pan);
            expect(store.cambiandoEstado()).toBe(5);

            const peticion = http.expectOne(`${PRODUCTOS}5/`);
            expect(peticion.request.method).toBe('DELETE');
            peticion.flush(null);
            recargar([]);

            expect(store.cambiandoEstado()).toBeNull();
        });

        it('reactiva con POST y recarga el listado', () => {
            iniciar([]);

            store.reactivar(pan);

            const peticion = http.expectOne(`${PRODUCTOS}5/reactivar/`);
            expect(peticion.request.method).toBe('POST');
            peticion.flush(pan);
            recargar([pan]);

            expect(store.cambiandoEstado()).toBeNull();
        });

        it('informa el error si no se puede desactivar', () => {
            iniciar([pan]);

            store.desactivar(pan);
            http.expectOne(`${PRODUCTOS}5/`).flush({ detail: 'No permitido.' }, ERROR_400);

            expect(store.errorOperacion()).toBe('No permitido.');
            expect(store.cambiandoEstado()).toBeNull();
        });

        it('no hace dos cambios de estado a la vez', () => {
            iniciar([pan]);

            store.desactivar(pan);
            store.desactivar(producto({ id: 6 }));

            http.expectOne(`${PRODUCTOS}5/`).flush(null);
            recargar([]);
        });
    });
});

describe('cambiosDe', () => {
    const original = producto({ id: 5, precio: '2000.00', stock_minimo: '5.000', codigo_barras: null });
    const datos = {
        nombre: 'Gaseosa',
        descripcion: '',
        precio: '2000',
        stock_minimo: '5',
        codigo_barras: null,
        categoria: 1,
        unidad: 1,
    };

    it('no detecta cambios cuando solo cambia el formato del número', () => {
        expect(cambiosDe(original, datos)).toEqual({});
    });

    it('trata un código de barras vacío de la API igual que null', () => {
        expect(cambiosDe({ ...original, codigo_barras: '' }, datos)).toEqual({});
    });

    it('devuelve solo los campos que cambiaron', () => {
        const cambios = cambiosDe(original, { ...datos, nombre: 'Gaseosa 1,5 L', precio: '2100.50', unidad: 2 });

        expect(cambios).toEqual({ nombre: 'Gaseosa 1,5 L', precio: '2100.50', unidad: 2 });
    });
});
