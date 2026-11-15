import { apiClient } from './client';

export interface AppNotification {
  _id: string;
  notificationReference: string;
  userId: string;
  senderId?: string | null;
  bookingId?: string | null;
  paymentId?: string | null;
  templateId?: string | null;
  notificationType: string;
  eventType: string;
  title: string;
  message: string;
  priority: 'Low' | 'Normal' | 'High' | 'Critical';
  deliveryChannel: 'In-App' | 'Email' | 'Push Notification';
  deliveryStatus: string;
  deliveredAt: string;
  isRead: boolean;
  readAt?: string | null;
  actionUrl?: string | null;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationsResponse {
  notifications: AppNotification[];
  total: number;
  unreadCount: number;
  page: number;
  totalPages: number;
}

export async function fetchNotifications(params: {
  isRead?: boolean | undefined;
  type?: string | undefined;
  page?: number | undefined;
  limit?: number | undefined;
} = {}): Promise<NotificationsResponse> {
  const query = new URLSearchParams();
  if (params.isRead !== undefined) query.set('isRead', String(params.isRead));
  if (params.type && params.type !== 'All') query.set('type', params.type);
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));

  const res = await apiClient.get<{ success: boolean; data: NotificationsResponse }>(
    `/notifications?${query.toString()}`,
  );
  return res.data.data;
}

export async function fetchUnreadCount(): Promise<number> {
  const res = await apiClient.get<{ success: boolean; data: { unreadCount: number } }>(
    '/notifications/unread-count',
  );
  return res.data.data.unreadCount;
}

export async function markNotificationAsRead(id: string): Promise<AppNotification> {
  const res = await apiClient.patch<{ success: boolean; data: AppNotification }>(
    `/notifications/${id}/read`,
  );
  return res.data.data;
}

export async function markAllNotificationsAsRead(): Promise<{ modifiedCount: number }> {
  const res = await apiClient.patch<{ success: boolean; data: { modifiedCount: number } }>(
    '/notifications/mark-all-read',
  );
  return res.data.data;
}

export async function deleteNotification(id: string): Promise<void> {
  await apiClient.delete(`/notifications/${id}`);
}

export async function clearAllNotifications(): Promise<{ deletedCount: number }> {
  const res = await apiClient.delete<{ success: boolean; data: { deletedCount: number } }>(
    '/notifications/clear-all',
  );
  return res.data.data;
}

