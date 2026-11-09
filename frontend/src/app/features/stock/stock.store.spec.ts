import { HttpRequest, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { MovimientoStock, Pagina, Producto, UsuarioListado } from '../../core/api/modelos';
import { formatearCantidad } from '../../core/utils/decimal';
import { AJUSTE_VACIO, FormularioAjuste, FormularioIngreso, INGRESO_VACIO } from './stock-form';
import { StockStore } from './stock.store';

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

function movimiento(datos: Partial<MovimientoStock> = {}): MovimientoStock {
    return {
        id: 1,
        producto: 5,
        producto_nombre: 'Pan francés',
        usuario: 1,
        usuario_username: 'Lucas_Lopez',
        tipo: 'ingreso',
        tipo_display: 'Ingreso de mercadería',
        cantidad: '10.500',
        stock_resultante: '15.500',
        motivo: 'Compra a proveedor',
        referencia_origen: '',
        fecha_hora: '2026-11-09T10:00:00-03:00',
        ...datos,
    };
}

function pagina(results: MovimientoStock[], count: number = results.length): Pagina<MovimientoStock> {
    return { count, next: null, previous: null, results };
}

const usuarios: UsuarioListado[] = [
    {
        id: 1,
        username: 'Lucas_Lopez',
        email: '',
        first_name: '',
        last_name: '',
        rol: 1,
        rol_nombre: 'Administrador',
        is_active: true,
        date_joined: '',
    },
    {
        id: 3,
        username: 'Repositor-Prueba',
        email: '',
        first_name: '',
        last_name: '',
        rol: 3,
        rol_nombre: 'Repositor',
        is_active: true,
        date_joined: '',
    },
];

const pan = producto({
    id: 5,
    nombre: 'Pan francés',
    stock: '12.500',
    unidad: 2,
    unidad_nombre: 'Kilogramo',
    unidad_abreviatura: 'kg',
    unidad_permite_decimales: true,
});
const gaseosaInactiva = producto({ id: 6, nombre: 'Gaseosa', activo: false });

const ingresoValido: FormularioIngreso = {
    ...INGRESO_VACIO,
    producto: pan,
    cantidad: '10,5',
    motivo: 'Compra a proveedor',
};
const ajusteValido: FormularioAjuste = {
    ...AJUSTE_VACIO,
    producto: pan,
    cantidad: '2,5',
    motivo: 'Merma',
};

describe('StockStore', () => {
    const PRODUCTOS = `${environment.apiUrl}/productos/`;
    const USUARIOS = `${environment.apiUrl}/usuarios/`;
    const MOVIMIENTOS = `${environment.apiUrl}/stock/movimientos/`;
    const INGRESOS = `${environment.apiUrl}/stock/ingresos/`;
    const AJUSTES = `${environment.apiUrl}/stock/ajustes/`;
    const ERROR_400 = { status: 400, statusText: 'Bad Request' };
    const ERROR_500 = { status: 500, statusText: 'Server Error' };

    let store: StockStore;
    let http: HttpTestingController;

    // Con parámetros en la URL, expectOne(texto) no coincide: se compara solo la ruta.
    const esUrl = (url: string) => (peticion: HttpRequest<unknown>) => peticion.url === url;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [StockStore, provideHttpClient(), provideHttpClientTesting()],
        });
        store = TestBed.inject(StockStore);
        http = TestBed.inject(HttpTestingController);
    });

    afterEach(() => http.verify());

    function iniciar(
        opciones: { usuarios?: boolean; movimientos?: Pagina<MovimientoStock> } = {},
    ): void {
        const conUsuarios = opciones.usuarios ?? false;
        store.iniciar({ cargarUsuarios: conUsuarios });
        http.expectOne(esUrl(PRODUCTOS)).flush([pan, gaseosaInactiva]);
        if (conUsuarios) {
            http.expectOne(USUARIOS).flush(usuarios);
        }
        http.expectOne(esUrl(MOVIMIENTOS)).flush(opciones.movimientos ?? pagina([]));
    }

    /** Lo que ocurre después de un ingreso o ajuste exitoso: se recargan productos y movimientos. */
    function recargar(): void {
        http.expectOne(esUrl(PRODUCTOS)).flush([pan, gaseosaInactiva]);
        http.expectOne(esUrl(MOVIMIENTOS)).flush(pagina([]));
    }

    describe('carga', () => {
        it('carga los productos con inactivos y la primera página de movimientos, más recientes primero', () => {
            store.iniciar({ cargarUsuarios: false });
            expect(store.cargando()).toBe(true);

            const productos = http.expectOne(esUrl(PRODUCTOS));
            expect(productos.request.params.get('incluir_inactivos')).toBe('true');
            productos.flush([pan]);

            const movimientos = http.expectOne(esUrl(MOVIMIENTOS));
            expect(movimientos.request.method).toBe('GET');
            expect([...movimientos.request.params.keys()].sort()).toEqual(['ordering', 'page', 'page_size']);
            expect(movimientos.request.params.get('page')).toBe('1');
            expect(movimientos.request.params.get('page_size')).toBe('50');
            expect(movimientos.request.params.get('ordering')).toBe('-fecha_hora');
            movimientos.flush(pagina([movimiento()], 120));

            expect(store.cargando()).toBe(false);
            expect(store.productos()).toEqual([pan]);
            expect(store.movimientos()).toEqual([movimiento()]);
            expect(store.total()).toBe(120);
            expect(store.pagina()).toBe(1);
            expect(store.totalPaginas()).toBe(3);
        });

        it('carga los usuarios solo cuando se pide (Administrador)', () => {
            iniciar({ usuarios: true });

            expect(store.usuarios()).toEqual(usuarios);
        });

        it('informa el error si no se pueden cargar los movimientos', () => {
            store.iniciar({ cargarUsuarios: false });
            http.expectOne(esUrl(PRODUCTOS)).flush([pan]);
            http.expectOne(esUrl(MOVIMIENTOS)).flush('x', ERROR_500);

            expect(store.errorCarga()).toContain('problema');
            expect(store.cargando()).toBe(false);
        });

        it('informa el error si no se pueden cargar los productos', () => {
            store.iniciar({ cargarUsuarios: false });
            http.expectOne(esUrl(PRODUCTOS)).flush('x', ERROR_500);
            http.expectOne(esUrl(MOVIMIENTOS)).flush(pagina([]));

            expect(store.errorCatalogos()).toContain('problema');
        });
    });

    describe('filtros y paginación', () => {
        it('envía los filtros informados', () => {
            iniciar();
            store.actualizarFiltros({
                texto: '  pan ',
                producto: 5,
                tipo: 'ajuste',
                usuario: 3,
                desde: '2026-11-01',
                hasta: '2026-11-09',
            });
            store.buscar();

            const peticion = http.expectOne(esUrl(MOVIMIENTOS));
            const params = peticion.request.params;
            expect(params.get('search')).toBe('pan');
            expect(params.get('producto')).toBe('5');
            expect(params.get('tipo')).toBe('ajuste');
            expect(params.get('usuario')).toBe('3');
            expect(params.get('desde')).toBe('2026-11-01');
            expect(params.get('hasta')).toBe('2026-11-09');
            expect(params.get('page')).toBe('1');
            peticion.flush(pagina([]));
        });

        it('buscar vuelve siempre a la primera página', () => {
            iniciar({ movimientos: pagina([], 120) });
            store.irAPagina(3);
            const tercera = http.expectOne(esUrl(MOVIMIENTOS));
            expect(tercera.request.params.get('page')).toBe('3');
            tercera.flush(pagina([], 120));
            expect(store.pagina()).toBe(3);

            store.buscar();
            const primera = http.expectOne(esUrl(MOVIMIENTOS));
            expect(primera.request.params.get('page')).toBe('1');
            primera.flush(pagina([], 120));

            expect(store.pagina()).toBe(1);
        });

        it('cambiar de página conserva los filtros', () => {
            iniciar({ movimientos: pagina([], 120) });
            store.actualizarFiltros({ texto: 'pan', tipo: 'venta' });

            store.irAPagina(2);

            const peticion = http.expectOne(esUrl(MOVIMIENTOS));
            expect(peticion.request.params.get('page')).toBe('2');
            expect(peticion.request.params.get('search')).toBe('pan');
            expect(peticion.request.params.get('tipo')).toBe('venta');
            peticion.flush(pagina([], 120));
        });

        it('ignora las páginas que no existen', () => {
            iniciar({ movimientos: pagina([], 120) });

            store.irAPagina(0);
            store.irAPagina(4);
            store.irAPagina(1.5);

            http.expectNone(esUrl(MOVIMIENTOS));
        });

        it('calcula el total de páginas de a 50 movimientos, con un mínimo de una', () => {
            iniciar();
            expect(store.totalPaginas()).toBe(1);

            const totalPaginasCon = (cantidad: number): number => {
                store.buscar();
                http.expectOne(esUrl(MOVIMIENTOS)).flush(pagina([], cantidad));
                return store.totalPaginas();
            };

            expect(totalPaginasCon(50)).toBe(1);
            expect(totalPaginasCon(51)).toBe(2);
            expect(totalPaginasCon(120)).toBe(3);
        });

        it('no consulta si la fecha final es anterior a la inicial, y vuelve a consultar al corregirla', () => {
            iniciar();
            store.actualizarFiltros({ desde: '2026-11-10', hasta: '2026-11-01' });

            store.buscar();

            expect(store.errorFiltros()).toContain('fecha final');
            http.expectNone(esUrl(MOVIMIENTOS));

            store.actualizarFiltros({ hasta: '2026-11-10' });
            store.buscar();

            expect(store.errorFiltros()).toBeNull();
            http.expectOne(esUrl(MOVIMIENTOS)).flush(pagina([]));
        });

        it('acepta un período con un solo extremo', () => {
            iniciar();
            store.actualizarFiltros({ desde: '2026-11-01' });

            store.buscar();

            const peticion = http.expectOne(esUrl(MOVIMIENTOS));
            expect(peticion.request.params.get('desde')).toBe('2026-11-01');
            expect(peticion.request.params.has('hasta')).toBe(false);
            peticion.flush(pagina([]));
        });

        it('cancela la consulta anterior si se busca de nuevo', () => {
            iniciar();
            store.buscar();
            store.buscar();

            const [primera, segunda] = http.match(esUrl(MOVIMIENTOS));
            expect(primera.cancelled).toBe(true);
            segunda.flush(pagina([movimiento()]));

            expect(store.movimientos()).toEqual([movimiento()]);
            expect(store.cargando()).toBe(false);
        });

        it('limpiar vuelve a los filtros iniciales y busca', () => {
            iniciar();
            store.actualizarFiltros({ texto: 'pan', producto: 5, tipo: 'venta', usuario: 1, desde: '2026-11-01' });

            store.limpiarFiltros();

            expect(store.filtros()).toEqual({
                texto: '',
                producto: null,
                tipo: null,
                usuario: null,
                desde: '',
                hasta: '',
            });
            http.expectOne(esUrl(MOVIMIENTOS)).flush(pagina([]));
        });
    });

    describe('ingreso', () => {
        it('no consulta al servidor si el formulario es inválido y deja los errores por campo', () => {
            iniciar();
            let terminado = false;

            store.ingresar(INGRESO_VACIO, () => (terminado = true));

            expect(Object.keys(store.erroresCampos()).sort()).toEqual(['motivo', 'producto']);
            expect(store.guardando()).toBe(false);
            expect(terminado).toBe(false);
        });

        it('registra el ingreso, recarga productos y movimientos y avisa el stock resultante', () => {
            iniciar();
            let terminado = false;

            store.ingresar({ ...ingresoValido, referencia: 'Remito 0001-123' }, () => (terminado = true));
            expect(store.guardando()).toBe(true);

            const peticion = http.expectOne(INGRESOS);
            expect(peticion.request.method).toBe('POST');
            expect(peticion.request.body).toEqual({
                producto: 5,
                cantidad: '10.5',
                motivo: 'Compra a proveedor',
                referencia: 'Remito 0001-123',
            });
            peticion.flush(movimiento({ stock_resultante: '15.500' }));
            recargar();

            expect(store.guardando()).toBe(false);
            expect(terminado).toBe(true);
            expect(store.exito()).toContain('Ingreso registrado');
            expect(store.exito()).toContain('Pan francés');
            expect(store.exito()).toContain(`${formatearCantidad('15.500')} kg`);
        });

        it('sin referencia no la envía', () => {
            iniciar();

            store.ingresar(ingresoValido);

            const peticion = http.expectOne(INGRESOS);
            expect(peticion.request.body).toEqual({ producto: 5, cantidad: '10.5', motivo: 'Compra a proveedor' });
            peticion.flush(movimiento());
            recargar();
        });

        it('muestra el error de negocio del backend y no recarga nada', () => {
            iniciar();
            let terminado = false;

            store.ingresar(ingresoValido, () => (terminado = true));
            http.expectOne(INGRESOS).flush(
                { detail: '"Gaseosa" está desactivado y no puede recibir ingresos de mercadería.' },
                ERROR_400,
            );

            expect(store.errorFormulario()).toBe(
                '"Gaseosa" está desactivado y no puede recibir ingresos de mercadería.',
            );
            expect(store.guardando()).toBe(false);
            expect(terminado).toBe(false);
            expect(store.exito()).toBeNull();
        });

        it('muestra el error de un campo informado por el backend', () => {
            iniciar();

            store.ingresar(ingresoValido);
            http.expectOne(INGRESOS).flush({ motivo: ['Este campo no puede estar en blanco.'] }, ERROR_400);

            expect(store.errorFormulario()).toBe('Este campo no puede estar en blanco.');
        });

        it('no envía dos veces si se registra de nuevo mientras espera', () => {
            iniciar();

            store.ingresar(ingresoValido);
            store.ingresar(ingresoValido);

            http.expectOne(INGRESOS).flush(movimiento()); // expectOne falla si hubiera dos peticiones
            recargar();
        });
    });

    describe('ajuste', () => {
        it('disminuir envía la cantidad con signo negativo', () => {
            iniciar();

            store.ajustar({ ...ajusteValido, sentido: 'disminuir' });

            const peticion = http.expectOne(AJUSTES);
            expect(peticion.request.method).toBe('POST');
            expect(peticion.request.body).toEqual({ producto: 5, cantidad: '-2.5', motivo: 'Merma' });
            peticion.flush(movimiento({ tipo: 'ajuste', cantidad: '-2.500', stock_resultante: '10.000' }));
            recargar();
        });

        it('aumentar envía la cantidad positiva', () => {
            iniciar();

            store.ajustar({ ...ajusteValido, sentido: 'aumentar' });

            const peticion = http.expectOne(AJUSTES);
            expect(peticion.request.body).toEqual({ producto: 5, cantidad: '2.5', motivo: 'Merma' });
            peticion.flush(movimiento({ tipo: 'ajuste', cantidad: '2.500', stock_resultante: '15.000' }));
            recargar();
        });

        it('no consulta si se descuenta más que el stock visible', () => {
            iniciar();

            store.ajustar({ ...ajusteValido, sentido: 'disminuir', cantidad: '20' });

            expect(store.erroresCampos()['cantidad']).toContain('No podés descontar');
            expect(store.guardando()).toBe(false);
            http.expectNone(AJUSTES);
        });

        it('informa el rechazo del backend por stock insuficiente', () => {
            iniciar();

            store.ajustar({ ...ajusteValido, sentido: 'disminuir' });
            http.expectOne(AJUSTES).flush(
                { detail: 'Stock insuficiente para "Pan francés". Disponible: 1.000, solicitado: 2.500.' },
                ERROR_400,
            );

            expect(store.errorFormulario()).toContain('Stock insuficiente');
            expect(store.guardando()).toBe(false);
        });

        it('registra el ajuste, recarga y avisa el stock resultante', () => {
            iniciar();
            let terminado = false;

            store.ajustar(ajusteValido, () => (terminado = true));
            http.expectOne(AJUSTES).flush(movimiento({ tipo: 'ajuste', stock_resultante: '15.000' }));
            recargar();

            expect(terminado).toBe(true);
            expect(store.exito()).toContain('Ajuste registrado');
            expect(store.exito()).toContain(`${formatearCantidad('15.000')} kg`);
        });
    });

    describe('selectores y mensajes', () => {
        it('el ingreso ofrece solo productos activos y el ajuste ofrece todos', () => {
            iniciar();

            expect(store.productosParaIngreso()).toEqual([pan]);
            expect(store.productosParaAjuste()).toEqual([pan, gaseosaInactiva]);
        });

        it('descarta el mensaje de éxito y los errores del formulario', () => {
            iniciar();

            store.ingresar(INGRESO_VACIO);
            expect(Object.keys(store.erroresCampos()).length).toBeGreaterThan(0);
            store.limpiarFormulario();
            expect(store.erroresCampos()).toEqual({});
            expect(store.errorFormulario()).toBeNull();

            store.ingresar(ingresoValido);
            http.expectOne(INGRESOS).flush(movimiento());
            recargar();
            expect(store.exito()).not.toBeNull();
            store.descartarExito();
            expect(store.exito()).toBeNull();
        });
    });
});
