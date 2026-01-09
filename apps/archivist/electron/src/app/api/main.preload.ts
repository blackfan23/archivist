import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

// Backend error interface
export interface BackendError {
  id: string;
  timestamp: number;
  operation: string;
  message: string;
  path?: string;
  code?: string;
  details?: unknown;
}

// Type definitions for the exposed API
export interface ElectronAPI {
  // App info
  getAppVersion: () => Promise<string>;
  platform: NodeJS.Platform;
  
  // Directory selection
  selectDirectory: () => Promise<string | null>;
  selectDestination: () => Promise<string | null>;
  selectSubtitleFile: () => Promise<string | null>;
  
  // Scanning
  scanDirectory: (path: string, forceFullScan?: boolean) => Promise<unknown[]>;
  cancelScan: () => Promise<boolean>;
  onScanProgress: (callback: (event: IpcRendererEvent, progress: unknown) => void) => void;
  removeScanProgressListener: () => void;
  
  // Library data
  getLibrary: () => Promise<unknown[]>;
  getStorageData: () => Promise<unknown>;
  getLastScanPath: () => Promise<string | null>;
  clearLibrary: () => Promise<boolean>;
  getMediaFileById: (id: string) => Promise<unknown | null>;
  
  // Filters
  saveFilters: (filters: unknown) => Promise<boolean>;
  
  // Settings
  getSettings: () => Promise<unknown>;
  saveSettings: (settings: unknown) => Promise<boolean>;
  
  // File operations
  renameFile: (oldPath: string, newPath: string) => Promise<boolean>;
  moveFile: (sourcePath: string, destDir: string) => Promise<string>;
  batchRename: (files: Array<{ oldPath: string; newPath: string }>) => Promise<unknown>;
  batchMove: (sourcePaths: string[], destDir: string) => Promise<unknown>;
  deleteFiles: (filePaths: string[], deleteParentFolders: boolean) => Promise<unknown>;
  showInFinder: (filePath: string) => Promise<void>;
  renameFolder: (oldPath: string, newPath: string) => Promise<boolean>;
  deleteEmptyFolders: (folderPaths: string[]) => Promise<void>;
  
  // OMDB
  fetchRatings: (items: Array<{ title: string; year?: string }>) => Promise<Record<string, unknown>>;
  requeryRating: (item: { title: string; year?: string }) => Promise<unknown | null>;
  
  // TMDB Match
  searchTmdb: (query: string) => Promise<unknown[]>;
  getTvEpisode: (tvId: number, season: number, episode: number) => Promise<unknown | null>;
  matchFile: (filePath: string, metadata: unknown, embedMetadata: boolean) => Promise<{ newPath: string; success: boolean; error?: string }>;
  writeMetadata: (filePath: string, metadata: unknown) => Promise<{ success: boolean; error?: string }>;
  
  // Error handling
  onBackendError: (callback: (event: IpcRendererEvent, error: BackendError) => void) => void;
  removeBackendErrorListener: () => void;
  getErrorLog: () => Promise<BackendError[]>;
  clearErrorLog: () => Promise<boolean>;
  
  // API Key Validation
  validateTmdbKey: (apiKey: string) => Promise<{ valid: boolean; error?: string }>;
  validateOmdbKey: (apiKey: string) => Promise<{ valid: boolean; error?: string }>;
  
  // FFmpeg Editor
  convertContainer: (filePath: string, format: string, duration?: number) => Promise<EditorResult>;
  transcodeVideo: (filePath: string, options: VideoTranscodeOptions, duration?: number) => Promise<EditorResult>;
  transcodeAudio: (filePath: string, options: AudioTranscodeOptions, duration?: number) => Promise<EditorResult>;
  extractSubtitle: (filePath: string, trackIndex: number, format: string, outputPath?: string) => Promise<EditorResult>;
  addSubtitle: (filePath: string, subtitlePath: string, language?: string, duration?: number) => Promise<EditorResult>;
  removeSubtitle: (filePath: string, trackIndex: number, duration?: number) => Promise<EditorResult>;
  setDefaultSubtitle: (filePath: string, trackIndex: number, duration?: number) => Promise<EditorResult>;
  runCustomCommand: (command: string) => Promise<EditorResult>;
  getCommandHistory: () => Promise<string[]>;
  onEditorProgress: (callback: (event: IpcRendererEvent, progress: EditorProgress) => void) => void;
  removeEditorProgressListener: () => void;
  
  // Menu integration
  updateMenuSelection: (hasSelection: boolean, isSingleFile: boolean) => void;
  onMenuAction: (callback: (event: IpcRendererEvent, action: string) => void) => void;
  removeMenuActionListener: () => void;
}

// Editor types
export interface EditorResult {
  success: boolean;
  outputPath?: string;
  error?: string;
}

export interface EditorProgress {
  percent: number;
  timeProcessed?: string;
  speed?: string;
  currentFrame?: number;
}

export interface VideoTranscodeOptions {
  codec: 'copy' | 'h264' | 'h265' | 'vp9' | 'av1';
  crf?: number;
  bitrate?: number;
  preset?: 'ultrafast' | 'superfast' | 'veryfast' | 'faster' | 'fast' | 'medium' | 'slow' | 'slower' | 'veryslow';
}

export interface AudioTranscodeOptions {
  codec: 'copy' | 'aac' | 'ac3' | 'mp3' | 'flac' | 'opus';
  bitrate?: number;
  channels?: number;
  sampleRate?: number;
}

// Store listener references for cleanup
let scanProgressCallback: ((event: IpcRendererEvent, progress: unknown) => void) | null = null;
let backendErrorCallback: ((event: IpcRendererEvent, error: BackendError) => void) | null = null;
let editorProgressCallback: ((event: IpcRendererEvent, progress: EditorProgress) => void) | null = null;
let menuActionCallback: ((event: IpcRendererEvent, action: string) => void) | null = null;

contextBridge.exposeInMainWorld('electron', {
  // App info
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  platform: process.platform,
  
  // Directory selection
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  selectDestination: () => ipcRenderer.invoke('select-destination'),
  
  // Scanning
  scanDirectory: (path: string, forceFullScan?: boolean) => ipcRenderer.invoke('scan-directory', path, forceFullScan),
  cancelScan: () => ipcRenderer.invoke('cancel-scan'),
  onScanProgress: (callback: (event: IpcRendererEvent, progress: unknown) => void) => {
    scanProgressCallback = callback;
    ipcRenderer.on('scan-progress', callback);
  },
  removeScanProgressListener: () => {
    if (scanProgressCallback) {
      ipcRenderer.removeListener('scan-progress', scanProgressCallback);
      scanProgressCallback = null;
    }
  },
  
  // Library data
  getLibrary: () => ipcRenderer.invoke('get-library'),
  getStorageData: () => ipcRenderer.invoke('get-storage-data'),
  getLastScanPath: () => ipcRenderer.invoke('get-last-scan-path'),
  clearLibrary: () => ipcRenderer.invoke('clear-library'),
  
  // Filters
  saveFilters: (filters: unknown) => ipcRenderer.invoke('save-filters', filters),
  
  // Settings
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings: unknown) => ipcRenderer.invoke('save-settings', settings),
  
  // File operations
  renameFile: (oldPath: string, newPath: string) => ipcRenderer.invoke('rename-file', oldPath, newPath),
  moveFile: (sourcePath: string, destDir: string) => ipcRenderer.invoke('move-file', sourcePath, destDir),
  batchRename: (files: Array<{ oldPath: string; newPath: string }>) => ipcRenderer.invoke('batch-rename', files),
  batchMove: (sourcePaths: string[], destDir: string) => ipcRenderer.invoke('batch-move', sourcePaths, destDir),
  deleteFiles: (filePaths: string[], deleteParentFolders: boolean) => ipcRenderer.invoke('delete-files', filePaths, deleteParentFolders),
  showInFinder: (filePath: string) => ipcRenderer.invoke('show-in-finder', filePath),
  renameFolder: (oldPath: string, newPath: string) => ipcRenderer.invoke('rename-folder', oldPath, newPath),
  deleteEmptyFolders: (folderPaths: string[]) => ipcRenderer.invoke('delete-empty-folders', folderPaths),
  
  // OMDB / Ratings
  fetchRatings: (items: Array<{ title: string; year?: string }>) => ipcRenderer.invoke('fetch-ratings', items),
  requeryRating: (item: { title: string; year?: string }) => ipcRenderer.invoke('requery-rating', item),
  
  // TMDB Match
  searchTmdb: (query: string) => ipcRenderer.invoke('search-tmdb', query),
  getTvEpisode: (tvId: number, season: number, episode: number) => 
    ipcRenderer.invoke('get-tv-episode', tvId, season, episode),
  matchFile: (filePath: string, metadata: unknown, embedMetadata: boolean) => 
    ipcRenderer.invoke('match-file', filePath, metadata, embedMetadata),
  writeMetadata: (filePath: string, metadata: unknown) =>
    ipcRenderer.invoke('write-metadata', filePath, metadata),
  
  // Error handling
  onBackendError: (callback: (event: IpcRendererEvent, error: BackendError) => void) => {
    backendErrorCallback = callback;
    ipcRenderer.on('backend-error', callback);
  },
  removeBackendErrorListener: () => {
    if (backendErrorCallback) {
      ipcRenderer.removeListener('backend-error', backendErrorCallback);
      backendErrorCallback = null;
    }
  },
  getErrorLog: () => ipcRenderer.invoke('get-error-log'),
  clearErrorLog: () => ipcRenderer.invoke('clear-error-log'),
  
  // API Key Validation
  validateTmdbKey: (apiKey: string) => ipcRenderer.invoke('validate-tmdb-key', apiKey),
  validateOmdbKey: (apiKey: string) => ipcRenderer.invoke('validate-omdb-key', apiKey),
  
  // FFmpeg Editor
  convertContainer: (filePath: string, format: string, duration?: number) =>
    ipcRenderer.invoke('convert-container', filePath, format, duration),
  transcodeVideo: (filePath: string, options: VideoTranscodeOptions, duration?: number) =>
    ipcRenderer.invoke('transcode-video', filePath, options, duration),
  transcodeAudio: (filePath: string, options: AudioTranscodeOptions, duration?: number) =>
    ipcRenderer.invoke('transcode-audio', filePath, options, duration),
  extractSubtitle: (filePath: string, trackIndex: number, format: string, outputPath?: string) =>
    ipcRenderer.invoke('extract-subtitle', filePath, trackIndex, format, outputPath),
  addSubtitle: (filePath: string, subtitlePath: string, language?: string, duration?: number) =>
    ipcRenderer.invoke('add-subtitle', filePath, subtitlePath, language, duration),
  removeSubtitle: (filePath: string, trackIndex: number, duration?: number) =>
    ipcRenderer.invoke('remove-subtitle', filePath, trackIndex, duration),
  setDefaultSubtitle: (filePath: string, trackIndex: number, duration?: number) =>
    ipcRenderer.invoke('set-default-subtitle', filePath, trackIndex, duration),
  runCustomCommand: (command: string) => ipcRenderer.invoke('run-custom-command', command),
  getCommandHistory: () => ipcRenderer.invoke('get-command-history'),
  getMediaFileById: (id: string) => ipcRenderer.invoke('get-media-file-by-id', id),
  selectSubtitleFile: () => ipcRenderer.invoke('select-subtitle-file'),
  onEditorProgress: (callback: (event: IpcRendererEvent, progress: EditorProgress) => void) => {
    editorProgressCallback = callback;
    ipcRenderer.on('editor-progress', callback);
  },
  removeEditorProgressListener: () => {
    if (editorProgressCallback) {
      ipcRenderer.removeListener('editor-progress', editorProgressCallback);
      editorProgressCallback = null;
    }
  },
  
  // Menu integration
  updateMenuSelection: (hasSelection: boolean, isSingleFile: boolean) => {
    ipcRenderer.send('update-menu-selection', hasSelection, isSingleFile);
  },
  onMenuAction: (callback: (event: IpcRendererEvent, action: string) => void) => {
    menuActionCallback = callback;
    ipcRenderer.on('menu-action', callback);
  },
  removeMenuActionListener: () => {
    if (menuActionCallback) {
      ipcRenderer.removeListener('menu-action', menuActionCallback);
      menuActionCallback = null;
    }
  },
} satisfies ElectronAPI);

// Extend the Window interface for TypeScript
declare global {
  interface Window {
    electron: ElectronAPI;
  }
}

