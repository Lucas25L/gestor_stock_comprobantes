export interface DetalleVenta {
    id: number;
    producto: number;
    productoNombre: string;
    cantidad: number;
    precioUnitario: number;
    subtotal: number;
}

export interface Venta {
    id: number;
    usuario: number;
    fecha: string;
    total: number;
    impuestosNacionales: number;
    activa: boolean;
    detalles: DetalleVenta[];
}

