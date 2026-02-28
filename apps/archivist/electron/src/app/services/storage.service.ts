import {
  AISettings,
  AppSettings,
  DEFAULT_AI_SETTINGS,
  DEFAULT_SETTINGS,
  FilterState,
  MediaFile,
  OmdbRating,
  StorageData,
} from '@medularity/archivist-core';
import { AIService } from './ai.service';
import { DatabaseService } from './database.service';

// electron-store is ESM-only, need dynamic import
// Using interface to properly type the store
interface ElectronStoreInstance {
  get(key: 'mediaLibrary', defaultValue?: MediaFile[]): MediaFile[];
  get(key: 'lastScanPath', defaultValue?: string | null): string | null;
  get(key: 'lastScanAt', defaultValue?: number | null): number | null;
  get(
    key: 'filters',
    defaultValue?: FilterState | undefined,
  ): FilterState | undefined;
  get(key: 'settings', defaultValue?: AppSettings): AppSettings;
  get(key: 'aiSettings', defaultValue?: AISettings): AISettings;
  get(key: 'ratingsCache', defaultValue?: string): string;
  get(key: 'commandHistory', defaultValue?: string[]): string[];
  set(key: 'mediaLibrary', value: MediaFile[]): void;
  set(key: 'lastScanPath', value: string | null): void;
  set(key: 'lastScanAt', value: number | null): void;
  set(key: 'filters', value: FilterState | undefined): void;
  set(key: 'settings', value: AppSettings): void;
  set(key: 'aiSettings', value: AISettings): void;
  set(key: 'ratingsCache', value: string): void;
  set(key: 'commandHistory', value: string[]): void;
}

let store: ElectronStoreInstance | null = null;

interface StoreSchema {
  mediaLibrary: MediaFile[];
  lastScanPath: string | null;
  lastScanAt: number | null;
  filters?: FilterState;
  settings: AppSettings;
  aiSettings: AISettings;
  ratingsCache: string; // JSON string
  commandHistory: string[]; // Last 5 custom FFmpeg commands
}

async function getStore(): Promise<ElectronStoreInstance> {
  if (!store) {
    const Store = (await import('electron-store')).default;
    store = new Store<StoreSchema>({
      name: 'archivist-data',
      defaults: {
        mediaLibrary: [],
        lastScanPath: null,
        lastScanAt: null,
        filters: undefined,
        settings: DEFAULT_SETTINGS,
        aiSettings: DEFAULT_AI_SETTINGS,
        ratingsCache: '{}',
        commandHistory: [],
      },
    }) as unknown as ElectronStoreInstance;
  }
  return store;
}

export async function getMediaLibrary(): Promise<MediaFile[]> {
  return DatabaseService.getAllFiles();
}

export async function saveMediaLibrary(files: MediaFile[]): Promise<void> {
  const s = await getStore();
  s.set('lastScanAt', Date.now());
  DatabaseService.clear();
  DatabaseService.upsertBatch(files);
}

export async function getLastScanPath(): Promise<string | null> {
  const s = await getStore();
  return s.get('lastScanPath', null);
}

export async function setLastScanPath(path: string): Promise<void> {
  const s = await getStore();
  s.set('lastScanPath', path);
}

export async function getFilters(): Promise<FilterState | undefined> {
  const s = await getStore();
  return s.get('filters', undefined);
}

export async function saveFilters(filters: FilterState): Promise<void> {
  const s = await getStore();
  s.set('filters', filters);
}

export async function clearLibrary(): Promise<void> {
  const s = await getStore();
  s.set('lastScanAt', null);
  DatabaseService.clear();
}

export async function getLastScanAt(): Promise<number | null> {
  const s = await getStore();
  return s.get('lastScanAt', null);
}

export async function getStorageData(): Promise<StorageData> {
  const [
    mediaLibrary,
    lastScanPath,
    lastScanAt,
    filters,
    settings,
    aiSettings,
  ] = await Promise.all([
    getMediaLibrary(),
    getLastScanPath(),
    getLastScanAt(),
    getFilters(),
    getSettings(),
    getAISettings(),
  ]);

  return {
    mediaLibrary,
    lastScanPath,
    lastScanAt,
    filters,
    settings,
    aiSettings,
  };
}

export async function getSettings(): Promise<AppSettings> {
  const s = await getStore();
  return s.get('settings', DEFAULT_SETTINGS);
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  const s = await getStore();
  s.set('settings', settings);
}

export async function getAISettings(): Promise<AISettings> {
  const s = await getStore();
  return s.get('aiSettings', DEFAULT_AI_SETTINGS);
}

/**
 * Validates and resolves the configured Ollama model against the models
 * that are actually installed locally. Call this explicitly when opening
 * AI settings — NOT on every storage read.
 */
export async function resolveOllamaModel(
  settings: AISettings,
): Promise<AISettings> {
  if (settings.provider !== 'ollama') return settings;

  const models = await AIService.listOllamaModels(settings.ollamaUrl);
  if (models.length === 0) return settings;

  const currentModel = settings.ollamaModel;
  if (models.includes(currentModel)) return settings;

  // Auto-select the first available model when the configured one is missing
  return { ...settings, ollamaModel: models[0] };
}

export async function saveAISettings(settings: AISettings): Promise<void> {
  const s = await getStore();
  s.set('aiSettings', settings);
}

export async function removeFilesFromLibrary(
  filePaths: string[],
): Promise<void> {
  DatabaseService.deleteFiles(filePaths);
}

export async function getRatingsCache(): Promise<Record<string, OmdbRating>> {
  const s = await getStore();
  const json = s.get('ratingsCache', '{}');
  try {
    return JSON.parse(json);
  } catch {
    return {};
  }
}

export async function saveRatingsCache(
  cache: Record<string, OmdbRating>,
): Promise<void> {
  const s = await getStore();
  s.set('ratingsCache', JSON.stringify(cache));
}

// Command history for FFmpeg editor (last 5 commands)
const MAX_COMMAND_HISTORY = 5;

export async function getCommandHistory(): Promise<string[]> {
  const s = await getStore();
  return s.get('commandHistory', []);
}

export async function saveCommandToHistory(command: string): Promise<void> {
  const s = await getStore();
  const history = s.get('commandHistory', []);

  // Remove if already exists (to move to top)
  const filtered = history.filter((cmd) => cmd !== command);

  // Add to beginning
  filtered.unshift(command);

  // Keep only last 5
  s.set('commandHistory', filtered.slice(0, MAX_COMMAND_HISTORY));
}
