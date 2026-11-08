import { Component, computed, inject } from '@angular/core';
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

  // Solo las pantallas que el rol actual puede abrir (misma matriz que usan las rutas).
  items = computed(() => MENU.filter((item) => this.authService.tieneRol(item.roles)));
}
