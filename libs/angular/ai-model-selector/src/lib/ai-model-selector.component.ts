import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  input,
  model,
  output,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AiModelLabels, AiModelSettings, AiProvider } from './models';

@Component({
  selector: 'lib-ai-model-selector',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="ai-selector-container">
      <div class="setting-row">
        <div class="setting-label">
          <span>{{ labels()?.provider || 'AI Provider' }}</span>
          @if (labels()?.providerDesc) {
            <span class="setting-description">{{
              labels()?.providerDesc
            }}</span>
          }
        </div>
        <select
          id="ai-provider"
          [ngModel]="settings().provider"
          (ngModelChange)="updateProvider($event)"
          class="setting-select"
        >
          <option value="none">{{ labels()?.providerNone || 'None' }}</option>
          <option value="ollama">
            {{ labels()?.providerOllama || 'Ollama (Local)' }}
          </option>
          <option value="openai">
            {{ labels()?.providerOpenai || 'OpenAI' }}
          </option>
          <option value="claude">
            {{ labels()?.providerClaude || 'Claude' }}
          </option>
          <option value="gemini">
            {{ labels()?.providerGemini || 'Gemini' }}
          </option>
        </select>
      </div>

      @switch (settings().provider) {
        @case ('ollama') {
          <div class="setting-row">
            <div class="setting-label">
              <span>{{ labels()?.ollamaUrl || 'Ollama URL' }}</span>
            </div>
            <input
              id="ollama-url"
              type="text"
              [ngModel]="settings().ollamaUrl"
              (ngModelChange)="updateField('ollamaUrl', $event)"
              placeholder="http://localhost:11434"
              class="setting-input"
            />
          </div>
          <div class="setting-row">
            <div class="setting-label">
              <span>{{ labels()?.model || 'Ollama Model' }}</span>
            </div>
            <div class="input-with-action">
              @if (availableModels().length > 0) {
                <select
                  class="setting-select flex-1"
                  [ngModel]="settings().ollamaModel"
                  (ngModelChange)="updateField('ollamaModel', $event)"
                >
                  @for (modelName of availableModels(); track modelName) {
                    <option
                      [value]="modelName"
                      [selected]="settings().ollamaModel === modelName"
                    >
                      {{ modelName }}
                    </option>
                  }
                </select>
              } @else {
                <input
                  id="ollama-model"
                  type="text"
                  [ngModel]="settings().ollamaModel"
                  (ngModelChange)="updateField('ollamaModel', $event)"
                  placeholder="llama3.2"
                  class="setting-input flex-1"
                />
              }
              <button class="action-btn" (click)="onRefreshModels.emit()">
                <i class="ph ph-arrows-clockwise"></i>
                {{ labels()?.refresh || 'Refresh' }}
              </button>
            </div>
          </div>

          <ng-content select="[ollama-extra]"></ng-content>
        }
        @case ('openai') {
          <div class="setting-row">
            <div class="setting-label">
              <span>{{ labels()?.apiKey || 'OpenAI API Key' }}</span>
            </div>
            <input
              id="openai-key"
              type="password"
              [ngModel]="settings().openaiApiKey"
              (ngModelChange)="updateField('openaiApiKey', $event)"
              placeholder="sk-..."
              class="setting-input"
            />
          </div>
          <div class="setting-row">
            <div class="setting-label">
              <span>{{ labels()?.model || 'OpenAI Model' }}</span>
            </div>
            <input
              id="openai-model"
              type="text"
              [ngModel]="settings().openaiModel"
              (ngModelChange)="updateField('openaiModel', $event)"
              placeholder="gpt-4o"
              class="setting-input"
            />
          </div>
        }
        @case ('claude') {
          <div class="setting-row">
            <div class="setting-label">
              <span>{{ labels()?.apiKey || 'Claude API Key' }}</span>
            </div>
            <input
              id="claude-key"
              type="password"
              [ngModel]="settings().claudeApiKey"
              (ngModelChange)="updateField('claudeApiKey', $event)"
              placeholder="sk-ant-..."
              class="setting-input"
            />
          </div>
          <div class="setting-row">
            <div class="setting-label">
              <span>{{ labels()?.model || 'Claude Model' }}</span>
            </div>
            <input
              id="claude-model"
              type="text"
              [ngModel]="settings().claudeModel"
              (ngModelChange)="updateField('claudeModel', $event)"
              placeholder="claude-3-5-sonnet-20241022"
              class="setting-input"
            />
          </div>
        }
        @case ('gemini') {
          <div class="setting-row">
            <div class="setting-label">
              <span>{{ labels()?.apiKey || 'Gemini API Key' }}</span>
            </div>
            <input
              id="gemini-key"
              type="password"
              [ngModel]="settings().geminiApiKey"
              (ngModelChange)="updateField('geminiApiKey', $event)"
              placeholder="AIza..."
              class="setting-input"
            />
          </div>
          <div class="setting-row">
            <div class="setting-label">
              <span>{{ labels()?.model || 'Gemini Model' }}</span>
            </div>
            <input
              id="gemini-model"
              type="text"
              [ngModel]="settings().geminiModel"
              (ngModelChange)="updateField('geminiModel', $event)"
              placeholder="gemini-1.5-flash"
              class="setting-input"
            />
          </div>
        }
      }

      @if (settings().provider !== 'none') {
        <div class="setting-row">
          <div class="setting-label">
            <span>{{ labels()?.connectionStatus || 'Connection Status' }}</span>
          </div>
          <div class="ai-actions">
            <button
              class="test-btn"
              (click)="onTestConnection.emit()"
              [disabled]="testing()"
            >
              @if (testing()) {
                <i class="ph ph-circle-notch ph-spin"></i>
                {{ labels()?.testing || 'Testing...' }}
              } @else {
                <i class="ph ph-plugs-connected"></i>
                {{ labels()?.testConnection || 'Test Connection' }}
              }
            </button>
            <ng-content select="[extra-actions]"></ng-content>

            @if (connectionStatus() === 'valid') {
              <span class="status-text valid">
                <i class="ph ph-check-circle"></i>
                {{ labels()?.connected || 'Connected' }}
              </span>
            } @else if (connectionStatus() === 'invalid') {
              <span class="status-text invalid">
                <i class="ph ph-x-circle"></i>
                {{ labels()?.failed || 'Failed' }}
              </span>
            }
          </div>
        </div>
      }

      @if (connectionError()) {
        <div class="error-box">
          {{ connectionError() }}
        </div>
      }
    </div>
  `,
  styles: [
    `
      .ai-selector-container {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }

      .setting-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.75rem 0;
        border-bottom: 1px solid var(--color-border, rgba(0, 0, 0, 0.08));
      }

      .setting-row:last-child {
        border-bottom: none;
      }

      .setting-label {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        flex: 1;
        margin-right: 1.5rem;
      }

      .setting-label > span:first-child {
        font-weight: 500;
        font-size: 0.875rem;
      }

      .setting-description {
        font-size: 0.75rem;
        color: var(--color-text-secondary, #666);
        line-height: 1.4;
      }

      .setting-select,
      .setting-input {
        padding: 0.5rem 0.75rem;
        border-radius: 6px;
        border: 1px solid var(--color-border, rgba(0, 0, 0, 0.1));
        background: var(--color-bg-tertiary, #f8f9fa);
        color: var(--color-text-primary, #000);
        font-size: 0.875rem;
        min-width: 200px;
      }

      .flex-1 {
        flex: 1;
        min-width: 0;
      }

      .setting-select:focus,
      .setting-input:focus {
        outline: none;
        border-color: var(--color-primary, #007bff);
      }

      .input-with-action {
        display: flex;
        gap: 0.5rem;
        min-width: 220px;
      }

      .action-btn,
      .test-btn {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem 0.875rem;
        border-radius: 6px;
        border: 1px solid var(--color-border, rgba(0, 0, 0, 0.1));
        background: var(--color-bg-tertiary, #f8f9fa);
        color: var(--color-text-primary, #000);
        font-size: 0.8125rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.15s ease;
      }

      .action-btn:hover,
      .test-btn:hover:not(:disabled) {
        background: var(--color-bg-secondary, #e9ecef);
        border-color: var(--color-text-muted, rgba(0, 0, 0, 0.2));
      }

      .test-btn {
        background: var(--color-primary, #007bff);
        color: #fff;
        border: none;
      }

      .test-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      .ai-actions {
        display: flex;
        align-items: center;
        gap: 1rem;
      }

      .status-text {
        display: inline-flex;
        align-items: center;
        gap: 0.375rem;
        font-size: 0.8125rem;
        font-weight: 500;
      }

      .status-text.valid {
        color: var(--color-success, #10b981);
      }

      .status-text.invalid {
        color: var(--color-error, #ef4444);
      }

      .error-box {
        margin-top: 0.5rem;
        padding: 0.75rem;
        border-radius: 6px;
        background: rgba(239, 68, 68, 0.1);
        color: var(--color-error, #ef4444);
        font-size: 0.75rem;
        border: 1px solid rgba(239, 68, 68, 0.2);
        line-height: 1.4;
      }

      i {
        font-size: 1rem;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiModelSelectorComponent {
  settings = model.required<AiModelSettings>();
  labels = input<AiModelLabels>();
  availableModels = input<string[]>([]);
  testing = input<boolean>(false);
  connectionStatus = input<'idle' | 'validating' | 'valid' | 'invalid'>('idle');
  connectionError = input<string | null>(null);

  onRefreshModels = output<void>();
  onTestConnection = output<void>();

  updateProvider(provider: AiProvider): void {
    this.settings.update((s) => ({ ...s, provider }));
  }

  updateField(field: keyof AiModelSettings, value: string): void {
    this.settings.update((s) => ({ ...s, [field]: value }));
  }
}
