import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NotificationService } from '../notification.service';
import { ToastComponent } from '../toast/toast.component';

@Component({
  selector: 'lib-toast-container',
  standalone: true,
  imports: [ToastComponent],
  templateUrl: './toast-container.component.html',
  styleUrl: './toast-container.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToastContainerComponent {
  private notificationService = inject(NotificationService);
  notifications = this.notificationService.notifications;

  dismiss(id: string) {
    this.notificationService.dismiss(id);
  }
}
