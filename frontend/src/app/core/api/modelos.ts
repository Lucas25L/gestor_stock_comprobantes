/**
 * Tipos de la API tal como los envía el backend (nombres en snake_case).
 * Importes, precios, stock y cantidades viajan como TEXTO decimal ("1500.00", "2.500"):
 * no se convierten a number; para operar con ellos se usa core/utils/decimal.ts.
 */

export interface MedioPago {
    id: number;
    nombre: string;
    descripcion: string;
    activo: boolean;
}

export interface Producto {
    id: number;
    nombre: string;
    descripcion: string;
    precio: string;
    stock: string;
    stock_minimo: string;
    codigo_barras: string | null;
    categoria: number;
    categoria_nombre: string;
    unidad: number;
    unidad_nombre: string;
    unidad_abreviatura: string;
    unidad_permite_decimales: boolean;
    stock_bajo: boolean;
    faltante: string;
    activo: boolean;
    creado_en: string;
    actualizado_en: string;
}

export interface DetalleVenta {
    id: number;
    producto: number;
    producto_nombre: string;
    unidad_abreviatura: string;
    cantidad: string;
    precio_unitario: string;
    subtotal: string;
}

export interface Venta {
    id: number;
    usuario: number;
    usuario_username: string;
    medio_pago: number;
    medio_pago_nombre: string;
    fecha: string;
    total: string;
    impuestos_nacionales: string;
    activa: boolean;
    estado: 'confirmada' | 'anulada';
    motivo_anulacion: string;
    anulada_por: number | null;
    anulada_por_username: string | null;
    fecha_anulacion: string | null;
    comprobante: number | null;
    comprobante_numero: string | null;
    detalles: DetalleVenta[];
}

/** Lo que se envía para registrar una venta. El total lo calcula el backend. */
export interface NuevaVenta {
    medio_pago: number;
    items: { producto: number; cantidad: string }[];
}

export interface LineaComprobante {
    producto: string;
    unidad: string;
    cantidad: string;
    precio_unitario: string;
    subtotal: string;
}

/** Copia de los datos de la venta que se guarda dentro del comprobante al emitirlo. */
export interface ContenidoComprobante {
    venta_id: number;
    fecha_venta: string;
    registrada_por: string;
    medio_pago: string;
    lineas: LineaComprobante[];
    impuestos_nacionales: string;
    total: string;
}

export interface Comprobante {
    id: number;
    venta: number;
    numero: number;
    numero_formateado: string;
    fecha_emision: string;
    estado: 'emitido' | 'anulado';
    contenido: ContenidoComprobante;
}
