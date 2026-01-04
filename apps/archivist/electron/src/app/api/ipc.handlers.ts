import { BrowserWindow, dialog, ipcMain, shell } from 'electron';
import * as path from 'path';
import { AppSettings, FilterState, OmdbRating } from '../models';
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
    renameFile,
    renameFolder,
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

export function registerIpcHandlers(mainWindow: BrowserWindow): void {
  // Initialize error service with main window
  ErrorService.setMainWindow(mainWindow);
  
  // --- Directory Selection ---
  ipcMain.handle('select-directory', async () => {
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
  ipcMain.handle('scan-directory', async (_event, directoryPath: string) => {
    if (!directoryPath) {
      throw new Error('Directory path is required');
    }
    
    await setLastScanPath(directoryPath);
    
    // Load existing library for incremental scanning
    const existingLibrary = await getMediaLibrary();
    const existingFiles = new Map(
      existingLibrary.map(file => [
        file.path,
        { scannedAt: file.scannedAt, mediaFile: file }
      ])
    );
    
    const files = await scanDirectory(directoryPath, {
      maxConcurrency: 4,
      window: mainWindow,
      existingFiles,
    });
    
    await saveMediaLibrary(files);
    return files;
  });
  
  ipcMain.handle('cancel-scan', () => {
    requestCancelScan();
    return true;
  });
  
  // --- Library Data ---
  ipcMain.handle('get-library', async () => {
    return getMediaLibrary();
  });
  
  ipcMain.handle('get-storage-data', async () => {
    return getStorageData();
  });
  
  ipcMain.handle('get-last-scan-path', async () => {
    return getLastScanPath();
  });
  
  ipcMain.handle('clear-library', async () => {
    await clearLibrary();
    return true;
  });
  
  // --- Filters ---
  ipcMain.handle('save-filters', async (_event, filters: FilterState) => {
    await saveFilters(filters);
    return true;
  });
  
  // --- Settings ---
  ipcMain.handle('get-settings', async () => {
    return getSettings();
  });
  
  ipcMain.handle('save-settings', async (_event, settings: AppSettings) => {
    await saveSettings(settings);
    return true;
  });
  
  // --- File Operations ---
  ipcMain.handle('rename-file', async (_event, oldPath: string, newPath: string) => {
    try {
      await renameFile(oldPath, newPath);
      return true;
    } catch (error) {
      ErrorService.logError('rename-file', error, oldPath);
      throw error;
    }
  });
  
  ipcMain.handle('move-file', async (_event, sourcePath: string, destDir: string) => {
    try {
      const newPath = await moveFile(sourcePath, destDir);
      return newPath;
    } catch (error) {
      ErrorService.logError('move-file', error, sourcePath);
      throw error;
    }
  });
  
  ipcMain.handle('batch-rename', async (_event, files: Array<{ oldPath: string; newPath: string }>) => {
    try {
      return batchRename(files);
    } catch (error) {
      ErrorService.logError('batch-rename', error);
      throw error;
    }
  });
  
  ipcMain.handle('batch-move', async (_event, sourcePaths: string[], destDir: string) => {
    try {
      return batchMove(sourcePaths, destDir);
    } catch (error) {
      ErrorService.logError('batch-move', error);
      throw error;
    }
  });
  
  ipcMain.handle('delete-files', async (_event, filePaths: string[], deleteParentFolders: boolean) => {
    try {
      const result = await batchDelete(filePaths, deleteParentFolders);
      
      // Remove successfully deleted files from storage
      if (result.successCount > 0) {
        const deletedPaths = filePaths.filter((path) => 
          !result.errors.some((e) => e.path === path)
        );
        await removeFilesFromLibrary(deletedPaths);
      }
      
      return result;
    } catch (error) {
      ErrorService.logError('delete-files', error);
      throw error;
    }
  });
  
  ipcMain.handle('show-in-finder', async (_event, filePath: string) => {
    shell.showItemInFolder(filePath);
  });
  
  ipcMain.handle('rename-folder', async (_event, oldPath: string, newPath: string) => {
    try {
      await renameFolder(oldPath, newPath);
      return true;
    } catch (error) {
      ErrorService.logError('rename-folder', error, oldPath);
      throw error;
    }
  });
  
  ipcMain.handle('delete-empty-folders', async (_event, folderPaths: string[]) => {
    // Try to delete each folder - they should be empty after file deletion
    for (const folderPath of folderPaths) {
      try {
        await import('fs/promises').then((fs) => fs.rmdir(folderPath));
      } catch {
        // Folder might not be empty or other error - silently continue
      }
    }
  });
  
  // --- Select Destination Directory ---
  ipcMain.handle('select-destination', async () => {
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
  ipcMain.handle('select-subtitle-file', async () => {
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
  ipcMain.handle('fetch-ratings', async (_event, items: Array<{ title: string; year?: string }>) => {
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

    for (const item of items) {
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
  ipcMain.handle('requery-rating', async (_event, item: { title: string; year?: string }) => {
    const settings = await getSettings();
    const provider = settings.ratingProvider || 'omdb';
    const apiKey = provider === 'tmdb' ? settings.tmdbApiKey : settings.omdbApiKey;
    
    if (!apiKey) {
      return null;
    }

    const cache = await getRatingsCache();
    const cacheKey = `${provider}:${item.title}-${item.year || ''}`;
    
    // Remove from cache
    delete cache[cacheKey];
    
    // Fetch fresh data from API
    let rating: OmdbRating | TmdbRating | null = null;
    
    if (provider === 'tmdb') {
      rating = await TmdbService.fetchRating(item.title, apiKey, item.year);
    } else {
      rating = await OmdbService.fetchRating(item.title, apiKey, item.year);
    }

    if (rating) {
      cache[cacheKey] = rating as OmdbRating;
      await saveRatingsCache(cache);
      return rating;
    } else {
      // Movie not found - create a placeholder entry
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
        fetchedAt: Date.now(),
        notFound: true,
        searchedTitle: item.title,
      };
      cache[cacheKey] = notFoundEntry;
      await saveRatingsCache(cache);
      return notFoundEntry;
    }
  });

  // --- TMDB Search (multi-search for movies and TV shows) ---
  ipcMain.handle('search-tmdb', async (_event, query: string): Promise<TmdbMatchResult[]> => {
    const settings = await getSettings();
    const apiKey = settings.tmdbApiKey;
    
    if (!apiKey) {
      return [];
    }

    return TmdbService.searchMulti(query, apiKey);
  });

  // --- Get TV Episode Details ---
  ipcMain.handle('get-tv-episode', async (
    _event,
    tvId: number,
    season: number,
    episode: number,
  ): Promise<TmdbEpisodeDetails | null> => {
    const settings = await getSettings();
    const apiKey = settings.tmdbApiKey;
    
    if (!apiKey) {
      return null;
    }

    return TmdbService.getTvEpisode(tvId, season, episode, apiKey);
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
        await renameFile(currentPath, newPath);
        
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
  ipcMain.handle('get-error-log', () => {
    return ErrorService.getErrors();
  });

  ipcMain.handle('clear-error-log', () => {
    ErrorService.clearErrors();
    return true;
  });

  // --- API Key Validation ---
  ipcMain.handle('validate-tmdb-key', async (_event, apiKey: string): Promise<{ valid: boolean; error?: string }> => {
    return TmdbService.validateApiKey(apiKey);
  });

  ipcMain.handle('validate-omdb-key', async (_event, apiKey: string): Promise<{ valid: boolean; error?: string }> => {
    return OmdbService.validateApiKey(apiKey);
  });

  // --- FFmpeg Editor Operations ---
  
  // Get media file by ID for editor
  ipcMain.handle('get-media-file-by-id', async (_event, id: string) => {
    const library = await getMediaLibrary();
    return library.find(f => f.id === id) || null;
  });

  // Container conversion
  ipcMain.handle('convert-container', async (
    _event,
    filePath: string,
    format: ContainerFormat,
    duration?: number,
  ) => {
    try {
      return await convertContainer(filePath, format, mainWindow, duration);
    } catch (error) {
      ErrorService.logError('convert-container', error, filePath);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  // Video transcoding
  ipcMain.handle('transcode-video', async (
    _event,
    filePath: string,
    options: VideoTranscodeOptions,
    duration?: number,
  ) => {
    try {
      return await transcodeVideo(filePath, options, mainWindow, duration);
    } catch (error) {
      ErrorService.logError('transcode-video', error, filePath);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  // Audio transcoding
  ipcMain.handle('transcode-audio', async (
    _event,
    filePath: string,
    options: AudioTranscodeOptions,
    duration?: number,
  ) => {
    try {
      return await transcodeAudio(filePath, options, mainWindow, duration);
    } catch (error) {
      ErrorService.logError('transcode-audio', error, filePath);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  // Extract subtitle
  ipcMain.handle('extract-subtitle', async (
    _event,
    filePath: string,
    trackIndex: number,
    format: SubtitleFormat,
    outputPath?: string,
  ) => {
    try {
      return await extractSubtitle(filePath, trackIndex, format, outputPath);
    } catch (error) {
      ErrorService.logError('extract-subtitle', error, filePath);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  // Add subtitle
  ipcMain.handle('add-subtitle', async (
    _event,
    filePath: string,
    subtitlePath: string,
    language?: string,
    duration?: number,
  ) => {
    try {
      return await addSubtitle(filePath, subtitlePath, language, mainWindow, duration);
    } catch (error) {
      ErrorService.logError('add-subtitle', error, filePath);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  // Remove subtitle
  ipcMain.handle('remove-subtitle', async (
    _event,
    filePath: string,
    trackIndex: number,
    duration?: number,
  ) => {
    try {
      return await removeSubtitle(filePath, trackIndex, mainWindow, duration);
    } catch (error) {
      ErrorService.logError('remove-subtitle', error, filePath);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  // Set default subtitle
  ipcMain.handle('set-default-subtitle', async (
    _event,
    filePath: string,
    trackIndex: number,
    duration?: number,
  ) => {
    try {
      return await setDefaultSubtitle(filePath, trackIndex, mainWindow, duration);
    } catch (error) {
      ErrorService.logError('set-default-subtitle', error, filePath);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  // Run custom FFmpeg command
  ipcMain.handle('run-custom-command', async (_event, command: string) => {
    try {
      // Save to history
      await saveCommandToHistory(command);
      return await runCustomCommand(command, mainWindow);
    } catch (error) {
      ErrorService.logError('run-custom-command', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  // Get command history
  ipcMain.handle('get-command-history', async () => {
    return getCommandHistory();
  });
}
