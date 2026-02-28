import { Routes } from '@angular/router';
import { ShellComponent } from './shell/shell.component';

export const appRoutes: Routes = [
  {
    path: '',
    component: ShellComponent,
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/start/start.component').then(
            (m) => m.StartComponent,
          ),
      },
      {
        path: 'library',
        loadComponent: () =>
          import('./components/library/library.component').then(
            (m) => m.LibraryComponent,
          ),
      },
      {
        path: 'analysis',
        loadComponent: () =>
          import('./features/analysis/analysis-dashboard.component').then(
            (m) => m.AnalysisDashboardComponent,
          ),
      },
      {
        path: 'cleaner',
        loadComponent: () =>
          import('./features/cleaner/cleaner-dashboard.component').then(
            (m) => m.CleanerDashboardComponent,
          ),
      },
    ],
  },
  {
    path: 'editor/:id',
    loadComponent: () =>
      import('./components/editor/editor.component').then(
        (m) => m.EditorComponent,
      ),
  },
];
