import { AISettings, GenerateRequest, GenerateResponse } from './ai.models';
import {
  AnalysisResult,
  AppSettings,
  AudioTranscodeOptions,
  BatchResult,
  CleanerResultItem,
  ContainerFormat,
  DeleteResult,
  EditorProgress,
  EditorResult,
  FilterState,
  LightweightFile,
  MediaFile,
  OmdbRating,
  QueueTask,
  StorageData,
  SubtitleFormat,
  TmdbEpisodeDetails,
  TmdbMatchResult,
  TmdbMetadata,
  TmdbRating,
  VideoTranscodeOptions,
} from './models';

// IPC_CHANNELS enum moved to constants.ts to avoid valibot dependency in preload.

export interface BackendError {
  id: string;
  timestamp: number;
  operation: string;
  message: string;
  path?: string;
  code?: string;
  details?: unknown;
}

/**
 * The unified API interface exposed by the Electron main process via context bridge.
 */
export interface ArchivistApi {
  // App info
  getAppVersion: () => Promise<string>;
  platform: string;
  appReady: () => void;

  // AI Operations
  aiGetSettings: () => Promise<AISettings>;
  aiSaveSettings: (settings: AISettings) => Promise<boolean>;
  aiGenerate: (request: GenerateRequest) => Promise<GenerateResponse>;
  aiTestConnection: (
    settings?: AISettings,
  ) => Promise<{ success: boolean; error?: string }>;
  aiListOllamaModels: (ollamaUrl: string) => Promise<string[]>;
  aiPullOllamaModel: (ollamaUrl: string, model: string) => Promise<void>;

  // AI Analysis & Matching
  analyzeFile: (filePath: string) => Promise<AnalysisResult>;
  runAnalysis: (
    files: LightweightFile[],
    filter?: 'both' | 'movie' | 'tv',
  ) => Promise<void>;
  applyFix: (result: AnalysisResult) => Promise<string | null>;
  markAsClean: (filePath: string) => Promise<void>;
  loadOptimizationState: (rootPath: string) => Promise<AnalysisResult[] | null>;
  cancelAnalysis: () => Promise<boolean>;
  onAnalysisResult: (
    callback: (event: any, result: AnalysisResult) => void,
  ) => void;
  removeAnalysisResultListener: () => void;

  // Directory selection
  selectDirectory: () => Promise<string | null>;
  selectDestination: () => Promise<string | null>;
  selectSubtitleFile: () => Promise<string | null>;

  // Scanning
  scanDirectory: (
    path: string,
    forceFullScan?: boolean,
  ) => Promise<MediaFile[]>;
  cancelScan: () => Promise<boolean>;
  onScanProgress: (callback: (event: any, progress: unknown) => void) => void;
  removeScanProgressListener: () => void;
  scanDirectoryAI: (path: string) => Promise<LightweightFile[]>;
  cancelScanAI: () => Promise<boolean>;

  // Storage Cleaner
  scanForCleanup: (path: string) => Promise<CleanerResultItem[]>;
  cancelCleanerScan: () => Promise<boolean>;

  // Library data
  getLibrary: () => Promise<MediaFile[]>;
  getStorageData: () => Promise<StorageData>;
  getLastScanPath: () => Promise<string | null>;
  clearLibrary: () => Promise<boolean>;
  getMediaFileById: (id: string) => Promise<MediaFile | null>;

  // Filters
  saveFilters: (filters: FilterState) => Promise<boolean>;

  // Settings & Maintenance
  getSettings: () => Promise<AppSettings>;
  saveSettings: (settings: AppSettings) => Promise<boolean>;
  fullReset: () => Promise<boolean>;
  resetAICache: () => Promise<number>;

  // File operations
  renameFile: (oldPath: string, newPath: string) => Promise<boolean>;
  moveFile: (sourcePath: string, destDir: string) => Promise<string>;
  batchRename: (
    files: Array<{ oldPath: string; newPath: string }>,
  ) => Promise<BatchResult>;
  batchMove: (sourcePaths: string[], destDir: string) => Promise<BatchResult>;
  deleteFiles: (
    filePaths: string[],
    deleteParentFolders: boolean,
  ) => Promise<DeleteResult>;
  showInFinder: (filePath: string) => Promise<void>;
  renameFolder: (oldPath: string, newPath: string) => Promise<boolean>;
  deleteEmptyFolders: (folderPaths: string[]) => Promise<void>;
  isDirectoryEmpty: (folderPath: string) => Promise<boolean>;

  // Ratings & Metadata
  fetchRatings: (
    items: Array<{ title: string; year?: string }>,
  ) => Promise<Record<string, OmdbRating | TmdbRating>>;
  requeryRating: (item: {
    title: string;
    year?: string;
  }) => Promise<OmdbRating | TmdbRating | null>;
  searchTmdb: (query: string) => Promise<TmdbMatchResult[]>;
  getTvEpisode: (
    tvId: number,
    season: number,
    episode: number,
  ) => Promise<TmdbEpisodeDetails | null>;
  matchFile: (
    filePath: string,
    metadata: TmdbMetadata,
    embedMetadata: boolean,
  ) => Promise<{ newPath: string; success: boolean; error?: string }>;
  writeMetadata: (
    filePath: string,
    metadata: TmdbMetadata,
  ) => Promise<{ success: boolean; error?: string }>;

  // VLC integration
  vlcCheckInstalled: (customPath?: string) => Promise<boolean>;
  vlcPlay: (filePath: string, customPath?: string) => Promise<void>;

  // Error handling
  onBackendError: (callback: (event: any, error: BackendError) => void) => void;
  removeBackendErrorListener: () => void;
  getErrorLog: () => Promise<BackendError[]>;
  clearErrorLog: () => Promise<boolean>;

  // API Key Validation
  validateTmdbKey: (
    apiKey: string,
  ) => Promise<{ valid: boolean; error?: string }>;
  validateOmdbKey: (
    apiKey: string,
  ) => Promise<{ valid: boolean; error?: string }>;
  validateKeys: () => Promise<{
    tmdb: { valid: boolean; error?: string };
    omdb: { valid: boolean; error?: string };
  }>;

  // FFmpeg Editor
  convertContainer: (
    filePath: string,
    format: ContainerFormat,
    duration?: number,
  ) => Promise<EditorResult>;
  transcodeVideo: (
    filePath: string,
    options: VideoTranscodeOptions,
    duration?: number,
  ) => Promise<EditorResult>;
  transcodeAudio: (
    filePath: string,
    options: AudioTranscodeOptions,
    duration?: number,
  ) => Promise<EditorResult>;
  extractSubtitle: (
    filePath: string,
    trackIndex: number,
    format: SubtitleFormat,
    outputPath?: string,
  ) => Promise<EditorResult>;
  addSubtitle: (
    filePath: string,
    subtitlePath: string,
    language?: string,
    duration?: number,
  ) => Promise<EditorResult>;
  removeSubtitle: (
    filePath: string,
    trackIndex: number,
    duration?: number,
  ) => Promise<EditorResult>;
  setDefaultSubtitle: (
    filePath: string,
    trackIndex: number,
    duration?: number,
  ) => Promise<EditorResult>;
  runCustomCommand: (command: string) => Promise<EditorResult>;
  getCommandHistory: () => Promise<string[]>;
  onEditorProgress: (
    callback: (event: any, progress: EditorProgress) => void,
  ) => void;
  removeEditorProgressListener: () => void;

  // Queue
  queueAdd: (type: string, payload: any) => Promise<QueueTask>;
  queueRemove: (id: string) => Promise<void>;
  queueList: () => Promise<QueueTask[]>;
  queueClear: () => Promise<void>;
  queuePause: () => Promise<void>;
  queueResume: () => Promise<void>;
  queueIsActive: () => Promise<boolean>;
  onQueueTaskStarted: (
    callback: (event: any, data: { id: string; type: string }) => void,
  ) => void;
  removeQueueTaskStartedListener: () => void;
  onQueueTaskCompleted: (
    callback: (event: any, data: { id: string }) => void,
  ) => void;
  removeQueueTaskCompletedListener: () => void;
  onQueueTaskFailed: (
    callback: (event: any, data: { id: string; error: string }) => void,
  ) => void;
  removeQueueTaskFailedListener: () => void;
  onQueueStatusChanged: (
    callback: (event: any, data: { isActive: boolean }) => void,
  ) => void;
  removeQueueStatusChangedListener: () => void;

  // Menu & UI Integration
  updateMenuSelection: (hasSelection: boolean, isSingleFile: boolean) => void;
  onMenuAction: (callback: (event: any, action: string) => void) => void;
  removeMenuActionListener: () => void;
}
