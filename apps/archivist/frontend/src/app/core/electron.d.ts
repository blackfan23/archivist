// Type definitions for Electron API exposed via preload script

export interface BackendError {
  id: string;
  timestamp: number;
  operation: string;
  message: string;
  path?: string;
  code?: string;
  details?: unknown;
}

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
  onScanProgress: (callback: (event: unknown, progress: unknown) => void) => void;
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
  
  // OMDB / Ratings
  fetchRatings: (items: Array<{ title: string; year?: string }>) => Promise<Record<string, unknown>>;
  requeryRating: (item: { title: string; year?: string }) => Promise<unknown | null>;
  
  // TMDB Match
  searchTmdb: (query: string) => Promise<unknown[]>;
  getTvEpisode: (tvId: number, season: number, episode: number) => Promise<unknown | null>;
  matchFile: (filePath: string, metadata: unknown, embedMetadata: boolean) => Promise<{ newPath: string; success: boolean; error?: string }>;
  writeMetadata: (filePath: string, metadata: unknown) => Promise<{ success: boolean; error?: string }>;
  
  // Error handling
  onBackendError: (callback: (event: unknown, error: BackendError) => void) => void;
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
  onEditorProgress: (callback: (event: unknown, progress: EditorProgress) => void) => void;
  removeEditorProgressListener: () => void;
  
  // Menu integration
  updateMenuSelection: (hasSelection: boolean, isSingleFile: boolean) => void;
  onMenuAction: (callback: (event: unknown, action: string) => void) => void;
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

declare global {
  interface Window {
    electron?: ElectronAPI;
  }
}

export { };

