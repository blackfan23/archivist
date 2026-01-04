import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastContainerComponent } from '@medularity/angular/notifications';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ToastContainerComponent],
  template: `
    <router-outlet />
    <lib-toast-container />
  `,
  styles: [`:host { display: block; height: 100vh; }`],
})
export class App {}
