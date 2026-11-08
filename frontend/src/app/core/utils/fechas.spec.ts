import { fechaISO, formatearFechaHora, rangoDe } from './fechas';

describe('fechas', () => {
    describe('fechaISO', () => {
        it('usa el día local, con ceros a la izquierda', () => {
            expect(fechaISO(new Date(2026, 10, 8))).toBe('2026-11-08');
            expect(fechaISO(new Date(2026, 0, 5))).toBe('2026-01-05');
        });

        it('no corre el día por la hora', () => {
            expect(fechaISO(new Date(2026, 9, 31, 23, 59))).toBe('2026-10-31');
            expect(fechaISO(new Date(2026, 10, 1, 0, 1))).toBe('2026-11-01');
        });
    });

    describe('rangoDe', () => {
        it('hoy', () => {
            expect(rangoDe('hoy', new Date(2026, 10, 8))).toEqual({
                desde: '2026-11-08',
                hasta: '2026-11-08',
            });
        });

        it('últimos 7 días incluye hoy', () => {
            expect(rangoDe('ultimos7', new Date(2026, 10, 8))).toEqual({
                desde: '2026-11-02',
                hasta: '2026-11-08',
            });
        });

        it('últimos 7 días cruza el cambio de mes', () => {
            expect(rangoDe('ultimos7', new Date(2026, 10, 3))).toEqual({
                desde: '2026-10-28',
                hasta: '2026-11-03',
            });
        });

        it('este mes arranca el día 1', () => {
            expect(rangoDe('mes', new Date(2026, 10, 18))).toEqual({
                desde: '2026-11-01',
                hasta: '2026-11-18',
            });
        });
    });

    describe('formatearFechaHora', () => {
        it('muestra la hora de Buenos Aires aunque llegue en UTC', () => {
            expect(formatearFechaHora('2026-11-01T02:30:00Z')).toBe('31/10/2026 23:30');
        });

        it('respeta el desfase que trae la fecha', () => {
            expect(formatearFechaHora('2026-11-08T11:05:00-03:00')).toBe('08/11/2026 11:05');
        });

        it('muestra la medianoche como 00:00', () => {
            expect(formatearFechaHora('2026-11-08T03:00:00Z')).toBe('08/11/2026 00:00');
        });
    });
});
