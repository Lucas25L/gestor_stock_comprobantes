import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';

import { Venta } from '../../core/api/modelos';
import { formatearCantidad, formatearDinero } from '../../core/utils/decimal';
import { fechaDesdeISO, fechaISO, formatearFechaHora } from '../../core/utils/fechas';
import { HistorialVentasStore } from './historial-ventas.store';

@Component({
    selector: 'app-historial-ventas',
    standalone: true,
    imports: [
        FormsModule,
        RouterLink,
        ButtonModule,
        DatePickerModule,
        DialogModule,
        InputTextModule,
        MessageModule,
        SelectModule,
        TableModule,
        TagModule,
    ],
    // El estado vive con la pantalla: al salir o cerrar sesión se destruye.
    providers: [HistorialVentasStore],
    templateUrl: './historial-ventas.component.html',
    styleUrl: './historial-ventas.component.css',
})
export class HistorialVentasComponent implements OnInit {
    readonly store = inject(HistorialVentasStore);

    readonly formatearDinero = formatearDinero;
    readonly formatearCantidad = formatearCantidad;
    readonly formatearFechaHora = formatearFechaHora;

    /** No se registran ventas en el futuro: el selector de fechas no deja pasar de hoy. */
    readonly hoy = new Date();

    readonly desde = computed(() => fechaDesdeISO(this.store.filtros().desde));
    readonly hasta = computed(() => fechaDesdeISO(this.store.filtros().hasta));

    readonly opcionesMedioPago = computed(() => [
        { id: null as number | null, nombre: 'Todos' },
        ...this.store.mediosPago().map((medio) => ({ id: medio.id as number | null, nombre: medio.nombre })),
    ]);

    readonly expandidas = signal<Record<string, boolean>>({});
    readonly ventaAAnular = signal<Venta | null>(null);
    readonly motivo = signal('');

    ngOnInit(): void {
        this.store.iniciar();
    }

    cambiarDesde(valor: unknown): void {
        this.store.actualizarFiltros({ desde: valor instanceof Date ? fechaISO(valor) : '' });
    }

    cambiarHasta(valor: unknown): void {
        this.store.actualizarFiltros({ hasta: valor instanceof Date ? fechaISO(valor) : '' });
    }

    alternar(venta: Venta): void {
        const clave = String(venta.id);
        this.expandidas.update((actuales) => {
            const copia = { ...actuales };
            if (copia[clave]) {
                delete copia[clave];
            } else {
                copia[clave] = true;
            }
            return copia;
        });
    }

    abrirAnulacion(venta: Venta): void {
        this.store.limpiarErrorAnulacion();
        this.motivo.set('');
        this.ventaAAnular.set(venta);
    }

    cerrarAnulacion(): void {
        this.ventaAAnular.set(null);
    }

    confirmarAnulacion(): void {
        const venta = this.ventaAAnular();
        if (venta) {
            this.store.anular(venta, this.motivo(), () => this.cerrarAnulacion());
        }
    }
}
