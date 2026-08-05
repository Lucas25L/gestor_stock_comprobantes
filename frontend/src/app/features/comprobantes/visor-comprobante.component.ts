import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';

import { VentaService } from '../ventas/venta.service';

@Component({
    selector: 'app-visor-comprobante',
    standalone: true,
    imports: [CommonModule, ButtonModule, TableModule],
    templateUrl: './visor-comprobante.component.html',
    styleUrl: './visor-comprobante.component.css'
})
export class VisorComprobanteComponent {
    private ventaService = inject(VentaService);

    public venta = this.ventaService.ultimaVenta;
    public comprobante = this.ventaService.ultimoComprobante;

    public hayComprobante = computed(() => this.venta() !== null && this.comprobante() !== null);

    public numeroFormateado = computed(() => {
        const numero = this.comprobante()?.numero;
        return numero ? numero.toString().padStart(8, '0') : '';
    });

    imprimir(): void {
        window.print();
    }
}

