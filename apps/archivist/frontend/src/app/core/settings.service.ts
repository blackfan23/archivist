import { computed, effect, inject, Injectable, signal } from '@angular/core';
import {
  AISettings,
  AppSettings,
  DEFAULT_AI_SETTINGS,
  DEFAULT_SETTINGS,
  ElectronService,
  RatingProvider,
  Theme,
} from './electron.service';

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly electron = inject(ElectronService);

  // Core settings state
  private readonly _settings = signal<AppSettings>(DEFAULT_SETTINGS);
  private readonly _aiSettings = signal<AISettings>(DEFAULT_AI_SETTINGS);

  // Exposed readonly signals
  readonly settings = this._settings.asReadonly();
  readonly aiSettings = this._aiSettings.asReadonly();

  readonly $theme = computed(() => this._settings().theme);
  readonly $language = computed(() => this._settings().language);
  readonly $alwaysDeleteEnclosingFolder = computed(
    () => this._settings().alwaysDeleteEnclosingFolder === true,
  );
  readonly $omdbApiKey = computed(() => this._settings().omdbApiKey || '');
  readonly $tmdbApiKey = computed(() => this._settings().tmdbApiKey || '');
  readonly $ratingProvider = computed(
    () => this._settings().ratingProvider || 'omdb',
  );
  readonly $vlcPath = computed(() => this._settings().vlcPath || '');
  readonly $organizeSeriesIntoFolders = computed(
    () => this._settings().organizeSeriesIntoFolders === true,
  );
  readonly $hideCleanedSeasons = computed(
    () => this._settings().hideCleanedSeasons === true,
  );

  // AI Signals
  readonly $aiProvider = computed(() => this._aiSettings().provider);
  readonly $ollamaUrl = computed(() => this._aiSettings().ollamaUrl);
  readonly $ollamaModel = computed(() => this._aiSettings().ollamaModel);
  readonly $openaiApiKey = computed(
    () => this._aiSettings().openaiApiKey || '',
  );
  readonly $openaiModel = computed(() => this._aiSettings().openaiModel || '');
  readonly $claudeApiKey = computed(
    () => this._aiSettings().claudeApiKey || '',
  );
  readonly $claudeModel = computed(() => this._aiSettings().claudeModel || '');
  readonly $geminiApiKey = computed(
    () => this._aiSettings().geminiApiKey || '',
  );
  readonly $geminiModel = computed(() => this._aiSettings().geminiModel || '');

  constructor() {
    // Apply theme changes to document - manage both .dark and .light-theme classes
    effect(() => {
      const theme = this.$theme();
      if (theme === 'light') {
        document.documentElement.classList.add('light-theme');
        document.documentElement.classList.remove('dark');
      } else {
        document.documentElement.classList.remove('light-theme');
        document.documentElement.classList.add('dark');
      }
    });
  }

  async loadSettings(): Promise<void> {
    const settings = await this.electron.getSettings();
    this._settings.set(settings);

    // Load AI settings
    const aiSettings = await this.electron.aiGetSettings();
    this._aiSettings.set(aiSettings);
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
      alwaysDeleteEnclosingFolder: value ? true : undefined,
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

  async setVlcPath(path: string): Promise<void> {
    const updated = { ...this._settings(), vlcPath: path };
    this._settings.set(updated);
    await this.electron.saveSettings(updated);
  }

  async updateSettings(partial: Partial<AppSettings>): Promise<void> {
    const updated = { ...this._settings(), ...partial };
    this._settings.set(updated);
    await this.electron.saveSettings(updated);
  }

  // AI Setters
  async updateAiSettings(partial: Partial<AISettings>): Promise<void> {
    const updated = { ...this._aiSettings(), ...partial };
    this._aiSettings.set(updated);
    await this.electron.aiSaveSettings(updated);
  }

  async setOrganizeSeriesIntoFolders(value: boolean): Promise<void> {
    const updated: AppSettings = {
      ...this._settings(),
      organizeSeriesIntoFolders: value ? true : undefined,
    };
    this._settings.set(updated);
    await this.electron.saveSettings(updated);
  }

  async setHideCleanedSeasons(value: boolean): Promise<void> {
    const updated: AppSettings = {
      ...this._settings(),
      hideCleanedSeasons: value ? true : undefined,
    };
    this._settings.set(updated);
    await this.electron.saveSettings(updated);
  }

  async setAiProvider(provider: AISettings['provider']): Promise<void> {
    await this.updateAiSettings({ provider });
  }

  async setOllamaUrl(url: string): Promise<void> {
    await this.updateAiSettings({ ollamaUrl: url });
  }

  async setOllamaModel(model: string): Promise<void> {
    await this.updateAiSettings({ ollamaModel: model });
  }

  async setOpenAiApiKey(key: string): Promise<void> {
    await this.updateAiSettings({ openaiApiKey: key });
  }

  async setOpenAiModel(model: string): Promise<void> {
    await this.updateAiSettings({ openaiModel: model });
  }

  async setClaudeApiKey(key: string): Promise<void> {
    await this.updateAiSettings({ claudeApiKey: key });
  }

  async setClaudeModel(model: string): Promise<void> {
    await this.updateAiSettings({ claudeModel: model });
  }

  async setGeminiApiKey(key: string): Promise<void> {
    await this.updateAiSettings({ geminiApiKey: key });
  }

  async setGeminiModel(model: string): Promise<void> {
    await this.updateAiSettings({ geminiModel: model });
  }

  async getOllamaModels(): Promise<string[]> {
    return this.electron.aiListOllamaModels(this.$ollamaUrl());
  }
}
