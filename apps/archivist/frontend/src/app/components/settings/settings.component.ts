import { Component, inject, output, signal } from '@angular/core';
import { ElectronService, RatingProvider, Theme } from '../../core/electron.service';
import { AVAILABLE_LANGUAGES, LanguageService } from '../../core/language.service';
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
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
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
                (click)="setTheme('dark')">
                {{ lang.translate('settings.themeDark') }}
              </button>
              <button 
                class="theme-btn"
                [class.active]="settings.$theme() === 'light'"
                (click)="setTheme('light')">
                {{ lang.translate('settings.themeLight') }}
              </button>
            </div>
          </div>
          
          <!-- Language -->
          <div class="setting-row">
            <div class="setting-label">
              <span>{{ lang.translate('settings.language') }}</span>
            </div>
            <select 
              class="setting-select"
              (change)="onLanguageChange($event)">
              @for (language of languages; track language.code) {
                <option [value]="language.code" [selected]="settings.$language() === language.code">{{ language.name }}</option>
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
        </section>

        <!-- Integrations Section -->
        <section class="settings-section">
          <h3>{{ lang.translate('settings.integrations') }}</h3>
          
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
                (click)="setRatingProvider('omdb')">
                OMDB
              </button>
              <button 
                class="theme-btn"
                [class.active]="settings.$ratingProvider() === 'tmdb'"
                (click)="setRatingProvider('tmdb')">
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
                  {{ lang.translate('settings.getKeyFrom') }} <a href="https://www.omdbapi.com/apikey.aspx" target="_blank" class="setting-link">omdbapi.com</a>
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
                  {{ lang.translate('settings.getKeyFrom') }} <a href="https://www.themoviedb.org/settings/api" target="_blank" class="setting-link">themoviedb.org</a>
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
        </section>
      </div>
    </div>
  `,
  styles: [`
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
      background: var(--bg-secondary);
      border-left: 1px solid var(--border-color);
      z-index: 101;
      display: flex;
      flex-direction: column;
      animation: slideIn 0.2s ease;
    }
    
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    
    @keyframes slideIn {
      from { transform: translateX(100%); }
      to { transform: translateX(0); }
    }
    
    .settings-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1rem 1.5rem;
      border-bottom: 1px solid var(--border-color);
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
      color: var(--text-secondary);
      cursor: pointer;
      transition: all 0.15s ease;
    }
    
    .close-btn:hover {
      background: var(--bg-hover);
      color: var(--text-primary);
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
      color: var(--text-tertiary);
      margin: 0 0 1rem 0;
    }
    
    .setting-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.75rem 0;
      border-bottom: 1px solid var(--border-color);
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
      color: var(--text-secondary);
      line-height: 1.4;
    }

    .setting-link {
      color: var(--accent-color);
      text-decoration: none;
      transition: opacity 0.15s ease;
    }

    .setting-link:hover {
      opacity: 0.8;
      text-decoration: underline;
    }
    
    .theme-toggle {
      display: flex;
      background: var(--bg-tertiary);
      border-radius: 6px;
      padding: 2px;
    }
    
    .theme-btn {
      padding: 0.5rem 1rem;
      background: transparent;
      border: none;
      border-radius: 4px;
      color: var(--text-secondary);
      font-size: 0.875rem;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    
    .theme-btn.active {
      background: var(--accent-color);
      color: white;
    }
    
    .theme-btn:not(.active):hover {
      color: var(--text-primary);
    }
    
    .setting-select {
      padding: 0.5rem 2rem 0.5rem 0.75rem;
      background: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      color: var(--text-primary);
      font-size: 0.875rem;
      cursor: pointer;
      appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23737373' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 0.5rem center;
    }
    
    .setting-select:hover {
      border-color: var(--accent-color);
    }
    
    .setting-select:focus {
      outline: none;
      border-color: var(--accent-color);
    }

    .key-input-wrapper {
      position: relative;
      display: flex;
      align-items: center;
    }

    .setting-input {
      padding: 0.5rem 2rem 0.5rem 0.75rem;
      background: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      color: var(--text-primary);
      font-size: 0.875rem;
      width: 200px;
      transition: border-color 0.15s ease;
    }
    
    .setting-input:focus {
      outline: none;
      border-color: var(--accent-color);
    }

    .setting-input.valid {
      border-color: #22c55e;
    }

    .setting-input.invalid {
      border-color: #ef4444;
    }

    .key-status {
      position: absolute;
      right: 0.5rem;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .key-status.valid {
      color: #22c55e;
      font-weight: 600;
    }

    .key-status.invalid {
      color: #ef4444;
      font-weight: 600;
    }

    .key-status .spinner {
      width: 14px;
      height: 14px;
      border: 2px solid var(--border-color);
      border-top-color: var(--accent-color);
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
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
      background: var(--bg-tertiary);
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
      background: var(--accent-color);
    }
    
    .toggle input:checked + .toggle-slider::before {
      transform: translateX(20px);
    }
    
    .toggle input:focus-visible + .toggle-slider {
      box-shadow: 0 0 0 2px var(--accent-color);
    }
  `],
})
export class SettingsComponent {
  protected readonly settings = inject(SettingsService);
  protected readonly lang = inject(LanguageService);
  private readonly electron = inject(ElectronService);
  
  readonly close = output<void>();
  readonly languages = AVAILABLE_LANGUAGES;
  
  // Validation state
  readonly omdbKeyState = signal<ValidationState>('idle');
  readonly omdbKeyError = signal<string>('');
  readonly tmdbKeyState = signal<ValidationState>('idle');
  readonly tmdbKeyError = signal<string>('');
  
  private omdbDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private tmdbDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  
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

  private async validateOmdbKey(key: string): Promise<void> {
    this.omdbKeyState.set('validating');
    this.omdbKeyError.set('');
    
    const result = await this.electron.validateOmdbKey(key);
    
    if (result.valid) {
      this.omdbKeyState.set('valid');
    } else {
      this.omdbKeyState.set('invalid');
      this.omdbKeyError.set(result.error || 'Invalid API key');
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
      this.tmdbKeyError.set(result.error || 'Invalid API key');
    }
  }

  setRatingProvider(provider: RatingProvider): void {
    this.settings.setRatingProvider(provider);
  }
}

