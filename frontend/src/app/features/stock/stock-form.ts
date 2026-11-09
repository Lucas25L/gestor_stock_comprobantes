import { NuevoAjuste, NuevoIngreso, Producto } from '../../core/api/modelos';
import { compararDecimales, formatearCantidad } from '../../core/utils/decimal';
import { validarCantidad } from '../productos/producto-form';

/** Lo que el usuario escribe en el formulario de ingreso: todo texto, sin convertir. */
export interface FormularioIngreso {
    producto: Producto | null;
    cantidad: string;
    motivo: string;
    /** Opcional: por ejemplo el número de remito. */
    referencia: string;
}

export type SentidoAjuste = 'aumentar' | 'disminuir';

export interface FormularioAjuste {
    producto: Producto | null;
    sentido: SentidoAjuste;
    /** Siempre positiva: el signo lo da el sentido. */
    cantidad: string;
    motivo: string;
}

export type ErroresFormulario<T> = Partial<Record<keyof T, string>>;

export interface ResultadoIngreso {
    errores: ErroresFormulario<FormularioIngreso>;
    /** Datos listos para enviar; solo existen si no hay errores. */
    datos?: NuevoIngreso;
}

export interface ResultadoAjuste {
    errores: ErroresFormulario<FormularioAjuste>;
    /** Datos listos para enviar, con la cantidad con signo; solo existen si no hay errores. */
    datos?: NuevoAjuste;
}

export const INGRESO_VACIO: FormularioIngreso = { producto: null, cantidad: '', motivo: '', referencia: '' };
export const AJUSTE_VACIO: FormularioAjuste = { producto: null, sentido: 'aumentar', cantidad: '', motivo: '' };

const MAXIMO_MOTIVO = 255;
const MAXIMO_REFERENCIA = 100;

function validarMotivo(texto: string): { error?: string; valor?: string } {
    const motivo = texto.trim();
    if (!motivo) {
        return { error: 'El motivo es obligatorio.' };
    }
    if (motivo.length > MAXIMO_MOTIVO) {
        return { error: `El motivo no puede superar los ${MAXIMO_MOTIVO} caracteres.` };
    }
    return { valor: motivo };
}

/** La cantidad se valida contra la unidad del producto elegido: entera o con hasta 3 decimales. */
function validarCantidadDe(producto: Producto, texto: string): { error?: string; valor?: string } {
    return validarCantidad(
        texto,
        { nombre: producto.unidad_nombre, permite_decimales: producto.unidad_permite_decimales },
        false,
    );
}

/**
 * Valida el ingreso de mercadería con las mismas reglas que el backend. El servidor sigue
 * siendo la verificación definitiva: acá se corta el error antes de enviar y se explica.
 */
export function validarIngreso(formulario: FormularioIngreso): ResultadoIngreso {
    const errores: ErroresFormulario<FormularioIngreso> = {};
    const producto = formulario.producto;

    if (!producto) {
        errores.producto = 'Elegí un producto.';
    }

    // La cantidad depende de la unidad: sin producto no se puede validar.
    let cantidad: string | undefined;
    if (producto) {
        const resultado = validarCantidadDe(producto, formulario.cantidad);
        if (resultado.error) {
            errores.cantidad = resultado.error;
        } else {
            cantidad = resultado.valor;
        }
    }

    const motivo = validarMotivo(formulario.motivo);
    if (motivo.error) {
        errores.motivo = motivo.error;
    }

    const referencia = formulario.referencia.trim();
    if (referencia.length > MAXIMO_REFERENCIA) {
        errores.referencia = `La referencia no puede superar los ${MAXIMO_REFERENCIA} caracteres.`;
    }

    if (Object.keys(errores).length > 0 || !producto || !cantidad || !motivo.valor) {
        return { errores };
    }
    return {
        errores,
        datos: {
            producto: producto.id,
            cantidad,
            motivo: motivo.valor,
            // Si no hay referencia no se envía: el backend la toma como vacía.
            ...(referencia ? { referencia } : {}),
        },
    };
}

/**
 * Valida el ajuste manual. El usuario elige aumentar o disminuir y escribe una cantidad
 * positiva; el valor con signo que recibe el backend lo arma esta función.
 */
export function validarAjuste(formulario: FormularioAjuste): ResultadoAjuste {
    const errores: ErroresFormulario<FormularioAjuste> = {};
    const producto = formulario.producto;

    if (!producto) {
        errores.producto = 'Elegí un producto.';
    }

    let cantidad: string | undefined;
    if (producto) {
        const resultado = validarCantidadDe(producto, formulario.cantidad);
        if (resultado.error) {
            errores.cantidad = resultado.error;
        } else if (
            formulario.sentido === 'disminuir' &&
            resultado.valor &&
            compararDecimales(resultado.valor, producto.stock) > 0
        ) {
            errores.cantidad =
                `No podés descontar más que el stock actual ` +
                `(${formatearCantidad(producto.stock)} ${producto.unidad_abreviatura}).`;
        } else {
            cantidad = resultado.valor;
        }
    }

    const motivo = validarMotivo(formulario.motivo);
    if (motivo.error) {
        errores.motivo = motivo.error;
    }

    if (Object.keys(errores).length > 0 || !producto || !cantidad || !motivo.valor) {
        return { errores };
    }
    return {
        errores,
        datos: {
            producto: producto.id,
            cantidad: formulario.sentido === 'disminuir' ? `-${cantidad}` : cantidad,
            motivo: motivo.valor,
        },
    };
}
