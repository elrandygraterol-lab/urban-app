import { useEffect, useRef } from 'react';
import { useNetworkStatus } from './useNetworkStatus';
import { useUnifiedNotifications } from '@/context/UnifiedNotificationContext';

export function useNetworkAlerts() {
  const { isConnected, isSlowConnection } = useNetworkStatus();
  const { showToast } = useUnifiedNotifications();
  const wasConnectedRef = useRef(isConnected);
  const wasSlowRef = useRef(isSlowConnection);

  useEffect(() => {
    if (wasConnectedRef.current && !isConnected) {
      showToast('Sin conexión a internet', 'warning', 4000);
    }
    wasConnectedRef.current = isConnected;
  }, [isConnected]);

  useEffect(() => {
    if (isSlowConnection && !wasSlowRef.current) {
      showToast('Conexión lenta — los tiempos de carga pueden ser mayores', 'info', 4000);
    }
    wasSlowRef.current = isSlowConnection;
  }, [isSlowConnection]);
}
