import { computed, inject, Injectable, signal } from '@angular/core';
import { ElectronService, MediaFile, TmdbMetadata } from './electron.service';
import { MediaStore } from './media.store';

export interface QueuedMatch {
  id: string;
  file: MediaFile;
  metadata: TmdbMetadata;
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
  private readonly _isProcessing = signal(false);
  private readonly _currentIndex = signal(0);
  private readonly _showPanel = signal(false);

  readonly queue = this._queue.asReadonly();
  readonly isProcessing = this._isProcessing.asReadonly();
  readonly showPanel = this._showPanel.asReadonly();

  readonly queueCount = computed(() => 
    this._queue().filter(item => item.status === 'pending').length
  );

  readonly totalCount = computed(() => this._queue().length);

  readonly progress = computed(() => ({
    current: this._currentIndex(),
    total: this._queue().length,
  }));

  readonly hasItems = computed(() => this._queue().length > 0);

  readonly finishedCount = computed(() => 
    this._queue().filter(item => item.status === 'success' || item.status === 'error').length
  );

  addToQueue(file: MediaFile, metadata: TmdbMetadata, embedMetadata: boolean): void {
    const previewFilename = this.generatePreviewFilename(file, metadata);
    
    const item: QueuedMatch = {
      id: crypto.randomUUID(),
      file,
      metadata,
      embedMetadata,
      status: 'pending',
      previewFilename,
    };

    this._queue.update(queue => [...queue, item]);
  }

  removeFromQueue(id: string): void {
    this._queue.update(queue => queue.filter(item => item.id !== id));
  }

  clearQueue(): void {
    if (this._isProcessing()) return;
    // Only remove finished items (success or error), keep pending items
    this._queue.update(queue => 
      queue.filter(item => item.status === 'pending')
    );
  }

  openPanel(): void {
    this._showPanel.set(true);
  }

  closePanel(): void {
    this._showPanel.set(false);
  }

  async processQueue(): Promise<void> {
    if (this._isProcessing() || this._queue().length === 0) return;

    this._isProcessing.set(true);
    this._currentIndex.set(0);

    const queue = this._queue();

    for (let i = 0; i < queue.length; i++) {
      const item = queue[i];
      if (item.status !== 'pending') continue;

      this._currentIndex.set(i + 1);

      // Update status to processing
      this._queue.update(q => 
        q.map(qItem => 
          qItem.id === item.id 
            ? { ...qItem, status: 'processing' as const }
            : qItem
        )
      );

      try {
        const result = await this.electron.matchFile(
          item.file.path,
          item.metadata,
          item.embedMetadata
        );

        if (result.success) {
          // Update store with new path if changed
          if (result.newPath !== item.file.path) {
            this.mediaStore.updateFilePath(item.file.id, result.newPath);
          }

          // Mark as success
          this._queue.update(q =>
            q.map(qItem =>
              qItem.id === item.id
                ? { ...qItem, status: 'success' as const }
                : qItem
            )
          );
        } else {
          // Mark as error
          this._queue.update(q =>
            q.map(qItem =>
              qItem.id === item.id
                ? { ...qItem, status: 'error' as const, error: result.error }
                : qItem
            )
          );
        }
      } catch (error) {
        // Mark as error
        this._queue.update(q =>
          q.map(qItem =>
            qItem.id === item.id
              ? { 
                  ...qItem, 
                  status: 'error' as const, 
                  error: error instanceof Error ? error.message : String(error)
                }
              : qItem
          )
        );
      }
    }

    this._isProcessing.set(false);

    // Always trigger incremental rescan after queue processing
    // (fast since it only re-probes modified files)
    const lastScanPath = await this.electron.getLastScanPath();
    if (lastScanPath) {
      await this.mediaStore.scanDirectory(lastScanPath);
    }
  }

  private generatePreviewFilename(file: MediaFile, metadata: TmdbMetadata): string {
    const ext = file.extension || '.mkv';

    if (metadata.show && metadata.season !== undefined && metadata.episode !== undefined) {
      const seasonStr = String(metadata.season).padStart(2, '0');
      const episodeStr = String(metadata.episode).padStart(2, '0');
      if (metadata.episodeTitle) {
        return `${metadata.show} - S${seasonStr}E${episodeStr} - ${metadata.episodeTitle}${ext}`;
      }
      return `${metadata.show} - S${seasonStr}E${episodeStr}${ext}`;
    }

    if (metadata.year) {
      return `${metadata.title} (${metadata.year})${ext}`;
    }
    return `${metadata.title}${ext}`;
  }
}
