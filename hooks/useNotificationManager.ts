/**
 * useNotificationManager (Legacy wrapper)
 *
 * ⚠️ DEPRECATED — Use useUnifiedNotifications from '@/context/UnifiedNotificationContext' instead.
 *
 * This hook is kept for backward compatibility. It wraps the new unified system.
 * All new code should import directly from UnifiedNotificationContext.
 * All old code using this hook will continue to work through the new unified provider.
 */

import { useUnifiedNotifications } from '@/context/UnifiedNotificationContext';
import type { RideRequestData } from '@/context/UnifiedNotificationContext';

/** @deprecated Use useUnifiedNotifications instead */
export const useNotificationManager = () => {
  const unified = useUnifiedNotifications();

  const showRideRequest = (data: RideRequestData) => {
    unified.showRideRequest(data);
  };

  const showToast = (
    message: string,
    type: 'success' | 'info' | 'warning' | 'error' = 'info',
    durationMs = 4000
  ) => {
    unified.showToast(message, type, durationMs);
  };

  const showAlert = (message: string) => {
    unified.showToast(message, 'info', 5000);
  };

  return { showRideRequest, showToast, showAlert };
};
