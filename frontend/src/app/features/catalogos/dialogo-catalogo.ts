import { WritableSignal, signal } from '@angular/core';

/** Estado de un diálogo de alta y edición: abierto, qué se edita y el formulario. */
export class DialogoCatalogo<T, F extends object> {
    readonly abierto = signal(false);
    /** Registro que se está editando; null si el diálogo es un alta. */
    readonly editando = signal<T | null>(null);
    readonly formulario: WritableSignal<F>;

    constructor(
        private readonly vacio: F,
        private readonly formularioDe: (item: T) => F,
    ) {
        this.formulario = signal({ ...vacio });
    }

    abrirAlta(): void {
        this.editando.set(null);
        this.formulario.set({ ...this.vacio });
        this.abierto.set(true);
    }

    abrirEdicion(item: T): void {
        this.editando.set(item);
        this.formulario.set(this.formularioDe(item));
        this.abierto.set(true);
    }

    cerrar(): void {
        this.abierto.set(false);
    }

    cambiar<K extends keyof F>(campo: K, valor: F[K]): void {
        this.formulario.update((actual) => ({ ...actual, [campo]: valor }));
    }
}
