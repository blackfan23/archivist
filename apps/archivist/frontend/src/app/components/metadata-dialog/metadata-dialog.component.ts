import { CommonModule } from '@angular/common';
import { Component, EventEmitter, inject, Input, OnInit, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MediaFile, TmdbMetadata } from '../../core/electron.service';
import { LanguageService } from '../../core/language.service';

@Component({
  selector: 'app-metadata-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="overlay" (click)="close()">
      <div class="dialog" (click)="$event.stopPropagation()">
        <header class="dialog-header">
          <h2>{{ lang.translate('metadata.dialogTitle') }}</h2>
          <button class="close-btn" (click)="close()">×</button>
        </header>

        <div class="dialog-body">
          <div class="form-group type-selector">
            <label>{{ lang.translate('metadata.type') }}</label>
            <div class="radio-group">
              <label [class.active]="type === 'movie'">
                <input type="radio" [(ngModel)]="type" value="movie">
                Movie
              </label>
              <label [class.active]="type === 'tv'">
                <input type="radio" [(ngModel)]="type" value="tv">
                TV Show
              </label>
            </div>
          </div>

          <div class="form-group">
            <label>{{ lang.translate('match.newFilename') }}</label>
            <input type="text" [(ngModel)]="title" [placeholder]="type === 'movie' ? 'Movie Title' : 'Episode Title'">
          </div>

          <div class="form-row">
            <div class="form-group year-group">
              <label>{{ lang.translate('match.year') }}</label>
              <input type="text" [(ngModel)]="year" placeholder="YYYY">
            </div>
          </div>

          @if (type === 'tv') {
            <div class="form-group">
              <label>{{ lang.translate('metadata.show') }}</label>
              <input type="text" [(ngModel)]="show" placeholder="Show Name">
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>{{ lang.translate('match.season') }}</label>
                <input type="number" [(ngModel)]="season" min="0">
              </div>
              <div class="form-group">
                <label>{{ lang.translate('match.episode') }}</label>
                <input type="number" [(ngModel)]="episode" min="0">
              </div>
            </div>
          }

          <div class="form-group">
            <label>{{ lang.translate('metadata.description') }}</label>
            <textarea [(ngModel)]="description" rows="4"></textarea>
          </div>
        </div>

        <footer class="dialog-footer">
          <button class="btn secondary" (click)="close()">
            {{ lang.translate('action.cancel') }}
          </button>
          <button class="btn primary" (click)="save()">
            {{ lang.translate('action.save') }}
          </button>
        </footer>
      </div>
    </div>
  `,
  styles: [`
    .overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      backdrop-filter: blur(4px);
    }

    .dialog {
      background: var(--bg-secondary);
      border-radius: 12px;
      width: 90%;
      max-width: 500px;
      display: flex;
      flex-direction: column;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
      border: 1px solid var(--border-color);
    }

    .dialog-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1rem 1.5rem;
      border-bottom: 1px solid var(--border-color);
    }

    .dialog-header h2 {
      margin: 0;
      font-size: 1.25rem;
      color: var(--text-primary);
    }

    .close-btn {
      background: none;
      border: none;
      color: var(--text-secondary);
      font-size: 1.5rem;
      cursor: pointer;
      padding: 0;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 6px;
    }

    .close-btn:hover {
      background: var(--bg-tertiary);
      color: var(--text-primary);
    }

    .dialog-body {
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .form-group label {
      font-size: 0.875rem;
      color: var(--text-secondary);
      font-weight: 500;
    }

    .form-row {
      display: flex;
      gap: 1rem;
    }
    
    .form-row .form-group {
      flex: 1;
    }
    
    .year-group {
      max-width: 120px;
    }

    input, textarea {
      background: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      padding: 0.75rem;
      color: var(--text-primary);
      font-size: 0.9375rem;
      transition: all 0.2s ease;
    }

    input:focus, textarea:focus {
      outline: none;
      border-color: var(--accent-color);
      box-shadow: 0 0 0 2px rgba(var(--accent-color-rgb), 0.1);
    }

    .dialog-footer {
      padding: 1rem 1.5rem;
      border-top: 1px solid var(--border-color);
      display: flex;
      justify-content: flex-end;
      gap: 1rem;
    }

    .btn {
      padding: 0.5rem 1rem;
      border-radius: 6px;
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      border: none;
      transition: all 0.2s ease;
    }

    .btn.secondary {
      background: var(--bg-tertiary);
      color: var(--text-secondary);
    }

    .btn.secondary:hover {
      background: var(--bg-hover);
      color: var(--text-primary);
    }

    .btn.primary {
      background: var(--accent-color);
      color: white;
    }

    .btn.primary:hover {
      filter: brightness(1.1);
    }
    
    .radio-group {
      display: flex;
      gap: 1rem;
    }
    
    .radio-group label {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      cursor: pointer;
      color: var(--text-secondary);
      padding: 0.5rem 1rem;
      border-radius: 6px;
      background: var(--bg-tertiary);
      border: 1px solid var(--border-color);
    }
    
    .radio-group label.active {
      background: rgba(var(--accent-color-rgb), 0.1);
      border-color: var(--accent-color);
      color: var(--accent-color);
    }
    
    .radio-group input {
      display: none;
    }
  `]
})
export class MetadataDialogComponent implements OnInit {
  protected readonly lang = inject(LanguageService);

  @Input() file!: MediaFile;
  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<TmdbMetadata>();

  type: 'movie' | 'tv' = 'movie';
  title = '';
  year = '';
  show = '';
  season = 1;
  episode = 1;
  description = '';

  ngOnInit(): void {
    // Try to guess metadata from filename
    // Basic regex for common patterns
    const filename = this.file.filename;
    
    // Check for S01E01 pattern -> TV Show
    const s00e00 = /s(\d+)[e\.](\d+)/i.exec(filename);
    if (s00e00) {
      this.type = 'tv';
      this.season = parseInt(s00e00[1], 10);
      this.episode = parseInt(s00e00[2], 10);
      
      // Try to get show name (everything before s00e00)
      const showPart = filename.substring(0, s00e00.index);
      this.show = this.cleanName(showPart);
    } else {
      // Assume movie
      this.type = 'movie';
      this.title = this.cleanName(filename.replace(/\.[^/.]+$/, '')); // Remove extension
    }
    
    // Try to extract year (19xx or 20xx)
    const yearMatch = /(19|20)\d{2}/.exec(filename);
    if (yearMatch) {
      this.year = yearMatch[0];
    }
  }
  
  private cleanName(name: string): string {
    return name
      .replace(/[._-]/g, ' ') // Replace dots, underscores, dashes with spaces
      .replace(/\(.*\)/g, '') // Remove parenthesis content
      .trim();
  }

  close(): void {
    this.closed.emit();
  }

  save(): void {
    const metadata: TmdbMetadata = {
      title: this.title,
      year: this.year,
      description: this.description,
    };

    if (this.type === 'tv') {
      metadata.show = this.show;
      metadata.season = this.season;
      metadata.episode = this.episode;
      metadata.title = this.title || `Episode ${this.episode}`;
    }

    this.saved.emit(metadata);
  }
}
