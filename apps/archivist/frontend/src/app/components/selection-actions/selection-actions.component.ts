import { Component, effect, inject, OnDestroy, OnInit, signal, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ConfirmDialogService } from '@medularity/angular/decorators';
import { NotificationService } from '@medularity/angular/notifications';
import {
    ElectronService,
    MediaFile,
    TmdbMetadata,
} from '../../core/electron.service';
import { LanguageService, TranslationKey } from '../../core/language.service';
import { MatchQueueStore } from '../../core/match-queue.store';
import { MediaStore } from '../../core/media.store';
import { SettingsService } from '../../core/settings.service';
import { MatchDialogComponent } from '../match-dialog/match-dialog.component';
import { MetadataDialogComponent } from '../metadata-dialog/metadata-dialog.component';

@Component({
  selector: 'app-selection-actions',
  standalone: true,
  imports: [FormsModule, MatchDialogComponent, MetadataDialogComponent],
  template: `
    <div class="selection-panel">
      <div class="selection-header">
        <h2>{{ lang.translate('action.selected') }}</h2>
        <span class="selection-count"
          >{{ selectedCount() }}
          {{ selectedCount() === 1 ? 'file' : 'files' }}</span
        >
      </div>

      <div class="action-sections">
        <!-- Navigation -->
        <div class="action-section">
          <button class="action-btn" (click)="showInFinder()">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path
                d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
              />
            </svg>
            {{ lang.translate('action.showInFinder') }}
          </button>
          <button class="action-btn" (click)="moveSelected()">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
            {{ lang.translate('action.moveTo') }}
          </button>
        </div>

        <!-- Edit (only when 1 file selected) -->
        @if (selectedCount() === 1) {
          <div class="action-section">
            <button class="action-btn" (click)="openEditor()">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="m18 16 4-4-4-4" />
                <path d="m6 8-4 4 4 4" />
                <path d="m14.5 4-5 16" />
              </svg>
              {{ lang.translate('action.edit') }}
            </button>
            @if (isRenaming()) {
              <div class="rename-inline">
                <div class="rename-input-wrapper">
                  <input
                    type="text"
                    [(ngModel)]="newName"
                    (keyup.enter)="confirmRename()"
                    (keyup.escape)="cancelRename()"
                    [placeholder]="lang.translate('action.enterNewName')"
                    class="rename-input"
                  />
                  @if (renameType() === 'file' && fileExtension) {
                    <span class="file-extension">{{ fileExtension }}</span>
                  }
                </div>
                <div class="rename-actions">
                  @if (renameType() === 'file') {
                    <button
                      class="action-btn-small"
                      (click)="useFolderName()"
                      [title]="lang.translate('action.useFolderNameHint')"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                      >
                        <path
                          d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                        />
                      </svg>
                    </button>
                  }
                  <button class="action-btn-small" (click)="confirmRename()">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </button>
                  <button class="action-btn-small" (click)="cancelRename()">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              </div>
            } @else {
              <button class="action-btn" (click)="openRenameDialog()">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path
                    d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"
                  />
                </svg>
                {{ lang.translate('action.rename') }}
              </button>
              <button class="action-btn" (click)="openRenameFolderDialog()">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path
                    d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                  />
                  <path d="M10 13h4" />
                </svg>
                {{ lang.translate('action.renameFolder') }}
              </button>
            }
          </div>

          <!-- Metadata Actions (single file only) -->
          <div class="action-section">
            <button class="action-btn" (click)="requeryRating()">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M1 4v6h6" />
                <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
              </svg>
              {{ lang.translate('action.requeryRating') }}
            </button>
            <button class="action-btn" (click)="openMatchDialog()">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"
                />
                <circle cx="12" cy="10" r="2" />
                <path d="m9 14 2-2 2 2" />
              </svg>
              {{ lang.translate('action.matchToTmdb') }}
            </button>
            <button class="action-btn" (click)="openMetadataDialog()">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"
                />
              </svg>
              {{ lang.translate('action.writeMetadata') }}
            </button>
          </div>
        }

        <!-- Danger Zone -->
        <div class="action-section danger-section">
          <button class="action-btn danger" (click)="deleteSelected()">
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
            {{ lang.translate('action.delete') }}
          </button>
          <button class="action-btn danger" (click)="deleteSeason()">
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
              <line x1="10" y1="11" x2="10" y2="17" />
              <line x1="14" y1="11" x2="14" y2="17" />
            </svg>
            {{ lang.translate('action.deleteSeason') }}
          </button>
        </div>
      </div>

      <!-- Clear selection & Stats -->
      <div class="selection-footer">
        <button class="clear-btn" (click)="deselectAll()">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
          {{ lang.translate('action.clearSelection') }}
        </button>
        <div class="selection-stats">
          <span>{{ formatSize(totalSize()) }}</span>
        </div>
      </div>
    </div>

    <!-- Match Dialog -->
    @if (showMatchDialog()) {
      <plex-match-dialog
        [file]="matchDialogFile()!"
        (closed)="closeMatchDialog()"
        (matched)="onMatchConfirmed($event)"
        (addedToQueue)="onAddedToQueue($event)"
      />
    }

    <!-- Metadata Dialog -->
    @if (showMetadataDialog()) {
      <app-metadata-dialog
        [file]="metadataDialogFile()!"
        (closed)="closeMetadataDialog()"
        (saved)="onMetadataSaved($event)"
      >
      </app-metadata-dialog>
    }
  `,
  styles: [
    `
      .selection-panel {
        display: flex;
        flex-direction: column;
        height: 100%;
        padding: 1rem;
      }

      .selection-header {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        margin-bottom: 1.5rem;
      }

      h2 {
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--text-secondary);
        margin: 0;
      }

      .selection-count {
        font-size: 1.5rem;
        font-weight: 600;
        color: var(--accent-color);
      }

      .action-sections {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        flex: 1;
      }

      .action-section {
        display: flex;
        flex-direction: column;
        gap: 0.375rem;
        padding-bottom: 1rem;
        border-bottom: 1px solid var(--border-color);
      }

      .action-section:last-child {
        border-bottom: none;
      }

      .action-btn {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        width: 100%;
        padding: 0.625rem 0.75rem;
        background: var(--bg-tertiary);
        border: 1px solid var(--border-color);
        border-radius: 6px;
        color: var(--text-primary);
        font-size: 0.875rem;
        cursor: pointer;
        transition: all 0.15s ease;
        text-align: left;
      }

      .action-btn:hover {
        background: var(--bg-hover);
        border-color: var(--accent-color);
      }

      .action-btn svg {
        width: 18px;
        height: 18px;
        flex-shrink: 0;
        color: var(--text-secondary);
      }

      .action-btn:hover svg {
        color: var(--accent-color);
      }

      .action-btn.danger {
        color: #ef4444;
      }

      .action-btn.danger:hover {
        background: rgba(239, 68, 68, 0.1);
        border-color: #ef4444;
      }

      .action-btn.danger svg {
        color: #ef4444;
      }

      .danger-section {
        margin-top: auto;
      }

      .rename-inline {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }

      .rename-input-wrapper {
        display: flex;
        align-items: center;
        background: var(--bg-tertiary);
        border: 1px solid var(--accent-color);
        border-radius: 6px;
        overflow: hidden;
      }

      .rename-input {
        flex: 1;
        padding: 0.5rem 0.75rem;
        background: transparent;
        border: none;
        color: var(--text-primary);
        font-size: 0.875rem;
        min-width: 0;
      }

      .rename-input:focus {
        outline: none;
      }

      .file-extension {
        padding: 0.5rem 0.75rem 0.5rem 0;
        color: var(--text-secondary);
        font-size: 0.875rem;
        white-space: nowrap;
      }

      .rename-actions {
        display: flex;
        gap: 0.375rem;
      }

      .action-btn-small {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0.5rem;
        background: var(--bg-tertiary);
        border: 1px solid var(--border-color);
        border-radius: 6px;
        color: var(--text-secondary);
        cursor: pointer;
        transition: all 0.15s ease;
      }

      .action-btn-small:hover {
        background: var(--bg-hover);
        color: var(--accent-color);
        border-color: var(--accent-color);
      }

      .action-btn-small svg {
        width: 16px;
        height: 16px;
      }

      .selection-footer {
        margin-top: auto;
        padding-top: 1rem;
        border-top: 1px solid var(--border-color);
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }

      .clear-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        width: 100%;
        padding: 0.5rem 0.75rem;
        background: transparent;
        border: 1px solid var(--border-color);
        border-radius: 6px;
        color: var(--text-secondary);
        font-size: 0.875rem;
        cursor: pointer;
        transition: all 0.15s ease;
      }

      .clear-btn:hover {
        background: var(--bg-hover);
        color: var(--text-primary);
      }

      .clear-btn svg {
        width: 14px;
        height: 14px;
      }

      .selection-stats {
        display: flex;
        justify-content: center;
        font-size: 0.75rem;
        color: var(--text-tertiary);
      }
    `,
  ],
})
export class SelectionActionsComponent implements OnInit, OnDestroy {
  @ViewChild(MatchDialogComponent)
  private matchDialogRef?: MatchDialogComponent;

  private readonly store = inject(MediaStore);
  private readonly settingsService = inject(SettingsService);
  private readonly notifications = inject(NotificationService);
  private readonly electron = inject(ElectronService);
  protected readonly lang = inject(LanguageService);
  private readonly confirmable = inject(ConfirmDialogService);
  private readonly router = inject(Router);
  private readonly queueStore = inject(MatchQueueStore);

  readonly selectedCount = this.store.selectedCount;
  readonly selectedFiles = this.store.selectedFiles;

  readonly totalSize = () =>
    this.selectedFiles().reduce((sum, f) => sum + f.sizeBytes, 0);

  readonly isRenaming = signal(false);
  readonly renameType = signal<'file' | 'folder'>('file');
  newName = '';
  fileExtension = '';

  // Folders pending deletion
  private pendingFolderDeletion: string[] = [];

  // Match dialog state
  readonly showMatchDialog = signal(false);
  readonly matchDialogFile = signal<MediaFile | null>(null);

  constructor() {
    // Set up effect to update native menu when selection changes
    effect(() => {
      const count = this.selectedCount();
      const hasSelection = count > 0;
      const isSingleFile = count === 1;
      this.electron.updateMenuSelection(hasSelection, isSingleFile);
    });
  }

  ngOnInit(): void {
    // Listen for menu actions from the native menu
    this.electron.onMenuAction((action) => {
      switch (action) {
        case 'show-in-finder':
          this.showInFinder();
          break;
        case 'edit':
          this.openEditor();
          break;
        case 'requery-rating':
          this.requeryRating();
          break;
        case 'match-tmdb':
          this.openMatchDialog();
          break;
        case 'write-metadata':
          this.openMetadataDialog();
          break;
      }
    });
  }

  ngOnDestroy(): void {
    // Clean up menu action listener
    this.electron.removeMenuActionListener();
    // Reset menu to no selection state
    this.electron.updateMenuSelection(false, false);
  }

  // Metadata dialog state
  readonly showMetadataDialog = signal(false);
  readonly metadataDialogFile = signal<MediaFile | null>(null);

  deselectAll(): void {
    this.store.deselectAll();
  }

  async showInFinder(): Promise<void> {
    await this.store.showSelectedInFinder();
  }

  async moveSelected(): Promise<void> {
    const dest = await this.electron.selectDestination();
    if (!dest) return;

    const result = await this.store.moveSelected(dest);
    if (result.successCount > 0) {
      this.showNotification(
        'notify.moveSuccess',
        'success',
        result.successCount,
      );
    }
    if (result.errorCount > 0) {
      this.showNotification('notify.moveError', 'danger');
    }
  }

  async deleteSelected(): Promise<void> {
    const confirmation = await this.confirmable.confirm({
      header: this.lang.translate('confirm.deleteFiles'),
      message: this.lang.translate('confirm.cannotUndo'),
      positive: this.lang.translate('confirm.delete'),
      negative: this.lang.translate('confirm.cancel'),
    });

    if (!confirmation) {
      return;
    }

    const selected = this.store.selectedFiles();
    const parentFolders = [...new Set(selected.map((f) => f.directory))];

    const result = await this.store.deleteSelected(false);

    if (result.successCount > 0) {
      this.showNotification(
        'notify.deleteSuccess',
        'success',
        result.successCount,
      );
    }
    if (result.errorCount > 0) {
      this.showNotification('notify.deleteError', 'danger');
    }

    if (this.settingsService.$alwaysDeleteEnclosingFolder()) {
      await this.store.deleteEmptyFolders(parentFolders);
    } else {
      this.pendingFolderDeletion = parentFolders;
      await this.askToDeleteFolders();
    }
  }

  async deleteSeason(): Promise<void> {
    const confirmation = await this.confirmable.confirm({
      header: this.lang.translate('confirm.deleteSeason'),
      message: this.lang.translate('confirm.deleteSeasonDesc'),
      positive: this.lang.translate('action.deleteSeason'),
      negative: this.lang.translate('action.cancel'),
    });

    if (!confirmation) {
      return;
    }

    const result = await this.store.deleteSeason([...this.store.selectedIds()]);
    if (result.successCount > 0) {
      this.showNotification('notify.seasonDeleteSuccess', 'success');
    }
    if (result.errorCount > 0) {
      this.showNotification('notify.deleteError', 'danger');
    }
  }

  private async askToDeleteFolders(): Promise<void> {
    const confirmation = await this.confirmable.confirm({
      header: this.lang.translate('confirm.deleteFolders'),
      message: this.lang.translate('confirm.deleteFoldersDesc'),
      positive: this.lang.translate('confirm.yes'),
      negative: this.lang.translate('confirm.no'),
    });

    if (!confirmation) {
      return;
    }

    if (this.pendingFolderDeletion.length > 0) {
      await this.store.deleteEmptyFolders(this.pendingFolderDeletion);
      this.pendingFolderDeletion = [];
    }
  }

  openRenameDialog(): void {
    const selected = this.store.selectedFiles();
    if (selected.length !== 1) return;

    const filename = selected[0].filename;
    const lastDotIndex = filename.lastIndexOf('.');
    if (lastDotIndex > 0) {
      this.newName = filename.substring(0, lastDotIndex);
      this.fileExtension = filename.substring(lastDotIndex);
    } else {
      this.newName = filename;
      this.fileExtension = '';
    }
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
      // Append the file extension back
      const fullFilename = this.newName + this.fileExtension;
      success = await this.store.renameSelectedFile(fullFilename);
    } else {
      success = await this.store.renameSelectedFolder(this.newName);
    }

    if (success) {
      this.showNotification('notify.renameSuccess', 'success');
    } else {
      this.showNotification('notify.renameError', 'danger');
    }

    this.isRenaming.set(false);
  }

  cancelRename(): void {
    this.isRenaming.set(false);
    this.newName = '';
    this.fileExtension = '';
  }

  useFolderName(): void {
    const selected = this.store.selectedFiles();
    if (selected.length !== 1) return;

    const dir = selected[0].directory;
    const folderName = dir.substring(dir.lastIndexOf('/') + 1);
    // Extension is already stored in fileExtension, so just set the base name
    this.newName = folderName;
  }

  // Editor
  openEditor(): void {
    const selected = this.selectedFiles();
    if (selected.length !== 1) return;
    this.router.navigate(['/editor', selected[0].id]);
  }

  // Rating
  async requeryRating(): Promise<void> {
    const selected = this.selectedFiles();
    if (selected.length !== 1) return;
    await this.store.requeryRating(selected[0].filename);
  }

  // Match dialog methods
  openMatchDialog(): void {
    const selected = this.selectedFiles();
    if (selected.length !== 1) return;

    // Check if TMDB API key is configured
    if (!this.settingsService.$tmdbApiKey()) {
      this.notifications.add({
        message: this.lang.translate('notify.noTmdbApiKey'),
        type: 'warning',
        config: { duration: 8000 },
      });
      return;
    }

    this.matchDialogFile.set(selected[0]);
    this.showMatchDialog.set(true);
  }

  closeMatchDialog(): void {
    this.showMatchDialog.set(false);
    this.matchDialogFile.set(null);
  }

  async onMatchConfirmed(event: {
    metadata: TmdbMetadata;
    embedMetadata: boolean;
  }): Promise<void> {
    const file = this.matchDialogFile();
    if (!file) return;

    try {
      const result = await this.electron.matchFile(
        file.path,
        event.metadata,
        event.embedMetadata,
      );

      if (result.success) {
        if (result.newPath !== file.path) {
          this.store.updateFilePath(file.id, result.newPath);
        }
        this.showNotification('notify.matchSuccess', 'success');
      } else {
        this.showNotification('notify.matchError', 'danger');
      }
    } finally {
      this.matchDialogRef?.finishProcessing();
      this.closeMatchDialog();
    }
  }

  onAddedToQueue(event: {
    metadata: TmdbMetadata;
    embedMetadata: boolean;
  }): void {
    const file = this.matchDialogFile();
    if (!file) return;

    this.queueStore.addToQueue(file, event.metadata, event.embedMetadata);
    this.showNotification('queue.itemAdded', 'success');
    this.closeMatchDialog();
  }

  // Metadata dialog methods
  openMetadataDialog(): void {
    const selected = this.selectedFiles();
    if (selected.length !== 1) return;

    this.metadataDialogFile.set(selected[0]);
    this.showMetadataDialog.set(true);
  }

  closeMetadataDialog(): void {
    this.showMetadataDialog.set(false);
    this.metadataDialogFile.set(null);
  }

  async onMetadataSaved(metadata: TmdbMetadata): Promise<void> {
    const file = this.metadataDialogFile();
    this.closeMetadataDialog();

    if (!file) return;

    try {
      const result = await this.electron.writeMetadata(file.path, metadata);

      if (result.success) {
        this.notifications.add({
          message: this.lang.translate('metadata.writeSuccess'),
          type: 'success',
        });
      } else {
        this.notifications.add({
          message: `${this.lang.translate('metadata.writeError')}: ${result.error}`,
          type: 'danger',
        });
      }
    } catch (error) {
      this.notifications.add({
        message: `${this.lang.translate('metadata.writeError')}: ${String(error)}`,
        type: 'danger',
      });
    }
  }

  formatSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
  }

  private showNotification(
    key: TranslationKey,
    type: 'success' | 'danger',
    count?: number,
  ): void {
    let message = this.lang.translate(key);
    if (count !== undefined) {
      message = message.replace('{count}', count.toString());
    }
    this.notifications.add({ message, type });
  }
}
