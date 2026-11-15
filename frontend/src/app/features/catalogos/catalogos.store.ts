import { Injectable, inject } from '@angular/core';

import { CategoriasApi } from '../../core/api/categorias.api';
import { MediosPagoApi } from '../../core/api/medios-pago.api';
import {
    Categoria,
    DatosCategoria,
    DatosMedioPago,
    DatosUnidad,
    MedioPago,
    UnidadMedida,
} from '../../core/api/modelos';
import { UnidadesApi } from '../../core/api/unidades.api';
import {
    FormularioCategoria,
    FormularioMedioPago,
    FormularioUnidad,
    validarCategoria,
    validarMedioPago,
    validarUnidad,
} from './catalogos-form';
import { SeccionCatalogo } from './seccion-catalogo';

/** Estado de la pantalla Catálogos. Se provee en el componente: se destruye al salir de la pantalla. */
@Injectable()
export class CatalogosStore {
    readonly #categoriasApi = inject(CategoriasApi);
    readonly #unidadesApi = inject(UnidadesApi);
    readonly #mediosPagoApi = inject(MediosPagoApi);

    // Categorías y unidades piden los inactivos con "incluir_inactivas" (femenino)...
    readonly categorias = new SeccionCatalogo<Categoria, FormularioCategoria, DatosCategoria>({
        etiqueta: 'la categoría',
        listar: (inactivos) => this.#categoriasApi.listar(inactivos ? { incluir_inactivas: true } : {}),
        crear: (datos) => this.#categoriasApi.crear(datos),
        actualizar: (id, cambios) => this.#categoriasApi.actualizar(id, cambios),
        desactivar: (id) => this.#categoriasApi.desactivar(id),
        reactivar: (id) => this.#categoriasApi.reactivar(id),
        validar: validarCategoria,
    });

    readonly unidades = new SeccionCatalogo<UnidadMedida, FormularioUnidad, DatosUnidad>({
        etiqueta: 'la unidad de medida',
        listar: (inactivos) => this.#unidadesApi.listar(inactivos ? { incluir_inactivas: true } : {}),
        crear: (datos) => this.#unidadesApi.crear(datos),
        actualizar: (id, cambios) => this.#unidadesApi.actualizar(id, cambios),
        desactivar: (id) => this.#unidadesApi.desactivar(id),
        reactivar: (id) => this.#unidadesApi.reactivar(id),
        validar: validarUnidad,
    });

    // ...y medios de pago con "incluir_inactivos" (masculino).
    readonly mediosPago = new SeccionCatalogo<MedioPago, FormularioMedioPago, DatosMedioPago>({
        etiqueta: 'el medio de pago',
        listar: (inactivos) => this.#mediosPagoApi.listar(inactivos ? { incluir_inactivos: true } : {}),
        crear: (datos) => this.#mediosPagoApi.crear(datos),
        actualizar: (id, cambios) => this.#mediosPagoApi.actualizar(id, cambios),
        desactivar: (id) => this.#mediosPagoApi.desactivar(id),
        reactivar: (id) => this.#mediosPagoApi.reactivar(id),
        validar: validarMedioPago,
    });

    /** Carga los tres listados (al abrir la pantalla). */
    iniciar(): void {
        this.categorias.cargar();
        this.unidades.cargar();
        this.mediosPago.cargar();
    }
}
