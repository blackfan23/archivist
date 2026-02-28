import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import { IPC_CHANNELS } from '../../../../../../libs/archivist-core/src/lib/constants';
import type {
  ArchivistApi,
  BackendError,
} from '../../../../../../libs/archivist-core/src/lib/ipc';

// Store listener references for cleanup
let scanProgressCallback:
  | ((event: IpcRendererEvent, progress: unknown) => void)
  | null = null;
let backendErrorCallback:
  | ((event: IpcRendererEvent, error: BackendError) => void)
  | null = null;
let editorProgressCallback:
  | ((event: IpcRendererEvent, progress: any) => void)
  | null = null;
let menuActionCallback:
  | ((event: IpcRendererEvent, action: string) => void)
  | null = null;
let analysisResultCallback:
  | ((event: IpcRendererEvent, result: any) => void)
  | null = null;
let queueTaskStartedCallback:
  | ((event: IpcRendererEvent, data: { id: string; type: string }) => void)
  | null = null;
let queueTaskCompletedCallback:
  | ((event: IpcRendererEvent, data: { id: string }) => void)
  | null = null;
let queueTaskFailedCallback:
  | ((event: IpcRendererEvent, data: { id: string; error: string }) => void)
  | null = null;
let queueStatusChangedCallback:
  | ((event: IpcRendererEvent, data: { isActive: boolean }) => void)
  | null = null;

ipcRenderer.send(
  IPC_CHANNELS.PRELOAD_LOG,
  '[Preload] Preload script initializing...',
);

const api: ArchivistApi = {
  // App info
  getAppVersion: () => ipcRenderer.invoke(IPC_CHANNELS.GET_APP_VERSION),
  platform: process.platform,
  appReady: () => {
    ipcRenderer.send(
      IPC_CHANNELS.PRELOAD_LOG,
      '[Preload] Sending app:ready signal to main process',
    );
    ipcRenderer.send(IPC_CHANNELS.APP_READY);
  },

  // AI Analysis
  analyzeFile: (filePath: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.ANALYZE_FILE, filePath),
  runAnalysis: (files: any[], filter?: 'both' | 'movie' | 'tv') =>
    ipcRenderer.invoke(IPC_CHANNELS.RUN_ANALYSIS, files, filter),
  applyFix: (result: any) => ipcRenderer.invoke(IPC_CHANNELS.APPLY_FIX, result),
  markAsClean: (filePath: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.ANALYSIS_MARK_CLEAN, filePath),
  loadOptimizationState: (rootPath: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.ANALYSIS_LOAD_OPTIMIZATION_STATE, rootPath),
  cancelAnalysis: () => ipcRenderer.invoke(IPC_CHANNELS.ANALYSIS_CANCEL),
  onAnalysisResult: (
    callback: (event: IpcRendererEvent, result: any) => void,
  ) => {
    analysisResultCallback = callback;
    ipcRenderer.on(IPC_CHANNELS.ANALYSIS_RESULT, callback);
  },
  removeAnalysisResultListener: () => {
    if (analysisResultCallback) {
      ipcRenderer.removeListener(
        IPC_CHANNELS.ANALYSIS_RESULT,
        analysisResultCallback,
      );
      analysisResultCallback = null;
    }
  },

  // Directory selection
  selectDirectory: () => ipcRenderer.invoke(IPC_CHANNELS.SELECT_DIRECTORY),
  selectDestination: () => ipcRenderer.invoke(IPC_CHANNELS.SELECT_DESTINATION),
  selectSubtitleFile: () =>
    ipcRenderer.invoke(IPC_CHANNELS.SELECT_SUBTITLE_FILE),

  // Scanning (full — manual mode, ffprobe)
  scanDirectory: (path: string, forceFullScan?: boolean) =>
    ipcRenderer.invoke(IPC_CHANNELS.SCAN_DIRECTORY, path, forceFullScan),
  cancelScan: () => ipcRenderer.invoke(IPC_CHANNELS.CANCEL_SCAN),
  onScanProgress: (
    callback: (event: IpcRendererEvent, progress: unknown) => void,
  ) => {
    scanProgressCallback = callback;
    ipcRenderer.on(IPC_CHANNELS.SCAN_PROGRESS, callback);
  },
  removeScanProgressListener: () => {
    if (scanProgressCallback) {
      ipcRenderer.removeListener(
        IPC_CHANNELS.SCAN_PROGRESS,
        scanProgressCallback,
      );
      scanProgressCallback = null;
    }
  },

  // Scanning (lightweight — AI mode, no ffprobe)
  scanDirectoryAI: (path: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SCAN_DIRECTORY_AI, path),
  cancelScanAI: () => ipcRenderer.invoke(IPC_CHANNELS.CANCEL_SCAN_AI),

  // Storage Cleaner
  scanForCleanup: (path: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.CLEANER_SCAN, path),
  cancelCleanerScan: () => ipcRenderer.invoke(IPC_CHANNELS.CLEANER_CANCEL),

  // Library data
  getLibrary: () => ipcRenderer.invoke(IPC_CHANNELS.GET_LIBRARY),
  getStorageData: () => ipcRenderer.invoke(IPC_CHANNELS.GET_STORAGE_DATA),
  getLastScanPath: () => ipcRenderer.invoke(IPC_CHANNELS.GET_LAST_SCAN_PATH),
  clearLibrary: () => ipcRenderer.invoke(IPC_CHANNELS.CLEAR_LIBRARY),
  getMediaFileById: (id: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_MEDIA_FILE_BY_ID, id),

  // Filters
  saveFilters: (filters: any) =>
    ipcRenderer.invoke(IPC_CHANNELS.SAVE_FILTERS, filters),

  // Settings & Maintenance
  getSettings: () => ipcRenderer.invoke(IPC_CHANNELS.GET_SETTINGS),
  saveSettings: (settings: any) =>
    ipcRenderer.invoke(IPC_CHANNELS.SAVE_SETTINGS, settings),
  fullReset: () => ipcRenderer.invoke(IPC_CHANNELS.MAINTENANCE_FULL_RESET),
  resetAICache: () =>
    ipcRenderer.invoke(IPC_CHANNELS.MAINTENANCE_RESET_AI_CACHE),

  // File operations
  renameFile: (oldPath: string, newPath: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.RENAME_FILE, oldPath, newPath),
  moveFile: (sourcePath: string, destDir: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.MOVE_FILE, sourcePath, destDir),
  batchRename: (files: Array<{ oldPath: string; newPath: string }>) =>
    ipcRenderer.invoke(IPC_CHANNELS.BATCH_RENAME, files),
  batchMove: (sourcePaths: string[], destDir: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.BATCH_MOVE, sourcePaths, destDir),
  deleteFiles: (filePaths: string[], deleteParentFolders: boolean) =>
    ipcRenderer.invoke(
      IPC_CHANNELS.DELETE_FILES,
      filePaths,
      deleteParentFolders,
    ),
  showInFinder: (filePath: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SHOW_IN_FINDER, filePath),
  renameFolder: (oldPath: string, newPath: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.RENAME_FOLDER, oldPath, newPath),
  deleteEmptyFolders: (folderPaths: string[]) =>
    ipcRenderer.invoke(IPC_CHANNELS.DELETE_EMPTY_FOLDERS, folderPaths),
  isDirectoryEmpty: (folderPath: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.IS_DIRECTORY_EMPTY, folderPath),

  // OMDB / Ratings
  fetchRatings: (items: Array<{ title: string; year?: string }>) =>
    ipcRenderer.invoke(IPC_CHANNELS.FETCH_RATINGS, items),
  requeryRating: (item: { title: string; year?: string }) =>
    ipcRenderer.invoke(IPC_CHANNELS.REQUERY_RATING, item),

  // TMDB Match
  searchTmdb: (query: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SEARCH_TMDB, query),
  getTvEpisode: (tvId: number, season: number, episode: number) =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_TV_EPISODE, tvId, season, episode),
  matchFile: (filePath: string, metadata: any, embedMetadata: boolean) =>
    ipcRenderer.invoke(
      IPC_CHANNELS.MATCH_FILE,
      filePath,
      metadata,
      embedMetadata,
    ),
  writeMetadata: (filePath: string, metadata: any) =>
    ipcRenderer.invoke(IPC_CHANNELS.WRITE_METADATA, filePath, metadata),

  // VLC integration
  vlcCheckInstalled: (customPath?: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.VLC_CHECK_INSTALLED, customPath),
  vlcPlay: (filePath: string, customPath?: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.VLC_PLAY, filePath, customPath),

  // Error handling
  onBackendError: (
    callback: (event: IpcRendererEvent, error: BackendError) => void,
  ) => {
    backendErrorCallback = callback;
    ipcRenderer.on(IPC_CHANNELS.BACKEND_ERROR, callback);
  },
  removeBackendErrorListener: () => {
    if (backendErrorCallback) {
      ipcRenderer.removeListener(
        IPC_CHANNELS.BACKEND_ERROR,
        backendErrorCallback,
      );
      backendErrorCallback = null;
    }
  },
  getErrorLog: () => ipcRenderer.invoke(IPC_CHANNELS.GET_ERROR_LOG),
  clearErrorLog: () => ipcRenderer.invoke(IPC_CHANNELS.CLEAR_ERROR_LOG),

  // API Key Validation
  validateTmdbKey: (apiKey: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.VALIDATE_TMDB_KEY, apiKey),
  validateOmdbKey: (apiKey: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.VALIDATE_OMDB_KEY, apiKey),
  validateKeys: () => ipcRenderer.invoke(IPC_CHANNELS.VALIDATE_KEYS),

  // FFmpeg Editor
  convertContainer: (filePath: string, format: any, duration?: number) =>
    ipcRenderer.invoke(
      IPC_CHANNELS.CONVERT_CONTAINER,
      filePath,
      format,
      duration,
    ),
  transcodeVideo: (filePath: string, options: any, duration?: number) =>
    ipcRenderer.invoke(
      IPC_CHANNELS.TRANSCODE_VIDEO,
      filePath,
      options,
      duration,
    ),
  transcodeAudio: (filePath: string, options: any, duration?: number) =>
    ipcRenderer.invoke(
      IPC_CHANNELS.TRANSCODE_AUDIO,
      filePath,
      options,
      duration,
    ),
  extractSubtitle: (
    filePath: string,
    trackIndex: number,
    format: any,
    outputPath?: string,
  ) =>
    ipcRenderer.invoke(
      IPC_CHANNELS.EXTRACT_SUBTITLE,
      filePath,
      trackIndex,
      format,
      outputPath,
    ),
  addSubtitle: (
    filePath: string,
    subtitlePath: string,
    language?: string,
    duration?: number,
  ) =>
    ipcRenderer.invoke(
      IPC_CHANNELS.ADD_SUBTITLE,
      filePath,
      subtitlePath,
      language,
      duration,
    ),
  removeSubtitle: (filePath: string, trackIndex: number, duration?: number) =>
    ipcRenderer.invoke(
      IPC_CHANNELS.REMOVE_SUBTITLE,
      filePath,
      trackIndex,
      duration,
    ),
  setDefaultSubtitle: (
    filePath: string,
    trackIndex: number,
    duration?: number,
  ) =>
    ipcRenderer.invoke(
      IPC_CHANNELS.SET_DEFAULT_SUBTITLE,
      filePath,
      trackIndex,
      duration,
    ),
  runCustomCommand: (command: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.RUN_CUSTOM_COMMAND, command),
  getCommandHistory: () => ipcRenderer.invoke(IPC_CHANNELS.GET_COMMAND_HISTORY),
  onEditorProgress: (
    callback: (event: IpcRendererEvent, progress: any) => void,
  ) => {
    editorProgressCallback = callback;
    ipcRenderer.on(IPC_CHANNELS.EDITOR_PROGRESS, callback);
  },
  removeEditorProgressListener: () => {
    if (editorProgressCallback) {
      ipcRenderer.removeListener(
        IPC_CHANNELS.EDITOR_PROGRESS,
        editorProgressCallback,
      );
      editorProgressCallback = null;
    }
  },

  // AI
  aiGetSettings: () => ipcRenderer.invoke(IPC_CHANNELS.AI_GET_SETTINGS),
  aiSaveSettings: (settings: any) =>
    ipcRenderer.invoke(IPC_CHANNELS.AI_SAVE_SETTINGS, settings),
  aiGenerate: (request: any) =>
    ipcRenderer.invoke(IPC_CHANNELS.AI_GENERATE, request),
  aiTestConnection: (settings?: any) =>
    ipcRenderer.invoke(IPC_CHANNELS.AI_TEST_CONNECTION, settings),
  aiListOllamaModels: (ollamaUrl: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.AI_LIST_OLLAMA_MODELS, ollamaUrl),
  aiPullOllamaModel: (ollamaUrl: string, model: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.AI_PULL_OLLAMA_MODEL, ollamaUrl, model),

  // Queue
  queueAdd: (type: string, payload: any) =>
    ipcRenderer.invoke(IPC_CHANNELS.QUEUE_ADD, type, payload),
  queueRemove: (id: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.QUEUE_REMOVE, id),
  queueList: () => ipcRenderer.invoke(IPC_CHANNELS.QUEUE_LIST),
  queueClear: () => ipcRenderer.invoke(IPC_CHANNELS.QUEUE_CLEAR),
  queuePause: () => ipcRenderer.invoke(IPC_CHANNELS.QUEUE_PAUSE),
  queueResume: () => ipcRenderer.invoke(IPC_CHANNELS.QUEUE_RESUME),
  queueIsActive: () => ipcRenderer.invoke(IPC_CHANNELS.QUEUE_IS_ACTIVE),
  onQueueTaskStarted: (
    callback: (
      event: IpcRendererEvent,
      data: { id: string; type: string },
    ) => void,
  ) => {
    queueTaskStartedCallback = callback;
    ipcRenderer.on(IPC_CHANNELS.QUEUE_TASK_STARTED, callback);
  },
  removeQueueTaskStartedListener: () => {
    if (queueTaskStartedCallback) {
      ipcRenderer.removeListener(
        IPC_CHANNELS.QUEUE_TASK_STARTED,
        queueTaskStartedCallback,
      );
      queueTaskStartedCallback = null;
    }
  },
  onQueueTaskCompleted: (
    callback: (event: IpcRendererEvent, data: { id: string }) => void,
  ) => {
    queueTaskCompletedCallback = callback;
    ipcRenderer.on(IPC_CHANNELS.QUEUE_TASK_COMPLETED, callback);
  },
  removeQueueTaskCompletedListener: () => {
    if (queueTaskCompletedCallback) {
      ipcRenderer.removeListener(
        IPC_CHANNELS.QUEUE_TASK_COMPLETED,
        queueTaskCompletedCallback,
      );
      queueTaskCompletedCallback = null;
    }
  },
  onQueueTaskFailed: (
    callback: (
      event: IpcRendererEvent,
      data: { id: string; error: string },
    ) => void,
  ) => {
    queueTaskFailedCallback = callback;
    ipcRenderer.on(IPC_CHANNELS.QUEUE_TASK_FAILED, callback);
  },
  removeQueueTaskFailedListener: () => {
    if (queueTaskFailedCallback) {
      ipcRenderer.removeListener(
        IPC_CHANNELS.QUEUE_TASK_FAILED,
        queueTaskFailedCallback,
      );
      queueTaskFailedCallback = null;
    }
  },
  onQueueStatusChanged: (
    callback: (event: IpcRendererEvent, data: { isActive: boolean }) => void,
  ) => {
    queueStatusChangedCallback = callback;
    ipcRenderer.on(IPC_CHANNELS.QUEUE_STATUS_CHANGED, callback);
  },
  removeQueueStatusChangedListener: () => {
    if (queueStatusChangedCallback) {
      ipcRenderer.removeListener(
        IPC_CHANNELS.QUEUE_STATUS_CHANGED,
        queueStatusChangedCallback,
      );
      queueStatusChangedCallback = null;
    }
  },

  // Menu integration
  updateMenuSelection: (hasSelection: boolean, isSingleFile: boolean) => {
    ipcRenderer.send(
      IPC_CHANNELS.UPDATE_MENU_SELECTION,
      hasSelection,
      isSingleFile,
    );
  },
  onMenuAction: (
    callback: (event: IpcRendererEvent, action: string) => void,
  ) => {
    menuActionCallback = callback;
    ipcRenderer.on(IPC_CHANNELS.MENU_ACTION, callback);
  },
  removeMenuActionListener: () => {
    if (menuActionCallback) {
      ipcRenderer.removeListener(IPC_CHANNELS.MENU_ACTION, menuActionCallback);
      menuActionCallback = null;
    }
  },
};

contextBridge.exposeInMainWorld('electron', api);

// Extend the Window interface for TypeScript
declare global {
  interface Window {
    electron: ArchivistApi;
  }
}
