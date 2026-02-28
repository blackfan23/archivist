import {
  Component,
  computed,
  inject,
  OnInit,
  output,
  signal,
} from '@angular/core';
import {
  ElectronService,
  RatingProvider,
  Theme,
} from '../../core/electron.service';
import {
  AVAILABLE_LANGUAGES,
  LanguageService,
} from '../../core/language.service';
import { MatchQueueStore } from '../../core/match-queue.store';
import { SettingsService } from '../../core/settings.service';

type ValidationState = 'idle' | 'validating' | 'valid' | 'invalid';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [],
  template: `
    <div class="settings-overlay" (click)="close.emit()"></div>
    <div class="settings-panel">
      <div class="settings-header">
        <h2>{{ lang.translate('settings.title') }}</h2>
        <button class="close-btn" (click)="close.emit()">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div class="settings-content">
        <!-- Appearance Section -->
        <section class="settings-section">
          <h3>{{ lang.translate('settings.appearance') }}</h3>

          <!-- Theme -->
          <div class="setting-row">
            <div class="setting-label">
              <span>{{ lang.translate('settings.theme') }}</span>
            </div>
            <div class="theme-toggle">
              <button
                class="theme-btn"
                [class.active]="settings.$theme() === 'dark'"
                (click)="setTheme('dark')"
              >
                {{ lang.translate('settings.themeDark') }}
              </button>
              <button
                class="theme-btn"
                [class.active]="settings.$theme() === 'light'"
                (click)="setTheme('light')"
              >
                {{ lang.translate('settings.themeLight') }}
              </button>
            </div>
          </div>

          <!-- Language -->
          <div class="setting-row">
            <div class="setting-label">
              <span>{{ lang.translate('settings.language') }}</span>
            </div>
            <select class="setting-select" (change)="onLanguageChange($event)">
              @for (language of languages; track language.code) {
                <option
                  [value]="language.code"
                  [selected]="settings.$language() === language.code"
                >
                  {{ language.name }}
                </option>
              }
            </select>
          </div>
        </section>

        <!-- Behavior Section -->
        <section class="settings-section">
          <h3>{{ lang.translate('settings.behavior') }}</h3>

          <!-- Always delete enclosing folder -->
          <div class="setting-row toggle-row">
            <div class="setting-label">
              <span>{{ lang.translate('settings.alwaysDeleteFolder') }}</span>
              <span class="setting-description">
                {{ lang.translate('settings.alwaysDeleteFolderDesc') }}
              </span>
            </div>
            <label class="toggle">
              <input
                type="checkbox"
                [checked]="settings.$alwaysDeleteEnclosingFolder()"
                (change)="onToggleDeleteFolder($event)"
              />
              <span class="toggle-slider"></span>
            </label>
          </div>

          <!-- Organize series -->
          <div class="setting-row toggle-row">
            <div class="setting-label">
              <span>{{ lang.translate('settings.organizeSeries') }}</span>
              <span class="setting-description">
                {{ lang.translate('settings.organizeSeriesDesc') }}
              </span>
            </div>
            <label class="toggle">
              <input
                type="checkbox"
                [checked]="settings.$organizeSeriesIntoFolders()"
                (change)="onToggleOrganizeSeries($event)"
              />
              <span class="toggle-slider"></span>
            </label>
          </div>

          <!-- Background Engine Control -->
          <div class="setting-row">
            <div class="setting-label">
              <span>{{ lang.translate('settings.backgroundEngine') }}</span>
              <span class="setting-description">
                {{ lang.translate('settings.backgroundEngineDesc') }}
              </span>
            </div>
            <div class="connection-actions">
              @if (isEngineActive()) {
                <span class="status-text valid"
                  >✓ {{ lang.translate('queue.running') }}</span
                >
                <button class="test-btn" (click)="pauseEngine()">
                  {{ lang.translate('queue.pauseEngine') }}
                </button>
              } @else {
                <span class="status-text warning"
                  >⚠ {{ lang.translate('queue.paused') }}</span
                >
                <button class="test-btn" (click)="resumeEngine()">
                  {{ lang.translate('queue.resumeEngine') }}
                </button>
              }
            </div>
          </div>
        </section>

        <!-- AI Section -->
        <section class="settings-section">
          <h3>{{ lang.translate('settings.aiConfig') }}</h3>

          <!-- AI Provider -->
          <div class="setting-row">
            <div class="setting-label">
              <span>{{ lang.translate('settings.provider') }}</span>
              <span class="setting-description">
                {{ lang.translate('settings.providerDesc') }}</span
              >
            </div>
            <select
              class="setting-select"
              (change)="onAiProviderChange($event)"
            >
              <option
                value="none"
                [selected]="settings.$aiProvider() === 'none'"
              >
                {{ lang.translate('settings.providerNone') }}
              </option>
              <option
                value="ollama"
                [selected]="settings.$aiProvider() === 'ollama'"
              >
                {{ lang.translate('settings.providerOllama') }}
              </option>
              <option
                value="openai"
                [selected]="settings.$aiProvider() === 'openai'"
              >
                {{ lang.translate('settings.providerOpenai') }}
              </option>
              <option
                value="claude"
                [selected]="settings.$aiProvider() === 'claude'"
              >
                {{ lang.translate('settings.providerClaude') }}
              </option>
              <option
                value="gemini"
                [selected]="settings.$aiProvider() === 'gemini'"
              >
                {{ lang.translate('settings.providerGemini') }}
              </option>
            </select>
          </div>

          @if (settings.$aiProvider() === 'ollama') {
            <!-- Ollama URL -->
            <div class="setting-row">
              <div class="setting-label">
                <span>{{ lang.translate('settings.ollamaUrl') }}</span>
              </div>
              <input
                class="setting-input"
                type="text"
                [value]="settings.$ollamaUrl()"
                (change)="onOllamaUrlChange($event)"
                placeholder="http://localhost:11434"
              />
            </div>

            <!-- Ollama Model -->
            <div class="setting-row">
              <div class="setting-label">
                <span>{{ lang.translate('settings.model') }}</span>
              </div>
              @if (ollamaModels().length > 0) {
                <select
                  class="setting-select"
                  (change)="onOllamaModelChange($event)"
                >
                  @for (model of ollamaModels(); track model) {
                    <option
                      [value]="model"
                      [selected]="settings.$ollamaModel() === model"
                    >
                      {{ model }}
                    </option>
                  }
                </select>
              } @else {
                <div class="loading-models">
                  {{ lang.translate('settings.loadingModels') }}
                </div>
              }
            </div>

            <!-- Recommended Model -->
            <div class="recommendation-box">
              <div class="rec-info">
                <div class="rec-header">
                  <i class="ph ph-sparkle"></i>
                  <strong>{{
                    lang.translate('settings.recommendedModel')
                  }}</strong>
                </div>
                <p>{{ lang.translate('settings.recommendedModelDesc') }}</p>
              </div>
              @if (!isRecommendedModelInstalled()) {
                <button
                  class="test-btn"
                  [disabled]="installingModel()"
                  (click)="onInstallRecommendedModel()"
                >
                  @if (installingModel()) {
                    <i class="ph ph-spinner ph-spin"></i>
                    {{ lang.translate('settings.installing') }}
                  } @else {
                    <i class="ph ph-download-simple"></i>
                    {{ lang.translate('settings.installModel') }}
                  }
                </button>
              } @else {
                <div class="installed-badge">
                  <i class="ph ph-check-circle"></i>
                  {{ lang.translate('settings.installSuccess') }}
                </div>
              }
            </div>
          }

          @if (settings.$aiProvider() === 'openai') {
            <!-- OpenAI Key -->
            <div class="setting-row">
              <div class="setting-label">
                <span>{{ lang.translate('settings.apiKey') }}</span>
              </div>
              <input
                class="setting-input"
                type="password"
                [value]="settings.$openaiApiKey()"
                (input)="onOpenAiKeyInput($event)"
                placeholder="sk-..."
              />
            </div>
            <!-- OpenAI Model -->
            <div class="setting-row">
              <div class="setting-label">
                <span>{{ lang.translate('settings.model') }}</span>
              </div>
              <input
                class="setting-input"
                type="text"
                [value]="settings.$openaiModel()"
                (change)="onOpenAiModelChange($event)"
                placeholder="gpt-4-turbo"
              />
            </div>
          }

          @if (settings.$aiProvider() === 'claude') {
            <!-- Claude Key -->
            <div class="setting-row">
              <div class="setting-label">
                <span>{{ lang.translate('settings.apiKey') }}</span>
              </div>
              <input
                class="setting-input"
                type="password"
                [value]="settings.$claudeApiKey()"
                (input)="onClaudeKeyInput($event)"
                placeholder="sk-ant-..."
              />
            </div>
            <!-- Claude Model -->
            <div class="setting-row">
              <div class="setting-label">
                <span>{{ lang.translate('settings.model') }}</span>
              </div>
              <input
                class="setting-input"
                type="text"
                [value]="settings.$claudeModel()"
                (change)="onClaudeModelChange($event)"
                placeholder="claude-3-opus-..."
              />
            </div>
          }

          @if (settings.$aiProvider() === 'gemini') {
            <!-- Gemini Key -->
            <div class="setting-row">
              <div class="setting-label">
                <span>{{ lang.translate('settings.apiKey') }}</span>
              </div>
              <input
                class="setting-input"
                type="password"
                [value]="settings.$geminiApiKey()"
                (input)="onGeminiKeyInput($event)"
                placeholder="AIza..."
              />
            </div>
            <!-- Gemini Model -->
            <div class="setting-row">
              <div class="setting-label">
                <span>{{ lang.translate('settings.model') }}</span>
              </div>
              <input
                class="setting-input"
                type="text"
                [value]="settings.$geminiModel()"
                (change)="onGeminiModelChange($event)"
                placeholder="gemini-1.5-pro"
              />
            </div>
          }

          <!-- Connection Test -->
          @if (settings.$aiProvider() !== 'none') {
            <div class="setting-row">
              <div class="setting-label">
                <span>{{ lang.translate('settings.connectionStatus') }}</span>
              </div>
              <div class="connection-actions">
                <button
                  class="test-btn"
                  (click)="testConnection()"
                  [disabled]="connectionState() === 'validating'"
                >
                  @if (connectionState() === 'validating') {
                    {{ lang.translate('settings.testing') }}
                  } @else {
                    {{ lang.translate('settings.testConnection') }}
                  }
                </button>
                @if (connectionState() === 'valid') {
                  <span class="status-text valid"
                    >✓ {{ lang.translate('settings.connected') }}</span
                  >
                }
                @if (connectionState() === 'invalid') {
                  <span class="status-text invalid"
                    >✗ {{ lang.translate('settings.failed') }}</span
                  >
                }
              </div>
            </div>
            @if (connectionError()) {
              <div class="key-error">{{ connectionError() }}</div>
            }
          }
        </section>

        <!-- Integrations Section -->
        <section class="settings-section">
          <div class="section-header-row">
            <h3>{{ lang.translate('settings.integrations') }}</h3>
            <button
              class="test-btn mini"
              (click)="validateAll()"
              [disabled]="
                tmdbKeyState() === 'validating' ||
                omdbKeyState() === 'validating'
              "
            >
              {{ lang.translate('settings.validateAll') }}
            </button>
          </div>

          <!-- Rating Provider -->
          <div class="setting-row">
            <div class="setting-label">
              <span>{{ lang.translate('settings.ratingProvider') }}</span>
              <span class="setting-description">
                {{ lang.translate('settings.ratingProviderDesc') }}
              </span>
            </div>
            <div class="theme-toggle">
              <button
                class="theme-btn"
                [class.active]="settings.$ratingProvider() === 'omdb'"
                (click)="setRatingProvider('omdb')"
              >
                OMDB
              </button>
              <button
                class="theme-btn"
                [class.active]="settings.$ratingProvider() === 'tmdb'"
                (click)="setRatingProvider('tmdb')"
              >
                TMDB
              </button>
            </div>
          </div>

          <!-- OMDB API Key -->
          @if (settings.$ratingProvider() === 'omdb') {
            <div class="setting-row key-row">
              <div class="setting-label">
                <span>{{ lang.translate('settings.omdbApiKey') }}</span>
                <span class="setting-description">
                  {{ lang.translate('settings.getKeyFrom') }}
                  <a
                    href="https://www.omdbapi.com/apikey.aspx"
                    target="_blank"
                    class="setting-link"
                    >omdbapi.com</a
                  >
                </span>
              </div>
              <div class="key-input-wrapper">
                <input
                  class="setting-input"
                  [class.valid]="omdbKeyState() === 'valid'"
                  [class.invalid]="omdbKeyState() === 'invalid'"
                  type="password"
                  [value]="settings.$omdbApiKey()"
                  (input)="onOmdbKeyInput($event)"
                  [placeholder]="lang.translate('settings.enterApiKey')"
                />
                @if (omdbKeyState() === 'validating') {
                  <span class="key-status validating">
                    <span class="spinner"></span>
                  </span>
                }
                @if (omdbKeyState() === 'valid') {
                  <span class="key-status valid">✓</span>
                }
                @if (omdbKeyState() === 'invalid') {
                  <span class="key-status invalid">✗</span>
                }
              </div>
            </div>
            @if (omdbKeyState() === 'invalid' && omdbKeyError()) {
              <div class="key-error">{{ omdbKeyError() }}</div>
            }
          }

          <!-- TMDB API Key -->
          @if (settings.$ratingProvider() === 'tmdb') {
            <div class="setting-row key-row">
              <div class="setting-label">
                <span>{{ lang.translate('settings.tmdbApiKey') }}</span>
                <span class="setting-description">
                  {{ lang.translate('settings.getKeyFrom') }}
                  <a
                    href="https://www.themoviedb.org/settings/api"
                    target="_blank"
                    class="setting-link"
                    >themoviedb.org</a
                  >
                </span>
              </div>
              <div class="key-input-wrapper">
                <input
                  class="setting-input"
                  [class.valid]="tmdbKeyState() === 'valid'"
                  [class.invalid]="tmdbKeyState() === 'invalid'"
                  type="password"
                  [value]="settings.$tmdbApiKey()"
                  (input)="onTmdbKeyInput($event)"
                  [placeholder]="lang.translate('settings.enterApiKey')"
                />
                @if (tmdbKeyState() === 'validating') {
                  <span class="key-status validating">
                    <span class="spinner"></span>
                  </span>
                }
                @if (tmdbKeyState() === 'valid') {
                  <span class="key-status valid">✓</span>
                }
                @if (tmdbKeyState() === 'invalid') {
                  <span class="key-status invalid">✗</span>
                }
              </div>
            </div>
            @if (tmdbKeyState() === 'invalid' && tmdbKeyError()) {
              <div class="key-error">{{ tmdbKeyError() }}</div>
            }
          }

          <!-- VLC Path -->
          <div class="setting-row">
            <div class="setting-label">
              <span>{{ lang.translate('settings.vlcPath') }}</span>
              <span class="setting-description">
                {{ lang.translate('settings.vlcPathDesc') }}
              </span>
            </div>
            <input
              class="setting-input"
              type="text"
              [value]="settings.$vlcPath()"
              (change)="onVlcPathChange($event)"
              [placeholder]="lang.translate('settings.vlcPath')"
            />
          </div>
        </section>

        <!-- Maintenance Section -->
        <section class="settings-section">
          <h3>{{ lang.translate('settings.maintenance') }}</h3>

          <!-- Full Reset -->
          <div class="setting-row">
            <div class="setting-label">
              <span>{{ lang.translate('settings.fullReset') }}</span>
              <span class="setting-description">
                {{ lang.translate('settings.fullResetDesc') }}
              </span>
            </div>
            <button class="reset-btn" (click)="onFullReset()">
              {{ lang.translate('settings.reset') }}
            </button>
          </div>

          <!-- Reset AI results -->
          <div class="setting-row">
            <div class="setting-label">
              <span>{{ lang.translate('settings.resetAICache') }}</span>
              <span class="setting-description">
                {{ lang.translate('settings.resetAICacheDesc') }}
              </span>
            </div>
            <button class="reset-btn secondary" (click)="onResetAICache()">
              {{ lang.translate('settings.reset') }}
            </button>
          </div>
        </section>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: contents;
      }

      .settings-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.5);
        z-index: 100;
        animation: fadeIn 0.15s ease;
      }

      .settings-panel {
        position: fixed;
        top: 0;
        right: 0;
        bottom: 0;
        width: 400px;
        max-width: 100%;
        background: var(--color-bg-secondary);
        border-left: 1px solid var(--color-border);
        z-index: 101;
        display: flex;
        flex-direction: column;
        animation: slideIn 0.2s ease;
      }

      @keyframes fadeIn {
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
        }
      }

      @keyframes slideIn {
        from {
          transform: translateX(100%);
        }
        to {
          transform: translateX(0);
        }
      }

      .settings-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 1rem 1.5rem;
        border-bottom: 1px solid var(--color-border);
      }

      .settings-header h2 {
        font-size: 1.125rem;
        font-weight: 600;
        margin: 0;
      }

      .close-btn {
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: transparent;
        border: none;
        border-radius: 6px;
        color: var(--color-text-secondary);
        cursor: pointer;
        transition: all 0.15s ease;
      }

      .close-btn:hover {
        background: var(--color-bg-tertiary);
        color: var(--color-text-primary);
      }

      .close-btn svg {
        width: 18px;
        height: 18px;
      }

      .settings-content {
        flex: 1;
        overflow-y: auto;
        padding: 1.5rem;
      }

      .settings-section {
        margin-bottom: 2rem;
      }

      .settings-section:last-child {
        margin-bottom: 0;
      }

      .settings-section h3 {
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--color-text-muted);
        margin: 0 0 1rem 0;
      }

      .section-header-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 1rem;
      }

      .section-header-row h3 {
        margin-bottom: 0 !important;
      }

      .test-btn.mini {
        padding: 0.25rem 0.5rem;
        font-size: 0.75rem;
      }

      .setting-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.75rem 0;
        border-bottom: 1px solid var(--color-border);
      }

      .setting-row:last-child {
        border-bottom: none;
      }

      .toggle-row {
        align-items: flex-start;
      }

      .key-row {
        flex-wrap: wrap;
      }

      .setting-label {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        flex: 1;
        margin-right: 1rem;
      }

      .setting-label > span:first-child {
        font-weight: 500;
      }

      .setting-description {
        font-size: 0.8125rem;
        color: var(--color-text-secondary);
        line-height: 1.4;
      }

      .setting-link {
        color: var(--color-primary);
        text-decoration: none;
        transition: opacity 0.15s ease;
      }

      .setting-link:hover {
        opacity: 0.8;
        text-decoration: underline;
      }

      .theme-toggle {
        display: flex;
        background: var(--color-bg-tertiary);
        border-radius: 6px;
        padding: 2px;
      }

      .theme-btn {
        padding: 0.5rem 1rem;
        background: transparent;
        border: none;
        border-radius: 4px;
        color: var(--color-text-secondary);
        font-size: 0.875rem;
        cursor: pointer;
        transition: all 0.15s ease;
      }

      .theme-btn.active {
        background: var(--color-primary);
        color: white;
      }

      .theme-btn:not(.active):hover {
        color: var(--color-text-primary);
      }

      .setting-select {
        padding: 0.5rem 2rem 0.5rem 0.75rem;
        background: var(--color-bg-tertiary);
        border: 1px solid var(--color-border);
        border-radius: 6px;
        color: var(--color-text-primary);
        font-size: 0.875rem;
        cursor: pointer;
        appearance: none;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23737373' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
        background-repeat: no-repeat;
        background-position: right 0.5rem center;
      }

      .setting-select:hover {
        border-color: var(--color-primary);
      }

      .setting-select:focus {
        outline: none;
        border-color: var(--color-primary);
      }

      .key-input-wrapper {
        position: relative;
        display: flex;
        align-items: center;
      }

      .setting-input {
        padding: 0.5rem 2rem 0.5rem 0.75rem;
        background: var(--color-bg-tertiary);
        border: 1px solid var(--color-border);
        border-radius: 6px;
        color: var(--color-text-primary);
        font-size: 0.875rem;
        width: 200px;
        transition: border-color 0.15s ease;
      }

      .setting-input:focus {
        outline: none;
        border-color: var(--color-primary);
      }

      .setting-input.valid {
        border-color: #22c55e;
      }

      .setting-input.invalid {
        border-color: #ef4444;
      }

      .connection-actions {
        display: flex;
        align-items: center;
        gap: 1rem;
      }

      .key-status {
        position: absolute;
        right: 0.5rem;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .status-text {
        font-weight: 600;
        font-size: 0.875rem;
      }

      .status-text.valid,
      .key-status.valid {
        color: #22c55e;
      }

      .status-text.invalid,
      .key-status.invalid {
        color: #ef4444;
      }

      .key-status .spinner {
        width: 14px;
        height: 14px;
        border: 2px solid var(--color-border);
        border-top-color: var(--color-primary);
        border-radius: 50%;
        animation: spin 0.7s linear infinite;
      }

      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }

      .key-error {
        width: 100%;
        font-size: 0.75rem;
        color: #ef4444;
        margin-top: 0.25rem;
        padding-left: 0;
      }

      /* Toggle Switch */
      .toggle {
        position: relative;
        width: 44px;
        height: 24px;
        flex-shrink: 0;
      }

      .toggle input {
        opacity: 0;
        width: 0;
        height: 0;
      }

      .toggle-slider {
        position: absolute;
        cursor: pointer;
        inset: 0;
        background: var(--color-bg-tertiary);
        border-radius: 24px;
        transition: all 0.2s ease;
      }

      .toggle-slider::before {
        content: '';
        position: absolute;
        height: 18px;
        width: 18px;
        left: 3px;
        bottom: 3px;
        background: white;
        border-radius: 50%;
        transition: all 0.2s ease;
      }

      .toggle input:checked + .toggle-slider {
        background: var(--color-primary);
      }

      .toggle input:checked + .toggle-slider::before {
        transform: translateX(20px);
      }

      .toggle input:focus-visible + .toggle-slider {
        box-shadow: 0 0 0 2px var(--color-primary);
      }

      .test-btn {
        padding: 0.5rem 1rem;
        background: var(--color-bg-tertiary);
        border: 1px solid var(--color-border);
        border-radius: 6px;
        color: var(--color-text-primary);
        cursor: pointer;
        transition: all 0.15s ease;
        font-size: 0.875rem;
      }

      .test-btn:hover:not(:disabled) {
        background: var(--color-bg-secondary);
        border-color: var(--color-primary);
      }

      .test-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .loading-models {
        font-style: italic;
        color: var(--color-text-secondary);
        font-size: 0.875rem;
      }

      .reset-btn {
        padding: 0.5rem 1rem;
        background: transparent;
        border: 1px solid #ef4444;
        border-radius: 6px;
        color: #ef4444;
        cursor: pointer;
        transition: all 0.15s ease;
        font-size: 0.875rem;
        font-weight: 500;
      }

      .reset-btn:hover {
        background: #ef4444;
        color: white;
      }

      .reset-btn.secondary {
        border-color: var(--color-text-muted);
        color: var(--color-text-muted);
      }

      .reset-btn.secondary:hover {
        background: var(--color-text-muted);
        color: var(--color-bg-secondary);
      }

      .recommendation-box {
        margin-top: 1rem;
        padding: 1rem;
        background: var(--color-bg-tertiary);
        border: 1px solid var(--color-border);
        border-radius: 8px;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }

      .rec-header {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        color: var(--color-primary);
      }

      .rec-info p {
        margin: 0.25rem 0 0;
        font-size: 0.8125rem;
        color: var(--color-text-secondary);
        line-height: 1.4;
      }

      .installed-badge {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        color: #10b981;
        font-size: 0.875rem;
        font-weight: 500;
      }
    `,
  ],
})
export class SettingsComponent implements OnInit {
  protected readonly settings = inject(SettingsService);
  protected readonly lang = inject(LanguageService);
  private readonly electron = inject(ElectronService);
  private readonly queueStore = inject(MatchQueueStore);

  readonly close = output<void>();
  readonly languages = AVAILABLE_LANGUAGES;

  readonly isEngineActive = this.queueStore.isEngineActive;

  // Validation state
  readonly omdbKeyState = signal<ValidationState>('idle');
  readonly omdbKeyError = signal<string>('');
  readonly tmdbKeyState = signal<ValidationState>('idle');
  readonly tmdbKeyError = signal<string>('');

  // AI State
  readonly ollamaModels = signal<string[]>([]);
  readonly connectionState = signal<ValidationState>('idle');
  readonly connectionError = signal<string>('');

  // Recommended Model Installation
  readonly RECOMMENDED_MODEL = 'qwen3-coder:32b';
  readonly installingModel = signal<boolean>(false);
  readonly isRecommendedModelInstalled = computed(() =>
    this.ollamaModels().some((m) => m.startsWith('qwen3-coder')),
  );

  private omdbDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private tmdbDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    if (this.settings.$aiProvider() === 'ollama') {
      this.loadOllamaModels();
    }
    // Initial validation of keys if present
    if (this.settings.$tmdbApiKey() || this.settings.$omdbApiKey()) {
      this.validateAll();
    }
  }

  setTheme(theme: Theme): void {
    this.settings.setTheme(theme);
  }

  onLanguageChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.settings.setLanguage(select.value);
  }

  onToggleDeleteFolder(event: Event): void {
    const checkbox = event.target as HTMLInputElement;
    this.settings.setAlwaysDeleteEnclosingFolder(checkbox.checked);
  }

  onToggleOrganizeSeries(event: Event): void {
    const checkbox = event.target as HTMLInputElement;
    this.settings.setOrganizeSeriesIntoFolders(checkbox.checked);
  }

  onOmdbKeyInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const key = input.value.trim();

    // Clear previous timer
    if (this.omdbDebounceTimer) {
      clearTimeout(this.omdbDebounceTimer);
    }

    // Save immediately
    this.settings.setOmdbApiKey(key);

    if (!key) {
      this.omdbKeyState.set('idle');
      this.omdbKeyError.set('');
      return;
    }

    // Debounce validation
    this.omdbDebounceTimer = setTimeout(() => {
      this.validateOmdbKey(key);
    }, 500);
  }

  onTmdbKeyInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const key = input.value.trim();

    // Clear previous timer
    if (this.tmdbDebounceTimer) {
      clearTimeout(this.tmdbDebounceTimer);
    }

    // Save immediately
    this.settings.setTmdbApiKey(key);

    if (!key) {
      this.tmdbKeyState.set('idle');
      this.tmdbKeyError.set('');
      return;
    }

    // Debounce validation
    this.tmdbDebounceTimer = setTimeout(() => {
      this.validateTmdbKey(key);
    }, 500);
  }

  async validateAll(): Promise<void> {
    this.tmdbKeyState.set('validating');
    this.omdbKeyState.set('validating');
    this.tmdbKeyError.set('');
    this.omdbKeyError.set('');

    try {
      const result = await this.electron.validateKeys();

      this.tmdbKeyState.set(result.tmdb.valid ? 'valid' : 'invalid');
      if (!result.tmdb.valid) {
        this.tmdbKeyError.set(
          result.tmdb.error || this.lang.translate('settings.invalidApiKey'),
        );
      }

      this.omdbKeyState.set(result.omdb.valid ? 'valid' : 'invalid');
      if (!result.omdb.valid) {
        this.omdbKeyError.set(
          result.omdb.error || this.lang.translate('settings.invalidApiKey'),
        );
      }
    } catch (e) {
      console.error('Unified validation failed', e);
      this.tmdbKeyState.set('invalid');
      this.omdbKeyState.set('invalid');
    }
  }

  private async validateOmdbKey(key: string): Promise<void> {
    this.omdbKeyState.set('validating');
    this.omdbKeyError.set('');

    const result = await this.electron.validateOmdbKey(key);

    if (result.valid) {
      this.omdbKeyState.set('valid');
    } else {
      this.omdbKeyState.set('invalid');
      this.omdbKeyError.set(
        result.error || this.lang.translate('settings.invalidApiKey'),
      );
    }
  }

  private async validateTmdbKey(key: string): Promise<void> {
    this.tmdbKeyState.set('validating');
    this.tmdbKeyError.set('');

    const result = await this.electron.validateTmdbKey(key);

    if (result.valid) {
      this.tmdbKeyState.set('valid');
    } else {
      this.tmdbKeyState.set('invalid');
      this.tmdbKeyError.set(
        result.error || this.lang.translate('settings.invalidApiKey'),
      );
    }
  }

  setRatingProvider(provider: RatingProvider): void {
    this.settings.setRatingProvider(provider);
  }

  onVlcPathChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.settings.setVlcPath(input.value.trim());
  }

  // AI Methods
  async onAiProviderChange(event: Event): Promise<void> {
    const select = event.target as HTMLSelectElement;
    await this.settings.setAiProvider(select.value as any);
    if (select.value === 'ollama') {
      this.loadOllamaModels();
    }
  }

  async onOllamaUrlChange(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    await this.settings.setOllamaUrl(input.value);
    this.loadOllamaModels();
  }

  async onOllamaModelChange(event: Event): Promise<void> {
    const select = event.target as HTMLSelectElement;
    console.log('[SettingsComponent] onOllamaModelChange:', select.value);
    await this.settings.setOllamaModel(select.value);
    console.log(
      '[SettingsComponent] Model updated in service. Current signal value:',
      this.settings.$ollamaModel(),
    );
  }

  async loadOllamaModels(): Promise<void> {
    this.ollamaModels.set([]);
    const models = await this.settings.getOllamaModels();
    this.ollamaModels.set(models);
  }

  async onInstallRecommendedModel(): Promise<void> {
    this.installingModel.set(true);
    try {
      await this.electron.aiPullOllamaModel(
        this.settings.$ollamaUrl(),
        this.RECOMMENDED_MODEL,
      );
      await this.loadOllamaModels();

      // Auto-select it
      await this.settings.setOllamaModel(this.RECOMMENDED_MODEL);

      alert(this.lang.translate('settings.installSuccess'));
    } catch (error) {
      console.error('Failed to install model:', error);
      alert(this.lang.translate('settings.installError'));
    } finally {
      this.installingModel.set(false);
    }
  }

  async onOpenAiKeyInput(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    await this.settings.setOpenAiApiKey(input.value);
  }

  async onOpenAiModelChange(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    await this.settings.setOpenAiModel(input.value);
  }

  async onClaudeKeyInput(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    await this.settings.setClaudeApiKey(input.value);
  }

  async onClaudeModelChange(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    await this.settings.setClaudeModel(input.value);
  }

  async onGeminiKeyInput(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    await this.settings.setGeminiApiKey(input.value);
  }

  async onGeminiModelChange(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    await this.settings.setGeminiModel(input.value);
  }

  async testConnection(): Promise<void> {
    this.connectionState.set('validating');
    this.connectionError.set('');

    // Create temp settings object
    const settings = {
      provider: this.settings.$aiProvider(),
      ollamaUrl: this.settings.$ollamaUrl(),
      ollamaModel: this.settings.$ollamaModel(),
      openaiApiKey: this.settings.$openaiApiKey(),
      openaiModel: this.settings.$openaiModel(),
      claudeApiKey: this.settings.$claudeApiKey(),
      claudeModel: this.settings.$claudeModel(),
      geminiApiKey: this.settings.$geminiApiKey(),
      geminiModel: this.settings.$geminiModel(),
    };

    console.log(
      '[SettingsComponent] Testing connection with settings:',
      settings,
    );
    const result = await this.electron.aiTestConnection(settings);

    if (result.success) {
      this.connectionState.set('valid');
    } else {
      console.error('[SettingsComponent] Connection failed:', result.error);
      this.connectionState.set('invalid');
      this.connectionError.set(
        result.error || this.lang.translate('settings.connectionFailed'),
      );
    }
  }

  async onFullReset(): Promise<void> {
    const confirmed = confirm(this.lang.translate('confirm.fullReset'));
    if (!confirmed) return;

    try {
      await this.electron.fullReset();
      alert(this.lang.translate('notify.fullResetSuccess'));
      window.location.reload();
    } catch (error) {
      console.error('[SettingsComponent] Error during full reset:', error);
    }
  }

  async onResetAICache(): Promise<void> {
    const confirmed = confirm(this.lang.translate('confirm.resetAICache'));
    if (!confirmed) return;

    try {
      const count = await this.electron.resetAICache();
      alert(
        this.lang
          .translate('notify.resetAICacheSuccess')
          .replace('{count}', count.toString()),
      );
    } catch (error) {
      console.error('[SettingsComponent] Error resetting AI cache:', error);
    }
  }

  async pauseEngine(): Promise<void> {
    await this.queueStore.pauseEngine();
  }

  async resumeEngine(): Promise<void> {
    await this.queueStore.resumeEngine();
  }
}
