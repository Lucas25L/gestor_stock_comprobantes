/**
 * Convierte el parámetro `:id` de la ruta en un número de comprobante.
 * Devuelve null si no es un entero positivo (sin ceros a la izquierda, signos ni decimales).
 */
export function idDeRuta(texto: string | null): number | null {
    if (texto === null || !/^[1-9]\d*$/.test(texto)) {
        return null;
    }
    const id = Number(texto);
    return Number.isSafeInteger(id) ? id : null;
}
