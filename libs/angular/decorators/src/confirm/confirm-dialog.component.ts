import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Output,
  signal,
} from '@angular/core';

export interface ConfirmDialogConfig {
  header: string;
  message?: string;
  positive: string;
  negative: string;
}

@Component({
  selector: 'lib-confirm-dialog',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (isVisible()) {
      <!-- Backdrop -->
      <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in"
        (click)="onCancel()"
      >
        <!-- Dialog -->
        <div
          class="bg-white dark:bg-zinc-800 rounded-xl shadow-2xl max-w-sm w-full mx-4 overflow-hidden animate-scale-in"
          (click)="$event.stopPropagation()"
        >
          <!-- Header -->
          <div class="px-6 py-4 border-b border-zinc-200 dark:border-zinc-700">
            <h3 class="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              {{ config().header }}
            </h3>
            @if (config().message) {
              <p class="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                {{ config().message }}
              </p>
            }
          </div>

          <!-- Actions -->
          <div
            class="px-6 py-4 flex justify-end gap-3 bg-zinc-50 dark:bg-zinc-900/50"
          >
            <button
              type="button"
              class="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 rounded-lg transition-colors"
              (click)="onCancel()"
            >
              {{ config().negative }}
            </button>
            <button
              type="button"
              class="px-4 py-2 text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-lg transition-colors"
              (click)="onConfirm()"
            >
              {{ config().positive }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [
    `
      :host {
        display: contents;
      }

      @keyframes fade-in {
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
        }
      }

      @keyframes scale-in {
        from {
          opacity: 0;
          transform: scale(0.95);
        }
        to {
          opacity: 1;
          transform: scale(1);
        }
      }

      .animate-fade-in {
        animation: fade-in 0.15s ease-out;
      }

      .animate-scale-in {
        animation: scale-in 0.15s ease-out;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmDialogComponent {
  config = signal<ConfirmDialogConfig>({
    header: 'Confirm',
    positive: 'Yes',
    negative: 'No',
  });

  isVisible = signal(true);

  @Output() result = new EventEmitter<boolean>();

  onConfirm(): void {
    this.isVisible.set(false);
    this.result.emit(true);
  }

  onCancel(): void {
    this.isVisible.set(false);
    this.result.emit(false);
  }
}
