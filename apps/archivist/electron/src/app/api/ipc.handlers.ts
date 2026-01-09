import { BrowserWindow, dialog, ipcMain, shell } from 'electron';
import * as path from 'path';
import { AppSettings, FilterState, MediaFile, OmdbRating } from '../models';
import { ErrorService } from '../services/error.service';
import {
  addSubtitle,
  AudioTranscodeOptions,
  ContainerFormat,
  convertContainer,
  extractSubtitle,
  removeSubtitle,
  runCustomCommand,
  setDefaultSubtitle,
  SubtitleFormat,
  transcodeAudio,
  transcodeVideo,
  VideoTranscodeOptions,
} from '../services/ffmpeg-editor.service';
import { embedMetadata, generateFilename, generateFolderName, MediaMetadata } from '../services/ffmpeg-metadata.service';
import {
  batchDelete,
  batchMove,
  batchRename,
  moveFile,
  renameFileWithSubtitles,
  renameFolder
} from '../services/file-operations.service';
import { OmdbService } from '../services/omdb.service';
import { requestCancelScan, scanDirectory } from '../services/scanner.service';
import {
  clearLibrary,
  getCommandHistory,
  getLastScanPath,
  getMediaLibrary,
  getRatingsCache,
  getSettings,
  getStorageData,
  removeFilesFromLibrary,
  saveCommandToHistory,
  saveFilters,
  saveMediaLibrary,
  saveRatingsCache,
  saveSettings,
  setLastScanPath,
} from '../services/storage.service';
import { TmdbEpisodeDetails, TmdbMatchResult, TmdbRating, TmdbService } from '../services/tmdb.service';

/**
 * Wrapper for IPC handlers that provides automatic error catching and logging.
 * All errors are logged via ErrorService (which emits to frontend) and then re-thrown
 * so the frontend's Promise also rejects properly.
 */
function safeHandle<T>(
  channel: string,
  handler: (event: Electron.IpcMainInvokeEvent, ...args: unknown[]) => Promise<T> | T
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

export function registerIpcHandlers(mainWindow: BrowserWindow): void {
  // Initialize error service with main window
  ErrorService.setMainWindow(mainWindow);
  
  // --- Directory Selection ---
  safeHandle('select-directory', async () => {
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
  safeHandle('scan-directory', async (_event, directoryPath: unknown, forceFullScan: unknown = false) => {
    if (!directoryPath || typeof directoryPath !== 'string') {
      throw new Error('Directory path is required');
    }
    
    await setLastScanPath(directoryPath);
    
    // Load existing library for incremental scanning (unless forcing full scan)
    let existingFiles: Map<string, { scannedAt: number; mediaFile: MediaFile }> | undefined;
    
    if (!forceFullScan) {
      const existingLibrary = await getMediaLibrary();
      existingFiles = new Map(
        existingLibrary.map(file => [
          file.path,
          { scannedAt: file.scannedAt, mediaFile: file }
        ])
      );
    }
    
    const files = await scanDirectory(directoryPath, {
      maxConcurrency: 4,
      window: mainWindow,
      existingFiles,
    });
    
    await saveMediaLibrary(files);
    return files;
  });
  
  safeHandle('cancel-scan', () => {
    requestCancelScan();
    return true;
  });
  
  // --- Library Data ---
  safeHandle('get-library', async () => {
    return getMediaLibrary();
  });
  
  safeHandle('get-storage-data', async () => {
    return getStorageData();
  });
  
  safeHandle('get-last-scan-path', async () => {
    return getLastScanPath();
  });
  
  safeHandle('clear-library', async () => {
    await clearLibrary();
    return true;
  });
  
  // --- Filters ---
  safeHandle('save-filters', async (_event, filters: unknown) => {
    await saveFilters(filters as FilterState);
    return true;
  });
  
  // --- Settings ---
  safeHandle('get-settings', async () => {
    return getSettings();
  });
  
  safeHandle('save-settings', async (_event, settings: unknown) => {
    await saveSettings(settings as AppSettings);
    return true;
  });
  
  // --- File Operations ---
  safeHandle('rename-file', async (_event, oldPath: unknown, newPath: unknown) => {
    await renameFileWithSubtitles(oldPath as string, newPath as string);
    return true;
  });
  
  safeHandle('move-file', async (_event, sourcePath: unknown, destDir: unknown) => {
    const newPath = await moveFile(sourcePath as string, destDir as string);
    return newPath;
  });
  
  safeHandle('batch-rename', async (_event, files: unknown) => {
    return batchRename(files as Array<{ oldPath: string; newPath: string }>);
  });
  
  safeHandle('batch-move', async (_event, sourcePaths: unknown, destDir: unknown) => {
    return batchMove(sourcePaths as string[], destDir as string);
  });
  
  safeHandle('delete-files', async (_event, filePaths: unknown, deleteParentFolders: unknown) => {
    const paths = filePaths as string[];
    const result = await batchDelete(paths, deleteParentFolders as boolean);
    
    // Remove successfully deleted files from storage
    if (result.successCount > 0) {
      const deletedPaths = paths.filter((p) => 
        !result.errors.some((e) => e.path === p)
      );
      await removeFilesFromLibrary(deletedPaths);
    }
    
    return result;
  });
  
  safeHandle('show-in-finder', async (_event, filePath: unknown) => {
    shell.showItemInFolder(filePath as string);
  });
  
  safeHandle('rename-folder', async (_event, oldPath: unknown, newPath: unknown) => {
    await renameFolder(oldPath as string, newPath as string);
    return true;
  });
  
  safeHandle('delete-empty-folders', async (_event, folderPaths: unknown) => {
    const paths = folderPaths as string[];
    // Try to delete each folder - they should be empty after file deletion
    for (const folderPath of paths) {
      try {
        await import('fs/promises').then((fs) => fs.rmdir(folderPath));
      } catch {
        // Folder might not be empty or other error - silently continue
      }
    }
  });
  
  // --- Select Destination Directory ---
  safeHandle('select-destination', async () => {
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
  safeHandle('select-subtitle-file', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      title: 'Select Subtitle File',
      filters: [
        { name: 'Subtitle Files', extensions: ['srt', 'ass', 'ssa', 'vtt', 'sub'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });
    
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    
    return result.filePaths[0];
  });

  // --- Ratings (OMDB or TMDB) ---
  safeHandle('fetch-ratings', async (_event, items: unknown) => {
    const ratingItems = items as Array<{ title: string; year?: string }>;
    const settings = await getSettings();
    const provider = settings.ratingProvider || 'omdb';
    const apiKey = provider === 'tmdb' ? settings.tmdbApiKey : settings.omdbApiKey;
    
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
      if (cached && (now - cached.fetchedAt < CACHE_DURATION)) {
        results[cacheKey] = cached;
        continue;
      }

      // Rate limiting: wait between API calls
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));

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
  safeHandle('requery-rating', async (_event, item: unknown) => {
    const ratingItem = item as { title: string; year?: string };
    const settings = await getSettings();
    const provider = settings.ratingProvider || 'omdb';
    const apiKey = provider === 'tmdb' ? settings.tmdbApiKey : settings.omdbApiKey;
    
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
      rating = await TmdbService.fetchRating(ratingItem.title, apiKey, ratingItem.year);
    } else {
      rating = await OmdbService.fetchRating(ratingItem.title, apiKey, ratingItem.year);
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
  safeHandle<TmdbMatchResult[]>('search-tmdb', async (_event, query: unknown) => {
    const settings = await getSettings();
    const apiKey = settings.tmdbApiKey;
    
    if (!apiKey) {
      return [];
    }

    return TmdbService.searchMulti(query as string, apiKey);
  });

  // --- Get TV Episode Details ---
  safeHandle<TmdbEpisodeDetails | null>('get-tv-episode', async (_event, tvId: unknown, season: unknown, episode: unknown) => {
    const settings = await getSettings();
    const apiKey = settings.tmdbApiKey;
    
    if (!apiKey) {
      return null;
    }

    return TmdbService.getTvEpisode(tvId as number, season as number, episode as number, apiKey);
  });

  // --- Match File to TMDB (rename and optionally embed metadata) ---
  ipcMain.handle('match-file', async (
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
        const fileIndex = library.findIndex(f => f.path === currentPath);
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
  });

  // --- Write Metadata (embed metadata without renaming) ---
  ipcMain.handle('write-metadata', async (
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
  });

  // --- Error Log ---
  safeHandle('get-error-log', () => {
    return ErrorService.getErrors();
  });

  safeHandle('clear-error-log', () => {
    ErrorService.clearErrors();
    return true;
  });

  // --- API Key Validation ---
  safeHandle<{ valid: boolean; error?: string }>('validate-tmdb-key', async (_event, apiKey: unknown) => {
    return TmdbService.validateApiKey(apiKey as string);
  });

  safeHandle<{ valid: boolean; error?: string }>('validate-omdb-key', async (_event, apiKey: unknown) => {
    return OmdbService.validateApiKey(apiKey as string);
  });

  // --- FFmpeg Editor Operations ---
  
  // Get media file by ID for editor
  safeHandle('get-media-file-by-id', async (_event, id: unknown) => {
    const library = await getMediaLibrary();
    return library.find(f => f.id === id as string) || null;
  });

  // Container conversion
  safeHandle('convert-container', async (_event, filePath: unknown, format: unknown, duration: unknown) => {
    return await convertContainer(filePath as string, format as ContainerFormat, mainWindow, duration as number | undefined);
  });

  // Video transcoding
  safeHandle('transcode-video', async (_event, filePath: unknown, options: unknown, duration: unknown) => {
    return await transcodeVideo(filePath as string, options as VideoTranscodeOptions, mainWindow, duration as number | undefined);
  });

  // Audio transcoding
  safeHandle('transcode-audio', async (_event, filePath: unknown, options: unknown, duration: unknown) => {
    return await transcodeAudio(filePath as string, options as AudioTranscodeOptions, mainWindow, duration as number | undefined);
  });

  // Extract subtitle
  safeHandle('extract-subtitle', async (_event, filePath: unknown, trackIndex: unknown, format: unknown, outputPath: unknown) => {
    return await extractSubtitle(filePath as string, trackIndex as number, format as SubtitleFormat, outputPath as string | undefined);
  });

  // Add subtitle
  safeHandle('add-subtitle', async (_event, filePath: unknown, subtitlePath: unknown, language: unknown, duration: unknown) => {
    return await addSubtitle(filePath as string, subtitlePath as string, language as string | undefined, mainWindow, duration as number | undefined);
  });

  // Remove subtitle
  safeHandle('remove-subtitle', async (_event, filePath: unknown, trackIndex: unknown, duration: unknown) => {
    return await removeSubtitle(filePath as string, trackIndex as number, mainWindow, duration as number | undefined);
  });

  // Set default subtitle
  safeHandle('set-default-subtitle', async (_event, filePath: unknown, trackIndex: unknown, duration: unknown) => {
    return await setDefaultSubtitle(filePath as string, trackIndex as number, mainWindow, duration as number | undefined);
  });

  // Run custom FFmpeg command
  safeHandle('run-custom-command', async (_event, command: unknown) => {
    // Save to history
    await saveCommandToHistory(command as string);
    return await runCustomCommand(command as string, mainWindow);
  });

  // Get command history
  safeHandle('get-command-history', async () => {
    return getCommandHistory();
  });
}
