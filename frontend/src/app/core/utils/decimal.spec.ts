import {
    compararDecimales,
    esCantidadValida,
    formatearCantidad,
    formatearDinero,
    multiplicarDinero,
    normalizarCantidad,
    sumarCantidades,
    sumarDinero,
} from './decimal';

describe('decimal', () => {
    describe('multiplicarDinero', () => {
        it('multiplica precio por cantidad entera', () => {
            expect(multiplicarDinero('1500.00', '2')).toBe('3000.00');
        });

        it('multiplica por cantidades con decimales', () => {
            expect(multiplicarDinero('2000.00', '1.500')).toBe('3000.00');
        });

        it('no arrastra el error de la coma flotante', () => {
            expect(multiplicarDinero('19.99', '3')).toBe('59.97');
        });

        it('redondea hacia arriba en el 5, como el backend', () => {
            expect(multiplicarDinero('0.01', '0.5')).toBe('0.01'); // 0,005
            expect(multiplicarDinero('0.01', '0.499')).toBe('0.00'); // 0,00499
            expect(multiplicarDinero('1999.99', '0.333')).toBe('666.00'); // 665,99667
        });

        it('rechaza texto que no es un número', () => {
            expect(() => multiplicarDinero('abc', '1')).toThrow();
        });
    });

    describe('sumarDinero', () => {
        it('suma importes de varias líneas', () => {
            expect(sumarDinero(['3000.00', '2000.00', '3500.00'])).toBe('8500.00');
        });

        it('suma exacta con centavos', () => {
            expect(sumarDinero(['0.10', '0.20'])).toBe('0.30');
        });

        it('una lista vacía da cero', () => {
            expect(sumarDinero([])).toBe('0.00');
        });
    });

    describe('normalizarCantidad', () => {
        it('recorta los ceros finales', () => {
            expect(normalizarCantidad('2.500')).toBe('2.5');
            expect(normalizarCantidad('3.000')).toBe('3');
            expect(normalizarCantidad('0.050')).toBe('0.05');
            expect(normalizarCantidad('10')).toBe('10');
        });

        it('rechaza texto que no es un número', () => {
            expect(() => normalizarCantidad('abc')).toThrow();
        });
    });

    describe('sumarCantidades', () => {
        it('suma sin el error de la coma flotante', () => {
            expect(sumarCantidades('0.1', '0.2')).toBe('0.3');
        });

        it('devuelve enteros cuando no quedan decimales', () => {
            expect(sumarCantidades('1.5', '1.5')).toBe('3');
            expect(sumarCantidades('2', '3')).toBe('5');
        });

        it('suma cantidades con tres decimales', () => {
            expect(sumarCantidades('1000.001', '0.999')).toBe('1001');
        });
    });

    describe('compararDecimales', () => {
        it('ignora los ceros finales', () => {
            expect(compararDecimales('2.500', '2.5')).toBe(0);
        });

        it('compara por valor y no por texto', () => {
            expect(compararDecimales('10', '9.999')).toBe(1);
            expect(compararDecimales('0.001', '0.01')).toBe(-1);
        });
    });

    describe('esCantidadValida', () => {
        it('acepta enteros y decimales de hasta tres cifras', () => {
            expect(esCantidadValida('1', false)).toBe(true);
            expect(esCantidadValida('2.5', true)).toBe(true);
            expect(esCantidadValida('0.001', true)).toBe(true);
        });

        it('rechaza decimales si la unidad solo admite enteros', () => {
            expect(esCantidadValida('2.5', false)).toBe(false);
        });

        it('rechaza cero, negativos, más de tres decimales y texto', () => {
            for (const texto of ['0', '0.000', '-1', '1.2345', '', 'abc', '1.', '.5']) {
                expect(esCantidadValida(texto, true)).toBe(false);
            }
        });
    });

    describe('formato para pantalla', () => {
        it('formatea cantidades sin ceros finales', () => {
            expect(formatearCantidad('2.500')).toBe('2,5');
            expect(formatearCantidad('3.000')).toBe('3');
            expect(formatearCantidad('1000.000')).toBe('1.000');
            expect(formatearCantidad('1234.567')).toBe('1.234,567');
        });

        it('formatea dinero con separadores argentinos', () => {
            expect(formatearDinero('1234.5')).toBe('$ 1.234,50');
            expect(formatearDinero('8500.00')).toBe('$ 8.500,00');
            expect(formatearDinero('0')).toBe('$ 0,00');
        });
    });
});
