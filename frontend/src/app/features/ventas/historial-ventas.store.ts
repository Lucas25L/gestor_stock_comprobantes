import { Injectable, computed, inject, signal } from '@angular/core';
import { Subscription } from 'rxjs';

import { ComprobantesApi } from '../../core/api/comprobantes.api';
import { MediosPagoApi } from '../../core/api/medios-pago.api';
import { MedioPago, Venta } from '../../core/api/modelos';
import { FiltrosVentas, VentasApi } from '../../core/api/ventas.api';
import { compararDecimales, normalizarImporte, sumarDinero } from '../../core/utils/decimal';
import { mensajeDeError } from '../../core/utils/errores';
import { RangoPreset, rangoDe } from '../../core/utils/fechas';

/** Mismo límite que el campo motivo del backend. */
const MAXIMO_MOTIVO = 255;

export interface FiltrosHistorial {
    desde: string;
    hasta: string;
    medioPago: number | null;
    texto: string;
    totalMin: string;
    totalMax: string;
    incluirAnuladas: boolean;
}

function filtrosIniciales(hoy: Date): FiltrosHistorial {
    const { desde, hasta } = rangoDe('hoy', hoy);
    return { desde, hasta, medioPago: null, texto: '', totalMin: '', totalMax: '', incluirAnuladas: false };
}

/** Estado del historial de ventas. Se provee en el componente: se destruye al salir de la pantalla. */
@Injectable()
export class HistorialVentasStore {
    readonly #ventasApi = inject(VentasApi);
    readonly #mediosPagoApi = inject(MediosPagoApi);
    readonly #comprobantesApi = inject(ComprobantesApi);

    readonly #filtros = signal<FiltrosHistorial>(filtrosIniciales(new Date()));
    readonly #ventas = signal<Venta[]>([]);
    readonly #mediosPago = signal<MedioPago[]>([]);
    readonly #cargando = signal(false);
    readonly #errorCarga = signal<string | null>(null);
    readonly #errorFiltros = signal<string | null>(null);
    readonly #anulando = signal(false);
    readonly #errorAnulacion = signal<string | null>(null);
    readonly #emitiendoVenta = signal<number | null>(null);
    readonly #errorComprobante = signal<string | null>(null);

    /** Las anuladas solo se muestran si el listado se pidió con ese filtro. */
    #anuladasEnLista = false;
    #peticion?: Subscription;

    readonly filtros = this.#filtros.asReadonly();
    readonly ventas = this.#ventas.asReadonly();
    readonly mediosPago = this.#mediosPago.asReadonly();
    readonly cargando = this.#cargando.asReadonly();
    readonly errorCarga = this.#errorCarga.asReadonly();
    readonly errorFiltros = this.#errorFiltros.asReadonly();
    readonly anulando = this.#anulando.asReadonly();
    readonly errorAnulacion = this.#errorAnulacion.asReadonly();
    readonly emitiendoVenta = this.#emitiendoVenta.asReadonly();
    readonly errorComprobante = this.#errorComprobante.asReadonly();

    /** Cantidad y total de las ventas NO anuladas que están en pantalla. */
    readonly resumen = computed(() => {
        const todas = this.#ventas();
        const vigentes = todas.filter((venta) => venta.activa);
        return {
            cantidad: vigentes.length,
            total: sumarDinero(vigentes.map((venta) => venta.total)),
            anuladas: todas.length - vigentes.length,
        };
    });

    /** Arranca en el día de hoy: el listado no está paginado y conviene acotarlo. */
    iniciar(hoy: Date = new Date()): void {
        this.#filtros.set(filtrosIniciales(hoy));
        this.#mediosPagoApi.listar().subscribe({
            next: (medios) => this.#mediosPago.set(medios),
            error: () => undefined,
        });
        this.buscar();
    }

    actualizarFiltros(cambios: Partial<FiltrosHistorial>): void {
        this.#filtros.update((actuales) => ({ ...actuales, ...cambios }));
    }

    aplicarRango(preset: RangoPreset, hoy: Date = new Date()): void {
        this.actualizarFiltros(rangoDe(preset, hoy));
        this.buscar();
    }

    limpiarFiltros(hoy: Date = new Date()): void {
        this.#filtros.set(filtrosIniciales(hoy));
        this.buscar();
    }

    /** Consulta con los filtros actuales. Cancela la consulta anterior si seguía en curso. */
    buscar(): void {
        const filtros = this.#filtros();
        const error = this.#validar(filtros);
        this.#errorFiltros.set(error);
        if (error) {
            return;
        }
        this.#peticion?.unsubscribe();
        this.#cargando.set(true);
        this.#errorCarga.set(null);
        this.#peticion = this.#ventasApi.listar(this.#aParametros(filtros)).subscribe({
            next: (ventas) => {
                this.#anuladasEnLista = filtros.incluirAnuladas;
                this.#ventas.set(ventas);
                this.#cargando.set(false);
            },
            error: (error: unknown) => {
                this.#errorCarga.set(mensajeDeError(error, 'No se pudo cargar el historial de ventas.'));
                this.#cargando.set(false);
            },
        });
    }

    /** Anula la venta. `alTerminar` se llama solo si salió bien (la pantalla cierra el diálogo). */
    anular(venta: Venta, motivo: string, alTerminar?: () => void): void {
        if (this.#anulando()) {
            return;
        }
        const texto = motivo.trim();
        if (!texto) {
            this.#errorAnulacion.set('El motivo de la anulación es obligatorio.');
            return;
        }
        if (texto.length > MAXIMO_MOTIVO) {
            this.#errorAnulacion.set(`El motivo no puede superar los ${MAXIMO_MOTIVO} caracteres.`);
            return;
        }
        this.#anulando.set(true);
        this.#errorAnulacion.set(null);
        this.#ventasApi.anular(venta.id, texto).subscribe({
            next: (actualizada) => {
                this.#reemplazar(actualizada);
                this.#anulando.set(false);
                alTerminar?.();
            },
            error: (error: unknown) => {
                this.#errorAnulacion.set(mensajeDeError(error, 'No se pudo anular la venta.'));
                this.#anulando.set(false);
            },
        });
    }

    /** Descarta el error de un intento anterior (al abrir el diálogo de nuevo). */
    limpiarErrorAnulacion(): void {
        this.#errorAnulacion.set(null);
    }

    /** Emite el comprobante de una venta del historial. Una emisión a la vez. */
    emitirComprobante(venta: Venta): void {
        if (this.#emitiendoVenta() !== null || venta.comprobante !== null || !venta.activa) {
            return;
        }
        this.#emitiendoVenta.set(venta.id);
        this.#errorComprobante.set(null);
        this.#comprobantesApi.emitir(venta.id).subscribe({
            next: (comprobante) => {
                this.#reemplazar({
                    ...venta,
                    comprobante: comprobante.id,
                    comprobante_numero: comprobante.numero_formateado,
                });
                this.#emitiendoVenta.set(null);
            },
            error: (error: unknown) => {
                this.#errorComprobante.set(mensajeDeError(error, 'No se pudo emitir el comprobante.'));
                this.#emitiendoVenta.set(null);
            },
        });
    }

    #validar(filtros: FiltrosHistorial): string | null {
        if (!filtros.desde || !filtros.hasta) {
            return 'Elegí el período: fecha desde y fecha hasta.';
        }
        if (filtros.desde > filtros.hasta) {
            return 'La fecha final no puede ser anterior a la inicial.';
        }
        const minimo = filtros.totalMin.trim() ? normalizarImporte(filtros.totalMin) : '';
        const maximo = filtros.totalMax.trim() ? normalizarImporte(filtros.totalMax) : '';
        if (minimo === null || maximo === null) {
            return 'Los montos deben ser números sin separador de miles, por ejemplo 1500 o 1500,50.';
        }
        if (minimo && maximo && compararDecimales(minimo, maximo) > 0) {
            return 'El monto máximo no puede ser menor que el mínimo.';
        }
        return null;
    }

    #aParametros(filtros: FiltrosHistorial): FiltrosVentas {
        return {
            desde: filtros.desde,
            hasta: filtros.hasta,
            medio_pago: filtros.medioPago ?? undefined,
            search: filtros.texto.trim(),
            total_min: normalizarImporte(filtros.totalMin) ?? undefined,
            total_max: normalizarImporte(filtros.totalMax) ?? undefined,
            incluir_inactivas: filtros.incluirAnuladas || undefined,
        };
    }

    /** Reemplaza la venta en la lista; si quedó anulada y la lista no muestra anuladas, la quita. */
    #reemplazar(actualizada: Venta): void {
        this.#ventas.update((ventas) =>
            !actualizada.activa && !this.#anuladasEnLista
                ? ventas.filter((venta) => venta.id !== actualizada.id)
                : ventas.map((venta) => (venta.id === actualizada.id ? actualizada : venta)),
        );
    }
}
