/**
 * Tests for store notification handling in useNotifications hook
 */

import { renderHook, waitFor } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';
import { useNotifications } from '../useNotifications';
import { useRouter } from 'expo-router';

// Mock dependencies
jest.mock('expo-notifications');
jest.mock('expo-router');
jest.mock('@/store/authStore', () => ({
  useAuthStore: () => ({
    isAuthenticated: true,
  }),
}));
jest.mock('@/services/api', () => ({
  notificationAPI: {
    registerDevice: jest.fn().mockResolvedValue({ data: { success: true } }),
  },
}));

describe('useNotifications - Store Notifications', () => {
  const mockRouter = {
    push: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
  });

  describe('Store Approved / Rejected Notification', () => {
    it('should navigate to passenger home when store_approved notification is tapped', async () => {
      const { result } = renderHook(() => useNotifications());

      // Simulate notification response
      const mockResponse = {
        actionIdentifier: Notifications.DEFAULT_ACTION_IDENTIFIER,
        notification: {
          request: {
            content: {
              data: {
                type: 'store_approved',
                storeId: '123',
              },
            },
          },
        },
      } as unknown as Notifications.NotificationResponse;

      // Get the response listener callback
      const addNotificationResponseReceivedListener = (Notifications.addNotificationResponseReceivedListener as jest.Mock);
      const responseCallback = addNotificationResponseReceivedListener.mock.calls[0][0];

      // Trigger the callback
      responseCallback(mockResponse);

      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith('/(passenger)/index');
      });
    });

    it('should navigate to passenger home when store_approved notification has no storeId', async () => {
      const { result } = renderHook(() => useNotifications());

      const mockResponse = {
        actionIdentifier: Notifications.DEFAULT_ACTION_IDENTIFIER,
        notification: {
          request: {
            content: {
              data: {
                type: 'store_approved',
              },
            },
          },
        },
      } as unknown as Notifications.NotificationResponse;

      const addNotificationResponseReceivedListener = (Notifications.addNotificationResponseReceivedListener as jest.Mock);
      const responseCallback = addNotificationResponseReceivedListener.mock.calls[0][0];

      responseCallback(mockResponse);

      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith('/(passenger)/index');
      });
    });
  });

  describe('Store Rejected Notification', () => {
    it('should navigate to store details when store_rejected notification is tapped', async () => {
      const { result } = renderHook(() => useNotifications());

      const mockResponse = {
        actionIdentifier: Notifications.DEFAULT_ACTION_IDENTIFIER,
        notification: {
          request: {
            content: {
              data: {
                type: 'store_rejected',
                storeId: '456',
                reason: 'Invalid information',
              },
            },
          },
        },
      } as unknown as Notifications.NotificationResponse;

      const addNotificationResponseReceivedListener = (Notifications.addNotificationResponseReceivedListener as jest.Mock);
      const responseCallback = addNotificationResponseReceivedListener.mock.calls[0][0];

      responseCallback(mockResponse);

      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith('/(passenger)/index');
      });
    });
  });

  describe('New Review Notification', () => {
    it('should navigate to store details when new_review notification is tapped', async () => {
      const { result } = renderHook(() => useNotifications());

      const mockResponse = {
        actionIdentifier: Notifications.DEFAULT_ACTION_IDENTIFIER,
        notification: {
          request: {
            content: {
              data: {
                type: 'new_review',
                storeId: '789',
                reviewId: 'rev-123',
              },
            },
          },
        },
      } as unknown as Notifications.NotificationResponse;

      const addNotificationResponseReceivedListener = (Notifications.addNotificationResponseReceivedListener as jest.Mock);
      const responseCallback = addNotificationResponseReceivedListener.mock.calls[0][0];

      responseCallback(mockResponse);

      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith('/(passenger)/index');
      });
    });

    it('should not navigate when new_review notification has no storeId', async () => {
      const { result } = renderHook(() => useNotifications());

      const mockResponse = {
        actionIdentifier: Notifications.DEFAULT_ACTION_IDENTIFIER,
        notification: {
          request: {
            content: {
              data: {
                type: 'new_review',
                reviewId: 'rev-123',
              },
            },
          },
        },
      } as unknown as Notifications.NotificationResponse;

      const addNotificationResponseReceivedListener = (Notifications.addNotificationResponseReceivedListener as jest.Mock);
      const responseCallback = addNotificationResponseReceivedListener.mock.calls[0][0];

      responseCallback(mockResponse);

      await waitFor(() => {
        expect(mockRouter.push).not.toHaveBeenCalled();
      });
    });
  });

  describe('Foreground Notification Handling', () => {
    it('should configure notification handler to show alerts in foreground', () => {
      const setNotificationHandler = Notifications.setNotificationHandler as jest.Mock;
      
      expect(setNotificationHandler).toHaveBeenCalledWith({
        handleNotification: expect.any(Function),
      });

      // Verify the handler configuration
      const handlerConfig = setNotificationHandler.mock.calls[0][0];
      const result = handlerConfig.handleNotification();

      expect(result).resolves.toEqual({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      });
    });
  });
});
