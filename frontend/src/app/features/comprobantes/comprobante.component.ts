import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';

import { formatearCantidad, formatearDinero } from '../../core/utils/decimal';
import { formatearFechaHora } from '../../core/utils/fechas';
import { ComprobanteStore } from './comprobante.store';
import { idDeRuta } from './id-comprobante';

/** Vista imprimible de un comprobante interno (HU-19). Ruta: /comprobantes/:id */
@Component({
    selector: 'app-comprobante',
    standalone: true,
    imports: [RouterLink, ButtonModule, MessageModule],
    providers: [ComprobanteStore],
    templateUrl: './comprobante.component.html',
    styleUrl: './comprobante.component.css',
})
export class ComprobanteComponent {
    protected readonly store = inject(ComprobanteStore);
    readonly #ruta = inject(ActivatedRoute);

    readonly #idInvalido = signal(false);
    protected readonly idInvalido = this.#idInvalido.asReadonly();

    protected readonly dinero = formatearDinero;
    protected readonly cantidad = formatearCantidad;
    protected readonly fechaHora = formatearFechaHora;

    constructor() {
        this.#ruta.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
            const id = idDeRuta(params.get('id'));
            this.#idInvalido.set(id === null);
            if (id !== null) {
                this.store.cargar(id);
            }
        });
    }

    protected imprimir(): void {
        window.print();
    }
}
