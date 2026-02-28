import { Component, inject } from '@angular/core';
import {
  AudioChannelType,
  BITRATE_THRESHOLDS,
  BitrateRange,
  ResolutionCategory,
} from '../../core/electron.service';
import { LanguageService } from '../../core/language.service';
import { MediaStore } from '../../core/media.store';

@Component({
  selector: 'app-filter-panel',
  standalone: true,
  template: `
    <div class="filter-panel">
      <div class="filter-header">
        <h2>{{ lang.translate('filter.filters') }}</h2>
        @if (hasMediaFiles()) {
          @if (isScanning()) {
            <button
              class="scan-again-btn cancel"
              (click)="cancelScan()"
              [title]="lang.translate('scan.cancel')"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                class="scan-icon spinning"
              >
                <path
                  d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1.05 14l4.64 4.36A9 9 0 0020.49 15"
                />
              </svg>
              {{ lang.translate('scan.cancel') }}
            </button>
          } @else {
            <button
              class="scan-again-btn"
              (click)="scanAgain()"
              [disabled]="isLoading()"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                class="scan-icon"
              >
                <path
                  d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1.05 14l4.64 4.36A9 9 0 0020.49 15"
                />
              </svg>
              {{ lang.translate('scan.again') }}
            </button>
          }
        }
        @if (hasActiveFilters()) {
          <button class="clear-btn" (click)="resetFilters()">
            {{ lang.translate('filter.clearAll') }}
          </button>
        }
      </div>

      <!-- Search -->
      <div class="filter-section">
        <label class="filter-label">{{
          lang.translate('filter.search')
        }}</label>
        <input
          type="text"
          class="search-input"
          [placeholder]="lang.translate('filter.searchPlaceholder')"
          [value]="filters().searchQuery || ''"
          (input)="onSearchChange($event)"
        />
      </div>

      <!-- Resolution Filter -->
      @if (availableResolutions().length > 0) {
        <div class="filter-section">
          <label class="filter-label">{{
            lang.translate('filter.resolution')
          }}</label>
          <div class="chip-group">
            @for (res of availableResolutions(); track res) {
              <button
                class="chip"
                [class.active]="isResolutionActive(res)"
                (click)="toggleResolution(res)"
              >
                {{ res }}
              </button>
            }
          </div>
        </div>
      }

      <!-- Audio Channels Filter -->
      @if (availableAudioChannels().length > 0) {
        <div class="filter-section">
          <label class="filter-label">{{
            lang.translate('filter.audio')
          }}</label>
          <div class="chip-group">
            @for (channel of availableAudioChannels(); track channel) {
              <button
                class="chip"
                [class.active]="isChannelActive(channel)"
                (click)="toggleChannel(channel)"
              >
                {{ channel }}
              </button>
            }
          </div>
        </div>
      }

      <!-- Language Filter -->
      @if (availableLanguages().length > 0) {
        <div class="filter-section">
          <label class="filter-label">{{
            lang.translate('filter.audioLanguage')
          }}</label>
          <div class="chip-group">
            @for (lang of availableLanguages(); track lang) {
              <button
                class="chip"
                [class.active]="isLanguageActive(lang)"
                (click)="toggleLanguage(lang)"
              >
                {{ formatLanguage(lang) }}
              </button>
            }
          </div>
        </div>
      }

      <!-- Codec Filter -->
      @if (availableCodecs().length > 0) {
        <div class="filter-section">
          <label class="filter-label">{{
            lang.translate('filter.codec')
          }}</label>
          <div class="chip-group">
            @for (codec of availableCodecs(); track codec) {
              <button
                class="chip"
                [class.active]="isCodecActive(codec)"
                (click)="toggleCodec(codec)"
              >
                {{ codec.toUpperCase() }}
              </button>
            }
          </div>
        </div>
      }

      <!-- Bitrate Filter -->
      @if (availableBitrateRanges().length > 0 || hasMediaFiles()) {
        <div class="filter-section">
          <label class="filter-label">{{
            lang.translate('filter.bitrate')
          }}</label>
          @if (availableBitrateRanges().length > 0) {
            <div class="chip-group">
              @for (range of availableBitrateRanges(); track range) {
                <button
                  class="chip"
                  [class.active]="isBitrateActive(range)"
                  (click)="toggleBitrate(range)"
                >
                  {{ getBitrateLabel(range) }}
                </button>
              }
            </div>
          }
          <div class="bitrate-custom">
            <span class="bitrate-label">{{
              lang.translate('filter.customBitrate')
            }}</span>
            <input
              type="text"
              class="bitrate-input"
              placeholder="e.g. 1-4"
              [value]="getCustomBitrateValue()"
              (input)="onCustomBitrateChange($event)"
              (blur)="onCustomBitrateBlur($event)"
            />
            @if (hasCustomBitrate()) {
              <button class="clear-custom" (click)="clearCustomBitrate()">
                ×
              </button>
            }
          </div>
        </div>
      }

      <!-- Stats -->
      <div class="filter-stats">
        <span
          >{{ stats().filteredFiles }} {{ lang.translate('stats.of') }}
          {{ stats().totalFiles }} {{ lang.translate('stats.files') }}</span
        >
        <span>{{ formatSize(stats().filteredSize) }}</span>
      </div>
    </div>
  `,
  styles: [
    `
      .filter-panel {
        padding: 1rem;
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
        height: 100%;
      }

      .filter-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      h2 {
        font-size: 0.875rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--color-text-secondary);
        margin: 0;
      }

      .clear-btn {
        font-size: 0.75rem;
        color: var(--color-primary);
        background: none;
        border: none;
        cursor: pointer;
        padding: 0;
      }

      .clear-btn:hover {
        text-decoration: underline;
      }

      .filter-section {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }

      .filter-label {
        font-size: 0.75rem;
        font-weight: 500;
        color: var(--color-text-secondary);
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      .search-input {
        width: 100%;
        padding: 0.5rem 0.75rem;
        background: var(--color-bg-tertiary);
        border: 1px solid var(--color-border);
        border-radius: 6px;
        color: var(--color-text-primary);
        font-size: 0.875rem;
      }

      .search-input:focus {
        outline: none;
        border-color: var(--color-primary);
      }

      .search-input::placeholder {
        color: var(--color-text-muted);
      }

      .chip-group {
        display: flex;
        flex-wrap: wrap;
        gap: 0.375rem;
      }

      .chip {
        padding: 0.25rem 0.625rem;
        font-size: 0.75rem;
        font-weight: 500;
        border-radius: 9999px;
        border: 1px solid var(--color-border);
        background: var(--color-bg-tertiary);
        color: var(--color-text-secondary);
        cursor: pointer;
        transition: all 0.15s ease;
      }

      .chip:hover {
        border-color: var(--color-primary);
        color: var(--color-text-primary);
      }

      .chip.active {
        background: var(--color-primary);
        border-color: var(--color-primary);
        color: white;
      }

      .filter-stats {
        margin-top: auto;
        padding-top: 1rem;
        border-top: 1px solid var(--color-border);
        display: flex;
        justify-content: space-between;
        font-size: 0.75rem;
        color: var(--color-text-secondary);
      }

      .bitrate-custom {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin-top: 0.5rem;
      }

      .bitrate-label {
        font-size: 0.75rem;
        color: var(--color-text-muted);
        white-space: nowrap;
      }

      .bitrate-input {
        width: 80px;
        padding: 0.25rem 0.5rem;
        background: var(--color-bg-tertiary);
        border: 1px solid var(--color-border);
        border-radius: 4px;
        color: var(--color-text-primary);
        font-size: 0.75rem;
      }

      .bitrate-input:focus {
        outline: none;
        border-color: var(--color-primary);
      }

      .bitrate-input::placeholder {
        color: var(--color-text-muted);
      }

      .clear-custom {
        background: none;
        border: none;
        color: var(--color-text-muted);
        cursor: pointer;
        font-size: 1rem;
        padding: 0 0.25rem;
      }

      .clear-custom:hover {
        color: var(--color-primary);
      }

      .scan-again-btn {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem 0.75rem;
        background: var(--color-primary);
        color: white;
        border: none;
        border-radius: 6px;
        font-size: 0.75rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
        margin-bottom: 0.25rem;
      }

      .scan-again-btn:hover:not(:disabled) {
        filter: brightness(1.1);
        transform: translateY(-1px);
      }

      .scan-again-btn.cancel {
        background: var(--color-danger, #dc2626);
      }

      .scan-again-btn:disabled {
        opacity: 0.7;
        cursor: wait;
      }

      .scan-icon {
        width: 14px;
        height: 14px;
      }

      .scan-icon.spinning {
        animation: spin 2s linear infinite;
      }

      @keyframes spin {
        from {
          transform: rotate(0deg);
        }
        to {
          transform: rotate(360deg);
        }
      }
    `,
  ],
})
export class FilterPanelComponent {
  private readonly store = inject(MediaStore);
  protected readonly lang = inject(LanguageService);

  readonly filters = this.store.filters;
  readonly stats = this.store.stats;
  readonly availableResolutions = this.store.availableResolutions;
  readonly availableAudioChannels = this.store.availableAudioChannels;
  readonly availableLanguages = this.store.availableLanguages;
  readonly availableCodecs = this.store.availableCodecs;
  readonly availableBitrateRanges = this.store.availableBitrateRanges;
  readonly isScanning = this.store.isScanning;
  readonly isLoading = this.store.isLoading;

  async scanAgain(): Promise<void> {
    const path = this.store.lastScanPath();
    if (path) {
      await this.store.scanDirectory(path, true);
    }
  }

  cancelScan(): void {
    this.store.cancelScan();
  }

  hasActiveFilters(): boolean {
    const f = this.filters();
    return (
      f.resolutions.length > 0 ||
      f.audioChannels.length > 0 ||
      f.audioLanguages.length > 0 ||
      f.videoCodecs.length > 0 ||
      (f.bitrateRanges?.length ?? 0) > 0 ||
      (f.searchQuery?.trim().length ?? 0) > 0
    );
  }

  isResolutionActive(res: ResolutionCategory): boolean {
    return this.filters().resolutions.includes(res);
  }

  isChannelActive(channel: AudioChannelType): boolean {
    return this.filters().audioChannels.includes(channel);
  }

  isLanguageActive(lang: string): boolean {
    return this.filters().audioLanguages.includes(lang);
  }

  isCodecActive(codec: string): boolean {
    return this.filters().videoCodecs.includes(codec);
  }

  toggleResolution(res: ResolutionCategory): void {
    const current = this.filters().resolutions;
    const updated = current.includes(res)
      ? current.filter((r) => r !== res)
      : [...current, res];
    this.store.updateFilters({ resolutions: updated });
  }

  toggleChannel(channel: AudioChannelType): void {
    const current = this.filters().audioChannels;
    const updated = current.includes(channel)
      ? current.filter((c) => c !== channel)
      : [...current, channel];
    this.store.updateFilters({ audioChannels: updated });
  }

  toggleLanguage(lang: string): void {
    const current = this.filters().audioLanguages;
    const updated = current.includes(lang)
      ? current.filter((l) => l !== lang)
      : [...current, lang];
    this.store.updateFilters({ audioLanguages: updated });
  }

  toggleCodec(codec: string): void {
    const current = this.filters().videoCodecs;
    const updated = current.includes(codec)
      ? current.filter((c) => c !== codec)
      : [...current, codec];
    this.store.updateFilters({ videoCodecs: updated });
  }

  isBitrateActive(range: BitrateRange): boolean {
    return this.filters().bitrateRanges?.includes(range) ?? false;
  }

  toggleBitrate(range: BitrateRange): void {
    const current = this.filters().bitrateRanges ?? [];
    const updated = current.includes(range)
      ? current.filter((r) => r !== range)
      : [...current, range];
    this.store.updateFilters({ bitrateRanges: updated });
  }

  getBitrateLabel(range: BitrateRange): string {
    return BITRATE_THRESHOLDS[range].label;
  }

  resetFilters(): void {
    this.store.resetFilters();
  }

  onSearchChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.store.setSearchQuery(input.value);
  }

  formatLanguage(lang: string): string {
    // Common ISO 639-1/639-2 language codes
    const langMap: Record<string, string> = {
      eng: 'English',
      en: 'English',
      spa: 'Spanish',
      es: 'Spanish',
      fra: 'French',
      fr: 'French',
      deu: 'German',
      de: 'German',
      ita: 'Italian',
      it: 'Italian',
      jpn: 'Japanese',
      ja: 'Japanese',
      kor: 'Korean',
      ko: 'Korean',
      zho: 'Chinese',
      zh: 'Chinese',
      por: 'Portuguese',
      pt: 'Portuguese',
      rus: 'Russian',
      ru: 'Russian',
      und: 'Undefined',
    };
    return langMap[lang.toLowerCase()] || lang.toUpperCase();
  }

  formatSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
  }

  // Custom bitrate range methods
  hasMediaFiles(): boolean {
    return this.stats().totalFiles > 0;
  }

  hasCustomBitrate(): boolean {
    return !!this.filters().customBitrateRange;
  }

  getCustomBitrateValue(): string {
    const range = this.filters().customBitrateRange;
    if (!range) return '';
    return `${range.minMbps}-${range.maxMbps}`;
  }

  onCustomBitrateChange(_event: Event): void {
    // Just track the input, parsing happens on blur
  }

  onCustomBitrateBlur(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = input.value.trim();

    if (!value) {
      this.store.updateFilters({ customBitrateRange: undefined });
      return;
    }

    // Parse "min-max" format (e.g., "1-4", "5-15")
    const match = value.match(/^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)$/);
    if (match) {
      const minMbps = parseFloat(match[1]);
      const maxMbps = parseFloat(match[2]);
      if (minMbps >= 0 && maxMbps > minMbps) {
        this.store.updateFilters({ customBitrateRange: { minMbps, maxMbps } });
        return;
      }
    }

    // Invalid format - reset to previous value or clear
    input.value = this.getCustomBitrateValue();
  }

  clearCustomBitrate(): void {
    this.store.updateFilters({ customBitrateRange: undefined });
  }
}
