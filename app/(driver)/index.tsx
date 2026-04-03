import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { useDriverStore } from '@/store/driverStore';
import { rideAPI } from '@/services/api';
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

interface RideRequest {
  id: string;
  passengerName: string;
  pickupAddress: string;
  destinationAddress: string;
  estimatedFare: number;
  distance: number;
  expiresAt: string;
}

export default function DriverHomeScreen() {
  const { user, token } = useAuthStore();
  const { isAvailable, isUpdatingAvailability, setIsAvailable, toggleAvailability } = useDriverStore();
  const { playNotificationSound } = useSound();
  const router = useRouter();
  const mapRef = useRef<MapView>(null);
  const isMountedRef = useRef(true);
  const cleanupRideCancelledRef = useRef<(() => void) | null>(null);
  const cleanupAvailabilityChangedRef = useRef<(() => void) | null>(null);

  useSocketReconnect();

  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [rideRequest, setRideRequest] = useState<RideRequest | null>(null);
  const [requestTimeout, setRequestTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [socketInstance, setSocketInstance] = useState<Socket | null>(null);
  const [isSocketConnected, setIsSocketConnected] = useState(false);

  // Function to toggle driver availability - now uses the store
  const handleToggleAvailability = async () => {
    await toggleAvailability();
  };

  // Memoized callback for handling ride requests with fresh state references
  const handleRideRequest = useCallback(
    (data: RideRequest) => {
      console.log('[DRIVER] ========================================');
      console.log('[DRIVER] 🚗 RIDE REQUEST RECEIVED!');
      console.log('[DRIVER]    Ride ID:', data.id);
      console.log('[DRIVER]    Passenger:', data.passengerName);
      console.log('[DRIVER]    Pickup:', data.pickupAddress);
      console.log('[DRIVER]    Destination:', data.destinationAddress);
      console.log('[DRIVER]    Fare:', data.estimatedFare);
      console.log('[DRIVER]    Distance:', data.distance);
      console.log('[DRIVER]    Expires:', data.expiresAt);
      console.log('[DRIVER]    Timestamp:', new Date().toISOString());
      console.log('[DRIVER]    Component Mounted:', isMountedRef.current);
      console.log('[DRIVER] ========================================');

      // Verify component is still mounted before updating state
      if (!isMountedRef.current) {
        console.warn('[DRIVER] ⚠️ Component unmounted, skipping state update');
        return;
      }

      // Play notification sound
      playNotificationSound();

      // Use functional state update to guarantee React detects the change
      setRideRequest(prev => {
        console.log('[DRIVER] 📝 State update: prev =', prev, ', new =', data);
        return data;
      });

      const timeout = setTimeout(() => {
        console.log('[DRIVER] ⏰ Ride request timeout expired for:', data.id);
        if (isMountedRef.current) {
          setRideRequest(null);
        }
      }, 30000);
      setRequestTimeout(timeout);
    },
    [playNotificationSound]
  );

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
      }
    );

    return subscription;
  }, [user?.id]);

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
        timeout: 10000, // 10 second timeout
      });
      const coords = {
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
      };
      setLocation(coords);
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
      console.error('Failed to get location:', error);
      logError('DriverHomeScreen', error, { context: 'Getting location' });

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

      // Clear any active ride request if it matches
      if (rideRequest?.id === data.rideId) {
        setRideRequest(null);
        if (requestTimeout) clearTimeout(requestTimeout);
      }

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
      Alert.alert(
        'Viaje Cancelado',
        message,
        [{ text: 'Entendido', style: 'default' }]
      );
    },
    [playNotificationSound, rideRequest, requestTimeout]
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

      console.log('[DRIVER] ========================================');
      console.log('[DRIVER] 🎧 SETTING UP SOCKET LISTENERS');
      console.log('[DRIVER]    Socket ID:', socket.id);
      console.log('[DRIVER]    Socket connected:', socket.connected);
      console.log('[DRIVER]    User ID:', user?.id);
      console.log('[DRIVER]    User Role:', user?.role);
      console.log('[DRIVER] ========================================');

      // Remove existing listeners first to avoid duplicates
      socket.off('ride:request_created');
      socket.off('ride:cancelled');
      socket.off('driver:availability_changed');
      socket.off('connect');
      socket.off('disconnect');
      socket.off('error');

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

      // Register ride request listener with memoized callback
      socket.on('ride:request_created', handleRideRequest);

      // Register ride cancelled listener using imported helper function
      // Store the cleanup function returned by onRideCancelled
      cleanupRideCancelledRef.current = onRideCancelled(handleRideCancelled);

      // Register driver availability changed listener
      // Store the cleanup function returned by onDriverAvailabilityChanged
      cleanupAvailabilityChangedRef.current = onDriverAvailabilityChanged(handleAvailabilityChanged);

      // Register driver availability changed listener
      // Store the cleanup function returned by onDriverAvailabilityChanged
      cleanupAvailabilityChangedRef.current = onDriverAvailabilityChanged(handleAvailabilityChanged);

      // Evento 'ride:payment_completed' ahora se maneja globalmente en useGlobalSocketListeners

      // Add connection status listeners for debugging
      socket.on('connect', () => {
        console.log('[DRIVER] ========================================');
        console.log('[DRIVER] ✅ SOCKET CONNECTED EVENT');
        console.log('[DRIVER]    Socket ID:', socket.id);
        console.log('[DRIVER]    Timestamp:', new Date().toISOString());
        console.log('[DRIVER] ========================================');
      });

      socket.on('disconnect', reason => {
        console.log('[DRIVER] ========================================');
        console.log('[DRIVER] ❌ SOCKET DISCONNECTED EVENT');
        console.log('[DRIVER]    Reason:', reason);
        console.log('[DRIVER]    Socket ID:', socket.id);
        console.log('[DRIVER]    Timestamp:', new Date().toISOString());
        console.log('[DRIVER] ========================================');
      });

      socket.on('error', (error: any) => {
        console.error('[DRIVER] ========================================');
        console.error('[DRIVER] ❌ SOCKET ERROR EVENT');
        console.error('[DRIVER]    Socket ID:', socket.id);
        console.error('[DRIVER]    Error Message:', error?.message || error);
        console.error('[DRIVER]    Error Details:', JSON.stringify(error, null, 2));
        console.error('[DRIVER]    Timestamp:', new Date().toISOString());
        console.error('[DRIVER] ========================================');
      });

      console.log('[DRIVER] ========================================');
      console.log('[DRIVER] ✅ LISTENERS REGISTERED (Local)');
      console.log('[DRIVER]    - ride:request_created (local)');
      console.log('[DRIVER]    - ride:cancelled (local - via onRideCancelled helper)');
      console.log('[DRIVER]    - driver:availability_changed (local - via onDriverAvailabilityChanged helper)');
      console.log('[DRIVER]    - connect');
      console.log('[DRIVER]    - disconnect');
      console.log('[DRIVER]    - error');
      console.log('[DRIVER]    Note: ride:payment_completed handled globally');
      console.log('[DRIVER] ========================================');
    },
    [handleRideRequest, handleRideCancelled, handleAvailabilityChanged, user?.id, user?.role]
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
      socket.on('connect', () => {
        console.log('[DRIVER] ========================================');
        console.log('[DRIVER] 🔄 SOCKET RECONNECTED');
        console.log('[DRIVER]    Socket ID:', socket.id);
        console.log('[DRIVER]    Re-registering listeners with fresh callbacks...');
        console.log('[DRIVER] ========================================');
        setSocketInstance(socket); // Update state on reconnect
        setupSocketListeners(socket); // Re-register with fresh callbacks
      });

      // Update state on disconnect
      socket.on('disconnect', reason => {
        console.log('[DRIVER] ========================================');
        console.log('[DRIVER] ❌ SOCKET DISCONNECTED');
        console.log('[DRIVER]    Reason:', reason);
        console.log('[DRIVER]    Socket ID:', socket.id);
        console.log('[DRIVER] ========================================');
        setSocketInstance(socket); // Trigger re-render to show disconnected state
      });

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
        if (driverProfile.data && driverProfile.data.isAvailable !== undefined) {
          setIsAvailable(driverProfile.data.isAvailable);
          console.log('[DRIVER] Loaded availability status:', driverProfile.data.isAvailable);
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

      if (requestTimeout) clearTimeout(requestTimeout);
      
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
      
      const socket = getSocket();
      if (socket) {
        socket.off('ride:request_created');
        socket.off('connect');
        socket.off('disconnect');
        socket.off('error');
      }
      // Don't disconnect socket here - keep it alive for the session
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, token]);

  const acceptRide = async () => {
    if (!rideRequest) return;

    try {
      await rideAPI.acceptRide(rideRequest.id);
      const acceptedRideId = rideRequest.id;
      setRideRequest(null);
      if (requestTimeout) clearTimeout(requestTimeout);

      // Play notification sound when accepting ride
      playNotificationSound();

      // Join ride room immediately after accepting to receive payment notifications
      const socket = getSocket();
      if (socket) {
        console.log('[DRIVER] 🔌 Joining ride room immediately after accept:', `ride:${acceptedRideId}`);
        socket.emit('join_ride', { rideId: acceptedRideId });
      } else {
        console.warn('[DRIVER] ⚠️ Socket not available to join ride room');
      }

      Alert.alert('Éxito', '¡Viaje aceptado!');
      // Pass the rideId as a parameter to the active-ride screen
      router.push({
        pathname: '/(driver)/active-ride',
        params: { rideId: acceptedRideId },
      } as any);
    } catch (error) {
      console.error('Accept ride error:', error);
      logError('DriverHomeScreen', error, { context: 'Accept ride' });
      // Don't show technical error to user
    }
  };

  const rejectRide = () => {
    setRideRequest(null);
    if (requestTimeout) clearTimeout(requestTimeout);
  };

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
      {/* Map */}
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={{
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        rotateEnabled={true}
        pitchEnabled={true}
        showsBuildings={true}
      >
        <Marker coordinate={location} title="Tu Ubicación" pinColor="#808080" />
      </MapView>

      {/* Driver Availability Status Indicator - Clickable Toggle */}
      <TouchableOpacity
        style={[
          styles.availabilityStatus,
          isAvailable ? styles.available : styles.unavailable,
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

      {/* Ride Request Card */}
      {rideRequest && (
        <View style={styles.rideRequestCard}>
          <View style={styles.requestHeader}>
            <Ionicons name="notifications" size={28} color={colors.primary} />
            <Text style={styles.requestTitle}>Nueva Solicitud de Viaje</Text>
          </View>

          <View style={styles.requestDetails}>
            <View style={styles.requestRow}>
              <Ionicons name="person-outline" size={20} color={colors.darkGray} />
              <Text style={styles.requestText}>{rideRequest.passengerName}</Text>
            </View>

            <View style={styles.requestRow}>
              <Ionicons name="location-outline" size={20} color={colors.primary} />
              <Text style={styles.requestText}>{rideRequest.pickupAddress}</Text>
            </View>

            <View style={styles.requestRow}>
              <Ionicons name="flag-outline" size={20} color={colors.orange} />
              <Text style={styles.requestText}>{rideRequest.destinationAddress}</Text>
            </View>

            <View style={styles.fareRow}>
              <View style={styles.fareItem}>
                <Text style={styles.fareLabel}>Tarifa</Text>
                <Text style={styles.fareValue}>Bs. {rideRequest.estimatedFare.toFixed(2)}</Text>
              </View>
              <View style={styles.fareItem}>
                <Text style={styles.fareLabel}>Distancia</Text>
                <Text style={styles.fareValue}>{rideRequest.distance.toFixed(1)} km</Text>
              </View>
            </View>
          </View>

          <View style={styles.requestActions}>
            <TouchableOpacity
              onPress={rejectRide}
              style={[styles.requestButton, styles.rejectButton]}
            >
              <Text style={styles.rejectButtonText}>Rechazar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={acceptRide}
              style={[styles.requestButton, styles.acceptButton]}
            >
              <Text style={styles.acceptButtonText}>Aceptar</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
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
  rideRequestCard: {
    position: 'absolute',
    bottom: 100,
    left: 16,
    right: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  requestHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  requestTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.darkGray,
  },
  requestDetails: {
    marginBottom: 16,
  },
  requestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  requestText: {
    flex: 1,
    fontSize: 14,
    color: colors.darkGray,
  },
  fareRow: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 16,
  },
  fareItem: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  fareLabel: {
    fontSize: 12,
    color: colors.mediumGray,
  },
  fareValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.primary,
    marginTop: 4,
  },
  requestActions: {
    flexDirection: 'row',
    gap: 12,
  },
  requestButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  rejectButton: {
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.orange,
  },
  rejectButtonText: {
    color: colors.orange,
    fontSize: 16,
    fontWeight: '600',
  },
  acceptButton: {
    backgroundColor: colors.primary,
  },
  acceptButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
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
    top: 50, // Moved higher up
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
  available: {
    borderWidth: 1,
    borderColor: '#10B981',
  },
  unavailable: {
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
});
