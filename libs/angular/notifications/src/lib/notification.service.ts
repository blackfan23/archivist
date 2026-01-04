import { Injectable, signal } from '@angular/core';
import {
  Notification,
  NotificationConfig,
  NotificationType,
} from './notification.types';

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  private readonly _notifications = signal<Notification[]>([]);

  readonly notifications = this._notifications.asReadonly();

  add({
    message,
    type,
    config,
  }: {
    message: string;
    type?: NotificationType;
    config?: NotificationConfig;
  }): string {
    const id = crypto.randomUUID();
    const duration = config?.duration ?? 5000; // Default 5s

    const notification: Notification = {
      id,
      message,
      type: type ?? 'basic',
      duration,
    };

    this._notifications.update((notes) => [...notes, notification]);

    if (duration > 0) {
      setTimeout(() => {
        this.dismiss(id);
      }, duration);
    }

    return id;
  }

  dismiss(id: string): void {
    // 1. Mark as closing to trigger exit animation
    this._notifications.update((notes) =>
      notes.map((n) => (n.id === id ? { ...n, closing: true } : n)),
    );

    // 2. Wait for animation (300ms matches Tailwind duration) then remove
    setTimeout(() => {
      this.remove(id);
    }, 300);
  }

  remove(id: string): void {
    this._notifications.update((notes) => notes.filter((n) => n.id !== id));
  }
}
