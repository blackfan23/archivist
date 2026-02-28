import { bootstrapApplication } from '@angular/platform-browser';
import type { ArchivistApi } from '@medularity/archivist-core';
import { App } from './app/app';
import { appConfig } from './app/app.config';

bootstrapApplication(App, appConfig).catch((err) => console.error(err));

declare global {
  interface Window {
    electron: ArchivistApi;
  }
}
