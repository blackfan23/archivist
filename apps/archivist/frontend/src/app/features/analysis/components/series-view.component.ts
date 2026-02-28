import { CommonModule } from '@angular/common';
import {
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { AnalysisResult } from '@medularity/archivist-core';
import { SeriesEpisodeGroup, SeriesGroup } from '../../../core/analysis.store';
import { LanguageService } from '../../../core/language.service';
import { SettingsService } from '../../../core/settings.service';

// SeriesGroup now has the correct array structure for seasons in the store
type ResolvedSeriesGroup = SeriesGroup;

@Component({
  selector: 'app-series-view',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="series-view">
      <div class="series-controls">
        <label class="toggle-control">
          <span class="control-label">{{
            lang.translate('settings.hideCleanedSeasons')
          }}</span>
          <div class="toggle">
            <input
              type="checkbox"
              [checked]="settings.$hideCleanedSeasons()"
              (change)="toggleHideCleaned($event)"
            />
            <span class="toggle-slider"></span>
          </div>
        </label>
      </div>

      @if (filteredGroups().length === 0) {
        <div class="empty-state">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
          >
            <rect x="2" y="7" width="20" height="15" rx="2" ry="2" />
            <polyline points="17 2 12 7 7 2" />
          </svg>
          <p>{{ lang.translate('analysis.noSeriesDetected') }}</p>
          <span>{{ lang.translate('analysis.runAnalysisHint') }}</span>
        </div>
      } @else {
        <div class="series-list">
          @for (show of filteredGroups(); track show.showTitle + show.year) {
            <div
              class="show-card"
              [class.expanded]="isExpanded(show.showTitle + show.year)"
            >
              <!-- Show Header -->
              <button
                class="show-header"
                (click)="toggleShow(show.showTitle + show.year)"
                [attr.aria-expanded]="isExpanded(show.showTitle + show.year)"
              >
                <div class="show-info">
                  @if (show.posterUrl) {
                    <img
                      class="show-poster"
                      [src]="show.posterUrl"
                      [alt]="show.showTitle"
                    />
                  } @else {
                    <div class="poster-placeholder">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.5"
                      >
                        <rect x="2" y="7" width="20" height="15" rx="2" />
                        <polyline points="17 2 12 7 7 2" />
                      </svg>
                    </div>
                  }
                  <div class="show-meta">
                    <span class="show-title">{{ show.showTitle }}</span>
                    @if (show.year) {
                      <span class="show-year">({{ show.year }})</span>
                    }
                    <div class="show-badges">
                      <span class="badge badge-seasons">
                        {{ show.seasons.length }}
                        {{
                          show.seasons.length === 1
                            ? lang.translate('analysis.season')
                            : lang.translate('analysis.seasons')
                        }}
                      </span>
                      <span class="badge badge-episodes">
                        {{ totalEpisodes(show) }}
                        {{
                          totalEpisodes(show) === 1
                            ? lang.translate('analysis.episode')
                            : lang.translate('analysis.episodes')
                        }}
                      </span>
                      @if (show.dirtyCount > 0) {
                        <span class="badge badge-dirty">
                          {{ show.dirtyCount }}
                          {{
                            show.dirtyCount === 1
                              ? lang.translate('analysis.needFix')
                              : lang.translate('analysis.needsFixPlural')
                          }}
                        </span>
                      }
                      @if (show.missingCount > 0) {
                        <span class="badge badge-missing">
                          {{ show.missingCount }}
                          {{ lang.translate('analysis.missingBadge') }}
                        </span>
                      }
                      @if (show.dirtyCount === 0 && show.missingCount === 0) {
                        <span class="badge badge-clean">{{
                          lang.translate('analysis.allClean')
                        }}</span>
                      }
                    </div>
                  </div>
                </div>
                <div
                  class="chevron"
                  [class.open]="isExpanded(show.showTitle + show.year)"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
              </button>

              <!-- Seasons (collapsible) -->
              @if (isExpanded(show.showTitle + show.year)) {
                <div class="seasons-container">
                  @for (season of show.seasons; track season.season) {
                    <div class="season-block">
                      <div class="season-header">
                        <span class="season-label">
                          {{
                            season.season === 0
                              ? lang.translate('analysis.specials')
                              : lang.translate('analysis.season') +
                                ' ' +
                                season.season
                          }}
                        </span>
                        <span class="season-count">
                          {{ season.episodes.length }}
                          {{
                            season.episodes.length === 1
                              ? lang.translate('analysis.episode')
                              : lang.translate('analysis.episodes')
                          }}
                        </span>
                        @if (seasonDirtyCount(season.episodes) > 0) {
                          <button
                            class="btn-apply-season"
                            (click)="
                              applySeasonFixes.emit(
                                getDirtyEpisodeResults(season.episodes)
                              )
                            "
                          >
                            <svg
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              stroke-width="2"
                            >
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                            Fix All ({{ seasonDirtyCount(season.episodes) }})
                          </button>
                        }
                      </div>

                      <div class="episodes-list">
                        @for (ep of season.episodes; track ep.result.filePath) {
                          <div
                            class="episode-row"
                            [class.clean]="ep.result.isClean"
                            [class.missing]="
                              ep.result.filePath.startsWith('missing://')
                            "
                          >
                            <div class="ep-code">
                              {{ formatEpCode(ep.season, ep.episode) }}
                            </div>
                            <div class="ep-info">
                              @if (ep.episodeTitle) {
                                <span class="ep-title">{{
                                  ep.episodeTitle
                                }}</span>
                              }
                              <span
                                class="ep-suggested"
                                [title]="ep.result.filePath"
                              >
                                {{
                                  ep.result.suggestedName ||
                                    ep.result.originalName
                                }}
                              </span>
                              <span
                                class="ep-path"
                                [title]="ep.result.filePath"
                              >
                                {{ ep.result.filePath }}
                              </span>
                            </div>
                            <div class="ep-status">
                              @if (isEpSample(ep.result)) {
                                <span class="badge-sample">{{
                                  lang.translate('analysis.sample')
                                }}</span>
                              }
                              @if (
                                ep.result.filePath.startsWith('missing://')
                              ) {
                                <span class="status-indicator status-missing">
                                  <svg
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-width="2.5"
                                  >
                                    <circle cx="12" cy="12" r="10" />
                                    <line x1="12" y1="8" x2="12" y2="12" />
                                    <line x1="12" y1="16" x2="12.01" y2="16" />
                                  </svg>
                                  {{ lang.translate('analysis.missing') }}
                                </span>
                              } @else if (ep.result.isClean) {
                                <span class="status-indicator status-clean">
                                  <svg
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-width="3"
                                  >
                                    <polyline points="20 6 9 17 4 12" />
                                  </svg>
                                  {{ lang.translate('analysis.clean') }}
                                </span>
                              } @else {
                                <span class="status-indicator status-dirty">
                                  <svg
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-width="2.5"
                                  >
                                    <path
                                      d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"
                                    />
                                    <path
                                      d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"
                                    />
                                  </svg>
                                  {{ lang.translate('analysis.needsFix') }}
                                </span>
                              }
                            </div>
                            <div class="ep-actions">
                              @if (
                                !ep.result.isClean &&
                                !ep.result.filePath.startsWith('missing://')
                              ) {
                                <button
                                  class="btn-apply"
                                  (click)="applyFix.emit(ep.result)"
                                  [title]="lang.translate('analysis.applyFix')"
                                >
                                  {{ lang.translate('analysis.applyFix') }}
                                </button>
                              }
                              <button
                                class="btn-edit-inline"
                                (click)="edit.emit(ep.result)"
                                [title]="
                                  lang.translate('analysis.editMetadata')
                                "
                              >
                                {{ lang.translate('analysis.editMetadata') }}
                              </button>
                              <button
                                class="btn-icon danger"
                                (click)="deleteFile.emit(ep.result)"
                                [disabled]="
                                  ep.result.filePath.startsWith('missing://')
                                "
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
                                class="btn-icon"
                                (click)="openFolder.emit(ep.result)"
                                [disabled]="
                                  ep.result.filePath.startsWith('missing://')
                                "
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
                                (click)="
                                  rescan.emit({
                                    result: ep.result,
                                    type: 'movie',
                                  })
                                "
                                [title]="lang.translate('analysis.scanAsMovie')"
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
                              </button>
                              <button
                                class="btn-icon"
                                (click)="ignore.emit(ep.result)"
                                [title]="lang.translate('analysis.ignore')"
                              >
                                <svg
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  stroke-width="2"
                                >
                                  <circle cx="12" cy="12" r="10" />
                                  <line x1="15" y1="9" x2="9" y2="15" />
                                  <line x1="9" y1="9" x2="15" y2="15" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        }
                      </div>
                    </div>
                  }
                </div>
              }
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [
    `
      .series-view {
        display: flex;
        flex-direction: column;
        gap: 0;
      }

      .series-controls {
        display: flex;
        justify-content: flex-end;
        padding: 0.5rem 0 1rem;
        border-bottom: 1px solid var(--color-border);
        margin-bottom: 1rem;
      }

      .toggle-control {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        cursor: pointer;
      }

      .control-label {
        font-size: 0.85rem;
        font-weight: 500;
        color: var(--color-text-secondary);
      }

      .toggle {
        position: relative;
        display: inline-block;
        width: 36px;
        height: 20px;
        flex-shrink: 0;
      }

      .toggle input {
        opacity: 0;
        width: 0;
        height: 0;
      }

      .toggle-slider {
        position: absolute;
        cursor: pointer;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: var(--color-bg-tertiary);
        transition: 0.2s cubic-bezier(0.25, 1, 0.5, 1);
        border: 1px solid var(--color-border);
        border-radius: 20px;
      }

      .toggle-slider:before {
        position: absolute;
        content: '';
        height: 14px;
        width: 14px;
        left: 2px;
        bottom: 2px;
        background-color: var(--color-text-muted);
        transition: 0.2s cubic-bezier(0.25, 1, 0.5, 1);
        border-radius: 50%;
      }

      input:checked + .toggle-slider {
        background-color: var(--color-primary);
        border-color: var(--color-primary);
      }

      input:checked + .toggle-slider:before {
        transform: translateX(16px);
        background-color: white;
      }

      input:focus + .toggle-slider {
        box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
      }

      .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 4rem 2rem;
        gap: 0.75rem;
        color: var(--color-text-muted);
        text-align: center;
      }

      .empty-state svg {
        width: 48px;
        height: 48px;
        opacity: 0.4;
      }

      .empty-state p {
        margin: 0;
        font-size: 1rem;
        color: var(--color-text-secondary);
        font-weight: 500;
      }

      .empty-state span {
        font-size: 0.85rem;
        max-width: 360px;
      }

      .series-list {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }

      .show-card {
        background: var(--color-bg-secondary);
        border: 1px solid var(--color-border);
        border-radius: 10px;
        overflow: hidden;
        transition: border-color 0.15s ease;
      }

      .show-card.expanded {
        border-color: var(--color-primary);
      }

      .show-header {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 1rem 1.25rem;
        background: none;
        border: none;
        cursor: pointer;
        text-align: left;
        color: var(--color-text-primary);
        gap: 1rem;
        transition: background 0.15s ease;
      }

      .show-header:hover {
        background: var(--color-bg-tertiary);
      }

      .show-info {
        display: flex;
        align-items: center;
        gap: 1rem;
        flex: 1;
        min-width: 0;
      }

      .show-poster {
        width: 48px;
        height: 72px;
        object-fit: cover;
        border-radius: 4px;
        border: 1px solid var(--color-border);
        flex-shrink: 0;
      }

      .poster-placeholder {
        width: 48px;
        height: 72px;
        border-radius: 4px;
        border: 1px solid var(--color-border);
        background: var(--color-bg-tertiary);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      .poster-placeholder svg {
        width: 24px;
        height: 24px;
        color: var(--color-text-muted);
      }

      .show-meta {
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 0;
      }

      .show-title {
        font-size: 1rem;
        font-weight: 600;
        color: var(--color-text-primary);
        letter-spacing: -0.01em;
      }

      .show-year {
        font-size: 0.85rem;
        color: var(--color-text-muted);
        font-family: monospace;
      }

      .show-badges {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
      }

      .badge {
        font-size: 0.72rem;
        font-weight: 500;
        padding: 2px 8px;
        border-radius: 100px;
      }

      .badge-seasons {
        background: var(--color-bg-tertiary);
        color: var(--color-text-secondary);
        border: 1px solid var(--color-border);
      }

      .badge-episodes {
        background: var(--color-bg-tertiary);
        color: var(--color-text-secondary);
        border: 1px solid var(--color-border);
      }

      .badge-dirty {
        background: rgba(239, 68, 68, 0.1);
        color: #ef4444;
        border: 1px solid rgba(239, 68, 68, 0.2);
      }

      .badge-missing {
        background: rgba(245, 158, 11, 0.1);
        color: #f59e0b;
        border: 1px solid rgba(245, 158, 11, 0.2);
        font-style: italic;
      }

      .badge-clean {
        background: rgba(34, 197, 94, 0.1);
        color: #22c55e;
        border: 1px solid rgba(34, 197, 94, 0.2);
      }

      .chevron {
        color: var(--color-text-muted);
        transition: transform 0.2s ease;
      }

      .chevron.open {
        transform: rotate(180deg);
      }

      .chevron svg {
        width: 20px;
        height: 20px;
      }

      /* Seasons */
      .seasons-container {
        border-top: 1px solid var(--color-border);
      }

      .season-block {
        border-bottom: 1px solid var(--color-border);
      }

      .season-block:last-child {
        border-bottom: none;
      }

      .season-header {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.625rem 1.25rem;
        background: var(--color-bg-tertiary);
      }

      .season-label {
        font-size: 0.8rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--color-text-secondary);
      }

      .season-count {
        font-size: 0.75rem;
        color: var(--color-text-muted);
        font-family: monospace;
      }

      .btn-apply-season {
        margin-left: auto;
        padding: 4px 12px;
        font-size: 0.72rem;
        background: rgba(99, 102, 241, 0.1);
        border: 1px solid rgba(99, 102, 241, 0.25);
        border-radius: 6px;
        color: var(--color-primary);
        cursor: pointer;
        font-weight: 600;
        transition: all 0.15s ease;
        display: flex;
        align-items: center;
        gap: 6px;
        text-transform: uppercase;
        letter-spacing: 0.02em;
      }

      .btn-apply-season svg {
        width: 12px;
        height: 12px;
      }

      .btn-apply-season:hover {
        background: var(--color-primary);
        color: white;
        border-color: var(--color-primary);
      }

      /* Episode rows */
      .episodes-list {
        display: flex;
        flex-direction: column;
      }

      .episode-row {
        display: grid;
        grid-template-columns: 68px 1fr auto auto;
        align-items: center;
        gap: 0.75rem;
        padding: 0.625rem 1.25rem;
        border-bottom: 1px solid var(--color-border);
        transition: background 0.1s ease;
      }

      .episode-row:last-child {
        border-bottom: none;
      }

      .episode-row:hover {
        background: var(--color-bg-tertiary);
      }

      .episode-row.clean {
        background: rgba(34, 197, 94, 0.03);
      }

      .episode-row.missing {
        background: rgba(0, 0, 0, 0.02);
        opacity: 0.7;
        border-style: dashed;
      }

      .episode-row.clean .ep-code {
        color: #22c55e;
      }

      .ep-code {
        font-family: monospace;
        font-size: 0.8rem;
        font-weight: 600;
        color: var(--color-primary);
        white-space: nowrap;
      }

      .ep-info {
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 1px;
      }

      .ep-title {
        font-size: 0.85rem;
        font-weight: 500;
        color: var(--color-text-primary);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .ep-suggested {
        font-size: 0.8rem;
        color: var(--color-text-secondary);
        font-weight: 500;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .ep-path {
        font-size: 0.7rem;
        color: var(--color-text-muted);
        font-family: monospace;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        opacity: 0.8;
      }

      .ep-status {
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 100px;
        justify-content: flex-end;
      }

      .badge-sample {
        padding: 2px 6px;
        font-size: 0.65rem;
        font-weight: 700;
        border-radius: 4px;
        background: #fef3c7;
        color: #92400e;
        border: 1px solid #fcd34d;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      .status-indicator {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 0.7rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.03em;
        padding: 2px 8px;
        border-radius: 4px;
      }

      .status-indicator svg {
        width: 10px;
        height: 10px;
      }

      .status-clean {
        color: #22c55e;
        background: rgba(34, 197, 94, 0.1);
      }

      .status-dirty {
        color: #ef4444;
        background: rgba(239, 68, 68, 0.1);
      }

      .status-missing {
        color: #f59e0b;
        background: rgba(245, 158, 11, 0.1);
        font-style: italic;
      }

      .btn-icon:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .ep-actions {
        display: flex;
        gap: 4px;
        align-items: center;
      }

      .btn-apply {
        padding: 3px 10px;
        font-size: 0.75rem;
        background: var(--color-primary);
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-weight: 500;
        white-space: nowrap;
        transition: opacity 0.15s ease;
      }

      .btn-apply:hover {
        opacity: 0.85;
      }

      .btn-edit-inline {
        padding: 3px 10px;
        font-size: 0.75rem;
        background: var(--color-bg-tertiary);
        color: var(--color-text-primary);
        border: 1px solid var(--color-border);
        border-radius: 4px;
        cursor: pointer;
        font-weight: 500;
        white-space: nowrap;
        transition: all 0.15s ease;
      }

      .btn-edit-inline:hover {
        background: var(--color-bg-secondary);
        border-color: var(--color-text-muted);
      }

      .btn-icon {
        padding: 4px;
        background: transparent;
        border: 1px solid var(--color-border);
        border-radius: 4px;
        color: var(--color-text-muted);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.15s ease;
      }

      .btn-icon:hover {
        border-color: var(--color-text-muted);
        color: var(--color-text-primary);
      }

      .btn-icon svg {
        width: 14px;
        height: 14px;
      }
    `,
  ],
})
export class SeriesViewComponent {
  readonly groups = input.required<ResolvedSeriesGroup[]>();

  readonly applyFix = output<AnalysisResult>();
  readonly applySeasonFixes = output<AnalysisResult[]>();
  readonly deleteFile = output<AnalysisResult>();
  readonly edit = output<AnalysisResult>();
  readonly openFolder = output<AnalysisResult>();
  readonly ignore = output<AnalysisResult>();
  readonly rescan = output<{ result: AnalysisResult; type: 'movie' | 'tv' }>();
  protected readonly lang = inject(LanguageService);
  protected readonly settings = inject(SettingsService);

  readonly filteredGroups = computed(() => {
    const allGroups = this.groups();
    const hideCleaned = this.settings.$hideCleanedSeasons();

    if (!hideCleaned) return allGroups;

    return allGroups
      .map((show) => {
        // Filter out seasons that are perfectly clean (no dirty, no missing)
        const visibleSeasons = show.seasons.filter((season) => {
          const dirtyCount = this.seasonDirtyCount(season.episodes);
          const hasMissing = season.episodes.some((e) =>
            e.result.filePath.startsWith('missing://'),
          );
          return dirtyCount > 0 || hasMissing;
        });

        // Return a new show object with only the visible seasons
        return {
          ...show,
          seasons: visibleSeasons,
        };
      })
      .filter((show) => show.seasons.length > 0); // Hide the show entirely if all seasons are hidden
  });

  private readonly _expandedShows = signal<Set<string>>(new Set());

  isExpanded(showKey: string): boolean {
    return this._expandedShows().has(showKey);
  }

  toggleShow(showKey: string): void {
    this._expandedShows.update((set) => {
      const next = new Set(set);
      if (next.has(showKey)) {
        next.delete(showKey);
      } else {
        next.add(showKey);
      }
      return next;
    });
  }

  toggleHideCleaned(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.settings.setHideCleanedSeasons(input.checked);
  }

  totalEpisodes(show: ResolvedSeriesGroup): number {
    return show.seasons.reduce((sum, s) => sum + s.episodes.length, 0);
  }

  seasonDirtyCount(episodes: SeriesEpisodeGroup[]): number {
    return episodes.filter((e) => !e.result.isClean && !e.result.isMissing)
      .length;
  }

  getDirtyEpisodeResults(episodes: SeriesEpisodeGroup[]): AnalysisResult[] {
    return episodes
      .filter((e) => !e.result.isClean && !e.result.isMissing)
      .map((e) => e.result);
  }

  formatEpCode(season: number, episode: number): string {
    return `S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}`;
  }

  isEpSample(result: AnalysisResult): boolean {
    const name = result.originalName.toLowerCase();
    const pathValue = result.filePath.toLowerCase();
    const isSampleSize =
      result.sizeBytes !== undefined &&
      result.sizeBytes > 0 &&
      result.sizeBytes < 100 * 1024 * 1024;
    return (
      (name.includes('sample') || pathValue.includes('sample')) && isSampleSize
    );
  }
}
