import { computed, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AnalysisResult,
  LightweightFile,
  sanitizePathSegment,
  TmdbMatchResult,
  TmdbMetadata,
} from '@medularity/archivist-core';
import { ElectronService } from './electron.service';
import { MatchQueueStore } from './match-queue.store';
import { MediaStore } from './media.store';

export type AnalysisStatus =
  | 'idle'
  | 'scanning'
  | 'analyzing'
  | 'reviewing'
  | 'applying'
  | 'completed';

export interface AnalysisState {
  status: AnalysisStatus;
  results: AnalysisResult[];
  progress: {
    current: number;
    total: number;
    currentFile?: string;
  };
  error: string | null;
}

export interface SeriesEpisodeGroup {
  result: AnalysisResult;
  season: number;
  episode: number;
  episodeTitle?: string;
}

export interface SeriesGroup {
  showTitle: string;
  year: string;
  posterUrl: string | null;
  seasons: {
    season: number;
    episodes: SeriesEpisodeGroup[];
  }[];
  dirtyCount: number;
  cleanCount: number;
  missingCount: number;
}

const initialState: AnalysisState = {
  status: 'idle',
  results: [],
  progress: {
    current: 0,
    total: 0,
  },
  error: null,
};

@Injectable({ providedIn: 'root' })
export class AnalysisStore {
  private readonly electronService = inject(ElectronService);
  private readonly matchQueueStore = inject(MatchQueueStore);
  private readonly mediaStore = inject(MediaStore);

  constructor() {
    // Listen for streaming results from Electron
    this.electronService.analysisResults$
      .pipe(takeUntilDestroyed())
      .subscribe((result) => {
        if (['analyzing', 'reviewing', 'scanning'].includes(this.status())) {
          this.addResult(result);
        }
      });
  }

  // State signals
  private readonly _status = signal<AnalysisStatus>(initialState.status);
  private readonly _results = signal<AnalysisResult[]>(initialState.results);
  private readonly _progress = signal<AnalysisState['progress']>(
    initialState.progress,
  );
  private readonly _error = signal<string | null>(initialState.error);
  private readonly _searchFilter = signal<string>('');

  // Public readonly signals
  readonly status = this._status.asReadonly();
  readonly results = this._results.asReadonly();
  readonly progress = this._progress.asReadonly();
  readonly error = this._error.asReadonly();
  readonly searchFilter = this._searchFilter.asReadonly();

  // Computed signals
  readonly isAnalyzing = computed(() =>
    ['scanning', 'analyzing'].includes(this.status()),
  );
  readonly isScanning = computed(() => this.status() === 'scanning');
  readonly hasResults = computed(() => this.results().length > 0);
  readonly progressPercent = computed(() => {
    const { current, total } = this.progress();
    return total > 0 ? (current / total) * 100 : 0;
  });

  readonly dirtyResults = computed(() => {
    const filter = this.searchFilter().toLowerCase().trim();
    return this.results().filter((r) => {
      if (r.isClean || r.isMissing) return false;
      if (!filter) return true;
      return (
        r.suggestedName.toLowerCase().includes(filter) ||
        r.originalName.toLowerCase().includes(filter)
      );
    });
  });

  readonly cleanResults = computed(() => {
    const filter = this.searchFilter().toLowerCase().trim();
    return this.results().filter((r) => {
      if (!r.isClean) return false;
      if (!filter) return true;
      return (
        r.suggestedName.toLowerCase().includes(filter) ||
        r.originalName.toLowerCase().includes(filter)
      );
    });
  });
  readonly fixableCount = computed(() => this.dirtyResults().length);

  // --- Series Grouping ---
  readonly seriesGroups = computed(() => {
    const tvResults = this.results().filter((r) => r.metadata?.type === 'tv');

    interface IntermediateSeriesGroup {
      showTitle: string;
      year: string;
      posterUrl: string | null;
      seasons: Map<number, SeriesEpisodeGroup[]>;
    }

    // Key by normalized title only — year differences between episodes of the same
    // show (e.g. "" vs "1923") must not create duplicate show cards.
    const showMap = new Map<string, IntermediateSeriesGroup>();

    for (const result of tvResults) {
      const rawTitle = result.metadata?.title ?? 'Unknown Show';
      const year = result.metadata?.year ?? '';
      const season = result.metadata?.season ?? 0;
      const episode = result.metadata?.episode ?? 0;

      // Normalize: lowercase + trim so title casing drift doesn't split groups
      const showKey = rawTitle.trim().toLowerCase();

      if (!showMap.has(showKey)) {
        showMap.set(showKey, {
          showTitle: rawTitle.trim(),
          year,
          posterUrl: result.metadata?.posterUrl ?? null,
          seasons: new Map<number, SeriesEpisodeGroup[]>(),
        });
      }

      const show = showMap.get(showKey)!;

      // Upgrade year: prefer a truthy value and prefer 4-digit years over
      // values that are the same as the show title (common AI mistake for
      // shows whose title IS a year, e.g. "1923").
      if (!show.year && year) {
        show.year = year;
      } else if (
        show.year === rawTitle.trim() &&
        year &&
        year !== rawTitle.trim()
      ) {
        // Current year is the show title repeated — replace with the better value
        show.year = year;
      }

      // Upgrade poster: prefer first non-null
      if (!show.posterUrl && result.metadata?.posterUrl) {
        show.posterUrl = result.metadata.posterUrl;
      }

      if (!show.seasons.has(season)) {
        show.seasons.set(season, []);
      }
      show.seasons.get(season)!.push({
        result,
        season,
        episode,
        episodeTitle: result.metadata?.episodeTitle,
      });
    }

    // Convert to sorted arrays; sort shows alphabetically
    const filter = this.searchFilter().toLowerCase().trim();

    return Array.from(showMap.values())
      .filter((show) => {
        if (!filter) return true;
        return show.showTitle.toLowerCase().includes(filter);
      })
      .map((show) => {
        const seasons = Array.from(show.seasons.entries())
          .sort(([a], [b]) => a - b)
          .map(([seasonNum, episodes]) => ({
            season: seasonNum,
            episodes: episodes.sort((a, b) => a.episode - b.episode),
          }));

        let dirtyCount = 0;
        let cleanCount = 0;
        let missingCount = 0;

        for (const s of seasons) {
          for (const e of s.episodes) {
            if (e.result.filePath.startsWith('missing://')) {
              missingCount++;
            } else if (e.result.isClean) {
              cleanCount++;
            } else {
              dirtyCount++;
            }
          }
        }

        return {
          showTitle: show.showTitle,
          year: show.year,
          posterUrl: show.posterUrl,
          seasons,
          dirtyCount,
          cleanCount,
          missingCount,
        } as SeriesGroup;
      })
      .sort((a, b) => a.showTitle.localeCompare(b.showTitle));
  });

  readonly conflicts = computed(() => {
    const results = this.results();
    const mediaFiles = this.mediaStore.mediaFiles();
    const conflictMap = new Map<string, 'duplicate' | 'exists'>();

    // 1. Map existing file paths for quick lookup
    const existingPaths = new Set(mediaFiles.map((f) => f.path));

    // 2. Track suggested paths within the session to find duplicates
    const suggestedPathsCount = new Map<string, number>();

    results.forEach((r) => {
      const lastSlash = Math.max(
        r.filePath.lastIndexOf('/'),
        r.filePath.lastIndexOf('\\'),
      );
      const dir = r.filePath.substring(0, lastSlash + 1);
      const suggestedPath = dir + r.suggestedName;

      suggestedPathsCount.set(
        suggestedPath,
        (suggestedPathsCount.get(suggestedPath) || 0) + 1,
      );
    });

    results.forEach((r) => {
      const lastSlash = Math.max(
        r.filePath.lastIndexOf('/'),
        r.filePath.lastIndexOf('\\'),
      );
      const dir = r.filePath.substring(0, lastSlash + 1);
      const suggestedPath = dir + r.suggestedName;

      // Check for internal duplicates first
      if ((suggestedPathsCount.get(suggestedPath) || 0) > 1) {
        conflictMap.set(r.filePath, 'duplicate');
      }
      // Then check if it already exists on disk (and isn't the file itself)
      else if (
        existingPaths.has(suggestedPath) &&
        suggestedPath !== r.filePath
      ) {
        conflictMap.set(r.filePath, 'exists');
      }
    });

    return conflictMap;
  });

  // Methods
  reset() {
    this._status.set(initialState.status);
    this._results.set(initialState.results);
    this._progress.set(initialState.progress);
    this._error.set(initialState.error);
    this._searchFilter.set('');
  }

  setSearchFilter(query: string) {
    this._searchFilter.set(query);
  }

  async runAnalysis(
    files: LightweightFile[],
    filter: 'both' | 'movie' | 'tv' = 'both',
    append = false,
  ): Promise<void> {
    this._status.set('analyzing');
    if (!append) {
      this._results.set([]);
    }
    this._error.set(null);

    // Filter out files that are already queued
    const filesToAnalyze = files.filter((file) => {
      const isQueued = this.matchQueueStore
        .queue()
        .some((q) => q.file.path === file.path);
      return !isQueued;
    });

    if (filesToAnalyze.length === 0) {
      this._status.set('reviewing');
      return;
    }

    this._progress.set({ current: 0, total: filesToAnalyze.length });

    try {
      await this.electronService.runAnalysis(filesToAnalyze, filter);

      if (this._status() === 'analyzing') {
        this._status.set('reviewing');
        this._progress.set({
          current: filesToAnalyze.length,
          total: filesToAnalyze.length,
          currentFile: undefined,
        });
      }
    } catch (err) {
      console.error('Batch analysis failed:', err);
      const message = err instanceof Error ? err.message : String(err);
      this._error.set(`Analysis failed: ${message}`);
      this._status.set('idle');
    }
  }

  private addResult(result: AnalysisResult) {
    // Sanitize the suggested name and metadata title
    const sanitizedTitle = sanitizePathSegment(result.metadata.title);
    const sanitizedSuggested = result.suggestedName.replace(
      result.metadata.title,
      sanitizedTitle,
    );

    const sanitizedResult: AnalysisResult = {
      ...result,
      suggestedName: sanitizedSuggested,
      isClean: result.originalName === sanitizedSuggested,
      metadata: {
        ...result.metadata,
        title: sanitizedTitle,
      },
    };

    this._results.update((current) => {
      const index = current.findIndex(
        (r) => r.filePath === sanitizedResult.filePath,
      );
      if (index !== -1) {
        // Replace existing result for the same file (upsert)
        const next = [...current];
        next[index] = sanitizedResult;
        return next;
      }
      return [...current, sanitizedResult];
    });

    // Update progress (only count physical files)
    const currentResults = this.results().filter((r) => !r.isMissing).length;
    this._progress.update((p) => ({
      ...p,
      current: currentResults,
      currentFile: result.filePath,
    }));
  }

  abortAnalysis() {
    this._status.set('idle');
    this._progress.set({ ...this.progress(), currentFile: undefined });
    this.electronService.cancelAnalysis();
  }

  async queueFix(result: AnalysisResult): Promise<void> {
    // Prefer the full MediaFile from the media library (manual mode scan)
    let mediaFile = this.mediaStore
      .mediaFiles()
      .find((f) => f.path === result.filePath);

    if (!mediaFile) {
      // AI mode: media store is empty (no ffprobe scan). Build a minimal stub
      // so the queue can still rename/move the file via applyFix.
      const lastSlash = Math.max(
        result.filePath.lastIndexOf('/'),
        result.filePath.lastIndexOf('\\'),
      );
      const filename = result.filePath.substring(lastSlash + 1);
      const directory = result.filePath.substring(0, lastSlash);
      const dotIndex = filename.lastIndexOf('.');
      const extension = dotIndex !== -1 ? filename.substring(dotIndex) : '';

      mediaFile = {
        id: result.filePath, // path as stable ID for AI mode
        path: result.filePath,
        filename,
        directory,
        extension,
        sizeBytes: 0,
        modifiedAt: 0,
        scannedAt: 0,
        videoStreams: [],
        audioStreams: [],
        subtitleStreams: [],
      };
    }

    await this.matchQueueStore.addToQueue(
      mediaFile,
      result.metadata,
      true,
      result.suggestedName,
      result.seriesRoot,
    );
    this.removeResult(result);
  }

  async queueAllFixes(): Promise<void> {
    const fixable = this.dirtyResults();
    // Clone array to avoid issues while modifying source list
    for (const result of [...fixable]) {
      await this.queueFix(result);
    }
  }

  removeResult(result: AnalysisResult): void {
    this._results.update((r) =>
      r.filter((res) => res.filePath !== result.filePath),
    );
  }

  async rescanAs(
    result: AnalysisResult,
    targetType: 'movie' | 'tv',
  ): Promise<void> {
    try {
      // 1. Remove existing result
      this.removeResult(result);

      // 2. Find file in media store or construct a stub for AI mode
      let file = this.mediaStore
        .mediaFiles()
        .find((f) => f.path === result.filePath) as LightweightFile | undefined;

      if (!file) {
        const lastSlash = Math.max(
          result.filePath.lastIndexOf('/'),
          result.filePath.lastIndexOf('\\'),
        );
        const filename = result.filePath.substring(lastSlash + 1);
        const dotIndex = filename.lastIndexOf('.');
        const extension = dotIndex !== -1 ? filename.substring(dotIndex) : '';

        file = {
          path: result.filePath,
          filename,
          extension,
          modifiedAt: 0,
          sizeBytes: result.sizeBytes ?? 0,
        };
      }

      // 3. Trigger analysis with target type filter, appending to existing results
      await this.runAnalysis([file], targetType, true);
    } catch (err) {
      console.error('Rescan failed:', err);
      this._error.set(err instanceof Error ? err.message : String(err));
    }
  }

  setStatus(status: AnalysisStatus) {
    this._status.set(status);
  }

  updateResult(filePath: string, updates: Partial<AnalysisResult>) {
    const currentResults = this.results();
    const index = currentResults.findIndex((r) => r.filePath === filePath);
    if (index !== -1) {
      const updated = [...currentResults];
      updated[index] = { ...updated[index], ...updates };
      this._results.set(updated);
    }
  }

  updateResultFromMetadata(result: AnalysisResult, metadata: TmdbMetadata) {
    const sanitizedTitle = sanitizePathSegment(metadata.title);
    const ext = result.originalName.includes('.')
      ? result.originalName.substring(result.originalName.lastIndexOf('.') + 1)
      : '';

    let suggestedName = `${sanitizedTitle} (${metadata.year}).${ext}`;

    if (
      metadata.show &&
      metadata.season !== undefined &&
      metadata.episode !== undefined
    ) {
      const sanitizedShow = sanitizePathSegment(metadata.show);
      const sCode = `S${metadata.season.toString().padStart(2, '0')}E${metadata.episode.toString().padStart(2, '0')}`;
      const epTitle = (metadata as typeof metadata & { episodeTitle?: string })
        .episodeTitle;
      suggestedName = epTitle
        ? `${sanitizedShow} - ${sCode} - ${sanitizePathSegment(epTitle)}.${ext}`
        : `${sanitizedShow} - ${sCode}.${ext}`;
    }

    const updates: Partial<AnalysisResult> = {
      suggestedName,
      metadata: {
        ...metadata,
        year: metadata.year ?? '',
        title: sanitizedTitle,
      },
      reason: 'Manually Edited',
    };

    this.updateResult(result.filePath, updates);
  }

  updateResultFromMatch(result: AnalysisResult, match: TmdbMatchResult): void {
    const metadata: TmdbMetadata = {
      title: match.title,
      year: match.year,
      tmdbId: match.id,
      type: match.type === 'tv' ? 'tv' : 'movie',
    };

    if (
      match.type === 'tv' &&
      result.metadata?.season !== undefined &&
      result.metadata?.episode !== undefined
    ) {
      metadata.show = match.title;
      metadata.season = result.metadata.season;
      metadata.episode = result.metadata.episode;
    }

    this.updateResultFromMetadata(result, metadata);
    // Override reason if it's a match
    this.updateResult(result.filePath, { reason: 'Manually Matched via TMDB' });
  }

  async loadExistingResults(rootPath: string): Promise<void> {
    if (this._status() !== 'idle' && this._results().length > 0) return;

    try {
      this._status.set('scanning');
      const results =
        await this.electronService.loadOptimizationState(rootPath);

      if (results && results.length > 0) {
        this._results.set(results);
        this._status.set('reviewing');
      } else {
        this._status.set('idle');
      }
    } catch (err) {
      console.error('Failed to load existing results:', err);
      this._status.set('idle');
    }
  }

  async startQuickScan(
    rootPath: string,
    filter: 'both' | 'movie' | 'tv' = 'both',
  ): Promise<void> {
    this._status.set('scanning');
    this._results.set([]);
    this._error.set(null);

    try {
      // 1. Load cached results
      const cached = await this.electronService.loadOptimizationState(rootPath);
      if (cached && cached.length > 0) {
        this._results.set(cached);
      }

      // 2. Scan filesystem for NEW files
      const allFiles = await this.electronService.scanDirectoryAI(rootPath);
      const newFiles = allFiles.filter(
        (f) => !this._results().some((r) => r.filePath === f.path),
      );

      if (newFiles.length > 0) {
        await this.runAnalysis(newFiles, filter);
      } else {
        this._status.set('reviewing');
      }
    } catch (err) {
      console.error('Quick scan failed:', err);
      const message = err instanceof Error ? err.message : String(err);
      this._error.set(`Quick scan failed: ${message}`);
      this._status.set('idle');
    }
  }

  async startFullScan(
    rootPath: string,
    filter: 'both' | 'movie' | 'tv' = 'both',
  ): Promise<void> {
    this._status.set('scanning');
    this._results.set([]);
    this._error.set(null);

    try {
      const files = await this.electronService.scanDirectoryAI(rootPath);
      await this.runAnalysis(files, filter);
    } catch (err) {
      console.error('Full scan failed:', err);
      const message = err instanceof Error ? err.message : String(err);
      this._error.set(`Full scan failed: ${message}`);
      this._status.set('idle');
    }
  }

  cancelAnalysis(): void {
    this.electronService.cancelAnalysis();
    this._status.set('idle');
  }
}
