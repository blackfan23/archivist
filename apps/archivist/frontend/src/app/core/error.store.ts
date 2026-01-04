import { inject, Injectable, NgZone, signal } from '@angular/core';
import { NotificationService } from '@medularity/angular/notifications';
import { LanguageService } from './language.service';

export interface BackendError {
  id: string;
  timestamp: number;
  operation: string;
  message: string;
  path?: string;
  code?: string;
  details?: unknown;
}

@Injectable({ providedIn: 'root' })
export class ErrorStore {
  private readonly zone = inject(NgZone);
  private readonly notifications = inject(NotificationService);
  private readonly lang = inject(LanguageService);

  private readonly _errors = signal<BackendError[]>([]);
  private readonly _showErrorLog = signal(false);

  readonly errors = this._errors.asReadonly();
  readonly errorCount = signal(0);
  readonly showErrorLog = this._showErrorLog.asReadonly();

  constructor() {
    this.initBackendErrorListener();
    this.loadErrorLog();
  }

  private initBackendErrorListener(): void {
    if (typeof window !== 'undefined' && window.electron) {
      window.electron.onBackendError((_event: unknown, error: unknown) => {
        this.zone.run(() => {
          this.handleBackendError(error as BackendError);
        });
      });
    }
  }

  private handleBackendError(error: BackendError): void {
    // Add to error list
    this._errors.update((errors) => [...errors, error]);
    this.errorCount.set(this._errors().length);

    // Show notification
    const message = this.formatErrorMessage(error);
    this.notifications.add({
      message,
      type: 'danger',
      config: { duration: 8000 }, // Longer duration for errors
    });
  }

  private formatErrorMessage(error: BackendError): string {
    const baseMsg = this.lang.translate('notify.backendError');
    const formattedMsg = baseMsg.replace('{message}', error.message);
    
    // Include path if available and different from message
    if (error.path && !error.message.includes(error.path)) {
      const filename = error.path.substring(error.path.lastIndexOf('/') + 1);
      return `${formattedMsg} (${filename})`;
    }
    
    return formattedMsg;
  }

  async loadErrorLog(): Promise<void> {
    if (typeof window !== 'undefined' && window.electron) {
      const errors = await window.electron.getErrorLog();
      this._errors.set(errors as BackendError[]);
      this.errorCount.set(errors.length);
    }
  }

  async clearErrors(): Promise<void> {
    if (typeof window !== 'undefined' && window.electron) {
      await window.electron.clearErrorLog();
    }
    this._errors.set([]);
    this.errorCount.set(0);
  }

  openErrorLog(): void {
    this._showErrorLog.set(true);
  }

  closeErrorLog(): void {
    this._showErrorLog.set(false);
  }
}
