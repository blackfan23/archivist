import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Confirmable } from '@medularity/angular/decorators';
import { NotificationService } from '@medularity/angular/notifications';
import { LanguageService, TranslationKey } from '../../core/language.service';
import { MediaStore } from '../../core/media.store';
import { SettingsService } from '../../core/settings.service';

@Component({
  selector: 'app-media-table',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="table-container">
      @if (files().length === 0) {
        <div class="empty-state">
          @if (isScanning()) {
            <div class="scanning-indicator">
              <div class="spinner"></div>
              <p>{{ lang.translate('table.scanningMedia') }}</p>
            </div>
          } @else if (isLoading()) {
            <p>{{ lang.translate('table.loadingLibrary') }}</p>
          } @else {
            <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
            </svg>
            <h3>{{ lang.translate('table.noFiles') }}</h3>
            <p>{{ lang.translate('table.scanToStart') }}</p>
          }
        </div>
      } @else {
        <!-- Rename dialog -->
        @if (isRenaming()) {
          <div class="rename-dialog">
            <input 
              type="text" 
              [(ngModel)]="newName"
              (keyup.enter)="confirmRename()"
              (keyup.escape)="cancelRename()"
              [placeholder]="lang.translate('action.enterNewName')"
              class="rename-input"
            />
            @if (renameType() === 'file') {
              <button class="action-btn" (click)="useFolderName()" [title]="lang.translate('action.useFolderNameHint')">
                {{ lang.translate('action.useFolderName') }}
              </button>
            }
            <button class="action-btn" (click)="confirmRename()">{{ lang.translate('action.save') }}</button>
            <button class="action-btn" (click)="cancelRename()">{{ lang.translate('action.cancel') }}</button>
          </div>
        }
        
        <!-- Table header -->
        <div class="table-header">
          <div class="col-checkbox">
            <input 
              type="checkbox" 
              [checked]="allSelected()"
              [indeterminate]="someSelected()"
              (change)="toggleSelectAll()"
            />
          </div>
          <div class="col-filename" (click)="sortBy('filename')">
            {{ lang.translate('table.filename') }}
            @if (sortedBy() === 'filename') {
              <span class="sort-icon">{{ sortDir() === 'asc' ? '↑' : '↓' }}</span>
            }
          </div>
          <div class="col-resolution" (click)="sortBy('resolution')">
            {{ lang.translate('table.resolution') }}
            @if (sortedBy() === 'resolution') {
              <span class="sort-icon">{{ sortDir() === 'asc' ? '↑' : '↓' }}</span>
            }
          </div>
          <div class="col-rating" (click)="sortBy('rating')">
            Rating
            @if (sortedBy() === 'rating') {
              <span class="sort-icon">{{ sortDir() === 'asc' ? '↑' : '↓' }}</span>
            }
          </div>
          <div class="col-audio">{{ lang.translate('table.audio') }}</div>
          <div class="col-duration" (click)="sortBy('duration')">
            {{ lang.translate('table.duration') }}
            @if (sortedBy() === 'duration') {
              <span class="sort-icon">{{ sortDir() === 'asc' ? '↑' : '↓' }}</span>
            }
          </div>
          <div class="col-bitrate" (click)="sortBy('bitrate')">
            {{ lang.translate('table.bitrate') }}
            @if (sortedBy() === 'bitrate') {
              <span class="sort-icon">{{ sortDir() === 'asc' ? '↑' : '↓' }}</span>
            }
          </div>
          <div class="col-size" (click)="sortBy('size')">
            {{ lang.translate('table.size') }}
            @if (sortedBy() === 'size') {
              <span class="sort-icon">{{ sortDir() === 'asc' ? '↑' : '↓' }}</span>
            }
          </div>
        </div>
        
        <!-- Table body -->
        <div class="table-body">
          @for (file of files(); track file.id) {
            <div 
              class="table-row"
              [class.selected]="isSelected(file.id)"
              (click)="toggleSelection(file.id)">
              <div class="col-checkbox" (click)="$event.stopPropagation()">
                <input 
                  type="checkbox" 
                  [checked]="isSelected(file.id)"
                  (change)="toggleSelection(file.id)"
                />
              </div>
              <div class="col-filename">
                <span class="filename" [title]="file.path">{{ file.filename }}</span>
                <span class="filepath">{{ truncatePath(file.directory) }}</span>
              </div>
              <div class="col-resolution">
                @if (file.videoStreams[0]; as video) {
                  <span class="badge" [class]="getResolutionClass(video.resolution)">
                    {{ video.resolution }}
                  </span>
                  <span class="codec">{{ video.codec.toUpperCase() }}</span>
                }
              </div>
              <div class="col-rating">
                @if (getRating(file.filename); as rating) {
                  @if (rating.notFound) {
                    <span class="rating-not-found" [title]="'Not found: ' + rating.searchedTitle">
                      <span class="not-found-icon">?</span>
                    </span>
                  } @else {
                    <span class="rating-badge" [title]="rating.Title + ' (' + rating.Year + ')'">
                      <span class="rating-star">★</span>
                      {{ getDisplayRating(rating) }}
                    </span>
                  }
                }
              </div>
              <div class="col-audio">
                @for (audio of file.audioStreams.slice(0, 2); track audio.index) {
                  <span class="audio-badge">
                    {{ audio.channelType }}
                    @if (audio.language) {
                      · {{ formatLanguage(audio.language) }}
                    }
                  </span>
                }
                @if (file.audioStreams.length > 2) {
                  <span class="more">+{{ file.audioStreams.length - 2 }}</span>
                }
              </div>
              <div class="col-duration">
                {{ formatDuration(file.duration) }}
              </div>
              <div class="col-bitrate">
                {{ formatBitrate(file.bitrate) }}
              </div>
              <div class="col-size">
                {{ formatSize(file.sizeBytes) }}
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      overflow: hidden;
    }
    
    .table-container {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      overflow: hidden;
    }
    
    .empty-state {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: var(--text-secondary);
      gap: 0.5rem;
    }
    
    .empty-icon {
      width: 64px;
      height: 64px;
      opacity: 0.3;
      margin-bottom: 1rem;
    }
    
    .empty-state h3 {
      font-size: 1.25rem;
      color: var(--text-primary);
      margin: 0;
    }
    
    .empty-state p {
      margin: 0;
    }
    
    .scanning-indicator {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
    }
    
    .spinner {
      width: 40px;
      height: 40px;
      border: 3px solid var(--bg-tertiary);
      border-top-color: var(--accent-color);
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    
    .rename-dialog {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 1rem;
      background: var(--bg-secondary);
      border-bottom: 1px solid var(--border-color);
    }
    
    .rename-input {
      flex: 1;
      padding: 0.5rem;
      border: 1px solid var(--border-color);
      border-radius: 4px;
      background: var(--bg-primary);
      color: var(--text-primary);
      font-size: 0.875rem;
    }
    
    .table-header {
      display: flex;
      align-items: center;
      padding: 0.75rem 1rem;
      background: var(--bg-secondary);
      border-bottom: 1px solid var(--border-color);
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-secondary);
    }
    
    .table-header > div {
      cursor: pointer;
    }
    
    .table-header > div:hover {
      color: var(--text-primary);
    }
    
    .sort-icon {
      margin-left: 0.25rem;
    }
    
    .table-body {
      flex: 1;
      overflow-y: auto;
    }
    
    .table-row {
      display: flex;
      align-items: center;
      padding: 0.75rem 1rem;
      border-bottom: 1px solid var(--border-color);
      cursor: pointer;
      transition: background 0.15s ease;
    }
    
    .table-row:hover {
      background: var(--bg-hover);
    }
    
    .table-row.selected {
      background: var(--bg-selected);
    }
    
    .col-checkbox {
      width: 40px;
      flex-shrink: 0;
    }
    
    .col-checkbox input {
      cursor: pointer;
    }
    
    .col-filename {
      flex: 1;
      min-width: 200px;
      display: flex;
      flex-direction: column;
      gap: 0.125rem;
      overflow: hidden;
    }
    
    .filename {
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    .filepath {
      font-size: 0.75rem;
      color: var(--text-tertiary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    .col-resolution {
      width: 140px;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .col-rating {
      width: 80px;
      flex-shrink: 0;
      display: flex;
      align-items: center;
    }
    
    .rating-badge {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.125rem 0.375rem;
      background: rgba(245, 197, 24, 0.15); /* IMDb yellow tint */
      color: #f5c518;
      border: 1px solid rgba(245, 197, 24, 0.3);
      border-radius: 4px;
      font-weight: 600;
      font-size: 0.75rem;
    }
    
    .rating-star {
      font-size: 0.875rem;
      line-height: 1;
    }

    .rating-not-found {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0.125rem 0.375rem;
      background: rgba(200, 200, 200, 0.15);
      color: var(--text-tertiary);
      border: 1px solid rgba(200, 200, 200, 0.3);
      border-radius: 4px;
      font-size: 0.75rem;
      cursor: help;
    }

    .not-found-icon {
      font-size: 0.75rem;
      font-weight: 600;
      opacity: 0.7;
    }
    
    .badge {
      padding: 0.125rem 0.5rem;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 600;
    }
    
    .badge.res-4k {
      background: #7c3aed;
      color: white;
    }
    
    .badge.res-1080p {
      background: #2563eb;
      color: white;
    }
    
    .badge.res-720p {
      background: #0891b2;
      color: white;
    }
    
    .badge.res-sd {
      background: var(--bg-tertiary);
      color: var(--text-secondary);
    }
    
    .codec {
      font-size: 0.75rem;
      color: var(--text-secondary);
    }
    
    .col-audio {
      width: 180px;
      flex-shrink: 0;
      display: flex;
      flex-wrap: wrap;
      gap: 0.25rem;
    }
    
    .audio-badge {
      font-size: 0.75rem;
      padding: 0.125rem 0.375rem;
      background: var(--bg-tertiary);
      border-radius: 4px;
      color: var(--text-secondary);
    }
    
    .more {
      font-size: 0.75rem;
      color: var(--text-tertiary);
    }
    
    .col-duration {
      width: 80px;
      flex-shrink: 0;
      font-size: 0.875rem;
      color: var(--text-secondary);
    }
    
    .col-bitrate {
      width: 80px;
      flex-shrink: 0;
      font-size: 0.875rem;
      color: var(--text-secondary);
    }
    
    .col-size {
      width: 80px;
      flex-shrink: 0;
      font-size: 0.875rem;
      color: var(--text-secondary);
      text-align: right;
    }
  `],
})
export class MediaTableComponent {
  private readonly store = inject(MediaStore);
  private readonly settingsService = inject(SettingsService);
  private readonly notifications = inject(NotificationService);
  protected readonly lang = inject(LanguageService);  
  readonly files = this.store.filteredFiles;
  readonly isScanning = this.store.isScanning;
  readonly isLoading = this.store.isLoading;
  readonly selectedIds = this.store.selectedIds;
  readonly selectedCount = this.store.selectedCount;
  readonly filters = this.store.filters;
  
  readonly sortedBy = computed(() => this.filters().sortBy);
  readonly sortDir = computed(() => this.filters().sortDirection);
  
  readonly allSelected = computed(() => {
    const files = this.files();
    const selected = this.selectedIds();
    return files.length > 0 && files.every((f) => selected.has(f.id));
  });
  
  readonly someSelected = computed(() => {
    const files = this.files();
    const selected = this.selectedIds();
    const count = files.filter((f) => selected.has(f.id)).length;
    return count > 0 && count < files.length;
  });
  
  readonly isRenaming = signal(false);
  readonly renameType = signal<'file' | 'folder'>('file');
  newName = '';
  

  
  isSelected(id: string): boolean {
    return this.selectedIds().has(id);
  }
  
  toggleSelection(id: string): void {
    this.store.toggleSelection(id);
  }
  
  toggleSelectAll(): void {
    if (this.allSelected()) {
      this.store.deselectAll();
    } else {
      this.store.selectAll();
    }
  }
  
  deselectAll(): void {
    this.store.deselectAll();
  }
  
  sortBy(column: 'filename' | 'size' | 'duration' | 'resolution' | 'bitrate' | 'rating'): void {
    const current = this.filters();
    const newDir = current.sortBy === column && current.sortDirection === 'asc' ? 'desc' : 'asc';
    this.store.updateFilters({ sortBy: column, sortDirection: newDir });
  }
  
  async moveSelected(): Promise<void> {
    const electron = (await import('../../core/electron.service')).ElectronService;
    // This would need dependency injection, simplified for now
    // In real implementation, inject ElectronService and use selectDestination
  }
  
  @Confirmable({
    header: 'Delete selected files?',
    message: 'This action cannot be undone.',
    positive: 'Delete',
    negative: 'Cancel'
  })
  async deleteSelected(): Promise<void> {
    // Get the parent folders BEFORE deleting files
    const selected = this.store.selectedFiles();
    const parentFolders = [...new Set(selected.map((f) => f.directory))];
    
    // Delete files only (not parent folders yet)
    const result = await this.store.deleteSelected(false);
    
    // Show notification
    if (result.successCount > 0) {
      this.showNotification('notify.deleteSuccess', 'success', result.successCount);
    }
    if (result.errorCount > 0) {
      this.showNotification('notify.deleteError', 'danger');
    }
    
    // Check if we should always delete enclosing folders
    if (this.settingsService.$alwaysDeleteEnclosingFolder()) {
      // Auto-delete folders without asking
      await this.store.deleteEmptyFolders(parentFolders);
    } else {
      // Store parent folders for potential deletion and ask
      this.pendingFolderDeletion = parentFolders;
      await this.askToDeleteFolders();
    }
  }

  @Confirmable({
    header: 'confirm.deleteSeason',
    message: 'confirm.deleteSeasonDesc',
    positive: 'action.deleteSeason',
    negative: 'action.cancel'
  })
  async deleteSeason(): Promise<void> {
    const result = await this.store.deleteSeason([...this.selectedIds()]);
    if (result.successCount > 0) {
      this.showNotification('notify.seasonDeleteSuccess', 'success');
    }
    if (result.errorCount > 0) {
      this.showNotification('notify.deleteError', 'danger');
    }
  }
  
  // Store folders pending deletion between confirmations
  private pendingFolderDeletion: string[] = [];
  
  @Confirmable({
    header: 'Delete enclosing folder(s)?',
    message: 'Do you want to also delete the parent folder(s) if they are now empty?',
    positive: 'Yes, delete folders',
    negative: 'No, keep folders'
  })
  private async askToDeleteFolders(): Promise<void> {
    // This is called only if user confirms folder deletion
    if (this.pendingFolderDeletion.length > 0) {
      await this.store.deleteEmptyFolders(this.pendingFolderDeletion);
      this.pendingFolderDeletion = [];
    }
  }
  
  async showInFinder(): Promise<void> {
    await this.store.showSelectedInFinder();
  }
  
  openRenameDialog(): void {
    const selected = this.store.selectedFiles();
    if (selected.length !== 1) return;
    
    this.newName = selected[0].filename;
    this.renameType.set('file');
    this.isRenaming.set(true);
  }
  
  openRenameFolderDialog(): void {
    const selected = this.store.selectedFiles();
    if (selected.length === 0) return;
    
    const dir = selected[0].directory;
    const folderName = dir.substring(dir.lastIndexOf('/') + 1);
    this.newName = folderName;
    this.renameType.set('folder');
    this.isRenaming.set(true);
  }
  
  async confirmRename(): Promise<void> {
    if (!this.newName.trim()) {
      this.cancelRename();
      return;
    }
    
    let success = false;
    if (this.renameType() === 'file') {
      success = await this.store.renameSelectedFile(this.newName);
    } else {
      success = await this.store.renameSelectedFolder(this.newName);
    }
    
    if (success) {
      this.showNotification('notify.renameSuccess', 'success');
    } else {
      this.showNotification('notify.renameError', 'danger');
    }
    
    this.cancelRename();
  }
  
  cancelRename(): void {
    this.isRenaming.set(false);
    this.newName = '';
  }
  
  useFolderName(): void {
    const selected = this.store.selectedFiles();
    if (selected.length !== 1) return;
    
    const file = selected[0];
    const dir = file.directory;
    const folderName = dir.substring(dir.lastIndexOf('/') + 1);
    
    // Preserve the file extension
    const extMatch = file.filename.match(/\.[^.]+$/);
    const extension = extMatch ? extMatch[0] : '';
    
    this.newName = folderName + extension;
  }
  
  getRating(filename: string): import('../../core/electron.service').OmdbRating | undefined {
    return this.store.getRating(filename);
  }

  /**
   * Get display rating value - handles both OMDB and TMDB formats
   * OMDB: uses `imdbRating` (string like "7.5")
   * TMDB: uses `rating` field (number 0-10)
   */
  getDisplayRating(rating: unknown): string {
    // Type guard for rating object
    if (!rating || typeof rating !== 'object') return '--';
    
    const ratingObj = rating as Record<string, unknown>;
    
    // OMDB format - has imdbRating string
    if ('imdbRating' in ratingObj && typeof ratingObj['imdbRating'] === 'string' && ratingObj['imdbRating']) {
      return ratingObj['imdbRating'];
    }
    
    // TMDB format - has rating number
    if ('rating' in ratingObj && typeof ratingObj['rating'] === 'number') {
      return ratingObj['rating'].toFixed(1);
    }
    
    return '--';
  }

  getResolutionClass(resolution: string): string {
    switch (resolution) {
      case '4K': return 'res-4k';
      case '1080p': return 'res-1080p';
      case '720p': return 'res-720p';
      default: return 'res-sd';
    }
  }
  
  formatDuration(seconds?: number): string {
    if (!seconds) return '--:--';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
  }
  
  formatSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
  }
  
  formatBitrate(bitsPerSecond?: number): string {
    if (!bitsPerSecond) return '--';
    const mbps = bitsPerSecond / 1_000_000;
    return `${mbps.toFixed(1)} Mb`;
  }
  
  formatLanguage(lang: string): string {
    const langMap: Record<string, string> = {
      'eng': 'EN', 'en': 'EN',
      'spa': 'ES', 'es': 'ES',
      'fra': 'FR', 'fr': 'FR',
      'deu': 'DE', 'de': 'DE',
      'ita': 'IT', 'it': 'IT',
      'jpn': 'JP', 'ja': 'JP',
      'kor': 'KR', 'ko': 'KR',
      'zho': 'ZH', 'zh': 'ZH',
    };
    return langMap[lang.toLowerCase()] || lang.toUpperCase().slice(0, 2);
  }
  
  truncatePath(path: string): string {
    const parts = path.split('/');
    if (parts.length <= 3) return path;
    return '.../' + parts.slice(-2).join('/');
  }
  
  private showNotification(
    key: TranslationKey, 
    type: 'success' | 'danger' | 'basic' = 'basic',
    count?: number
  ): void {
    let message = this.lang.translate(key);
    if (count !== undefined) {
      message = message.replace('{count}', count.toString());
    }
    this.notifications.add({ message, type });
  }
}
