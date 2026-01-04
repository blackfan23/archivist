import { NgClass } from '@angular/common';
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
  imports: [NgClass],
  template: `
    @let _notification = notification();
    <div
      class="flex items-start w-full max-w-sm overflow-hidden bg-white rounded-lg shadow-md pointer-events-auto ring-1 ring-black ring-opacity-5 dark:bg-zinc-800 dark:ring-zinc-700 transition-all duration-300 ease-[cubic-bezier(0,0,0.2,1)] transform"
      [class.opacity-0]="!isVisible() || _notification.closing"
      [class.translate-y-4]="!isVisible() || _notification.closing"
      [class.scale-95]="!isVisible() || _notification.closing"
      [class.opacity-100]="isVisible() && !_notification.closing"
      [class.translate-y-0]="isVisible() && !_notification.closing"
      [class.scale-100]="isVisible() && !_notification.closing"
      [ngClass]="{
        border: true,
        'border-l-4': true,
        'border-blue-500': _notification.type === 'basic',
        'border-green-500': _notification.type === 'success',
        'border-red-500': _notification.type === 'danger',
      }"
    >
      <div class="p-4 flex-1">
        <div class="flex items-start">
          <div class="flex-shrink-0 pt-0.5">
            <!-- Icons -->
            @switch (_notification.type) {
              @case ('success') {
                <svg
                  class="w-5 h-5 text-green-500"
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
                  class="w-5 h-5 text-red-500"
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
                  class="w-5 h-5 text-blue-500"
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
          <div class="ml-3 w-0 flex-1 pt-0.5">
            <p class="text-sm font-medium text-gray-900 dark:text-gray-100">
              <span [innerHTML]="_notification.message"></span>
              @if (remainingSeconds() !== null) {
                <span class="ml-1 text-xs text-gray-500 dark:text-gray-400"
                  >({{ remainingSeconds() }}s)</span
                >
              }
            </p>
          </div>
          <div class="ml-4 flex-shrink-0 flex">
            <button
              type="button"
              (click)="dismiss.emit(_notification.id)"
              class="bg-transparent rounded-md inline-flex text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:text-gray-500 dark:hover:text-gray-400"
            >
              <span class="sr-only">Close</span>
              <svg
                class="h-5 w-5"
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
})
export class ToastComponent implements OnInit, OnDestroy {
  notification = input.required<Notification>();
  dismiss = output<string>();

  isVisible = signal(false);
  remainingSeconds = signal<number | null>(null);
  private timer: any;

  ngOnInit() {
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

  ngOnDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }
}
