import { computed, inject, Injectable, signal } from '@angular/core';
import { CleanerResultItem } from '@medularity/archivist-core';
import { ElectronService } from './electron.service';

export type CleanerStatus =
  | 'idle'
  | 'scanning'
  | 'reviewing'
  | 'deleting'
  | 'completed';

export interface CleanerState {
  status: CleanerStatus;
  results: CleanerResultItem[];
  error: string | null;
}

const initialState: CleanerState = {
  status: 'idle',
  results: [],
  error: null,
};

@Injectable({ providedIn: 'root' })
export class CleanerStore {
  private readonly electronService = inject(ElectronService);

  // State signals
  private readonly _status = signal<CleanerStatus>(initialState.status);
  private readonly _results = signal<CleanerResultItem[]>(initialState.results);
  private readonly _error = signal<string | null>(initialState.error);

  // Public signals
  readonly status = this._status.asReadonly();
  readonly results = this._results.asReadonly();
  readonly error = this._error.asReadonly();

  // Computed signals
  readonly isScanning = computed(() => this.status() === 'scanning');
  readonly isDeleting = computed(() => this.status() === 'deleting');
  readonly hasResults = computed(() => this.results().length > 0);

  readonly emptyFolders = computed(() =>
    this.results().filter((r) => r.type === 'folder'),
  );

  readonly smallFiles = computed(() =>
    this.results().filter((r) => r.type === 'file' && !r.isSample),
  );

  readonly sampleFiles = computed(() =>
    this.results().filter((r) => r.type === 'file' && r.isSample),
  );

  async scan(path: string): Promise<void> {
    this._status.set('scanning');
    this._results.set([]);
    this._error.set(null);

    try {
      const results = await this.electronService.scanForCleanup(path);
      // Small artificial delay to ensure the UI transition is visible to the user
      await new Promise((resolve) => setTimeout(resolve, 400));
      this._results.set(results);
      this._status.set('reviewing');
    } catch (err) {
      console.error('Cleanup scan failed:', err);
      const message = err instanceof Error ? err.message : String(err);
      this._error.set(message);
      this._status.set('idle');
    }
  }

  cancel(): void {
    this.electronService.cancelCleanerScan();
    this._status.set('idle');
  }

  async deleteSelected(paths: string[]): Promise<void> {
    if (paths.length === 0) return;

    this._status.set('deleting');
    try {
      const result = await this.electronService.deleteFiles(paths, false);

      // Update results to remove successfully deleted items
      if (result) {
        const deletedPaths = paths.filter(
          (p) => !result.errors.some((e) => e.path === p),
        );
        this._results.update((current) =>
          current.filter((item) => !deletedPaths.includes(item.path)),
        );
      }

      this._status.set('reviewing');
    } catch (err) {
      console.error('Delete operation failed:', err);
      this._error.set('Failed to delete selected items.');
      this._status.set('reviewing');
    }
  }

  reset(): void {
    this._status.set(initialState.status);
    this._results.set(initialState.results);
    this._error.set(initialState.error);
  }
}
