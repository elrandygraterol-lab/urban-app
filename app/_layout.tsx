import { useEffect, useState } from 'react';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { InteractionManager } from 'react-native';
import 'react-native-reanimated';
import { CopilotProvider } from 'react-native-copilot';
//React Native Best Practices expo-dev-client
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuthStore } from '@/store/authStore';
import { useNotifications } from '@/hooks/useNotifications';
import { useGlobalSocketListeners } from '@/hooks/useGlobalSocketListeners';
import { useBadgeSync } from '@/hooks/useBadgeSync';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { logInfo, logError } from '@/utils/errorLogger';
import { NotificationProvider } from '@/context/NotificationContext';
import { GlobalNotificationOverlay } from '@/components/GlobalNotificationOverlay';

function AppContent() {
  useBadgeSync();

  const { user, isAuthenticated, loadStoredAuth } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();
  const [isNavigationReady, setIsNavigationReady] = useState(false);

  // Initialize notifications
  const { expoPushToken, error: notificationError } = useNotifications();

  // Initialize global socket listeners for payment and cancellation events
  useGlobalSocketListeners({ user, isAuthenticated });

  // Load stored authentication on app start
  useEffect(() => {
    logInfo('App Initialization', 'Loading stored authentication...');
    loadStoredAuth();
  }, []);

  // Log notification setup status
  useEffect(() => {
    if (expoPushToken) {
      logInfo('Notifications', 'Push notifications initialized successfully', {
        token: expoPushToken,
      });
    }
    // Silenciar errores comunes de desarrollo
    if (notificationError) {
      const errorMsg = String(notificationError);
      const isFirebaseError = errorMsg.includes('FirebaseApp');
      const isNetworkError = errorMsg.includes('Network request failed');
      const isTokenError = errorMsg.includes('device token') || errorMsg.includes('push token');
      const isFcmUnavailable =
        errorMsg.includes('SERVICE_NOT_AVAILABLE') ||
        errorMsg.includes('SERVICE_UNAVAILABLE') ||
        errorMsg.includes('java.io.IOException') ||
        errorMsg.includes('ExecutionException') ||
        errorMsg.includes('Fetching the token failed');

      // Solo loguear errores críticos, no errores esperados en desarrollo
      if (!isFirebaseError && !isNetworkError && !isTokenError && !isFcmUnavailable) {
        logError('Notifications', notificationError);
      }
      // SERVICE_NOT_AVAILABLE = FCM no disponible en emulador o Google Play Services ausente
    }
  }, [expoPushToken, notificationError]);

  // Mark navigation as ready after interactions complete
  useEffect(() => {
    // Use InteractionManager to ensure all animations and interactions are complete
    const handle = InteractionManager.runAfterInteractions(() => {
      setIsNavigationReady(true);
      logInfo('Navigation', 'Navigation system ready (after interactions)');
    });

    return () => handle.cancel();
  }, []);

  // Handle navigation based on authentication and role
  useEffect(() => {
    // Wait for navigation to be ready and segments to be available
    if (!isNavigationReady || !segments || !segments[0]) {
      return;
    }

    const currentSegment = segments[0] as string;
    const inAuthGroup = currentSegment === '(auth)';
    const inPassengerGroup = currentSegment === '(passenger)';
    const inDriverGroup = currentSegment === '(driver)';

    logInfo('Navigation', 'Checking navigation state', {
      isAuthenticated,
      userRole: user?.role,
      currentSegment,
      inAuthGroup,
      inPassengerGroup,
      inDriverGroup,
    });

    // Avoid navigation loops - only navigate if really needed
    try {
      if (!isAuthenticated && !inAuthGroup) {
        // Redirect to login if not authenticated
        logInfo('Navigation', 'Redirecting to login (not authenticated)');
        router.replace('/(auth)/login' as any);
      } else if (isAuthenticated && inAuthGroup) {
        // Redirect to appropriate home based on role
        if (user?.role === 'driver') {
          // Check if driver needs to complete registration
          if (
            segments[1] === 'register' ||
            segments[1] === 'documents-upload' ||
            segments[1] === 'verification-status'
          ) {
            // Allow driver registration flow
            logInfo('Navigation', 'Allowing driver registration flow');
            return;
          }
          logInfo('Navigation', 'Redirecting to driver home');
          router.replace('/(driver)' as any);
        } else {
          logInfo('Navigation', 'Redirecting to passenger home');
          router.replace('/(passenger)' as any);
        }
      } else if (isAuthenticated && user) {
        // Ensure user is in correct role group
        if (user.role === 'driver' && !inDriverGroup) {
          logInfo('Navigation', 'Redirecting driver to driver home');
          router.replace('/(driver)' as any);
        } else if (user.role === 'passenger' && !inPassengerGroup) {
          logInfo('Navigation', 'Redirecting passenger to passenger home');
          router.replace('/(passenger)' as any);
        }
      }
    } catch (error) {
      logError('Navigation', error, { segments, isAuthenticated, userRole: user?.role });
    }
  }, [isAuthenticated, user, segments, isNavigationReady]);

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(passenger)" />
        <Stack.Screen name="(driver)" />
      </Stack>
      <GlobalNotificationOverlay />
      <StatusBar style="auto" />
    </>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ErrorBoundary>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <NotificationProvider>
          <CopilotProvider stopOnOutsideClick androidStatusBarVisible>
            <AppContent />
          </CopilotProvider>
        </NotificationProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
