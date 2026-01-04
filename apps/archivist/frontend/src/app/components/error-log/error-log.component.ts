import { Component, inject } from '@angular/core';
import { ErrorStore } from '../../core/error.store';
import { LanguageService } from '../../core/language.service';

@Component({
  selector: 'app-error-log',
  standalone: true,
  imports: [],
  template: `
    @if (errorStore.showErrorLog()) {
      <div class="overlay" (click)="close()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2>{{ lang.translate('errorLog.title') }}</h2>
            <button class="close-btn" (click)="close()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>
          
          <div class="modal-body">
            @if (errors().length === 0) {
              <div class="empty-state">
                <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M8 12h8"/>
                </svg>
                <p>{{ lang.translate('errorLog.noErrors') }}</p>
              </div>
            } @else {
              <div class="error-list">
                @for (error of errors(); track error.id) {
                  <div class="error-item">
                    <div class="error-header">
                      <span class="error-operation">{{ error.operation }}</span>
                      <span class="error-time">{{ formatTime(error.timestamp) }}</span>
                    </div>
                    <div class="error-message">{{ error.message }}</div>
                    @if (error.path) {
                      <div class="error-path">{{ error.path }}</div>
                    }
                    @if (error.code) {
                      <span class="error-code">{{ error.code }}</span>
                    }
                  </div>
                }
              </div>
            }
          </div>
          
          <div class="modal-footer">
            @if (errors().length > 0) {
              <button class="clear-btn" (click)="clearErrors()">
                {{ lang.translate('errorLog.clear') }}
              </button>
            }
            <button class="close-modal-btn" (click)="close()">
              {{ lang.translate('action.close') }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
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
    
    .modal {
      background: var(--bg-secondary);
      border-radius: 12px;
      width: 90%;
      max-width: 600px;
      max-height: 80vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    }
    
    .modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1rem 1.5rem;
      border-bottom: 1px solid var(--border-color);
    }
    
    .modal-header h2 {
      margin: 0;
      font-size: 1.25rem;
      color: var(--text-primary);
    }
    
    .close-btn {
      width: 32px;
      height: 32px;
      padding: 0;
      background: none;
      border: none;
      border-radius: 6px;
      color: var(--text-secondary);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .close-btn:hover {
      background: var(--bg-tertiary);
      color: var(--text-primary);
    }
    
    .close-btn svg {
      width: 20px;
      height: 20px;
    }
    
    .modal-body {
      flex: 1;
      overflow-y: auto;
      padding: 1rem;
      min-height: 200px;
    }
    
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      min-height: 200px;
      color: var(--text-secondary);
      gap: 1rem;
    }
    
    .empty-icon {
      width: 48px;
      height: 48px;
      opacity: 0.5;
    }
    
    .error-list {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    
    .error-item {
      padding: 0.75rem 1rem;
      background: var(--bg-tertiary);
      border-radius: 8px;
      border-left: 3px solid #ef4444;
    }
    
    .error-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.375rem;
    }
    
    .error-operation {
      font-weight: 600;
      font-size: 0.875rem;
      color: var(--text-primary);
      font-family: monospace;
    }
    
    .error-time {
      font-size: 0.75rem;
      color: var(--text-tertiary);
    }
    
    .error-message {
      font-size: 0.875rem;
      color: #ef4444;
      word-break: break-word;
    }
    
    .error-path {
      font-size: 0.75rem;
      color: var(--text-secondary);
      margin-top: 0.25rem;
      font-family: monospace;
      word-break: break-all;
    }
    
    .error-code {
      display: inline-block;
      margin-top: 0.375rem;
      padding: 0.125rem 0.375rem;
      background: rgba(239, 68, 68, 0.15);
      color: #ef4444;
      border-radius: 4px;
      font-size: 0.75rem;
      font-family: monospace;
    }
    
    .modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
      padding: 1rem 1.5rem;
      border-top: 1px solid var(--border-color);
    }
    
    .clear-btn {
      padding: 0.5rem 1rem;
      background: rgba(239, 68, 68, 0.15);
      border: 1px solid rgba(239, 68, 68, 0.3);
      border-radius: 6px;
      color: #ef4444;
      font-size: 0.875rem;
      cursor: pointer;
    }
    
    .clear-btn:hover {
      background: rgba(239, 68, 68, 0.25);
    }
    
    .close-modal-btn {
      padding: 0.5rem 1rem;
      background: var(--accent-color);
      border: none;
      border-radius: 6px;
      color: white;
      font-size: 0.875rem;
      cursor: pointer;
    }
    
    .close-modal-btn:hover {
      opacity: 0.9;
    }
  `],
})
export class ErrorLogComponent {
  protected readonly errorStore = inject(ErrorStore);
  protected readonly lang = inject(LanguageService);

  readonly errors = this.errorStore.errors;

  formatTime(timestamp: number): string {
    return new Date(timestamp).toLocaleTimeString();
  }

  close(): void {
    this.errorStore.closeErrorLog();
  }

  async clearErrors(): Promise<void> {
    await this.errorStore.clearErrors();
  }
}
