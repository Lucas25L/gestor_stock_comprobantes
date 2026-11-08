import { Translation } from 'primeng/api';

/** Textos de los componentes de PrimeNG en español (selector de fechas, mensajes vacíos, botones). */
export const TRADUCCION_ES: Translation = {
    dayNames: ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'],
    dayNamesShort: ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'],
    dayNamesMin: ['D', 'L', 'M', 'X', 'J', 'V', 'S'],
    monthNames: [
        'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
        'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
    ],
    monthNamesShort: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'],
    // En PrimeNG "yy" es el año de cuatro cifras: dd/mm/yy → 08/11/2026.
    dateFormat: 'dd/mm/yy',
    firstDayOfWeek: 1,
    today: 'Hoy',
    clear: 'Limpiar',
    weekHeader: 'Sem',
    accept: 'Sí',
    reject: 'No',
    cancel: 'Cancelar',
    emptyMessage: 'Sin resultados',
    emptyFilterMessage: 'Sin resultados',
    chooseYear: 'Elegir año',
    chooseMonth: 'Elegir mes',
    chooseDate: 'Elegir fecha',
    prevDecade: 'Década anterior',
    nextDecade: 'Década siguiente',
    prevYear: 'Año anterior',
    nextYear: 'Año siguiente',
    prevMonth: 'Mes anterior',
    nextMonth: 'Mes siguiente',
};
