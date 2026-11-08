/**
 * Aritmética decimal exacta para dinero y cantidades.
 *
 * La API envía importes y cantidades como texto ("1500.00", "2.500") para no perder
 * exactitud. Acá se operan como enteros grandes escalados (BigInt): "2.500" es 2500 con
 * escala 3. Así la multiplicación y la suma son exactas, y el redondeo coincide con el
 * del backend (ROUND_HALF_UP por línea, y después se suman las líneas).
 */

interface Decimal {
    unidades: bigint;
    escala: number;
}

const ESCALA_DINERO = 2;
const FORMATO_DECIMAL = /^-?\d+(\.\d+)?$/;
const FORMATO_CANTIDAD = /^\d+(\.\d{1,3})?$/;

function parsear(texto: string): Decimal {
    const limpio = texto.trim();
    if (!FORMATO_DECIMAL.test(limpio)) {
        throw new Error(`Número decimal inválido: "${texto}"`);
    }
    const [entera, fraccion = ''] = limpio.split('.');
    return { unidades: BigInt(entera + fraccion), escala: fraccion.length };
}

function aTexto({ unidades, escala }: Decimal): string {
    const negativo = unidades < 0n;
    const digitos = (negativo ? -unidades : unidades).toString().padStart(escala + 1, '0');
    const entera = digitos.slice(0, digitos.length - escala);
    const fraccion = digitos.slice(digitos.length - escala);
    const texto = escala > 0 ? `${entera}.${fraccion}` : entera;
    return negativo ? `-${texto}` : texto;
}

/** Lleva el número a la escala indicada; si hay que descartar decimales, redondea hacia arriba en el 5. */
function redondear(valor: Decimal, escalaDestino: number): Decimal {
    if (valor.escala <= escalaDestino) {
        const factor = 10n ** BigInt(escalaDestino - valor.escala);
        return { unidades: valor.unidades * factor, escala: escalaDestino };
    }
    const divisor = 10n ** BigInt(valor.escala - escalaDestino);
    const negativo = valor.unidades < 0n;
    const absoluto = negativo ? -valor.unidades : valor.unidades;
    let cociente = absoluto / divisor;
    if ((absoluto % divisor) * 2n >= divisor) {
        cociente += 1n;
    }
    return { unidades: negativo ? -cociente : cociente, escala: escalaDestino };
}

function agruparMiles(entera: string): string {
    return entera.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** Importe de una línea: precio × cantidad, redondeado a centavos como hace el backend. */
export function multiplicarDinero(precio: string, cantidad: string): string {
    const p = parsear(precio);
    const c = parsear(cantidad);
    const producto: Decimal = { unidades: p.unidades * c.unidades, escala: p.escala + c.escala };
    return aTexto(redondear(producto, ESCALA_DINERO));
}

/** Suma de importes, con dos decimales. Una lista vacía da "0.00". */
export function sumarDinero(valores: readonly string[]): string {
    const total = valores.reduce(
        (acumulado, texto) => acumulado + redondear(parsear(texto), ESCALA_DINERO).unidades,
        0n,
    );
    return aTexto({ unidades: total, escala: ESCALA_DINERO });
}

/** Devuelve -1, 0 o 1 según a sea menor, igual o mayor que b (sin importar los ceros finales). */
export function compararDecimales(a: string, b: string): -1 | 0 | 1 {
    const x = parsear(a);
    const y = parsear(b);
    const escala = Math.max(x.escala, y.escala);
    const ux = redondear(x, escala).unidades;
    const uy = redondear(y, escala).unidades;
    return ux < uy ? -1 : ux > uy ? 1 : 0;
}

/** Cantidad positiva con hasta 3 decimales; entera si la unidad no admite decimales. */
export function esCantidadValida(texto: string, permiteDecimales: boolean): boolean {
    const limpio = texto.trim();
    if (!FORMATO_CANTIDAD.test(limpio)) {
        return false;
    }
    if (!permiteDecimales && limpio.includes('.')) {
        return false;
    }
    return compararDecimales(limpio, '0') > 0;
}

/** Cantidad para mostrar en pantalla: "2,5", "3", "1.234,567" (sin ceros finales). */
export function formatearCantidad(texto: string): string {
    const [entera, fraccion = ''] = aTexto(parsear(texto)).split('.');
    const decimales = fraccion.replace(/0+$/, '');
    return agruparMiles(entera) + (decimales ? `,${decimales}` : '');
}

/** Importe para mostrar en pantalla: "$ 1.234,50". */
export function formatearDinero(texto: string): string {
    const [entera, fraccion] = aTexto(redondear(parsear(texto), ESCALA_DINERO)).split('.');
    const negativo = entera.startsWith('-');
    const cuerpo = `${agruparMiles(negativo ? entera.slice(1) : entera)},${fraccion}`;
    return `${negativo ? '-' : ''}$ ${cuerpo}`;
}

function recortarCeros(valor: Decimal): string {
    const [entera, fraccion = ''] = aTexto(valor).split('.');
    const decimales = fraccion.replace(/0+$/, '');
    return decimales ? `${entera}.${decimales}` : entera;
}

/** Forma mínima de una cantidad: "2.500" → "2.5", "3.000" → "3". Es lo que se envía al backend. */
export function normalizarCantidad(texto: string): string {
    return recortarCeros(parsear(texto));
}

/** Suma exacta de dos cantidades (hasta 3 decimales), en su forma mínima. */
export function sumarCantidades(a: string, b: string): string {
    const x = parsear(a);
    const y = parsear(b);
    const escala = Math.max(x.escala, y.escala);
    const unidades = redondear(x, escala).unidades + redondear(y, escala).unidades;
    return recortarCeros({ unidades, escala });
}

/** Importe tal como lo escribe el usuario ("1500", "1500,5") → "1500.5", o null si no es válido. */
export function normalizarImporte(texto: string): string | null {
    const limpio = texto.trim().replace(',', '.');
    return /^\d+(\.\d{1,2})?$/.test(limpio) ? limpio : null;
}
