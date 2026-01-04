import { AppSettings, DEFAULT_SETTINGS, FilterState, MediaFile, StorageData } from '../models';

// electron-store is ESM-only, need dynamic import
// Using interface to properly type the store
interface ElectronStoreInstance {
  get(key: 'mediaLibrary', defaultValue?: MediaFile[]): MediaFile[];
  get(key: 'lastScanPath', defaultValue?: string | null): string | null;
  get(key: 'lastScanAt', defaultValue?: number | null): number | null;
  get(key: 'filters', defaultValue?: FilterState | undefined): FilterState | undefined;
  get(key: 'settings', defaultValue?: AppSettings): AppSettings;
  get(key: 'ratingsCache', defaultValue?: string): string;
  get(key: 'commandHistory', defaultValue?: string[]): string[];
  set(key: 'mediaLibrary', value: MediaFile[]): void;
  set(key: 'lastScanPath', value: string | null): void;
  set(key: 'lastScanAt', value: number | null): void;
  set(key: 'filters', value: FilterState | undefined): void;
  set(key: 'settings', value: AppSettings): void;
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
        ratingsCache: '{}',
        commandHistory: [],
      },
    }) as unknown as ElectronStoreInstance;
  }
  return store;
}

export async function getMediaLibrary(): Promise<MediaFile[]> {
  const s = await getStore();
  return s.get('mediaLibrary', []);
}

export async function saveMediaLibrary(files: MediaFile[]): Promise<void> {
  const s = await getStore();
  s.set('mediaLibrary', files);
  s.set('lastScanAt', Date.now());
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
  s.set('mediaLibrary', []);
  s.set('lastScanAt', null);
}

export async function getLastScanAt(): Promise<number | null> {
  const s = await getStore();
  return s.get('lastScanAt', null);
}

export async function getStorageData(): Promise<StorageData> {
  return {
    mediaLibrary: await getMediaLibrary(),
    lastScanPath: await getLastScanPath(),
    lastScanAt: await getLastScanAt(),
    filters: await getFilters(),
    settings: await getSettings(),
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

export async function removeFilesFromLibrary(filePaths: string[]): Promise<void> {
  const s = await getStore();
  const currentLibrary = s.get('mediaLibrary', []);
  const pathsToRemove = new Set(filePaths);
  const updatedLibrary = currentLibrary.filter((file) => !pathsToRemove.has(file.path));
  s.set('mediaLibrary', updatedLibrary);
}

export async function getRatingsCache(): Promise<Record<string, import('../models').OmdbRating>> {
  const s = await getStore();
  const json = s.get('ratingsCache', '{}');
  try {
    return JSON.parse(json);
  } catch {
    return {};
  }
}

export async function saveRatingsCache(cache: Record<string, import('../models').OmdbRating>): Promise<void> {
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
