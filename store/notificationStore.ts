/**
 * Global Notification Store
 * Manages in-app notifications that appear across all screens
 */

import { create } from 'zustand';

export type NotificationType =
  | 'ride_request'
  | 'ride_cancelled'
  | 'payment_completed'
  | 'ride_accepted'
  | 'driver_arrived'
  | 'ride_started'
  | 'ride_completed'
  | 'info'
  | 'success'
  | 'warning'
  | 'error';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: any;
  timestamp: Date;
  read: boolean;
  actionLabel?: string;
  onAction?: () => void;
}

interface NotificationStore {
  notifications: Notification[];
  currentNotification: Notification | null;

  // Actions
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  showNotification: (notification: Notification) => void;
  dismissCurrentNotification: () => void;
  markAsRead: (id: string) => void;
  clearNotification: (id: string) => void;
  clearAllNotifications: () => void;
}

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  notifications: [],
  currentNotification: null,

  addNotification: notification => {
    const newNotification: Notification = {
      ...notification,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      read: false,
    };

    set(state => ({
      notifications: [newNotification, ...state.notifications],
      currentNotification: newNotification, // Show immediately
    }));

    // Auto-dismiss after 5 seconds if no action
    setTimeout(() => {
      const current = get().currentNotification;
      if (current?.id === newNotification.id) {
        get().dismissCurrentNotification();
      }
    }, 5000);
  },

  showNotification: notification => {
    set({ currentNotification: notification });
  },

  dismissCurrentNotification: () => {
    set({ currentNotification: null });
  },

  markAsRead: id => {
    set(state => ({
      notifications: state.notifications.map(n => (n.id === id ? { ...n, read: true } : n)),
    }));
  },

  clearNotification: id => {
    set(state => ({
      notifications: state.notifications.filter(n => n.id !== id),
      currentNotification: state.currentNotification?.id === id ? null : state.currentNotification,
    }));
  },

  clearAllNotifications: () => {
    set({ notifications: [], currentNotification: null });
  },
}));
