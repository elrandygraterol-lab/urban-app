import { useContext } from 'react';
import {
  NotificationContext,
  type RideRequestData,
  type ToastData,
} from '@/context/NotificationContext';

export const useNotificationManager = () => {
  const context = useContext(NotificationContext);

  if (!context) {
    throw new Error(
      'useNotificationManager must be used within a NotificationProvider. ' +
        'Wrap your component tree with <NotificationProvider>.'
    );
  }

  const showRideRequest = (data: RideRequestData) => {
    if (context.activeRideRequest?.id === data.id) return;
    context.showRideRequest(data);
  };

  const showToast = (
    message: string,
    type: ToastData['type'] = 'info',
    durationMs = 4000
  ) => {
    context.showToast(message, type, durationMs);
  };

  const showAlert = (message: string) => {
    showToast(message, 'info', 5000);
  };

  return { showRideRequest, showToast, showAlert };
};
