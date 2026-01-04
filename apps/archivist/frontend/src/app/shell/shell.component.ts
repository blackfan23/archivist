import { Component, inject, OnInit, signal } from '@angular/core';
import { ErrorLogComponent } from '../components/error-log/error-log.component';
import { FilterPanelComponent } from '../components/filter-panel/filter-panel.component';
import { MatchQueuePanelComponent } from '../components/match-queue-panel/match-queue-panel.component';
import { MediaTableComponent } from '../components/media-table/media-table.component';
import { ScanControlsComponent } from '../components/scan-controls/scan-controls.component';
import { SelectionActionsComponent } from '../components/selection-actions/selection-actions.component';
import { SettingsComponent } from '../components/settings/settings.component';
import { ErrorStore } from '../core/error.store';
import { LanguageService } from '../core/language.service';
import { MatchQueueStore } from '../core/match-queue.store';
import { MediaStore } from '../core/media.store';
import { SettingsService } from '../core/settings.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [ScanControlsComponent, FilterPanelComponent, MediaTableComponent, SettingsComponent, ErrorLogComponent, MatchQueuePanelComponent, SelectionActionsComponent],
  template: `
    <div class="shell">
      <header class="header">
        <div class="header-brand">
          <svg class="logo" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
          </svg>
          <h1>{{ lang.translate('app.title') }}</h1>
        </div>
        <div class="header-actions">
          <app-scan-controls />
          <button class="queue-btn" (click)="toggleQueuePanel()" [title]="lang.translate('queue.title')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
            </svg>
            @if (queueStore.queueCount() > 0) {
              <span class="queue-badge">{{ queueStore.queueCount() }}</span>
            }
          </button>
          <button class="error-btn" (click)="toggleErrorLog()" [title]="lang.translate('errorLog.title')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            @if (errorStore.errorCount() > 0) {
              <span class="error-badge">{{ errorStore.errorCount() }}</span>
            }
          </button>
          <button class="settings-btn" (click)="toggleSettings()" [title]="lang.translate('app.settings')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
          </button>
        </div>
      </header>
      
      <div class="main-layout">
        <aside class="sidebar">
          @if (store.selectedCount() > 0) {
            <app-selection-actions />
          } @else {
            <app-filter-panel />
          }
        </aside>
        
        <main class="content">
          <app-media-table />
        </main>
      </div>
      
      @if (showSettings()) {
        <app-settings (close)="showSettings.set(false)" />
      }
      
      <app-error-log />
      <app-match-queue-panel />
    </div>
  `,
  styles: [`
    .shell {
      display: flex;
      flex-direction: column;
      height: 100vh;
      background: var(--bg-primary);
      color: var(--text-primary);
    }
    
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.75rem 1.5rem;
      background: var(--bg-secondary);
      border-bottom: 1px solid var(--border-color);
      gap: 1rem;
    }
    
    .header-brand {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    
    .logo {
      width: 28px;
      height: 28px;
      color: var(--accent-color);
    }
    
    h1 {
      font-size: 1.25rem;
      font-weight: 600;
      margin: 0;
    }
    
    .header-actions {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    
    .settings-btn {
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: transparent;
      border: 1px solid var(--border-color);
      border-radius: 6px;
      color: var(--text-secondary);
      cursor: pointer;
      transition: all 0.15s ease;
    }
    
    .settings-btn:hover {
      background: var(--bg-hover);
      color: var(--text-primary);
      border-color: var(--text-tertiary);
    }
    
    .settings-btn svg {
      width: 18px;
      height: 18px;
    }
    
    .error-btn {
      position: relative;
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: transparent;
      border: 1px solid var(--border-color);
      border-radius: 6px;
      color: var(--text-secondary);
      cursor: pointer;
      transition: all 0.15s ease;
    }
    
    .error-btn:hover {
      background: var(--bg-hover);
      color: var(--text-primary);
      border-color: var(--text-tertiary);
    }
    
    .error-btn svg {
      width: 18px;
      height: 18px;
    }
    
    .error-badge {
      position: absolute;
      top: -4px;
      right: -4px;
      min-width: 18px;
      height: 18px;
      padding: 0 4px;
      background: #ef4444;
      border-radius: 9px;
      font-size: 0.7rem;
      font-weight: 600;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .queue-btn {
      position: relative;
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: transparent;
      border: 1px solid var(--border-color);
      border-radius: 6px;
      color: var(--text-secondary);
      cursor: pointer;
      transition: all 0.15s ease;
    }
    
    .queue-btn:hover {
      background: var(--bg-hover);
      color: var(--text-primary);
      border-color: var(--text-tertiary);
    }
    
    .queue-btn svg {
      width: 18px;
      height: 18px;
    }
    
    .queue-badge {
      position: absolute;
      top: -4px;
      right: -4px;
      min-width: 18px;
      height: 18px;
      padding: 0 4px;
      background: var(--accent-color);
      border-radius: 9px;
      font-size: 0.7rem;
      font-weight: 600;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .main-layout {
      display: flex;
      flex: 1;
      overflow: hidden;
    }
    
    .sidebar {
      width: 280px;
      min-width: 280px;
      background: var(--bg-secondary);
      border-right: 1px solid var(--border-color);
      overflow-y: auto;
    }
    
    .content {
      flex: 1;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
  `],
})
export class ShellComponent implements OnInit {
  protected readonly store = inject(MediaStore);
  private readonly settingsService = inject(SettingsService);
  protected readonly errorStore = inject(ErrorStore);
  protected readonly queueStore = inject(MatchQueueStore);
  protected readonly lang = inject(LanguageService);
  
  readonly showSettings = signal(false);
  
  ngOnInit(): void {
    // Load data and settings from storage on init
    this.store.loadFromStorage();
    this.settingsService.loadSettings();
  }
  
  toggleSettings(): void {
    this.showSettings.update((v) => !v);
  }
  
  toggleErrorLog(): void {
    if (this.errorStore.showErrorLog()) {
      this.errorStore.closeErrorLog();
    } else {
      this.errorStore.openErrorLog();
    }
  }
  
  toggleQueuePanel(): void {
    if (this.queueStore.showPanel()) {
      this.queueStore.closePanel();
    } else {
      this.queueStore.openPanel();
    }
  }
}
