import { CommonModule, DecimalPipe, UpperCasePipe } from '@angular/common';
import {
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { AnalysisResult, TmdbMatchResult } from '@medularity/archivist-core';
import { LanguageService } from '../../../core/language.service';

@Component({
  selector: 'app-result-card',
  standalone: true,
  imports: [DecimalPipe, CommonModule, UpperCasePipe],
  template: `
    <div
      class="result-card"
      [class.clean]="result().isClean"
      [class.dirty]="!result().isClean"
      [class.missing]="isMissing()"
    >
      <div class="card-header">
        <span
          class="score-badge"
          [style.background]="getScoreColor(result().score)"
        >
          {{ result().score * 100 | number: '1.0-0' }}%
        </span>
        <div class="header-right">
          <span class="parent-path" [title]="result().filePath">{{
            parentPath()
          }}</span>
          <span
            class="status-badge"
            [class.clean]="result().isClean"
            [class.is-missing]="isMissing()"
          >
            {{
              isMissing()
                ? lang.translate('analysis.missing')
                : result().isClean
                  ? lang.translate('analysis.clean')
                  : lang.translate('analysis.needsFix')
            }}
          </span>
        </div>
      </div>

      <div class="card-content">
        <div class="result-main">
          @if (result().metadata.posterUrl) {
            <div
              class="poster-container"
              [title]="lang.translate('match.viewOnTmdb')"
            >
              <img [src]="result().metadata.posterUrl" class="result-poster" />
              <a
                class="tmdb-link-overlay"
                [href]="
                  getTmdbUrl(result().metadata.tmdbId, result().metadata.type)
                "
                target="_blank"
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

          <div class="result-details">
            <div class="filename-row">
              <span class="label"
                >{{ lang.translate('analysis.original') }}:</span
              >
              <span class="value original">{{ result().originalName }}</span>
            </div>

            <div class="filename-row">
              <span class="label"
                >{{ lang.translate('analysis.suggested') }}:</span
              >
              <span class="value suggested">{{ result().suggestedName }}</span>
            </div>

            @if (result().seriesRoot) {
              <div class="filename-row">
                <span class="label"
                  >{{ lang.translate('analysis.targetFolder') }}:</span
                >
                <span class="value target-path" [title]="result().seriesRoot">{{
                  result().seriesRoot
                }}</span>
              </div>
            }

            @if (conflict()) {
              <div
                class="conflict-warning"
                [class.duplicate]="conflict() === 'duplicate'"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path
                    d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                  />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                <span>
                  {{
                    conflict() === 'duplicate'
                      ? lang.translate('analysis.duplicateWarning')
                      : lang.translate('analysis.existsWarning')
                  }}
                </span>
              </div>
            }

            @if (result().metadata) {
              <div class="metadata-row">
                @if (result().metadata.type === 'movie') {
                  <span class="meta-tag type">{{
                    lang.translate('analysis.movie')
                  }}</span>
                } @else if (result().metadata.type === 'tv') {
                  <span class="meta-tag type series">{{
                    lang.translate('analysis.tvSeries')
                  }}</span>
                }

                @if (isSample()) {
                  <span class="meta-tag sample">{{
                    lang.translate('analysis.sample')
                  }}</span>
                }
                @if (result().isAiFallback) {
                  <span class="meta-tag ai">{{
                    lang.translate('analysis.aiEnhanced')
                  }}</span>
                }

                @if (result().metadata.title) {
                  <span class="meta-tag">{{ result().metadata.title }}</span>
                }
                @if (result().metadata.year) {
                  <span class="meta-tag">({{ result().metadata.year }})</span>
                }
                @if (result().metadata.tmdbId) {
                  <a
                    class="meta-tag tmdb"
                    [href]="
                      getTmdbUrl(
                        result().metadata.tmdbId,
                        result().metadata.type
                      )
                    "
                    target="_blank"
                    [title]="lang.translate('match.viewOnTmdb')"
                  >
                    TMDB: {{ result().metadata.tmdbId }}
                    <svg
                      class="link-icon"
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
                }
              </div>
            }
          </div>
        </div>

        @if (result().reason) {
          <div class="reason">
            {{ lang.translate('analysis.reason') }}: {{ result().reason }}
          </div>
        }
      </div>

      @if ((result().matches?.length ?? 0) > 0) {
        <div class="matches-section">
          <button class="btn-toggle-matches" (click)="toggleMatches()">
            {{
              showMatches()
                ? lang.translate('match.hideMatches')
                : lang
                    .translate('match.showMatchesWithCount')
                    .replace(
                      '{count}',
                      (result().matches?.length ?? 0).toString()
                    )
            }}
          </button>

          @if (showMatches()) {
            <div class="matches-list">
              @for (match of result().matches; track match.id) {
                <div class="match-item">
                  <div class="match-info">
                    <span class="match-title">{{ match.title }}</span>
                    <span class="match-meta">
                      {{ match.year }} • {{ match.type! | uppercase }} • ⭐
                      {{ match.rating }}
                    </span>
                    <p class="match-overview">
                      {{ match.overview! | slice: 0 : 100
                      }}{{ match.overview!.length > 100 ? '...' : '' }}
                    </p>
                  </div>
                  <button class="btn-select" (click)="selectMatch(match)">
                    {{ lang.translate('match.select') }}
                  </button>
                </div>
              }
            </div>
          }
        </div>
      }

      <div class="card-actions">
        <div class="left-actions">
          <button
            class="btn-icon"
            (click)="openFolder.emit(result())"
            [title]="lang.translate('analysis.openFolder')"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path
                d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 2h9a2 2 0 0 1 2 2z"
              />
            </svg>
          </button>
          <button
            class="btn-icon"
            (click)="playInVlc.emit(result())"
            [title]="lang.translate('analysis.playInVlc')"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          </button>
          <button
            class="btn-icon danger"
            (click)="deleteFile.emit(result())"
            [disabled]="isMissing()"
            [title]="lang.translate('analysis.deleteFile')"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <polyline points="3 6 5 6 21 6" />
              <path
                d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
              />
            </svg>
          </button>
          <button
            class="btn-rescan"
            (click)="
              rescan.emit({
                result: result(),
                type: result().metadata.type === 'tv' ? 'movie' : 'tv',
              })
            "
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M21 2v6h-6" />
              <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
              <path d="M3 22v-6h6" />
              <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
            </svg>
            <span>
              {{
                result().metadata.type === 'tv'
                  ? lang.translate('analysis.scanAsMovie')
                  : lang.translate('analysis.scanAsTv')
              }}
            </span>
          </button>
        </div>
        <div class="right-actions">
          <button class="btn-edit" (click)="edit.emit(result())">
            {{ lang.translate('analysis.editMetadata') }}
          </button>
          <button class="btn-reject" (click)="reject.emit(result())">
            {{ lang.translate('analysis.ignore') }}
          </button>
          <button
            class="btn-primary"
            (click)="accept.emit(result())"
            [disabled]="result().isClean || isMissing()"
          >
            {{
              isMissing()
                ? lang.translate('analysis.notFound')
                : lang.translate('analysis.applyFix')
            }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .result-card {
        background: var(--color-bg-secondary);
        border: 1px solid var(--color-border);
        border-radius: 12px;
        padding: 1.5rem;
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
      }

      .card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .header-right {
        display: flex;
        align-items: center;
        gap: 1rem;
      }

      .parent-path {
        font-size: 0.8rem;
        color: var(--color-text-muted);
        background: var(--color-bg-tertiary);
        padding: 2px 8px;
        border-radius: 4px;
        max-width: 150px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .score-badge {
        padding: 2px 6px;
        border-radius: 4px;
        font-weight: bold;
        color: white;
        font-size: 0.8rem;
      }

      .status-badge {
        font-size: 0.8rem;
        text-transform: uppercase;
        font-weight: 600;
        color: #ef4444;
      }

      .status-badge.clean {
        color: #22c55e;
      }

      .result-main {
        display: flex;
        gap: 1.5rem;
        min-height: 120px;
      }

      .poster-container {
        position: relative;
        width: 80px;
        height: 120px;
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
        width: 20px;
        height: 20px;
      }

      .result-details {
        flex: 1;
        min-width: 0;
      }

      .filename-row {
        display: grid;
        grid-template-columns: 85px 1fr;
        gap: 0.75rem;
        margin-bottom: 0.75rem;
        font-size: 0.9rem;
      }

      .label {
        color: var(--color-text-muted);
      }

      .value {
        word-break: break-all;
        font-family: monospace;
      }

      .suggested {
        color: var(--color-primary);
        font-weight: 500;
      }

      .conflict-warning {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem;
        background: rgba(239, 68, 68, 0.1);
        border: 1px solid rgba(239, 68, 68, 0.2);
        border-radius: 6px;
        color: #ef4444;
        font-size: 0.8rem;
        margin-top: 0.5rem;
      }

      .conflict-warning.duplicate {
        background: rgba(234, 179, 8, 0.1);
        border: 1px solid rgba(234, 179, 8, 0.2);
        color: #eab308;
      }

      .conflict-warning svg {
        width: 14px;
        height: 14px;
        flex-shrink: 0;
      }

      .metadata-row {
        display: flex;
        gap: 0.75rem;
        margin-top: 1rem;
        flex-wrap: wrap;
      }

      .meta-tag {
        background: var(--color-bg-tertiary);
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 0.8rem;
      }

      .meta-tag.tmdb {
        background: #0d253f; /* TMDB Blue-ish */
        color: white;
        text-decoration: none;
        display: inline-flex;
        align-items: center;
      }

      .meta-tag.tmdb:hover {
        background: #01b4e4; /* TMDB Lighter Blue */
      }

      .link-icon {
        width: 12px;
        height: 12px;
        margin-left: 4px;
        flex-shrink: 0;
      }

      .meta-tag.type {
        background: var(--color-bg-tertiary);
        color: var(--color-text-primary);
        font-weight: 700;
        text-transform: uppercase;
        border: 1.5px solid var(--color-border);
      }

      .meta-tag.type.series {
        border-color: #6366f1;
        color: #6366f1;
      }

      .meta-tag.ai {
        background: linear-gradient(135deg, #a855f7 0%, #7c3aed 100%);
        color: white;
        font-weight: 600;
        border: none;
      }

      .meta-tag.sample {
        background: #fef3c7;
        color: #92400e;
        border: 1px solid #fcd34d;
        font-weight: 700;
      }

      .reason {
        margin-top: 0.5rem;
        font-size: 0.8rem;
        color: var(--color-text-muted);
        font-style: italic;
      }

      .card-actions {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 0.5rem;
        gap: 1rem;
      }

      .left-actions,
      .right-actions {
        display: flex;
        gap: 0.5rem;
      }

      button {
        padding: 0.5rem 1rem;
        border-radius: 6px;
        border: none;
        cursor: pointer;
        font-weight: 500;
        transition: all 0.2s ease;
      }

      .btn-primary {
        background: var(--color-primary);
        color: white;
      }

      .btn-primary:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .btn-reject,
      .btn-edit {
        background: transparent;
        border: 1px solid var(--color-border);
        color: var(--color-text-secondary);
      }

      .btn-edit:hover {
        border-color: var(--color-primary);
        color: var(--color-primary);
      }

      .btn-icon {
        padding: 0.5rem;
        background: transparent;
        border: 1px solid var(--color-border);
        color: var(--color-text-secondary);
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .btn-icon svg {
        width: 16px;
        height: 16px;
      }

      .btn-rescan {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        background: transparent;
        border: 1px solid var(--color-border);
        color: var(--color-text-secondary);
        padding: 0.5rem 0.75rem;
      }

      .btn-rescan span {
        font-size: 0.85rem;
        font-weight: 500;
        white-space: nowrap;
      }

      .btn-rescan:hover {
        border-color: var(--color-primary);
        color: var(--color-primary);
        background: rgba(99, 102, 241, 0.05);
      }

      .btn-rescan svg {
        width: 14px;
        height: 14px;
      }

      .btn-icon.danger:hover {
        border-color: #ef4444;
        color: #ef4444;
        background: rgba(239, 68, 68, 0.05);
      }

      .value.suggested {
        color: var(--color-primary);
        font-weight: 500;
      }

      .value.target-path {
        color: #6366f1;
        font-family: var(--font-mono);
        font-size: 0.8rem;
        word-break: break-all;
      }

      .matches-section {
        margin-top: 0.5rem;
        border-top: 1px solid var(--color-border);
        padding-top: 0.5rem;
      }

      .btn-toggle-matches {
        background: none;
        border: none;
        color: var(--color-primary);
        text-decoration: underline;
        font-size: 0.85rem;
        padding: 0;
        cursor: pointer;
      }

      .matches-list {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        margin-top: 0.5rem;
      }

      .match-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.5rem;
        background: var(--color-bg-tertiary);
        border-radius: 4px;
      }

      .match-info {
        flex: 1;
        min-width: 0;
        margin-right: 0.5rem;
      }

      .match-title {
        font-weight: 600;
        color: var(--color-text-primary);
        font-size: 0.9rem;
        display: block;
      }

      .match-meta {
        font-size: 0.8rem;
        color: var(--color-text-muted);
      }

      .match-overview {
        font-size: 0.75rem;
        color: var(--color-text-muted);
        margin: 2px 0 0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .btn-select {
        background: var(--color-bg-secondary);
        border: 1px solid var(--color-border);
        color: var(--color-text-primary);
        padding: 0.25rem 0.5rem;
        font-size: 0.8rem;
      }

      .btn-select:hover {
        background: var(--color-primary);
        color: white;
        border-color: var(--color-primary);
      }

      .result-card.missing {
        border: 1px dashed var(--color-border);
        opacity: 0.8;
      }

      .status-badge.is-missing {
        color: var(--color-text-muted);
        background: var(--color-bg-tertiary);
        padding: 2px 6px;
        border-radius: 4px;
      }
    `,
  ],
})
export class ResultCardComponent {
  protected readonly lang = inject(LanguageService);
  readonly result = input.required<AnalysisResult>();
  readonly conflict = input<'duplicate' | 'exists' | null>(null);
  readonly accept = output<AnalysisResult>();
  readonly reject = output<AnalysisResult>();
  readonly update = output<TmdbMatchResult>();
  readonly edit = output<AnalysisResult>();
  readonly deleteFile = output<AnalysisResult>();
  readonly openFolder = output<AnalysisResult>();
  readonly playInVlc = output<AnalysisResult>();
  readonly rescan = output<{ result: AnalysisResult; type: 'movie' | 'tv' }>();

  readonly isMissing = computed(
    () =>
      this.result().isMissing === true ||
      this.result().filePath.startsWith('missing://'),
  );

  readonly isSample = computed(() => {
    const res = this.result();
    const name = res.originalName.toLowerCase();
    const pathValue = res.filePath.toLowerCase();
    const isSampleSize =
      res.sizeBytes !== undefined &&
      res.sizeBytes > 0 &&
      res.sizeBytes < 100 * 1024 * 1024;
    return (
      (name.includes('sample') || pathValue.includes('sample')) && isSampleSize
    );
  });

  readonly showMatches = signal(false);
  readonly parentPath = computed(() => {
    const path = this.result().filePath;
    const segments = path.split(/[/\\]/);
    return segments.length > 1 ? segments[segments.length - 2] : '';
  });

  toggleMatches(): void {
    this.showMatches.update((v) => !v);
  }

  selectMatch(match: TmdbMatchResult): void {
    this.update.emit(match);
    this.showMatches.set(false);
  }

  getTmdbUrl(id: number | undefined, type: 'movie' | 'tv' | undefined): string {
    if (!id) return '';
    const mediaType = type || 'movie';
    return `https://www.themoviedb.org/${mediaType}/${id}`;
  }

  getScoreColor(score: number): string {
    if (score >= 0.8) return '#22c55e'; // Green
    if (score >= 0.6) return '#eab308'; // Yellow
    return '#ef4444'; // Red
  }
}
