export type NotificationType = 'basic' | 'success' | 'danger' | 'error' | 'warning';

export interface NotificationConfig {
  duration?: number; // 0 for unlimited
}

export interface Notification {
  id: string;
  message: string;
  type: NotificationType;
  duration: number;
  closing?: boolean;
}
