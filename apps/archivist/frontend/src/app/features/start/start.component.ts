import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { LanguageService } from '../../core/language.service';
import { MediaStore } from '../../core/media.store';
import { SettingsService } from '../../core/settings.service';

@Component({
  selector: 'app-start',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="start-container">
      <div class="start-card">
        <div class="start-header">
          <svg class="start-logo" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
          <h1>{{ lang.translate('start.title') }}</h1>
        </div>

        <div class="path-selection">
          <div class="current-path" [class.no-path]="!store.lastScanPath()">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path
                d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
              />
            </svg>
            <span class="path-text" [title]="store.lastScanPath() || ''">
              {{
                store.lastScanPath() || lang.translate('start.noFolderSelected')
              }}
            </span>
          </div>
          <button class="browse-btn" (click)="selectFolder()">
            {{ lang.translate('start.selectFolder') }}
          </button>
        </div>

        <div class="options">
          <button
            class="option-ai"
            [disabled]="!store.lastScanPath() || !hasApiKeys()"
            (click)="startAnalysis()"
          >
            <div class="option-icon">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  d="M12 3l1.912 5.885h6.19l-5.007 3.638 1.912 5.885L12 14.77l-5.007 3.638 1.912-5.885-5.007-3.638h6.19L12 3z"
                />
              </svg>
            </div>
            <div class="option-content">
              <h3>{{ lang.translate('start.matchWithAi') }}</h3>
              <p>{{ lang.translate('start.matchWithAiDesc') }}</p>
              @if (!hasApiKeys() && store.lastScanPath()) {
                <span class="warning-text">
                  {{ lang.translate('start.aiKeysRequired') }}
                </span>
              }
            </div>
          </button>

          <button
            class="option-cleaner"
            [disabled]="!store.lastScanPath()"
            (click)="startCleaner()"
          >
            <div class="option-icon">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6M4 6h16"
                />
              </svg>
            </div>
            <div class="option-content">
              <h3>{{ lang.translate('start.storageCleaner') }}</h3>
              <p>{{ lang.translate('start.storageCleanerDesc') }}</p>
            </div>
          </button>

          <div class="manual-section">
            <button
              class="option-manual"
              [disabled]="!store.lastScanPath()"
              (click)="startManual()"
            >
              {{ lang.translate('start.matchManually') }}
            </button>
            @if (store.lastScanPath()) {
              <p class="option-manual-desc">
                {{ lang.translate('start.matchManuallyDesc') }}
              </p>
            }
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: flex;
        flex: 1;
        height: 100%;
        width: 100%;
      }

      .start-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        flex: 1;
        width: 100%;
        background: var(--color-bg-primary);
        padding: 2rem;
      }

      .start-card {
        width: 100%;
        max-width: 540px;
        background: var(--color-bg-secondary);
        border: 1px solid var(--color-border);
        border-radius: 12px;
        padding: 2.5rem;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);
      }

      .start-header {
        text-align: center;
        margin-bottom: 2.5rem;
      }

      .start-logo {
        width: 56px;
        height: 56px;
        color: var(--color-primary);
        margin-bottom: 1.25rem;
      }

      h1 {
        font-size: 1.875rem;
        font-weight: 700;
        margin: 0;
        color: var(--color-text-primary);
        letter-spacing: -0.02em;
      }

      .path-selection {
        display: flex;
        gap: 0.75rem;
        margin-bottom: 2.5rem;
      }

      .current-path {
        flex: 1;
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.75rem 1rem;
        background: var(--color-bg-tertiary);
        border: 1px solid var(--color-border);
        border-radius: 8px;
        min-width: 0;
      }

      .current-path svg {
        width: 18px;
        height: 18px;
        color: var(--color-text-secondary);
        flex-shrink: 0;
      }

      .path-text {
        font-size: 0.875rem;
        color: var(--color-text-primary);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .no-path {
        color: var(--color-text-muted);
      }

      .browse-btn {
        padding: 0 1.25rem;
        background: var(--color-bg-secondary);
        border: 1px solid var(--color-border);
        border-radius: 8px;
        color: var(--color-text-primary);
        font-size: 0.875rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
        white-space: nowrap;
      }

      .browse-btn:hover {
        background: var(--color-bg-tertiary);
        border-color: var(--color-text-muted);
      }

      .options {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
      }

      .option-ai {
        display: flex;
        align-items: center;
        gap: 1.25rem;
        width: 100%;
        padding: 1.75rem;
        background: var(--color-primary);
        border: none;
        border-radius: 12px;
        color: white;
        text-align: left;
        cursor: pointer;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      }

      .option-ai:hover:not(:disabled) {
        transform: translateY(-2px);
        box-shadow: 0 12px 24px rgba(var(--color-primary-rgb), 0.3);
        filter: brightness(1.05);
      }

      .option-ai:active:not(:disabled) {
        transform: translateY(0);
      }

      .option-ai:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .option-cleaner {
        display: flex;
        align-items: center;
        gap: 1.25rem;
        width: 100%;
        padding: 1.75rem;
        background: var(--color-bg-secondary);
        border: 1px solid var(--color-border);
        border-radius: 12px;
        color: var(--color-text-primary);
        text-align: left;
        cursor: pointer;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      }

      .option-cleaner:hover:not(:disabled) {
        transform: translateY(-2px);
        background: var(--color-bg-tertiary);
        border-color: var(--color-primary);
        box-shadow: 0 12px 24px rgba(0, 0, 0, 0.15);
      }

      .option-cleaner .option-icon {
        background: rgba(var(--color-primary-rgb), 0.1);
        color: var(--color-primary);
      }

      .option-cleaner:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .option-icon {
        width: 48px;
        height: 48px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(255, 255, 255, 0.2);
        border-radius: 10px;
        flex-shrink: 0;
      }

      .option-icon svg {
        width: 24px;
        height: 24px;
      }

      .option-content h3 {
        font-size: 1.25rem;
        font-weight: 700;
        margin: 0 0 0.25rem 0;
      }

      .option-content p {
        font-size: 0.9375rem;
        margin: 0;
        opacity: 0.9;
        line-height: 1.4;
      }

      .manual-section {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.5rem;
      }

      .option-manual {
        background: none;
        border: none;
        color: var(--color-primary);
        font-size: 1rem;
        font-weight: 600;
        padding: 0.5rem 1rem;
        cursor: pointer;
        transition: all 0.2s;
      }

      .option-manual:hover:not(:disabled) {
        text-decoration: underline;
        opacity: 0.8;
      }

      .option-manual:disabled {
        color: var(--color-text-muted);
        cursor: not-allowed;
      }

      .option-manual-desc {
        font-size: 0.8125rem;
        color: var(--color-text-secondary);
        text-align: center;
        margin: 0;
      }
    `,
  ],
})
export class StartComponent {
  protected readonly store = inject(MediaStore);
  protected readonly lang = inject(LanguageService);
  protected readonly settings = inject(SettingsService);
  private readonly router = inject(Router);

  readonly hasApiKeys = computed(() => {
    return !!this.settings.$tmdbApiKey();
  });

  async selectFolder(): Promise<void> {
    await this.store.selectPathOnly();
  }

  async startAnalysis(): Promise<void> {
    const path = this.store.lastScanPath();
    if (path) {
      await this.router.navigate(['/analysis']);
    }
  }

  async startManual(): Promise<void> {
    const path = this.store.lastScanPath();
    if (path) {
      await this.router.navigate(['/library']);
    }
  }

  async startCleaner(): Promise<void> {
    const path = this.store.lastScanPath();
    if (path) {
      await this.router.navigate(['/cleaner']);
    }
  }
}
