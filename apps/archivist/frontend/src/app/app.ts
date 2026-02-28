import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastContainerComponent } from '@medularity/angular/notifications';
import { ElectronService } from './core/electron.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ToastContainerComponent],
  template: `
    <router-outlet />
    <lib-toast-container />
  `,
  styles: [
    `
      :host {
        display: block;
        height: 100vh;
      }
    `,
  ],
})
export class App implements OnInit {
  private readonly electronService = inject(ElectronService);

  ngOnInit(): void {
    console.log('Frontend ready');
    this.electronService.appReady();
  }
}
