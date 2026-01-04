import {
    ApplicationRef,
    createComponent,
    EnvironmentInjector,
    inject,
    Injectable,
} from '@angular/core';
import {
    ConfirmDialogComponent,
    ConfirmDialogConfig,
} from './confirm-dialog.component';

@Injectable({
  providedIn: 'root',
})
export class ConfirmDialogService {
  private static instance: ConfirmDialogService;
  private appRef = inject(ApplicationRef);
  private injector = inject(EnvironmentInjector);

  constructor() {
    ConfirmDialogService.instance = this;
  }

  public static getInstance(): ConfirmDialogService {
    if (!ConfirmDialogService.instance) {
      throw new Error(
        'ConfirmDialogService not initialized. Make sure provideConfirmable() is included in your app config.',
      );
    }
    return ConfirmDialogService.instance;
  }

  /**
   * Shows a confirmation dialog and returns a promise that resolves to true if confirmed, false if cancelled
   */
  confirm(config: ConfirmDialogConfig): Promise<boolean> {
    return new Promise((resolve) => {
      // Create the component
      const componentRef = createComponent(ConfirmDialogComponent, {
        environmentInjector: this.injector,
      });

      // Set the config
      componentRef.instance.config.set(config);

      // Handle result
      const subscription = componentRef.instance.result.subscribe((result) => {
        resolve(result);
        subscription.unsubscribe();

        // Remove the component from the DOM
        const element = componentRef.location.nativeElement;
        if (element.parentNode === document.body) {
          document.body.removeChild(element);
        }
        
        componentRef.destroy();
      });

      // Attach to the application
      this.appRef.attachView(componentRef.hostView);

      // Add to the DOM
      document.body.appendChild(componentRef.location.nativeElement);
    });
  }
}
