// Web version of useNotifications - notifications not supported on web
export interface NotificationData {
  type?: string;
  rideId?: string;
  driverId?: string;
  passengerId?: string;
  [key: string]: any;
}

export const useNotifications = () => {
  console.log('Using web version of useNotifications - push notifications not supported on web');

  return {
    expoPushToken: null,
    notification: null,
    error: 'Push notifications are not supported on web',
    sendLocalNotification: async () => {
      console.warn('Local notifications not supported on web');
    },
    clearNotifications: async () => {
      console.warn('Clear notifications not supported on web');
    },
    getBadgeCount: async () => 0,
    setBadgeCount: async () => {
      console.warn('Badge count not supported on web');
    },
  };
};
