import { useEffect, useState } from 'react';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { InteractionManager, LogBox } from 'react-native';
import 'react-native-reanimated';

LogBox.ignoreLogs([
  'Can\'t perform a React state update on a component that hasn\'t mounted yet',
]);
// import { CopilotProvider } from 'react-native-copilot';
// import CopilotTooltip from '@/components/tutorial/CopilotTooltip';
// import { handleTourEnd } from '@/utils/tutorialState';
//React Native Best Practices expo-dev-client
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuthStore } from '@/store/authStore';
import { useNotifications } from '@/hooks/useNotifications';
import { useGlobalSocketListeners } from '@/hooks/useGlobalSocketListeners';
import { useBadgeSync } from '@/hooks/useBadgeSync';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { logInfo, logError } from '@/utils/errorLogger';
import { KeyboardProvider } from 'react-native-keyboard-controller';

// Initialize log capture for the in-app Sistema log viewer
// Must be imported early to intercept all console.log/warn/error
import '@/services/logCapture';
import { UnifiedNotificationProvider } from '@/context/UnifiedNotificationContext';
import { UnifiedNotificationOverlay } from '@/components/UnifiedNotificationOverlay';
import { OfflineBanner } from '@/components/OfflineBanner';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useNetworkAlerts } from '@/hooks/useNetworkAlerts';
import ProminentLocationDisclosure from '@/components/ProminentLocationDisclosure';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LOCATION_DISCLOSURE_KEY = 'LOCATION_DISCLOSURE_ACCEPTED';

/** Sólo monta los hooks de socket global cuando el usuario está autenticado.
 *  Esto evita que useSound(), useExchangeRate() y el import de socket.io
 *  se ejecuten durante la pantalla de login. */
function GlobalSocketGuard({ user, isAuthenticated }: { user: any; isAuthenticated: boolean }) {
  useGlobalSocketListeners({ user, isAuthenticated });
  return null;
}

function AppContent() {
  useBadgeSync();
  useNetworkStatus(); // Initialize network monitoring early
  useNetworkAlerts(); // Toast alerts for disconnection and slow network

  const { user, isAuthenticated, loadStoredAuth } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();
  const [isNavigationReady, setIsNavigationReady] = useState(false);
  const [disclosureLoaded, setDisclosureLoaded] = useState(false);
  const [disclosureAccepted, setDisclosureAccepted] = useState(false);

  // Initialize notifications
  const { expoPushToken, error: notificationError, processPendingColdStart } = useNotifications();

  // Initialize global socket listeners for payment and cancellation events
  // Only mounted after authentication — evita importar socket.io en login
  const showSocketGuard = isAuthenticated && !!user;

  // Load stored authentication on app start
  useEffect(() => {
    logInfo('App Initialization', 'Loading stored authentication...');
    loadStoredAuth();
  }, [loadStoredAuth]);

  // Check if location disclosure has been accepted
  useEffect(() => {
    AsyncStorage.getItem(LOCATION_DISCLOSURE_KEY).then((value) => {
      setDisclosureAccepted(value === 'true');
      setDisclosureLoaded(true);
    });
  }, []);

  const handleDisclosureAccept = async () => {
    await AsyncStorage.setItem(LOCATION_DISCLOSURE_KEY, 'true');
    setDisclosureAccepted(true);
  };

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
    // Wait for navigation to be ready, segments to be available, and disclosure accepted
    if (!isNavigationReady || !segments || !segments[0] || !disclosureAccepted) {
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
        // Redirect to appropriate home based on role, but allow legal docs
        const isLegalRoute = segments[1] === 'privacy-policy' || segments[1] === 'terms-of-service';
        if (isLegalRoute) {
          logInfo('Navigation', 'Allowing legal route:', segments[1]);
          return;
        }

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
  }, [isAuthenticated, user?.id, user?.role, segments, isNavigationReady, router]);

  // Pre-load heavy screens after navigation settles (post-auth)
  useEffect(() => {
    if (!isNavigationReady || !isAuthenticated || !user) return;

    const handle = InteractionManager.runAfterInteractions(() => {
      logInfo('Preload', 'Starting background preload of heavy screens');
      if (user.role === 'driver') {
        import('@/app/(driver)/active-ride').catch(() => {});
        import('@/app/(driver)/manage-ride').catch(() => {});
      } else if (user.role === 'passenger') {
        import('@/app/(passenger)/delegated-ride-tracking').catch(() => {});
      }
    });

    return () => handle.cancel();
  }, [isNavigationReady, isAuthenticated, user?.id, user?.role]);

  // Process pending cold-start notification tap after auth + navigation are ready.
  // The notification tap was stored in useNotifications() during cold start;
  // now that the user is authenticated and the Stack is mounted, navigate.
  useEffect(() => {
    if (isNavigationReady && isAuthenticated && disclosureAccepted) {
      processPendingColdStart();
    }
  }, [isNavigationReady, isAuthenticated, disclosureAccepted]);

  return (
    <>
      {disclosureLoaded && !disclosureAccepted ? (
        <ProminentLocationDisclosure
          visible={true}
          onAccept={handleDisclosureAccept}
        />
      ) : null}
      {disclosureLoaded && disclosureAccepted && (
        <Stack initialRouteName="(auth)" screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(passenger)" />
          <Stack.Screen name="(driver)" />
        </Stack>
      )}
      {disclosureLoaded && <UnifiedNotificationOverlay />}
      {disclosureLoaded && <OfflineBanner />}
      {disclosureLoaded && showSocketGuard && (
        <GlobalSocketGuard user={user} isAuthenticated={isAuthenticated} />
      )}
      <ExpoStatusBar style="auto" />
    </>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ErrorBoundary>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <UnifiedNotificationProvider>
          <KeyboardProvider>
            <AppContent />
          </KeyboardProvider>
        </UnifiedNotificationProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
