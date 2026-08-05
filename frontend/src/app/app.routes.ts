import { Routes } from '@angular/router';
// Componentes originales de tu GitHub (Etapa 1)
import { ListaProductosComponent } from './features/productos/lista-productos.component';
import { CarritoVentaComponent } from './features/ventas/carrito-venta.component';
import { VisorComprobanteComponent } from './features/comprobantes/visor-comprobante.component';

// Componentes e Infraestructura de Identidad creados en la Etapa 1.5
import { LoginComponent } from './features/auth/login.component';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { authGuard } from './core/guards/auth.guard';
import { AppLayoutComponent } from './layouts/app-layout.component';

export const routes: Routes = [
  // 1. Ruta raíz del sistema: Ahora redirige por defecto al Dashboard protegido
  { 
    path: '', 
    redirectTo: 'dashboard', 
    pathMatch: 'full' 
  },

  // 2. Pantalla de Login: Totalmente aislada de la barra de navegación global y del Guard
  { 
    path: 'login', 
    component: LoginComponent 
  },

  // 3. Bloque de Rutas Protegidas del Sistema (Requieren Autenticación en memoria)
  {
    path: '',
    component: AppLayoutComponent,
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        component: DashboardComponent
      },
      {
        path: 'productos',
        component: ListaProductosComponent
      },
      {
        path: 'ventas',
        component: CarritoVentaComponent
      },
      {
        path: 'comprobantes',
        component: VisorComprobanteComponent
      }
    ]
  },

  // 4. Ruta comodín de resguardo: Si escriben una URL rota o inexistente, rebotan al Dashboard seguro
  { 
    path: '**', 
    redirectTo: 'dashboard' 
  }
];