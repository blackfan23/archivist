import { CommonModule } from '@angular/common';
import { Component, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ElectronService } from '../../core/electron.service';
import { LanguageService } from '../../core/language.service';
import { SettingsService } from '../../core/settings.service';

@Component({
  selector: 'app-api-key-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal-overlay">
      <div class="modal-card">
        <div class="modal-header">
          <h2>
            {{
              lang.translate('settings.apiKeyRequired') ||
                'API Key Setup Required'
            }}
          </h2>
          <p class="subtitle">
            {{
              lang.translate('settings.apiKeyRequiredDesc') ||
                'To use AI matching and metadata features, please provide your API keys. Manual mode remains accessible without them.'
            }}
          </p>
        </div>

        <div class="modal-content">
          <!-- TMDB Key -->
          <div class="field">
            <label>
              {{ lang.translate('settings.tmdbApiKey') }}
              <a
                href="https://www.themoviedb.org/settings/api"
                target="_blank"
                class="link"
              >
                {{ lang.translate('settings.getKeyFrom') }} themoviedb.org
              </a>
            </label>
            <div class="input-wrapper">
              <input
                type="password"
                [(ngModel)]="tmdbKey"
                [placeholder]="lang.translate('settings.enterApiKey')"
                [class.invalid]="tmdbError()"
              />
              @if (isValidating()) {
                <span class="spinner-small"></span>
              }
            </div>
            @if (tmdbError()) {
              <span class="error-text">{{ tmdbError() }}</span>
            }
          </div>

          <!-- OMDB Key -->
          <div class="field">
            <label>
              {{ lang.translate('settings.omdbApiKey') }}
              <a
                href="https://www.omdbapi.com/apikey.aspx"
                target="_blank"
                class="link"
              >
                {{ lang.translate('settings.getKeyFrom') }} omdbapi.com
              </a>
            </label>
            <div class="input-wrapper">
              <input
                type="password"
                [(ngModel)]="omdbKey"
                [placeholder]="lang.translate('settings.enterApiKey')"
                [class.invalid]="omdbError()"
              />
            </div>
            @if (omdbError()) {
              <span class="error-text">{{ omdbError() }}</span>
            }
          </div>
        </div>

        <div class="modal-actions">
          <button class="btn-manual" (click)="onContinueManual()">
            {{
              lang.translate('settings.continueManual') ||
                'Continue to Manual Mode'
            }}
          </button>
          <button
            class="btn-primary"
            [disabled]="isValidating() || !tmdbKey"
            (click)="onSaveAndValidate()"
          >
            @if (isValidating()) {
              {{ lang.translate('settings.validating') }}
            } @else {
              {{
                lang.translate('settings.saveAndValidate') || 'Save & Validate'
              }}
            }
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .modal-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.85);
        backdrop-filter: blur(8px);
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
        animation: fadeIn 0.3s ease;
      }

      .modal-card {
        width: 100%;
        max-width: 480px;
        background: var(--color-bg-secondary);
        border: 1px solid var(--color-border);
        border-radius: 16px;
        padding: 2rem;
        box-shadow: 0 24px 48px rgba(0, 0, 0, 0.5);
        animation: scaleUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      }

      @keyframes fadeIn {
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
        }
      }
      @keyframes scaleUp {
        from {
          transform: scale(0.95);
          opacity: 0;
        }
        to {
          transform: scale(1);
          opacity: 1;
        }
      }

      .modal-header {
        margin-bottom: 2rem;
        text-align: center;
      }

      h2 {
        margin: 0 0 0.5rem;
        font-size: 1.5rem;
        font-weight: 700;
        color: var(--color-text-primary);
      }
      .subtitle {
        margin: 0;
        font-size: 0.9rem;
        color: var(--color-text-secondary);
        line-height: 1.5;
      }

      .modal-content {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
        margin-bottom: 2.5rem;
      }

      .field {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }
      label {
        font-size: 0.85rem;
        font-weight: 600;
        color: var(--color-text-primary);
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .link {
        font-size: 0.75rem;
        color: var(--color-primary);
        text-decoration: none;
        font-weight: 400;
      }
      .link:hover {
        text-decoration: underline;
      }

      .input-wrapper {
        position: relative;
      }
      input {
        width: 100%;
        padding: 0.75rem 1rem;
        background: var(--color-bg-tertiary);
        border: 1px solid var(--color-border);
        border-radius: 8px;
        color: var(--color-text-primary);
        font-size: 0.95rem;
        transition: all 0.2s;
      }
      input:focus {
        outline: none;
        border-color: var(--color-primary);
        box-shadow: 0 0 0 3px rgba(var(--color-primary-rgb), 0.1);
      }
      input.invalid {
        border-color: var(--color-error);
      }

      .error-text {
        font-size: 0.75rem;
        color: var(--color-error);
      }

      .modal-actions {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }

      button {
        padding: 0.875rem;
        border-radius: 10px;
        font-weight: 600;
        font-size: 0.95rem;
        cursor: pointer;
        transition: all 0.2s;
        border: none;
      }

      .btn-primary {
        background: var(--color-primary);
        color: white;
      }
      .btn-primary:hover:not(:disabled) {
        filter: brightness(1.1);
        transform: translateY(-1px);
      }
      .btn-primary:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      .btn-manual {
        background: transparent;
        color: var(--color-text-secondary);
      }
      .btn-manual:hover {
        color: var(--color-text-primary);
        background: var(--color-bg-tertiary);
      }

      .spinner-small {
        position: absolute;
        right: 12px;
        top: 50%;
        transform: translateY(-50%);
        width: 16px;
        height: 16px;
        border: 2px solid rgba(255, 255, 255, 0.1);
        border-top-color: var(--color-primary);
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
      }
      @keyframes spin {
        to {
          transform: translateY(-50%) rotate(360deg);
        }
      }
    `,
  ],
})
export class ApiKeyModalComponent {
  protected readonly electron = inject(ElectronService);
  protected readonly lang = inject(LanguageService);
  protected readonly settings = inject(SettingsService);

  readonly close = output<void>();

  tmdbKey = '';
  omdbKey = '';

  isValidating = signal(false);
  tmdbError = signal<string | null>(null);
  omdbError = signal<string | null>(null);

  constructor() {
    this.tmdbKey = this.settings.$tmdbApiKey() || '';
    this.omdbKey = this.settings.$omdbApiKey() || '';
  }

  async onSaveAndValidate(): Promise<void> {
    this.isValidating.set(true);
    this.tmdbError.set(null);
    this.omdbError.set(null);

    // Save first
    this.settings.updateSettings({
      tmdbApiKey: this.tmdbKey,
      omdbApiKey: this.omdbKey,
    });

    try {
      const result = await this.electron.validateKeys();

      let allValid = true;
      if (this.tmdbKey && !result.tmdb.valid) {
        this.tmdbError.set(result.tmdb.error || 'Invalid key');
        allValid = false;
      }
      if (this.omdbKey && !result.omdb.valid) {
        this.omdbError.set(result.omdb.error || 'Invalid key');
        allValid = false;
      }

      if (allValid && this.tmdbKey && result.tmdb.valid) {
        this.close.emit();
      }
    } catch (e) {
      console.error('Validation failed', e);
    } finally {
      this.isValidating.set(false);
    }
  }

  onContinueManual(): void {
    this.close.emit();
  }
}
