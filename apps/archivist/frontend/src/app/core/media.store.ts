import { Injectable, computed, effect, inject, signal } from '@angular/core';
import {
    AudioChannelType,
    BITRATE_THRESHOLDS,
    BitrateRange,
    ElectronService,
    FilterState,
    MediaFile,
    OmdbRating,
    ResolutionCategory,
} from './electron.service';
import { SettingsService } from './settings.service';

export interface OperationResult {
  successCount: number;
  errorCount: number;
}

const RESOLUTION_ORDER: Record<ResolutionCategory, number> = {
  '4K': 4,
  '1080p': 3,
  '720p': 2,
  SD: 1,
  Unknown: 0,
};

@Injectable({ providedIn: 'root' })
export class MediaStore {
  private readonly electron = inject(ElectronService);
  private readonly settings = inject(SettingsService);

  // Core state
  private readonly _mediaFiles = signal<MediaFile[]>([]);
  private readonly _selectedIds = signal<Set<string>>(new Set());
  private readonly _lastScanPath = signal<string | null>(null);
  private readonly _lastScanAt = signal<number | null>(null);
  private readonly _isLoading = signal(false);

  // Filter state
  private readonly _filters = signal<FilterState>({
    resolutions: [],
    audioChannels: [],
    audioLanguages: [],
    videoCodecs: [],
    bitrateRanges: [],
    sortBy: 'filename',
    sortDirection: 'asc',
  });

  // Exposed readonly signals
  readonly mediaFiles = this._mediaFiles.asReadonly();
  readonly selectedIds = this._selectedIds.asReadonly();
  readonly lastScanPath = this._lastScanPath.asReadonly();
  readonly lastScanAt = this._lastScanAt.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly filters = this._filters.asReadonly();

  // Ratings state
  private readonly _ratings = signal<Record<string, OmdbRating>>({});
  readonly ratings = this._ratings.asReadonly();

  readonly scanProgress = this.electron.scanProgress;
  readonly isScanning = this.electron.isScanning;

  // Selected files
  readonly selectedFiles = computed(() => {
    const ids = this._selectedIds();
    return this._mediaFiles().filter((f) => ids.has(f.id));
  });

  readonly selectedCount = computed(() => this._selectedIds().size);

  // Available filter options derived from data
  readonly availableResolutions = computed<ResolutionCategory[]>(() => {
    const resolutions = new Set<ResolutionCategory>();
    for (const file of this._mediaFiles()) {
      for (const vs of file.videoStreams) {
        resolutions.add(vs.resolution);
      }
    }
    return Array.from(resolutions).sort(
      (a, b) => RESOLUTION_ORDER[b] - RESOLUTION_ORDER[a],
    );
  });

  readonly availableAudioChannels = computed<AudioChannelType[]>(() => {
    const channels = new Set<AudioChannelType>();
    for (const file of this._mediaFiles()) {
      for (const as of file.audioStreams) {
        channels.add(as.channelType);
      }
    }
    return Array.from(channels);
  });

  readonly availableLanguages = computed<string[]>(() => {
    const languages = new Set<string>();
    for (const file of this._mediaFiles()) {
      for (const as of file.audioStreams) {
        if (as.language) languages.add(as.language);
      }
    }
    return Array.from(languages).sort();
  });

  readonly availableCodecs = computed<string[]>(() => {
    const codecs = new Set<string>();
    for (const file of this._mediaFiles()) {
      for (const vs of file.videoStreams) {
        codecs.add(vs.codec);
      }
    }
    return Array.from(codecs).sort();
  });

  readonly availableBitrateRanges = computed<BitrateRange[]>(() => {
    const ranges = new Set<BitrateRange>();
    for (const file of this._mediaFiles()) {
      if (file.bitrate) {
        for (const [range, { min, max }] of Object.entries(
          BITRATE_THRESHOLDS,
        )) {
          if (file.bitrate >= min && file.bitrate < max) {
            ranges.add(range as BitrateRange);
            break;
          }
        }
      }
    }
    // Return in order: Low, Medium, High, Very High
    const order: BitrateRange[] = ['Low', 'Medium', 'High', 'Very High'];
    return order.filter((r) => ranges.has(r));
  });

  // Filtered and sorted files
  readonly filteredFiles = computed(() => {
    const files = this._mediaFiles();
    const f = this._filters();

    let result = files.filter((file) => {
      // Resolution filter
      if (f.resolutions.length > 0) {
        const fileResolutions = file.videoStreams.map((vs) => vs.resolution);
        if (!f.resolutions.some((r) => fileResolutions.includes(r))) {
          return false;
        }
      }

      // Audio channel filter
      if (f.audioChannels.length > 0) {
        const fileChannels = file.audioStreams.map((as) => as.channelType);
        if (!f.audioChannels.some((c) => fileChannels.includes(c))) {
          return false;
        }
      }

      // Language filter
      if (f.audioLanguages.length > 0) {
        const fileLanguages = file.audioStreams
          .map((as) => as.language)
          .filter(Boolean) as string[];
        if (!f.audioLanguages.some((l) => fileLanguages.includes(l))) {
          return false;
        }
      }

      // Codec filter
      if (f.videoCodecs.length > 0) {
        const fileCodecs = file.videoStreams.map((vs) => vs.codec);
        if (!f.videoCodecs.some((c) => fileCodecs.includes(c))) {
          return false;
        }
      }

      // Bitrate filter (preset ranges)
      if (f.bitrateRanges && f.bitrateRanges.length > 0) {
        if (!file.bitrate) return false;
        const fileInRange = f.bitrateRanges.some((range) => {
          const { min, max } = BITRATE_THRESHOLDS[range];
          return file.bitrate! >= min && file.bitrate! < max;
        });
        if (!fileInRange) return false;
      }

      // Custom bitrate range filter (in Mbps, converted to bps for comparison)
      if (f.customBitrateRange) {
        if (!file.bitrate) return false;
        const minBps = f.customBitrateRange.minMbps * 1_000_000;
        const maxBps = f.customBitrateRange.maxMbps * 1_000_000;
        if (file.bitrate < minBps || file.bitrate > maxBps) {
          return false;
        }
      }

      // Search query
      if (f.searchQuery && f.searchQuery.trim()) {
        const query = f.searchQuery.toLowerCase();
        if (
          !file.filename.toLowerCase().includes(query) &&
          !file.path.toLowerCase().includes(query)
        ) {
          return false;
        }
      }

      return true;
    });

    // Sort
    if (f.sortBy) {
      result = [...result].sort((a, b) => {
        let comparison = 0;
        switch (f.sortBy) {
          case 'filename':
            comparison = a.filename.localeCompare(b.filename);
            break;
          case 'size':
            comparison = a.sizeBytes - b.sizeBytes;
            break;
          case 'duration':
            comparison = (a.duration ?? 0) - (b.duration ?? 0);
            break;
          case 'resolution': {
            const resA = a.videoStreams[0]?.resolution ?? 'Unknown';
            const resB = b.videoStreams[0]?.resolution ?? 'Unknown';
            comparison = RESOLUTION_ORDER[resB] - RESOLUTION_ORDER[resA];
            break;
          }
          case 'bitrate':
            comparison = (a.bitrate ?? 0) - (b.bitrate ?? 0);
            break;
          case 'rating': {
            const ratingA = this.getNumericRating(a.filename);
            const ratingB = this.getNumericRating(b.filename);
            comparison = ratingA - ratingB;
            break;
          }
          case 'modified':
            comparison = (a.modifiedAt ?? 0) - (b.modifiedAt ?? 0);
            break;
        }
        return f.sortDirection === 'desc' ? -comparison : comparison;
      });
    }

    return result;
  });

  readonly stats = computed(() => ({
    totalFiles: this._mediaFiles().length,
    filteredFiles: this.filteredFiles().length,
    totalSize: this._mediaFiles().reduce((sum, f) => sum + f.sizeBytes, 0),
    filteredSize: this.filteredFiles().reduce((sum, f) => sum + f.sizeBytes, 0),
  }));

  constructor() {
    // Persist filters on change
    effect(() => {
      const filters = this._filters();
      // Only save if we have actual filter values
      if (filters.resolutions.length > 0 || filters.audioChannels.length > 0) {
        this.electron.saveFilters(filters);
      }
    });

    // Fetch ratings for filtered files
    effect(async () => {
      const files = this.filteredFiles();
      if (files.length === 0) return;

      // Simple debounce/throttle could be added here if needed
      // Extract clean titles and years
      const items = files.map((f) => this.parseFilename(f.filename));

      // Filter out items we already have
      const currentRatings = this._ratings();
      const itemsToFetch = items.filter((item) => {
        const key = `${item.title}-${item.year || ''}`;
        // If we have it and it's not too old?
        // For now, the backend handles cache expiry check efficiently.
        // But to save IPC calls, we can check if we have a key in our local signal.
        // However, the IPC also returns cached items from disk which might be fresher or older.
        // Let's just ask backend, it's safer for persistence validation.
        return true;
      });

      if (itemsToFetch.length === 0) return;

      // Batching could be done here (e.g. 50 at a time)
      // For now send all, assuming generic list size is manageable (< 100 visible?)
      // If list is huge (1000s), this might block.
      // Let's limit to top 50 for now or rely on user search.
      const batch = itemsToFetch.slice(0, 50);

      const newRatings = await this.electron.fetchRatings(batch);

      this._ratings.update((current) => ({ ...current, ...newRatings }));
    });
  }

  getRating(filename: string): OmdbRating | undefined {
    const { title, year } = this.parseFilename(filename);
    const provider = this.settings.$ratingProvider();
    const key = `${provider}:${title}-${year || ''}`;
    return this._ratings()[key];
  }

  /**
   * Get numeric rating value for sorting purposes.
   * Returns 0 for files without ratings or with notFound status.
   */
  private getNumericRating(filename: string): number {
    const rating = this.getRating(filename);
    if (!rating || rating.notFound) return 0;
    
    // OMDB format - has imdbRating string (e.g., "7.5")
    if ('imdbRating' in rating && typeof rating.imdbRating === 'string' && rating.imdbRating) {
      const parsed = parseFloat(rating.imdbRating);
      return isNaN(parsed) ? 0 : parsed;
    }
    
    // TMDB format - has rating number (0-10)
    if ('rating' in rating && typeof (rating as unknown as { rating: number }).rating === 'number') {
      return (rating as unknown as { rating: number }).rating;
    }
    
    return 0;
  }

  async requeryRating(filename: string): Promise<void> {
    const { title, year } = this.parseFilename(filename);
    const provider = this.settings.$ratingProvider();
    const key = `${provider}:${title}-${year || ''}`;
    
    // Clear the local rating first
    this._ratings.update((current) => {
      const updated = { ...current };
      delete updated[key];
      return updated;
    });
    
    // Request the backend to requery (which will also clear cache)
    const result = await this.electron.requeryRating({ title, year });
    if (result) {
      this._ratings.update((current) => ({ ...current, [key]: result }));
    }
  }

  private parseFilename(filename: string): { title: string; year?: string } {
    // Basic cleanup: remove extension
    let name = filename.substring(0, filename.lastIndexOf('.'));

    // Try to find year (4 digits in parentheses or separated by dots/spaces)
    // Matches: (2020), .2020.,  2020
    const yearMatch = name.match(/[\(\.\s](19|20)\d{2}[\)\.\s]/);
    let year: string | undefined;

    if (yearMatch) {
      year = yearMatch[0].replace(/[\(\)\.\s]/g, '');
      // Title is everything before the year
      name = name.substring(0, yearMatch.index).replace(/\./g, ' ').trim();
    } else {
      // Fallback: replace dots with spaces
      name = name.replace(/\./g, ' ');
    }

    return { title: name, year };
  }

  async loadFromStorage(): Promise<void> {
    this._isLoading.set(true);
    try {
      const data = await this.electron.getStorageData();
      if (data) {
        this._mediaFiles.set(data.mediaLibrary);
        this._lastScanPath.set(data.lastScanPath);
        this._lastScanAt.set(data.lastScanAt);
        if (data.filters) {
          // Merge with defaults to handle missing properties from old stored data
          this._filters.set({
            resolutions: data.filters.resolutions ?? [],
            audioChannels: data.filters.audioChannels ?? [],
            audioLanguages: data.filters.audioLanguages ?? [],
            videoCodecs: data.filters.videoCodecs ?? [],
            bitrateRanges: data.filters.bitrateRanges ?? [],
            searchQuery: data.filters.searchQuery,
            sortBy: data.filters.sortBy ?? 'filename',
            sortDirection: data.filters.sortDirection ?? 'asc',
          });
        }
      }
    } finally {
      this._isLoading.set(false);
    }
  }

  async scanDirectory(path: string, forceFullScan = false): Promise<void> {
    this._isLoading.set(true);
    try {
      const files = await this.electron.scanDirectory(path, forceFullScan);
      this._mediaFiles.set(files);
      this._lastScanPath.set(path);
      this._lastScanAt.set(Date.now());
      this._selectedIds.set(new Set());
    } finally {
      this._isLoading.set(false);
    }
  }

  async selectAndScan(): Promise<void> {
    const path = await this.electron.selectDirectory();
    if (path) {
      // "Scan Folder" always does a full scan
      await this.scanDirectory(path, true);
    }
  }

  cancelScan(): void {
    this.electron.cancelScan();
  }

  async clearLibrary(): Promise<void> {
    await this.electron.clearLibrary();
    this._mediaFiles.set([]);
    this._lastScanPath.set(null);
    this._lastScanAt.set(null);
    this._selectedIds.set(new Set());
  }

  // Selection methods
  selectFile(id: string): void {
    this._selectedIds.update((ids) => {
      const newIds = new Set(ids);
      newIds.add(id);
      return newIds;
    });
  }

  deselectFile(id: string): void {
    this._selectedIds.update((ids) => {
      const newIds = new Set(ids);
      newIds.delete(id);
      return newIds;
    });
  }

  toggleSelection(id: string): void {
    this._selectedIds.update((ids) => {
      const newIds = new Set(ids);
      if (newIds.has(id)) {
        newIds.delete(id);
      } else {
        newIds.add(id);
      }
      return newIds;
    });
  }

  selectAll(): void {
    this._selectedIds.set(new Set(this.filteredFiles().map((f) => f.id)));
  }

  deselectAll(): void {
    this._selectedIds.set(new Set());
  }

  // Filter methods
  updateFilters(partial: Partial<FilterState>): void {
    this._filters.update((current) => ({ ...current, ...partial }));
  }

  resetFilters(): void {
    this._filters.set({
      resolutions: [],
      audioChannels: [],
      audioLanguages: [],
      videoCodecs: [],
      bitrateRanges: [],
      sortBy: 'filename',
      sortDirection: 'asc',
    });
  }

  setSearchQuery(query: string): void {
    this._filters.update((f) => ({ ...f, searchQuery: query }));
  }

  // Batch operations
  async moveSelected(destDir: string): Promise<OperationResult> {
    const paths = this.selectedFiles().map((f) => f.path);
    if (paths.length === 0) return { successCount: 0, errorCount: 0 };

    const result = await this.electron.batchMove(paths, destDir);
    if (result && result.successCount > 0) {
      // Remove moved files from library
      const movedPaths = new Set(
        paths.filter((_, i) => !result.errors.some((e) => e.path === paths[i])),
      );
      this._mediaFiles.update((files) =>
        files.filter((f) => !movedPaths.has(f.path)),
      );
      this._selectedIds.set(new Set());
    }
    return {
      successCount: result?.successCount ?? 0,
      errorCount: result?.errors.length ?? 0,
    };
  }

  async deleteSelected(deleteParentFolders = false): Promise<OperationResult> {
    const paths = this.selectedFiles().map((f) => f.path);
    if (paths.length === 0) return { successCount: 0, errorCount: 0 };

    const result = await this.electron.deleteFiles(paths, deleteParentFolders);
    if (result && result.successCount > 0) {
      // Remove deleted files from library
      const deletedPaths = new Set(
        paths.filter((_, i) => !result.errors.some((e) => e.path === paths[i])),
      );
      this._mediaFiles.update((files) =>
        files.filter((f) => !deletedPaths.has(f.path)),
      );
      this._selectedIds.set(new Set());
    }
    return {
      successCount: result?.successCount ?? 0,
      errorCount: result?.errors.length ?? 0,
    };
  }

  async deleteSeason(fileIds: string[]): Promise<OperationResult> {
    const selectedFiles = this._mediaFiles().filter((f) => fileIds.includes(f.id));
    const directories = [...new Set(selectedFiles.map((f) => f.directory))];

    const filesInSeasons = this._mediaFiles().filter((f) =>
      directories.includes(f.directory)
    );

    const pathsToDelete = filesInSeasons.map((f) => f.path);
    if (pathsToDelete.length === 0) return { successCount: 0, errorCount: 0 };

    // Use deleteParentFolders = true for seasons as it's implied we want to clean up
    const result = await this.electron.deleteFiles(pathsToDelete, true);
    if (result && result.successCount > 0) {
      const deletedPaths = new Set(
        pathsToDelete.filter(
          (_, i) => !result.errors.some((e) => e.path === pathsToDelete[i])
        )
      );
      this._mediaFiles.update((files) =>
        files.filter((f) => !deletedPaths.has(f.path))
      );
      this._selectedIds.set(new Set());
    }
    return {
      successCount: result?.successCount ?? 0,
      errorCount: result?.errors.length ?? 0,
    };
  }

  async deleteEmptyFolders(folderPaths: string[]): Promise<void> {
    if (folderPaths.length === 0) return;
    await this.electron.deleteEmptyFolders(folderPaths);
  }

  async showSelectedInFinder(): Promise<void> {
    const selected = this.selectedFiles();
    if (selected.length === 0) return;

    // Show the first selected file in Finder
    await this.electron.showInFinder(selected[0].path);
  }

  async showInFinder(path: string): Promise<void> {
    await this.electron.showInFinder(path);
  }

  async renameSelectedFile(newFilename: string): Promise<boolean> {
    const selected = this.selectedFiles();
    if (selected.length !== 1) return false;

    const file = selected[0];
    const newPath = file.directory + '/' + newFilename;

    const success = await this.electron.renameFile(file.path, newPath);
    if (success) {
      // Update the file in the library
      this._mediaFiles.update((files) =>
        files.map((f) =>
          f.id === file.id ? { ...f, path: newPath, filename: newFilename } : f,
        ),
      );
    }
    return success;
  }

  async renameSelectedFolder(newFolderName: string): Promise<boolean> {
    const selected = this.selectedFiles();
    if (selected.length === 0) return false;

    // Get the directory of the first selected file
    const file = selected[0];
    const oldDir = file.directory;
    const parentDir = oldDir.substring(0, oldDir.lastIndexOf('/'));
    const newDir = parentDir + '/' + newFolderName;

    const success = await this.electron.renameFolder(oldDir, newDir);
    if (success) {
      // Update all files that were in this directory
      this._mediaFiles.update((files) =>
        files.map((f) => {
          if (f.directory === oldDir || f.directory.startsWith(oldDir + '/')) {
            const newDirectory = f.directory.replace(oldDir, newDir);
            const newPath = f.path.replace(oldDir, newDir);
            return { ...f, directory: newDirectory, path: newPath };
          }
          return f;
        }),
      );
    }
    return success;
  }

  /**
   * Update a file's path after it has been renamed externally (e.g., via match)
   */
  updateFilePath(fileId: string, newPath: string): void {
    const newFilename = newPath.substring(newPath.lastIndexOf('/') + 1);
    const newDirectory = newPath.substring(0, newPath.lastIndexOf('/'));
    
    this._mediaFiles.update((files) =>
      files.map((f) =>
        f.id === fileId
          ? { ...f, path: newPath, filename: newFilename, directory: newDirectory }
          : f,
      ),
    );
  }
}
