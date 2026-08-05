import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

// Importaciones estrictas de PrimeNG v21
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { LoginRequestDto } from '../../core/models/dto/login-request.dto';

@Component({
    selector: 'app-login',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        CardModule,
        InputTextModule,
        PasswordModule,
        ButtonModule,
        MessageModule,
        IconFieldModule,
        InputIconModule
    ],
    template: `
        <div class="login-container flex align-items-center justify-content-center min-h-screen p-4">
            <p-card [style]="{ width: '400px' }">
                <div class="flex flex-column align-items-center text-center mb-3">
                    <i class="pi pi-file-invoice text-4xl mb-2" style="color: var(--primary-color);"></i>
                    <h2 class="m-0">Sistema de Comprobantes</h2>
                    <span class="text-color-secondary">Identificación de Usuario</span>
                </div>

                <form (ngSubmit)="onSubmit()" #loginForm="ngForm" class="flex flex-column gap-3 mt-3">

                    <div class="flex flex-column gap-2">
                        <label for="username" class="font-semibold">Nombre de Usuario</label>
                        <p-iconfield>
                            <p-inputicon class="pi pi-user" />
                            <input
                                pInputText
                                id="username"
                                name="username"
                                type="text"
                                autocomplete="username"
                                [(ngModel)]="username"
                                required
                                placeholder="Usuario"
                                class="w-full" />
                        </p-iconfield>
                    </div>

                    <div class="flex flex-column gap-2">
                        <label for="password" class="font-semibold">Contraseña</label>
                        <p-password 
                            id="password" 
                            name="password" 
                            [(ngModel)]="password" 
                            [feedback]="false" 
                            [toggleMask]="true"
                            autocomplete="current-password"
                            styleClass="w-full" 
                            inputStyleClass="w-full"
                            [required]="true"
                            placeholder="••••••••">
                        </p-password>
                    </div>

                    @if (errorLogin()) {
                        <p-message severity="error" text="Usuario o Contraseña incorrectos"></p-message>
                    }

                    <div class="mt-2">
                        <p-button 
                        label="Ingresar" 
                        type="submit" 
                        icon="pi pi-sign-in" 
                        [style]="{ width: '100%' }"
                        [loading]="cargando()"
                        [disabled]="!loginForm.valid || cargando()">
                        </p-button>
                    </div>

                </form>
            </p-card>
        </div>
    `,
    styles: [`
        :host {
            display: block;
        }

        .login-container {
            background: radial-gradient(circle at top, #1e2530 0%, #12161d 60%, #0a0d12 100%);
        }

        :host ::ng-deep .p-card {
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 12px;
        }
    `]
})
    export class LoginComponent {
    #authService = inject(AuthService);
    #router = inject(Router);

    // Estado local del formulario con Signals
    username = '';
    password = '';
    errorLogin = signal<boolean>(false);
    cargando = signal<boolean>(false);

    onSubmit(): void {

        this.errorLogin.set(false);
        this.cargando.set(true);

        const dto: LoginRequestDto = {
            username: this.username,
            password: this.password
        };

        this.#authService.login(dto).subscribe({

            next: () => {
                this.#router.navigate(['/dashboard']);
            },
            error: () => {
                this.errorLogin.set(true);
                this.cargando.set(false);
            }
        });

    }
}