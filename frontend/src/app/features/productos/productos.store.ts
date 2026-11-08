import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, Subscription, forkJoin } from 'rxjs';

import { CategoriasApi } from '../../core/api/categorias.api';
import { Categoria, DatosProducto, Producto, UnidadMedida } from '../../core/api/modelos';
import { FiltrosProductos as FiltrosApi, ProductosApi } from '../../core/api/productos.api';
import { StockApi } from '../../core/api/stock.api';
import { UnidadesApi } from '../../core/api/unidades.api';
import { compararDecimales } from '../../core/utils/decimal';
import { mensajeDeError } from '../../core/utils/errores';
import { CampoProducto, FormularioProducto, validarProducto } from './producto-form';

const MOTIVO_STOCK_INICIAL = 'Stock inicial';

export interface FiltrosLista {
    texto: string;
    categoria: number | null;
    unidad: number | null;
    soloStockBajo: boolean;
    incluirInactivos: boolean;
}

const FILTROS_INICIALES: FiltrosLista = {
    texto: '',
    categoria: null,
    unidad: null,
    soloStockBajo: false,
    incluirInactivos: false,
};

/** Campos que cambiaron respecto del producto original (para enviar solo esos con PATCH). */
export function cambiosDe(original: Producto, datos: DatosProducto): Partial<DatosProducto> {
    const cambios: Partial<DatosProducto> = {};
    if (original.nombre !== datos.nombre) {
        cambios.nombre = datos.nombre;
    }
    if (original.descripcion !== datos.descripcion) {
        cambios.descripcion = datos.descripcion;
    }
    // Los importes se comparan por valor: "2000.00" y "2000" son lo mismo.
    if (compararDecimales(original.precio, datos.precio) !== 0) {
        cambios.precio = datos.precio;
    }
    if (compararDecimales(original.stock_minimo, datos.stock_minimo) !== 0) {
        cambios.stock_minimo = datos.stock_minimo;
    }
    if ((original.codigo_barras || null) !== datos.codigo_barras) {
        cambios.codigo_barras = datos.codigo_barras;
    }
    if (original.categoria !== datos.categoria) {
        cambios.categoria = datos.categoria;
    }
    if (original.unidad !== datos.unidad) {
        cambios.unidad = datos.unidad;
    }
    return cambios;
}

/** El backend informa el código de barras repetido en inglés: se traduce. */
function mensajeProducto(error: unknown, porDefecto: string): string {
    if (
        error instanceof HttpErrorResponse &&
        error.status === 400 &&
        typeof error.error === 'object' &&
        error.error !== null &&
        'codigo_barras' in error.error
    ) {
        return 'Ya existe un producto con ese código de barras.';
    }
    return mensajeDeError(error, porDefecto);
}

/** Estado de la pantalla Productos. Se provee en el componente: se destruye al salir de la pantalla. */
@Injectable()
export class ProductosStore {
    readonly #productosApi = inject(ProductosApi);
    readonly #categoriasApi = inject(CategoriasApi);
    readonly #unidadesApi = inject(UnidadesApi);
    readonly #stockApi = inject(StockApi);

    readonly #filtros = signal<FiltrosLista>({ ...FILTROS_INICIALES });
    readonly #productos = signal<Producto[]>([]);
    readonly #categorias = signal<Categoria[]>([]);
    readonly #unidades = signal<UnidadMedida[]>([]);
    readonly #cargando = signal(false);
    readonly #errorCarga = signal<string | null>(null);
    readonly #errorCatalogos = signal<string | null>(null);
    readonly #guardando = signal(false);
    readonly #erroresCampos = signal<Partial<Record<CampoProducto, string>>>({});
    readonly #errorFormulario = signal<string | null>(null);
    readonly #aviso = signal<string | null>(null);
    readonly #cambiandoEstado = signal<number | null>(null);
    readonly #errorOperacion = signal<string | null>(null);

    #peticion?: Subscription;

    readonly filtros = this.#filtros.asReadonly();
    readonly productos = this.#productos.asReadonly();
    readonly categorias = this.#categorias.asReadonly();
    readonly unidades = this.#unidades.asReadonly();
    readonly cargando = this.#cargando.asReadonly();
    readonly errorCarga = this.#errorCarga.asReadonly();
    readonly errorCatalogos = this.#errorCatalogos.asReadonly();
    readonly guardando = this.#guardando.asReadonly();
    readonly erroresCampos = this.#erroresCampos.asReadonly();
    readonly errorFormulario = this.#errorFormulario.asReadonly();
    /** Mensaje persistente cuando el producto se creó pero el stock inicial no se pudo cargar. */
    readonly aviso = this.#aviso.asReadonly();
    /** Id del producto que se está desactivando o reactivando. */
    readonly cambiandoEstado = this.#cambiandoEstado.asReadonly();
    readonly errorOperacion = this.#errorOperacion.asReadonly();

    readonly cantidadStockBajo = computed(
        () => this.#productos().filter((producto) => producto.stock_bajo).length,
    );

    /** Carga las categorías y unidades activas (para filtros y formulario) y el listado. */
    iniciar(): void {
        forkJoin({
            categorias: this.#categoriasApi.listar(),
            unidades: this.#unidadesApi.listar(),
        }).subscribe({
            next: ({ categorias, unidades }) => {
                this.#categorias.set(categorias);
                this.#unidades.set(unidades);
            },
            error: (error: unknown) =>
                this.#errorCatalogos.set(
                    mensajeDeError(error, 'No se pudieron cargar las categorías y las unidades.'),
                ),
        });
        this.buscar();
    }

    actualizarFiltros(cambios: Partial<FiltrosLista>): void {
        this.#filtros.update((actuales) => ({ ...actuales, ...cambios }));
    }

    limpiarFiltros(): void {
        this.#filtros.set({ ...FILTROS_INICIALES });
        this.buscar();
    }

    /** Consulta con los filtros actuales. Cancela la consulta anterior si seguía en curso. */
    buscar(): void {
        this.#peticion?.unsubscribe();
        this.#cargando.set(true);
        this.#errorCarga.set(null);
        this.#peticion = this.#productosApi.listar(this.#aParametros(this.#filtros())).subscribe({
            next: (productos) => {
                this.#productos.set(productos);
                this.#cargando.set(false);
            },
            error: (error: unknown) => {
                this.#errorCarga.set(mensajeDeError(error, 'No se pudo cargar el listado de productos.'));
                this.#cargando.set(false);
            },
        });
    }

    /**
     * Valida y guarda. Con `original` edita; sin él, crea. `alTerminar` se llama cuando el
     * formulario ya no tiene nada pendiente (la pantalla lo cierra).
     */
    guardar(formulario: FormularioProducto, original: Producto | null, alTerminar?: () => void): void {
        if (this.#guardando()) {
            return;
        }
        const resultado = validarProducto(formulario, this.#unidades(), original ? 'editar' : 'crear');
        this.#erroresCampos.set(resultado.errores);
        this.#errorFormulario.set(null);
        if (!resultado.datos) {
            return;
        }
        if (original) {
            this.#editar(original, resultado.datos, alTerminar);
        } else {
            this.#crear(resultado.datos, resultado.stockInicial, alTerminar);
        }
    }

    /** Descarta los errores del formulario (al abrirlo de nuevo). */
    limpiarFormulario(): void {
        this.#erroresCampos.set({});
        this.#errorFormulario.set(null);
    }

    descartarAviso(): void {
        this.#aviso.set(null);
    }

    desactivar(producto: Producto): void {
        this.#cambiarEstado(
            producto.id,
            this.#productosApi.desactivar(producto.id),
            'No se pudo desactivar el producto.',
        );
    }

    reactivar(producto: Producto): void {
        this.#cambiarEstado(
            producto.id,
            this.#productosApi.reactivar(producto.id),
            'No se pudo reactivar el producto.',
        );
    }

    #crear(datos: DatosProducto, stockInicial: string | undefined, alTerminar?: () => void): void {
        this.#guardando.set(true);
        this.#productosApi.crear(datos).subscribe({
            next: (producto) => {
                if (!stockInicial) {
                    this.#terminar(alTerminar);
                    return;
                }
                this.#stockApi
                    .ingresar({ producto: producto.id, cantidad: stockInicial, motivo: MOTIVO_STOCK_INICIAL })
                    .subscribe({
                        next: () => this.#terminar(alTerminar),
                        error: (error: unknown) => {
                            // El producto ya existe: no se puede deshacer, se avisa qué falta.
                            this.#aviso.set(
                                `El producto "${producto.nombre}" se creó, pero no se pudo cargar el stock inicial. ` +
                                    `${mensajeDeError(error, 'Ocurrió un error inesperado.')} Cargalo desde Stock.`,
                            );
                            this.#terminar(alTerminar);
                        },
                    });
            },
            error: (error: unknown) => {
                this.#errorFormulario.set(mensajeProducto(error, 'No se pudo crear el producto.'));
                this.#guardando.set(false);
            },
        });
    }

    #editar(original: Producto, datos: DatosProducto, alTerminar?: () => void): void {
        const cambios = cambiosDe(original, datos);
        if (Object.keys(cambios).length === 0) {
            alTerminar?.();
            return;
        }
        this.#guardando.set(true);
        this.#productosApi.actualizar(original.id, cambios).subscribe({
            next: () => this.#terminar(alTerminar),
            error: (error: unknown) => {
                this.#errorFormulario.set(mensajeProducto(error, 'No se pudo guardar el producto.'));
                this.#guardando.set(false);
            },
        });
    }

    #terminar(alTerminar?: () => void): void {
        this.#guardando.set(false);
        this.buscar();
        alTerminar?.();
    }

    #cambiarEstado(id: number, peticion: Observable<unknown>, mensajeDefecto: string): void {
        if (this.#cambiandoEstado() !== null) {
            return;
        }
        this.#cambiandoEstado.set(id);
        this.#errorOperacion.set(null);
        peticion.subscribe({
            next: () => {
                this.#cambiandoEstado.set(null);
                this.buscar();
            },
            error: (error: unknown) => {
                this.#errorOperacion.set(mensajeDeError(error, mensajeDefecto));
                this.#cambiandoEstado.set(null);
            },
        });
    }

    #aParametros(filtros: FiltrosLista): FiltrosApi {
        return {
            search: filtros.texto.trim(),
            categoria: filtros.categoria ?? undefined,
            unidad: filtros.unidad ?? undefined,
            stock_bajo: filtros.soloStockBajo || undefined,
            incluir_inactivos: filtros.incluirInactivos || undefined,
        };
    }
}
