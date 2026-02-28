import { computed, inject, Injectable, signal } from '@angular/core';
import {
  MediaFile,
  sanitizePathSegment,
  TmdbMetadata,
} from '@medularity/archivist-core';
import { ElectronService } from './electron.service';
import { MediaStore } from './media.store';

export interface QueuedMatch {
  id: string;
  file: MediaFile;
  metadata: TmdbMetadata;
  suggestedName?: string;
  seriesRoot?: string;
  embedMetadata: boolean;
  status: 'pending' | 'processing' | 'success' | 'error';
  error?: string;
  previewFilename: string;
}

@Injectable({ providedIn: 'root' })
export class MatchQueueStore {
  private readonly electron = inject(ElectronService);
  private readonly mediaStore = inject(MediaStore);

  private readonly _queue = signal<QueuedMatch[]>([]);
  private readonly _showPanel = signal(false);

  constructor() {
    this.syncWithBackend();
    this.initEventListeners();
    this.syncEngineStatus();
  }

  private async syncEngineStatus(): Promise<void> {
    if (!this.electron.isElectron()) return;
    const isActive = await this.electron.queueIsActive();
    // We don't have a local signal for engine status yet, let's use the one from ElectronService or add one.
    // Actually, MatchQueueStore should probably just expose it from ElectronService.
  }

  private initEventListeners(): void {
    if (!this.electron.isElectron()) return;

    this.electron.queueTaskStarted$.subscribe((data) => {
      this._queue.update((queue) =>
        queue.map((item) =>
          item.id === data.id ? { ...item, status: 'processing' } : item,
        ),
      );
    });

    this.electron.queueTaskCompleted$.subscribe(async (data) => {
      this._queue.update((queue) =>
        queue.map((item) =>
          item.id === data.id ? { ...item, status: 'success' } : item,
        ),
      );

      // File is successfully completed in the backend.
      // We intentionally do not trigger a full directory rescan here
      // because processing a batch of items would freeze the application.
    });

    this.electron.queueTaskFailed$.subscribe((data) => {
      this._queue.update((queue) =>
        queue.map((item) =>
          item.id === data.id
            ? { ...item, status: 'error', error: data.error }
            : item,
        ),
      );
    });
  }

  private async syncWithBackend(): Promise<void> {
    if (!this.electron.isElectron()) return;
    try {
      const tasks = await this.electron.queueList();
      console.log(
        '[MatchQueueStore] Synced with backend:',
        tasks.length,
        'tasks',
      );

      const queuedMatches: QueuedMatch[] = tasks.map((task) => {
        const payload = task.payload as any; // This is the fix info
        return {
          id: task.id,
          file: {
            id: payload.filePath,
            path: payload.filePath,
            filename: payload.originalName,
            directory: payload.filePath.substring(
              0,
              payload.filePath.lastIndexOf('/'),
            ),
            extension: payload.originalName.substring(
              payload.originalName.lastIndexOf('.'),
            ),
            sizeBytes: 0,
            modifiedAt: 0,
            scannedAt: 0,
            videoStreams: [],
            audioStreams: [],
            subtitleStreams: [],
          },
          metadata: payload.metadata,
          suggestedName: payload.suggestedName,
          seriesRoot: payload.seriesRoot,
          embedMetadata: true, // Default for now
          status: task.status,
          error: task.error,
          previewFilename: payload.suggestedName,
        };
      });

      this._queue.set(queuedMatches);
    } catch (error) {
      console.error('[MatchQueueStore] Sync failed:', error);
    }
  }

  readonly queue = this._queue.asReadonly();
  readonly showPanel = this._showPanel.asReadonly();
  readonly isEngineActive = this.electron.isEngineActive;

  readonly queueCount = computed(
    () => this._queue().filter((item) => item.status === 'pending').length,
  );

  readonly totalCount = computed(() => this._queue().length);

  readonly isProcessing = computed(() =>
    this._queue().some((item) => item.status === 'processing'),
  );

  readonly progress = computed(() => {
    const total = this._queue().length;
    const completed = this._queue().filter(
      (item) => item.status === 'success' || item.status === 'error',
    ).length;
    return {
      current: completed,
      total,
    };
  });

  readonly hasItems = computed(() => this._queue().length > 0);

  readonly finishedCount = computed(
    () =>
      this._queue().filter(
        (item) => item.status === 'success' || item.status === 'error',
      ).length,
  );

  async addToQueue(
    file: MediaFile,
    metadata: TmdbMetadata,
    embedMetadata: boolean,
    suggestedName?: string,
    seriesRoot?: string,
  ): Promise<void> {
    const previewFilename =
      suggestedName || this.generatePreviewFilename(file, metadata);

    const payload = {
      filePath: file.path,
      originalName: file.filename,
      suggestedName: suggestedName || previewFilename,
      seriesRoot,
      metadata: {
        ...metadata,
        year: metadata.year || '',
      },
      score: 1,
      isClean: false,
      reason: 'Manual Match Queue',
    };

    const task = await this.electron.queueAdd('fix-match', payload);

    const item: QueuedMatch = {
      id: task.id,
      file,
      metadata,
      suggestedName,
      seriesRoot,
      embedMetadata,
      status: 'pending',
      previewFilename,
    };

    this._queue.update((queue) => [...queue, item]);
  }

  async removeFromQueue(id: string): Promise<void> {
    await this.electron.queueRemove(id);
    this._queue.update((queue) => queue.filter((item) => item.id !== id));
  }

  async clearQueue(): Promise<void> {
    if (this.isProcessing()) return;
    await this.electron.queueClear();
    // Only remove finished items (success or error), keep pending items
    this._queue.update((queue) =>
      queue.filter((item) => item.status === 'pending'),
    );
  }

  openPanel(): void {
    this._showPanel.set(true);
  }

  closePanel(): void {
    this._showPanel.set(false);
  }

  async processQueue(): Promise<void> {
    if (this._queue().length === 0) return;
    await this.electron.queueResume();
  }

  async pauseEngine(): Promise<void> {
    await this.electron.queuePause();
  }

  async resumeEngine(): Promise<void> {
    await this.electron.queueResume();
  }

  private generatePreviewFilename(
    file: MediaFile,
    metadata: TmdbMetadata,
  ): string {
    const ext = file.extension || '.mkv';

    if (
      metadata.show &&
      metadata.season !== undefined &&
      metadata.episode !== undefined
    ) {
      const sanitizedShow = sanitizePathSegment(metadata.show);
      const seasonStr = String(metadata.season).padStart(2, '0');
      const episodeStr = String(metadata.episode).padStart(2, '0');
      if (metadata.episodeTitle) {
        const sanitizedEpisode = sanitizePathSegment(metadata.episodeTitle);
        return `${sanitizedShow} - S${seasonStr}E${episodeStr} - ${sanitizedEpisode}${ext}`;
      }
      return `${sanitizedShow} - S${seasonStr}E${episodeStr}${ext}`;
    }

    const sanitizedTitle = sanitizePathSegment(metadata.title);
    if (metadata.year) {
      return `${sanitizedTitle} (${metadata.year})${ext}`;
    }
    return `${sanitizedTitle}${ext}`;
  }
}
