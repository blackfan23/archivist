import {
  Component,
  computed,
  inject,
  input,
  OnChanges,
  output,
  signal,
  SimpleChanges,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged, Subject, switchMap } from 'rxjs';
import {
  ElectronService,
  MediaFile,
  TmdbEpisodeDetails,
  TmdbMatchResult,
  TmdbMetadata,
} from '../../core/electron.service';
import { LanguageService } from '../../core/language.service';

@Component({
  selector: 'plex-match-dialog',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="overlay" (click)="close()">
      <div class="dialog" (click)="$event.stopPropagation()">
        <!-- Processing overlay -->
        @if (isProcessing()) {
          <div class="processing-overlay">
            <div class="spinner"></div>
            <span>{{ lang.translate('match.processing') }}</span>
          </div>
        }

        <header class="dialog-header">
          <h2>{{ lang.translate('match.title') }}</h2>
          <button
            class="close-btn"
            (click)="close()"
            [disabled]="isProcessing()"
          >
            ×
          </button>
        </header>

        <div class="dialog-body">
          <!-- Search input -->
          <div class="search-section">
            <input
              type="text"
              class="search-input"
              [placeholder]="lang.translate('match.searchPlaceholder')"
              [(ngModel)]="searchQuery"
              (ngModelChange)="onSearchChange($event)"
              [disabled]="isProcessing()"
            />
          </div>

          <!-- Type toggle for TV shows -->
          @if (selectedResult()) {
            @if (selectedResult()!.type === 'tv') {
              <div class="episode-inputs">
                <div class="input-group">
                  <label>{{ lang.translate('match.season') }}</label>
                  <input
                    type="number"
                    class="number-input"
                    [(ngModel)]="season"
                    min="1"
                    (ngModelChange)="onEpisodeChange()"
                    [disabled]="isProcessing()"
                  />
                </div>
                <div class="input-group">
                  <label>{{ lang.translate('match.episode') }}</label>
                  <input
                    type="number"
                    class="number-input"
                    [(ngModel)]="episode"
                    min="1"
                    (ngModelChange)="onEpisodeChange()"
                    [disabled]="isProcessing()"
                  />
                </div>
                @if (episodeDetails()) {
                  <div class="episode-title">
                    {{ episodeDetails()!.name }}
                  </div>
                }
              </div>
            }
          }

          <!-- Results list -->
          <div class="results-section">
            @if (isSearching()) {
              <div class="loading">{{ lang.translate('match.searching') }}</div>
            } @else if (searchResults().length === 0 && searchQuery) {
              <div class="no-results">
                {{ lang.translate('match.noResults') }}
              </div>
            } @else {
              <div class="results-grid">
                @for (result of searchResults(); track result.id) {
                  <div
                    class="result-card"
                    [class.selected]="selectedResult()?.id === result.id"
                    [class.disabled]="isProcessing()"
                    (click)="!isProcessing() && selectResult(result)"
                  >
                    @if (result.posterUrl) {
                      <img
                        [src]="result.posterUrl"
                        [alt]="result.title"
                        class="poster"
                      />
                    } @else {
                      <div class="no-poster">
                        <span>🎬</span>
                      </div>
                    }
                    <div class="result-info">
                      <span class="result-title">{{ result.title }}</span>
                      <span class="result-year">{{ result.year }}</span>
                      <span class="result-type">{{
                        result.type === 'movie' ? '🎬' : '📺'
                      }}</span>
                    </div>
                  </div>
                }
              </div>
            }
          </div>
        </div>

        <footer class="dialog-footer">
          @if (selectedResult()) {
            <div class="preview-row match-preview">
              @if (selectedResult()?.posterUrl) {
                <div class="poster-container">
                  <img
                    [src]="selectedResult()!.posterUrl"
                    class="result-poster"
                  />
                  <a
                    class="tmdb-link-overlay"
                    [href]="getTmdbUrl(selectedResult()!)"
                    target="_blank"
                    [title]="lang.translate('match.viewOnTmdb')"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <path
                        d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"
                      />
                      <polyline points="15 3 21 3 21 9" />
                      <line x1="10" y1="14" x2="21" y2="3" />
                    </svg>
                  </a>
                </div>
              }
              <div class="preview-details">
                <div class="preview-row">
                  <span class="label"
                    >{{ lang.translate('match.newFilename') }}:</span
                  >
                  <span class="preview-filename">{{ previewFilename() }}</span>
                </div>
                <label class="checkbox-label">
                  <input
                    type="checkbox"
                    [(ngModel)]="embedMetadata"
                    [disabled]="isProcessing()"
                  />
                  {{ lang.translate('match.embedMetadata') }}
                </label>
              </div>
            </div>
          }
          <div class="footer-buttons">
            <button
              class="btn secondary"
              (click)="close()"
              [disabled]="isProcessing()"
            >
              {{ lang.translate('action.cancel') }}
            </button>
            @if (showQueueButton()) {
              <button
                class="btn queue"
                [disabled]="!canConfirm() || isProcessing()"
                (click)="addToQueue()"
              >
                {{ lang.translate('queue.addToQueue') }}
              </button>
            }
            <button
              class="btn primary"
              [disabled]="!canConfirm() || isProcessing()"
              (click)="confirm()"
            >
              @if (isProcessing()) {
                <span class="btn-spinner"></span>
              }
              {{ lang.translate('action.save') }}
            </button>
          </div>
        </footer>
      </div>
    </div>
  `,
  styles: [
    `
      .overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
      }

      .dialog {
        position: relative;
        width: 90%;
        max-width: 700px;
        max-height: 80vh;
        background: var(--color-bg-secondary);
        border-radius: 12px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }

      .processing-overlay {
        position: absolute;
        inset: 0;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 1rem;
        z-index: 10;
        color: var(--color-text-primary);
        font-size: 1rem;
      }

      .spinner {
        width: 48px;
        height: 48px;
        border: 4px solid var(--color-bg-tertiary);
        border-top-color: var(--color-primary);
        border-radius: 50%;
        animation: spin 1s linear infinite;
      }

      .btn-spinner {
        display: inline-block;
        width: 14px;
        height: 14px;
        margin-right: 6px;
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-top-color: white;
        border-radius: 50%;
        animation: spin 1s linear infinite;
      }

      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }

      .dialog-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 1rem 1.5rem;
        border-bottom: 1px solid var(--color-border);
      }

      .dialog-header h2 {
        margin: 0;
        font-size: 1.25rem;
        font-weight: 600;
      }

      .close-btn {
        width: 32px;
        height: 32px;
        border: none;
        background: transparent;
        color: var(--color-text-secondary);
        font-size: 1.5rem;
        cursor: pointer;
        border-radius: 4px;
      }

      .close-btn:hover {
        background: var(--color-bg-tertiary);
        color: var(--color-text-primary);
      }

      .dialog-body {
        flex: 1;
        overflow-y: auto;
        padding: 1.5rem;
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }

      .search-section {
        display: flex;
        gap: 0.5rem;
      }

      .search-input {
        flex: 1;
        padding: 0.75rem 1rem;
        background: var(--color-bg-primary);
        border: 1px solid var(--color-border);
        border-radius: 8px;
        font-size: 1rem;
        color: var(--color-text-primary);
      }

      .search-input:focus {
        outline: none;
        border-color: var(--color-primary);
      }

      .episode-inputs {
        display: flex;
        gap: 1rem;
        align-items: center;
        padding: 0.75rem;
        background: var(--color-bg-tertiary);
        border-radius: 8px;
      }

      .input-group {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }

      .input-group label {
        font-size: 0.875rem;
        color: var(--color-text-secondary);
      }

      .number-input {
        width: 60px;
        padding: 0.375rem 0.5rem;
        background: var(--color-bg-primary);
        border: 1px solid var(--color-border);
        border-radius: 4px;
        font-size: 0.875rem;
        color: var(--color-text-primary);
        text-align: center;
      }

      .episode-title {
        flex: 1;
        font-size: 0.875rem;
        color: var(--color-primary);
        font-weight: 500;
      }

      .results-section {
        flex: 1;
        min-height: 200px;
      }

      .loading,
      .no-results {
        text-align: center;
        padding: 2rem;
        color: var(--color-text-secondary);
      }

      .results-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
        gap: 0.75rem;
      }

      .result-card {
        cursor: pointer;
        border-radius: 8px;
        overflow: hidden;
        background: var(--color-bg-tertiary);
        border: 2px solid transparent;
        transition: all 0.2s ease;
      }

      .result-card:hover:not(.disabled) {
        border-color: var(--color-text-secondary);
      }

      .result-card.disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .result-card.selected {
        border-color: var(--color-primary);
      }

      .poster {
        width: 100%;
        aspect-ratio: 2/3;
        object-fit: cover;
      }

      .no-poster {
        width: 100%;
        aspect-ratio: 2/3;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--color-bg-primary);
        font-size: 2rem;
      }

      .result-info {
        padding: 0.5rem;
        display: flex;
        flex-direction: column;
        gap: 0.125rem;
      }

      .result-title {
        font-size: 0.75rem;
        font-weight: 500;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .result-year {
        font-size: 0.625rem;
        color: var(--color-text-secondary);
      }

      .result-type {
        font-size: 0.625rem;
      }

      .preview-section {
        padding: 0.75rem;
        background: var(--color-bg-tertiary);
        border-radius: 8px;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }

      .preview-row {
        display: flex;
        gap: 0.5rem;
      }

      .label {
        font-size: 0.875rem;
        color: var(--color-text-secondary);
      }

      .preview-filename {
        font-size: 0.875rem;
        color: var(--color-primary);
        font-weight: 500;
        word-break: break-all;
      }

      .checkbox-label {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.875rem;
        color: var(--color-text-secondary);
        cursor: pointer;
      }

      .checkbox-label input {
        cursor: pointer;
      }

      .dialog-footer {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        padding: 1rem 1.5rem;
        border-top: 1px solid var(--color-border);
      }

      .dialog-footer .preview-section {
        margin-bottom: 0;
      }

      .footer-buttons {
        display: flex;
        justify-content: flex-end;
        gap: 0.75rem;
      }

      .btn {
        padding: 0.5rem 1rem;
        border: none;
        border-radius: 6px;
        font-size: 0.875rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .btn.secondary {
        background: var(--color-bg-tertiary);
        color: var(--color-text-primary);
      }

      .btn.secondary:hover {
        background: var(--color-bg-tertiary);
      }

      .btn.primary {
        background: var(--color-primary);
        color: white;
      }

      .btn.primary:hover:not(:disabled) {
        filter: brightness(1.1);
      }

      .btn.queue {
        background: var(--color-bg-tertiary);
        color: var(--color-primary);
        border: 1px solid var(--color-primary);
      }

      .btn.queue:hover:not(:disabled) {
        background: rgba(var(--accent-color-rgb), 0.1);
      }

      .btn.primary:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .match-preview {
        display: flex;
        gap: 1rem;
        align-items: flex-start;
      }

      .poster-container {
        position: relative;
        width: 60px;
        height: 90px;
        border-radius: 6px;
        overflow: hidden;
        flex-shrink: 0;
        border: 1px solid var(--color-border);
      }

      .result-poster {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .tmdb-link-overlay {
        position: absolute;
        inset: 0;
        background: rgba(0, 0, 0, 0.4);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        opacity: 0;
        transition: opacity 0.2s ease;
      }

      .poster-container:hover .tmdb-link-overlay {
        opacity: 1;
      }

      .tmdb-link-overlay svg {
        width: 16px;
        height: 16px;
      }

      .preview-details {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }
    `,
  ],
})
export class MatchDialogComponent implements OnChanges {
  private readonly electron = inject(ElectronService);
  protected readonly lang = inject(LanguageService);

  readonly file = input.required<MediaFile>();
  readonly suggestedName = input<string | undefined>();
  readonly showQueueButton = input(true);
  readonly closed = output<void>();
  readonly matched = output<{
    metadata: TmdbMetadata;
    embedMetadata: boolean;
  }>();
  readonly addedToQueue = output<{
    metadata: TmdbMetadata;
    embedMetadata: boolean;
  }>();

  searchQuery = '';
  season = 1;
  episode = 1;
  embedMetadata = false;

  readonly isSearching = signal(false);
  readonly isProcessing = signal(false);
  readonly searchResults = signal<TmdbMatchResult[]>([]);
  readonly selectedResult = signal<TmdbMatchResult | null>(null);
  readonly episodeDetails = signal<TmdbEpisodeDetails | null>(null);

  private readonly searchSubject = new Subject<string>();

  private readonly searchSubscription = this.searchSubject
    .pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(async (query) => {
        if (!query.trim()) {
          return [];
        }
        this.isSearching.set(true);
        try {
          return await this.electron.searchTmdb(query);
        } finally {
          this.isSearching.set(false);
        }
      }),
      takeUntilDestroyed(),
    )
    .subscribe((results) => {
      this.searchResults.set(results);
    });

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['file'] || changes['suggestedName']) && this.file()) {
      // Pre-fill search with suggested name if available, otherwise filename
      const sourceName = this.suggestedName() || this.file().filename;
      const cleanName = this.extractTitleFromFilename(sourceName);
      this.searchQuery = cleanName;
      this.onSearchChange(cleanName);
    }
  }

  readonly previewFilename = computed(() => {
    const result = this.selectedResult();
    if (!result) return '';

    const ext = this.file()?.extension || '.mkv';

    if (result.type === 'tv') {
      const ep = this.episodeDetails();
      const seasonStr = String(this.season).padStart(2, '0');
      const episodeStr = String(this.episode).padStart(2, '0');
      if (ep) {
        return `${result.title} - S${seasonStr}E${episodeStr} - ${ep.name}${ext}`;
      }
      return `${result.title} - S${seasonStr}E${episodeStr}${ext}`;
    }

    if (result.year) {
      return `${result.title} (${result.year})${ext}`;
    }
    return `${result.title}${ext}`;
  });

  getTmdbUrl(result: TmdbMatchResult): string {
    return `https://www.themoviedb.org/${result.type}/${result.id}`;
  }

  readonly canConfirm = computed(() => {
    const result = this.selectedResult();
    if (!result) return false;
    if (result.type === 'tv' && (!this.season || !this.episode)) return false;
    return true;
  });

  onSearchChange(query: string): void {
    this.searchSubject.next(query);
    this.selectedResult.set(null);
    this.episodeDetails.set(null);
  }

  selectResult(result: TmdbMatchResult): void {
    this.selectedResult.set(result);
    if (result.type === 'tv') {
      this.onEpisodeChange();
    }
  }

  async onEpisodeChange(): Promise<void> {
    const result = this.selectedResult();
    if (!result || result.type !== 'tv') return;

    if (this.season && this.episode) {
      const details = await this.electron.getTvEpisode(
        result.id,
        this.season,
        this.episode,
      );
      this.episodeDetails.set(details);
    }
  }

  close(): void {
    if (this.isProcessing()) return;
    this.closed.emit();
  }

  confirm(): void {
    if (this.isProcessing()) return;
    const result = this.selectedResult();
    if (!result) return;

    const metadata: TmdbMetadata = {
      title: result.title,
      year: result.year,
      description: result.overview,
    };

    if (result.type === 'tv') {
      metadata.show = result.title;
      metadata.season = this.season;
      metadata.episode = this.episode;
      metadata.episodeTitle = this.episodeDetails()?.name;
      metadata.title = metadata.episodeTitle || result.title;
    }

    this.isProcessing.set(true);
    this.matched.emit({ metadata, embedMetadata: this.embedMetadata });
  }

  /** Called by parent after operation completes */
  finishProcessing(): void {
    this.isProcessing.set(false);
  }

  addToQueue(): void {
    const result = this.selectedResult();
    if (!result) return;

    const metadata: TmdbMetadata = {
      title: result.title,
      year: result.year,
      description: result.overview,
    };

    if (result.type === 'tv') {
      metadata.show = result.title;
      metadata.season = this.season;
      metadata.episode = this.episode;
      metadata.episodeTitle = this.episodeDetails()?.name;
      metadata.title = metadata.episodeTitle || result.title;
    }

    this.addedToQueue.emit({ metadata, embedMetadata: this.embedMetadata });
  }

  private extractTitleFromFilename(filename: string): string {
    // Remove extension
    let name = filename.replace(/\.[^/.]+$/, '');

    // Remove common patterns
    name = name
      .replace(/\(?\d{4}\)?/g, '') // Remove year
      .replace(/S\d{1,2}E\d{1,2}/gi, '') // Remove season/episode
      .replace(/\d{3,4}p/gi, '') // Remove resolution
      .replace(/HDR|HEVC|x265|x264|BluRay|WEB-DL|WEBRip|HDTV/gi, '') // Remove quality tags
      .replace(/[\._-]+/g, ' ') // Replace separators with spaces
      .replace(/\s+/g, ' ') // Normalize spaces
      .trim();

    return name;
  }
}
