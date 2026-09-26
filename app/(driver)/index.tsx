import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Modal,
  ScrollView,
  AppState,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { getLocation } from '@/utils/lazyLocation';
import type { LocationSubscription } from 'expo-location';
import { driverLocationService } from '@/services/driverLocationService';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/store/authStore';
import { useDriverStore } from '@/store/driverStore';
import {
  connectSocket,
  getSocket,
  addConnectionListener,
  removeConnectionListener,
  onRideCancelled,
  onDriverAvailabilityChanged,
} from '@/services/socket';
import { Colors as colors } from '@/constants/theme';
import { useSocketReconnect } from '@/hooks/useSocketReconnect';
import { useSound } from '@/hooks/useSound';
import { Ionicons } from '@expo/vector-icons';
import { useUnifiedNotifications } from '@/context/UnifiedNotificationContext';
import type { Socket } from 'socket.io-client';
import { DriverTaxiIcon } from '@/src/components/map/markers';
import { rideAPI } from '@/services/api';
// import { setActiveTutorialScreen } from '@/utils/tutorialState';
// import { useCopilot, walkthroughable, CopilotStep } from 'react-native-copilot';
import CenterLocationButton from '@/components/CenterLocationButton';

// const WalkthroughTouchableOpacity = walkthroughable(TouchableOpacity);
// const WalkthroughCenterLocationButton = walkthroughable(CenterLocationButton);

export default function DriverHomeScreen() {
  const { user, token } = useAuthStore();
  const {
    isAvailable,
    isUpdatingAvailability,
    setIsAvailable,
    toggleAvailability,
    balanceVES,
    balanceUSD,
    transactions,
  } = useDriverStore();
  const { playNotificationSound } = useSound();
  const { showToast, showError, showStatus, showRideRequest, dismissStatus } = useUnifiedNotifications();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);

  // Wallet Modal state
  const [showWallet, setShowWallet] = useState(false);
  const isMountedRef = useRef(true);
  const cleanupRideCancelledRef = useRef<(() => void) | null>(null);
  const cleanupAvailabilityChangedRef = useRef<(() => void) | null>(null);
  const connectHandlerRef = useRef<(() => void) | null>(null);
  const disconnectHandlerRef = useRef<((reason: string) => void) | null>(null);
  const errorHandlerRef = useRef<((error: any) => void) | null>(null);
  const reconnectHandlerRef = useRef<(() => void) | null>(null);
  const disconnectLogHandlerRef = useRef<((reason: string) => void) | null>(null);
  const localListenersRegisteredRef = useRef(false);
  const locationSubscriptionRef = useRef<LocationSubscription | null>(null);
  const locationUnsubRef = useRef<(() => void) | null>(null);

  useSocketReconnect();

  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [, setHeading] = useState<number | null>(null); // Add heading state
  const [loading, setLoading] = useState(true);
  const [, setSocketInstance] = useState<Socket | null>(null);
  const [, setIsSocketConnected] = useState(false);
  const driverMarkerCoord = useMemo(
    () => (location ? { latitude: location.latitude, longitude: location.longitude } : null),
    [location?.latitude, location?.longitude]
  );

  // Smart Tutorial state
  // const { start: startTour } = useCopilot();
  // const { isActive: needsTutorial } = useSmartTutorial('driver_home');
  // const tutorialStartedRef = useRef(false);

  // Redirect to active-ride whenever driver tabs to Inicio with an ongoing ride
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const checkActiveRide = async () => {
        try {
          const res = await rideAPI.getActiveRides();
          const rides = res.data?.data;
          const activeRides = Array.isArray(rides) ? rides : [];
          if (!cancelled && activeRides.length > 0) {
            const rideId = activeRides[0].id;
            if (rideId) {
              console.log('[DRIVER] Active ride found, pushing to active-ride:', rideId);
              router.push(`/(driver)/active-ride?rideId=${rideId}` as any);
            }
          }
        } catch {}
      };
      checkActiveRide();
      return () => {
        cancelled = true;
      };
    }, [router])
  );

  // Also check when app returns to foreground (not just tab focus)
  useEffect(() => {
    const checkActiveRide = async () => {
      try {
        const res = await rideAPI.getActiveRides();
        const rides = res.data?.data;
        const activeRides = Array.isArray(rides) ? rides : [];
        if (activeRides.length > 0) {
          const rideId = activeRides[0].id;
          if (rideId) {
            router.push(`/(driver)/active-ride?rideId=${rideId}` as any);
          }
        }
      } catch {}
    };

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        checkActiveRide();
      }
    });

    return () => subscription.remove();
  }, [router]);

  // Function to toggle driver availability - now uses custom toast notifications
  const handleToggleAvailability = async () => {
    const result = await toggleAvailability();
    if (result.success) {
      showToast(
        result.newAvailability
          ? 'Estás en línea — recibirás solicitudes de viaje'
          : 'Estás fuera de línea — no recibirás solicitudes',
        result.newAvailability ? 'success' : 'info'
      );
    } else if (result.error !== 'already_updating') {
      showError('No se pudo actualizar la disponibilidad');
    }
  };

  // Function to center map on driver's current location
  const handleCenterOnUserLocation = () => {
    if (!location) {
      showError('No se pudo obtener tu ubicación actual');
      return;
    }

    if (mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        1000
      );
    }
  };

  const initializeLocation = useCallback(async () => {
    try {
      const Loc = await getLocation();
      const { status } = await Loc.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        showStatus(
          'warning',
          'Se necesita acceso a la ubicación para usar esta función. Por favor habilita los permisos de ubicación en la configuración de tu dispositivo.',
          'Permiso Denegado'
        );
        setLoading(false);
        return;
      }

      const currentLocation = await Loc.getCurrentPositionAsync({
        accuracy: Loc.Accuracy.High,
        // timeout: 10000, // 10 second timeout (removed - not supported by LocationOptions)
      });
      const coords = {
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
      };
      setLocation(coords);

      // Set initial heading if available
      if (currentLocation.coords.heading !== null && currentLocation.coords.heading !== undefined) {
        setHeading(currentLocation.coords.heading);
      }
      setLoading(false);

      // Single source of truth: service owns the watcher and emits via socket in idle mode
      driverLocationService.setIdleStream(true);
      locationUnsubRef.current = driverLocationService.subscribe(fix => {
        setLocation({ latitude: fix.latitude, longitude: fix.longitude });
        if (fix.heading !== null && fix.heading !== undefined) {
          setHeading(fix.heading);
        }
      });
    } catch (error: any) {
      console.warn('[DRIVER] Location error (handled with fallback):', error?.message || error);

      // Show user-friendly error message
      const errorMessage = error?.message || 'No se pudo obtener la ubicación';

      // Use fallback location for development/testing
      const fallbackCoords = {
        latitude: 9.899159, // San Juan de Los Morros, Venezuela
        longitude: -67.3496342,
      };

      if (errorMessage.includes('unavailable') || errorMessage.includes('disabled')) {
        console.warn('[DRIVER] Location services unavailable, using fallback location');
        setLocation(fallbackCoords);
        setLoading(false);

        showStatus(
          'warning',
          'Los servicios de ubicación están deshabilitados. Se está usando una ubicación de prueba.\n\nPara usar tu ubicación real, habilita los servicios de ubicación y reinicia la aplicación.',
          'Ubicación No Disponible'
        );
      } else if (errorMessage.includes('timeout')) {
        console.warn('[DRIVER] Location timeout, using fallback location');
        setLocation(fallbackCoords);
        setLoading(false);

        showStatus(
          'warning',
          'No se pudo obtener tu ubicación. Se está usando una ubicación de prueba.\n\nVerifica que los servicios de ubicación estén habilitados, tengas buena señal GPS y estés en un lugar con visibilidad al cielo.',
          'Tiempo de Espera Agotado',
          undefined,
          { label: 'Reintentar', onPress: () => { initializeLocation(); dismissStatus(); } }
        );
      } else {
        console.warn('[DRIVER] Location error, using fallback location');
        setLocation(fallbackCoords);
        setLoading(false);

        showStatus(
          'error',
          'No se pudo obtener tu ubicación. Se está usando una ubicación de prueba.\n\nPara usar tu ubicación real, verifica que los servicios de ubicación estén habilitados.',
          'Error de Ubicación',
          undefined,
          { label: 'Reintentar', onPress: () => { initializeLocation(); dismissStatus(); } }
        );
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Memoized callback for handling ride cancellations
  const handleRideCancelled = useCallback(
    (data: {
      rideId: string;
      status: 'cancelled';
      cancelledBy: 'passenger' | 'driver' | 'system';
      cancellationReason: string;
      cancellationFee: number;
      cancelledAt: string;
      timestamp: string;
    }) => {
      console.log('[DRIVER] ========================================');
      console.log('[DRIVER] 🚫 RIDE CANCELLED EVENT RECEIVED');
      console.log('[DRIVER]    Ride ID:', data.rideId);
      console.log('[DRIVER]    Cancelled By:', data.cancelledBy);
      console.log('[DRIVER]    Cancellation Fee:', data.cancellationFee);
      console.log('[DRIVER]    Reason:', data.cancellationReason);
      console.log('[DRIVER]    Timestamp:', data.timestamp);
      console.log('[DRIVER]    Component Mounted:', isMountedRef.current);
      console.log('[DRIVER] ========================================');

      // Notification handled by active-ride.tsx (screen-level) and
      // useGlobalSocketListeners (global) — this handler restores availability
      // for the edge case where driver accepted a ride but navigation never completed
      // Only restore availability if the cancellation was not initiated by the driver
      if (data.cancelledBy !== 'driver') {
        setIsAvailable(true);
      }
    },
    [setIsAvailable]
  );

  // Memoized callback for handling driver availability changes
  const handleAvailabilityChanged = useCallback(
    (data: {
      driverId: string;
      isAvailable: boolean;
      timestamp: string;
      location?: {
        latitude: number;
        longitude: number;
      };
    }) => {
      console.log('[DRIVER] ========================================');
      console.log('[DRIVER] 🔄 AVAILABILITY CHANGED EVENT RECEIVED');
      console.log('[DRIVER]    Driver ID:', data.driverId);
      console.log('[DRIVER]    Is Available:', data.isAvailable);
      console.log('[DRIVER]    Timestamp:', data.timestamp);
      console.log('[DRIVER]    Component Mounted:', isMountedRef.current);
      console.log('[DRIVER] ========================================');

      // Verify component is still mounted
      if (!isMountedRef.current) {
        console.warn('[DRIVER] ⚠️ Component unmounted, skipping availability update');
        return;
      }

      // Update availability state
      setIsAvailable(data.isAvailable);

      // Show toast notification
      if (data.isAvailable) {
        console.log('[DRIVER] ✅ You are now available to receive ride requests');
      } else {
        console.log('[DRIVER] ⏸️ You are now unavailable');
      }
    },
    [setIsAvailable]
  );

  const setupSocketListeners = useCallback(
    (socket: Socket) => {
      if (!socket) {
        console.warn('[DRIVER] ========================================');
        console.warn('[DRIVER] ⚠️ CANNOT SETUP LISTENERS');
        console.warn('[DRIVER]    Socket is null or undefined');
        console.warn('[DRIVER] ========================================');
        return;
      }

      // Skip if local listeners already registered (avoids duplicates)
      if (localListenersRegisteredRef.current) {
        console.log('[DRIVER] ⚠️ Local listeners already registered, skipping');
        return;
      }

      console.log('[DRIVER] ========================================');
      console.log('[DRIVER] 🎧 SETTING UP SOCKET LISTENERS');
      console.log('[DRIVER]    Socket ID:', socket.id);
      console.log('[DRIVER]    Socket connected:', socket.connected);
      console.log('[DRIVER]    User ID:', user?.id);
      console.log('[DRIVER]    User Role:', user?.role);
      console.log('[DRIVER] ========================================');

      // Clean up previous ride cancelled listener if it exists
      if (cleanupRideCancelledRef.current) {
        cleanupRideCancelledRef.current();
        cleanupRideCancelledRef.current = null;
      }

      // Clean up previous availability changed listener if it exists
      if (cleanupAvailabilityChangedRef.current) {
        cleanupAvailabilityChangedRef.current();
        cleanupAvailabilityChangedRef.current = null;
      }

      // Register ride cancelled listener using imported helper function
      // Store the cleanup function returned by onRideCancelled
      cleanupRideCancelledRef.current = onRideCancelled(handleRideCancelled);

      // Register driver availability changed listener
      // Store the cleanup function returned by onDriverAvailabilityChanged
      if (!cleanupAvailabilityChangedRef.current) {
        cleanupAvailabilityChangedRef.current =
          onDriverAvailabilityChanged(handleAvailabilityChanged);
      }

      // Evento 'ride:payment_completed' ahora se maneja globalmente en useGlobalSocketListeners

      console.log('[DRIVER] ========================================');
      console.log('[DRIVER] ✅ LISTENERS REGISTERED (Local)');
      console.log('[DRIVER]    - ride:cancelled (local - via onRideCancelled helper)');
      console.log(
        '[DRIVER]    - driver:availability_changed (local - via onDriverAvailabilityChanged helper)'
      );
      console.log('[DRIVER]    Note: ride:payment_completed handled globally');
      console.log('[DRIVER] ========================================');

      localListenersRegisteredRef.current = true;
    },
    [handleRideCancelled, handleAvailabilityChanged, user?.id, user?.role]
  );

  const initializeSocket = useCallback(async () => {
    if (!user || !token) {
      console.log('[DRIVER] ========================================');
      console.log('[DRIVER] ⚠️ CANNOT INITIALIZE SOCKET');
      console.log('[DRIVER]    User:', !!user);
      console.log('[DRIVER]    Token:', !!token);
      console.log('[DRIVER] ========================================');
      return;
    }

    try {
      console.log('[DRIVER] ========================================');
      console.log('[DRIVER] 🔌 INITIALIZING SOCKET CONNECTION');
      console.log('[DRIVER]    User ID:', user.id);
      console.log('[DRIVER]    User Role:', user.role);
      console.log('[DRIVER]    Token length:', token.length);
      console.log('[DRIVER] ========================================');

      // Use existing socket if already connected (avoids destroying global listeners)
      let socket = getSocket();
      if (!socket || !socket.connected) {
        socket = await connectSocket(token);
      }

      console.log('[DRIVER] ========================================');
      console.log('[DRIVER] ✅ SOCKET CONNECTED');
      console.log('[DRIVER]    Socket ID:', socket.id);
      console.log('[DRIVER]    Connected:', socket.connected);
      console.log('[DRIVER] ========================================');

      setSocketInstance(socket);

      // Reset and re-register local listeners
      localListenersRegisteredRef.current = false;
      setupSocketListeners(socket);

      // ride:request_created is handled by the global listener (useGlobalSocketListeners)
      // No need for a direct handler — the global one is more reliable across reconnects

      // Register reconnect handler that re-registers all local listeners
      // Remove old handler first to prevent duplicates across reconnections
      if (reconnectHandlerRef.current) {
        socket.off('connect', reconnectHandlerRef.current);
      }
      reconnectHandlerRef.current = () => {
        console.log('[DRIVER] ========================================');
        console.log('[DRIVER] 🔄 SOCKET RECONNECTED');
        console.log('[DRIVER]    Socket ID:', socket.id);
        console.log('[DRIVER]    Re-registering listeners with fresh callbacks...');
        console.log('[DRIVER] ========================================');
        localListenersRegisteredRef.current = false;
        setupSocketListeners(socket);
      };
      socket.on('connect', reconnectHandlerRef.current);

      // Register disconnect log handler — remove old to prevent duplicates
      if (disconnectLogHandlerRef.current) {
        socket.off('disconnect', disconnectLogHandlerRef.current);
      }
      disconnectLogHandlerRef.current = (reason: string) => {
        console.log('[DRIVER] ========================================');
        console.log('[DRIVER] ❌ SOCKET DISCONNECTED');
        console.log('[DRIVER]    Reason:', reason);
        console.log('[DRIVER]    Socket ID:', socket.id);
        console.log('[DRIVER] ========================================');
      };
      socket.on('disconnect', disconnectLogHandlerRef.current);

      console.log('[DRIVER] ✅ Socket initialization complete');
    } catch (error: any) {
      console.error('[DRIVER] ========================================');
      console.error('[DRIVER] ❌ SOCKET CONNECTION FAILED');
      console.error('[DRIVER]    Error:', error.message);
      console.error('[DRIVER]    Stack:', error.stack);
      console.error('[DRIVER] ========================================');
      setSocketInstance(null);
    }
  }, [user?.id, user?.role, token, setupSocketListeners]);

  useEffect(() => {
    // Set mounted flag
    isMountedRef.current = true;

    // CRITICAL: Only initialize if user is actually a driver
    // This prevents the screen from initializing when pre-rendered by React Navigation
    if (!user || user.role !== 'driver') {
      console.log('[DRIVER] ========================================');
      console.log('[DRIVER] ⚠️ SKIPPING INITIALIZATION');
      console.log('[DRIVER]    User:', user?.name || 'null');
      console.log('[DRIVER]    Role:', user?.role || 'null');
      console.log('[DRIVER]    Reason: User is not a driver');
      console.log('[DRIVER] ========================================');
      setLoading(false);
      return;
    }

    console.log('[DRIVER] ========================================');
    console.log('[DRIVER] ✅ INITIALIZING DRIVER SCREEN');
    console.log('[DRIVER]    User:', user.name);
    console.log('[DRIVER]    Role:', user.role);
    console.log('[DRIVER]    User ID:', user.id);
    console.log('[DRIVER] ========================================');

    // Load driver availability status from backend
    const loadDriverAvailability = async () => {
      try {
        const { driverAPI } = await import('@/services/api');
        const driverProfile = await driverAPI.getMyProfile();
        const profile = driverProfile.data.data;
        if (profile && profile.isAvailable !== undefined) {
          setIsAvailable(profile.isAvailable);
          console.log('[DRIVER] Loaded availability status:', profile.isAvailable);
        }
      } catch (error) {
        console.log('[DRIVER] Could not load driver availability:', error);
        // Default to false if we can't load the status
        setIsAvailable(false);
      }
    };

    loadDriverAvailability();
    useDriverStore.getState().fetchWalletData();

    // Add connection state listener
    const connectionListener = (connected: boolean) => {
      console.log('[DRIVER] Connection state changed:', connected);
      setIsSocketConnected(connected);
      // Force update socket instance to trigger re-render
      const socket = getSocket();
      if (socket) {
        setSocketInstance(socket);
      }
    };

    addConnectionListener(connectionListener);

    initializeLocation();
    if (user && token) {
      initializeSocket();
    }

    return () => {
      // Clear mounted flag
      removeConnectionListener(connectionListener);
      isMountedRef.current = false;

      // Clean up ride cancelled listener using the stored cleanup function
      if (cleanupRideCancelledRef.current) {
        cleanupRideCancelledRef.current();
        cleanupRideCancelledRef.current = null;
      }

      // Clean up availability changed listener using the stored cleanup function
      if (cleanupAvailabilityChangedRef.current) {
        cleanupAvailabilityChangedRef.current();
        cleanupAvailabilityChangedRef.current = null;
      }

      localListenersRegisteredRef.current = false;

      const socket = getSocket();
      if (socket) {
        // Only remove LOCAL listeners — never global ones
        if (reconnectHandlerRef.current) {
          socket.off('connect', reconnectHandlerRef.current);
        }
        if (disconnectLogHandlerRef.current) {
          socket.off('disconnect', disconnectLogHandlerRef.current);
        }
      }
      // Don't disconnect socket here - keep it alive for the session

      // Clean up location watcher
      if (locationSubscriptionRef.current) {
        locationSubscriptionRef.current.remove();
        locationSubscriptionRef.current = null;
      }
      if (locationUnsubRef.current) {
        locationUnsubRef.current();
        locationUnsubRef.current = null;
      }
      driverLocationService.setIdleStream(false);
    };
  }, [user?.id, user?.role, token]);

  if (loading || !location) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Cargando...</Text>
      </View>
    );
  }

  // Safety check: Don't render driver screen if user is not a driver
  if (!user || user.role !== 'driver') {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Acceso no autorizado</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialCamera={{
          center: {
            latitude: location.latitude,
            longitude: location.longitude,
          },
          pitch: 30,
          heading: 0,
          zoom: 16,
        }}
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsBuildings={true}
        scrollEnabled={true}
        zoomEnabled={true}
        rotateEnabled={true}
        pitchEnabled={true}
        toolbarEnabled={false}
        moveOnMarkerPress={false}
      >
        <Marker
          coordinate={driverMarkerCoord!}
          title="Mi ubicación"
          anchor={{ x: 0.5, y: 0.5 }}
          rotation={0}
        >
          <DriverTaxiIcon />
        </Marker>
      </MapView>

      {/* Center Location Button */}
      <CenterLocationButton
        onPress={handleCenterOnUserLocation}
        disabled={!location}
        style={[styles.centerLocationButton, { top: insets.top + 4 }]}
      />

      {/* Driver Availability Status Indicator - Clickable Toggle */}
      <TouchableOpacity
        style={[
          styles.availabilityStatus,
          isAvailable ? styles.available : styles.unavailable,
          { top: insets.top + 4 },
        ]}
        onPress={handleToggleAvailability}
        disabled={isUpdatingAvailability}
        activeOpacity={0.7}
      >
        {isUpdatingAvailability ? (
          <ActivityIndicator size="small" color={isAvailable ? '#3DD10A' : '#F89C0A'} />
        ) : (
          <>
            <View
              style={[styles.statusDot, isAvailable ? styles.dotAvailable : styles.dotUnavailable]}
            />
            <Text style={styles.statusText}>{isAvailable ? 'Disponible' : 'No Disponible'}</Text>
          </>
        )}
      </TouchableOpacity>

      {/* Digital Wallet Modal */}
      <Modal
        visible={showWallet}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowWallet(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.walletModalContent}>
            <View style={styles.walletHeader}>
              <View>
                <Text style={styles.walletTitle}>Mi Billetera</Text>
                <Text style={styles.walletSubtitle}>Tus ganancias acumuladas</Text>
              </View>
              <TouchableOpacity onPress={() => setShowWallet(false)} style={styles.closeButton}>
                <Ionicons name="close" size={24} color={colors.darkGray} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Balance Cards */}
              <View style={styles.balanceContainer}>
                <View style={[styles.balanceCard, { backgroundColor: '#4CAF50' }]}>
                  <Text style={styles.balanceLabel}>Bolívares (VES)</Text>
                  <Text style={styles.balanceValueText}>Bs. {balanceVES.toFixed(2)}</Text>
                  <View style={styles.balanceIconBg}>
                    <Ionicons name="cash-outline" size={40} color="rgba(255,255,255,0.2)" />
                  </View>
                </View>

                <View style={[styles.balanceCard, { backgroundColor: colors.darkGray }]}>
                  <Text style={styles.balanceLabel}>Dólares (USD)</Text>
                  <Text style={styles.balanceValueText}>$ {balanceUSD.toFixed(2)}</Text>
                  <View style={styles.balanceIconBg}>
                    <Ionicons name="logo-usd" size={40} color="rgba(255,255,255,0.2)" />
                  </View>
                </View>
              </View>

              {/* Transactions History */}
              <View style={styles.historySection}>
                <Text style={styles.historyTitle}>Historial de Ganancias</Text>

                {transactions.length === 0 ? (
                  <View style={styles.emptyHistory}>
                    <Ionicons name="receipt-outline" size={48} color={colors.lightGray} />
                    <Text style={styles.emptyHistoryText}>No tienes transacciones aún</Text>
                  </View>
                ) : (
                  transactions.map(item => (
                    <View key={item.id} style={styles.transactionItem}>
                      <View style={styles.transactionIconBox}>
                        <Ionicons
                          name={item.type === 'credit' ? 'arrow-down-circle' : 'arrow-up-circle'}
                          size={24}
                          color={item.type === 'credit' ? colors.primary : colors.error}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.transactionDesc}>{item.description}</Text>
                        <Text style={styles.transactionDate}>
                          {new Date(item.date).toLocaleDateString()} •{' '}
                          {new Date(item.date).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </Text>
                      </View>
                      <Text
                        style={[
                          styles.transactionAmount,
                          { color: item.type === 'credit' ? colors.primary : colors.error },
                        ]}
                      >
                        {item.type === 'credit' ? '+' : '-'} {item.currency === 'VES' ? 'Bs.' : '$'}{' '}
                        {item.amount.toFixed(2)}
                      </Text>
                    </View>
                  ))
                )}
              </View>
            </ScrollView>

            <TouchableOpacity
              style={styles.withdrawButton}
              onPress={() => showToast('Funcionalidad de retiro próximamente disponible', 'info')}
            >
              <Text style={styles.withdrawButtonText}>Solicitar Retiro</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: colors.darkGray,
  },
  map: {
    flex: 1,
  },
  connectionStatus: {
    position: 'absolute',
    top: 60,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  connected: {
    borderWidth: 1,
    borderColor: colors.primary,
  },
  disconnected: {
    borderWidth: 1,
    borderColor: colors.error,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  dotConnected: {
    backgroundColor: colors.primary,
  },
  dotDisconnected: {
    backgroundColor: colors.error,
  },
  dotAvailable: {
    backgroundColor: '#3DD10A', // Green for available
  },
  dotUnavailable: {
    backgroundColor: '#F89C0A', // Amber for unavailable
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.darkGray,
  },
  availabilityStatus: {
    position: 'absolute',
    // top: 12, // Remove fixed top
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  available: {
    borderWidth: 1,
    borderColor: '#3DD10A',
  },
  unavailable: {
    borderWidth: 1,
    borderColor: '#F89C0A',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  walletModalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    height: '80%',
    padding: 24,
  },
  walletHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  walletTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.darkGray,
  },
  walletSubtitle: {
    fontSize: 14,
    color: colors.mediumGray,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  balanceContainer: {
    gap: 16,
    marginBottom: 32,
  },
  balanceCard: {
    borderRadius: 20,
    padding: 20,
    height: 120,
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  balanceLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  balanceValueText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
  },
  balanceIconBg: {
    position: 'absolute',
    right: -10,
    bottom: -10,
  },
  historySection: {
    flex: 1,
  },
  historyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.darkGray,
    marginBottom: 16,
  },
  emptyHistory: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  emptyHistoryText: {
    color: colors.mediumGray,
    fontSize: 14,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
    gap: 12,
  },
  transactionIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  transactionDesc: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.darkGray,
  },
  transactionDate: {
    fontSize: 12,
    color: colors.mediumGray,
    marginTop: 2,
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: '700',
  },
  withdrawButton: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 20,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  withdrawButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  centerLocationButton: {
    right: 16,
    left: undefined,
    top: undefined,
  },
});
