import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from '../core/components/sidebar/sidebar.component';

@Component({
    selector: 'app-layout',
    standalone: true,
    imports: [RouterOutlet, SidebarComponent],
    template: `
        <div class="layout">
            <app-sidebar></app-sidebar>

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
                padding: 1.5rem;
                overflow-y: auto;
            }
        `]
})
export class AppLayoutComponent {}