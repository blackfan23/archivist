import { CommonModule } from '@angular/common';
import { Component, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ConfirmDialogService } from '@medularity/angular/decorators';
import { NotificationService } from '@medularity/angular/notifications';
import { CleanerStore } from '../../core/cleaner.store';
import { ElectronService } from '../../core/electron.service';
import { LanguageService } from '../../core/language.service';
import { MediaStore } from '../../core/media.store';

@Component({
  selector: 'app-cleaner-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="cleaner-container">
      <div class="cleaner-header">
        <div class="header-main">
          <h2>{{ lang.translate('cleaner.title') }}</h2>
          <p class="path-hint">{{ store.lastScanPath() }}</p>
        </div>

        <div class="header-actions">
          @if (
            cleanerStore.status() === 'idle' ||
            cleanerStore.status() === 'completed'
          ) {
            <button class="scan-btn" (click)="startScan()">
              {{ lang.translate('cleaner.startScan') }}
            </button>
          } @else if (cleanerStore.isScanning()) {
            <button class="cancel-btn" (click)="cleanerStore.cancel()">
              {{ lang.translate('scan.cancel') }}
            </button>
          }

          @if (selectedPaths().length > 0) {
            <button
              class="delete-btn"
              [disabled]="cleanerStore.isDeleting()"
              (click)="deleteSelected()"
            >
              {{
                lang.translate('cleaner.deleteSelected', {
                  count: selectedPaths().length,
                })
              }}
            </button>
          }
        </div>
      </div>

      <div class="cleaner-content">
        @if (cleanerStore.isScanning()) {
          <div class="loading-state">
            <div class="spinner"></div>
            <p>{{ lang.translate('cleaner.scanning') }}</p>
          </div>
        } @else if (cleanerStore.isDeleting()) {
          <div class="loading-state">
            <div class="spinner"></div>
            <p>{{ lang.translate('cleaner.deleting') }}</p>
          </div>
        } @else if (cleanerStore.hasResults()) {
          <div class="results-grid">
            <!-- Empty Folders Section -->
            @if (cleanerStore.emptyFolders().length > 0) {
              <section class="result-section">
                <div class="section-header">
                  <h3>
                    {{ lang.translate('cleaner.emptyFolders') }} ({{
                      cleanerStore.emptyFolders().length
                    }})
                  </h3>
                  <button
                    class="select-all-btn"
                    (click)="toggleSectionSelection('folder')"
                  >
                    {{
                      isSectionAllSelected('folder')
                        ? 'Deselect All'
                        : 'Select All'
                    }}
                  </button>
                </div>
                <div class="items-list">
                  @for (item of cleanerStore.emptyFolders(); track item.path) {
                    <div
                      class="item-row"
                      [class.selected]="isSelected(item.path)"
                      (click)="toggleSelection(item.path)"
                      (keydown.enter)="toggleSelection(item.path)"
                      (keydown.space)="toggleSelection(item.path)"
                      tabindex="0"
                    >
                      <div class="item-checkbox">
                        <div
                          class="check-mark"
                          [class.checked]="isSelected(item.path)"
                        ></div>
                      </div>
                      <div class="item-icon folder">
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
                      </div>
                      <div class="item-info">
                        <span class="item-path">{{ item.path }}</span>
                      </div>
                    </div>
                  }
                </div>
              </section>
            }

            <!-- Small Files Section -->
            @if (cleanerStore.smallFiles().length > 0) {
              <section class="result-section">
                <div class="section-header">
                  <h3>
                    {{ lang.translate('cleaner.smallFiles') }} ({{
                      cleanerStore.smallFiles().length
                    }})
                  </h3>
                  <button
                    class="select-all-btn"
                    (click)="toggleSectionSelection('file')"
                  >
                    {{
                      isSectionAllSelected('file')
                        ? 'Deselect All'
                        : 'Select All'
                    }}
                  </button>
                </div>
                <div class="items-list">
                  @for (item of cleanerStore.smallFiles(); track item.path) {
                    <div
                      class="item-row"
                      [class.selected]="isSelected(item.path)"
                      (click)="toggleSelection(item.path)"
                      (keydown.enter)="toggleSelection(item.path)"
                      (keydown.space)="toggleSelection(item.path)"
                      tabindex="0"
                    >
                      <div class="item-checkbox">
                        <div
                          class="check-mark"
                          [class.checked]="isSelected(item.path)"
                        ></div>
                      </div>
                      <div class="item-icon file">
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                        >
                          <path
                            d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z"
                          />
                          <path d="M13 2v7h7" />
                        </svg>
                      </div>
                      <div class="item-info">
                        <span class="item-name">{{ item.filename }}</span>
                        <span class="item-details"
                          >{{ formatSize(item.sizeBytes) }} •
                          {{ item.path }}</span
                        >
                      </div>
                    </div>
                  }
                </div>
              </section>
            }
          </div>
        } @else if (cleanerStore.status() === 'reviewing') {
          <div class="empty-results">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
            >
              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p>{{ lang.translate('cleaner.noResults') }}</p>
          </div>
        } @else if (cleanerStore.error()) {
          <div class="empty-results">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              style="color: var(--color-danger)"
            >
              <path
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <p style="color: var(--color-danger)">{{ cleanerStore.error() }}</p>
            <button class="scan-btn" (click)="startScan()">
              {{ lang.translate('cleaner.startScan') }}
            </button>
          </div>
        } @else {
          <div class="start-state">
            <button class="big-scan-btn" (click)="startScan()">
              {{ lang.translate('cleaner.startScan') }}
            </button>
          </div>
        }
      </div>
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

      .cleaner-container {
        display: flex;
        flex-direction: column;
        height: 100%;
        width: 100%;
        background: var(--color-bg-primary);
        padding: 1.5rem;
        gap: 1.5rem;
        overflow: hidden;
      }

      .cleaner-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 1rem;
      }

      h2 {
        margin: 0;
        font-size: 1.5rem;
        font-weight: 700;
        letter-spacing: -0.01em;
      }

      .path-hint {
        margin: 0.25rem 0 0;
        font-size: 0.875rem;
        color: var(--color-text-secondary);
        font-family: var(--font-mono);
        opacity: 0.8;
      }

      .header-actions {
        display: flex;
        gap: 0.75rem;
      }

      .cleaner-content {
        flex: 1;
        display: flex;
        flex-direction: column;
        overflow-y: auto;
        border-radius: 12px;
        background: var(--color-bg-secondary);
        border: 1px solid var(--color-border);
        position: relative;
      }

      .results-grid {
        display: flex;
        flex-direction: column;
        gap: 2rem;
        padding: 1.5rem;
      }

      .section-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1rem;
      }

      .result-section h3 {
        font-size: 0.875rem;
        font-weight: 600;
        color: var(--color-text-muted);
        text-transform: uppercase;
        letter-spacing: 0.05em;
        margin: 0;
      }

      .select-all-btn {
        padding: 0.25rem 0.5rem;
        background: transparent;
        border: 1px solid var(--color-border);
        border-radius: 4px;
        color: var(--color-text-secondary);
        font-size: 0.75rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.15s ease;
      }

      .select-all-btn:hover {
        background: var(--color-bg-tertiary);
        border-color: var(--color-primary);
        color: var(--color-primary);
      }

      .items-list {
        display: flex;
        flex-direction: column;
        gap: 2px;
        background: var(--color-border);
        border: 1px solid var(--color-border);
        border-radius: 8px;
        overflow: hidden;
      }

      .item-row {
        display: flex;
        align-items: center;
        gap: 1rem;
        padding: 0.75rem 1rem;
        background: var(--color-bg-secondary);
        cursor: pointer;
        transition: background 0.15s ease;
      }

      .item-row:hover {
        background: var(--color-bg-tertiary);
      }

      .item-row.selected {
        background: rgba(var(--color-primary-rgb), 0.05);
      }

      .item-checkbox {
        width: 18px;
        height: 18px;
        border: 2px solid var(--color-border);
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.15s ease;
      }

      .item-row.selected .item-checkbox {
        border-color: var(--color-primary);
        background: var(--color-primary);
      }

      .check-mark.checked::after {
        content: '';
        width: 4px;
        height: 8px;
        border: solid white;
        border-width: 0 2px 2px 0;
        transform: rotate(45deg);
        margin-bottom: 2px;
      }

      .item-icon {
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 6px;
        flex-shrink: 0;
      }

      .item-icon.folder {
        color: #f59e0b;
        background: rgba(245, 158, 11, 0.1);
      }
      .item-icon.file {
        color: #6366f1;
        background: rgba(99, 102, 241, 0.1);
      }

      .item-icon svg {
        width: 18px;
        height: 18px;
      }

      .item-info {
        display: flex;
        flex-direction: column;
        min-width: 0;
      }

      .item-path,
      .item-name {
        font-size: 0.9375rem;
        font-weight: 500;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .item-details {
        font-size: 0.75rem;
        color: var(--color-text-secondary);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .scan-btn,
      .delete-btn {
        padding: 0.625rem 1.25rem;
        background: var(--color-primary);
        color: white;
        border: none;
        border-radius: 8px;
        font-weight: 600;
        font-size: 0.875rem;
        cursor: pointer;
        transition: all 0.2s;
      }

      .delete-btn {
        background: #ef4444;
      }
      .delete-btn:hover {
        background: #dc2626;
        box-shadow: 0 4px 12px rgba(239, 68, 68, 0.2);
      }
      .delete-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .cancel-btn {
        padding: 0.625rem 1.25rem;
        background: var(--color-bg-tertiary);
        color: var(--color-text-primary);
        border: 1px solid var(--color-border);
        border-radius: 8px;
        font-weight: 600;
        font-size: 0.875rem;
        cursor: pointer;
      }

      .loading-state,
      .empty-results,
      .start-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        flex: 1;
        min-height: 300px;
        gap: 1.5rem;
        color: var(--color-text-secondary);
      }

      .loading-state .spinner {
        width: 40px;
        height: 40px;
        border: 3px solid var(--color-border);
        border-top-color: var(--color-primary);
        border-radius: 50%;
        animation: spin 1s linear infinite;
      }

      .empty-results svg {
        width: 64px;
        height: 64px;
        opacity: 0.3;
      }

      .big-scan-btn {
        padding: 1.25rem 2.5rem;
        background: var(--color-primary);
        color: white;
        border: none;
        border-radius: 12px;
        font-size: 1.125rem;
        font-weight: 700;
        cursor: pointer;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      }

      .big-scan-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 12px 24px rgba(var(--color-primary-rgb), 0.3);
      }

      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }
    `,
  ],
})
export class CleanerDashboardComponent {
  protected readonly cleanerStore = inject(CleanerStore);
  protected readonly store = inject(MediaStore);
  protected readonly lang = inject(LanguageService);
  private readonly router = inject(Router);
  private readonly confirmable = inject(ConfirmDialogService);
  private readonly notifications = inject(NotificationService);
  private readonly electronService = inject(ElectronService);

  readonly selectedPaths = signal<string[]>([]);

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

  isSelected(path: string): boolean {
    return this.selectedPaths().includes(path);
  }

  toggleSelection(path: string): void {
    this.selectedPaths.update((paths) =>
      paths.includes(path) ? paths.filter((p) => p !== path) : [...paths, path],
    );
  }

  isSectionAllSelected(type: 'file' | 'folder'): boolean {
    const items =
      type === 'folder'
        ? this.cleanerStore.emptyFolders()
        : this.cleanerStore.smallFiles();

    if (items.length === 0) return false;
    return items.every((item) => this.isSelected(item.path));
  }

  toggleSectionSelection(type: 'file' | 'folder'): void {
    const items =
      type === 'folder'
        ? this.cleanerStore.emptyFolders()
        : this.cleanerStore.smallFiles();

    const allSelected = this.isSectionAllSelected(type);
    const itemPaths = items.map((i) => i.path);

    if (allSelected) {
      this.selectedPaths.update((paths) =>
        paths.filter((p) => !itemPaths.includes(p)),
      );
    } else {
      this.selectedPaths.update((paths) =>
        Array.from(new Set([...paths, ...itemPaths])),
      );
    }
  }

  async startScan(): Promise<void> {
    const path = this.store.lastScanPath();
    if (path) {
      this.selectedPaths.set([]);
      await this.cleanerStore.scan(path);
    }
  }

  async deleteSelected(): Promise<void> {
    const paths = this.selectedPaths();
    if (paths.length === 0) return;

    const confirmation = await this.confirmable.confirm({
      header: this.lang.translate('confirm.deleteFiles'),
      message: this.lang.translate('confirm.cannotUndo'),
      positive: this.lang.translate('confirm.delete'),
      negative: this.lang.translate('confirm.cancel'),
    });

    if (!confirmation) return;

    await this.cleanerStore.deleteSelected(paths);
    this.selectedPaths.set([]);

    this.notifications.add({
      message: this.lang.translate('notify.deleteSuccess'),
      type: 'success',
    });
  }

  formatSize(bytes?: number): string {
    if (bytes === undefined) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}
