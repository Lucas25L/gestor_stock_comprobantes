import { Component, OnInit, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MessageModule } from 'primeng/message';

import { MENU } from '../../core/navegacion';
import { AuthService } from '../../core/services/auth.service';
import { formatearDinero } from '../../core/utils/decimal';
import { DashboardStore } from './dashboard.store';

/** Texto de apoyo de cada acceso directo, según la ruta del menú. */
const DESCRIPCIONES: Record<string, string> = {
    '/ventas/nueva': 'Registrar una venta y actualizar el stock.',
    '/ventas/historial': 'Consultar, anular y emitir comprobantes de ventas.',
    '/productos': 'Ver el catálogo de productos y sus precios.',
    '/stock': 'Registrar ingresos, ajustes y consultar movimientos.',
    '/reposicion': 'Productos con stock bajo para planificar la compra.',
    '/indicadores': 'Ventas del período con gráficos y rankings.',
    '/catalogos': 'Administrar categorías, unidades de medida y medios de pago.',
};

@Component({
    selector: 'app-dashboard',
    standalone: true,
    imports: [RouterLink, MessageModule],
    // El estado vive con la pantalla: al salir o cerrar sesión se destruye.
    providers: [DashboardStore],
    templateUrl: './dashboard.component.html',
    styleUrl: './dashboard.component.css',
})
export class DashboardComponent implements OnInit {
    readonly authService = inject(AuthService);
    readonly store = inject(DashboardStore);

    readonly formatearDinero = formatearDinero;

    readonly esAdministrador = computed(() => this.authService.tieneRol(['Administrador']));

    /** Mismas pantallas que el menú lateral para este rol, sin la propia pantalla de inicio. */
    readonly accesos = computed(() =>
        MENU.filter((item) => item.ruta !== '/dashboard' && this.authService.tieneRol(item.roles)).map((item) => ({
            ...item,
            descripcion: DESCRIPCIONES[item.ruta] ?? '',
        })),
    );

    ngOnInit(): void {
        this.store.cargar();
    }
}
