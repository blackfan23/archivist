import {
  EnvironmentProviders,
  inject,
  makeEnvironmentProviders,
  provideAppInitializer,
} from '@angular/core';
import { ConfirmDialogService } from './confirm/confirm-dialog.service';
import { DevModeService } from './dev-mode/devmode.service';

export function provideDecorators({
  isProduction,
}: {
  isProduction: boolean;
}): EnvironmentProviders {
  return makeEnvironmentProviders([
    ConfirmDialogService,
    DevModeService,
    provideAppInitializer(() => {
      // Initialize ConfirmDialogService singleton
      inject(ConfirmDialogService);
      inject(DevModeService).setEnvironment(isProduction);
    }),
  ]);
}
