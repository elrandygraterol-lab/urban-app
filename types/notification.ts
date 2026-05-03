/**
 * Notification Types
 * Defines types for store and ride notifications
 */

export type NotificationType =
  | 'STORE_APPROVED'
  | 'STORE_REJECTED'
  | 'NEW_REVIEW'
  | 'REVIEW_REPLY'
  | 'ride_request'
  | 'ride_accepted'
  | 'driver_arrived'
  | 'ride_started'
  | 'ride_completed'
  | 'ride_cancelled'
  | 'payment_completed';

export interface StoreNotification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data: {
    storeId?: string;
    reviewId?: string;
    reason?: string;
    [key: string]: any;
  };
  readStatus: boolean;
  createdAt: string;
}

export interface NotificationListResponse {
  notifications: StoreNotification[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
