import { useState, useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';

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
  [key: string]: any;
}

export const useNotifications = () => {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [notification, setNotification] = useState<Notifications.Notification | null>(null);
  const [error, setError] = useState<string | null>(null);
  const notificationListener = useRef<Notifications.Subscription | undefined>(undefined);
  const responseListener = useRef<Notifications.Subscription | undefined>(undefined);
  const router = useRouter();

  // Check if running in Expo Go
  const isExpoGo = Constants.appOwnership === 'expo';

  useEffect(() => {
    // Skip push notification setup in Expo Go (SDK 53+ doesn't support it)
    if (isExpoGo) {
      console.warn('Push notifications are not supported in Expo Go. Please use a Development Build.');
      setError('Push notifications require a Development Build');
      return;
    }

    // Register for push notifications
    registerForPushNotificationsAsync()
      .then((token) => {
        if (token) {
          setExpoPushToken(token);
          // Register token with backend
          registerDeviceToken(token);
        }
      })
      .catch((err) => {
        setError(err.message);
        console.error('Error registering for push notifications:', err);
      });

    // Listener for notifications received while app is in foreground
    notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
      console.log('Notification received in foreground:', notification);
      setNotification(notification);
    });

    // Listener for when user taps on notification
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
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

  const registerForPushNotificationsAsync = async (): Promise<string | null> => {
    let token: string | null = null;

    // Check if running on a physical device (not simulator/emulator)
    const isDevice = !Constants.isDevice ? false : true;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#22c55e',
      });
    }

    if (isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        throw new Error('Permission not granted for push notifications');
      }

      // Get the Expo push token
      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      
      if (!projectId) {
        console.warn('No project ID found. Using development mode.');
      }

      token = (
        await Notifications.getExpoPushTokenAsync({
          projectId: projectId || undefined,
        })
      ).data;

      console.log('Expo Push Token:', token);
    } else {
      console.warn('Must use physical device for Push Notifications');
    }

    return token;
  };

  const registerDeviceToken = async (token: string) => {
    try {
      const platform = Platform.OS as 'android' | 'ios' | 'web';
      
      const { notificationAPI } = await import('@/services/api');
      await notificationAPI.registerDevice({
        token,
        platform,
      });

      console.log('Device token registered with backend');
    } catch (err) {
      console.error('Error registering device token with backend:', err);
      setError('Failed to register device token');
    }
  };

  const handleNotificationResponse = (response: Notifications.NotificationResponse) => {
    const data = response.notification.request.content.data as NotificationData;

    // Navigate to appropriate screen based on notification type
    if (data.type && data.rideId) {
      switch (data.type) {
        case 'ride_accepted':
        case 'driver_arrived':
        case 'ride_started':
        case 'ride_completed':
          // Navigate to active ride screen for passenger
          router.push(`/(passenger)/ride/${data.rideId}` as any);
          break;

        case 'new_ride_request':
          // Navigate to ride request screen for driver
          router.push(`/(driver)/ride-request/${data.rideId}` as any);
          break;

        case 'ride_cancelled':
          // Navigate to home screen
          router.push('/(passenger)' as any);
          break;

        case 'driver_verified':
        case 'driver_rejected':
          // Navigate to driver profile/verification screen
          router.push('/(driver)/profile' as any);
          break;

        case 'payment_processed':
          // Navigate to payment receipt
          router.push(`/(passenger)/receipt/${data.rideId}` as any);
          break;

        default:
          console.log('Unknown notification type:', data.type);
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
