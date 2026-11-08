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

export interface Categoria {
    id: number;
    nombre: string;
    descripcion: string;
    activa: boolean;
    creado_en: string;
    actualizado_en: string;
}

export interface UnidadMedida {
    id: number;
    nombre: string;
    abreviatura: string;
    permite_decimales: boolean;
    activo: boolean;
}

export type TipoMovimiento = 'ingreso' | 'ajuste' | 'venta' | 'anulacion_venta';

export interface MovimientoStock {
    id: number;
    producto: number;
    producto_nombre: string;
    usuario: number;
    usuario_username: string;
    tipo: TipoMovimiento;
    tipo_display: string;
    /** Con signo: positiva suma al stock, negativa resta. */
    cantidad: string;
    stock_resultante: string;
    motivo: string;
    referencia_origen: string;
    fecha_hora: string;
}

/** Respuesta paginada de DRF (por ahora solo la usan los movimientos de stock). */
export interface Pagina<T> {
    count: number;
    next: string | null;
    previous: string | null;
    results: T[];
}

/** Campos editables de un producto. El stock no está: solo cambia por movimientos. */
export interface DatosProducto {
    nombre: string;
    descripcion: string;
    precio: string;
    stock_minimo: string;
    /** null si no tiene: un texto vacío chocaría con el siguiente producto sin código (es único). */
    codigo_barras: string | null;
    categoria: number;
    unidad: number;
}

export interface DatosCategoria {
    nombre: string;
    descripcion: string;
}

export interface DatosUnidad {
    nombre: string;
    abreviatura: string;
    permite_decimales: boolean;
}

export interface NuevoIngreso {
    producto: number;
    /** Siempre positiva, con hasta 3 decimales. */
    cantidad: string;
    motivo: string;
    referencia?: string;
}

export interface NuevoAjuste {
    producto: number;
    /** Con signo y distinta de cero: "-2.5" resta, "3" suma. */
    cantidad: string;
    motivo: string;
}
