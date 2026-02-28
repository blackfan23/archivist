import { computed, Injectable, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import {
  AISettings,
  AnalysisResult,
  AppSettings,
  ArchivistApi,
  AudioTranscodeOptions,
  BatchResult,
  CleanerResultItem,
  ContainerFormat,
  DEFAULT_AI_SETTINGS,
  DEFAULT_SETTINGS,
  DeleteResult,
  EditorProgress,
  EditorResult,
  FilterState,
  GenerateRequest,
  GenerateResponse,
  LightweightFile,
  MatchFileResult,
  MediaFile,
  OmdbRating,
  QueueTask,
  ScanProgress,
  StorageData,
  SubtitleFormat,
  TmdbEpisodeDetails,
  TmdbMatchResult,
  TmdbMetadata,
  TmdbRating,
  VideoTranscodeOptions,
} from '@medularity/archivist-core';
import { Subject } from 'rxjs';

export * from '@medularity/archivist-core';

// Re-export types from electron models for use in Angular
// Re-export for convenience (alias)
export type MediaFileMetadata = TmdbMetadata;

@Injectable({ providedIn: 'root' })
export class ElectronService {
  private get electronAPI(): ArchivistApi {
    return window.electron as ArchivistApi;
  }
  // Scan progress signal
  private readonly _scanProgress = signal<ScanProgress>({
    status: 'idle',
    processedCount: 0,
    errorCount: 0,
  });

  readonly scanProgress = this._scanProgress.asReadonly();
  readonly scanProgress$ = toObservable(this.scanProgress);

  private readonly _backendErrors = signal<any[]>([]);

  readonly isScanning = computed(
    () => this._scanProgress().status === 'scanning',
  );

  // Analysis results stream
  private readonly _analysisResults$ = new Subject<AnalysisResult>();
  readonly analysisResults$ = this._analysisResults$.asObservable();

  // Queue events
  private readonly _queueTaskStarted$ = new Subject<{
    id: string;
    type: string;
  }>();
  readonly queueTaskStarted$ = this._queueTaskStarted$.asObservable();

  private readonly _queueTaskCompleted$ = new Subject<{ id: string }>();
  readonly queueTaskCompleted$ = this._queueTaskCompleted$.asObservable();

  private readonly _queueTaskFailed$ = new Subject<{
    id: string;
    error: string;
  }>();
  readonly queueTaskFailed$ = this._queueTaskFailed$.asObservable();

  private readonly _queueStatusChanged$ = new Subject<{ isActive: boolean }>();
  readonly queueStatusChanged$ = this._queueStatusChanged$.asObservable();

  private readonly _isEngineActive = signal(false);
  readonly isEngineActive = this._isEngineActive.asReadonly();

  readonly backendErrors = this._backendErrors.asReadonly();

  constructor() {
    // Set up scan progress listener
    if (this.isElectron()) {
      this.electronAPI.onScanProgress((_event: unknown, progress: unknown) => {
        this._scanProgress.set(progress as ScanProgress);
      });

      // Set up editor progress listener
      this.electronAPI.onEditorProgress(
        (_event: unknown, progress: unknown) => {
          this._editorProgress.set(progress as EditorProgress);
        },
      );

      // Set up backend error listener
      this.electronAPI.onBackendError((_event: unknown, error: any) => {
        console.error('[Backend Error]:', error);
        this._backendErrors.update((errors) => [...errors, error]);
      });

      // Set up analysis result listener
      this.electronAPI.onAnalysisResult(
        (_event: unknown, result: AnalysisResult) => {
          this._analysisResults$.next(result);
        },
      );

      // Set up queue events
      this.electronAPI.onQueueTaskStarted(
        (_event: unknown, data: { id: string; type: string }) => {
          this._queueTaskStarted$.next(data);
        },
      );

      this.electronAPI.onQueueTaskCompleted(
        (_event: unknown, data: { id: string }) => {
          this._queueTaskCompleted$.next(data);
        },
      );

      this.electronAPI.onQueueTaskFailed(
        (_event: unknown, data: { id: string; error: string }) => {
          this._queueTaskFailed$.next(data);
        },
      );

      this.electronAPI.onQueueStatusChanged(
        (_event: unknown, data: { isActive: boolean }) => {
          this._isEngineActive.set(data.isActive);
          this._queueStatusChanged$.next(data);
        },
      );
    }
  }

  isElectron(): boolean {
    return typeof window !== 'undefined' && !!window.electron;
  }

  async selectDirectory(): Promise<string | null> {
    if (!this.isElectron()) return null;
    return this.electronAPI.selectDirectory();
  }

  async selectDestination(): Promise<string | null> {
    if (!this.isElectron()) return null;
    return this.electronAPI.selectDestination();
  }

  async scanDirectory(
    path: string,
    forceFullScan = false,
  ): Promise<MediaFile[]> {
    if (!this.isElectron()) return [];

    this._scanProgress.set({
      status: 'scanning',
      processedCount: 0,
      errorCount: 0,
      startedAt: Date.now(),
    });

    try {
      const files = await this.electronAPI.scanDirectory(path, forceFullScan);
      return files as MediaFile[];
    } catch (error) {
      this._scanProgress.update((p) => ({
        ...p,
        status: 'error',
        errorMessage: error instanceof Error ? error.message : String(error),
      }));
      throw error;
    }
  }

  async cancelScan(): Promise<boolean> {
    if (!this.isElectron()) return false;
    return this.electronAPI.cancelScan();
  }

  /**
   * AI-mode lightweight scan — no ffprobe workers, returns LightweightFile[].
   * Use this instead of scanDirectory() when in AI analysis mode.
   */
  async scanDirectoryAI(path: string): Promise<LightweightFile[]> {
    if (!this.isElectron()) return [];

    this._scanProgress.set({
      status: 'scanning',
      processedCount: 0,
      errorCount: 0,
      startedAt: Date.now(),
    });

    try {
      const files = await this.electronAPI.scanDirectoryAI(path);
      this._scanProgress.update((p) => ({ ...p, status: 'completed' }));
      return files;
    } catch (error) {
      this._scanProgress.update((p) => ({
        ...p,
        status: 'error',
        errorMessage: error instanceof Error ? error.message : String(error),
      }));
      throw error;
    }
  }

  async cancelScanAI(): Promise<boolean> {
    if (!this.isElectron()) return false;
    return this.electronAPI.cancelScanAI();
  }

  async scanForCleanup(path: string): Promise<CleanerResultItem[]> {
    if (!this.isElectron()) return [];
    return this.electronAPI.scanForCleanup(path);
  }

  async cancelCleanerScan(): Promise<boolean> {
    if (!this.isElectron()) return false;
    return this.electronAPI.cancelCleanerScan();
  }

  async cancelAnalysis(): Promise<boolean> {
    if (!this.isElectron()) return false;
    return this.electronAPI.cancelAnalysis();
  }

  async getLibrary(): Promise<MediaFile[]> {
    if (!this.isElectron()) return [];
    const files = await this.electronAPI.getLibrary();
    return files as MediaFile[];
  }

  async getStorageData(): Promise<StorageData | null> {
    if (!this.isElectron()) return null;
    const data = await this.electronAPI.getStorageData();
    return data as StorageData;
  }

  async getLastScanPath(): Promise<string | null> {
    if (!this.isElectron()) return null;
    return this.electronAPI.getLastScanPath();
  }

  async clearLibrary(): Promise<boolean> {
    if (!this.isElectron()) return false;
    return this.electronAPI.clearLibrary();
  }

  async saveFilters(filters: FilterState): Promise<boolean> {
    if (!this.isElectron()) return false;
    return this.electronAPI.saveFilters(filters);
  }

  async renameFile(oldPath: string, newPath: string): Promise<boolean> {
    if (!this.isElectron()) return false;
    return this.electronAPI.renameFile(oldPath, newPath);
  }

  async moveFile(sourcePath: string, destDir: string): Promise<string | null> {
    if (!this.isElectron()) return null;
    return this.electronAPI.moveFile(sourcePath, destDir);
  }

  async batchRename(
    files: Array<{ oldPath: string; newPath: string }>,
  ): Promise<BatchResult | null> {
    if (!this.isElectron()) return null;
    const result = await this.electronAPI.batchRename(files);
    return result as BatchResult;
  }

  async batchMove(
    sourcePaths: string[],
    destDir: string,
  ): Promise<BatchResult | null> {
    if (!this.isElectron()) return null;
    const result = await this.electronAPI.batchMove(sourcePaths, destDir);
    return result as BatchResult;
  }

  async deleteFiles(
    filePaths: string[],
    deleteParentFolders = false,
  ): Promise<DeleteResult | null> {
    if (!this.isElectron()) return null;
    const result = await this.electronAPI.deleteFiles(
      filePaths,
      deleteParentFolders,
    );
    return result as DeleteResult;
  }

  async markAsClean(filePath: string): Promise<void> {
    if (!this.isElectron()) return;
    return this.electronAPI.markAsClean(filePath);
  }

  async loadOptimizationState(
    rootPath: string,
  ): Promise<AnalysisResult[] | null> {
    if (!this.isElectron()) return null;
    return this.electronAPI.loadOptimizationState(rootPath);
  }

  async showInFinder(filePath: string): Promise<void> {
    if (!this.isElectron()) return;
    await this.electronAPI.showInFinder(filePath);
  }

  async vlcCheckInstalled(customPath?: string): Promise<boolean> {
    if (!this.isElectron()) return false;
    return this.electronAPI.vlcCheckInstalled(customPath);
  }

  async vlcPlay(filePath: string, customPath?: string): Promise<void> {
    if (!this.isElectron()) return;
    await this.electronAPI.vlcPlay(filePath, customPath);
  }

  async renameFolder(oldPath: string, newPath: string): Promise<boolean> {
    if (!this.isElectron()) return false;
    return this.electronAPI.renameFolder(oldPath, newPath);
  }

  async deleteEmptyFolders(folderPaths: string[]): Promise<void> {
    if (!this.isElectron()) return;
    await this.electronAPI.deleteEmptyFolders(folderPaths);
  }

  async isDirectoryEmpty(folderPath: string): Promise<boolean> {
    if (!this.isElectron()) return false;
    return await this.electronAPI.isDirectoryEmpty(folderPath);
  }

  async getSettings(): Promise<AppSettings> {
    if (!this.isElectron()) return DEFAULT_SETTINGS;
    const settings = await this.electronAPI.getSettings();
    return settings as AppSettings;
  }

  async saveSettings(settings: AppSettings): Promise<boolean> {
    if (!this.isElectron()) return false;
    return this.electronAPI.saveSettings(settings);
  }

  async fullReset(): Promise<boolean> {
    if (!this.isElectron()) return false;
    return this.electronAPI.fullReset();
  }

  async resetAICache(): Promise<number> {
    if (!this.isElectron()) return 0;
    return this.electronAPI.resetAICache();
  }

  async fetchRatings(
    items: Array<{ title: string; year?: string }>,
  ): Promise<Record<string, OmdbRating | TmdbRating>> {
    if (!this.isElectron()) return {};
    const ratings = await this.electronAPI.fetchRatings(items);
    return ratings;
  }

  async requeryRating(item: {
    title: string;
    year?: string;
  }): Promise<OmdbRating | TmdbRating | null> {
    if (!this.isElectron()) return null;
    const rating = await this.electronAPI.requeryRating(item);
    return rating;
  }

  // AI Operations
  async aiGetSettings(): Promise<AISettings> {
    if (!this.isElectron()) {
      return DEFAULT_AI_SETTINGS;
    }
    return this.electronAPI.aiGetSettings();
  }

  async aiSaveSettings(settings: AISettings): Promise<boolean> {
    if (!this.isElectron()) return false;
    return this.electronAPI.aiSaveSettings(settings);
  }

  async aiGenerate(request: GenerateRequest): Promise<GenerateResponse> {
    if (!this.isElectron())
      return { text: '', error: 'Not in Electron environment' };
    const response = await this.electronAPI.aiGenerate(request);
    return response as GenerateResponse;
  }

  async aiTestConnection(
    settings?: AISettings,
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.isElectron())
      return { success: false, error: 'Not in Electron environment' };
    return this.electronAPI.aiTestConnection(settings);
  }

  async aiListOllamaModels(ollamaUrl: string): Promise<string[]> {
    if (!this.isElectron()) return [];
    return this.electronAPI.aiListOllamaModels(ollamaUrl);
  }

  async aiPullOllamaModel(ollamaUrl: string, model: string): Promise<void> {
    if (!this.isElectron()) return;
    return this.electronAPI.aiPullOllamaModel(ollamaUrl, model);
  }

  // TMDB Match methods
  async searchTmdb(query: string): Promise<TmdbMatchResult[]> {
    if (!this.isElectron()) return [];
    const results = await this.electronAPI.searchTmdb(query);
    return results as TmdbMatchResult[];
  }

  async getTvEpisode(
    tvId: number,
    season: number,
    episode: number,
  ): Promise<TmdbEpisodeDetails | null> {
    if (!this.isElectron()) return null;
    const details = await this.electronAPI.getTvEpisode(tvId, season, episode);
    return details as TmdbEpisodeDetails | null;
  }

  async matchFile(
    filePath: string,
    metadata: TmdbMetadata,
    embedMetadata: boolean,
  ): Promise<MatchFileResult> {
    if (!this.isElectron()) {
      return {
        newPath: filePath,
        success: false,
        error: 'Not in Electron environment',
      };
    }
    const result = await this.electronAPI.matchFile(
      filePath,
      metadata,
      embedMetadata,
    );
    return result as MatchFileResult;
  }

  async writeMetadata(
    filePath: string,
    metadata: TmdbMetadata,
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.isElectron()) {
      return { success: false, error: 'Not in Electron environment' };
    }
    const result = await this.electronAPI.writeMetadata(filePath, metadata);
    return result;
  }

  // API Key Validation
  async validateTmdbKey(
    apiKey: string,
  ): Promise<{ valid: boolean; error?: string }> {
    if (!this.isElectron()) {
      return { valid: false, error: 'Not in Electron environment' };
    }
    return this.electronAPI.validateTmdbKey(apiKey);
  }

  async validateOmdbKey(
    apiKey: string,
  ): Promise<{ valid: boolean; error?: string }> {
    if (!this.isElectron()) {
      return { valid: false, error: 'Not in Electron environment' };
    }
    return this.electronAPI.validateOmdbKey(apiKey);
  }

  async validateKeys(): Promise<{
    tmdb: { valid: boolean; error?: string };
    omdb: { valid: boolean; error?: string };
  }> {
    if (!this.isElectron()) {
      return {
        tmdb: { valid: false, error: 'Not in Electron environment' },
        omdb: { valid: false, error: 'Not in Electron environment' },
      };
    }
    return this.electronAPI.validateKeys();
  }

  // Queue Operations
  async queueAdd(type: string, payload: any): Promise<QueueTask> {
    if (!this.isElectron()) {
      throw new Error('Not in Electron environment');
    }
    return this.electronAPI.queueAdd(type, payload);
  }

  async queueRemove(id: string): Promise<void> {
    if (!this.isElectron()) return;
    return this.electronAPI.queueRemove(id);
  }

  async queueList(): Promise<QueueTask[]> {
    if (!this.isElectron()) return [];
    return this.electronAPI.queueList();
  }

  async queueClear(): Promise<void> {
    if (!this.isElectron()) return;
    return this.electronAPI.queueClear();
  }

  async queuePause(): Promise<void> {
    if (!this.isElectron()) return;
    return this.electronAPI.queuePause();
  }

  async queueResume(): Promise<void> {
    if (!this.isElectron()) return;
    return this.electronAPI.queueResume();
  }

  async queueIsActive(): Promise<boolean> {
    if (!this.isElectron()) return false;
    return this.electronAPI.queueIsActive();
  }

  // Analysis
  async analyzeFile(filePath: string): Promise<AnalysisResult> {
    if (!this.isElectron()) {
      return {
        filePath,
        originalName: '',
        suggestedName: '',
        isClean: false,
        score: 0,
        reason: 'Not in Electron environment',
        metadata: {
          title: '',
          year: '',
        },
      };
    }
    const result = await this.electronAPI.analyzeFile(filePath);
    return result as AnalysisResult;
  }

  async applyFix(result: AnalysisResult): Promise<string | null> {
    if (!this.isElectron()) {
      return null;
    }
    return this.electronAPI.applyFix(result);
  }

  async runAnalysis(
    files: LightweightFile[],
    filter: 'both' | 'movie' | 'tv' = 'both',
  ): Promise<void> {
    if (!this.isElectron()) return;
    return this.electronAPI.runAnalysis(files, filter);
  }

  // FFmpeg Editor Methods
  private readonly _editorProgress = signal<EditorProgress | null>(null);
  readonly editorProgress = this._editorProgress.asReadonly();

  async getMediaFileById(id: string): Promise<MediaFile | null> {
    if (!this.isElectron()) return null;
    const file = await this.electronAPI.getMediaFileById(id);
    return file as MediaFile | null;
  }

  async selectSubtitleFile(): Promise<string | null> {
    if (!this.isElectron()) return null;
    return this.electronAPI.selectSubtitleFile();
  }

  async convertContainer(
    filePath: string,
    format: ContainerFormat,
    duration?: number,
  ): Promise<EditorResult> {
    if (!this.isElectron()) {
      return { success: false, error: 'Not in Electron environment' };
    }
    this._editorProgress.set({ percent: 0 });
    const result = await this.electronAPI.convertContainer(
      filePath,
      format,
      duration,
    );
    this._editorProgress.set(null);
    return result as EditorResult;
  }

  async transcodeVideo(
    filePath: string,
    options: VideoTranscodeOptions,
    duration?: number,
  ): Promise<EditorResult> {
    if (!this.isElectron()) {
      return { success: false, error: 'Not in Electron environment' };
    }
    this._editorProgress.set({ percent: 0 });
    const result = await this.electronAPI.transcodeVideo(
      filePath,
      options,
      duration,
    );
    this._editorProgress.set(null);
    return result as EditorResult;
  }

  async transcodeAudio(
    filePath: string,
    options: AudioTranscodeOptions,
    duration?: number,
  ): Promise<EditorResult> {
    if (!this.isElectron()) {
      return { success: false, error: 'Not in Electron environment' };
    }
    this._editorProgress.set({ percent: 0 });
    const result = await this.electronAPI.transcodeAudio(
      filePath,
      options,
      duration,
    );
    this._editorProgress.set(null);
    return result as EditorResult;
  }

  async extractSubtitle(
    filePath: string,
    trackIndex: number,
    format: SubtitleFormat,
  ): Promise<EditorResult> {
    if (!this.isElectron()) {
      return { success: false, error: 'Not in Electron environment' };
    }
    const result = await this.electronAPI.extractSubtitle(
      filePath,
      trackIndex,
      format,
    );
    return result as EditorResult;
  }

  async addSubtitle(
    filePath: string,
    subtitlePath: string,
    language?: string,
    duration?: number,
  ): Promise<EditorResult> {
    if (!this.isElectron()) {
      return { success: false, error: 'Not in Electron environment' };
    }
    this._editorProgress.set({ percent: 0 });
    const result = await this.electronAPI.addSubtitle(
      filePath,
      subtitlePath,
      language,
      duration,
    );
    this._editorProgress.set(null);
    return result as EditorResult;
  }

  async removeSubtitle(
    filePath: string,
    trackIndex: number,
    duration?: number,
  ): Promise<EditorResult> {
    if (!this.isElectron()) {
      return { success: false, error: 'Not in Electron environment' };
    }
    this._editorProgress.set({ percent: 0 });
    const result = await this.electronAPI.removeSubtitle(
      filePath,
      trackIndex,
      duration,
    );
    this._editorProgress.set(null);
    return result as EditorResult;
  }

  async setDefaultSubtitle(
    filePath: string,
    trackIndex: number,
    duration?: number,
  ): Promise<EditorResult> {
    if (!this.isElectron()) {
      return { success: false, error: 'Not in Electron environment' };
    }
    this._editorProgress.set({ percent: 0 });
    const result = await this.electronAPI.setDefaultSubtitle(
      filePath,
      trackIndex,
      duration,
    );
    this._editorProgress.set(null);
    return result as EditorResult;
  }

  async runCustomCommand(command: string): Promise<EditorResult> {
    if (!this.isElectron()) {
      return { success: false, error: 'Not in Electron environment' };
    }
    this._editorProgress.set({ percent: 0 });
    const result = await this.electronAPI.runCustomCommand(command);
    this._editorProgress.set(null);
    return result as EditorResult;
  }

  async getCommandHistory(): Promise<string[]> {
    if (!this.isElectron()) return [];
    return this.electronAPI.getCommandHistory();
  }

  // Menu Integration
  updateMenuSelection(hasSelection: boolean, isSingleFile: boolean): void {
    if (!this.isElectron()) return;
    this.electronAPI.updateMenuSelection(hasSelection, isSingleFile);
  }

  onMenuAction(callback: (action: string) => void): void {
    if (!this.isElectron()) return;
    this.electronAPI.onMenuAction((_event: unknown, action: string) => {
      callback(action);
    });
  }

  removeMenuActionListener(): void {
    if (!this.isElectron()) return;
    this.electronAPI.removeMenuActionListener();
  }

  appReady(): void {
    if (this.isElectron()) {
      this.electronAPI.appReady();
    }
  }
}
