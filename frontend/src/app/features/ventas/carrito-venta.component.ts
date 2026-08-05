import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';

import { Producto } from '../productos/producto.model';
import { ProductoService } from '../productos/producto.service';
import { VentaService } from './venta.service';

@Component({
    selector: 'app-carrito-venta',
    standalone: true,
    imports: [CommonModule, FormsModule, TableModule, ButtonModule, SelectModule, InputTextModule],
    templateUrl: './carrito-venta.component.html',
    styleUrl: './carrito-venta.component.css'
})
export class CarritoVentaComponent {
    private productoService = inject(ProductoService);
    private ventaService = inject(VentaService);
    private router = inject(Router);

    public listaProductos = this.productoService.productos;
    public itemsCarrito = this.ventaService.carrito;
    public totalEstimado = this.ventaService.totalEstimado;

    productoSeleccionado: Producto | null = null;
    cantidadSeleccionada = 1;

    procesando = signal(false);
    error = signal<string | null>(null);

    agregarItem(): void {
        if (this.productoSeleccionado) {
            this.ventaService.agregarAlCarrito(this.productoSeleccionado, this.cantidadSeleccionada);
            this.productoSeleccionado = null;
            this.cantidadSeleccionada = 1;
        }
    }

    eliminarItem(id: number): void {
        this.ventaService.quitarDelCarrito(id);
    }

    facturar(): void {
        if (this.itemsCarrito().length === 0) {
            return;
        }

        this.procesando.set(true);
        this.error.set(null);

        this.ventaService.confirmarVentaYEmitir().subscribe({
            next: () => {
                this.procesando.set(false);
                this.router.navigate(['/comprobantes']);
            },
            error: (err) => {
                this.procesando.set(false);

                const yaSeCreoLaVenta = this.ventaService.ultimaVenta() !== null
                    && this.ventaService.ultimoComprobante() === null;

                this.error.set(
                    yaSeCreoLaVenta
                        ? 'La venta se registró, pero hubo un problema al emitir el comprobante. Podés reintentar desde el historial de ventas.'
                        : 'No se pudo registrar la venta. Verificá el stock disponible e intentá de nuevo.'
                );

                console.error(err);
            }
        });
    }
}