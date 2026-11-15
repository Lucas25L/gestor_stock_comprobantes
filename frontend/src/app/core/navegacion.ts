import { ROLES, Rol } from './models/rol';

export interface ItemMenu {
    etiqueta: string;
    ruta: string;
    icono: string;
    roles: readonly Rol[];
}

const TODOS: readonly Rol[] = ROLES;
const ADMIN_Y_CAJERO: readonly Rol[] = ['Administrador', 'Cajero'];
const ADMIN_Y_REPOSITOR: readonly Rol[] = ['Administrador', 'Repositor'];
const SOLO_ADMINISTRADOR: readonly Rol[] = ['Administrador'];

/** Quién accede a cada pantalla. Lo usan las rutas (guard) y el menú lateral. */
export const ACCESO = {
    inicio: TODOS,
    ventas: ADMIN_Y_CAJERO,
    productos: TODOS,
    stock: ADMIN_Y_REPOSITOR,
    reposicion: TODOS,
    comprobantes: ADMIN_Y_CAJERO,
    indicadores: SOLO_ADMINISTRADOR,
} as const;

export const MENU: readonly ItemMenu[] = [
    { etiqueta: 'Inicio', ruta: '/dashboard', icono: 'pi-home', roles: ACCESO.inicio },
    { etiqueta: 'Nueva venta', ruta: '/ventas/nueva', icono: 'pi-shopping-cart', roles: ACCESO.ventas },
    { etiqueta: 'Historial de ventas', ruta: '/ventas/historial', icono: 'pi-history', roles: ACCESO.ventas },
    { etiqueta: 'Productos', ruta: '/productos', icono: 'pi-box', roles: ACCESO.productos },
    { etiqueta: 'Stock', ruta: '/stock', icono: 'pi-database', roles: ACCESO.stock },
    { etiqueta: 'Reposición', ruta: '/reposicion', icono: 'pi-exclamation-triangle', roles: ACCESO.reposicion },
    { etiqueta: 'Indicadores', ruta: '/indicadores', icono: 'pi-chart-bar', roles: ACCESO.indicadores },
];
