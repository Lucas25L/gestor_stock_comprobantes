import { idDeRuta } from './id-comprobante';

describe('idDeRuta', () => {
    it('acepta enteros positivos', () => {
        expect(idDeRuta('1')).toBe(1);
        expect(idDeRuta('250')).toBe(250);
    });

    it('rechaza cero, negativos y decimales', () => {
        expect(idDeRuta('0')).toBeNull();
        expect(idDeRuta('-3')).toBeNull();
        expect(idDeRuta('1.5')).toBeNull();
    });

    it('rechaza texto, vacío, nulo y ceros a la izquierda', () => {
        expect(idDeRuta('abc')).toBeNull();
        expect(idDeRuta('')).toBeNull();
        expect(idDeRuta(null)).toBeNull();
        expect(idDeRuta('007')).toBeNull();
    });

    it('rechaza números que no se representan con exactitud', () => {
        expect(idDeRuta('99999999999999999999')).toBeNull();
    });
});
