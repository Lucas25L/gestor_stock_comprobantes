import { ROLES, Rol } from './models/rol';

export interface ItemMenu {
    etiqueta: string;
    ruta: string;
    icono: string;
    roles: readonly Rol[];
}

const TODOS: readonly Rol[] = ROLES;
const ADMIN_Y_CAJERO: readonly Rol[] = ['Administrador', 'Cajero'];

/** Quién accede a cada pantalla. Lo usan las rutas (guard) y el menú lateral. */
export const ACCESO = {
    inicio: TODOS,
    ventas: ADMIN_Y_CAJERO,
    productos: TODOS,
    comprobantes: ADMIN_Y_CAJERO,
} as const;

export const MENU: readonly ItemMenu[] = [
    { etiqueta: 'Inicio', ruta: '/dashboard', icono: 'pi-home', roles: ACCESO.inicio },
    { etiqueta: 'Nueva venta', ruta: '/ventas/nueva', icono: 'pi-shopping-cart', roles: ACCESO.ventas },
    { etiqueta: 'Historial de ventas', ruta: '/ventas/historial', icono: 'pi-history', roles: ACCESO.ventas },
    { etiqueta: 'Productos', ruta: '/productos', icono: 'pi-box', roles: ACCESO.productos },
    { etiqueta: 'Comprobantes', ruta: '/comprobantes', icono: 'pi-file', roles: ACCESO.comprobantes },
];
