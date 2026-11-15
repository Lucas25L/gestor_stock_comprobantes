import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from '../core/components/sidebar/sidebar.component';

@Component({
    selector: 'app-layout',
    standalone: true,
    imports: [RouterOutlet, SidebarComponent],
    template: `
        <div class="layout">
            <header class="barra-movil">
                <button
                    type="button"
                    class="boton-menu"
                    aria-label="Abrir menú"
                    [attr.aria-expanded]="menuAbierto()"
                    (click)="menuAbierto.set(true)">
                    <i class="pi pi-bars"></i>
                </button>
                <strong>Gestor de Stock</strong>
            </header>

            @if (menuAbierto()) {
                <div class="fondo-menu" (click)="menuAbierto.set(false)"></div>
            }

            <app-sidebar [abierto]="menuAbierto()" (navegar)="menuAbierto.set(false)"></app-sidebar>

            <main class="content">
                <router-outlet></router-outlet>
            </main>
        </div>
    `,
    styles: [`
        .layout {
            display: flex;
            min-height: 100vh;
            background: var(--surface-ground);
        }

        .content {
            flex: 1;
            min-width: 0;
            padding: 1.5rem;
            overflow-y: auto;
        }

        .barra-movil,
        .fondo-menu {
            display: none;
        }

        @media (max-width: 767px) {
            .layout {
                flex-direction: column;
            }

            .barra-movil {
                position: sticky;
                top: 0;
                z-index: 900;
                display: flex;
                align-items: center;
                gap: 0.75rem;
                padding: 0.6rem 1rem;
                background: #111827;
                color: white;
            }

            .boton-menu {
                background: transparent;
                border: 0;
                color: white;
                font-size: 1.4rem;
                cursor: pointer;
            }

            .fondo-menu {
                display: block;
                position: fixed;
                inset: 0;
                z-index: 950;
                background: rgba(0, 0, 0, 0.5);
            }

            .content {
                padding: 1rem;
            }
        }

        @media print {
            app-sidebar,
            .barra-movil,
            .fondo-menu {
                display: none !important;
            }

            .content {
                padding: 0;
                overflow: visible;
            }
        }
    `],
})
export class AppLayoutComponent {
    readonly menuAbierto = signal(false);
}
