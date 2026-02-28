import {
  Component,
  effect,
  ElementRef,
  inject,
  viewChildren,
} from '@angular/core';
import { LanguageService } from '../../core/language.service';
import { MatchQueueStore } from '../../core/match-queue.store';

@Component({
  selector: 'app-match-queue-panel',
  standalone: true,
  imports: [],
  template: `
    @if (queueStore.showPanel()) {
      <div class="overlay" (click)="close()">
        <div class="panel" (click)="$event.stopPropagation()">
          <header class="panel-header">
            <h2>{{ lang.translate('queue.title') }}</h2>
            <button class="close-btn" (click)="close()">×</button>
          </header>

          <div class="panel-body">
            @if (queueStore.isProcessing()) {
              <div class="progress-section">
                <div class="progress-bar">
                  <div
                    class="progress-fill"
                    [style.width.%]="progressPercent()"
                  ></div>
                </div>
                <span class="progress-text">
                  {{ lang.translate('queue.processing') }}
                  {{ queueStore.progress().current }} /
                  {{ queueStore.progress().total }}
                </span>
              </div>
            }

            @if (queueStore.queue().length === 0) {
              <div class="empty-state">
                <svg
                  class="empty-icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                >
                  <path
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  />
                </svg>
                <p>{{ lang.translate('queue.empty') }}</p>
              </div>
            } @else {
              <div class="queue-list">
                @for (item of queueStore.queue(); track item.id) {
                  <div
                    #queueItem
                    class="queue-item"
                    [class.processing]="item.status === 'processing'"
                    [class.success]="item.status === 'success'"
                    [class.error]="item.status === 'error'"
                  >
                    <div class="item-content">
                      <div class="item-filename">{{ item.file.filename }}</div>
                      <div class="item-preview">
                        → {{ item.previewFilename }}
                      </div>
                      @if (item.error) {
                        <div class="item-error">{{ item.error }}</div>
                      }
                    </div>
                    <div class="item-status">
                      @if (item.status === 'pending') {
                        <button
                          class="remove-btn"
                          (click)="removeItem(item.id)"
                          [disabled]="queueStore.isProcessing()"
                        >
                          ×
                        </button>
                      } @else if (item.status === 'processing') {
                        <div class="spinner"></div>
                      } @else if (item.status === 'success') {
                        <svg
                          class="status-icon success"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      } @else if (item.status === 'error') {
                        <svg
                          class="status-icon error"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                        >
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      }
                    </div>
                  </div>
                }
              </div>
            }
          </div>

          <footer class="panel-footer">
            <div class="footer-buttons">
              <button
                class="btn secondary"
                (click)="clearQueue()"
                [disabled]="
                  queueStore.isProcessing() || queueStore.finishedCount() === 0
                "
              >
                {{ lang.translate('queue.clearFinished') }}
              </button>

              @if (queueStore.isEngineActive()) {
                <button
                  class="btn secondary"
                  (click)="pauseEngine()"
                  [disabled]="!queueStore.hasItems()"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    style="width: 14px; height: 14px"
                  >
                    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                  </svg>
                  {{ lang.translate('queue.pauseEngine') }}
                </button>
              } @else {
                <button class="btn primary" (click)="resumeEngine()">
                  <svg
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    style="width: 14px; height: 14px"
                  >
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  {{ lang.translate('queue.resumeEngine') }}
                </button>
              }

              <button
                class="btn primary"
                (click)="processQueue()"
                [disabled]="
                  queueStore.isProcessing() || queueStore.queueCount() === 0
                "
              >
                @if (queueStore.isProcessing()) {
                  <span class="btn-spinner"></span>
                }
                {{ lang.translate('queue.processQueue') }}
                @if (queueStore.queueCount() > 0) {
                  ({{ queueStore.queueCount() }})
                }
              </button>
            </div>
          </footer>
        </div>
      </div>
    }
  `,
  styles: [
    `
      .overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.6);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        backdrop-filter: blur(4px);
      }

      .panel {
        background: var(--color-bg-secondary);
        border-radius: 12px;
        width: 90%;
        max-width: 600px;
        max-height: 80vh;
        display: flex;
        flex-direction: column;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
      }

      .panel-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 1rem 1.5rem;
        border-bottom: 1px solid var(--color-border);
      }

      .panel-header h2 {
        margin: 0;
        font-size: 1.25rem;
        color: var(--color-text-primary);
      }

      .close-btn {
        width: 32px;
        height: 32px;
        padding: 0;
        background: none;
        border: none;
        border-radius: 6px;
        color: var(--color-text-secondary);
        font-size: 1.5rem;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .close-btn:hover:not(:disabled) {
        background: var(--color-bg-tertiary);
        color: var(--color-text-primary);
      }

      .panel-body {
        flex: 1;
        overflow-y: auto;
        padding: 1rem;
        min-height: 200px;
      }

      .progress-section {
        padding: 1rem;
        background: var(--color-bg-tertiary);
        border-radius: 8px;
        margin-bottom: 1rem;
      }

      .progress-bar {
        height: 8px;
        background: var(--color-bg-primary);
        border-radius: 4px;
        overflow: hidden;
        margin-bottom: 0.5rem;
      }

      .progress-fill {
        height: 100%;
        background: var(--color-primary);
        transition: width 0.3s ease;
      }

      .progress-text {
        font-size: 0.875rem;
        color: var(--color-text-secondary);
      }

      .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        min-height: 200px;
        color: var(--color-text-secondary);
        gap: 1rem;
      }

      .empty-icon {
        width: 48px;
        height: 48px;
        opacity: 0.5;
      }

      .queue-list {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }

      .queue-item {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.75rem 1rem;
        background: var(--color-bg-tertiary);
        border-radius: 8px;
        border-left: 3px solid var(--color-border);
      }

      .queue-item.processing {
        border-left-color: var(--color-primary);
      }

      .queue-item.success {
        border-left-color: #22c55e;
      }

      .queue-item.error {
        border-left-color: #ef4444;
      }

      .item-content {
        flex: 1;
        min-width: 0;
      }

      .item-filename {
        font-size: 0.875rem;
        font-weight: 500;
        color: var(--color-text-primary);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .item-preview {
        font-size: 0.75rem;
        color: var(--color-primary);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .item-error {
        font-size: 0.75rem;
        color: #ef4444;
        margin-top: 0.25rem;
      }

      .item-status {
        flex-shrink: 0;
        width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .remove-btn {
        width: 24px;
        height: 24px;
        padding: 0;
        background: none;
        border: none;
        border-radius: 4px;
        color: var(--color-text-muted);
        font-size: 1.25rem;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .remove-btn:hover:not(:disabled) {
        background: rgba(239, 68, 68, 0.1);
        color: #ef4444;
      }

      .spinner {
        width: 20px;
        height: 20px;
        border: 2px solid var(--color-bg-primary);
        border-top-color: var(--color-primary);
        border-radius: 50%;
        animation: spin 1s linear infinite;
      }

      .status-icon {
        width: 20px;
        height: 20px;
      }

      .status-icon.success {
        color: #22c55e;
      }

      .status-icon.error {
        color: #ef4444;
      }

      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }

      .panel-footer {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        padding: 1rem 1.5rem;
        border-top: 1px solid var(--color-border);
      }

      .footer-buttons {
        display: flex;
        justify-content: flex-end;
        gap: 0.75rem;
      }

      .btn {
        padding: 0.5rem 1rem;
        border: none;
        border-radius: 6px;
        font-size: 0.875rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        gap: 0.25rem;
      }

      .btn.secondary {
        background: var(--color-bg-tertiary);
        color: var(--color-text-primary);
      }

      .btn.secondary:hover:not(:disabled) {
        background: var(--color-bg-tertiary);
      }

      .btn.primary {
        background: var(--color-primary);
        color: white;
      }

      .btn.primary:hover:not(:disabled) {
        filter: brightness(1.1);
      }

      .btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .btn-spinner {
        width: 14px;
        height: 14px;
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-top-color: white;
        border-radius: 50%;
        animation: spin 1s linear infinite;
      }
    `,
  ],
})
export class MatchQueuePanelComponent {
  protected readonly queueStore = inject(MatchQueueStore);
  protected readonly lang = inject(LanguageService);
  private readonly itemElements =
    viewChildren<ElementRef<HTMLElement>>('queueItem');

  constructor() {
    effect(() => {
      const queue = this.queueStore.queue();
      const processingItemIndex = queue.findIndex(
        (i) => i.status === 'processing',
      );

      if (processingItemIndex !== -1) {
        const elements = this.itemElements();
        const element = elements[processingItemIndex];
        if (element) {
          element.nativeElement.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
          });
        }
      }
    });
  }

  progressPercent(): number {
    const progress = this.queueStore.progress();
    if (progress.total === 0) return 0;
    return (progress.current / progress.total) * 100;
  }

  close(): void {
    this.queueStore.closePanel();
  }

  removeItem(id: string): void {
    this.queueStore.removeFromQueue(id);
  }

  clearQueue(): void {
    this.queueStore.clearQueue();
  }

  async processQueue(): Promise<void> {
    await this.queueStore.processQueue();
  }

  async pauseEngine(): Promise<void> {
    await this.queueStore.pauseEngine();
  }

  async resumeEngine(): Promise<void> {
    await this.queueStore.resumeEngine();
  }
}
