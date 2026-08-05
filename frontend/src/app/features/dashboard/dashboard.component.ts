import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router'; // <-- CRÍTICO: Importación necesaria para Standalone
import { AuthService } from '../../core/services/auth.service';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';

@Component({
    selector: 'app-dashboard',
    standalone: true,
    imports: [
        CommonModule,
        CardModule, 
        ButtonModule
    ],
    template: `
        <div class="p-4">
        <div class="flex justify-content-between align-items-center mb-4">
            <h1 class="text-3xl font-bold">Bienvenido, {{ authService.usuarioActual()?.username }}</h1>
        </div>
    `
})
export class DashboardComponent {
    authService = inject(AuthService);
}