import api from './client';

export const notificationAPI = {
  registerDevice: (data: { token: string; platform: 'android' | 'ios' | 'web' }) =>
    api.post('/api/notifications/register-device', data),

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
