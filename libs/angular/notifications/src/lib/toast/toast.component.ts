import {
    Component,
    input,
    OnDestroy,
    OnInit,
    output,
    signal,
} from '@angular/core';
import { Notification } from '../notification.types';

@Component({
  selector: 'lib-toast',
  standalone: true,
  imports: [],
  template: `
    @let _notification = notification();
    <div
      class="toast"
      [class.toast-visible]="isVisible() && !_notification.closing"
      [class.toast-hidden]="!isVisible() || _notification.closing"
      [class.toast-basic]="_notification.type === 'basic'"
      [class.toast-success]="_notification.type === 'success'"
      [class.toast-danger]="_notification.type === 'danger'"
    >
      <div class="toast-body">
        <div class="toast-content">
          <div class="toast-icon-wrapper">
            <!-- Icons -->
            @switch (_notification.type) {
              @case ('success') {
                <svg
                  class="toast-icon toast-icon-success"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              }
              @case ('danger') {
                <svg
                  class="toast-icon toast-icon-danger"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              }
              @case ('basic') {
                <svg
                  class="toast-icon toast-icon-basic"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              }
            }
          </div>
          <div class="toast-message-wrapper">
            <p class="toast-message">
              <span [innerHTML]="_notification.message"></span>
              @if (remainingSeconds() !== null) {
                <span class="toast-countdown">({{ remainingSeconds() }}s)</span>
              }
            </p>
          </div>
          <div class="toast-close-wrapper">
            <button
              type="button"
              (click)="dismiss.emit(_notification.id)"
              class="toast-close-btn"
            >
              <span class="sr-only">Close</span>
              <svg
                class="toast-close-icon"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: `
    .toast {
      display: flex;
      align-items: flex-start;
      width: 100%;
      max-width: 24rem;
      overflow: hidden;
      background: var(--color-bg-primary, #fff);
      border-radius: 0.5rem;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
      pointer-events: auto;
      border: 1px solid rgba(0, 0, 0, 0.05);
      border-left-width: 4px;
      transition: opacity 0.3s cubic-bezier(0, 0, 0.2, 1),
                  transform 0.3s cubic-bezier(0, 0, 0.2, 1);
    }

    :host-context(.dark) .toast {
      background: var(--color-bg-secondary, #27272a);
      border-color: var(--color-border, #3f3f46);
    }

    .toast-visible {
      opacity: 1;
      transform: translateY(0) scale(1);
    }

    .toast-hidden {
      opacity: 0;
      transform: translateY(1rem) scale(0.95);
    }

    .toast-basic {
      border-left-color: var(--color-info, #3b82f6);
    }

    .toast-success {
      border-left-color: var(--color-success, #22c55e);
    }

    .toast-danger {
      border-left-color: var(--color-danger, #ef4444);
    }

    .toast-body {
      padding: 1rem;
      flex: 1;
    }

    .toast-content {
      display: flex;
      align-items: flex-start;
    }

    .toast-icon-wrapper {
      flex-shrink: 0;
      padding-top: 0.125rem;
    }

    .toast-icon {
      width: 1.25rem;
      height: 1.25rem;
    }

    .toast-icon-success {
      color: var(--color-success, #22c55e);
    }

    .toast-icon-danger {
      color: var(--color-danger, #ef4444);
    }

    .toast-icon-basic {
      color: var(--color-info, #3b82f6);
    }

    .toast-message-wrapper {
      margin-left: 0.75rem;
      flex: 1;
      min-width: 0;
      padding-top: 0.125rem;
    }

    .toast-message {
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--color-text-primary, #111827);
      margin: 0;
    }

    :host-context(.dark) .toast-message {
      color: var(--color-text-primary, #f3f4f6);
    }

    .toast-countdown {
      margin-left: 0.25rem;
      font-size: 0.75rem;
      color: var(--color-text-muted, #6b7280);
    }

    :host-context(.dark) .toast-countdown {
      color: var(--color-text-muted, #9ca3af);
    }

    .toast-close-wrapper {
      margin-left: 1rem;
      flex-shrink: 0;
      display: flex;
    }

    .toast-close-btn {
      display: inline-flex;
      background: transparent;
      border: none;
      border-radius: 0.375rem;
      color: var(--color-text-muted, #9ca3af);
      cursor: pointer;
      padding: 0.25rem;
      transition: color 0.15s;
    }

    .toast-close-btn:hover {
      color: var(--color-text-secondary, #6b7280);
    }

    .toast-close-btn:focus {
      outline: none;
      box-shadow: 0 0 0 2px var(--color-primary, #3b82f6);
    }

    :host-context(.dark) .toast-close-btn {
      color: var(--color-text-muted, #6b7280);
    }

    :host-context(.dark) .toast-close-btn:hover {
      color: var(--color-text-secondary, #9ca3af);
    }

    .toast-close-icon {
      width: 1.25rem;
      height: 1.25rem;
    }

    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }
  `,
})
export class ToastComponent implements OnInit, OnDestroy {
  notification = input.required<Notification>();
  dismiss = output<string>();

  isVisible = signal(false);
  remainingSeconds = signal<number | null>(null);
  private timer: ReturnType<typeof setInterval> | undefined;

  ngOnInit(): void {
    // Slight delay to allow render before transition
    requestAnimationFrame(() => {
      this.isVisible.set(true);
    });

    if (this.notification().duration > 0) {
      this.remainingSeconds.set(Math.ceil(this.notification().duration / 1000));
      this.timer = setInterval(() => {
        this.remainingSeconds.update((s) => {
          if (s === null || s <= 0) return 0;
          return s - 1;
        });
      }, 1000);
    }
  }

  ngOnDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }
}
