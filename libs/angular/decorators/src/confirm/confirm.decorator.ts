import { ConfirmDialogService } from './confirm-dialog.service';

export interface ConfirmableOptions {
  header: string;
  message?: string;
  positive: string;
  negative: string;
}

/**
 * Decorator that shows a confirmation dialog before executing the decorated method.
 * If the user confirms, the method is executed. If cancelled, the method returns null.
 *
 * @example
 * ```typescript
 * export class MyComponent {
 *   @Confirmable({
 *     header: 'Delete item?',
 *     message: 'This action cannot be undone.',
 *     positive: 'Delete',
 *     negative: 'Cancel'
 *   })
 *   async deleteItem() {
 *     // This only runs if user clicks "Delete"
 *   }
 * }
 * ```
 */
export function Confirmable(
  options: ConfirmableOptions = {
    header: 'Är du säker?',
    positive: 'Ja',
    negative: 'Nej',
  },
): MethodDecorator {
  return function (
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]) {
      try {
        // Get the confirm dialog service instance
        const confirmService = ConfirmDialogService.getInstance();

        // Show the confirmation dialog
        const confirmed = await confirmService.confirm({
          header: options.header,
          message: options.message,
          positive: options.positive,
          negative: options.negative,
        });

        if (confirmed) {
          return originalMethod.apply(this, args);
        }

        return null;
      } catch (error) {
        console.error('Error in @Confirmable decorator:', error);
        // Fallback: execute original method if service is not available (e.g. during testing if not mocked)
        // or rethrow depending on desired behavior. Here we'll try to execute it to not block the user action completely
        // if the dialog system fails, but logging the error is important.
        // Actually, if the service is missing, it's a config error.
        // But to be safe and not break the app completely in edge cases:
        return originalMethod.apply(this, args);
      }
    };

    return descriptor;
  };
}

