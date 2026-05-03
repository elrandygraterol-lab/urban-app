import { useState, useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { useNotificationStore } from '@/store/notificationStore';
import { useNotificationManager } from '@/hooks/useNotificationManager';
import { rideAPI } from '@/services/api';

// Configure how notifications are handled when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export interface NotificationData {
  type?: string;
  rideId?: string;
  driverId?: string;
  passengerId?: string;
  storeId?: string;
  reviewId?: string;
  reason?: string;
  [key: string]: any;
}

/**
 * iOS Push Notifications via APNs — Configuration Requirements
 *
 * For iOS push notifications to work, the following must be in place:
 *
 * 1. `GoogleService-Info.plist` must be present at the project root (`app/GoogleService-Info.plist`).
 *    This file is generated from the Firebase Console for the bundle ID `com.urbantaxi.passenger`
 *    and is referenced in `app.config.js` under `ios.googleServicesFile`.
 *    EAS Build copies it into the native `ios/` directory automatically during the build process.
 *
 * 2. The `app.config.js` must include:
 *    ```js
 *    ios: {
 *      googleServicesFile: './GoogleService-Info.plist',
 *      // ...
 *    }
 *    ```
 *    This is already configured. Do NOT remove it or iOS push notifications via APNs will break.
 *
 * 3. An APNs key or certificate must be configured in the Expo EAS dashboard for the project
 *    (projectId: 18144406-d79f-4baa-8918-1f31ecedd9a5).
 *
 * 4. iOS permissions (`alert`, `badge`, `sound`) are requested during initialization below
 *    via `Notifications.requestPermissionsAsync({ ios: { allowAlert, allowBadge, allowSound } })`.
 *
 * NOTE: Push notifications are NOT supported in Expo Go on iOS (SDK 53+).
 *       A Development Build or Production Build is required.
 */
export const useNotifications = () => {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [notification, setNotification] = useState<Notifications.Notification | null>(null);
  const [error, setError] = useState<string | null>(null);
  const notificationListener = useRef<Notifications.Subscription | undefined>(undefined);
  const responseListener = useRef<Notifications.Subscription | undefined>(undefined);
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const { incrementUnreadCount } = useNotificationStore();
  const { showToast } = useNotificationManager();

  // Check if running in Expo Go
  const isExpoGo = Constants.appOwnership === 'expo';

  useEffect(() => {
    // Skip push notification setup in Expo Go (SDK 53+ doesn't support it)
    if (isExpoGo) {
      console.warn(
        'Push notifications are not supported in Expo Go. Please use a Development Build.'
      );
      setError('Push notifications require a Development Build');
      return;
    }

    // Register for push notifications
    registerForPushNotificationsAsync()
      .then(token => {
        if (token) {
          setExpoPushToken(token);
          // Only register token with backend if user is authenticated
          if (isAuthenticated) {
            registerDeviceToken(token);
          }
        }
      })
      .catch(err => {
        const errorMessage = err.message || 'Unknown error';
        setError(errorMessage);

        // Only log detailed error if it's not a network issue
        if (errorMessage.includes('Network request failed')) {
          console.warn(
            '[NOTIFICATIONS] ⚠️ Could not reach Expo servers. Push notifications will be unavailable until connection is restored.'
          );
        } else {
          console.error('[NOTIFICATIONS] ❌ Error registering for push notifications:', err);
        }
      });

    // Listener for notifications received while app is in foreground
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received in foreground:', notification);
      setNotification(notification);

      // Increment unread count for store notifications
      const data = notification.request.content.data as NotificationData;
      if (
        data.type === 'store_approved' ||
        data.type === 'store_rejected' ||
        data.type === 'new_review'
      ) {
        incrementUnreadCount();
      }
    });

    // Listener for when user taps on notification
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification tapped:', response);
      handleNotificationResponse(response);
    });

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, []);

  // Register device token when user logs in
  useEffect(() => {
    if (isAuthenticated && expoPushToken) {
      registerDeviceToken(expoPushToken);
    }
  }, [isAuthenticated, expoPushToken]);

  const registerForPushNotificationsAsync = async (): Promise<string | null> => {
    let token: string | null = null;

    // Check if running on a physical device (not simulator/emulator)
    const isDevice = Constants.isDevice;
    const isDevBuild = Constants.appOwnership === 'expo' || __DEV__;

    console.log('[NOTIFICATIONS] Device check:', {
      isDevice,
      platform: Platform.OS,
      appOwnership: Constants.appOwnership,
      isDev: __DEV__,
    });

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#22c55e',
      });
      console.log('[NOTIFICATIONS] Android notification channel configured');
    }

    // Allow notifications in dev builds even if isDevice is false
    // This happens when using development builds connected to Metro
    if (isDevice || isDevBuild) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();

      console.log('[NOTIFICATIONS] Current permission status:', existingStatus);

      if (existingStatus !== 'granted') {
        let finalStatus = existingStatus;
        if (Platform.OS === 'ios') {
          const { status } = await Notifications.requestPermissionsAsync({
            ios: {
              allowAlert: true,
              allowBadge: true,
              allowSound: true,
            },
          });
          finalStatus = status;
        } else {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        console.log('[NOTIFICATIONS] Requested permissions, new status:', finalStatus);

        if (finalStatus !== 'granted') {
          console.error('[NOTIFICATIONS] ❌ Permission not granted for push notifications');
          throw new Error('Permission not granted for push notifications');
        }
      }

      // Register RIDE_REQUEST notification category with interactive actions
      await Notifications.setNotificationCategoryAsync('RIDE_REQUEST', [
        {
          identifier: 'ACCEPT_RIDE',
          buttonTitle: 'Aceptar',
          options: { opensAppToForeground: true },
        },
        {
          identifier: 'REJECT_RIDE',
          buttonTitle: 'Rechazar',
          options: { opensAppToForeground: false, isDestructive: true },
        },
      ]);

      // Get the Expo push token with retry logic
      const projectId = Constants.expoConfig?.extra?.eas?.projectId;

      console.log('[NOTIFICATIONS] Getting Expo push token...', { projectId });

      if (!projectId) {
        console.warn('[NOTIFICATIONS] ⚠️ No project ID found. Using development mode.');
      }

      // Note: Firebase configuration files (google-services.json and GoogleService-Info.plist)
      // are present to satisfy expo-notifications native requirements on Android/iOS.
      // We still use Expo Push Notifications service exclusively for sending notifications.
      // See PUSH_NOTIFICATIONS_TROUBLESHOOTING.md for details.

      // Retry logic for Expo API server errors (503, 429, etc.)
      let retries = 3;
      let lastError: Error | null = null;

      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          token = (
            await Notifications.getExpoPushTokenAsync({
              projectId: projectId || undefined,
            })
          ).data;

          console.log(
            '[NOTIFICATIONS] ✅ Expo Push Token obtained:',
            token.substring(0, 30) + '...'
          );
          console.log('[NOTIFICATIONS] ℹ️ Using Expo Push Service for notifications');
          break; // Success, exit retry loop
        } catch (err: any) {
          lastError = err;

          // Check if it's a transient error (503, 429, network issues)
          const isTransient =
            err.message?.includes('503') ||
            err.message?.includes('SERVICE_UNAVAILABLE') ||
            err.message?.includes('429') ||
            err.message?.includes('ECONNREFUSED') ||
            err.message?.includes('ETIMEDOUT');

          // FCM SERVICE_NOT_AVAILABLE = emulator sin Google Play Services, no reintentar
          const isFcmPermanent =
            err.message?.includes('SERVICE_NOT_AVAILABLE') ||
            err.message?.includes('java.io.IOException') ||
            err.message?.includes('ExecutionException');

          if (isFcmPermanent) {
            console.warn(
              '[NOTIFICATIONS] ⚠️ FCM no disponible (emulador sin Google Play Services o dispositivo incompatible). Las notificaciones push no estarán disponibles.'
            );
            return null; // Salir sin lanzar error
          }

          if (isTransient && attempt < retries) {
            const waitTime = attempt * 2000; // 2s, 4s, 6s
            console.warn(
              `[NOTIFICATIONS] ⚠️ Expo API temporarily unavailable (attempt ${attempt}/${retries}). Retrying in ${waitTime / 1000}s...`
            );
            await new Promise(resolve => setTimeout(resolve, waitTime));
          } else if (attempt === retries) {
            console.error(
              '[NOTIFICATIONS] ❌ Failed to get Expo Push Token after',
              retries,
              'attempts'
            );
            throw err;
          } else {
            // Non-transient error, don't retry
            throw err;
          }
        }
      }
    } else {
      console.warn('[NOTIFICATIONS] ⚠️ Must use physical device for Push Notifications');
      console.warn('[NOTIFICATIONS] Current environment:', {
        isDevice,
        isDevBuild,
        appOwnership: Constants.appOwnership,
      });
    }

    return token;
  };

  const registerDeviceToken = async (token: string) => {
    try {
      const platform = Platform.OS as 'android' | 'ios' | 'web';

      console.log('[NOTIFICATIONS] Registering device token with backend...', {
        platform,
        tokenPreview: token.substring(0, 20) + '...',
      });

      const { notificationAPI } = await import('@/services/api');
      const response = await notificationAPI.registerDevice({
        token,
        platform,
      });

      console.log('[NOTIFICATIONS] ✅ Device token registered successfully:', response.data);
    } catch (err: any) {
      console.error('[NOTIFICATIONS] ❌ Error registering device token with backend:', err);
      console.error('[NOTIFICATIONS] Error details:', {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status,
      });
      setError('Failed to register device token');
    }
  };

  const handleNotificationResponse = async (response: Notifications.NotificationResponse) => {
    const data = response.notification.request.content.data as NotificationData;
    const actionIdentifier = response.actionIdentifier;

    console.log('[NOTIFICATIONS] Handling notification tap:', data, 'action:', actionIdentifier);

    // Handle interactive notification actions
    if (actionIdentifier === 'ACCEPT_RIDE') {
      const rideId = data.rideId;
      if (rideId) {
        try {
          await rideAPI.acceptRide(rideId);
        } catch (error) {
          showToast('La solicitud ya no está disponible', 'warning');
        }
      }
      return;
    }

    if (actionIdentifier === 'REJECT_RIDE') {
      const rideId = data.rideId;
      if (rideId) {
        await rideAPI.rejectRide(rideId);
      }
      return;
    }

    // Navigate to appropriate screen based on notification type
    if (data.type) {
      switch (data.type) {
        // Store-related notifications
        case 'store_approved':
        case 'store_rejected':
          // Navigate to store details screen
          if (data.storeId) {
            console.log('[NOTIFICATIONS] Navigating to store details:', data.storeId);
            router.push(`/(tabs)/stores/${data.storeId}` as any);
          } else {
            // Navigate to my stores list if no specific store ID
            router.push('/(tabs)/stores/my-stores' as any);
          }
          break;

        case 'new_review':
          // Navigate to store details screen where reviews are displayed
          if (data.storeId) {
            console.log('[NOTIFICATIONS] Navigating to store details for review:', data.storeId);
            router.push(`/(tabs)/stores/${data.storeId}` as any);
          }
          break;

        case 'payment_completed':
          // Navigate to earnings screen for driver
          console.log('[NOTIFICATIONS] Navigating to earnings screen');
          router.push('/(driver)/earnings' as any);
          break;

        case 'ride_cancelled':
          // Navigate to driver home screen
          console.log('[NOTIFICATIONS] Navigating to driver home screen');
          router.push('/(driver)/index' as any);
          break;

        case 'ride_request_created':
        case 'new_ride_request':
        case 'ride_request':
          // Navigate to driver home screen where ride requests are displayed
          console.log('[NOTIFICATIONS] Navigating to driver home screen for ride request');
          router.push('/(driver)/index' as any);
          break;

        case 'ride_accepted':
          // Navigate to passenger home screen
          console.log('[NOTIFICATIONS] Navigating to passenger home screen');
          router.push('/(passenger)/index' as any);
          break;

        // Legacy notification types - preserve existing behavior
        case 'driver_arrived':
        case 'ride_started':
        case 'ride_completed':
          // Navigate to active ride screen for passenger
          if (data.rideId) {
            router.push(`/(passenger)/ride/${data.rideId}` as any);
          }
          break;

        case 'driver_verified':
        case 'driver_rejected':
          // Navigate to driver profile/verification screen
          router.push('/(driver)/profile' as any);
          break;

        case 'payment_processed':
          // Navigate to earnings screen for driver or receipt for passenger
          if (data.driverEarnings) {
            // Driver notification
            router.push('/(driver)/earnings' as any);
          } else if (data.rideId) {
            // Passenger notification
            router.push(`/(passenger)/receipt/${data.rideId}` as any);
          }
          break;

        default:
          console.log('[NOTIFICATIONS] Unknown notification type:', data.type);
      }
    }
  };

  const sendLocalNotification = async (title: string, body: string, data?: NotificationData) => {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: data || {},
        sound: true,
      },
      trigger: null, // Show immediately
    });
  };

  const clearNotifications = async () => {
    await Notifications.dismissAllNotificationsAsync();
  };

  const getBadgeCount = async (): Promise<number> => {
    return await Notifications.getBadgeCountAsync();
  };

  const setBadgeCount = async (count: number) => {
    await Notifications.setBadgeCountAsync(count);
  };

  return {
    expoPushToken,
    notification,
    error,
    sendLocalNotification,
    clearNotifications,
    getBadgeCount,
    setBadgeCount,
  };
};
