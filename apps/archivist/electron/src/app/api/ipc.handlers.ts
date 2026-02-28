import {
  AISettings,
  AnalysisResult,
  AppSettings,
  AudioTranscodeOptions,
  ContainerFormat,
  FilterState,
  GenerateRequest,
  IPC_CHANNELS,
  LightweightFile,
  MediaFile,
  OmdbRating,
  SubtitleFormat,
  TmdbEpisodeDetails,
  TmdbMatchResult,
  TmdbRating,
  VideoTranscodeOptions,
} from '@medularity/archivist-core';
import { BrowserWindow, dialog, ipcMain, shell } from 'electron';
import * as path from 'path';
import { AIService } from '../services/ai.service';
import { AnalysisService } from '../services/analysis.service';
import {
  requestCancelCleanerScan,
  scanForCleanup,
} from '../services/cleaner-scanner.service';
import { DatabaseService } from '../services/database.service';
import { ErrorService } from '../services/error.service';
import {
  addSubtitle,
  convertContainer,
  extractSubtitle,
  removeSubtitle,
  runCustomCommand,
  setDefaultSubtitle,
  transcodeAudio,
  transcodeVideo,
} from '../services/ffmpeg-editor.service';
import {
  embedMetadata,
  generateFilename,
  generateFolderName,
  MediaMetadata,
} from '../services/ffmpeg-metadata.service';
import {
  batchDelete,
  batchMove,
  batchRename,
  moveFile,
  renameFileWithSubtitles,
  renameFolder,
} from '../services/file-operations.service';
import {
  requestCancelLightweightScan,
  scanDirectoryLightweight,
} from '../services/lightweight-scanner.service';
import { OmdbService } from '../services/omdb.service';
import { OptimizationStateService } from '../services/optimization-state.service';
import { QueueProcessor } from '../services/queue.processor';
import { QueueService } from '../services/queue.service';
import { requestCancelScan, scanDirectory } from '../services/scanner.service';
import { StartupService } from '../services/startup.service';
import {
  clearLibrary,
  getAISettings,
  getCommandHistory,
  getLastScanPath,
  getMediaLibrary,
  getRatingsCache,
  getSettings,
  getStorageData,
  removeFilesFromLibrary,
  resolveOllamaModel,
  saveAISettings,
  saveCommandToHistory,
  saveFilters,
  saveMediaLibrary,
  saveRatingsCache,
  saveSettings,
  setLastScanPath,
} from '../services/storage.service';
import { TmdbService } from '../services/tmdb.service';
import { VlcService } from '../services/vlc.service';

/**
 * Wrapper for IPC handlers that provides automatic error catching and logging.
 * All errors are logged via ErrorService (which emits to frontend) and then re-thrown
 * so the frontend's Promise also rejects properly.
 */
function safeHandle<T>(
  channel: string,
  handler: (
    event: Electron.IpcMainInvokeEvent,
    ...args: unknown[]
  ) => Promise<T> | T,
): void {
  ipcMain.handle(channel, async (event, ...args) => {
    try {
      return await handler(event, ...args);
    } catch (error) {
      ErrorService.logError(channel, error);
      throw error;
    }
  });
}

let handlersRegistered = false;

export function registerIpcHandlers(mainWindow: BrowserWindow): void {
  if (handlersRegistered) return;
  handlersRegistered = true;
  console.log('[IPC] Registering IPC handlers...');

  // Initialize services
  ErrorService.setMainWindow(mainWindow);
  StartupService.init();

  // --- Directory Selection ---
  safeHandle(IPC_CHANNELS.SELECT_DIRECTORY, async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: 'Select Media Library Folder',
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0];
  });

  // --- Scanning ---
  safeHandle(
    IPC_CHANNELS.SCAN_DIRECTORY,
    async (_event, directoryPath: unknown, forceFullScan: unknown = false) => {
      if (!directoryPath || typeof directoryPath !== 'string') {
        throw new Error('Directory path is required');
      }

      await setLastScanPath(directoryPath);

      // Load existing library for incremental scanning (unless forcing full scan)
      let existingFiles:
        | Map<string, { scannedAt: number; mediaFile: MediaFile }>
        | undefined;

      if (!forceFullScan) {
        const existingLibrary = await getMediaLibrary();
        existingFiles = new Map(
          existingLibrary.map((file) => [
            file.path,
            { scannedAt: file.scannedAt, mediaFile: file },
          ]),
        );
      }

      const files = await scanDirectory(directoryPath, {
        maxConcurrency: 4,
        window: mainWindow,
        existingFiles,
      });

      await saveMediaLibrary(files);
      return files;
    },
  );

  safeHandle(IPC_CHANNELS.CANCEL_SCAN, () => {
    requestCancelScan();
    return true;
  });

  // --- AI Lightweight Scanning (no ffprobe) ---
  safeHandle(
    IPC_CHANNELS.SCAN_DIRECTORY_AI,
    async (_event, directoryPath: unknown) => {
      if (!directoryPath || typeof directoryPath !== 'string') {
        throw new Error('Directory path is required');
      }
      await setLastScanPath(directoryPath);
      return scanDirectoryLightweight(directoryPath);
    },
  );

  safeHandle(IPC_CHANNELS.CANCEL_SCAN_AI, () => {
    requestCancelLightweightScan();
    return true;
  });

  // --- Storage Cleaner ---
  safeHandle(
    IPC_CHANNELS.CLEANER_SCAN,
    async (_event, directoryPath: unknown) => {
      if (!directoryPath || typeof directoryPath !== 'string') {
        throw new Error('Directory path is required');
      }
      return scanForCleanup(directoryPath);
    },
  );

  safeHandle(IPC_CHANNELS.CLEANER_CANCEL, () => {
    requestCancelCleanerScan();
    return true;
  });

  // --- Library Data ---
  safeHandle(IPC_CHANNELS.GET_LIBRARY, async () => {
    return getMediaLibrary();
  });

  safeHandle(IPC_CHANNELS.GET_STORAGE_DATA, async () => {
    return getStorageData();
  });

  safeHandle(IPC_CHANNELS.GET_LAST_SCAN_PATH, async () => {
    return getLastScanPath();
  });

  safeHandle(IPC_CHANNELS.CLEAR_LIBRARY, async () => {
    await clearLibrary();
    return true;
  });

  // --- Filters ---
  safeHandle(IPC_CHANNELS.SAVE_FILTERS, async (_event, filters: unknown) => {
    await saveFilters(filters as FilterState);
    return true;
  });

  // --- Settings ---
  safeHandle(IPC_CHANNELS.GET_SETTINGS, async () => {
    return getSettings();
  });

  safeHandle(IPC_CHANNELS.SAVE_SETTINGS, async (_event, settings: unknown) => {
    await saveSettings(settings as AppSettings);
    return true;
  });

  // --- AI Operations ---
  safeHandle(IPC_CHANNELS.AI_GET_SETTINGS, async () => {
    const settings = await getAISettings();
    return resolveOllamaModel(settings);
  });

  safeHandle(
    IPC_CHANNELS.AI_SAVE_SETTINGS,
    async (_event, settings: unknown) => {
      await saveAISettings(settings as AISettings);
      return true;
    },
  );

  safeHandle(IPC_CHANNELS.AI_GENERATE, async (_event, request: unknown) => {
    const settings = await getAISettings();
    return AIService.generate(settings, request as GenerateRequest);
  });

  safeHandle(
    IPC_CHANNELS.AI_TEST_CONNECTION,
    async (_event, settings: unknown) => {
      console.log(
        '[IPC] ai:test-connection called with settings:',
        JSON.stringify(settings, null, 2),
      );
      const aiSettings = settings
        ? (settings as AISettings)
        : await getAISettings();
      console.log(
        '[IPC] Using AI Settings for test:',
        JSON.stringify(aiSettings, null, 2),
      );
      return AIService.testConnection(aiSettings);
    },
  );

  safeHandle(
    IPC_CHANNELS.AI_LIST_OLLAMA_MODELS,
    async (_event, ollamaUrl: unknown) => {
      return AIService.listOllamaModels(ollamaUrl as string);
    },
  );

  safeHandle(
    IPC_CHANNELS.AI_PULL_OLLAMA_MODEL,
    async (_event, ollamaUrl: unknown, model: unknown) => {
      return AIService.pullOllamaModel(ollamaUrl as string, model as string);
    },
  );

  // --- File Operations ---
  safeHandle(
    IPC_CHANNELS.RENAME_FILE,
    async (_event, oldPath: unknown, newPath: unknown) => {
      await renameFileWithSubtitles(oldPath as string, newPath as string);
      return true;
    },
  );

  safeHandle(
    IPC_CHANNELS.MOVE_FILE,
    async (_event, sourcePath: unknown, destDir: unknown) => {
      const newPath = await moveFile(sourcePath as string, destDir as string);
      return newPath;
    },
  );

  safeHandle(IPC_CHANNELS.BATCH_RENAME, async (_event, files: unknown) => {
    return batchRename(files as Array<{ oldPath: string; newPath: string }>);
  });

  safeHandle(
    IPC_CHANNELS.BATCH_MOVE,
    async (_event, sourcePaths: unknown, destDir: unknown) => {
      return batchMove(sourcePaths as string[], destDir as string);
    },
  );

  safeHandle(
    IPC_CHANNELS.DELETE_FILES,
    async (_event, filePaths: unknown, deleteParentFolders: unknown) => {
      const paths = filePaths as string[];
      const result = await batchDelete(paths, deleteParentFolders as boolean);

      // Remove successfully deleted files from storage
      if (result.successCount > 0) {
        const deletedPaths = paths.filter(
          (p) => !result.errors.some((e) => e.path === p),
        );
        await removeFilesFromLibrary(deletedPaths);
      }

      return result;
    },
  );

  safeHandle(IPC_CHANNELS.SHOW_IN_FINDER, async (_event, filePath: unknown) => {
    shell.showItemInFolder(filePath as string);
  });

  safeHandle(
    IPC_CHANNELS.VLC_CHECK_INSTALLED,
    async (_event, customPath: unknown) => {
      return VlcService.isInstalled(customPath as string | undefined);
    },
  );

  safeHandle(
    IPC_CHANNELS.VLC_PLAY,
    async (_event, filePath: unknown, customPath: unknown) => {
      return VlcService.play(
        filePath as string,
        customPath as string | undefined,
      );
    },
  );

  safeHandle(
    IPC_CHANNELS.RENAME_FOLDER,
    async (_event, oldPath: unknown, newPath: unknown) => {
      await renameFolder(oldPath as string, newPath as string);
      return true;
    },
  );

  safeHandle(
    IPC_CHANNELS.DELETE_EMPTY_FOLDERS,
    async (_event, folderPaths: unknown) => {
      const paths = folderPaths as string[];
      // Try to delete each folder - they should be empty after file deletion
      for (const folderPath of paths) {
        try {
          await import('fs/promises').then((fs) => fs.rmdir(folderPath));
        } catch {
          // Folder might not be empty or other error - silently continue
        }
      }
    },
  );

  safeHandle(
    IPC_CHANNELS.IS_DIRECTORY_EMPTY,
    async (_event, folderPath: unknown) => {
      try {
        const fs = await import('fs/promises');
        const entries = await fs.readdir(folderPath as string);
        return entries.length === 0;
      } catch {
        return false;
      }
    },
  );

  // --- Select Destination Directory ---
  safeHandle(IPC_CHANNELS.SELECT_DESTINATION, async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory', 'createDirectory'],
      title: 'Select Destination Folder',
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0];
  });

  // --- Select Subtitle File ---
  safeHandle(IPC_CHANNELS.SELECT_SUBTITLE_FILE, async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      title: 'Select Subtitle File',
      filters: [
        {
          name: 'Subtitle Files',
          extensions: ['srt', 'ass', 'ssa', 'vtt', 'sub'],
        },
        { name: 'All Files', extensions: ['*'] },
      ],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0];
  });

  // --- Ratings (OMDB or TMDB) ---
  safeHandle(IPC_CHANNELS.FETCH_RATINGS, async (_event, items: unknown) => {
    const ratingItems = items as Array<{ title: string; year?: string }>;
    const settings = await getSettings();
    const provider = settings.ratingProvider || 'omdb';
    const apiKey =
      provider === 'tmdb' ? settings.tmdbApiKey : settings.omdbApiKey;

    if (!apiKey) {
      return {};
    }

    const cache = await getRatingsCache();
    const now = Date.now();
    const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days
    const RATE_LIMIT_DELAY = 50; // ~20 req/s, conservative for TMDB's 40 req/s limit

    // Use provider prefix in cache key to avoid conflicts
    const results: Record<string, OmdbRating | TmdbRating> = {};
    let cacheUpdated = false;

    for (const item of ratingItems) {
      const cacheKey = `${provider}:${item.title}-${item.year || ''}`;
      const cached = cache[cacheKey];

      // Check if we have a valid cached entry (including notFound entries)
      if (cached && now - cached.fetchedAt < CACHE_DURATION) {
        results[cacheKey] = cached;
        continue;
      }

      // Rate limiting: wait between API calls
      await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_DELAY));

      // Fetch from API based on provider
      let rating: OmdbRating | TmdbRating | null = null;

      if (provider === 'tmdb') {
        rating = await TmdbService.fetchRating(item.title, apiKey, item.year);
      } else {
        rating = await OmdbService.fetchRating(item.title, apiKey, item.year);
      }

      if (rating) {
        cache[cacheKey] = rating as OmdbRating;
        results[cacheKey] = rating;
        cacheUpdated = true;
      } else {
        // Movie not found - create a placeholder entry to avoid re-querying
        const notFoundEntry: OmdbRating = {
          imdbID: '',
          Title: item.title,
          Year: item.year || '',
          Rated: '',
          Released: '',
          Runtime: '',
          Genre: '',
          Director: '',
          Writer: '',
          Actors: '',
          Plot: '',
          Language: '',
          Country: '',
          Awards: '',
          Poster: '',
          Ratings: [],
          Metascore: '',
          imdbRating: '',
          imdbVotes: '',
          Type: '',
          DVD: '',
          BoxOffice: '',
          Production: '',
          Website: '',
          Response: 'False',
          fetchedAt: now,
          notFound: true,
          searchedTitle: item.title,
        };
        cache[cacheKey] = notFoundEntry;
        results[cacheKey] = notFoundEntry;
        cacheUpdated = true;
      }
    }

    if (cacheUpdated) {
      await saveRatingsCache(cache);
    }

    return results;
  });

  // --- Requery single rating (force refresh) ---
  safeHandle(IPC_CHANNELS.REQUERY_RATING, async (_event, item: unknown) => {
    const ratingItem = item as { title: string; year?: string };
    const settings = await getSettings();
    const provider = settings.ratingProvider || 'omdb';
    const apiKey =
      provider === 'tmdb' ? settings.tmdbApiKey : settings.omdbApiKey;

    if (!apiKey) {
      return null;
    }

    const cache = await getRatingsCache();
    const cacheKey = `${provider}:${ratingItem.title}-${ratingItem.year || ''}`;

    // Remove from cache
    delete cache[cacheKey];

    // Fetch fresh data from API
    let rating: OmdbRating | TmdbRating | null = null;

    if (provider === 'tmdb') {
      rating = await TmdbService.fetchRating(
        ratingItem.title,
        apiKey,
        ratingItem.year,
      );
    } else {
      rating = await OmdbService.fetchRating(
        ratingItem.title,
        apiKey,
        ratingItem.year,
      );
    }

    if (rating) {
      cache[cacheKey] = rating as OmdbRating;
      await saveRatingsCache(cache);
      return rating;
    } else {
      // Movie not found - create a placeholder entry
      const notFoundEntry: OmdbRating = {
        imdbID: '',
        Title: ratingItem.title,
        Year: ratingItem.year || '',
        Rated: '',
        Released: '',
        Runtime: '',
        Genre: '',
        Director: '',
        Writer: '',
        Actors: '',
        Plot: '',
        Language: '',
        Country: '',
        Awards: '',
        Poster: '',
        Ratings: [],
        Metascore: '',
        imdbRating: '',
        imdbVotes: '',
        Type: '',
        DVD: '',
        BoxOffice: '',
        Production: '',
        Website: '',
        Response: 'False',
        fetchedAt: Date.now(),
        notFound: true,
        searchedTitle: ratingItem.title,
      };
      cache[cacheKey] = notFoundEntry;
      await saveRatingsCache(cache);
      return notFoundEntry;
    }
  });

  // --- TMDB Search (multi-search for movies and TV shows) ---
  safeHandle<TmdbMatchResult[]>(
    IPC_CHANNELS.SEARCH_TMDB,
    async (_event, query: unknown) => {
      const settings = await getSettings();
      const apiKey = settings.tmdbApiKey;

      if (!apiKey) {
        return [];
      }

      return TmdbService.searchMulti(query as string, apiKey);
    },
  );

  // --- Get TV Episode Details ---
  safeHandle<TmdbEpisodeDetails | null>(
    IPC_CHANNELS.GET_TV_EPISODE,
    async (_event, tvId: unknown, season: unknown, episode: unknown) => {
      const settings = await getSettings();
      const apiKey = settings.tmdbApiKey;

      if (!apiKey) {
        return null;
      }

      return TmdbService.getTvEpisode(
        tvId as number,
        season as number,
        episode as number,
        apiKey,
      );
    },
  );

  // --- Match File to TMDB (rename and optionally embed metadata) ---
  ipcMain.handle(
    IPC_CHANNELS.MATCH_FILE,
    async (
      _event,
      filePath: string,
      metadata: MediaMetadata,
      shouldEmbedMetadata: boolean,
    ): Promise<{ newPath: string; success: boolean; error?: string }> => {
      try {
        // Optionally embed metadata first (before any renames)
        if (shouldEmbedMetadata) {
          await embedMetadata(filePath, metadata);
        }

        let currentPath = filePath;

        // Rename containing folder first
        const currentDir = path.dirname(currentPath);
        const parentDir = path.dirname(currentDir);
        const currentFolderName = path.basename(currentDir);
        const newFolderName = generateFolderName(metadata);

        if (newFolderName !== currentFolderName) {
          const newFolderPath = path.join(parentDir, newFolderName);
          await renameFolder(currentDir, newFolderPath);

          // Update file path to reflect new folder location
          const filename = path.basename(currentPath);
          currentPath = path.join(newFolderPath, filename);

          // Update all files in library that were in the old folder
          const library = await getMediaLibrary();
          let libraryChanged = false;
          for (const file of library) {
            if (path.dirname(file.path) === currentDir) {
              file.path = path.join(newFolderPath, path.basename(file.path));
              libraryChanged = true;
            }
          }
          if (libraryChanged) {
            await saveMediaLibrary(library);
          }
        }

        // Generate new filename (in potentially new folder)
        const newPath = generateFilename(currentPath, metadata);

        // Rename file if needed
        if (newPath !== currentPath) {
          await renameFileWithSubtitles(currentPath, newPath);

          // Update library storage for this specific file
          const library = await getMediaLibrary();
          const fileIndex = library.findIndex((f) => f.path === currentPath);
          if (fileIndex !== -1) {
            library[fileIndex].path = newPath;
            library[fileIndex].filename = path.basename(newPath);
            await saveMediaLibrary(library);
          }
        }

        return { newPath, success: true };
      } catch (error) {
        ErrorService.logError('match-file', error, filePath);
        return {
          newPath: filePath,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  );

  // --- Write Metadata (embed metadata without renaming) ---
  ipcMain.handle(
    IPC_CHANNELS.WRITE_METADATA,
    async (
      _event,
      filePath: string,
      metadata: MediaMetadata,
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        await embedMetadata(filePath, metadata);
        return { success: true };
      } catch (error) {
        ErrorService.logError('write-metadata', error, filePath);
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  );

  // --- Error Log ---
  safeHandle(IPC_CHANNELS.GET_ERROR_LOG, () => {
    return ErrorService.getErrors();
  });

  safeHandle(IPC_CHANNELS.CLEAR_ERROR_LOG, () => {
    ErrorService.clearErrors();
    return true;
  });

  // --- API Key Validation ---
  safeHandle<{ valid: boolean; error?: string }>(
    IPC_CHANNELS.VALIDATE_TMDB_KEY,
    async (_event, apiKey: unknown) => {
      return TmdbService.validateApiKey(apiKey as string);
    },
  );

  safeHandle<{ valid: boolean; error?: string }>(
    IPC_CHANNELS.VALIDATE_OMDB_KEY,
    async (_event, apiKey: unknown) => {
      return OmdbService.validateApiKey(apiKey as string);
    },
  );

  // --- FFmpeg Editor Operations ---

  // Get media file by ID for editor
  safeHandle(IPC_CHANNELS.GET_MEDIA_FILE_BY_ID, async (_event, id: unknown) => {
    const library = await getMediaLibrary();
    return library.find((f) => f.id === (id as string)) || null;
  });

  // Container conversion
  safeHandle(
    IPC_CHANNELS.CONVERT_CONTAINER,
    async (_event, filePath: unknown, format: unknown, duration: unknown) => {
      return await convertContainer(
        filePath as string,
        format as ContainerFormat,
        mainWindow,
        duration as number | undefined,
      );
    },
  );

  // Video transcoding
  safeHandle(
    IPC_CHANNELS.TRANSCODE_VIDEO,
    async (_event, filePath: unknown, options: unknown, duration: unknown) => {
      return await transcodeVideo(
        filePath as string,
        options as VideoTranscodeOptions,
        mainWindow,
        duration as number | undefined,
      );
    },
  );

  // Audio transcoding
  safeHandle(
    IPC_CHANNELS.TRANSCODE_AUDIO,
    async (_event, filePath: unknown, options: unknown, duration: unknown) => {
      return await transcodeAudio(
        filePath as string,
        options as AudioTranscodeOptions,
        mainWindow,
        duration as number | undefined,
      );
    },
  );

  // Extract subtitle
  safeHandle(
    IPC_CHANNELS.EXTRACT_SUBTITLE,
    async (
      _event,
      filePath: unknown,
      trackIndex: unknown,
      format: unknown,
      outputPath: unknown,
    ) => {
      return await extractSubtitle(
        filePath as string,
        trackIndex as number,
        format as SubtitleFormat,
        outputPath as string | undefined,
      );
    },
  );

  // Add subtitle
  safeHandle(
    IPC_CHANNELS.ADD_SUBTITLE,
    async (
      _event,
      filePath: unknown,
      subtitlePath: unknown,
      language: unknown,
      duration: unknown,
    ) => {
      return await addSubtitle(
        filePath as string,
        subtitlePath as string,
        language as string | undefined,
        mainWindow,
        duration as number | undefined,
      );
    },
  );

  // Remove subtitle
  safeHandle(
    IPC_CHANNELS.REMOVE_SUBTITLE,
    async (
      _event,
      filePath: unknown,
      trackIndex: unknown,
      duration: unknown,
    ) => {
      return await removeSubtitle(
        filePath as string,
        trackIndex as number,
        mainWindow,
        duration as number | undefined,
      );
    },
  );

  // Set default subtitle
  safeHandle(
    IPC_CHANNELS.SET_DEFAULT_SUBTITLE,
    async (
      _event,
      filePath: unknown,
      trackIndex: unknown,
      duration: unknown,
    ) => {
      return await setDefaultSubtitle(
        filePath as string,
        trackIndex as number,
        mainWindow,
        duration as number | undefined,
      );
    },
  );

  // Run custom FFmpeg command
  safeHandle(
    IPC_CHANNELS.RUN_CUSTOM_COMMAND,
    async (_event, command: unknown) => {
      // Save to history
      await saveCommandToHistory(command as string);
      return await runCustomCommand(command as string, mainWindow);
    },
  );

  // Get command history
  safeHandle(IPC_CHANNELS.GET_COMMAND_HISTORY, async () => {
    return getCommandHistory();
  });

  // --- Analysis ---
  safeHandle<AnalysisResult>(
    IPC_CHANNELS.ANALYZE_FILE,
    async (_event, filePath: unknown) => {
      return AnalysisService.analyzeFile(filePath as LightweightFile);
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.RUN_ANALYSIS,
    async (event, files: unknown, filter?: 'both' | 'movie' | 'tv') => {
      // Validate array
      if (!Array.isArray(files)) {
        throw new Error('Invalid arguments: files must be an array');
      }

      const safeFilter = filter || 'both';

      return AnalysisService.runAnalysis(
        files as LightweightFile[],
        safeFilter,
        (result) => {
          // Send progress updates back to the renderer during analysis
          const window = BrowserWindow.getAllWindows()[0];
          if (window) {
            window.webContents.send(IPC_CHANNELS.ANALYSIS_RESULT, result);
          }
        },
      );
    },
  );

  safeHandle<string | null>(
    IPC_CHANNELS.APPLY_FIX,
    async (_event, result: unknown) => {
      return AnalysisService.applyFix(result as AnalysisResult);
    },
  );

  safeHandle<void>(
    IPC_CHANNELS.ANALYSIS_MARK_CLEAN,
    async (_event, filePath: unknown) => {
      await AnalysisService.markAsClean(filePath as string);
    },
  );

  safeHandle<boolean>(IPC_CHANNELS.ANALYSIS_CANCEL, async () => {
    AnalysisService.requestCancelAnalysis();
    return true;
  });

  safeHandle<AnalysisResult[]>(
    IPC_CHANNELS.ANALYSIS_LOAD_OPTIMIZATION_STATE,
    async (_event, rootPath: unknown) => {
      return AnalysisService.loadCachedResults(rootPath as string);
    },
  );

  // --- Maintenance ---
  safeHandle<boolean>(IPC_CHANNELS.MAINTENANCE_FULL_RESET, async () => {
    // 1. Clear the library (SQLite + simple storage)
    await clearLibrary();

    // 2. Clear legacy sidecars if we have a last scan path
    const lastPath = await getLastScanPath();
    if (lastPath) {
      await OptimizationStateService.resetAll(lastPath);
    }
    return true;
  });

  safeHandle<number>(IPC_CHANNELS.MAINTENANCE_RESET_AI_CACHE, async () => {
    // Clear only AI state in SQLite
    DatabaseService.clearAIState();

    // Also clean up legacy sidecars if possible
    const lastPath = await getLastScanPath();
    if (lastPath) {
      return await OptimizationStateService.resetAll(lastPath);
    }
    return 0;
  });

  // --- Queue ---
  safeHandle(
    IPC_CHANNELS.QUEUE_ADD,
    async (_event, type: unknown, payload: unknown) => {
      return QueueService.addTask(type as string, payload);
    },
  );

  safeHandle(IPC_CHANNELS.QUEUE_REMOVE, async (_event, id: unknown) => {
    QueueService.removeTask(id as string);
  });

  safeHandle(IPC_CHANNELS.QUEUE_LIST, async () => {
    return QueueService.getTasks();
  });

  safeHandle(IPC_CHANNELS.QUEUE_CLEAR, async () => {
    QueueService.clearFinishedTasks();
  });

  safeHandle(IPC_CHANNELS.QUEUE_PAUSE, async () => {
    QueueProcessor.stop();
  });

  safeHandle(IPC_CHANNELS.QUEUE_RESUME, async () => {
    QueueProcessor.start();
  });

  safeHandle(IPC_CHANNELS.QUEUE_IS_ACTIVE, async () => {
    return QueueProcessor.internalState.isActive;
  });

  // --- Initialize Background Engine ---
  QueueProcessor.setMainWindow(mainWindow);
  // QueueProcessor.start() is intentionally omitted so the queue starts paused.
  console.log('[IPC] IPC handlers registered successfully.');
}
