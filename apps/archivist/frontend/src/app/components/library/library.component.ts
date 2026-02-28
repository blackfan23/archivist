import { Component, inject, OnDestroy } from '@angular/core';
import { MediaStore } from '../../core/media.store';
import { FilterPanelComponent } from '../filter-panel/filter-panel.component';
import { MediaTableComponent } from '../media-table/media-table.component';
import { SelectionActionsComponent } from '../selection-actions/selection-actions.component';

@Component({
  selector: 'app-library',
  standalone: true,
  imports: [
    FilterPanelComponent,
    MediaTableComponent,
    SelectionActionsComponent,
  ],
  template: `
    <div class="library-layout">
      <aside class="sidebar">
        @if (store.selectedCount() > 0) {
          <app-selection-actions />
        } @else {
          <app-filter-panel />
        }
      </aside>

      <div class="content">
        <app-media-table />
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        height: 100%;
        width: 100%;
      }

      .library-layout {
        display: flex;
        flex: 1;
        height: 100%;
        overflow: hidden;
      }

      .sidebar {
        width: 280px;
        min-width: 280px;
        background: var(--color-bg-secondary);
        border-right: 1px solid var(--color-border);
        overflow-y: auto;
      }

      .content {
        flex: 1;
        overflow: hidden;
        display: flex;
        flex-direction: column;
      }
    `,
  ],
})
export class LibraryComponent implements OnDestroy {
  protected readonly store = inject(MediaStore);

  ngOnDestroy(): void {
    this.store.cancelScan();
  }
}
