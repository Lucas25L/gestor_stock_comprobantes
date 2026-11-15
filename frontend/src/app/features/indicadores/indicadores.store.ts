import { Injectable, inject, signal } from '@angular/core';
import { Subscription, forkJoin } from 'rxjs';

import { IndicadoresApi } from '../../core/api/indicadores.api';
import {
    CategoriaMasVendida,
    IndicadorMedioPago,
    ProductoMasVendido,
    ResumenVentas,
} from '../../core/api/modelos';
import { mensajeDeError } from '../../core/utils/errores';
import { DatosConsulta } from './indicadores-form';

/** Estado de la pantalla Indicadores. Se provee en el componente: se destruye al salir de la pantalla. */
@Injectable()
export class IndicadoresStore {
    readonly #api = inject(IndicadoresApi);

    readonly #resumen = signal<ResumenVentas | null>(null);
    readonly #mediosPago = signal<IndicadorMedioPago[]>([]);
    readonly #productos = signal<ProductoMasVendido[]>([]);
    readonly #categorias = signal<CategoriaMasVendida[]>([]);
    readonly #cargando = signal(false);
    readonly #consultado = signal(false);
    readonly #errorCarga = signal<string | null>(null);

    #peticion?: Subscription;

    readonly resumen = this.#resumen.asReadonly();
    readonly mediosPago = this.#mediosPago.asReadonly();
    readonly productos = this.#productos.asReadonly();
    readonly categorias = this.#categorias.asReadonly();
    readonly cargando = this.#cargando.asReadonly();
    /** Verdadero cuando al menos una consulta terminó bien. */
    readonly consultado = this.#consultado.asReadonly();
    readonly errorCarga = this.#errorCarga.asReadonly();

    /**
     * Consulta los cuatro indicadores del período. Cancela la consulta anterior si seguía en curso
     * y limpia los datos viejos para no mostrarlos bajo un período distinto.
     */
    cargar(consulta: DatosConsulta, unidad?: number): void {
        this.#peticion?.unsubscribe();
        this.#resumen.set(null);
        this.#mediosPago.set([]);
        this.#productos.set([]);
        this.#categorias.set([]);
        this.#consultado.set(false);
        this.#errorCarga.set(null);
        this.#cargando.set(true);

        const { periodo, limite } = consulta;
        this.#peticion = forkJoin({
            resumen: this.#api.resumen(periodo),
            mediosPago: this.#api.porMedioPago(periodo),
            productos: this.#api.productosMasVendidos({ ...periodo, limite, unidad }),
            categorias: this.#api.categoriasMasVendidas({ ...periodo, limite }),
        }).subscribe({
            next: (datos) => {
                this.#resumen.set(datos.resumen);
                this.#mediosPago.set(datos.mediosPago);
                this.#productos.set(datos.productos);
                this.#categorias.set(datos.categorias);
                this.#consultado.set(true);
                this.#cargando.set(false);
            },
            error: (error: unknown) => {
                this.#errorCarga.set(mensajeDeError(error, 'No se pudieron cargar los indicadores.'));
                this.#cargando.set(false);
            },
        });
    }
}
