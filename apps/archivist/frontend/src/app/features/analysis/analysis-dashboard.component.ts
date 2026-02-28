import {
  Component,
  computed,
  effect,
  inject,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import { ConfirmDialogService } from '@medularity/angular/decorators';
import { NotificationService } from '@medularity/angular/notifications';
import {
  AnalysisResult,
  MediaFile,
  TmdbMetadata,
} from '@medularity/archivist-core';
import { LanguageService } from '../../core/language.service';

import { MatchDialogComponent } from '../../components/match-dialog/match-dialog.component';
import { AnalysisStore } from '../../core/analysis.store';
import { ElectronService } from '../../core/electron.service';
import { MatchQueueStore } from '../../core/match-queue.store';
import { MediaStore } from '../../core/media.store';
import { SettingsService } from '../../core/settings.service';
import { ResultCardComponent } from './components/result-card.component';
import { SeriesViewComponent } from './components/series-view.component';

@Component({
  selector: 'app-analysis-dashboard',
  standalone: true,
  imports: [ResultCardComponent, MatchDialogComponent, SeriesViewComponent],
  template: `
    <div class="dashboard">
      <div class="sticky-header-container">
        <header class="dashboard-header">
          <div class="title-search">
            <h2>{{ lang.translate('analysis.title') }}</h2>
            <div class="search-field">
              <svg
                class="search-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <input
                type="text"
                [placeholder]="
                  lang.translate('analysis.searchPlaceholder') ||
                  'Search results...'
                "
                [value]="store.searchFilter()"
                (input)="onSearchInput($event)"
              />
              @if (store.searchFilter()) {
                <button
                  class="clear-search"
                  (click)="store.setSearchFilter(''); $event.stopPropagation()"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              }
            </div>
          </div>
          <div class="actions">
            <div class="header-buttons">
              @if (store.fixableCount() > 0) {
                <button
                  class="btn-primary"
                  (click)="store.queueAllFixes()"
                  [disabled]="store.isAnalyzing()"
                >
                  {{
                    lang
                      .translate('analysis.fixAllCount')
                      .replace('{count}', store.fixableCount().toString())
                  }}
                </button>
              }
              @if (isOperationRunning()) {
                <button class="btn-secondary" (click)="onStop()">
                  {{ lang.translate('analysis.stop') }}
                </button>
              } @else {
                <div class="scan-options">
                  <span class="filter-label">{{
                    lang.translate('analysis.filterBy') || 'Scan type:'
                  }}</span>
                  <div class="segmented-control">
                    <button
                      class="segment-btn"
                      [class.active]="mediaTypeFilter() === 'both'"
                      (click)="mediaTypeFilter.set('both')"
                    >
                      {{ lang.translate('analysis.filterBoth') || 'All Media' }}
                    </button>
                    <button
                      class="segment-btn"
                      [class.active]="mediaTypeFilter() === 'movie'"
                      (click)="mediaTypeFilter.set('movie')"
                    >
                      {{
                        lang.translate('analysis.filterMovies') || 'Movies Only'
                      }}
                    </button>
                    <button
                      class="segment-btn"
                      [class.active]="mediaTypeFilter() === 'tv'"
                      (click)="mediaTypeFilter.set('tv')"
                    >
                      {{
                        lang.translate('analysis.filterTv') || 'TV Shows Only'
                      }}
                    </button>
                  </div>
                  <div class="scan-actions">
                    <button
                      class="btn-quick"
                      (click)="quickScan()"
                      [title]="lang.translate('analysis.quickScanDesc')"
                    >
                      {{ lang.translate('analysis.quickScan') }}
                    </button>
                    <button
                      class="btn-deep"
                      (click)="deepScan()"
                      [title]="lang.translate('analysis.deepScanDesc')"
                    >
                      {{ lang.translate('analysis.deepScan') }}
                    </button>
                  </div>
                </div>
              }
            </div>
          </div>
        </header>

        @if (store.isAnalyzing()) {
          <div class="progress-section">
            <div class="progress-bar">
              <div
                class="fill"
                [class.scanning]="store.isScanning()"
                [style.width.%]="store.progressPercent()"
              ></div>
            </div>
            <div class="progress-text">
              @if (store.isScanning()) {
                <span class="scanning-loader">
                  <svg class="spinner" viewBox="0 0 24 24">
                    <circle
                      cx="12"
                      cy="12"
                      r="10"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="3"
                    ></circle>
                  </svg>
                  {{ lang.translate('analysis.scanningChanges') }}
                </span>
              } @else {
                {{
                  lang
                    .translate('analysis.processingCount')
                    .replace('{current}', store.progress().current.toString())
                    .replace('{total}', store.progress().total.toString())
                }}
                @if (store.progress().currentFile) {
                  <span class="file-path"
                    >({{ store.progress().currentFile }})</span
                  >
                }
              }
            </div>
          </div>
        }
      </div>

      <!-- Tab Bar -->
      @if (store.hasResults()) {
        <div class="tab-bar">
          <button
            class="tab"
            [class.active]="activeTab() === 'needs-attention'"
            (click)="activeTab.set('needs-attention')"
          >
            {{ lang.translate('analysis.needsAttention') }}
            <span
              class="tab-count"
              [class.highlight]="store.fixableCount() > 0"
            >
              {{ store.fixableCount() }}
            </span>
          </button>
          <button
            class="tab"
            [class.active]="activeTab() === 'cleaned'"
            (click)="activeTab.set('cleaned')"
          >
            {{ lang.translate('analysis.cleanCount') }}
            <span class="tab-count">
              {{ store.cleanResults().length }}
            </span>
          </button>
          <button
            class="tab"
            [class.active]="activeTab() === 'series'"
            (click)="activeTab.set('series')"
          >
            {{ lang.translate('analysis.tvSeries') }}
            <span class="tab-count" [class.highlight]="tvCount() > 0">
              {{ tvCount() }}
            </span>
          </button>
        </div>
      }

      @if (store.hasResults()) {
        <div class="results-container">
          @if (activeTab() === 'needs-attention') {
            @if (store.dirtyResults().length > 0) {
              <div class="results-grid">
                @for (result of store.dirtyResults(); track result.filePath) {
                  <app-result-card
                    [result]="result"
                    [conflict]="store.conflicts().get(result.filePath) || null"
                    (accept)="onAccept($event)"
                    (reject)="onReject($event)"
                    (update)="onUpdate(result, $event)"
                    (edit)="onEdit($event)"
                    (deleteFile)="onDeleteFile($event)"
                    (openFolder)="onOpenFolder($event)"
                    (playInVlc)="onPlayInVlc($event)"
                    (rescan)="onRescan($event)"
                  >
                  </app-result-card>
                }
              </div>
            } @else {
              <div class="empty-tab-state">
                <p>{{ lang.translate('analysis.noFilesAttention') }}</p>
              </div>
            }
          } @else if (activeTab() === 'cleaned') {
            @if (store.cleanResults().length > 0) {
              <div class="results-grid">
                @for (result of store.cleanResults(); track result.filePath) {
                  <app-result-card
                    [result]="result"
                    [conflict]="store.conflicts().get(result.filePath) || null"
                    (accept)="onAccept($event)"
                    (reject)="onReject($event)"
                    (update)="onUpdate(result, $event)"
                    (edit)="onEdit($event)"
                    (deleteFile)="onDeleteFile($event)"
                    (openFolder)="onOpenFolder($event)"
                    (playInVlc)="onPlayInVlc($event)"
                    (rescan)="onRescan($event)"
                  >
                  </app-result-card>
                }
              </div>
            } @else {
              <div class="empty-tab-state">
                <p>{{ lang.translate('analysis.noCleanedFound') }}</p>
              </div>
            }
          } @else if (activeTab() === 'series') {
            <app-series-view
              [groups]="store.seriesGroups()"
              (applyFix)="onAccept($event)"
              (applySeasonFixes)="onApplySeasonFixes($event)"
              (openFolder)="onOpenFolder($event)"
              (ignore)="onReject($event)"
              (edit)="onEdit($event)"
              (deleteFile)="onDeleteFile($event)"
              (rescan)="onRescan($event)"
            />
          }
        </div>
      }

      @if (!store.hasResults() && !store.isAnalyzing()) {
        <div class="empty-state">
          <p>
            {{ lang.translate('analysis.emptyState') }}
          </p>
          <p class="hint">
            {{ lang.translate('analysis.emptyHint') }}
          </p>
        </div>
      }

      @if (showMatchDialog()) {
        <plex-match-dialog
          [file]="matchDialogFile()!"
          [suggestedName]="matchDialogSuggestedName()"
          [showQueueButton]="false"
          (closed)="closeMatchDialog()"
          (matched)="onMatched($event)"
          (addedToQueue)="onAddedToQueue($event)"
        />
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        height: 100%;
        width: 100%;
        overflow: hidden;
      }

      .dashboard {
        flex: 1;
        display: flex;
        flex-direction: column;
        padding: 1.5rem;
        overflow: hidden;
        background: var(--color-bg-primary);
      }

      .sticky-header-container {
        z-index: 10;
        background: var(--color-bg-primary);
        padding: 0 0 1rem 0;
        border-bottom: 1px solid var(--color-border);
        flex-shrink: 0;
      }

      .dashboard-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1rem;
        gap: 2rem;
      }

      .title-search {
        display: flex;
        align-items: center;
        gap: 2rem;
        flex: 1;
      }

      .search-field {
        position: relative;
        flex: 1;
        max-width: 400px;
        display: flex;
        align-items: center;
      }

      .search-icon {
        position: absolute;
        left: 12px;
        width: 16px;
        height: 16px;
        color: var(--color-text-muted);
        pointer-events: none;
      }

      .search-field input {
        width: 100%;
        padding: 0.6rem 2.5rem 0.6rem 2.5rem;
        background: var(--color-bg-tertiary);
        border: 1px solid var(--color-border);
        border-radius: 8px;
        color: var(--color-text-primary);
        font-size: 0.9rem;
        transition: all 0.2s ease;
      }

      .search-field input:focus {
        outline: none;
        border-color: var(--color-primary);
        background: var(--color-bg-secondary);
        box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
      }

      .clear-search {
        position: absolute;
        right: 8px;
        background: transparent;
        border: none;
        color: var(--color-text-muted);
        padding: 4px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
      }

      .clear-search:hover {
        background: var(--color-bg-tertiary);
        color: var(--color-text-primary);
      }

      .clear-search svg {
        width: 14px;
        height: 14px;
      }

      .actions {
        display: flex;
        gap: 1rem;
      }

      h2 {
        margin: 0;
        font-size: 1.5rem;
      }

      .btn-start,
      .btn-primary,
      .btn-quick,
      .btn-deep {
        background: var(--color-primary);
        color: white;
        border: none;
        padding: 0.75rem 1.25rem;
        border-radius: 6px;
        font-weight: 600;
        cursor: pointer;
        font-size: 0.9rem;
        white-space: nowrap;
      }

      .btn-quick {
        background: var(--color-bg-secondary);
        color: var(--color-text-primary);
        border: 1px solid var(--color-border);
      }

      .btn-quick:hover {
        background: var(--color-bg-tertiary);
      }

      .btn-deep {
        background: var(--color-primary);
      }

      .scan-options {
        display: flex;
        align-items: center;
        gap: 1.5rem;
      }

      .filter-label {
        font-size: 0.85rem;
        color: var(--color-text-secondary);
        font-weight: 500;
      }

      .segmented-control {
        display: inline-flex;
        background: var(--color-bg-tertiary);
        border: 1px solid var(--color-border);
        border-radius: 6px;
        padding: 2px;
      }

      .segment-btn {
        background: transparent;
        border: none;
        color: var(--color-text-secondary);
        padding: 0.4rem 0.8rem;
        font-size: 0.85rem;
        font-weight: 500;
        cursor: pointer;
        border-radius: 4px;
        transition: all 0.15s ease;
      }

      .segment-btn:hover {
        color: var(--color-text-primary);
      }

      .segment-btn.active {
        background: var(--color-bg-secondary);
        color: var(--color-primary);
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
      }

      .scan-actions {
        display: flex;
        gap: 0.5rem;
      }

      .btn-start:disabled,
      .btn-primary:disabled,
      .btn-quick:disabled,
      .btn-deep:disabled {
        opacity: 0.7;
        cursor: wait;
      }

      .btn-secondary {
        background: var(--color-bg-secondary);
        border: 1px solid var(--color-border);
        color: var(--color-text-primary);
        padding: 0.75rem 1.5rem;
        border-radius: 6px;
        font-weight: 600;
        cursor: pointer;
      }

      .progress-section {
        margin-bottom: 0.5rem;
      }

      .progress-bar {
        height: 8px;
        background: var(--color-bg-tertiary);
        border-radius: 4px;
        overflow: hidden;
        margin-bottom: 0.5rem;
      }

      .fill {
        height: 100%;
        background: var(--color-primary);
        transition: width 0.3s ease;
      }

      .fill.scanning {
        width: 100% !important;
        background: linear-gradient(
          90deg,
          var(--color-primary) 0%,
          #3b82f6 50%,
          var(--color-primary) 100%
        );
        background-size: 200% 100%;
        animation: scanning-move 1.5s infinite linear;
      }

      .progress-text {
        font-size: 0.9rem;
        color: var(--color-text-muted);
        display: flex;
        align-items: center;
        gap: 0.5rem;
        height: 1.2rem;
      }

      .scanning-loader {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        color: var(--color-primary);
        font-weight: 500;
      }

      .spinner {
        width: 14px;
        height: 14px;
        animation: rotate 1s linear infinite;
      }

      .spinner circle {
        stroke-dasharray: 60;
        stroke-dashoffset: 0;
        transform-origin: center;
      }

      .file-path {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 400px;
        opacity: 0.8;
      }

      @keyframes rotate {
        from {
          transform: rotate(0deg);
        }
        to {
          transform: rotate(360deg);
        }
      }

      @keyframes scanning-move {
        0% {
          background-position: 100% 0;
        }
        100% {
          background-position: -100% 0;
        }
      }

      .header-buttons {
        display: flex;
        gap: 0.5rem;
      }

      .results-container {
        flex: 1;
        overflow-y: auto;
        padding-bottom: 2rem;
        padding-top: 2rem;
        display: flex;
        flex-direction: column;
        gap: 2rem;
      }

      .section h3 {
        font-size: 1.1rem;
        color: var(--color-text-secondary);
        margin-top: 0;
        margin-bottom: 1rem;
        padding-bottom: 0.5rem;
      }

      .results-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
        gap: 1.5rem;
      }

      .tab-bar {
        display: flex;
        gap: 4px;
        padding: 1rem 0 0;
      }

      .tab {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 14px;
        border: 1px solid var(--color-border);
        border-radius: 6px;
        background: transparent;
        color: var(--color-text-secondary);
        font-size: 0.85rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.15s ease;
      }

      .tab:hover {
        background: var(--color-bg-tertiary);
        color: var(--color-text-primary);
      }

      .tab.active {
        background: var(--color-primary);
        border-color: var(--color-primary);
        color: white;
      }

      .tab-count {
        font-size: 0.75rem;
        font-weight: 600;
        background: rgba(255, 255, 255, 0.15);
        border-radius: 100px;
        padding: 1px 6px;
        min-width: 20px;
        text-align: center;
      }

      .tab:not(.active) .tab-count {
        background: var(--color-bg-tertiary);
        color: var(--color-text-muted);
      }

      .tab-count.highlight {
        background: rgba(99, 102, 241, 0.15);
        color: var(--color-primary);
      }

      .tab.active .tab-count.highlight {
        background: rgba(255, 255, 255, 0.2);
        color: white;
      }

      .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        flex: 1;
        text-align: center;
        color: var(--color-text-secondary);
        padding: 4rem 2rem;
      }

      .empty-state p {
        margin: 0.5rem 0;
        font-size: 1.1rem;
      }

      .empty-state .hint {
        font-size: 0.95rem;
        color: var(--color-text-muted);
        opacity: 0.8;
      }

      .empty-tab-state {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 4rem 2rem;
        color: var(--color-text-muted);
        font-size: 1.1rem;
      }
    `,
  ],
})
export class AnalysisDashboardComponent implements OnInit, OnDestroy {
  protected readonly store = inject(AnalysisStore);
  private readonly mediaStore = inject(MediaStore);
  protected readonly electronService = inject(ElectronService);
  private readonly confirmable = inject(ConfirmDialogService);
  private readonly notifications = inject(NotificationService);
  protected readonly lang = inject(LanguageService);
  protected readonly settings = inject(SettingsService);
  private readonly matchQueueStore = inject(MatchQueueStore);

  readonly showMatchDialog = signal(false);
  readonly matchDialogFile = signal<MediaFile | null>(null);
  readonly matchDialogSuggestedName = signal<string | undefined>(undefined);
  readonly mediaTypeFilter = signal<'both' | 'movie' | 'tv'>('both');
  readonly activeTab = signal<'needs-attention' | 'cleaned' | 'series'>(
    'needs-attention',
  );
  readonly tvCount = computed(() => {
    const filter = this.store.searchFilter().toLowerCase().trim();
    return this.store.results().filter((r) => {
      if (r.metadata?.type !== 'tv') return false;
      if (!filter) return true;
      return r.metadata?.title.toLowerCase().includes(filter);
    }).length;
  });
  readonly isOperationRunning = computed(
    () => this.store.isAnalyzing() || this.matchQueueStore.isEngineActive(),
  );
  private activeResult: AnalysisResult | null = null;

  constructor() {
    effect(() => {
      const errors = this.electronService.backendErrors();
      if (errors.length > 0) {
        const lastError = errors[errors.length - 1] as any;
        this.notifications.add({
          message: lastError.message || lastError.operation,
          type: 'error',
        });
      }
    });
  }

  ngOnInit(): void {
    const rootPath = this.mediaStore.lastScanPath();
    if (rootPath) {
      this.store.loadExistingResults(rootPath);
    }
  }

  ngOnDestroy(): void {
    this.mediaStore.cancelScan();
  }

  async quickScan(): Promise<void> {
    const rootPath = this.mediaStore.lastScanPath();
    if (!rootPath) return;
    await this.store.startQuickScan(rootPath, this.mediaTypeFilter());
  }

  async deepScan(): Promise<void> {
    const rootPath = this.mediaStore.lastScanPath();
    if (!rootPath) return;
    await this.store.startFullScan(rootPath, this.mediaTypeFilter());
  }

  onStop(): void {
    this.store.cancelAnalysis();
    this.matchQueueStore.pauseEngine();
  }

  async onOpenFolder(result: AnalysisResult): Promise<void> {
    await this.electronService.showInFinder(result.filePath);
  }

  async onPlayInVlc(result: AnalysisResult): Promise<void> {
    const vlcPath = this.settings.$vlcPath();
    const isInstalled = await this.electronService.vlcCheckInstalled(vlcPath);
    if (isInstalled) {
      await this.electronService.vlcPlay(result.filePath, vlcPath);
    } else {
      const confirm = window.confirm(
        this.lang.translate('analysis.vlcNotFound'),
      );
      if (confirm) {
        window.open('https://www.videolan.org/vlc/', '_blank');
      }
    }
  }

  onAccept(result: AnalysisResult) {
    this.store.queueFix(result);
  }

  onReject(result: AnalysisResult) {
    this.store.removeResult(result);
  }

  onUpdate(result: AnalysisResult, match: any) {
    this.store.updateResultFromMatch(result, match);
  }

  onApplySeasonFixes(results: AnalysisResult[]): void {
    results.forEach((result) => this.store.queueFix(result));
  }

  onSearchInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.store.setSearchFilter(input.value);
  }

  onRescan(event: { result: AnalysisResult; type: 'movie' | 'tv' }): void {
    this.store.rescanAs(event.result, event.type);
  }
  onEdit(result: AnalysisResult) {
    let mediaFile = this.mediaStore
      .mediaFiles()
      .find((f) => f.path === result.filePath);

    if (!mediaFile) {
      // In AI mode, files might not be in MediaStore.
      // Create a fallback MediaFile from AnalysisResult.
      const lastDot = result.filePath.lastIndexOf('.');
      const extension =
        lastDot !== -1 ? result.filePath.substring(lastDot) : '.mkv';

      mediaFile = {
        id: result.filePath, // Use path as ID
        path: result.filePath,
        filename: result.originalName,
        directory: result.seriesRoot || '', // Fallback to empty if not series
        extension,
        sizeBytes: result.sizeBytes || 0,
        scannedAt: Date.now(),
        modifiedAt: Date.now(),
        videoStreams: [],
        audioStreams: [],
        subtitleStreams: [],
      } as MediaFile;
    }

    this.activeResult = result;
    this.matchDialogFile.set(mediaFile);
    this.matchDialogSuggestedName.set(result.suggestedName);
    this.showMatchDialog.set(true);
  }

  closeMatchDialog() {
    this.showMatchDialog.set(false);
    this.matchDialogFile.set(null);
    this.matchDialogSuggestedName.set(undefined);
    this.activeResult = null;
  }

  onMatched(event: { metadata: TmdbMetadata; embedMetadata: boolean }) {
    if (this.activeResult) {
      this.store.updateResultFromMetadata(this.activeResult, event.metadata);
    }
    this.closeMatchDialog();
  }

  onAddedToQueue(event: { metadata: TmdbMetadata; embedMetadata: boolean }) {
    if (this.activeResult) {
      this.store.updateResultFromMetadata(this.activeResult, event.metadata);
      this.store.queueFix(this.activeResult);
    }
    this.closeMatchDialog();
  }

  async onDeleteFile(result: AnalysisResult) {
    const confirmation = await this.confirmable.confirm({
      header: this.lang.translate('confirm.deleteFiles'),
      message: this.lang.translate('confirm.cannotUndo'),
      positive: this.lang.translate('confirm.delete'),
      negative: this.lang.translate('confirm.cancel'),
    });

    if (!confirmation) return;

    const mediaFile = this.mediaStore
      .mediaFiles()
      .find((f) => f.path === result.filePath);

    let success = false;
    let parentDir = '';

    if (mediaFile) {
      // Legacy/Manual mode: Use MediaStore selection to ensure library synchronization
      parentDir = mediaFile.directory;
      this.mediaStore.selectFile(mediaFile.id);
      const deleteResult = await this.mediaStore.deleteSelected(false);
      if (deleteResult.successCount > 0) {
        success = true;
      }
    } else {
      // AI mode: MediaStore is empty. Call Electron directly.
      const lastSlash = Math.max(
        result.filePath.lastIndexOf('/'),
        result.filePath.lastIndexOf('\\'),
      );
      parentDir = result.filePath.substring(0, lastSlash);

      const deleteResult = await this.electronService.deleteFiles(
        [result.filePath],
        false,
      );
      if (deleteResult && deleteResult.successCount > 0) {
        success = true;
      }
    }

    if (success) {
      this.store.removeResult(result);
      this.notifications.add({
        message: this.lang.translate('notify.deleteSuccess'),
        type: 'success',
      });

      // Check for empty parent folder
      if (parentDir) {
        const isEmpty = await this.electronService.isDirectoryEmpty(parentDir);
        if (isEmpty) {
          let shouldDeleteFolder = this.settings.$alwaysDeleteEnclosingFolder();

          if (!shouldDeleteFolder) {
            shouldDeleteFolder = await this.confirmable.confirm({
              header: this.lang.translate('confirm.deleteFolders'),
              message: this.lang.translate('analysis.enclosingFolderEmpty'),
              positive: this.lang.translate('confirm.yes'),
              negative: this.lang.translate('confirm.no'),
            });
          }

          if (shouldDeleteFolder) {
            await this.electronService.deleteEmptyFolders([parentDir]);
          }
        }
      }
    }
  }

  // onDeleteFolder is removed as it's now integrated into onDeleteFile
}
