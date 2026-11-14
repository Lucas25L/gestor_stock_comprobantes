import { Injectable, inject, signal } from '@angular/core';
import { Subscription } from 'rxjs';

import { ComprobantesApi } from '../../core/api/comprobantes.api';
import { Comprobante } from '../../core/api/modelos';
import { mensajeDeError } from '../../core/utils/errores';

/** Estado de la vista imprimible de un comprobante. Se provee en el componente. */
@Injectable()
export class ComprobanteStore {
    readonly #comprobantesApi = inject(ComprobantesApi);

    readonly #comprobante = signal<Comprobante | null>(null);
    readonly #cargando = signal(false);
    readonly #errorCarga = signal<string | null>(null);

    #peticion?: Subscription;

    readonly comprobante = this.#comprobante.asReadonly();
    readonly cargando = this.#cargando.asReadonly();
    readonly errorCarga = this.#errorCarga.asReadonly();

    /** Carga el comprobante por id. Cancela la carga anterior y vacía el comprobante en pantalla. */
    cargar(id: number): void {
        this.#peticion?.unsubscribe();
        this.#comprobante.set(null);
        this.#cargando.set(true);
        this.#errorCarga.set(null);
        this.#peticion = this.#comprobantesApi.obtener(id).subscribe({
            next: (comprobante) => {
                this.#comprobante.set(comprobante);
                this.#cargando.set(false);
            },
            error: (error: unknown) => {
                this.#errorCarga.set(mensajeDeError(error, 'No se pudo cargar el comprobante.'));
                this.#cargando.set(false);
            },
        });
    }
}
