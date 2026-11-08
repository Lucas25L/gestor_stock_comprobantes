import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AutoCompleteModule } from 'primeng/autocomplete';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';

import { Producto } from '../../core/api/modelos';
import { formatearCantidad, formatearDinero } from '../../core/utils/decimal';
import { CarritoService } from './carrito.service';
import { NuevaVentaStore } from './nueva-venta.store';

@Component({
    selector: 'app-nueva-venta',
    standalone: true,
    imports: [
        FormsModule,
        AutoCompleteModule,
        ButtonModule,
        InputTextModule,
        MessageModule,
        SelectModule,
        TableModule,
        TagModule,
    ],
    // El carrito y el estado viven con la pantalla: al salir o cerrar sesión se destruyen.
    providers: [CarritoService, NuevaVentaStore],
    templateUrl: './nueva-venta.component.html',
    styleUrl: './nueva-venta.component.css',
})
export class NuevaVentaComponent implements OnInit {
    readonly store = inject(NuevaVentaStore);
    readonly carrito = this.store.carrito;

    readonly formatearDinero = formatearDinero;
    readonly formatearCantidad = formatearCantidad;

    readonly sugerencias = signal<Producto[]>([]);
    /** Texto que se está escribiendo (string) o producto elegido; se limpia al agregarlo. */
    busqueda: Producto | string | null = null;
    readonly avisoBusqueda = signal<string | null>(null);
    readonly erroresCantidad = signal<Record<number, string>>({});

    /** Por qué todavía no se puede confirmar (null si se puede). */
    readonly pista = computed(() => {
        if (this.carrito.vacio()) {
            return 'Agregá al menos un producto.';
        }
        if (this.carrito.hayExcesoDeStock()) {
            return 'Hay productos que superan el stock disponible.';
        }
        if (this.store.medioPagoId() === null) {
            return 'Elegí el medio de pago.';
        }
        return null;
    });

    ngOnInit(): void {
        this.store.cargar();
    }

    buscar(evento: { query: string }): void {
        this.sugerencias.set(this.store.buscar(evento.query));
    }

    alSeleccionar(evento: { value: Producto }): void {
        this.agregar(evento.value);
    }

    /** Un lector de códigos de barras escribe el código y envía Enter. */
    alEnter(): void {
        if (typeof this.busqueda !== 'string') {
            return;
        }
        const producto = this.store.porCodigoBarras(this.busqueda);
        if (producto) {
            this.agregar(producto);
        }
    }

    cantidadVisible(cantidad: string): string {
        return cantidad.replace('.', ',');
    }

    cambiarCantidad(productoId: number, texto: string): void {
        const error = this.carrito.cambiarCantidad(productoId, texto);
        this.erroresCantidad.update((errores) => {
            const copia = { ...errores };
            if (error) {
                copia[productoId] = error;
            } else {
                delete copia[productoId];
            }
            return copia;
        });
    }

    quitar(productoId: number): void {
        this.carrito.quitar(productoId);
        this.erroresCantidad.update((errores) => {
            const copia = { ...errores };
            delete copia[productoId];
            return copia;
        });
    }

    nuevaVenta(): void {
        this.store.nuevaVenta();
        this.busqueda = null;
        this.avisoBusqueda.set(null);
        this.erroresCantidad.set({});
    }

    private agregar(producto: Producto): void {
        this.avisoBusqueda.set(this.carrito.agregar(producto, '1'));
        this.busqueda = null;
    }
}
