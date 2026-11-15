import { HttpErrorResponse } from '@angular/common/http';
import { Observable, Subject, of, throwError } from 'rxjs';

import { ConfigSeccion, SeccionCatalogo } from './seccion-catalogo';

interface Item {
    id: number;
    nombre: string;
    descripcion: string;
}
interface Form {
    nombre: string;
    descripcion: string;
}
interface Datos {
    nombre: string;
    descripcion: string;
}

const ITEMS: Item[] = [{ id: 1, nombre: 'Efectivo', descripcion: '' }];
const error400 = () =>
    throwError(() => new HttpErrorResponse({ status: 400, error: { nombre: ['Ya existe un registro con este nombre.'] } }));

function crear(sobre: Partial<ConfigSeccion<Item, Form, Datos>> = {}) {
    const llamadas = {
        listar: [] as boolean[],
        crear: [] as Datos[],
        actualizar: [] as { id: number; cambios: Partial<Datos> }[],
        desactivar: [] as number[],
    };
    const config: ConfigSeccion<Item, Form, Datos> = {
        etiqueta: 'el elemento',
        listar: (inactivos) => {
            llamadas.listar.push(inactivos);
            return of(ITEMS);
        },
        crear: (datos) => {
            llamadas.crear.push(datos);
            return of({});
        },
        actualizar: (id, cambios) => {
            llamadas.actualizar.push({ id, cambios });
            return of({});
        },
        desactivar: (id) => {
            llamadas.desactivar.push(id);
            return of(null);
        },
        reactivar: () => of({}),
        validar: (f) =>
            f.nombre.trim()
                ? { errores: {}, datos: { nombre: f.nombre.trim(), descripcion: f.descripcion.trim() } }
                : { errores: { nombre: 'Este dato es obligatorio.' } },
        ...sobre,
    };
    return { seccion: new SeccionCatalogo(config), llamadas };
}

describe('SeccionCatalogo', () => {
    it('carga la lista y deja el estado listo', () => {
        const { seccion } = crear();
        seccion.cargar();
        expect(seccion.items()).toEqual(ITEMS);
        expect(seccion.cargando()).toBe(false);
        expect(seccion.errorCarga()).toBeNull();
    });

    it('pide los inactivos solo cuando se lo indica', () => {
        const { seccion, llamadas } = crear();
        seccion.cargar();
        seccion.mostrarInactivos(true);
        expect(llamadas.listar).toEqual([false, true]);
        expect(seccion.incluirInactivos()).toBe(true);
    });

    it('crea con los datos validados, recarga y avisa que terminó', () => {
        const { seccion, llamadas } = crear();
        let terminado = false;
        seccion.guardar({ nombre: ' Débito ', descripcion: '' }, null, () => (terminado = true));

        expect(llamadas.crear).toEqual([{ nombre: 'Débito', descripcion: '' }]);
        expect(llamadas.listar.length).toBe(1);
        expect(terminado).toBe(true);
        expect(seccion.guardando()).toBe(false);
    });

    it('con errores de validación muestra los errores y no consulta al servidor', () => {
        const { seccion, llamadas } = crear();
        let terminado = false;
        seccion.guardar({ nombre: ' ', descripcion: '' }, null, () => (terminado = true));

        expect(seccion.erroresCampos().nombre).toBe('Este dato es obligatorio.');
        expect(llamadas.crear.length).toBe(0);
        expect(terminado).toBe(false);
    });

    it('ignora un segundo guardado mientras el primero sigue en curso', () => {
        const pendiente = new Subject<unknown>();
        const { seccion, llamadas } = crear({
            crear: (datos) => {
                llamadas.crear.push(datos);
                return pendiente as Observable<unknown>;
            },
        });
        seccion.guardar({ nombre: 'A', descripcion: '' }, null);
        seccion.guardar({ nombre: 'A', descripcion: '' }, null);

        expect(llamadas.crear.length).toBe(1);
        expect(seccion.guardando()).toBe(true);
        pendiente.next({});
        pendiente.complete();
        expect(seccion.guardando()).toBe(false);
    });

    it('si el servidor rechaza el alta, deja el error en el formulario y no cierra', () => {
        const { seccion } = crear({ crear: () => error400() });
        let terminado = false;
        seccion.guardar({ nombre: 'Efectivo', descripcion: '' }, null, () => (terminado = true));

        expect(seccion.errorFormulario()).toBeTruthy();
        expect(seccion.guardando()).toBe(false);
        expect(terminado).toBe(false);
    });

    it('una edición sin cambios no hace ninguna petición y termina igual', () => {
        const { seccion, llamadas } = crear();
        let terminado = false;
        seccion.guardar({ nombre: 'Efectivo', descripcion: '' }, ITEMS[0], () => (terminado = true));

        expect(llamadas.actualizar.length).toBe(0);
        expect(terminado).toBe(true);
    });

    it('una edición envía solo los campos que cambiaron', () => {
        const { seccion, llamadas } = crear();
        seccion.guardar({ nombre: 'Efectivo', descripcion: 'Billetes' }, ITEMS[0]);

        expect(llamadas.actualizar).toEqual([{ id: 1, cambios: { descripcion: 'Billetes' } }]);
    });

    it('desactivar libera el estado y recarga la lista', () => {
        const { seccion, llamadas } = crear();
        seccion.desactivar(ITEMS[0]);

        expect(llamadas.desactivar).toEqual([1]);
        expect(llamadas.listar.length).toBe(1);
        expect(seccion.cambiandoEstado()).toBeNull();
    });

    it('si falla la baja muestra el error y libera el estado', () => {
        const { seccion } = crear({ desactivar: () => error400() });
        seccion.desactivar(ITEMS[0]);

        expect(seccion.errorOperacion()).toBeTruthy();
        expect(seccion.cambiandoEstado()).toBeNull();
    });
});
