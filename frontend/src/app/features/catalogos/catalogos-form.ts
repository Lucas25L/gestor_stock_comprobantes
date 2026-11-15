import { DatosCategoria, DatosMedioPago, DatosUnidad } from '../../core/api/modelos';
import { ErroresFormulario } from '../stock/stock-form';

/** Largos máximos: los mismos que los modelos del backend. */
export const MAX_NOMBRE_CATEGORIA = 100;
export const MAX_NOMBRE_UNIDAD = 50;
export const MAX_ABREVIATURA = 10;
export const MAX_NOMBRE_MEDIO_PAGO = 50;
export const MAX_DESCRIPCION = 255;

/** Lo que el usuario escribe: todo texto, sin recortar. */
export interface FormularioCategoria {
    nombre: string;
    descripcion: string;
}

export interface FormularioUnidad {
    nombre: string;
    abreviatura: string;
    permiteDecimales: boolean;
}

export interface FormularioMedioPago {
    nombre: string;
    descripcion: string;
}

export interface ResultadoCategoria {
    errores: ErroresFormulario<FormularioCategoria>;
    /** Datos listos para enviar; solo existen si no hay errores. */
    datos?: DatosCategoria;
}

export interface ResultadoUnidad {
    errores: ErroresFormulario<FormularioUnidad>;
    datos?: DatosUnidad;
}

export interface ResultadoMedioPago {
    errores: ErroresFormulario<FormularioMedioPago>;
    datos?: DatosMedioPago;
}

export const CATEGORIA_VACIA: FormularioCategoria = { nombre: '', descripcion: '' };
export const UNIDAD_VACIA: FormularioUnidad = { nombre: '', abreviatura: '', permiteDecimales: false };
export const MEDIO_PAGO_VACIO: FormularioMedioPago = { nombre: '', descripcion: '' };

/** Devuelve el mensaje de error de un texto, o null si es válido. El texto ya viene recortado. */
function errorDeTexto(texto: string, maximo: number, obligatorio: boolean): string | null {
    if (obligatorio && !texto) {
        return 'Este dato es obligatorio.';
    }
    if (texto.length > maximo) {
        return `No puede superar los ${maximo} caracteres.`;
    }
    return null;
}

export function validarCategoria(formulario: FormularioCategoria): ResultadoCategoria {
    const nombre = formulario.nombre.trim();
    const descripcion = formulario.descripcion.trim();
    const errores: ErroresFormulario<FormularioCategoria> = {};

    const errorNombre = errorDeTexto(nombre, MAX_NOMBRE_CATEGORIA, true);
    if (errorNombre) {
        errores.nombre = errorNombre;
    }
    const errorDescripcion = errorDeTexto(descripcion, MAX_DESCRIPCION, false);
    if (errorDescripcion) {
        errores.descripcion = errorDescripcion;
    }

    return Object.keys(errores).length > 0 ? { errores } : { errores, datos: { nombre, descripcion } };
}

export function validarUnidad(formulario: FormularioUnidad): ResultadoUnidad {
    const nombre = formulario.nombre.trim();
    const abreviatura = formulario.abreviatura.trim();
    const errores: ErroresFormulario<FormularioUnidad> = {};

    const errorNombre = errorDeTexto(nombre, MAX_NOMBRE_UNIDAD, true);
    if (errorNombre) {
        errores.nombre = errorNombre;
    }
    const errorAbreviatura = errorDeTexto(abreviatura, MAX_ABREVIATURA, true);
    if (errorAbreviatura) {
        errores.abreviatura = errorAbreviatura;
    }

    return Object.keys(errores).length > 0
        ? { errores }
        : { errores, datos: { nombre, abreviatura, permite_decimales: formulario.permiteDecimales } };
}

export function validarMedioPago(formulario: FormularioMedioPago): ResultadoMedioPago {
    const nombre = formulario.nombre.trim();
    const descripcion = formulario.descripcion.trim();
    const errores: ErroresFormulario<FormularioMedioPago> = {};

    const errorNombre = errorDeTexto(nombre, MAX_NOMBRE_MEDIO_PAGO, true);
    if (errorNombre) {
        errores.nombre = errorNombre;
    }
    const errorDescripcion = errorDeTexto(descripcion, MAX_DESCRIPCION, false);
    if (errorDescripcion) {
        errores.descripcion = errorDescripcion;
    }

    return Object.keys(errores).length > 0 ? { errores } : { errores, datos: { nombre, descripcion } };
}
