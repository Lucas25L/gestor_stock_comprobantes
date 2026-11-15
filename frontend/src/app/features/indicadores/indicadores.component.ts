import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { UIChart } from 'primeng/chart';
import { DatePickerModule } from 'primeng/datepicker';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';

import { UnidadesApi } from '../../core/api/unidades.api';
import { UnidadMedida } from '../../core/api/modelos';
import { formatearCantidad, formatearDinero } from '../../core/utils/decimal';
import { RangoPreset, fechaDesdeISO, fechaISO, rangoDe } from '../../core/utils/fechas';
import { ErroresFormulario } from '../stock/stock-form';
import { FormularioPeriodo, periodoInicial, validarPeriodo } from './indicadores-form';
import { IndicadoresStore } from './indicadores.store';

@Component({
    selector: 'app-indicadores',
    standalone: true,
    imports: [FormsModule, ButtonModule, DatePickerModule, MessageModule, SelectModule, TableModule, UIChart],
    // El estado vive con la pantalla: al salir o cerrar sesión se destruye.
    providers: [IndicadoresStore],
    templateUrl: './indicadores.component.html',
    styleUrl: './indicadores.component.css',
})
export class IndicadoresComponent implements OnInit {
    readonly #destroyRef = inject(DestroyRef);
    readonly #unidadesApi = inject(UnidadesApi);
    readonly store = inject(IndicadoresStore);

    readonly formatearDinero = formatearDinero;
    readonly formatearCantidad = formatearCantidad;

    /** No hay ventas en el futuro: el selector de fechas no deja pasar de hoy. */
    readonly hoy = new Date();

    readonly formulario = signal<FormularioPeriodo>(periodoInicial(this.hoy));
    readonly errores = signal<ErroresFormulario<FormularioPeriodo>>({});
    readonly unidad = signal<number | null>(null);
    readonly unidades = signal<UnidadMedida[]>([]);
    readonly errorUnidades = signal<string | null>(null);

    readonly desde = computed(() => fechaDesdeISO(this.formulario().desde));
    readonly hasta = computed(() => fechaDesdeISO(this.formulario().hasta));

    readonly opcionesLimite = ['5', '10', '20', '50'].map((valor) => ({ valor, etiqueta: valor }));
    readonly opcionesUnidad = computed(() => [
        { id: null as number | null, nombre: 'Todas' },
        ...this.unidades().map((u) => ({ id: u.id as number | null, nombre: `${u.nombre} (${u.abreviatura})` })),
    ]);

    /** Chart.js necesita números: se convierte solo para dibujar, las cifras mostradas siguen siendo texto. */
    readonly graficoMediosPago = computed(() => {
        const filas = this.store.mediosPago();
        return {
            labels: filas.map((f) => f.nombre),
            datasets: [{ data: filas.map((f) => Number(f.total)) }],
        };
    });

    readonly graficoCategorias = computed(() => {
        const filas = this.store.categorias();
        return {
            labels: filas.map((f) => f.nombre),
            datasets: [{ label: 'Importe vendido', data: filas.map((f) => Number(f.importe)) }],
        };
    });

    /** Unidad común del ranking de productos, o null si mezcla unidades (comparar kilos con unidades engaña). */
    readonly unidadProductos = computed(() => {
        const unidades = new Set(this.store.productos().map((p) => p.unidad));
        return unidades.size === 1 ? [...unidades][0] : null;
    });

    readonly graficoProductos = computed(() => {
        const filas = this.store.productos();
        return {
            labels: filas.map((f) => f.nombre),
            datasets: [{ label: 'Cantidad vendida', data: filas.map((f) => Number(f.cantidad_vendida)) }],
        };
    });

    readonly opcionesBarras = {
        indexAxis: 'y' as const,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { x: { beginAtZero: true } },
    };

    readonly opcionesDona = {
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' as const } },
    };

    ngOnInit(): void {
        this.#unidadesApi
            .listar()
            .pipe(takeUntilDestroyed(this.#destroyRef))
            .subscribe({
                next: (unidades) => this.unidades.set(unidades),
                error: () => this.errorUnidades.set('No se pudieron cargar las unidades de medida.'),
            });
        this.consultar();
    }

    cambiarDesde(valor: unknown): void {
        this.formulario.update((f) => ({ ...f, desde: valor instanceof Date ? fechaISO(valor) : '' }));
    }

    cambiarHasta(valor: unknown): void {
        this.formulario.update((f) => ({ ...f, hasta: valor instanceof Date ? fechaISO(valor) : '' }));
    }

    cambiarLimite(valor: string): void {
        this.formulario.update((f) => ({ ...f, limite: valor }));
    }

    aplicarRango(preset: RangoPreset): void {
        const { desde, hasta } = rangoDe(preset, new Date());
        this.formulario.update((f) => ({ ...f, desde, hasta }));
        this.consultar();
    }

    /** Valida el formulario; si hay errores los muestra y no consulta. */
    consultar(): void {
        const { errores, datos } = validarPeriodo(this.formulario());
        this.errores.set(errores);
        if (!datos) {
            return;
        }
        this.store.cargar(datos, this.unidad() ?? undefined);
    }
}
