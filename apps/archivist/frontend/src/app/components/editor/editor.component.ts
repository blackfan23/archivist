import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
    AudioCodec,
    AudioTranscodeOptions,
    ContainerFormat,
    EditorResult,
    ElectronService,
    MediaFile,
    SubtitleFormat,
    VideoCodec,
    VideoTranscodeOptions,
} from '../../core/electron.service';
import { LanguageService } from '../../core/language.service';

type OperationStatus = 'idle' | 'processing' | 'success' | 'error';

@Component({
  selector: 'app-editor',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="editor-container">
      <!-- Header -->
      <header class="editor-header">
        <a routerLink="/" class="back-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          {{ lang.translate('editor.backToLibrary') }}
        </a>
        <h1>{{ lang.translate('editor.title') }}</h1>
      </header>

      @if (loading()) {
        <div class="loading-state">{{ lang.translate('editor.loading') }}</div>
      } @else if (!mediaFile()) {
        <div class="error-state">{{ lang.translate('editor.fileNotFound') }}</div>
      } @else {
        <!-- File Info -->
        <section class="file-info">
          <h2>{{ mediaFile()?.filename }}</h2>
          <p class="file-path">{{ mediaFile()?.path }}</p>
          <div class="file-meta">
            <span class="tag">{{ mediaFile()?.container || 'Unknown' }}</span>
            @if (videoStream(); as video) {
              <span class="tag">{{ video.codec }} {{ video.width }}x{{ video.height }}</span>
            }
            @if (audioStream(); as audio) {
              <span class="tag">{{ audio.codec }} {{ audio.channelType }}</span>
            }
            <span class="tag">{{ formatDuration(mediaFile()?.duration) }}</span>
            <span class="tag">{{ formatSize(mediaFile()?.sizeBytes) }}</span>
          </div>
        </section>

        <!-- Progress Bar -->
        @if (electron.editorProgress(); as progress) {
          <div class="progress-section">
            <div class="progress-bar">
              <div class="progress-fill" [style.width.%]="progress.percent"></div>
            </div>
            <div class="progress-info">
              <span>{{ progress.percent }}%</span>
              @if (progress.timeProcessed) {
                <span>{{ progress.timeProcessed }}</span>
              }
              @if (progress.speed) {
                <span>{{ progress.speed }}</span>
              }
            </div>
          </div>
        }

        <!-- Operation Result -->
        @if (operationStatus() !== 'idle') {
          <div class="result-section" [class]="operationStatus()">
            @if (operationStatus() === 'processing') {
              <span class="spinner"></span> {{ lang.translate('editor.processing') }}
            } @else if (operationStatus() === 'success') {
              ✓ {{ lang.translate('editor.success') }}: {{ lastOutputPath() }}
            } @else if (operationStatus() === 'error') {
              ✗ {{ lang.translate('editor.error') }}: {{ lastError() }}
            }
          </div>
        }

        <!-- Panels -->
        <div class="panels-grid">
          <!-- Container Conversion -->
          <section class="panel">
            <h3>{{ lang.translate('editor.containerConversion') }}</h3>
            <p class="panel-desc">{{ lang.translate('editor.containerDesc') }}</p>
            <div class="panel-controls">
              <select class="select" (change)="onContainerChange($event)">
                @for (format of containerFormats; track format) {
                  <option [value]="format" [selected]="selectedContainer() === format">{{ format.toUpperCase() }}</option>
                }
              </select>
              <button class="btn primary" (click)="convertContainer()" [disabled]="isProcessing()">
                {{ lang.translate('editor.convert') }}
              </button>
            </div>
          </section>

          <!-- Video Transcoding -->
          <section class="panel">
            <h3>{{ lang.translate('editor.videoTranscoding') }}</h3>
            <p class="panel-desc">{{ lang.translate('editor.videoDesc') }}</p>
            <div class="panel-controls">
              <label>{{ lang.translate('editor.codec') }}</label>
              <select class="select" (change)="onVideoCodecChange($event)">
                @for (codec of videoCodecs; track codec) {
                  <option [value]="codec" [selected]="selectedVideoCodec() === codec">{{ codec.toUpperCase() }}</option>
                }
              </select>
              
              <label>{{ lang.translate('editor.quality') }} (CRF: {{ videoCrf() }})</label>
              <input type="range" min="0" max="51" [value]="videoCrf()" (input)="onCrfChange($event)" class="slider" />
              
              <label>{{ lang.translate('editor.preset') }}</label>
              <select class="select" (change)="onPresetChange($event)">
                @for (preset of presets; track preset) {
                  <option [value]="preset" [selected]="videoPreset() === preset">{{ preset }}</option>
                }
              </select>
              
              <button class="btn primary" (click)="transcodeVideo()" [disabled]="isProcessing()">
                {{ lang.translate('editor.transcode') }}
              </button>
            </div>
          </section>

          <!-- Audio Transcoding -->
          <section class="panel">
            <h3>{{ lang.translate('editor.audioTranscoding') }}</h3>
            <p class="panel-desc">{{ lang.translate('editor.audioDesc') }}</p>
            <div class="panel-controls">
              <label>{{ lang.translate('editor.codec') }}</label>
              <select class="select" (change)="onAudioCodecChange($event)">
                @for (codec of audioCodecs; track codec) {
                  <option [value]="codec" [selected]="selectedAudioCodec() === codec">{{ codec.toUpperCase() }}</option>
                }
              </select>
              
              <label>{{ lang.translate('editor.bitrate') }} (kbps)</label>
              <select class="select" (change)="onBitrateChange($event)">
                @for (rate of audioBitrates; track rate) {
                  <option [value]="rate" [selected]="audioBitrate() === rate">{{ rate }}</option>
                }
              </select>
              
              <button class="btn primary" (click)="transcodeAudio()" [disabled]="isProcessing()">
                {{ lang.translate('editor.transcode') }}
              </button>
            </div>
          </section>

          <!-- Subtitles -->
          <section class="panel">
            <h3>{{ lang.translate('editor.subtitles') }}</h3>
            <p class="panel-desc">{{ lang.translate('editor.subtitlesDesc') }}</p>
            
            @if ((mediaFile()?.subtitleStreams?.length || 0) > 0) {
              <div class="subtitle-list">
                @for (sub of mediaFile()?.subtitleStreams; track sub.index; let i = $index) {
                  <div class="subtitle-item">
                    <span>{{ i + 1 }}. {{ sub.language || 'Unknown' }} ({{ sub.codec }})</span>
                    <div class="subtitle-actions">
                      <button class="btn small" (click)="extractSubtitle(sub.index)" [disabled]="isProcessing()">
                        {{ lang.translate('editor.extract') }}
                      </button>
                      <button class="btn small danger" (click)="removeSubtitle(sub.index)" [disabled]="isProcessing()">
                        {{ lang.translate('editor.remove') }}
                      </button>
                    </div>
                  </div>
                }
              </div>
            } @else {
              <p class="no-subs">{{ lang.translate('editor.noSubtitles') }}</p>
            }
            
            <div class="panel-controls">
              <button class="btn secondary" (click)="addSubtitleFile()" [disabled]="isProcessing()">
                {{ lang.translate('editor.addSubtitle') }}
              </button>
            </div>
          </section>

          <!-- Custom Command -->
          <section class="panel span-2">
            <h3>{{ lang.translate('editor.customCommand') }}</h3>
            <p class="panel-desc">{{ lang.translate('editor.customDesc') }}</p>
            
            <div class="panel-controls">
              @if (commandHistory().length > 0) {
                <label>{{ lang.translate('editor.history') }}</label>
                <select class="select" (change)="selectHistoryCommand($event)">
                  <option value="">{{ lang.translate('editor.selectPrevious') }}</option>
                  @for (cmd of commandHistory(); track cmd) {
                    <option [value]="cmd">{{ cmd.slice(0, 60) }}...</option>
                  }
                </select>
              }
              
              <label>{{ lang.translate('editor.command') }}</label>
              <textarea 
                class="textarea" 
                rows="3" 
                [value]="customCommand()"
                (input)="onCommandInput($event)"
                placeholder="-i input.mkv -c copy output.mp4"
              ></textarea>
              
              <button class="btn primary" (click)="runCustomCommand()" [disabled]="isProcessing() || !customCommand()">
                {{ lang.translate('editor.execute') }}
              </button>
            </div>
          </section>
        </div>
      }
    </div>
  `,
  styles: [`
    .editor-container {
      padding: 1.5rem;
      max-width: 1200px;
      margin: 0 auto;
    }

    .editor-header {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: 1.5rem;
    }

    .editor-header h1 {
      font-size: 1.5rem;
      font-weight: 600;
      margin: 0;
    }

    .back-btn {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      color: var(--text-secondary);
      text-decoration: none;
      font-size: 0.875rem;
      padding: 0.5rem 1rem;
      border-radius: 6px;
      transition: all 0.15s ease;
    }

    .back-btn:hover {
      background: var(--bg-hover);
      color: var(--text-primary);
    }

    .back-btn svg {
      width: 16px;
      height: 16px;
    }

    .loading-state, .error-state {
      text-align: center;
      padding: 3rem;
      color: var(--text-secondary);
    }

    .file-info {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 1.25rem;
      margin-bottom: 1.5rem;
    }

    .file-info h2 {
      font-size: 1.125rem;
      font-weight: 600;
      margin: 0 0 0.25rem 0;
      word-break: break-all;
    }

    .file-path {
      font-size: 0.8125rem;
      color: var(--text-tertiary);
      margin: 0 0 0.75rem 0;
      word-break: break-all;
    }

    .file-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    .tag {
      background: var(--bg-tertiary);
      color: var(--text-secondary);
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 500;
    }

    .progress-section {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 1rem;
      margin-bottom: 1rem;
    }

    .progress-bar {
      height: 8px;
      background: var(--bg-tertiary);
      border-radius: 4px;
      overflow: hidden;
    }

    .progress-fill {
      height: 100%;
      background: var(--accent-color);
      transition: width 0.3s ease;
    }

    .progress-info {
      display: flex;
      justify-content: space-between;
      font-size: 0.75rem;
      color: var(--text-secondary);
      margin-top: 0.5rem;
    }

    .result-section {
      padding: 0.75rem 1rem;
      border-radius: 6px;
      margin-bottom: 1rem;
      font-size: 0.875rem;
    }

    .result-section.processing {
      background: rgba(59, 130, 246, 0.1);
      color: #3b82f6;
    }

    .result-section.success {
      background: rgba(34, 197, 94, 0.1);
      color: #22c55e;
    }

    .result-section.error {
      background: rgba(239, 68, 68, 0.1);
      color: #ef4444;
    }

    .spinner {
      display: inline-block;
      width: 14px;
      height: 14px;
      border: 2px solid currentColor;
      border-top-color: transparent;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
      margin-right: 0.5rem;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .panels-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 1rem;
    }

    @media (max-width: 900px) {
      .panels-grid {
        grid-template-columns: 1fr;
      }
      .panel.span-2 {
        grid-column: auto;
      }
    }

    .panel {
      display: flex;
      flex-direction: column;
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 1.25rem;
    }

    .panel.span-2 {
      grid-column: span 2;
    }

    .panel h3 {
      font-size: 1rem;
      font-weight: 600;
      margin: 0 0 0.25rem 0;
    }

    .panel-desc {
      font-size: 0.8125rem;
      color: var(--text-secondary);
      margin: 0 0 1rem 0;
    }

    .panel-controls {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      flex: 1;
    }

    .panel-controls .btn.primary {
      margin-top: auto;
    }

    .panel-controls label {
      font-size: 0.8125rem;
      color: var(--text-secondary);
      margin-bottom: -0.5rem;
    }

    .select, .textarea {
      padding: 0.5rem 0.75rem;
      background: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      color: var(--text-primary);
      font-size: 0.875rem;
    }

    .select:focus, .textarea:focus {
      outline: none;
      border-color: var(--accent-color);
    }

    .textarea {
      resize: vertical;
      min-height: 60px;
      font-family: monospace;
    }

    .slider {
      width: 100%;
      cursor: pointer;
    }

    .btn {
      padding: 0.5rem 1rem;
      border: none;
      border-radius: 6px;
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .btn.primary {
      background: var(--accent-color);
      color: white;
    }

    .btn.primary:hover:not(:disabled) {
      filter: brightness(1.1);
    }

    .btn.secondary {
      background: var(--bg-tertiary);
      color: var(--text-primary);
      border: 1px solid var(--border-color);
    }

    .btn.secondary:hover:not(:disabled) {
      background: var(--bg-hover);
    }

    .btn.small {
      padding: 0.25rem 0.5rem;
      font-size: 0.75rem;
    }

    .btn.danger {
      background: #dc2626;
      color: white;
    }

    .btn.danger:hover:not(:disabled) {
      background: #b91c1c;
    }

    .subtitle-list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      margin-bottom: 1rem;
    }

    .subtitle-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.5rem;
      background: var(--bg-tertiary);
      border-radius: 4px;
      font-size: 0.8125rem;
    }

    .subtitle-actions {
      display: flex;
      gap: 0.25rem;
    }

    .no-subs {
      font-size: 0.8125rem;
      color: var(--text-tertiary);
      font-style: italic;
      margin: 0 0 1rem 0;
    }
  `],
})
export class EditorComponent implements OnInit {
  protected readonly electron = inject(ElectronService);
  protected readonly lang = inject(LanguageService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  // State
  readonly loading = signal(true);
  readonly mediaFile = signal<MediaFile | null>(null);
  readonly operationStatus = signal<OperationStatus>('idle');
  readonly lastOutputPath = signal('');
  readonly lastError = signal('');
  readonly commandHistory = signal<string[]>([]);

  // Computed
  readonly videoStream = computed(() => this.mediaFile()?.videoStreams?.[0]);
  readonly audioStream = computed(() => this.mediaFile()?.audioStreams?.[0]);
  readonly isProcessing = computed(() => this.operationStatus() === 'processing');

  // Options
  readonly containerFormats: ContainerFormat[] = ['mkv', 'mp4', 'avi', 'mov', 'webm', 'ts'];
  readonly videoCodecs: VideoCodec[] = ['h264', 'h265', 'vp9', 'av1'];
  readonly audioCodecs: AudioCodec[] = ['aac', 'ac3', 'mp3', 'flac', 'opus'];
  readonly presets = ['ultrafast', 'superfast', 'veryfast', 'faster', 'fast', 'medium', 'slow', 'slower', 'veryslow'] as const;
  readonly audioBitrates = [64, 96, 128, 192, 256, 320];
  readonly subtitleFormats: SubtitleFormat[] = ['srt', 'ass', 'vtt'];

  // Form state
  readonly selectedContainer = signal<ContainerFormat>('mkv');
  readonly selectedVideoCodec = signal<VideoCodec>('h264');
  readonly videoCrf = signal(23);
  readonly videoPreset = signal<typeof this.presets[number]>('medium');
  readonly selectedAudioCodec = signal<AudioCodec>('aac');
  readonly audioBitrate = signal(128);
  readonly customCommand = signal('');

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.loading.set(false);
      return;
    }

    const file = await this.electron.getMediaFileById(id);
    if (file) {
      this.mediaFile.set(file);
      // Set default container based on current file
      const ext = file.extension?.replace('.', '') as ContainerFormat;
      if (this.containerFormats.includes(ext)) {
        this.selectedContainer.set(ext);
      }
    }

    // Load command history
    const history = await this.electron.getCommandHistory();
    this.commandHistory.set(history);

    this.loading.set(false);
  }

  formatDuration(seconds?: number): string {
    if (!seconds) return '--:--';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) {
      return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  formatSize(bytes?: number): string {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let i = 0;
    let size = bytes;
    while (size >= 1024 && i < units.length - 1) {
      size /= 1024;
      i++;
    }
    return `${size.toFixed(1)} ${units[i]}`;
  }

  onCrfChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.videoCrf.set(parseInt(input.value, 10));
  }

  onContainerChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.selectedContainer.set(select.value as ContainerFormat);
  }

  onVideoCodecChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.selectedVideoCodec.set(select.value as VideoCodec);
  }

  onPresetChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.videoPreset.set(select.value as typeof this.presets[number]);
  }

  onAudioCodecChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.selectedAudioCodec.set(select.value as AudioCodec);
  }

  onBitrateChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.audioBitrate.set(parseInt(select.value, 10));
  }

  onCommandInput(event: Event): void {
    const input = event.target as HTMLTextAreaElement;
    this.customCommand.set(input.value);
  }

  selectHistoryCommand(event: Event): void {
    const select = event.target as HTMLSelectElement;
    if (select.value) {
      this.customCommand.set(select.value);
    }
  }

  private async handleResult(result: EditorResult): Promise<void> {
    if (result.success) {
      this.operationStatus.set('success');
      this.lastOutputPath.set(result.outputPath || '');
      this.lastError.set('');
      // Refresh library to show new file
      await this.refreshLibrary();
    } else {
      this.operationStatus.set('error');
      this.lastError.set(result.error || 'Unknown error');
      this.lastOutputPath.set('');
    }
  }

  private async refreshLibrary(): Promise<void> {
    const lastScanPath = await this.electron.getLastScanPath();
    if (lastScanPath) {
      await this.electron.scanDirectory(lastScanPath);
    }
  }

  async convertContainer(): Promise<void> {
    const file = this.mediaFile();
    if (!file) return;

    this.operationStatus.set('processing');
    const result = await this.electron.convertContainer(file.path, this.selectedContainer(), file.duration);
    await this.handleResult(result);
  }

  async transcodeVideo(): Promise<void> {
    const file = this.mediaFile();
    if (!file) return;

    const options: VideoTranscodeOptions = {
      codec: this.selectedVideoCodec(),
      crf: this.videoCrf(),
      preset: this.videoPreset(),
    };

    this.operationStatus.set('processing');
    const result = await this.electron.transcodeVideo(file.path, options, file.duration);
    await this.handleResult(result);
  }

  async transcodeAudio(): Promise<void> {
    const file = this.mediaFile();
    if (!file) return;

    const options: AudioTranscodeOptions = {
      codec: this.selectedAudioCodec(),
      bitrate: this.audioBitrate(),
    };

    this.operationStatus.set('processing');
    const result = await this.electron.transcodeAudio(file.path, options, file.duration);
    await this.handleResult(result);
  }

  async extractSubtitle(trackIndex: number): Promise<void> {
    const file = this.mediaFile();
    if (!file) return;

    this.operationStatus.set('processing');
    const result = await this.electron.extractSubtitle(file.path, trackIndex, 'srt');
    await this.handleResult(result);
  }

  async removeSubtitle(trackIndex: number): Promise<void> {
    const file = this.mediaFile();
    if (!file) return;

    this.operationStatus.set('processing');
    const result = await this.electron.removeSubtitle(file.path, trackIndex, file.duration);
    await this.handleResult(result);
  }

  async addSubtitleFile(): Promise<void> {
    const file = this.mediaFile();
    if (!file) return;

    const subtitlePath = await this.electron.selectSubtitleFile();
    if (!subtitlePath) return;

    this.operationStatus.set('processing');
    const result = await this.electron.addSubtitle(file.path, subtitlePath, undefined, file.duration);
    await this.handleResult(result);
  }

  async runCustomCommand(): Promise<void> {
    const command = this.customCommand().trim();
    if (!command) return;

    this.operationStatus.set('processing');
    const result = await this.electron.runCustomCommand(command);
    await this.handleResult(result);

    // Refresh history
    const history = await this.electron.getCommandHistory();
    this.commandHistory.set(history);
  }
}
