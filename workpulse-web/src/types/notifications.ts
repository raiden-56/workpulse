export type NotificationSeverity = 'LOW' | 'MEDIUM' | 'HIGH';

export interface NotificationResponse {
  id: string;
  type: string;
  severity: NotificationSeverity | string;
  title: string;
  body?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  read: boolean;
  readAt?: string | null;
  resolutionStatus: string;
  createdAt: string;
}

export interface UnreadCount {
  unread: number;
}
