import { DatosProducto, Producto, UnidadMedida } from '../../core/api/modelos';
import {
    compararDecimales,
    esCantidadValida,
    normalizarCantidad,
    normalizarImporte,
} from '../../core/utils/decimal';

/** Lo que el usuario escribe en el formulario: todo texto, sin convertir. */
export interface FormularioProducto {
    nombre: string;
    descripcion: string;
    precio: string;
    stockMinimo: string;
    codigoBarras: string;
    categoria: number | null;
    unidad: number | null;
    /** Solo al crear. Vacío = no cargar stock inicial. */
    stockInicial: string;
}

export type CampoProducto = keyof FormularioProducto;

export interface ResultadoValidacion {
    errores: Partial<Record<CampoProducto, string>>;
    /** Datos listos para enviar; solo existen si no hay errores. */
    datos?: DatosProducto;
    /** Cantidad del ingreso inicial (texto decimal), si se pidió y es válida. */
    stockInicial?: string;
}

export const FORMULARIO_VACIO: FormularioProducto = {
    nombre: '',
    descripcion: '',
    precio: '',
    stockMinimo: '',
    codigoBarras: '',
    categoria: null,
    unidad: null,
    stockInicial: '',
};

const MAXIMO_NOMBRE = 150;
const MAXIMO_DESCRIPCION = 255;
const MAXIMO_CODIGO = 50;
/** DecimalField(10, 2): hasta 8 cifras enteras. */
const CIFRAS_ENTERAS_PRECIO = 8;
/** DecimalField(12, 3): hasta 9 cifras enteras. */
const CIFRAS_ENTERAS_CANTIDAD = 9;

function cifrasEnteras(texto: string): number {
    return texto.split('.')[0].replace(/^0+(?=\d)/, '').length;
}

function validarPrecio(texto: string): { error?: string; valor?: string } {
    const importe = normalizarImporte(texto);
    if (importe === null) {
        return { error: 'Ingresá un precio válido, por ejemplo 1500 o 1500,50 (hasta 2 decimales).' };
    }
    if (compararDecimales(importe, '0') <= 0) {
        return { error: 'El precio debe ser mayor a 0.' };
    }
    if (cifrasEnteras(importe) > CIFRAS_ENTERAS_PRECIO) {
        return { error: 'El precio es demasiado alto.' };
    }
    return { valor: importe };
}

/**
 * Cantidad escrita por el usuario. Si `permiteCero`, "0" es válido (stock mínimo);
 * si no, debe ser mayor a 0 (ingreso inicial). Entera si la unidad no admite decimales.
 */
export function validarCantidad(
    texto: string,
    unidad: Pick<UnidadMedida, 'nombre' | 'permite_decimales'>,
    permiteCero: boolean,
): { error?: string; valor?: string } {
    const limpio = texto.trim().replace(',', '.');
    if (permiteCero && /^0+(\.0+)?$/.test(limpio)) {
        return { valor: '0' };
    }
    if (!esCantidadValida(limpio, unidad.permite_decimales)) {
        if (!unidad.permite_decimales && limpio.includes('.')) {
            return {
                error: `La unidad "${unidad.nombre}" solo admite cantidades enteras.`,
            };
        }
        return {
            error: unidad.permite_decimales
                ? `Ingresá un número ${permiteCero ? 'mayor o igual a 0' : 'mayor a 0'}, con hasta 3 decimales.`
                : `Ingresá un número entero ${permiteCero ? 'mayor o igual a 0' : 'mayor a 0'}.`,
        };
    }
    if (cifrasEnteras(limpio) > CIFRAS_ENTERAS_CANTIDAD) {
        return { error: 'La cantidad es demasiado alta.' };
    }
    return { valor: normalizarCantidad(limpio) };
}

/**
 * Valida el formulario con las mismas reglas que el backend. El servidor sigue siendo la
 * verificación definitiva: acá se corta el error antes de enviar y se explica en español.
 * Lo que solo el servidor sabe (por ejemplo, un código de barras repetido) no se valida acá.
 */
export function validarProducto(
    formulario: FormularioProducto,
    unidades: readonly UnidadMedida[],
    modo: 'crear' | 'editar',
): ResultadoValidacion {
    const errores: ResultadoValidacion['errores'] = {};

    const nombre = formulario.nombre.trim();
    if (!nombre) {
        errores.nombre = 'El nombre es obligatorio.';
    } else if (nombre.length > MAXIMO_NOMBRE) {
        errores.nombre = `El nombre no puede superar los ${MAXIMO_NOMBRE} caracteres.`;
    }

    const descripcion = formulario.descripcion.trim();
    if (descripcion.length > MAXIMO_DESCRIPCION) {
        errores.descripcion = `La descripción no puede superar los ${MAXIMO_DESCRIPCION} caracteres.`;
    }

    const precio = validarPrecio(formulario.precio);
    if (precio.error) {
        errores.precio = precio.error;
    }

    const codigo = formulario.codigoBarras.trim();
    if (codigo.length > MAXIMO_CODIGO) {
        errores.codigoBarras = `El código de barras no puede superar los ${MAXIMO_CODIGO} caracteres.`;
    }

    if (formulario.categoria === null) {
        errores.categoria = 'Elegí una categoría.';
    }

    const unidad = unidades.find((u) => u.id === formulario.unidad);
    if (formulario.unidad === null || !unidad) {
        errores.unidad = 'Elegí una unidad de medida.';
    }

    // Las cantidades dependen de la unidad: sin una unidad válida no se pueden validar.
    let stockMinimo = '0';
    let stockInicial: string | undefined;
    if (unidad) {
        if (formulario.stockMinimo.trim()) {
            const minimo = validarCantidad(formulario.stockMinimo, unidad, true);
            if (minimo.error) {
                errores.stockMinimo = minimo.error;
            } else {
                stockMinimo = minimo.valor ?? '0';
            }
        }
        if (modo === 'crear' && formulario.stockInicial.trim()) {
            const inicial = validarCantidad(formulario.stockInicial, unidad, false);
            if (inicial.error) {
                errores.stockInicial = inicial.error;
            } else {
                stockInicial = inicial.valor;
            }
        }
    }

    if (Object.keys(errores).length > 0 || !precio.valor || formulario.categoria === null || !unidad) {
        return { errores };
    }
    return {
        errores,
        stockInicial,
        datos: {
            nombre,
            descripcion,
            precio: precio.valor,
            stock_minimo: stockMinimo,
            codigo_barras: codigo === '' ? null : codigo,
            categoria: formulario.categoria,
            unidad: unidad.id,
        },
    };
}

/** Formulario de edición con los datos actuales del producto (todo como texto). */
export function formularioDe(producto: Producto): FormularioProducto {
    return {
        nombre: producto.nombre,
        descripcion: producto.descripcion,
        precio: producto.precio,
        // La API manda "5.000": se normaliza para que una unidad entera no lo rechace por los decimales.
        stockMinimo: normalizarCantidad(producto.stock_minimo),
        codigoBarras: producto.codigo_barras ?? '',
        categoria: producto.categoria,
        unidad: producto.unidad,
        stockInicial: '',
    };
}
