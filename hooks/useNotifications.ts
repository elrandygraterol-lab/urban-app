import { useState, useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { AppState, Platform } from 'react-native';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { useNotificationStore } from '@/store/notificationStore';
import { useUnifiedNotifications } from '@/context/UnifiedNotificationContext';
import { rideAPI } from '@/services/api';
import { setActivePushToken } from '@/services/api/notification';

// Ride events that are also delivered over the socket when the app is in the
// foreground. The socket path already shows the in-app UI (modal/banner), so the
// system alert is suppressed in that case to avoid duplicates.
const RIDE_CRITICAL_TYPES = [
  'ride_request',
  'ride_request_created',
  'ride_accepted',
  'driver_arrived',
  'ride_started',
  'ride_completed',
  'ride_cancelled',
  'payment_completed',
  'commission_credited',
];

// commission_credited has NO socket event — the push listener is its only channel,
// so it must always surface the in-app banner. The rest are socket-delivered.
const SOCKET_DELIVERED_TYPES = [
  'ride_accepted',
  'driver_arrived',
  'ride_started',
  'ride_completed',
  'ride_cancelled',
  'payment_completed',
];

// Lazily-loaded socket connection check. Dynamic import avoids pulling in
// expo-secure-store/socket.io-client at module load, which would break the
// jest environment. Metro caches the module after the first load.
const isSocketConnectedSafe = async (): Promise<boolean> => {
  try {
    const { isSocketConnected } = await import('@/services/socket');
    return isSocketConnected();
  } catch {
    return false;
  }
};

// Configure how notifications are handled when app is in foreground.
// Ride-critical events are ALWAYS pushed by the backend (even when the socket
// is "connected", because a minimized app keeps the socket alive for up to
// ~85s). When the app is in the foreground AND the socket is live, the event
// was already delivered in-app — suppress the system alert/sound. In
// background/killed (or foreground with a dead socket) the system alert shows.
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = notification?.request?.content?.data;
    const type = data?.type;
    const isRideCritical = typeof type === 'string' && RIDE_CRITICAL_TYPES.includes(type);
    const isForeground = AppState?.currentState === 'active';
    let suppress = false;
    if (isRideCritical && isForeground) {
      suppress = await isSocketConnectedSafe();
    }
    return {
      shouldShowAlert: !suppress,
      shouldPlaySound: !suppress,
      shouldSetBadge: !suppress,
      shouldShowBanner: !suppress,
      shouldShowList: !suppress,
    };
  },
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
  const pushTokenListener = useRef<Notifications.Subscription | undefined>(undefined);
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const { incrementUnreadCount } = useNotificationStore();
  const { showStatus } = useUnifiedNotifications();

  // True Expo Go: appOwnership === 'expo' AND executionEnvironment === 'storeClient'
  // EAS dev builds also have appOwnership === 'expo' but executionEnvironment === 'bare'
  const isExpoGo = Constants.appOwnership === 'expo' && Constants.executionEnvironment === 'storeClient';

  useEffect(() => {
    // Skip push notification setup ONLY in true Expo Go.
    // EAS Build apps (development, preview, production) always support push.
    //
    // Detection strategy:
    //   - Expo Go sets appOwnership = 'expo' AND executionEnvironment = 'storeClient'
    //   - EAS dev builds set appOwnership = 'expo' BUT executionEnvironment = 'bare' (or undefined)
    //   - Production/standalone builds set appOwnership = 'standalone'
    //
    // So the only safe Expo Go gate is: appOwnership === 'expo' AND
    // executionEnvironment === 'storeClient'
    const isRunningInExpoGo =
      Constants.appOwnership === 'expo' &&
      Constants.executionEnvironment === 'storeClient';

    if (isRunningInExpoGo) {
      console.warn(
        '[NOTIFICATIONS] Push notifications are not supported in Expo Go. Please use EAS Build.'
      );
      setError('Push notifications require an EAS Build');
      return;
    }
    
    console.log('[NOTIFICATIONS] ✅ Valid environment for push notifications', {
      appOwnership: Constants.appOwnership,
      executionEnvironment: Constants.executionEnvironment,
      isDevice: Device.isDevice,
      platform: Platform.OS,
    });

    // Register for push notifications
    registerForPushNotificationsAsync()
      .then(token => {
        if (token) {
          setExpoPushToken(token);
          setActivePushToken(token);
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
    notificationListener.current = Notifications.addNotificationReceivedListener(async notification => {
      console.log('[NOTIFICATIONS] 📩 Received in foreground:', notification.request.content.title);
      setNotification(notification);

      const data = notification.request.content.data as NotificationData;
      const title = notification.request.content.title ?? '';
      const body = notification.request.content.body ?? '';

      // Increment unread count for store notifications
      if (
        data.type === 'store_approved' ||
        data.type === 'store_rejected' ||
        data.type === 'new_review' ||
        data.type === 'review_reply'
      ) {
        incrementUnreadCount();
      }

      // Show in-app status banner using unified notification system
      // This prevents duplicate native alerts since the OS already shows the banner
      if (data.type) {
        const mappedType = data.type as Parameters<typeof showStatus>[0];
        // Only show status banner for important events (not for every push)
        const importantTypes = [
          'ride_accepted', 'driver_arrived', 'ride_started', 'ride_completed',
          'ride_cancelled', 'payment_completed', 'commission_credited',
          'store_approved', 'store_rejected',
        ];
        if (importantTypes.includes(data.type)) {
          // commission_credited has no socket event (push is its only channel),
          // so always surface it here. The other ride types are ALSO delivered
          // via socket — when the socket is live the socket handler already
          // shows the banner, so skip to avoid a duplicate in-app banner.
          if (
            data.type === 'commission_credited' ||
            !SOCKET_DELIVERED_TYPES.includes(data.type) ||
            !(await isSocketConnectedSafe())
          ) {
            showStatus(mappedType, body, title, data as Record<string, unknown>);
          }
        }
      }
    });

    // Listener for when user taps on notification
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification tapped:', response);
      handleNotificationResponse(response);
    });

    // Listen for push token refresh. Android/FCM and iOS/APNs rotate tokens
    // (Play Services update, expiry, restore, reinstall) — without re-registering
    // the new token, pushes silently stop until the next cold start. Updating
    // expoPushToken here re-triggers the registration effect below.
    pushTokenListener.current = Notifications.addPushTokenListener(pushToken => {
      let newToken: string | null = null;
      if (typeof pushToken.data === 'string') {
        newToken = pushToken.data;
      } else if (pushToken.data && typeof (pushToken.data as any).data === 'string') {
        newToken = (pushToken.data as any).data;
      }
      if (!newToken) return;
      console.log('[NOTIFICATIONS] 🔄 Push token refreshed:', newToken.substring(0, 30) + '...');
      setExpoPushToken(newToken);
      setActivePushToken(newToken);
    });

    // Handle notification tap when the app was killed (cold start).
    // The response listener above only fires for background → foreground;
    // if the process was dead, the tap is delivered via this pending response.
    Notifications.getLastNotificationResponseAsync()
      .then(response => {
        if (response) {
          console.log(
            '[NOTIFICATIONS] 📲 Cold-start notification tap:',
            response.notification.request.content.data
          );
          handleNotificationResponse(response);
        }
      })
      .catch(err => {
        console.warn('[NOTIFICATIONS] ⚠️ Error reading last notification response:', err);
      });

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
      if (pushTokenListener.current) {
        pushTokenListener.current.remove();
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
    const isDevice = Device.isDevice;
    const isDevBuild = Constants.appOwnership === 'expo' || __DEV__;

    console.log('[NOTIFICATIONS] Device check:', {
      isDevice,
      platform: Platform.OS,
      appOwnership: Constants.appOwnership,
      isDev: __DEV__,
    });

    if (Platform.OS === 'android') {
      // Default channel for general notifications
      await Notifications.setNotificationChannelAsync('default', {
        name: 'UrbanTaxi SJ',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#2FB908',
      });
      // High-priority channel for ride requests — overrides Do Not Disturb on Android
      await Notifications.setNotificationChannelAsync('ride_requests', {
        name: 'Solicitudes de Viaje',
        description: 'Notificaciones de nuevas solicitudes de viaje',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250, 0, 250],
        lightColor: '#2FB908',
        showBadge: true,
        bypassDnd: true,
      });
      // Channel for ride status updates (accepted, arrived, cancelled, etc.)
      await Notifications.setNotificationChannelAsync('ride_status', {
        name: 'Estado del Viaje',
        description: 'Actualizaciones del estado de tu viaje',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250],
        lightColor: '#2FB908',
        showBadge: true,
      });
      // Channel for payment notifications
      await Notifications.setNotificationChannelAsync('payments', {
        name: 'Pagos',
        description: 'Notificaciones de pagos y ganancias',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250],
        lightColor: '#F89C0A',
        showBadge: true,
      });
      console.log('[NOTIFICATIONS] Android notification channels configured (default, ride_requests, ride_status, payments)');
    }

    // Allow notifications in dev builds even if isDevice is false
    // This happens when using development builds connected to Metro
    if (isDevice || isDevBuild) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();

      console.log('[NOTIFICATIONS] Current permission status:', existingStatus);

      if (existingStatus !== 'granted') {
        let finalStatus: string = existingStatus;
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
          const result = await Notifications.requestPermissionsAsync();
          finalStatus = result.status;
        }
        console.log('[NOTIFICATIONS] Requested permissions, new status:', finalStatus);

        if (finalStatus !== 'granted') {
          console.error('[NOTIFICATIONS] ❌ Permission not granted for push notifications');
          throw new Error('Permission not granted for push notifications');
        }
      }

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

      // Retry logic for Expo API server errors (503, 429, etc.).
      // FIS_AUTH_ERROR (Xiaomi/MIUI) is also retried with up to 5 attempts
      // because Google Play Services often needs time to initialize.
      let retries = 5;
      let lastError: Error | null = null;
      let lastWasFisAuth = false;

      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          const isAndroid = Platform.OS === 'android';

          // Dev builds: use Expo Push Token for ALL platforms.
          // Direct FCM on Android requires the app's SHA-1 to be registered
          // in Firebase Console, which is tedious for debug keystores.
          // Expo Push Service works immediately without any Firebase setup.
          //
          // Production builds: Android uses direct FCM (firebaseService),
          // iOS uses Expo Push Service (APNs).
          const useExpoToken = __DEV__;

          const deviceToken = useExpoToken
            ? await Notifications.getExpoPushTokenAsync({
                projectId: projectId || undefined,
              })
            : isAndroid
              ? await Notifications.getDevicePushTokenAsync()
              : await Notifications.getExpoPushTokenAsync({
                  projectId: projectId || undefined,
                });

          token = deviceToken.data as string;

          console.log(
            '[NOTIFICATIONS] ✅ Push Token obtained:',
            token.substring(0, 30) + '...'
          );
          console.log(
            `[NOTIFICATIONS] ℹ️ ${useExpoToken ? 'Using Expo Push Service (dev build)' : isAndroid ? 'Using direct FCM delivery (firebaseService)' : 'Using Expo Push Service (iOS)'}`
          );
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

          // FIS_AUTH_ERROR is common on Xiaomi/MIUI devices where Google Play
          // Services is battery-optimized. It's transient — retrying with longer
          // delays usually succeeds after GPS initializes.
          const isFisAuthError =
            err.message?.includes('FIS_AUTH_ERROR') ||
            err.message?.includes('FirebaseInstallationService');

          // FCM failures that should not be retried (true permanent errors).
          const isFcmPermanent =
            err.message?.includes('SERVICE_NOT_AVAILABLE') ||
            (err.message?.includes('java.io.IOException') && !isFisAuthError) ||
            (err.message?.includes('ExecutionException') && !isFisAuthError) ||
            err.message?.includes('FirebaseApp is not initialized');

          if (isFcmPermanent) {
            // Distinguish likely root causes so a physical device failure is
            // easier to debug in production logs. The exact message comes from
            // the underlying Firebase/Play Services SDK, not from this app.
            const realErrorCode =
              err.message?.includes('SERVICE_NOT_AVAILABLE')
                ? 'FCM_ServiceNotAvailable'
                : err.message?.includes('FirebaseApp is not initialized')
                  ? 'FirebaseAppNotInitialized'
                  : err.message?.includes('java.io.IOException')
                    ? 'FcmIoException'
                    : err.message?.includes('ExecutionException')
                      ? 'FirebaseExecutionException'
                      : 'FcmUnknownPermanentFailure';

            console.warn(
              '[NOTIFICATIONS] ⚠️ FCM no disponible (emulador sin Google Play Services o dispositivo incompatible). Las notificaciones push no estarán disponibles.',
              {
                realErrorCode,
                errName: err?.name ?? null,
                errMessage: err?.message ?? null,
                platform: Platform.OS,
                isDevice: Device.isDevice,
                appOwnership: Constants.appOwnership,
              }
            );
            return null; // Salir sin lanzar error
          }

          if (isFisAuthError) {
            // FIS_AUTH_ERROR on Xiaomi/MIUI: Google Play Services needs time
            // to initialize. Retry with increasing delays: 3s, 5s, 8s, 12s
            lastWasFisAuth = true;
            if (attempt < retries) {
              const waitTime = attempt === 1 ? 3000 : attempt === 2 ? 5000 : attempt === 3 ? 8000 : 12000;
              console.warn(
                `[NOTIFICATIONS] ⚠️ FIS_AUTH_ERROR - Google Play Services initializing (attempt ${attempt}/${retries}). Retrying in ${waitTime / 1000}s...`
              );
              await new Promise(resolve => setTimeout(resolve, waitTime));
            } else {
              console.warn(
                '[NOTIFICATIONS] ⚠️ FIS_AUTH_ERROR persists after',
                retries,
                'attempts. Google Play Services may need manual activation on this device.'
              );
              return null;
            }
          } else if (isTransient && attempt < retries) {
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

      // Set notification category AFTER token fetch — fire-and-forget.
      // This call hangs on some Android devices (never resolves), so we
      // intentionally do NOT await it. The category is non-critical for
      // receiving push notifications; it only adds interactive action buttons.
      Notifications.setNotificationCategoryAsync('RIDE_REQUEST', [
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
      ])
        .then(() => console.log('[NOTIFICATIONS] ✅ Notification category set'))
        .catch((err) => console.warn('[NOTIFICATIONS] ⚠️ Failed to set notification category (non-critical):', err?.message));

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

    // Handle interactive notification actions (RIDE_REQUEST category with Accept/Reject buttons)
    if (actionIdentifier === 'ACCEPT_RIDE') {
      const rideId = data.rideId;
      if (rideId) {
        try {
          await rideAPI.acceptRide(rideId);
        } catch (error) {
          showStatus('warning', 'La solicitud ya no está disponible', '⚠️ Expirada');
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
        // ── STORE NOTIFICATIONS ──────────────────────────────────────────
        case 'store_approved':
        case 'store_rejected':
        case 'new_review':
        case 'review_reply':
          router.push('/(passenger)/index' as any);
          break;

        // ── DRIVER NOTIFICATIONS ─────────────────────────────────────────
        case 'ride_request':
        case 'ride_request_created':
        case 'new_ride_request':
          // Navigate to driver home where ride request card shows
          router.push('/(driver)/index' as any);
          break;

        case 'ride_cancelled':
          // Navigate to driver home (ride was cancelled, show updated state)
          if (data.rideId) {
            router.push('/(driver)/index' as any);
          }
          break;

        case 'payment_completed':
          // Navigate to driver earnings
          router.push('/(driver)/earnings' as any);
          break;

        case 'commission_credited':
          // Navigate to driver wallet
          router.push('/(driver)/wallet' as any);
          break;

        case 'driver_verified':
        case 'driver_rejected':
        case 'verification_status':
          // Navigate to driver verification status
          router.push('/(driver)/verification-status' as any);
          break;

        // ── PASSENGER NOTIFICATIONS ──────────────────────────────────────
        case 'ride_accepted':
          // Navigate to passenger home where ride tracking starts
          if (data.rideId) {
            router.push({
              pathname: '/(passenger)/index' as any,
              params: { activeRideId: data.rideId },
            });
          }
          break;

        case 'driver_arrived':
          // Navigate to passenger active ride tracking
          if (data.rideId) {
            router.push({
              pathname: '/(passenger)/index' as any,
              params: { activeRideId: data.rideId },
            });
          }
          break;

        case 'ride_started':
          // Navigate to passenger active ride tracking
          if (data.rideId) {
            router.push({
              pathname: '/(passenger)/index' as any,
              params: { activeRideId: data.rideId },
            });
          }
          break;

        case 'ride_completed':
          // Navigate to passenger ride history or receipt
          if (data.rideId) {
            router.push(`/(passenger)/history` as any);
          }
          break;

        case 'payment_processed':
          // Navigate based on role
          if (data.driverEarnings) {
            router.push('/(driver)/earnings' as any);
          } else if (data.rideId) {
            router.push(`/(passenger)/history` as any);
          }
          break;

        // ── SHARED RIDE ──────────────────────────────────────────────────
        case 'shared_ride_invitation':
          router.push('/(passenger)/index' as any);
          break;

        // ── PROMOTIONS ───────────────────────────────────────────────────
        case 'promotions':
        case 'promotions_notification':
          // Navigate to passenger home
          router.push('/(passenger)/index' as any);
          break;

        default:
          console.log('[NOTIFICATIONS] Unknown notification type, navigating home:', data.type);
          // Default: navigate to appropriate home based on role
          const { user } = useAuthStore.getState();
          if (user?.role === 'driver') {
            router.push('/(driver)/index' as any);
          } else {
            router.push('/(passenger)/index' as any);
          }
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
