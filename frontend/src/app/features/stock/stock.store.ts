import { Injectable, computed, inject, signal } from '@angular/core';
import { Subscription } from 'rxjs';

import { MovimientoStock, Producto, TipoMovimiento, UsuarioListado } from '../../core/api/modelos';
import { ProductosApi } from '../../core/api/productos.api';
import { FiltrosMovimientos, StockApi } from '../../core/api/stock.api';
import { UsuariosApi } from '../../core/api/usuarios.api';
import { formatearCantidad } from '../../core/utils/decimal';
import { mensajeDeError } from '../../core/utils/errores';
import { FormularioAjuste, FormularioIngreso, validarAjuste, validarIngreso } from './stock-form';

/** Mismo tamaño de página que usa el backend para los movimientos. */
export const TAMANO_PAGINA = 50;
const ORDEN_MOVIMIENTOS = '-fecha_hora';

export interface FiltrosStock {
    texto: string;
    producto: number | null;
    tipo: TipoMovimiento | null;
    usuario: number | null;
    /** Día calendario AAAA-MM-DD. Vacío: sin límite. */
    desde: string;
    hasta: string;
}

const FILTROS_INICIALES: FiltrosStock = {
    texto: '',
    producto: null,
    tipo: null,
    usuario: null,
    desde: '',
    hasta: '',
};

export interface OpcionesInicio {
    /** Solo el Administrador puede listar usuarios: el Repositor no los pide. */
    cargarUsuarios: boolean;
}

function mensajeExito(prefijo: string, movimiento: MovimientoStock, producto: Producto | null): string {
    const unidad = producto ? ` ${producto.unidad_abreviatura}` : '';
    return `${prefijo}: ${movimiento.producto_nombre}, stock actual ${formatearCantidad(movimiento.stock_resultante)}${unidad}.`;
}

/** Estado de la pantalla Stock. Se provee en el componente: se destruye al salir de la pantalla. */
@Injectable()
export class StockStore {
    readonly #stockApi = inject(StockApi);
    readonly #productosApi = inject(ProductosApi);
    readonly #usuariosApi = inject(UsuariosApi);

    readonly #filtros = signal<FiltrosStock>({ ...FILTROS_INICIALES });
    readonly #productos = signal<Producto[]>([]);
    readonly #usuarios = signal<UsuarioListado[]>([]);
    readonly #errorCatalogos = signal<string | null>(null);
    readonly #movimientos = signal<MovimientoStock[]>([]);
    readonly #total = signal(0);
    readonly #pagina = signal(1);
    readonly #cargando = signal(false);
    readonly #errorCarga = signal<string | null>(null);
    readonly #errorFiltros = signal<string | null>(null);
    readonly #guardando = signal(false);
    readonly #erroresCampos = signal<Partial<Record<string, string>>>({});
    readonly #errorFormulario = signal<string | null>(null);
    readonly #exito = signal<string | null>(null);

    #peticion?: Subscription;

    readonly filtros = this.#filtros.asReadonly();
    readonly productos = this.#productos.asReadonly();
    readonly usuarios = this.#usuarios.asReadonly();
    readonly errorCatalogos = this.#errorCatalogos.asReadonly();
    readonly movimientos = this.#movimientos.asReadonly();
    readonly total = this.#total.asReadonly();
    readonly pagina = this.#pagina.asReadonly();
    readonly cargando = this.#cargando.asReadonly();
    readonly errorCarga = this.#errorCarga.asReadonly();
    readonly errorFiltros = this.#errorFiltros.asReadonly();
    readonly guardando = this.#guardando.asReadonly();
    readonly erroresCampos = this.#erroresCampos.asReadonly();
    readonly errorFormulario = this.#errorFormulario.asReadonly();
    /** Mensaje persistente del último ingreso o ajuste registrado. */
    readonly exito = this.#exito.asReadonly();

    readonly totalPaginas = computed(() => Math.max(1, Math.ceil(this.#total() / TAMANO_PAGINA)));

    /** El ingreso solo admite productos activos (RN-10). */
    readonly productosParaIngreso = computed(() => this.#productos().filter((producto) => producto.activo));

    /** El ajuste admite cualquier producto: el stock de un desactivado también se corrige. */
    readonly productosParaAjuste = computed(() => this.#productos());

    /** Carga productos (con inactivos), usuarios si corresponde, y la primera página de movimientos. */
    iniciar(opciones: OpcionesInicio = { cargarUsuarios: false }): void {
        this.#errorCatalogos.set(null);
        this.#cargarProductos();
        if (opciones.cargarUsuarios) {
            this.#usuariosApi.listar().subscribe({
                next: (usuarios) => this.#usuarios.set(usuarios),
                error: (error: unknown) =>
                    this.#errorCatalogos.set(mensajeDeError(error, 'No se pudieron cargar los usuarios.')),
            });
        }
        this.buscar();
    }

    actualizarFiltros(cambios: Partial<FiltrosStock>): void {
        this.#filtros.update((actuales) => ({ ...actuales, ...cambios }));
    }

    limpiarFiltros(): void {
        this.#filtros.set({ ...FILTROS_INICIALES });
        this.buscar();
    }

    /** Consulta la primera página con los filtros actuales. */
    buscar(): void {
        this.#consultar(1);
    }

    /** Consulta otra página con los mismos filtros. Ignora páginas que no existen. */
    irAPagina(pagina: number): void {
        if (!Number.isInteger(pagina) || pagina < 1 || pagina > this.totalPaginas()) {
            return;
        }
        this.#consultar(pagina);
    }

    /** Valida y registra un ingreso. `alTerminar` se llama solo si salió bien. */
    ingresar(formulario: FormularioIngreso, alTerminar?: () => void): void {
        if (this.#guardando()) {
            return;
        }
        const resultado = validarIngreso(formulario);
        this.#erroresCampos.set(resultado.errores);
        this.#errorFormulario.set(null);
        if (!resultado.datos) {
            return;
        }
        this.#guardando.set(true);
        this.#exito.set(null);
        this.#stockApi.ingresar(resultado.datos).subscribe({
            next: (movimiento) =>
                this.#terminar(mensajeExito('Ingreso registrado', movimiento, formulario.producto), alTerminar),
            error: (error: unknown) => this.#fallar(error, 'No se pudo registrar el ingreso.'),
        });
    }

    /** Valida y registra un ajuste. `alTerminar` se llama solo si salió bien. */
    ajustar(formulario: FormularioAjuste, alTerminar?: () => void): void {
        if (this.#guardando()) {
            return;
        }
        const resultado = validarAjuste(formulario);
        this.#erroresCampos.set(resultado.errores);
        this.#errorFormulario.set(null);
        if (!resultado.datos) {
            return;
        }
        this.#guardando.set(true);
        this.#exito.set(null);
        this.#stockApi.ajustar(resultado.datos).subscribe({
            next: (movimiento) =>
                this.#terminar(mensajeExito('Ajuste registrado', movimiento, formulario.producto), alTerminar),
            error: (error: unknown) => this.#fallar(error, 'No se pudo registrar el ajuste.'),
        });
    }

    /** Descarta los errores del formulario (al abrirlo de nuevo). */
    limpiarFormulario(): void {
        this.#erroresCampos.set({});
        this.#errorFormulario.set(null);
    }

    descartarExito(): void {
        this.#exito.set(null);
    }

    #cargarProductos(): void {
        this.#productosApi.listar({ incluir_inactivos: true }).subscribe({
            next: (productos) => this.#productos.set(productos),
            error: (error: unknown) =>
                this.#errorCatalogos.set(mensajeDeError(error, 'No se pudieron cargar los productos.')),
        });
    }

    #consultar(pagina: number): void {
        const filtros = this.#filtros();
        const error = this.#validar(filtros);
        this.#errorFiltros.set(error);
        if (error) {
            return;
        }
        this.#peticion?.unsubscribe();
        this.#cargando.set(true);
        this.#errorCarga.set(null);
        this.#peticion = this.#stockApi.movimientos(this.#aParametros(filtros, pagina)).subscribe({
            next: (resultado) => {
                this.#movimientos.set(resultado.results);
                this.#total.set(resultado.count);
                this.#pagina.set(pagina);
                this.#cargando.set(false);
            },
            error: (error: unknown) => {
                this.#errorCarga.set(mensajeDeError(error, 'No se pudieron cargar los movimientos.'));
                this.#cargando.set(false);
            },
        });
    }

    /** Después de registrar: el stock de los productos cambió y hay un movimiento nuevo. */
    #terminar(mensaje: string, alTerminar?: () => void): void {
        this.#guardando.set(false);
        this.#exito.set(mensaje);
        this.#cargarProductos();
        this.buscar();
        alTerminar?.();
    }

    #fallar(error: unknown, porDefecto: string): void {
        this.#errorFormulario.set(mensajeDeError(error, porDefecto));
        this.#guardando.set(false);
    }

    #validar(filtros: FiltrosStock): string | null {
        // AAAA-MM-DD ordena igual como texto que como fecha.
        if (filtros.desde && filtros.hasta && filtros.desde > filtros.hasta) {
            return 'La fecha final no puede ser anterior a la inicial.';
        }
        return null;
    }

    #aParametros(filtros: FiltrosStock, pagina: number): FiltrosMovimientos {
        return {
            search: filtros.texto.trim(),
            producto: filtros.producto ?? undefined,
            tipo: filtros.tipo ?? undefined,
            usuario: filtros.usuario ?? undefined,
            desde: filtros.desde,
            hasta: filtros.hasta,
            ordering: ORDEN_MOVIMIENTOS,
            page: pagina,
            page_size: TAMANO_PAGINA,
        };
    }
}
