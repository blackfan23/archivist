import { Component, inject, OnInit, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  NavigationEnd,
  Router,
  RouterLink,
  RouterOutlet,
} from '@angular/router';
import { filter, map } from 'rxjs';
import { ApiKeyModalComponent } from '../components/api-key-modal/api-key-modal.component';
import { ErrorLogComponent } from '../components/error-log/error-log.component';
import { MatchQueuePanelComponent } from '../components/match-queue-panel/match-queue-panel.component';
import { SettingsComponent } from '../components/settings/settings.component';
import { ErrorStore } from '../core/error.store';
import { LanguageService } from '../core/language.service';
import { MatchQueueStore } from '../core/match-queue.store';
import { MediaStore } from '../core/media.store';
import { SettingsService } from '../core/settings.service';
@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    SettingsComponent,
    ErrorLogComponent,
    MatchQueuePanelComponent,
    ApiKeyModalComponent,
    RouterOutlet,
    RouterLink,
  ],
  template: `
    <div class="shell">
      <header class="header">
        <div class="header-left">
          @if (currentUrl() !== '/') {
            <button
              class="back-btn"
              routerLink="/"
              [title]="lang.translate('app.backToStart')"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
              >
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </button>
          }

          <div class="header-brand" routerLink="/" style="cursor: pointer">
            <svg class="logo" viewBox="0 0 24 24" fill="currentColor">
              <path
                d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
              />
            </svg>
            <h1>{{ lang.translate('app.title') }}</h1>
          </div>
        </div>

        <div class="header-actions">
          <button
            class="queue-btn"
            (click)="toggleQueuePanel()"
            [title]="lang.translate('queue.title')"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
            @if (queueStore.queueCount() > 0) {
              <span class="queue-badge">{{ queueStore.queueCount() }}</span>
            }
          </button>
          <button
            class="error-btn"
            (click)="toggleErrorLog()"
            [title]="lang.translate('errorLog.title')"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            @if (errorStore.errorCount() > 0) {
              <span class="error-badge">{{ errorStore.errorCount() }}</span>
            }
          </button>
          <button
            class="settings-btn"
            (click)="toggleSettings()"
            [title]="lang.translate('app.settings')"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path
                d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"
              />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>

          <div
            class="engine-status"
            [class.active]="
              queueStore.isEngineActive() && queueStore.isProcessing()
            "
            [class.paused]="!queueStore.isEngineActive()"
            [title]="
              queueStore.isEngineActive()
                ? lang.translate('queue.running')
                : lang.translate('queue.paused')
            "
          >
            @if (queueStore.isEngineActive()) {
              <div class="status-dot"></div>
            } @else {
              <svg viewBox="0 0 24 24" fill="currentColor" class="pause-icon">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
              </svg>
            }
          </div>
        </div>
      </header>

      <div class="main-layout">
        <router-outlet />
      </div>

      @if (showSettings()) {
        <app-settings (close)="showSettings.set(false)" />
      }

      <app-error-log />
      <app-match-queue-panel />

      @if (showApiKeyModal()) {
        <app-api-key-modal (close)="showApiKeyModal.set(false)" />
      }
    </div>
  `,
  styles: [
    `
      .shell {
        display: flex;
        flex-direction: column;
        height: 100vh;
        background: var(--color-bg-primary);
        color: var(--color-text-primary);
      }

      .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.75rem 1.5rem;
        background: var(--color-bg-secondary);
        border-bottom: 1px solid var(--color-border);
        gap: 1rem;
      }

      .header-left {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }

      .back-btn {
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: transparent;
        border: none;
        border-radius: 6px;
        color: var(--color-text-secondary);
        cursor: pointer;
        transition: all 0.2s;
        padding: 0;
      }

      .back-btn:hover {
        background: var(--color-bg-tertiary);
        color: var(--color-primary);
      }

      .back-btn svg {
        width: 20px;
        height: 20px;
      }

      .header-brand {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.25rem 0.5rem;
        border-radius: 6px;
        transition: background 0.2s;
      }

      .header-brand:hover {
        background: var(--color-bg-tertiary);
      }

      .header-nav a {
        color: var(--color-text-secondary);
        text-decoration: none;
        font-weight: 500;
        padding: 0.5rem 1rem;
        border-radius: 6px;
        transition: all 0.2s;
      }

      .header-nav a:hover {
        background: var(--color-bg-tertiary);
        color: var(--color-text-primary);
      }

      .header-nav a.active {
        background: var(--color-bg-tertiary);
        color: var(--color-primary);
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
        border: 1px solid var(--color-border);
        border-radius: 6px;
        color: var(--color-text-secondary);
        cursor: pointer;
        transition: all 0.15s ease;
      }

      .settings-btn:hover {
        background: var(--color-bg-tertiary);
        color: var(--color-text-primary);
        border-color: var(--color-text-muted);
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
        border: 1px solid var(--color-border);
        border-radius: 6px;
        color: var(--color-text-secondary);
        cursor: pointer;
        transition: all 0.15s ease;
      }

      .error-btn:hover {
        background: var(--color-bg-tertiary);
        color: var(--color-text-primary);
        border-color: var(--color-text-muted);
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
        border: 1px solid var(--color-border);
        border-radius: 6px;
        color: var(--color-text-secondary);
        cursor: pointer;
        transition: all 0.15s ease;
      }

      .queue-btn:hover {
        background: var(--color-bg-tertiary);
        color: var(--color-text-primary);
        border-color: var(--color-text-muted);
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
        background: var(--color-primary);
        border-radius: 9px;
        font-size: 0.7rem;
        font-weight: 600;
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .engine-status {
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-left: 0.25rem;
        cursor: default;
      }

      .status-dot {
        width: 8px;
        height: 8px;
        background: #10b981;
        border-radius: 50%;
        box-shadow: 0 0 0 rgba(16, 185, 129, 0.4);
      }

      .engine-status.active .status-dot {
        animation: pulse 2s infinite;
      }

      .pause-icon {
        width: 14px;
        height: 14px;
        color: #f59e0b;
        opacity: 0.8;
      }

      @keyframes pulse {
        0% {
          transform: scale(0.95);
          box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
        }
        70% {
          transform: scale(1);
          box-shadow: 0 0 0 10px rgba(16, 185, 129, 0);
        }
        100% {
          transform: scale(0.95);
          box-shadow: 0 0 0 0 rgba(16, 185, 129, 0);
        }
      }

      .main-layout {
        display: flex;
        flex: 1;
        overflow: hidden;
      }
    `,
  ],
})
export class ShellComponent implements OnInit {
  protected readonly store = inject(MediaStore);
  private readonly settingsService = inject(SettingsService);
  protected readonly errorStore = inject(ErrorStore);
  protected readonly queueStore = inject(MatchQueueStore);
  protected readonly lang = inject(LanguageService);
  private readonly router = inject(Router);

  readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map((e) => (e as NavigationEnd).urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  readonly showSettings = signal(false);
  readonly showApiKeyModal = signal(false);

  ngOnInit(): void {
    // Load data and settings from storage on init
    this.store.loadFromStorage();
    this.settingsService.loadSettings().then(() => {
      this.checkApiKeys();
    });
  }

  private checkApiKeys(): void {
    const tmdbKey = this.settingsService.$tmdbApiKey();

    if (!tmdbKey) {
      this.showApiKeyModal.set(true);
    }
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
