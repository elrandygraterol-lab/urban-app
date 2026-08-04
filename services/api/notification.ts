import api from './client';

let activePushToken: string | null = null;

export const setActivePushToken = (token: string | null) => {
  activePushToken = token;
};

export const getActivePushToken = () => activePushToken;

export const notificationAPI = {
  registerDevice: (data: { token: string; platform: 'android' | 'ios' | 'web' }) =>
    api.post('/api/notifications/register-device', data),

  unregisterDevice: (token: string) =>
    api.delete(`/api/notifications/device/${encodeURIComponent(token)}`),

  getPreferences: () => api.get('/api/notifications/preferences'),

  updatePreferences: (data: {
    rideRequests?: boolean;
    rideUpdates?: boolean;
    payments?: boolean;
    promotions?: boolean;
  }) => api.put('/api/notifications/preferences', data),

  getNotifications: (params?: { page?: number; limit?: number }) =>
    api.get('/api/notifications', { params }),

  markAsRead: (notificationId: string) =>
    api.put(`/api/notifications/${notificationId}/read`),

  getUnreadCount: (): Promise<{ data: { count: number } }> =>
    api.get('/api/notifications/unread-count'),

  markAllRead: (): Promise<{ data: { updated: number } }> =>
    api.post('/api/notifications/mark-read'),
};
