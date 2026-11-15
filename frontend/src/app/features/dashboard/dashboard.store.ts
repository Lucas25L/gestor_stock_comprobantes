import { Injectable, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';

import { IndicadoresApi } from '../../core/api/indicadores.api';
import { ResumenVentas } from '../../core/api/modelos';
import { ProductosApi } from '../../core/api/productos.api';
import { AuthService } from '../../core/services/auth.service';
import { mensajeDeError } from '../../core/utils/errores';
import { rangoDe } from '../../core/utils/fechas';

/** Estado del Dashboard. Las tres consultas son independientes: si una falla, las otras se muestran igual. */
@Injectable()
export class DashboardStore {
    readonly #auth = inject(AuthService);
    readonly #productosApi = inject(ProductosApi);
    readonly #indicadoresApi = inject(IndicadoresApi);

    readonly #cantidadStockBajo = signal<number | null>(null);
    readonly #resumenHoy = signal<ResumenVentas | null>(null);
    readonly #resumenMes = signal<ResumenVentas | null>(null);
    readonly #errorStock = signal<string | null>(null);
    readonly #errorVentas = signal<string | null>(null);

    readonly cantidadStockBajo = this.#cantidadStockBajo.asReadonly();
    readonly resumenHoy = this.#resumenHoy.asReadonly();
    readonly resumenMes = this.#resumenMes.asReadonly();
    readonly errorStock = this.#errorStock.asReadonly();
    readonly errorVentas = this.#errorVentas.asReadonly();

    cargar(ahora: Date = new Date()): void {
        // Stock bajo: lo consultan los tres roles.
        this.#productosApi.stockBajo().subscribe({
            next: (productos) => this.#cantidadStockBajo.set(productos.length),
            error: (error: unknown) =>
                this.#errorStock.set(mensajeDeError(error, 'No se pudo consultar el stock bajo.')),
        });

        // Indicadores: solo el Administrador (el resto recibiría 403, así que ni se piden).
        if (!this.#auth.tieneRol(['Administrador'])) {
            return;
        }
        forkJoin({
            hoy: this.#indicadoresApi.resumen(rangoDe('hoy', ahora)),
            mes: this.#indicadoresApi.resumen(rangoDe('mes', ahora)),
        }).subscribe({
            next: ({ hoy, mes }) => {
                this.#resumenHoy.set(hoy);
                this.#resumenMes.set(mes);
            },
            error: (error: unknown) =>
                this.#errorVentas.set(mensajeDeError(error, 'No se pudo consultar el resumen de ventas.')),
        });
    }
}
