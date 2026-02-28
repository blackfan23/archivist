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
      <div class="confirm-backdrop" (click)="onCancel()">
        <!-- Dialog -->
        <div class="confirm-dialog" (click)="$event.stopPropagation()">
          <!-- Header -->
          <div class="confirm-header">
            <h3 class="confirm-title">
              {{ config().header }}
            </h3>
            @if (config().message) {
              <p class="confirm-message">
                {{ config().message }}
              </p>
            }
          </div>

          <!-- Actions -->
          <div class="confirm-actions">
            <button
              type="button"
              class="confirm-btn confirm-btn-secondary"
              (click)="onCancel()"
            >
              {{ config().negative }}
            </button>
            <button
              type="button"
              class="confirm-btn confirm-btn-primary"
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

      .confirm-backdrop {
        position: fixed;
        inset: 0;
        z-index: 50;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(4px);
        animation: fade-in 0.15s ease-out;
      }

      .confirm-dialog {
        background: var(--color-bg-secondary, #fff);
        border-radius: 0.75rem;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
        border: 1px solid var(--color-border, #e4e4e7);
        max-width: 24rem;
        width: 100%;
        margin: 1rem;
        overflow: hidden;
        animation: scale-in 0.15s ease-out;
      }

      .confirm-header {
        padding: 1.5rem;
        border-bottom: 1px solid var(--color-border, #e4e4e7);
      }

      .confirm-title {
        font-size: 1.125rem;
        font-weight: 600;
        color: var(--color-text-primary, #18181b);
        margin: 0;
      }

      .confirm-message {
        margin-top: 0.25rem;
        font-size: 0.875rem;
        color: var(--color-text-secondary, #52525b);
      }

      .confirm-actions {
        padding: 1rem 1.5rem;
        display: flex;
        justify-content: flex-end;
        gap: 0.75rem;
        background: var(--color-bg-tertiary, #f4f4f5);
      }

      .confirm-btn {
        padding: 0.5rem 1rem;
        font-size: 0.875rem;
        font-weight: 500;
        border-radius: 0.5rem;
        border: none;
        cursor: pointer;
        transition: background-color 0.15s, color 0.15s, opacity 0.15s;
      }

      .confirm-btn-secondary {
        color: var(--color-text-primary, #3f3f46);
        background: var(--color-bg-tertiary, #e4e4e7);
      }

      .confirm-btn-secondary:hover {
        opacity: 0.85;
      }

      .confirm-btn-primary {
        color: #fff;
        background: var(--color-primary, #7c3aed);
      }

      .confirm-btn-primary:hover {
        background: var(--color-primary-dark, #6d28d9);
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
