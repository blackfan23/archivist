import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { AppSettings, DEFAULT_SETTINGS, ElectronService, RatingProvider, Theme } from './electron.service';

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly electron = inject(ElectronService);
  
  // Core settings state
  private readonly _settings = signal<AppSettings>(DEFAULT_SETTINGS);
  
  // Exposed readonly signals
  readonly settings = this._settings.asReadonly();
  
  readonly $theme = computed(() => this._settings().theme);
  readonly $language = computed(() => this._settings().language);
  readonly $alwaysDeleteEnclosingFolder = computed(() => 
    this._settings().alwaysDeleteEnclosingFolder === true
  );
  readonly $omdbApiKey = computed(() => this._settings().omdbApiKey || '');
  readonly $tmdbApiKey = computed(() => this._settings().tmdbApiKey || '');
  readonly $ratingProvider = computed(() => this._settings().ratingProvider || 'omdb');
  
  constructor() {
    // Apply theme changes to document
    effect(() => {
      const theme = this.$theme();
      if (theme === 'light') {
        document.documentElement.classList.add('light-theme');
      } else {
        document.documentElement.classList.remove('light-theme');
      }
    });
  }
  
  async loadSettings(): Promise<void> {
    const settings = await this.electron.getSettings();
    this._settings.set(settings);
  }
  
  async setTheme(theme: Theme): Promise<void> {
    const updated = { ...this._settings(), theme };
    this._settings.set(updated);
    await this.electron.saveSettings(updated);
  }
  
  async setLanguage(language: string): Promise<void> {
    const updated = { ...this._settings(), language };
    this._settings.set(updated);
    await this.electron.saveSettings(updated);
  }
  
  async setAlwaysDeleteEnclosingFolder(value: boolean): Promise<void> {
    const updated: AppSettings = { 
      ...this._settings(), 
      alwaysDeleteEnclosingFolder: value ? true : undefined 
    };
    this._settings.set(updated);
    await this.electron.saveSettings(updated);
  }
  
  async toggleTheme(): Promise<void> {
    const newTheme: Theme = this.$theme() === 'dark' ? 'light' : 'dark';
    await this.setTheme(newTheme);
  }

  async setOmdbApiKey(key: string): Promise<void> {
    const updated = { ...this._settings(), omdbApiKey: key };
    this._settings.set(updated);
    await this.electron.saveSettings(updated);
  }

  async setTmdbApiKey(key: string): Promise<void> {
    const updated = { ...this._settings(), tmdbApiKey: key };
    this._settings.set(updated);
    await this.electron.saveSettings(updated);
  }

  async setRatingProvider(provider: RatingProvider): Promise<void> {
    const updated = { ...this._settings(), ratingProvider: provider };
    this._settings.set(updated);
    await this.electron.saveSettings(updated);
  }
}
