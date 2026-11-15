import { signal } from '@angular/core';
import { Observable, Subscription } from 'rxjs';

import { mensajeDeError } from '../../core/utils/errores';
import { ErroresFormulario } from '../stock/stock-form';

/** Lo que cambia entre catálogos: las llamadas al servidor y la validación. */
export interface ConfigSeccion<T extends { id: number }, F, D extends object> {
    /** Con artículo, para los mensajes: "la categoría", "el medio de pago". */
    etiqueta: string;
    listar: (incluirInactivos: boolean) => Observable<T[]>;
    crear: (datos: D) => Observable<unknown>;
    actualizar: (id: number, cambios: Partial<D>) => Observable<unknown>;
    desactivar: (id: number) => Observable<unknown>;
    reactivar: (id: number) => Observable<unknown>;
    validar: (formulario: F) => { errores: ErroresFormulario<F>; datos?: D };
}

/** Solo los campos de `datos` que difieren del registro original (PATCH parcial). */
function cambiosDe<D extends object>(original: object, datos: D): Partial<D> {
    const base = original as Record<string, unknown>;
    const cambios: Record<string, unknown> = {};
    for (const [clave, valor] of Object.entries(datos)) {
        if (base[clave] !== valor) {
            cambios[clave] = valor;
        }
    }
    return cambios as Partial<D>;
}

/** Estado y operaciones de un catálogo (lista, alta, edición, baja y reactivación). */
export class SeccionCatalogo<T extends { id: number }, F, D extends object> {
    readonly #items = signal<T[]>([]);
    readonly #incluirInactivos = signal(false);
    readonly #cargando = signal(false);
    readonly #errorCarga = signal<string | null>(null);
    readonly #guardando = signal(false);
    readonly #erroresCampos = signal<ErroresFormulario<F>>({});
    readonly #errorFormulario = signal<string | null>(null);
    readonly #cambiandoEstado = signal<number | null>(null);
    readonly #errorOperacion = signal<string | null>(null);

    #peticion?: Subscription;

    readonly items = this.#items.asReadonly();
    readonly incluirInactivos = this.#incluirInactivos.asReadonly();
    readonly cargando = this.#cargando.asReadonly();
    readonly errorCarga = this.#errorCarga.asReadonly();
    readonly guardando = this.#guardando.asReadonly();
    readonly erroresCampos = this.#erroresCampos.asReadonly();
    /** Error del servidor al guardar: se muestra dentro del diálogo. */
    readonly errorFormulario = this.#errorFormulario.asReadonly();
    /** Id del registro que se está activando o desactivando, o null. */
    readonly cambiandoEstado = this.#cambiandoEstado.asReadonly();
    readonly errorOperacion = this.#errorOperacion.asReadonly();

    constructor(private readonly config: ConfigSeccion<T, F, D>) {}

    /** Consulta la lista. Cancela la consulta anterior si seguía en curso. */
    cargar(): void {
        this.#peticion?.unsubscribe();
        this.#cargando.set(true);
        this.#errorCarga.set(null);
        this.#peticion = this.config.listar(this.#incluirInactivos()).subscribe({
            next: (items) => {
                this.#items.set(items);
                this.#cargando.set(false);
            },
            error: (error: unknown) => {
                this.#errorCarga.set(mensajeDeError(error, 'No se pudo cargar el listado.'));
                this.#cargando.set(false);
            },
        });
    }

    mostrarInactivos(valor: boolean): void {
        this.#incluirInactivos.set(valor);
        this.cargar();
    }

    /** Valida y guarda. Con `original` edita (solo lo que cambió); sin él, crea. */
    guardar(formulario: F, original: T | null, alTerminar?: () => void): void {
        if (this.#guardando()) {
            return;
        }
        const resultado = this.config.validar(formulario);
        this.#erroresCampos.set(resultado.errores);
        this.#errorFormulario.set(null);
        if (!resultado.datos) {
            return;
        }

        let peticion: Observable<unknown>;
        if (original) {
            const cambios = cambiosDe(original, resultado.datos);
            if (Object.keys(cambios).length === 0) {
                alTerminar?.();
                return;
            }
            peticion = this.config.actualizar(original.id, cambios);
        } else {
            peticion = this.config.crear(resultado.datos);
        }

        this.#guardando.set(true);
        peticion.subscribe({
            next: () => {
                this.#guardando.set(false);
                this.cargar();
                alTerminar?.();
            },
            error: (error: unknown) => {
                this.#errorFormulario.set(mensajeDeError(error, `No se pudo guardar ${this.config.etiqueta}.`));
                this.#guardando.set(false);
            },
        });
    }

    /** Descarta los errores del formulario (al abrirlo de nuevo). */
    limpiarFormulario(): void {
        this.#erroresCampos.set({});
        this.#errorFormulario.set(null);
    }

    desactivar(item: T): void {
        this.#cambiarEstado(item.id, this.config.desactivar(item.id), `No se pudo desactivar ${this.config.etiqueta}.`);
    }

    reactivar(item: T): void {
        this.#cambiarEstado(item.id, this.config.reactivar(item.id), `No se pudo reactivar ${this.config.etiqueta}.`);
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
                this.cargar();
            },
            error: (error: unknown) => {
                this.#errorOperacion.set(mensajeDeError(error, mensajeDefecto));
                this.#cambiandoEstado.set(null);
            },
        });
    }
}
