import { Routes } from '@angular/router';
import { ShellComponent } from './shell/shell.component';

export const appRoutes: Routes = [
  {
    path: '',
    component: ShellComponent,
  },
  {
    path: 'editor/:id',
    loadComponent: () => import('./components/editor/editor.component').then(m => m.EditorComponent),
  },
];
