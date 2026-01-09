/// <reference path="./electron.d.ts" />
import { computed, inject, Injectable, NgZone, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';

// Re-export types from electron models for use in Angular
export interface VideoStream {
  index: number;
  codec: string;
  width: number;
  height: number;
  aspectRatio?: string;
  frameRate?: number;
  bitrate?: number;
  profile?: string;
  resolution: '4K' | '1080p' | '720p' | 'SD' | 'Unknown';
}

export interface AudioStream {
  index: number;
  codec: string;
  channels: number;
  channelType: 'Mono' | 'Stereo' | '5.1' | '7.1' | 'Atmos' | 'Unknown';
  language?: string;
  title?: string;
  bitrate?: number;
  sampleRate?: number;
  isDefault?: true;
}

export interface SubtitleStream {
  index: number;
  codec: string;
  language?: string;
  title?: string;
  isForced?: true;
  isDefault?: true;
}

export interface MediaFile {
  id: string;
  path: string;
  filename: string;
  directory: string;
  extension: string;
  sizeBytes: number;
  duration?: number;
  container?: string;
  bitrate?: number;
  videoStreams: VideoStream[];
  audioStreams: AudioStream[];
  subtitleStreams: SubtitleStream[];
  scannedAt: number;
  modifiedAt: number;
}

export interface ScanProgress {
  status: 'idle' | 'scanning' | 'completed' | 'cancelled' | 'error';
  currentFile?: string;
  processedCount: number;
  totalCount?: number;
  errorCount: number;
  errors?: Array<{ path: string; error: string }>;
  startedAt?: number;
  completedAt?: number;
  errorMessage?: string;
}

export interface BatchResult {
  successCount: number;
  failedCount: number;
  errors: Array<{ path: string; error: string }>;
}

export interface DeleteResult extends BatchResult {
  foldersDeleted: number;
  folderErrors: Array<{ path: string; error: string }>;
}

export type ResolutionCategory = '4K' | '1080p' | '720p' | 'SD' | 'Unknown';
export type AudioChannelType = 'Mono' | 'Stereo' | '5.1' | '7.1' | 'Atmos' | 'Unknown';
export type BitrateRange = 'Low' | 'Medium' | 'High' | 'Very High';

// Bitrate thresholds in bits per second
export const BITRATE_THRESHOLDS = {
  'Low': { min: 0, max: 5_000_000, label: '< 5 Mbps' },           // < 5 Mbps
  'Medium': { min: 5_000_000, max: 15_000_000, label: '5-15 Mbps' },   // 5-15 Mbps
  'High': { min: 15_000_000, max: 30_000_000, label: '15-30 Mbps' },   // 15-30 Mbps
  'Very High': { min: 30_000_000, max: Infinity, label: '> 30 Mbps' },  // > 30 Mbps
} as const;

export interface FilterState {
  resolutions: ResolutionCategory[];
  audioChannels: AudioChannelType[];
  audioLanguages: string[];
  videoCodecs: string[];
  bitrateRanges: BitrateRange[];
  customBitrateRange?: { minMbps: number; maxMbps: number } | null;
  searchQuery?: string;
  sortBy?: 'filename' | 'size' | 'duration' | 'resolution' | 'bitrate' | 'rating' | 'modified';
  sortDirection?: 'asc' | 'desc';
}

export interface StorageData {
  mediaLibrary: MediaFile[];
  lastScanPath: string | null;
  lastScanAt: number | null;
  filters?: FilterState;
  settings?: AppSettings;
}

// Theme and App Settings
export type Theme = 'dark' | 'light';
export type RatingProvider = 'omdb' | 'tmdb';

export interface AppSettings {
  theme: Theme;
  language: string;
  alwaysDeleteEnclosingFolder?: true;
  omdbApiKey?: string;
  tmdbApiKey?: string;
  ratingProvider?: RatingProvider;
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  language: 'en',
  alwaysDeleteEnclosingFolder: undefined,
  omdbApiKey: '',
  tmdbApiKey: '',
  ratingProvider: 'omdb',
};

export interface OmdbRating {
  imdbID: string;
  Title: string;
  Year: string;
  Rated: string;
  Released: string;
  Runtime: string;
  Genre: string;
  Director: string;
  Writer: string;
  Actors: string;
  Plot: string;
  Language: string;
  Country: string;
  Awards: string;
  Poster: string;
  Ratings: Array<{ Source: string; Value: string }>;
  Metascore: string;
  imdbRating: string;
  imdbVotes: string;
  Type: string;
  DVD: string;
  BoxOffice: string;
  Production: string;
  Website: string;
  Response: string;
  fetchedAt: number;
  notFound?: true; // True if movie was not found in API
  searchedTitle?: string; // The title that was searched for (for user to correct)
}

// TMDB Match types
export interface TmdbMatchResult {
  id: number;
  type: 'movie' | 'tv';
  title: string;
  year: string;
  rating: number;
  posterUrl: string | null;
  overview: string;
}

export interface TmdbEpisodeDetails {
  id: number;
  name: string;
  episode_number: number;
  season_number: number;
  air_date: string;
  overview: string;
  still_path: string | null;
  vote_average: number;
}

export interface TmdbMetadata {
  title: string;
  year?: string;
  description?: string;
  show?: string;
  season?: number;
  episode?: number;
  episodeTitle?: string;
}

export interface MatchFileResult {
  newPath: string;
  success: boolean;
  error?: string;
}

// FFmpeg Editor types
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

export type ContainerFormat = 'mkv' | 'mp4' | 'avi' | 'mov' | 'webm' | 'ts';
export type VideoCodec = 'copy' | 'h264' | 'h265' | 'vp9' | 'av1';
export type AudioCodec = 'copy' | 'aac' | 'ac3' | 'mp3' | 'flac' | 'opus';
export type SubtitleFormat = 'srt' | 'ass' | 'vtt';

export interface VideoTranscodeOptions {
  codec: VideoCodec;
  crf?: number;
  bitrate?: number;
  preset?: 'ultrafast' | 'superfast' | 'veryfast' | 'faster' | 'fast' | 'medium' | 'slow' | 'slower' | 'veryslow';
}

export interface AudioTranscodeOptions {
  codec: AudioCodec;
  bitrate?: number;
  channels?: number;
  sampleRate?: number;
}

// Re-export for convenience (alias)
export type MediaFileMetadata = TmdbMetadata;

@Injectable({ providedIn: 'root' })
export class ElectronService {
  private readonly zone = inject(NgZone);
  
  // Scan progress signal
  private readonly _scanProgress = signal<ScanProgress>({
    status: 'idle',
    processedCount: 0,
    errorCount: 0,
  });
  
  readonly scanProgress = this._scanProgress.asReadonly();
  readonly scanProgress$ = toObservable(this.scanProgress);
  
  readonly isScanning = computed(() => this._scanProgress().status === 'scanning');
  
  constructor() {
    // Set up scan progress listener
    if (this.isElectron()) {
      window.electron!.onScanProgress((_event: unknown, progress: unknown) => {
        this.zone.run(() => {
          this._scanProgress.set(progress as ScanProgress);
        });
      });
      
      // Set up editor progress listener
      window.electron!.onEditorProgress((_event: unknown, progress: unknown) => {
        this.zone.run(() => {
          this._editorProgress.set(progress as EditorProgress);
        });
      });
    }
  }
  
  isElectron(): boolean {
    return typeof window !== 'undefined' && !!window.electron;
  }
  
  async selectDirectory(): Promise<string | null> {
    if (!this.isElectron()) return null;
    return window.electron!.selectDirectory();
  }
  
  async selectDestination(): Promise<string | null> {
    if (!this.isElectron()) return null;
    return window.electron!.selectDestination();
  }
  
  async scanDirectory(path: string, forceFullScan = false): Promise<MediaFile[]> {
    if (!this.isElectron()) return [];
    
    this._scanProgress.set({
      status: 'scanning',
      processedCount: 0,
      errorCount: 0,
      startedAt: Date.now(),
    });
    
    try {
      const files = await window.electron!.scanDirectory(path, forceFullScan);
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
    return window.electron!.cancelScan();
  }
  
  async getLibrary(): Promise<MediaFile[]> {
    if (!this.isElectron()) return [];
    const files = await window.electron!.getLibrary();
    return files as MediaFile[];
  }
  
  async getStorageData(): Promise<StorageData | null> {
    if (!this.isElectron()) return null;
    const data = await window.electron!.getStorageData();
    return data as StorageData;
  }
  
  async getLastScanPath(): Promise<string | null> {
    if (!this.isElectron()) return null;
    return window.electron!.getLastScanPath();
  }
  
  async clearLibrary(): Promise<boolean> {
    if (!this.isElectron()) return false;
    return window.electron!.clearLibrary();
  }
  
  async saveFilters(filters: FilterState): Promise<boolean> {
    if (!this.isElectron()) return false;
    return window.electron!.saveFilters(filters);
  }
  
  async renameFile(oldPath: string, newPath: string): Promise<boolean> {
    if (!this.isElectron()) return false;
    return window.electron!.renameFile(oldPath, newPath);
  }
  
  async moveFile(sourcePath: string, destDir: string): Promise<string | null> {
    if (!this.isElectron()) return null;
    return window.electron!.moveFile(sourcePath, destDir);
  }
  
  async batchRename(files: Array<{ oldPath: string; newPath: string }>): Promise<BatchResult | null> {
    if (!this.isElectron()) return null;
    const result = await window.electron!.batchRename(files);
    return result as BatchResult;
  }
  
  async batchMove(sourcePaths: string[], destDir: string): Promise<BatchResult | null> {
    if (!this.isElectron()) return null;
    const result = await window.electron!.batchMove(sourcePaths, destDir);
    return result as BatchResult;
  }
  
  async deleteFiles(filePaths: string[], deleteParentFolders = false): Promise<DeleteResult | null> {
    if (!this.isElectron()) return null;
    const result = await window.electron!.deleteFiles(filePaths, deleteParentFolders);
    return result as DeleteResult;
  }
  
  async showInFinder(filePath: string): Promise<void> {
    if (!this.isElectron()) return;
    await window.electron!.showInFinder(filePath);
  }
  
  async renameFolder(oldPath: string, newPath: string): Promise<boolean> {
    if (!this.isElectron()) return false;
    return window.electron!.renameFolder(oldPath, newPath);
  }
  
  async deleteEmptyFolders(folderPaths: string[]): Promise<void> {
    if (!this.isElectron()) return;
    await window.electron!.deleteEmptyFolders(folderPaths);
  }
  
  async getSettings(): Promise<AppSettings> {
    if (!this.isElectron()) return DEFAULT_SETTINGS;
    const settings = await window.electron!.getSettings();
    return settings as AppSettings;
  }
  
  async saveSettings(settings: AppSettings): Promise<boolean> {
    if (!this.isElectron()) return false;
    return window.electron!.saveSettings(settings);
  }
  async fetchRatings(items: Array<{ title: string; year?: string }>): Promise<Record<string, OmdbRating>> {
    if (!this.isElectron()) return {};
    const ratings = await window.electron!.fetchRatings(items);
    return ratings as Record<string, OmdbRating>;
  }

  async requeryRating(item: { title: string; year?: string }): Promise<OmdbRating | null> {
    if (!this.isElectron()) return null;
    const rating = await window.electron!.requeryRating(item);
    return rating as OmdbRating | null;
  }

  // TMDB Match methods
  async searchTmdb(query: string): Promise<TmdbMatchResult[]> {
    if (!this.isElectron()) return [];
    const results = await window.electron!.searchTmdb(query);
    return results as TmdbMatchResult[];
  }

  async getTvEpisode(tvId: number, season: number, episode: number): Promise<TmdbEpisodeDetails | null> {
    if (!this.isElectron()) return null;
    const details = await window.electron!.getTvEpisode(tvId, season, episode);
    return details as TmdbEpisodeDetails | null;
  }

  async matchFile(filePath: string, metadata: TmdbMetadata, embedMetadata: boolean): Promise<MatchFileResult> {
    if (!this.isElectron()) {
      return { newPath: filePath, success: false, error: 'Not in Electron environment' };
    }
    const result = await window.electron!.matchFile(filePath, metadata, embedMetadata);
    return result as MatchFileResult;
  }

  async writeMetadata(filePath: string, metadata: TmdbMetadata): Promise<{ success: boolean; error?: string }> {
    if (!this.isElectron()) {
      return { success: false, error: 'Not in Electron environment' };
    }
    const result = await window.electron!.writeMetadata(filePath, metadata);
    return result;
  }

  // API Key Validation
  async validateTmdbKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
    if (!this.isElectron()) {
      return { valid: false, error: 'Not in Electron environment' };
    }
    return window.electron!.validateTmdbKey(apiKey);
  }

  async validateOmdbKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
    if (!this.isElectron()) {
      return { valid: false, error: 'Not in Electron environment' };
    }
    return window.electron!.validateOmdbKey(apiKey);
  }

  // FFmpeg Editor Methods
  private readonly _editorProgress = signal<EditorProgress | null>(null);
  readonly editorProgress = this._editorProgress.asReadonly();
  
  async getMediaFileById(id: string): Promise<MediaFile | null> {
    if (!this.isElectron()) return null;
    const file = await window.electron!.getMediaFileById(id);
    return file as MediaFile | null;
  }
  
  async selectSubtitleFile(): Promise<string | null> {
    if (!this.isElectron()) return null;
    return window.electron!.selectSubtitleFile();
  }
  
  async convertContainer(filePath: string, format: ContainerFormat, duration?: number): Promise<EditorResult> {
    if (!this.isElectron()) {
      return { success: false, error: 'Not in Electron environment' };
    }
    this._editorProgress.set({ percent: 0 });
    const result = await window.electron!.convertContainer(filePath, format, duration);
    this._editorProgress.set(null);
    return result as EditorResult;
  }
  
  async transcodeVideo(filePath: string, options: VideoTranscodeOptions, duration?: number): Promise<EditorResult> {
    if (!this.isElectron()) {
      return { success: false, error: 'Not in Electron environment' };
    }
    this._editorProgress.set({ percent: 0 });
    const result = await window.electron!.transcodeVideo(filePath, options, duration);
    this._editorProgress.set(null);
    return result as EditorResult;
  }
  
  async transcodeAudio(filePath: string, options: AudioTranscodeOptions, duration?: number): Promise<EditorResult> {
    if (!this.isElectron()) {
      return { success: false, error: 'Not in Electron environment' };
    }
    this._editorProgress.set({ percent: 0 });
    const result = await window.electron!.transcodeAudio(filePath, options, duration);
    this._editorProgress.set(null);
    return result as EditorResult;
  }
  
  async extractSubtitle(filePath: string, trackIndex: number, format: SubtitleFormat): Promise<EditorResult> {
    if (!this.isElectron()) {
      return { success: false, error: 'Not in Electron environment' };
    }
    const result = await window.electron!.extractSubtitle(filePath, trackIndex, format);
    return result as EditorResult;
  }
  
  async addSubtitle(filePath: string, subtitlePath: string, language?: string, duration?: number): Promise<EditorResult> {
    if (!this.isElectron()) {
      return { success: false, error: 'Not in Electron environment' };
    }
    this._editorProgress.set({ percent: 0 });
    const result = await window.electron!.addSubtitle(filePath, subtitlePath, language, duration);
    this._editorProgress.set(null);
    return result as EditorResult;
  }
  
  async removeSubtitle(filePath: string, trackIndex: number, duration?: number): Promise<EditorResult> {
    if (!this.isElectron()) {
      return { success: false, error: 'Not in Electron environment' };
    }
    this._editorProgress.set({ percent: 0 });
    const result = await window.electron!.removeSubtitle(filePath, trackIndex, duration);
    this._editorProgress.set(null);
    return result as EditorResult;
  }
  
  async setDefaultSubtitle(filePath: string, trackIndex: number, duration?: number): Promise<EditorResult> {
    if (!this.isElectron()) {
      return { success: false, error: 'Not in Electron environment' };
    }
    this._editorProgress.set({ percent: 0 });
    const result = await window.electron!.setDefaultSubtitle(filePath, trackIndex, duration);
    this._editorProgress.set(null);
    return result as EditorResult;
  }
  
  async runCustomCommand(command: string): Promise<EditorResult> {
    if (!this.isElectron()) {
      return { success: false, error: 'Not in Electron environment' };
    }
    this._editorProgress.set({ percent: 0 });
    const result = await window.electron!.runCustomCommand(command);
    this._editorProgress.set(null);
    return result as EditorResult;
  }
  
  async getCommandHistory(): Promise<string[]> {
    if (!this.isElectron()) return [];
    return window.electron!.getCommandHistory();
  }
  
  // Menu Integration
  updateMenuSelection(hasSelection: boolean, isSingleFile: boolean): void {
    if (!this.isElectron()) return;
    window.electron!.updateMenuSelection(hasSelection, isSingleFile);
  }
  
  onMenuAction(callback: (action: string) => void): void {
    if (!this.isElectron()) return;
    window.electron!.onMenuAction((_event: unknown, action: string) => {
      this.zone.run(() => {
        callback(action);
      });
    });
  }
  
  removeMenuActionListener(): void {
    if (!this.isElectron()) return;
    window.electron!.removeMenuActionListener();
  }
}
