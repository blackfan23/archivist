import { Component, computed, inject, signal } from '@angular/core';
import { formatDistanceToNow } from 'date-fns';
import { LanguageService } from '../../core/language.service';
import { MediaStore } from '../../core/media.store';

@Component({
  selector: 'app-scan-controls',
  standalone: true,
  template: `
    <div class="scan-controls">
      @if (isScanning()) {
        <div class="progress-container">
          <div class="progress-info">
            <span class="progress-text">
              {{ lang.translate('scan.scanning') }} {{ scanProgress().processedCount }}
              @if (scanProgress().totalCount) {
                / {{ scanProgress().totalCount }}
              }
              {{ lang.translate('scan.files') }}
            </span>
            @if (scanProgress().errorCount > 0) {
              <button class="error-count-btn" (click)="toggleErrorPanel()">
                {{ scanProgress().errorCount }} {{ lang.translate('scan.errors') }}
              </button>
            }
          </div>
          <div class="progress-bar">
            <div 
              class="progress-fill" 
              [style.width.%]="progressPercent()">
            </div>
          </div>
        </div>
        <button class="btn btn-danger" (click)="cancelScan()">
          {{ lang.translate('scan.cancel') }}
        </button>
      } @else {
        <div class="scan-info">
          @if (lastScanPath()) {
            <span class="last-scan-path" [title]="lastScanPath()">
              {{ truncatedPath() }}
            </span>
            @if (lastScanAt()) {
              <span class="last-scan-time">
                {{ lastScanTimeAgo() }}
              </span>
            }
          }
          @if (scanProgress().errorCount > 0) {
            <button class="error-count-btn" (click)="toggleErrorPanel()">
              {{ scanProgress().errorCount }} {{ lang.translate('scan.errors') }}
            </button>
          }
        </div>
        
        <div class="actions">
          <button class="btn btn-primary" (click)="selectAndScan()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
            </svg>
            {{ lang.translate('scan.folder') }}
          </button>
          
          @if (stats().totalFiles > 0) {
            <button class="btn btn-secondary" (click)="rescan()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 4v6h6M23 20v-6h-6"/>
                <path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15"/>
              </svg>
              {{ lang.translate('scan.rescan') }}
            </button>
          }
          
          <span class="stats">
            {{ stats().totalFiles }} {{ lang.translate('scan.files') }} · {{ formattedSize() }}
          </span>
        </div>
      }
    </div>
    
    <!-- Error Panel -->
    @if (showErrorPanel()) {
      <div class="error-panel-overlay" (click)="toggleErrorPanel()">
        <div class="error-panel" (click)="$event.stopPropagation()">
          <div class="error-panel-header">
            <h3>{{ lang.translate('scan.errorList') }}</h3>
            <button class="close-btn" (click)="toggleErrorPanel()">×</button>
          </div>
          <div class="error-panel-body">
            @for (error of scanProgress().errors; track error.path) {
              <div class="error-item">
                <div class="error-item-content">
                  <span class="error-path" [title]="error.path">{{ getFilename(error.path) }}</span>
                  <span class="error-message">{{ error.error }}</span>
                </div>
                <button class="open-folder-btn" (click)="showInFinder(error.path)" title="Open enclosing folder">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
                  </svg>
                </button>
              </div>
            } @empty {
              <p class="no-errors">{{ lang.translate('scan.noErrors') }}</p>
            }
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    :host {
      display: contents;
    }
    
    .scan-controls {
      display: flex;
      align-items: center;
      gap: 1rem;
      flex: 1;
    }
    
    .progress-container {
      flex: 1;
      max-width: 400px;
    }
    
    .progress-info {
      display: flex;
      justify-content: space-between;
      font-size: 0.75rem;
      margin-bottom: 0.25rem;
    }
    
    .progress-text {
      color: var(--text-secondary);
    }
    
    .error-count-btn {
      background: none;
      border: none;
      color: var(--error-color);
      cursor: pointer;
      font-size: inherit;
      padding: 0;
      text-decoration: underline;
    }
    
    .error-count-btn:hover {
      opacity: 0.8;
    }
    
    .progress-bar {
      height: 6px;
      background: var(--bg-tertiary);
      border-radius: 3px;
      overflow: hidden;
    }
    
    .progress-fill {
      height: 100%;
      background: var(--accent-color);
      transition: width 0.2s ease;
    }
    
    .scan-info {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      color: var(--text-secondary);
      font-size: 0.875rem;
    }
    
    .last-scan-path {
      max-width: 200px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    
    .last-scan-time {
      opacity: 0.7;
    }
    
    .actions {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-left: auto;
    }
    
    .stats {
      color: var(--text-secondary);
      font-size: 0.875rem;
    }
    
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 1rem;
      border: none;
      border-radius: 6px;
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    
    .btn svg {
      width: 16px;
      height: 16px;
    }
    
    .btn-primary {
      background: var(--accent-color);
      color: white;
    }
    
    .btn-primary:hover {
      background: var(--accent-hover);
    }
    
    .btn-secondary {
      background: var(--bg-tertiary);
      color: var(--text-primary);
    }
    
    .btn-secondary:hover {
      background: var(--bg-hover);
    }
    
    .btn-danger {
      background: var(--error-color);
      color: white;
    }
    
    .btn-danger:hover {
      opacity: 0.9;
    }
    
    .error-panel-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }
    
    .error-panel {
      background: var(--bg-secondary);
      border-radius: 8px;
      width: 90%;
      max-width: 600px;
      max-height: 70vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    }
    
    .error-panel-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem;
      border-bottom: 1px solid var(--border-color);
    }
    
    .error-panel-header h3 {
      margin: 0;
      font-size: 1rem;
      color: var(--text-primary);
    }
    
    .close-btn {
      background: none;
      border: none;
      font-size: 1.5rem;
      cursor: pointer;
      color: var(--text-secondary);
      padding: 0 0.5rem;
    }
    
    .close-btn:hover {
      color: var(--text-primary);
    }
    
    .error-panel-body {
      overflow-y: auto;
      padding: 1rem;
    }
    
    .error-item {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 0.75rem;
      background: var(--bg-tertiary);
      border-radius: 4px;
      margin-bottom: 0.5rem;
    }
    
    .error-item:last-child {
      margin-bottom: 0;
    }

    .error-item-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      min-width: 0;
    }
    
    .error-path {
      font-weight: 500;
      color: var(--text-primary);
      font-size: 0.875rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    .error-message {
      color: var(--error-color);
      font-size: 0.75rem;
    }

    .open-folder-btn {
      background: none;
      border: none;
      color: var(--text-secondary);
      cursor: pointer;
      padding: 0.5rem;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s ease;
    }

    .open-folder-btn:hover {
      background: var(--bg-hover);
      color: var(--text-primary);
    }

    .open-folder-btn svg {
      width: 18px;
      height: 18px;
    }
    
    .no-errors {
      text-align: center;
      color: var(--text-secondary);
    }
  `],
})
export class ScanControlsComponent {
  private readonly store = inject(MediaStore);
  protected readonly lang = inject(LanguageService);
  
  readonly showErrorPanel = signal(false);
  
  readonly isScanning = this.store.isScanning;
  readonly scanProgress = this.store.scanProgress;
  readonly lastScanPath = this.store.lastScanPath;
  readonly lastScanAt = this.store.lastScanAt;
  readonly stats = this.store.stats;
  
  readonly progressPercent = computed(() => {
    const progress = this.scanProgress();
    if (!progress.totalCount || progress.totalCount === 0) return 0;
    return Math.round((progress.processedCount / progress.totalCount) * 100);
  });
  
  readonly truncatedPath = computed(() => {
    const path = this.lastScanPath();
    if (!path) return '';
    const parts = path.split('/');
    if (parts.length <= 3) return path;
    return '.../' + parts.slice(-2).join('/');
  });
  
  readonly formattedSize = computed(() => {
    const bytes = this.stats().totalSize;
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
  });
  
  readonly lastScanTimeAgo = computed(() => {
    const timestamp = this.lastScanAt();
    if (!timestamp) return '';
    return formatDistanceToNow(timestamp, { addSuffix: true });
  });

  selectAndScan(): void {
    this.store.selectAndScan();
  }
  
  rescan(): void {
    const path = this.lastScanPath();
    if (path) {
      this.store.scanDirectory(path);
    }
  }
  
  cancelScan(): void {
    this.store.cancelScan();
  }
  
  toggleErrorPanel(): void {
    this.showErrorPanel.update((v: boolean) => !v);
  }
  
  getFilename(path: string): string {
    return path.split('/').pop() || path;
  }

  showInFinder(path: string): void {
    this.store.showInFinder(path);
  }
}
