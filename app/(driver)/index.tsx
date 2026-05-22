import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, StyleSheet, Modal, ScrollView } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
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
import { logError } from '@/utils/errorLogger';
import type { Socket } from 'socket.io-client';
import { DriverTaxiIcon } from '@/src/components/map/markers';
// import { useSmartTutorial } from '@/hooks/useSmartTutorial';
// import { setActiveTutorialScreen } from '@/utils/tutorialState';
// import { useCopilot, walkthroughable, CopilotStep } from 'react-native-copilot';
import CenterLocationButton from '@/components/CenterLocationButton';

// const WalkthroughTouchableOpacity = walkthroughable(TouchableOpacity);
// const WalkthroughCenterLocationButton = walkthroughable(CenterLocationButton);


export default function DriverHomeScreen() {
  const { user, token } = useAuthStore();
  const { isAvailable, isUpdatingAvailability, setIsAvailable, toggleAvailability, balanceVES, balanceUSD, transactions } =
    useDriverStore();
  const { playNotificationSound } = useSound();
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

  useSocketReconnect();

  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [heading, setHeading] = useState<number | null>(null); // Add heading state
  const [loading, setLoading] = useState(true);
  const [socketInstance, setSocketInstance] = useState<Socket | null>(null);
  const [isSocketConnected, setIsSocketConnected] = useState(false);

  // Smart Tutorial state
  // const { start: startTour } = useCopilot();
  // const { isActive: needsTutorial } = useSmartTutorial('driver_home');
  // const tutorialStartedRef = useRef(false);

  useEffect(() => {
    if (false && !loading && location) {
      // Tutorial disabled for first release
    }
  }, [loading, location]);

  // Function to toggle driver availability - now uses the store
  const handleToggleAvailability = async () => {
    await toggleAvailability();
  };

  // Function to center map on driver's current location
  const handleCenterOnUserLocation = () => {
    if (!location) {
      Alert.alert('Error', 'No se pudo obtener tu ubicación actual');
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

  const startLocationUpdates = useCallback(async () => {
    const subscription = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 10 },
      async newLocation => {
        const newCoords = {
          latitude: newLocation.coords.latitude,
          longitude: newLocation.coords.longitude,
        };
        setLocation(newCoords);

        const socket = getSocket();
        if (socket) {
          socket.emit('driver:location_update', {
            driverId: user?.id,
            latitude: newCoords.latitude,
            longitude: newCoords.longitude,
          });
        }
        // Update heading if available
        if (newLocation.coords.heading !== null && newLocation.coords.heading !== undefined) {
          setHeading(newLocation.coords.heading);
        }
      }
    );

    return subscription;
  }, [user?.id, setHeading]);

  const initializeLocation = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permiso Denegado',
          'Se necesita acceso a la ubicación para usar esta función. Por favor habilita los permisos de ubicación en la configuración de tu dispositivo.'
        );
        setLoading(false);
        return;
      }

      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
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

      // Enviar ubicación inicial al servidor
      const socket = getSocket();
      if (socket && user?.id) {
        socket.emit('driver:location_update', {
          driverId: user.id,
          latitude: coords.latitude,
          longitude: coords.longitude,
        });
        console.log('[DRIVER] Initial location sent:', coords);
      }

      // Iniciar actualizaciones de ubicación
      startLocationUpdates();
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

        Alert.alert(
          'Ubicación No Disponible',
          'Los servicios de ubicación están deshabilitados. Se está usando una ubicación de prueba.\n\n' +
            'Para usar tu ubicación real:\n' +
            '1. Ve a Configuración de tu dispositivo\n' +
            '2. Habilita los servicios de ubicación\n' +
            '3. Asegúrate de que esta app tenga permiso de ubicación\n' +
            '4. Reinicia la aplicación',
          [{ text: 'Entendido' }]
        );

        // Send fallback location to server
        const socket = getSocket();
        if (socket && user?.id) {
          socket.emit('driver:location_update', {
            driverId: user.id,
            latitude: fallbackCoords.latitude,
            longitude: fallbackCoords.longitude,
          });
          console.log('[DRIVER] Fallback location sent:', fallbackCoords);
        }
      } else if (errorMessage.includes('timeout')) {
        console.warn('[DRIVER] Location timeout, using fallback location');
        setLocation(fallbackCoords);
        setLoading(false);

        Alert.alert(
          'Tiempo de Espera Agotado',
          'No se pudo obtener tu ubicación. Se está usando una ubicación de prueba.\n\n' +
            'Verifica que:\n' +
            '• Los servicios de ubicación estén habilitados\n' +
            '• Tengas buena señal GPS\n' +
            '• Estés en un lugar con visibilidad al cielo',
          [
            { text: 'Usar Ubicación de Prueba', style: 'cancel' },
            { text: 'Reintentar', onPress: () => initializeLocation() },
          ]
        );

        // Send fallback location to server
        const socket = getSocket();
        if (socket && user?.id) {
          socket.emit('driver:location_update', {
            driverId: user.id,
            latitude: fallbackCoords.latitude,
            longitude: fallbackCoords.longitude,
          });
          console.log('[DRIVER] Fallback location sent:', fallbackCoords);
        }
      } else {
        console.warn('[DRIVER] Location error, using fallback location');
        setLocation(fallbackCoords);
        setLoading(false);

        Alert.alert(
          'Error de Ubicación',
          'No se pudo obtener tu ubicación. Se está usando una ubicación de prueba.\n\n' +
            'Para usar tu ubicación real, verifica que los servicios de ubicación estén habilitados.',
          [
            { text: 'Usar Ubicación de Prueba', style: 'cancel' },
            { text: 'Reintentar', onPress: () => initializeLocation() },
          ]
        );

        // Send fallback location to server
        const socket = getSocket();
        if (socket && user?.id) {
          socket.emit('driver:location_update', {
            driverId: user.id,
            latitude: fallbackCoords.latitude,
            longitude: fallbackCoords.longitude,
          });
          console.log('[DRIVER] Fallback location sent:', fallbackCoords);
        }
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

      // Verify component is still mounted
      if (!isMountedRef.current) {
        console.warn('[DRIVER] ⚠️ Component unmounted, skipping cancellation handling');
        return;
      }

      // Play notification sound
      playNotificationSound();

      // Build cancellation message
      let message = `El pasajero ha cancelado el viaje`;

      if (data.cancellationReason) {
        message += `\n\nMotivo: ${data.cancellationReason}`;
      }

      // Add compensation information if applicable
      if (data.cancellationFee > 0) {
        message += `\n\nCompensación recibida: Bs. ${data.cancellationFee.toFixed(2)}`;
      }

      // Show alert to driver
      Alert.alert('Viaje Cancelado', message, [{ text: 'Entendido', style: 'default' }]);
    },
    [playNotificationSound]
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
    []
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

      // Add connection status listeners for debugging (store refs for targeted cleanup)
      connectHandlerRef.current = () => {
        console.log('[DRIVER] ========================================');
        console.log('[DRIVER] ✅ SOCKET CONNECTED EVENT');
        console.log('[DRIVER]    Socket ID:', socket.id);
        console.log('[DRIVER]    Timestamp:', new Date().toISOString());
        console.log('[DRIVER] ========================================');
      };
      socket.on('connect', connectHandlerRef.current);

      disconnectHandlerRef.current = (reason: string) => {
        console.log('[DRIVER] ========================================');
        console.log('[DRIVER] ❌ SOCKET DISCONNECTED EVENT');
        console.log('[DRIVER]    Reason:', reason);
        console.log('[DRIVER]    Socket ID:', socket.id);
        console.log('[DRIVER]    Timestamp:', new Date().toISOString());
        console.log('[DRIVER] ========================================');
      };
      socket.on('disconnect', disconnectHandlerRef.current);

      errorHandlerRef.current = (error: any) => {
        console.error('[DRIVER] ========================================');
        console.error('[DRIVER] ❌ SOCKET ERROR EVENT');
        console.error('[DRIVER]    Socket ID:', socket.id);
        console.error('[DRIVER]    Error Message:', error?.message || error);
        console.error('[DRIVER]    Error Details:', JSON.stringify(error, null, 2));
        console.error('[DRIVER]    Timestamp:', new Date().toISOString());
        console.error('[DRIVER] ========================================');
      };
      socket.on('error', errorHandlerRef.current);

      console.log('[DRIVER] ========================================');
      console.log('[DRIVER] ✅ LISTENERS REGISTERED (Local)');
      console.log('[DRIVER]    - ride:cancelled (local - via onRideCancelled helper)');
      console.log(
        '[DRIVER]    - driver:availability_changed (local - via onDriverAvailabilityChanged helper)'
      );
      console.log('[DRIVER]    - connect');
      console.log('[DRIVER]    - disconnect');
      console.log('[DRIVER]    - error');
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

      const socket = await connectSocket(token);

      console.log('[DRIVER] ========================================');
      console.log('[DRIVER] ✅ SOCKET CONNECTED');
      console.log('[DRIVER]    Socket ID:', socket.id);
      console.log('[DRIVER]    Connected:', socket.connected);
      console.log('[DRIVER] ========================================');

      // Update socket instance state AFTER connection
      setSocketInstance(socket);

      // Setup listeners initially with fresh callback references
      setupSocketListeners(socket);

      // Re-setup listeners on reconnection with fresh callback references
      reconnectHandlerRef.current = () => {
        console.log('[DRIVER] ========================================');
        console.log('[DRIVER] 🔄 SOCKET RECONNECTED');
        console.log('[DRIVER]    Socket ID:', socket.id);
        console.log('[DRIVER]    Re-registering listeners with fresh callbacks...');
        console.log('[DRIVER] ========================================');
        localListenersRegisteredRef.current = false; // Allow re-registration
        setSocketInstance(socket); // Update state on reconnect
        setupSocketListeners(socket); // Re-register with fresh callbacks
      };
      socket.on('connect', reconnectHandlerRef.current);

      // Update state on disconnect
      disconnectLogHandlerRef.current = (reason: string) => {
        console.log('[DRIVER] ========================================');
        console.log('[DRIVER] ❌ SOCKET DISCONNECTED');
        console.log('[DRIVER]    Reason:', reason);
        console.log('[DRIVER]    Socket ID:', socket.id);
        console.log('[DRIVER] ========================================');
        setSocketInstance(socket); // Trigger re-render to show disconnected state
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
  }, [user, token, setupSocketListeners]);

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
        if (connectHandlerRef.current) {
          socket.off('connect', connectHandlerRef.current);
        }
        if (disconnectHandlerRef.current) {
          socket.off('disconnect', disconnectHandlerRef.current);
        }
        if (errorHandlerRef.current) {
          socket.off('error', errorHandlerRef.current);
        }
      }
      // Don't disconnect socket here - keep it alive for the session
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, token]);

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
        initialRegion={{
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
        showsUserLocation={false}
        showsMyLocationButton={false}
        scrollEnabled={true}
        zoomEnabled={true}
        rotateEnabled={true}
        pitchEnabled={true}
        toolbarEnabled={false}
        moveOnMarkerPress={false}
      >
        <Marker
          coordinate={{
            latitude: location.latitude,
            longitude: location.longitude,
          }}
          title="Mi ubicación"
          anchor={{ x: 0.5, y: 0.5 }}
          flat={false}
          rotation={heading || 0}
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
          { top: insets.top + 4 }
        ]}
        onPress={handleToggleAvailability}
        disabled={isUpdatingAvailability}
        activeOpacity={0.7}
      >
        {isUpdatingAvailability ? (
          <ActivityIndicator size="small" color={isAvailable ? '#10B981' : '#F59E0B'} />
        ) : (
          <>
            <View
              style={[
                styles.statusDot,
                isAvailable ? styles.dotAvailable : styles.dotUnavailable,
              ]}
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
              <TouchableOpacity 
                onPress={() => setShowWallet(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color={colors.darkGray} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Balance Cards */}
              <View style={styles.balanceContainer}>
                <View style={[styles.balanceCard, { backgroundColor: colors.primary }]}>
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
                  transactions.map((item) => (
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
                          {new Date(item.date).toLocaleDateString()} • {new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      </View>
                      <Text style={[
                        styles.transactionAmount,
                        { color: item.type === 'credit' ? colors.primary : colors.error }
                      ]}>
                        {item.type === 'credit' ? '+' : '-'} {item.currency === 'VES' ? 'Bs.' : '$'} {item.amount.toFixed(2)}
                      </Text>
                    </View>
                  ))
                )}
              </View>
            </ScrollView>
            
            <TouchableOpacity 
              style={styles.withdrawButton}
              onPress={() => Alert.alert('Retiro', 'Funcionalidad de retiro próximamente disponible')}
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
    backgroundColor: '#10B981', // Green for available
  },
  dotUnavailable: {
    backgroundColor: '#F59E0B', // Amber for unavailable
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
    borderColor: '#10B981',
  },
  unavailable: {
    borderWidth: 1,
    borderColor: '#F59E0B',
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

