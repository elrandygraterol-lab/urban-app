import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Switch, ActivityIndicator, Alert } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { useAuthStore } from '@/store/authStore';
import { api } from '@/services/api';
import { connectSocket, getSocket, disconnectSocket } from '@/services/socket';
import { Colors as colors } from '@/constants/theme';
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
  const mapRef = useRef<MapView>(null);
  const [isAvailable, setIsAvailable] = useState(false);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [rideRequest, setRideRequest] = useState<RideRequest | null>(null);
  const [requestTimeout, setRequestTimeout] = useState<NodeJS.Timeout | null>(null);
  const [socketInstance, setSocketInstance] = useState<Socket | null>(null);

  useEffect(() => {
    initializeLocation();
    // Only initialize socket if user and token exist
    if (user && token) {
      initializeSocket();
    }
    return () => {
      if (requestTimeout) clearTimeout(requestTimeout);
      const socket = getSocket();
      if (socket) {
        socket.off('ride:request_created');
      }
      disconnectSocket();
    };
  }, [user, token]); // Depend on user AND token

  useEffect(() => {
    if (isAvailable && location) {
      startLocationUpdates();
    }
  }, [isAvailable]);

  const initializeSocket = async () => {
    // Only connect socket if user is authenticated and token exists
    if (!user || !token) {
      console.log('[DRIVER] User not authenticated or no token, skipping socket connection');
      return;
    }

    try {
      console.log('[DRIVER] Connecting socket with token...');
      // Pass token directly to avoid race condition with SecureStore
      const socket = await connectSocket(token);
      setSocketInstance(socket);
      setupSocketListeners(socket);
      console.log('[DRIVER] ✅ Socket connected successfully');
    } catch (error) {
      console.error('[DRIVER] Socket connection failed:', error.message);
      // Socket connection is optional, app can still work without it
    }
  };

  const initializeLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required');
        return;
      }

      const currentLocation = await Location.getCurrentPositionAsync({});
      setLocation({
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
      });
      setLoading(false);
    } catch (error) {
      Alert.alert('Error', 'Failed to get location');
      setLoading(false);
    }
  };

  const startLocationUpdates = async () => {
    const subscription = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 10 },
      async (newLocation) => {
        const newCoords = {
          latitude: newLocation.coords.latitude,
          longitude: newLocation.coords.longitude,
        };
        setLocation(newCoords);

        // Send location to backend via WebSocket
        const socket = getSocket();
        if (socket) {
          socket.emit('driver:location_update', {
            driverId: user?.id,
            latitude: newCoords.latitude,
            longitude: newCoords.longitude,
          });
        }

        // Update location in database
        try {
          await api.put(`/api/drivers/location`, {
            latitude: newCoords.latitude,
            longitude: newCoords.longitude,
          });
        } catch (error) {
          console.error('Failed to update location:', error);
        }
      }
    );

    return subscription;
  };

  const setupSocketListeners = (socket: Socket) => {
    if (!socket) {
      console.warn('Socket not available, skipping listeners setup');
      return;
    }

    socket.on('ride:request_created', (data: RideRequest) => {
      setRideRequest(data);

      // Set 30-second timeout
      const timeout = setTimeout(() => {
        setRideRequest(null);
      }, 30000);
      setRequestTimeout(timeout);
    });
  };

  const toggleAvailability = async () => {
    try {
      const newStatus = !isAvailable;
      await api.put('/api/drivers/availability', { isAvailable: newStatus });
      setIsAvailable(newStatus);

      const socket = getSocket();
      if (socket) {
        socket.emit('driver:availability_changed', {
          driverId: user?.id,
          isAvailable: newStatus,
        });
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update availability');
    }
  };

  const acceptRide = async () => {
    if (!rideRequest) return;

    try {
      await api.post(`/api/rides/${rideRequest.id}/accept`);
      setRideRequest(null);
      if (requestTimeout) clearTimeout(requestTimeout);
      Alert.alert('Success', 'Ride accepted!');
    } catch (error) {
      Alert.alert('Error', 'Failed to accept ride');
    }
  };

  const rejectRide = () => {
    setRideRequest(null);
    if (requestTimeout) clearTimeout(requestTimeout);
  };

  if (loading || !location) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <MapView
        ref={mapRef}
        style={{ flex: 1 }}
        initialRegion={{
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
      >
        <Marker
          coordinate={location}
          title="Your Location"
          pinColor={colors.primary}
        />
      </MapView>

      {/* Availability Toggle */}
      <View
        style={{
          position: 'absolute',
          top: 16,
          right: 16,
          backgroundColor: '#fff',
          borderRadius: 12,
          padding: 12,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          elevation: 3,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontWeight: '600', color: colors.darkGray }}>
            {isAvailable ? 'Online' : 'Offline'}
          </Text>
          <Switch
            value={isAvailable}
            onValueChange={toggleAvailability}
            trackColor={{ false: '#ccc', true: colors.primary }}
            thumbColor={isAvailable ? colors.primary : '#f4f3f4'}
          />
        </View>
      </View>

      {/* Ride Request Card */}
      {rideRequest && (
        <View
          style={{
            position: 'absolute',
            bottom: 16,
            left: 16,
            right: 16,
            backgroundColor: '#fff',
            borderRadius: 12,
            padding: 16,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 3,
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.darkGray, marginBottom: 8 }}>
            New Ride Request
          </Text>
          <Text style={{ fontSize: 14, color: colors.darkGray, marginBottom: 4 }}>
            From: {rideRequest.pickupAddress}
          </Text>
          <Text style={{ fontSize: 14, color: colors.darkGray, marginBottom: 4 }}>
            To: {rideRequest.destinationAddress}
          </Text>
          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.primary, marginBottom: 12 }}>
            Fare: ${rideRequest.estimatedFare.toFixed(2)} • {rideRequest.distance.toFixed(1)} km
          </Text>

          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              onPress={rejectRide}
              style={{
                flex: 1,
                paddingVertical: 12,
                borderRadius: 8,
                backgroundColor: colors.orange,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '600' }}>Reject</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={acceptRide}
              style={{
                flex: 1,
                paddingVertical: 12,
                borderRadius: 8,
                backgroundColor: colors.primary,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '600' }}>Accept</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}
