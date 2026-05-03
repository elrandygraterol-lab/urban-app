import { useEffect } from 'react';
import { AppState } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useAuthStore } from '@/store/authStore';
import { notificationAPI } from '@/services/api';
import { logError } from '@/utils/errorLogger';

/**
 * Syncs the app badge count with the server's unread notification count
 * whenever the app comes to the foreground.
 *
 * Requirements: 6.1, 6.2, 6.4
 */
export const useBadgeSync = () => {
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextState) => {
      if (nextState === 'active' && isAuthenticated) {
        try {
          const { data } = await notificationAPI.getUnreadCount();
          await Notifications.setBadgeCountAsync(data.count);
        } catch (error) {
          // Requirement 6.4: maintain current badge, log the error
          logError('BadgeSync', error);
        }
      }
    });

    return () => subscription.remove();
  }, [isAuthenticated]);
};
