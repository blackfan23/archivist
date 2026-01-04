import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NotificationService } from '../notification.service';
import { ToastComponent } from '../toast/toast.component';

@Component({
  selector: 'lib-toast-container',
  standalone: true,
  imports: [ToastComponent],
  template: `
    <!-- Global container for position -->
    <!-- Desktop: top-right. Mobile: bottom-center (or full width bottom) -->
    <div
      aria-live="assertive"
      class="fixed inset-0 flex items-end px-4 py-6 pointer-events-none sm:p-6 sm:items-start z-[9999]"
    >
      <div class="w-full flex flex-col items-center space-y-4 sm:items-end">
        <!-- Notification list -->
        @for (notification of notifications(); track notification.id) {
          <lib-toast
            [notification]="notification"
            (dismiss)="dismiss($event)"
            class="w-full max-w-sm"
          ></lib-toast>
        }
      </div>
    </div>
  `,

  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToastContainerComponent {
  private notificationService = inject(NotificationService);
  notifications = this.notificationService.notifications;

  dismiss(id: string) {
    this.notificationService.dismiss(id);
  }
}
