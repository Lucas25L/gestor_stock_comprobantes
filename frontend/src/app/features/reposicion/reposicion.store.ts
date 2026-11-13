import { Injectable, inject, signal } from '@angular/core';
import { Subscription } from 'rxjs';

import { Producto } from '../../core/api/modelos';
import { ProductosApi } from '../../core/api/productos.api';
import { mensajeDeError } from '../../core/utils/errores';

/** Estado de la pantalla Reposición. Se provee en el componente: se destruye al salir de la pantalla. */
@Injectable()
export class ReposicionStore {
    readonly #productosApi = inject(ProductosApi);

    readonly #productos = signal<Producto[]>([]);
    readonly #cargando = signal(false);
    readonly #errorCarga = signal<string | null>(null);

    #peticion?: Subscription;

    /** Productos con stock bajo, en el orden que informa el servidor (mayor faltante primero). */
    readonly productos = this.#productos.asReadonly();
    readonly cargando = this.#cargando.asReadonly();
    readonly errorCarga = this.#errorCarga.asReadonly();

    /** Consulta la lista de reposición. Cancela la consulta anterior si seguía en curso. */
    cargar(): void {
        this.#peticion?.unsubscribe();
        this.#cargando.set(true);
        this.#errorCarga.set(null);
        this.#peticion = this.#productosApi.stockBajo().subscribe({
            next: (productos) => {
                this.#productos.set(productos);
                this.#cargando.set(false);
            },
            error: (error: unknown) => {
                this.#errorCarga.set(mensajeDeError(error, 'No se pudo cargar la lista de reposición.'));
                this.#cargando.set(false);
            },
        });
    }
}
