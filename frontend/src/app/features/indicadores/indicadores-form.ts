import { PeriodoIndicadores } from '../../core/api/indicadores.api';
import { fechaDesdeISO, rangoDe } from '../../core/utils/fechas';
import { ErroresFormulario } from '../stock/stock-form';

/** Mismos valores que el backend (apps/indicadores/services.py). */
export const LIMITE_POR_DEFECTO = 10;
export const LIMITE_MAXIMO = 50;

/** Lo que el usuario elige en la pantalla: todo texto, sin convertir. */
export interface FormularioPeriodo {
    /** AAAA-MM-DD, o vacío para no acotar el inicio. */
    desde: string;
    /** AAAA-MM-DD, o vacío para no acotar el final. */
    hasta: string;
    /** Cantidad de filas de los rankings. */
    limite: string;
}

export interface DatosConsulta {
    periodo: PeriodoIndicadores;
    limite: number;
}

export interface ResultadoPeriodo {
    errores: ErroresFormulario<FormularioPeriodo>;
    /** Parámetros listos para enviar; solo existen si no hay errores. */
    datos?: DatosConsulta;
}

/** Período con el que abre la pantalla: el mes en curso hasta hoy. */
export function periodoInicial(hoy: Date): FormularioPeriodo {
    const { desde, hasta } = rangoDe('mes', hoy);
    return { desde, hasta, limite: String(LIMITE_POR_DEFECTO) };
}

export function validarPeriodo(formulario: FormularioPeriodo): ResultadoPeriodo {
    const errores: ErroresFormulario<FormularioPeriodo> = {};
    const desde = formulario.desde.trim();
    const hasta = formulario.hasta.trim();
    const textoLimite = formulario.limite.trim();

    if (desde && !fechaDesdeISO(desde)) {
        errores.desde = 'Fecha inválida. Usá una fecha real en formato AAAA-MM-DD.';
    }
    if (hasta && !fechaDesdeISO(hasta)) {
        errores.hasta = 'Fecha inválida. Usá una fecha real en formato AAAA-MM-DD.';
    }
    if (!errores.desde && !errores.hasta && desde && hasta && desde > hasta) {
        errores.hasta = 'La fecha final no puede ser anterior a la inicial.';
    }

    let limite = LIMITE_POR_DEFECTO;
    if (!/^\d+$/.test(textoLimite)) {
        errores.limite = 'Ingresá un número entero.';
    } else {
        limite = Number(textoLimite);
        if (limite < 1 || limite > LIMITE_MAXIMO) {
            errores.limite = `La cantidad debe estar entre 1 y ${LIMITE_MAXIMO}.`;
        }
    }

    if (Object.keys(errores).length > 0) {
        return { errores };
    }

    const periodo: PeriodoIndicadores = {};
    if (desde) {
        periodo.desde = desde;
    }
    if (hasta) {
        periodo.hasta = hasta;
    }
    return { errores, datos: { periodo, limite } };
}
