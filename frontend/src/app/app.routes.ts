import { Routes } from '@angular/router';

import { ACCESO } from './core/navegacion';
import { authGuard } from './core/guards/auth.guard';
import { rolGuard } from './core/guards/rol.guard';
import { AppLayoutComponent } from './layouts/app-layout.component';
import { LoginComponent } from './features/auth/login.component';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { ListaProductosComponent } from './features/productos/lista-productos.component';
import { CarritoVentaComponent } from './features/ventas/carrito-venta.component';
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
            { path: 'productos', component: ListaProductosComponent, canActivate: [rolGuard], data: { roles: ACCESO.productos } },
            { path: 'ventas', component: CarritoVentaComponent, canActivate: [rolGuard], data: { roles: ACCESO.ventas } },
            { path: 'comprobantes', component: VisorComprobanteComponent, canActivate: [rolGuard], data: { roles: ACCESO.comprobantes } },
        ],
    },

    { path: '**', redirectTo: 'dashboard' },
];
