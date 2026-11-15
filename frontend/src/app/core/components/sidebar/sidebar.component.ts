import { Component, computed, inject, input, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { ButtonModule } from 'primeng/button';

import { MENU } from '../../navegacion';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, ButtonModule],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.css'
})
export class SidebarComponent {
  authService = inject(AuthService);

  /** En pantallas chicas el menú es un panel que se abre y se cierra. */
  abierto = input(false);
  /** Se emite al tocar un enlace, para que el layout cierre el panel. */
  navegar = output<void>();

  // Solo las pantallas que el rol actual puede abrir (misma matriz que usan las rutas).
  items = computed(() => MENU.filter((item) => this.authService.tieneRol(item.roles)));
}
