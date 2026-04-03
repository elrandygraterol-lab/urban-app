/**
 * Hook to handle automatic socket reconnection on app state changes
 * Reconnects the socket when the app comes back from background
 */

import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { reconnectSocket } from '@/services/socket';
import { useAuthStore } from '@/store/authStore';

export const useSocketReconnect = () => {
  const { isAuthenticated, token } = useAuthStore();
  const appState = useRef(AppState.currentState);
  const lastReconnectAttempt = useRef<number>(0);
  const isFirstMount = useRef(true); // Track if this is the first mount
  const MIN_RECONNECT_INTERVAL = 30000; // 30 seconds minimum between reconnects

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    // Skip reconnection logic on first mount
    if (isFirstMount.current) {
      console.log('[SOCKET RECONNECT] First mount - skipping reconnect logic');
      isFirstMount.current = false;
      return;
    }

    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      const now = Date.now();
      const timeSinceLastReconnect = now - lastReconnectAttempt.current;

      // App is coming to foreground from background
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        console.log('[SOCKET RECONNECT] App has come to foreground');

        // Only reconnect if enough time has passed since last attempt
        if (timeSinceLastReconnect > MIN_RECONNECT_INTERVAL) {
          console.log('[SOCKET RECONNECT] Attempting to reconnect socket...');
          lastReconnectAttempt.current = now;

          try {
            await reconnectSocket();
            console.log('[SOCKET RECONNECT] ✅ Reconnection successful');
          } catch (error) {
            console.error('[SOCKET RECONNECT] ❌ Reconnection failed:', error);
            // Fail silently - don't bother the user
          }
        } else {
          console.log('[SOCKET RECONNECT] Skipping reconnect (too soon since last attempt)');
        }
      }

      appState.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [isAuthenticated, token]);
};

export default useSocketReconnect;
