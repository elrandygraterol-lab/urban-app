import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Platform } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import { useRoute } from '@react-navigation/native';
import Constants from 'expo-constants';
import { api } from '@/services/api';
import { socket } from '@/services/socket';
import { Colors as colors } from '@/constants/theme';

interface Ride {
  id: string;
  status: 'accepted' | 'arrived' | 'in_progress' | 'completed';
  passengerName: string;
  passengerPhone: string;
  pickupAddress: string;
  destinationAddress: string;
  pickupLocation: { latitude: number; longitude: number };
  destinationLocation: { latitude: number; longitude: number };
  estimatedFare: number;
  actualDistance?: number;
  actualDuration?: number;
}

export default function ActiveRideScreen() {
  const route = useRoute();
  const rideId = (route.params as any)?.rideId;
  const mapRef = useRef<MapView>(null);
  const [ride, setRide] = useState<Ride | null>(null);
  const [loading, setLoading] = useState(true);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [route_coords, setRouteCoords] = useState<any[]>([]);

  useEffect(() => {
    fetchRide();
    initializeLocation();
    setupSocketListeners();
  }, [rideId]);

  const fetchRide = async () => {
    try {
      const response = await api.get(`/api/rides/${rideId}`);
      setRide(response.data);
    } catch (error) {
      Alert.alert('Error', 'Failed to load ride details');
    } finally {
      setLoading(false);
    }
  };

  const initializeLocation = async () => {
    try {
      const currentLocation = await Location.getCurrentPositionAsync({});
      setLocation({
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
      });
    } catch (error) {
      console.error('Failed to get location:', error);
    }
  };

  const setupSocketListeners = () => {
    socket.on('ride:status_changed', (data) => {
      if (data.rideId === rideId) {
        setRide((prev) => prev ? { ...prev, status: data.status } : null);
      }
    });
  };

  const updateRideStatus = async (newStatus: string) => {
    try {
      const endpoint =
        newStatus === 'arrived'
          ? `/api/rides/${rideId}/arrive`
          : newStatus === 'in_progress'
          ? `/api/rides/${rideId}/start`
          : `/api/rides/${rideId}/complete`;

      await api.post(endpoint);
      fetchRide();
    } catch (error) {
      Alert.alert('Error', `Failed to update ride status to ${newStatus}`);
    }
  };

  if (loading || !ride) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const targetLocation =
    ride.status === 'accepted' || ride.status === 'arrived'
      ? ride.pickupLocation
      : ride.destinationLocation;

  // Check if running in Expo Go
  const isExpoGo = Constants.appOwnership === 'expo';

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      {isExpoGo ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5', padding: 20 }}>
          <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.darkGray, marginBottom: 12, textAlign: 'center' }}>
            🗺️ Mapa no disponible en Expo Go
          </Text>
          <Text style={{ fontSize: 14, color: colors.lightGray, textAlign: 'center', marginBottom: 8 }}>
            react-native-maps requiere un Development Build
          </Text>
          <Text style={{ fontSize: 12, color: colors.lightGray, textAlign: 'center' }}>
            Ejecuta: npx expo run:android
          </Text>
        </View>
      ) : (
        <MapView
          ref={mapRef}
          style={{ flex: 1 }}
          initialRegion={{
            latitude: targetLocation.latitude,
            longitude: targetLocation.longitude,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}
        >
          {location && (
            <Marker
              coordinate={location}
              title="Your Location"
              pinColor={colors.primary}
            />
          )}
          <Marker
            coordinate={ride.pickupLocation}
            title="Pickup"
            pinColor="green"
          />
          <Marker
            coordinate={ride.destinationLocation}
            title="Destination"
            pinColor="red"
          />
          {route_coords.length > 0 && (
            <Polyline
              coordinates={route_coords}
              strokeColor={colors.primary}
              strokeWidth={3}
            />
          )}
        </MapView>
      )}

      {/* Ride Info Card */}
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: '#fff',
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          padding: 16,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          elevation: 3,
        }}
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.darkGray, marginBottom: 12 }}>
            {ride.status === 'accepted' || ride.status === 'arrived'
              ? 'Going to Pickup'
              : 'En Route to Destination'}
          </Text>

          {/* Passenger Info */}
          <View style={{ marginBottom: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#E0E0E0' }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.darkGray, marginBottom: 4 }}>
              Passenger: {ride.passengerName}
            </Text>
            <Text style={{ fontSize: 14, color: colors.lightGray }}>
              Phone: {ride.passengerPhone}
            </Text>
          </View>

          {/* Location Info */}
          <View style={{ marginBottom: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#E0E0E0' }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.lightGray, marginBottom: 4 }}>
              PICKUP
            </Text>
            <Text style={{ fontSize: 14, color: colors.darkGray, marginBottom: 12 }}>
              {ride.pickupAddress}
            </Text>

            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.lightGray, marginBottom: 4 }}>
              DESTINATION
            </Text>
            <Text style={{ fontSize: 14, color: colors.darkGray }}>
              {ride.destinationAddress}
            </Text>
          </View>

          {/* Fare Info */}
          <View style={{ marginBottom: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#E0E0E0' }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.primary }}>
              Estimated Fare: ${ride.estimatedFare.toFixed(2)}
            </Text>
          </View>

          {/* Action Buttons */}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {ride.status === 'accepted' && (
              <TouchableOpacity
                onPress={() => updateRideStatus('arrived')}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 8,
                  backgroundColor: colors.primary,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '600' }}>I've Arrived</Text>
              </TouchableOpacity>
            )}

            {ride.status === 'arrived' && (
              <TouchableOpacity
                onPress={() => updateRideStatus('in_progress')}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 8,
                  backgroundColor: colors.primary,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '600' }}>Start Trip</Text>
              </TouchableOpacity>
            )}

            {ride.status === 'in_progress' && (
              <TouchableOpacity
                onPress={() => updateRideStatus('completed')}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 8,
                  backgroundColor: colors.primary,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '600' }}>Complete Trip</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={{
                flex: 1,
                paddingVertical: 12,
                borderRadius: 8,
                backgroundColor: colors.orange,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '600' }}>Call</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}
