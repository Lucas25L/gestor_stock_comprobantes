import { Component, OnInit, inject } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';

import { formatearCantidad } from '../../core/utils/decimal';
import { ReposicionStore } from './reposicion.store';

@Component({
    selector: 'app-reposicion',
    standalone: true,
    imports: [ButtonModule, MessageModule, TableModule, TagModule],
    // El estado vive con la pantalla: al salir o cerrar sesión se destruye.
    providers: [ReposicionStore],
    templateUrl: './reposicion.component.html',
    styleUrl: './reposicion.component.css',
})
export class ReposicionComponent implements OnInit {
    readonly store = inject(ReposicionStore);

    readonly formatearCantidad = formatearCantidad;

    ngOnInit(): void {
        this.store.cargar();
    }
}
