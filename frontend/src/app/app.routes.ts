import { Routes } from '@angular/router';

import { ACCESO } from './core/navegacion';
import { authGuard } from './core/guards/auth.guard';
import { rolGuard } from './core/guards/rol.guard';
import { AppLayoutComponent } from './layouts/app-layout.component';
import { LoginComponent } from './features/auth/login.component';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { ProductosComponent } from './features/productos/productos.component';
import { NuevaVentaComponent } from './features/ventas/nueva-venta.component';
import { HistorialVentasComponent } from './features/ventas/historial-ventas.component';
import { VisorComprobanteComponent } from './features/comprobantes/visor-comprobante.component';

export const routes: Routes = [
    { path: '', redirectTo: 'dashboard', pathMatch: 'full' },

    // Login: fuera del layout y sin guard.
    { path: 'login', component: LoginComponent },

    // Rutas protegidas: exigen sesión (authGuard) y un rol permitido (rolGuard).
    {
        path: '',
        component: AppLayoutComponent,
        canActivate: [authGuard],
        children: [
            { path: 'dashboard', component: DashboardComponent, canActivate: [rolGuard], data: { roles: ACCESO.inicio } },
            { path: 'productos', component: ProductosComponent, canActivate: [rolGuard], data: { roles: ACCESO.productos } },
            // /ventas lleva a Nueva venta, que es la acción principal de quien vende.
            { path: 'ventas', redirectTo: 'ventas/nueva', pathMatch: 'full' },
            { path: 'ventas/nueva', component: NuevaVentaComponent, canActivate: [rolGuard], data: { roles: ACCESO.ventas } },
            { path: 'ventas/historial', component: HistorialVentasComponent, canActivate: [rolGuard], data: { roles: ACCESO.ventas } },
            { path: 'comprobantes', component: VisorComprobanteComponent, canActivate: [rolGuard], data: { roles: ACCESO.comprobantes } },
        ],
    },

    { path: '**', redirectTo: 'dashboard' },
];
