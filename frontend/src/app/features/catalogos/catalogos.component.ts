import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from 'primeng/tabs';

import { Categoria, MedioPago, UnidadMedida } from '../../core/api/modelos';
import {
    CATEGORIA_VACIA,
    FormularioCategoria,
    FormularioMedioPago,
    FormularioUnidad,
    MAX_ABREVIATURA,
    MAX_DESCRIPCION,
    MAX_NOMBRE_CATEGORIA,
    MAX_NOMBRE_MEDIO_PAGO,
    MAX_NOMBRE_UNIDAD,
    MEDIO_PAGO_VACIO,
    UNIDAD_VACIA,
} from './catalogos-form';
import { CatalogosStore } from './catalogos.store';
import { DialogoCatalogo } from './dialogo-catalogo';

/** Baja pendiente de confirmar: el nombre se muestra y `ejecutar` la lleva a cabo. */
interface BajaPendiente {
    nombre: string;
    ejecutar: () => void;
}

@Component({
    selector: 'app-catalogos',
    standalone: true,
    imports: [
        FormsModule,
        ButtonModule,
        DialogModule,
        InputTextModule,
        MessageModule,
        TableModule,
        TagModule,
        Tabs,
        TabList,
        Tab,
        TabPanels,
        TabPanel,
    ],
    // El estado vive con la pantalla: al salir o cerrar sesión se destruye.
    providers: [CatalogosStore],
    templateUrl: './catalogos.component.html',
    styleUrl: './catalogos.component.css',
})
export class CatalogosComponent implements OnInit {
    readonly store = inject(CatalogosStore);

    readonly maxNombreCategoria = MAX_NOMBRE_CATEGORIA;
    readonly maxNombreUnidad = MAX_NOMBRE_UNIDAD;
    readonly maxAbreviatura = MAX_ABREVIATURA;
    readonly maxNombreMedioPago = MAX_NOMBRE_MEDIO_PAGO;
    readonly maxDescripcion = MAX_DESCRIPCION;

    readonly formCategoria = new DialogoCatalogo<Categoria, FormularioCategoria>(CATEGORIA_VACIA, (c) => ({
        nombre: c.nombre,
        descripcion: c.descripcion,
    }));
    readonly formUnidad = new DialogoCatalogo<UnidadMedida, FormularioUnidad>(UNIDAD_VACIA, (u) => ({
        nombre: u.nombre,
        abreviatura: u.abreviatura,
        permiteDecimales: u.permite_decimales,
    }));
    readonly formMedio = new DialogoCatalogo<MedioPago, FormularioMedioPago>(MEDIO_PAGO_VACIO, (m) => ({
        nombre: m.nombre,
        descripcion: m.descripcion,
    }));

    readonly baja = signal<BajaPendiente | null>(null);

    ngOnInit(): void {
        this.store.iniciar();
    }

    // ----- Categorías -----
    abrirAltaCategoria(): void {
        this.store.categorias.limpiarFormulario();
        this.formCategoria.abrirAlta();
    }
    abrirEdicionCategoria(categoria: Categoria): void {
        this.store.categorias.limpiarFormulario();
        this.formCategoria.abrirEdicion(categoria);
    }
    guardarCategoria(): void {
        this.store.categorias.guardar(this.formCategoria.formulario(), this.formCategoria.editando(), () =>
            this.formCategoria.cerrar(),
        );
    }
    pedirBajaCategoria(categoria: Categoria): void {
        this.baja.set({ nombre: categoria.nombre, ejecutar: () => this.store.categorias.desactivar(categoria) });
    }

    // ----- Unidades de medida -----
    abrirAltaUnidad(): void {
        this.store.unidades.limpiarFormulario();
        this.formUnidad.abrirAlta();
    }
    abrirEdicionUnidad(unidad: UnidadMedida): void {
        this.store.unidades.limpiarFormulario();
        this.formUnidad.abrirEdicion(unidad);
    }
    guardarUnidad(): void {
        this.store.unidades.guardar(this.formUnidad.formulario(), this.formUnidad.editando(), () =>
            this.formUnidad.cerrar(),
        );
    }
    pedirBajaUnidad(unidad: UnidadMedida): void {
        this.baja.set({ nombre: unidad.nombre, ejecutar: () => this.store.unidades.desactivar(unidad) });
    }

    // ----- Medios de pago -----
    abrirAltaMedio(): void {
        this.store.mediosPago.limpiarFormulario();
        this.formMedio.abrirAlta();
    }
    abrirEdicionMedio(medio: MedioPago): void {
        this.store.mediosPago.limpiarFormulario();
        this.formMedio.abrirEdicion(medio);
    }
    guardarMedio(): void {
        this.store.mediosPago.guardar(this.formMedio.formulario(), this.formMedio.editando(), () =>
            this.formMedio.cerrar(),
        );
    }
    pedirBajaMedio(medio: MedioPago): void {
        this.baja.set({ nombre: medio.nombre, ejecutar: () => this.store.mediosPago.desactivar(medio) });
    }

    // ----- Confirmación de baja (compartida) -----
    cancelarBaja(): void {
        this.baja.set(null);
    }
    confirmarBaja(): void {
        this.baja()?.ejecutar();
        this.baja.set(null);
    }
}
