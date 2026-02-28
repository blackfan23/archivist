/**
 * Shared IPC channel names for communication between Electron main and renderer processes.
 * This file should have NO dependencies to ensure it can be safely imported
 * in preload scripts without dragging in heavy libs like valibot.
 */
export enum IPC_CHANNELS {
  // App info
  GET_APP_VERSION = 'get-app-version',
  APP_READY = 'app:ready',

  // Directory selection
  SELECT_DIRECTORY = 'select-directory',
  SELECT_DESTINATION = 'select-destination',
  SELECT_SUBTITLE_FILE = 'select-subtitle-file',

  // Scanning
  SCAN_DIRECTORY = 'scan-directory',
  CANCEL_SCAN = 'cancel-scan',
  SCAN_DIRECTORY_AI = 'scan-directory-ai',
  CANCEL_SCAN_AI = 'cancel-scan-ai',
  SCAN_PROGRESS = 'scan-progress',

  // Storage Cleaner
  CLEANER_SCAN = 'cleaner:scan',
  CLEANER_CANCEL = 'cleaner:cancel',

  // Library data
  GET_LIBRARY = 'get-library',
  GET_STORAGE_DATA = 'get-storage-data',
  GET_LAST_SCAN_PATH = 'get-last-scan-path',
  CLEAR_LIBRARY = 'clear-library',
  GET_MEDIA_FILE_BY_ID = 'get-media-file-by-id',

  // Filters
  SAVE_FILTERS = 'save-filters',

  // Settings & Maintenance
  GET_SETTINGS = 'get-settings',
  SAVE_SETTINGS = 'save-settings',
  MAINTENANCE_FULL_RESET = 'maintenance:full-reset',
  MAINTENANCE_RESET_AI_CACHE = 'maintenance:reset-ai-cache',

  // AI Operations
  AI_GET_SETTINGS = 'ai:get-settings',
  AI_SAVE_SETTINGS = 'ai:save-settings',
  AI_GENERATE = 'ai:generate',
  AI_TEST_CONNECTION = 'ai:test-connection',
  AI_LIST_OLLAMA_MODELS = 'ai:list-ollama-models',
  AI_PULL_OLLAMA_MODEL = 'ai:pull-ollama-model',

  // AI Analysis (streaming)
  ANALYZE_FILE = 'analyze-file',
  RUN_ANALYSIS = 'run-analysis',
  APPLY_FIX = 'apply-fix',
  ANALYSIS_MARK_CLEAN = 'analysis:mark-clean',
  ANALYSIS_LOAD_OPTIMIZATION_STATE = 'analysis:load-optimization-state',
  ANALYSIS_CANCEL = 'analysis:cancel',
  ANALYSIS_RESULT = 'analysis:result',

  // File operations
  RENAME_FILE = 'rename-file',
  MOVE_FILE = 'move-file',
  BATCH_RENAME = 'batch-rename',
  BATCH_MOVE = 'batch-move',
  DELETE_FILES = 'delete-files',
  SHOW_IN_FINDER = 'show-in-finder',
  RENAME_FOLDER = 'rename-folder',
  DELETE_EMPTY_FOLDERS = 'delete-empty-folders',
  IS_DIRECTORY_EMPTY = 'is-directory-empty',

  // VLC integration
  VLC_CHECK_INSTALLED = 'vlc:check-installed',
  VLC_PLAY = 'vlc:play',

  // Ratings & Metadata
  FETCH_RATINGS = 'fetch-ratings',
  REQUERY_RATING = 'requery-rating',
  SEARCH_TMDB = 'search-tmdb',
  GET_TV_EPISODE = 'get-tv-episode',
  MATCH_FILE = 'match-file',
  WRITE_METADATA = 'write-metadata',
  VALIDATE_TMDB_KEY = 'validate-tmdb-key',
  VALIDATE_OMDB_KEY = 'validate-omdb-key',
  VALIDATE_KEYS = 'validate-keys',

  // Error handling
  GET_ERROR_LOG = 'get-error-log',
  CLEAR_ERROR_LOG = 'clear-error-log',
  BACKEND_ERROR = 'backend-error',

  // FFmpeg Editor
  CONVERT_CONTAINER = 'convert-container',
  TRANSCODE_VIDEO = 'transcode-video',
  TRANSCODE_AUDIO = 'transcode-audio',
  EXTRACT_SUBTITLE = 'extract-subtitle',
  ADD_SUBTITLE = 'add-subtitle',
  REMOVE_SUBTITLE = 'remove-subtitle',
  SET_DEFAULT_SUBTITLE = 'set-default-subtitle',
  RUN_CUSTOM_COMMAND = 'run-custom-command',
  GET_COMMAND_HISTORY = 'get-command-history',
  EDITOR_PROGRESS = 'editor-progress',

  // Queue
  QUEUE_ADD = 'queue:add',
  QUEUE_REMOVE = 'queue:remove',
  QUEUE_LIST = 'queue:list',
  QUEUE_CLEAR = 'queue:clear',
  QUEUE_PAUSE = 'queue:pause',
  QUEUE_RESUME = 'queue:resume',
  QUEUE_IS_ACTIVE = 'queue:is-active',
  QUEUE_TASK_STARTED = 'queue:task-started',
  QUEUE_TASK_COMPLETED = 'queue:task-completed',
  QUEUE_TASK_FAILED = 'queue:task-failed',
  QUEUE_STATUS_CHANGED = 'queue:status-changed',

  // Menu & UI Integration
  UPDATE_MENU_SELECTION = 'update-menu-selection',
  MENU_ACTION = 'menu-action',

  PRELOAD_LOG = 'preload:log',
}
