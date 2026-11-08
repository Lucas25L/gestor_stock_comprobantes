const ZONA_HORARIA = 'America/Argentina/Buenos_Aires';

export type RangoPreset = 'hoy' | 'ultimos7' | 'mes';

export interface Rango {
    desde: string;
    hasta: string;
}

function dosDigitos(numero: number): string {
    return String(numero).padStart(2, '0');
}

/**
 * Día calendario AAAA-MM-DD según la hora local de la fecha recibida.
 * No usa toISOString(), que convierte a UTC y puede correr el día.
 */
export function fechaISO(fecha: Date): string {
    return `${fecha.getFullYear()}-${dosDigitos(fecha.getMonth() + 1)}-${dosDigitos(fecha.getDate())}`;
}

/** Período para los atajos del historial. El extremo final es siempre "hoy". */
export function rangoDe(preset: RangoPreset, hoy: Date): Rango {
    const fin = fechaISO(hoy);
    switch (preset) {
        case 'hoy':
            return { desde: fin, hasta: fin };
        case 'ultimos7': {
            const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 6);
            return { desde: fechaISO(inicio), hasta: fin };
        }
        case 'mes': {
            const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
            return { desde: fechaISO(inicio), hasta: fin };
        }
    }
}

const FORMATO_PARTES = new Intl.DateTimeFormat('es-AR', {
    timeZone: ZONA_HORARIA,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
});

/** Fecha y hora de un instante ISO, siempre en hora de Buenos Aires: "31/10/2026 23:30". */
export function formatearFechaHora(iso: string): string {
    const partes: Record<string, string> = {};
    for (const parte of FORMATO_PARTES.formatToParts(new Date(iso))) {
        partes[parte.type] = parte.value;
    }
    return `${partes['day']}/${partes['month']}/${partes['year']} ${partes['hour']}:${partes['minute']}`;
}

/**
 * AAAA-MM-DD → Date a medianoche local, o null si no es una fecha real.
 * No usa new Date("AAAA-MM-DD"), que interpreta el texto como UTC y corre el día.
 */
export function fechaDesdeISO(texto: string): Date | null {
    const coincidencia = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto);
    if (!coincidencia) {
        return null;
    }
    const anio = Number(coincidencia[1]);
    const mes = Number(coincidencia[2]);
    const dia = Number(coincidencia[3]);
    const fecha = new Date(anio, mes - 1, dia);
    const existe =
        fecha.getFullYear() === anio && fecha.getMonth() === mes - 1 && fecha.getDate() === dia;
    return existe ? fecha : null;
}
