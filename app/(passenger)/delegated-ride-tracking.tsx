/**
 * Delegated Ride Tracking Screen
 *
 * Allows the requester (registered passenger who paid) to track a delegated ride in real-time.
 * Shows ride status, driver location, and beneficiary information.
 *
 * Requirements: 9.10
 * Task: 14.5.3
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Linking } from 'react-native';
import { useUnifiedNotifications } from '@/context/UnifiedNotificationContext';
import { useLocalSearchParams, useRouter } from 'expo-router';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DriverTaxiIcon, PickupIcon, DropoffIcon } from '@/src/components/map/markers';
import { useAuthStore } from '@/store/authStore';
import { rideAPI } from '@/services/api';
import {
  connectSocket,
  joinRide,
  leaveRide,
  onRideStatusChanged,
  onDriverLocationUpdate,
  onETAUpdate,
  onRideCompleted,
  onRideCancelled,
  removeAllListeners,
} from '@/services/socket';
import { logInfo, logError } from '@/utils/errorLogger';
import { formatCurrency, Currency } from '@/utils/currency';
import { Colors, Spacing } from '@/constants/theme';
import { useSocketReconnect } from '@/hooks/useSocketReconnect';

interface LocationCoords {
  latitude: number;
  longitude: number;
}

interface DriverInfo {
  id: string;
  name: string;
  phone: string;
  rating: number;
  vehicleInfo?: {
    type: string;
    model: string;
    licensePlate: string;
    color: string;
  };
  currentLocation?: LocationCoords;
}

interface DelegatedRideData {
  id: string;
  status: 'pending' | 'accepted' | 'arrived' | 'in_progress' | 'completed' | 'cancelled';
  beneficiaryName: string;
  beneficiaryPhone: string;
  pickup: {
    latitude: number;
    longitude: number;
    address: string;
  };
  destination: {
    latitude: number;
    longitude: number;
    address: string;
  };
  estimatedFare?: number;
  finalFare?: number;
  currency?: Currency;
  driver?: DriverInfo;
  eta?: {
    estimatedMinutes: number;
    distanceKm: number;
  };
}

export default function DelegatedRideTrackingScreen() {
  const { id: rideId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user, token } = useAuthStore();
  const mapRef = useRef<MapView>(null);
  const insets = useSafeAreaInsets();
  const { showToast, showStatus, dismissStatus } = useUnifiedNotifications();

  // Enable automatic socket reconnection
  useSocketReconnect();

  // State
  const [loading, setLoading] = useState(true);
  const [rideData, setRideData] = useState<DelegatedRideData | null>(null);
  const [driverLocation, setDriverLocation] = useState<LocationCoords | null>(null);
  const [isSocketConnected, setIsSocketConnected] = useState(false);

  // Load ride data
  const loadRideData = useCallback(async () => {
    if (!rideId || !token) {
      logError('DelegatedRideTracking', new Error('Missing rideId or token'));
      showToast('No se pudo cargar la información del viaje', 'error');
      router.back();
      return;
    }

    try {
      setLoading(true);
      logInfo('DelegatedRideTracking', 'Loading delegated ride data', { rideId });

      const response = await rideAPI.trackDelegatedRide(rideId);

      if (response.data.success && response.data.data) {
        const data = response.data.data;

        setRideData({
          id: data.rideId,
          status: data.status,
          beneficiaryName: data.beneficiaryName,
          beneficiaryPhone: data.beneficiaryPhone,
          pickup: data.pickup,
          destination: data.destination,
          estimatedFare: data.estimatedFare,
          finalFare: data.finalFare,
          currency: data.currency,
          driver: data.driver,
          eta: data.eta,
        });

        // Set initial driver location if available
        if (data.driver?.location) {
          setDriverLocation(data.driver.location);
        }

        // Fit map to show all markers
        if (mapRef.current) {
          const coordinates = [data.pickup, data.destination];

          if (data.driver?.location) {
            coordinates.push(data.driver.location);
          }

          mapRef.current.fitToCoordinates(coordinates, {
            edgePadding: { top: 100, right: 50, bottom: 300, left: 50 },
            animated: true,
          });
        }

        logInfo('DelegatedRideTracking', 'Ride data loaded successfully', { status: data.status });
      } else {
        throw new Error('Invalid response format');
      }
    } catch (error: any) {
      logError('DelegatedRideTracking', error, { context: 'Loading ride data' });

      const errorMessage =
        error.response?.data?.error?.message || error.message || 'Error desconocido';

      showToast(`No se pudo cargar la información del viaje: ${errorMessage}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [rideId, token, router, showToast]);

  // Setup WebSocket connection and listeners
  useEffect(() => {
    if (!user || !token || !rideId) {
      return;
    }

    let mounted = true;

    const setupSocket = async () => {
      try {
        logInfo('DelegatedRideTracking', 'Connecting socket...');
        await connectSocket(token);

        if (mounted) {
          setIsSocketConnected(true);
          logInfo('DelegatedRideTracking', 'Socket connected, joining ride room');
          joinRide(rideId);
        }
      } catch (error) {
        logError('DelegatedRideTracking', error as Error, { context: 'Socket connection' });
        if (mounted) {
          setIsSocketConnected(false);
        }
      }
    };

    setupSocket();

    return () => {
      mounted = false;
      if (rideId) {
        leaveRide(rideId);
      }
      removeAllListeners();
    };
  }, [user, token, rideId]);

  // Setup ride event listeners
  useEffect(() => {
    if (!rideId || !isSocketConnected) {
      return;
    }

    logInfo('DelegatedRideTracking', 'Setting up ride event listeners');

    // Listen for ride status changes
    const handleRideStatusChanged = (data: any) => {
      logInfo('DelegatedRideTracking', 'Ride status changed', { status: data.status });

      setRideData(prev => (prev ? { ...prev, status: data.status } : null));

      // Show alerts for important status changes
      if (data.status === 'arrived') {
        showStatus(
          'info',
          `El conductor ha llegado al punto de recogida para ${rideData?.beneficiaryName}.`,
          '📍 Conductor en el Punto de Recogida'
        );
      } else if (data.status === 'in_progress') {
        showStatus(
          'info',
          `El viaje de ${rideData?.beneficiaryName} está en progreso.`,
          '🚀 Viaje en Progreso'
        );
      }
    };

    // Listen for driver location updates
    const handleDriverLocationUpdate = (data: any) => {
      logInfo('DelegatedRideTracking', 'Driver location update', {
        lat: data.latitude,
        lng: data.longitude,
      });

      setDriverLocation({
        latitude: data.latitude,
        longitude: data.longitude,
      });
    };

    // Listen for ETA updates
    const handleETAUpdate = (data: any) => {
      logInfo('DelegatedRideTracking', 'ETA update', { eta: data.eta });

      setRideData(prev =>
        prev
          ? {
              ...prev,
              eta: {
                estimatedMinutes: data.eta.estimatedMinutes,
                distanceKm: data.eta.distanceKm,
              },
            }
          : null
      );
    };

    // Listen for ride completed
    const cleanupCompleted = onRideCompleted((data: any) => {
      logInfo('DelegatedRideTracking', 'Ride completed', { rideId: data.rideId });

      setRideData(prev =>
        prev
          ? {
              ...prev,
              status: 'completed',
              finalFare: data.finalFare,
            }
          : null
      );

      showStatus(
        'info',
        `El viaje de ${rideData?.beneficiaryName} ha sido completado exitosamente.`,
        '✅ Viaje Completado',
        undefined,
        { label: 'Ver Historial', onPress: () => { router.push('/(passenger)/history'); dismissStatus(); } }
      );
    });

    // Listen for ride cancelled
    const cleanupCancelled = onRideCancelled((data: any) => {
      logInfo('DelegatedRideTracking', 'Ride cancelled', { rideId: data.rideId });

      setRideData(prev => (prev ? { ...prev, status: 'cancelled' } : null));

      showStatus(
        'info',
        `El viaje de ${rideData?.beneficiaryName} ha sido cancelado.\n\nMotivo: ${data.cancellationReason}`,
        '❌ Viaje Cancelado',
        undefined,
        { label: 'Entendido', onPress: () => { router.back(); dismissStatus(); } }
      );
    });

    onRideStatusChanged(handleRideStatusChanged);
    onDriverLocationUpdate(handleDriverLocationUpdate);
    onETAUpdate(handleETAUpdate);

    return () => {
      cleanupCompleted();
      cleanupCancelled();
    };
  }, [rideId, isSocketConnected, rideData?.beneficiaryName, router, showStatus]);

  // Load ride data on mount
  useEffect(() => {
    loadRideData();
  }, [loadRideData]);

  // Handle call beneficiary
  const handleCallBeneficiary = useCallback(() => {
    if (!rideData?.beneficiaryPhone) {
      showToast('No se encontró el número de teléfono del beneficiario', 'error');
      return;
    }

    const phoneUrl = `tel:${rideData.beneficiaryPhone}`;

    showStatus(
      'info',
      `¿Deseas llamar a ${rideData.beneficiaryName}?`,
      'Llamar al Beneficiario',
      undefined,
      {
        label: 'Llamar',
        onPress: () => {
          Linking.openURL(phoneUrl).catch(err => {
            logError('DelegatedRideTracking', err, { context: 'Opening phone dialer' });
            showToast('No se pudo abrir el marcador telefónico', 'error');
          });
        },
      }
    );
  }, [rideData, showStatus, showToast]);

  // Handle call driver
  const handleCallDriver = useCallback(() => {
    if (!rideData?.driver?.phone) {
      showToast('No se encontró el número de teléfono del conductor', 'error');
      return;
    }

    const phoneUrl = `tel:${rideData.driver.phone}`;

    showStatus(
      'info',
      `¿Deseas llamar a ${rideData.driver.name}?`,
      'Llamar al Conductor',
      undefined,
      {
        label: 'Llamar',
        onPress: () => {
          Linking.openURL(phoneUrl).catch(err => {
            logError('DelegatedRideTracking', err, { context: 'Opening phone dialer' });
            showToast('No se pudo abrir el marcador telefónico', 'error');
          });
        },
      }
    );
  }, [rideData, showStatus, showToast]);

  // Get status label and color
  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'pending':
        return { label: 'Buscando Conductor', color: '#f59e0b', icon: 'search' as const };
      case 'accepted':
        return {
          label: 'Conductor Asignado',
          color: Colors.primary,
          icon: 'checkmark-circle' as const,
        };
      case 'arrived':
        return { label: 'Conductor en el Punto', color: '#8b5cf6', icon: 'location' as const };
      case 'in_progress':
        return { label: 'En Progreso', color: '#3b82f6', icon: 'car' as const };
      case 'completed':
        return { label: 'Completado', color: '#10b981', icon: 'checkmark-done' as const };
      case 'cancelled':
        return { label: 'Cancelado', color: '#ef4444', icon: 'close-circle' as const };
      default:
        return { label: 'Desconocido', color: '#6b7280', icon: 'help-circle' as const };
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Cargando información del viaje...</Text>
      </View>
    );
  }

  if (!rideData) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={64} color="#ef4444" />
        <Text style={styles.errorText}>No se pudo cargar la información del viaje</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Volver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const statusInfo = getStatusInfo(rideData.status);

  return (
    <View style={styles.container}>
      {/* Map */}
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={{
          latitude: rideData.pickup.latitude,
          longitude: rideData.pickup.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        showsUserLocation={false}
        showsMyLocationButton={false}
      >
        {/* Pickup marker */}
        <Marker
          coordinate={rideData.pickup}
          title="Punto de Recogida"
          description={rideData.pickup.address}
        >
          <PickupIcon />
        </Marker>

        {/* Destination marker */}
        <Marker
          coordinate={rideData.destination}
          title="Destino"
          description={rideData.destination.address}
        >
          <DropoffIcon />
        </Marker>

        {/* Driver marker */}
        {driverLocation && rideData.driver && (
          <Marker
            coordinate={driverLocation}
            title={rideData.driver.name}
            description={`${rideData.driver.vehicleInfo?.model || 'Vehículo'} - ${rideData.driver.vehicleInfo?.licensePlate || 'N/A'}`}
            anchor={{ x: 0.5, y: 0.5 }}
            rotation={0}
          >
            <DriverTaxiIcon />
          </Marker>
        )}

        {/* Route polyline */}
        {driverLocation && rideData.status !== 'completed' && rideData.status !== 'cancelled' && (
          <Polyline
            coordinates={[
              driverLocation,
              rideData.status === 'in_progress' ? rideData.destination : rideData.pickup,
            ]}
            strokeColor={Colors.primary}
            strokeWidth={3}
            lineDashPattern={[10, 5]}
          />
        )}
      </MapView>

      {/* Back button */}
      <TouchableOpacity
        style={[styles.backButtonMap, { top: insets.top + 10 }]}
        onPress={() => router.back()}
      >
        <Ionicons name="arrow-back" size={24} color="#1f2937" />
      </TouchableOpacity>

      {/* Info panel */}
      <View style={[styles.infoPanel, { paddingBottom: insets.bottom + Spacing.lg }]}>
        {/* Status badge */}
        <View style={[styles.statusBadge, { backgroundColor: statusInfo.color }]}>
          <Ionicons name={statusInfo.icon} size={20} color="#fff" />
          <Text style={styles.statusText}>{statusInfo.label}</Text>
        </View>

        {/* Beneficiary info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Viaje Para:</Text>
          <View style={styles.beneficiaryCard}>
            <View style={styles.beneficiaryInfo}>
              <Ionicons name="person" size={24} color={Colors.primary} />
              <View style={styles.beneficiaryDetails}>
                <Text style={styles.beneficiaryName}>{rideData.beneficiaryName}</Text>
                <Text style={styles.beneficiaryPhone}>{rideData.beneficiaryPhone}</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.callButton} onPress={handleCallBeneficiary}>
              <Ionicons name="call" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Driver info */}
        {rideData.driver && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Conductor:</Text>
            <View style={styles.driverCard}>
              <View style={styles.driverInfo}>
                <View style={styles.driverAvatar}>
                  <Ionicons name="person" size={24} color="#fff" />
                </View>
                <View style={styles.driverDetails}>
                  <Text style={styles.driverName}>{rideData.driver.name}</Text>
                  <Text style={styles.driverVehicle}>
                    {rideData.driver.vehicleInfo?.model || 'Vehículo'} -{' '}
                    {rideData.driver.vehicleInfo?.licensePlate || 'N/A'}
                  </Text>
                  <View style={styles.driverRating}>
                    <Ionicons name="star" size={14} color="#f59e0b" />
                    <Text style={styles.driverRatingText}>{rideData.driver.rating.toFixed(1)}</Text>
                  </View>
                </View>
              </View>
              <TouchableOpacity style={styles.callButton} onPress={handleCallDriver}>
                <Ionicons name="call" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ETA info */}
        {rideData.eta && rideData.status !== 'completed' && rideData.status !== 'cancelled' && (
          <View style={styles.etaCard}>
            <Ionicons name="time-outline" size={20} color={Colors.primary} />
            <Text style={styles.etaText}>
              {rideData.status === 'in_progress'
                ? `Llegada en ${Math.ceil(rideData.eta.estimatedMinutes)} min`
                : `Conductor llegará en ${Math.ceil(rideData.eta.estimatedMinutes)} min`}
            </Text>
            <Text style={styles.etaDistance}>({rideData.eta.distanceKm.toFixed(1)} km)</Text>
          </View>
        )}

        {/* Fare info */}
        <View style={styles.fareCard}>
          <Text style={styles.fareLabel}>
            {rideData.status === 'completed' ? 'Tarifa Final' : 'Tarifa Estimada'}
          </Text>
          <Text style={styles.fareAmount}>
            {formatCurrency(
              rideData.finalFare || rideData.estimatedFare || 0,
              rideData.currency || 'VES'
            )}
          </Text>
        </View>

        {/* Addresses */}
        <View style={styles.addressesSection}>
          <View style={styles.addressRow}>
            <View style={styles.addressDot} />
            <Text style={styles.addressText} numberOfLines={2}>
              {rideData.pickup.address}
            </Text>
          </View>
          <View style={styles.addressLine} />
          <View style={styles.addressRow}>
            <Ionicons name="location" size={16} color="#ef4444" />
            <Text style={styles.addressText} numberOfLines={2}>
              {rideData.destination.address}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f9ff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f9ff',
  },
  loadingText: {
    marginTop: Spacing.md,
    fontSize: 16,
    color: '#6b7280',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f9ff',
    padding: Spacing.xl,
  },
  errorText: {
    marginTop: Spacing.lg,
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    textAlign: 'center',
  },
  backButton: {
    marginTop: Spacing.xl,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.primary,
    borderRadius: 12,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  map: {
    flex: 1,
  },
  backButtonMap: {
    position: 'absolute',
    left: Spacing.lg,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  infoPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: Spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 20,
    marginBottom: Spacing.md,
  },
  statusText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  section: {
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  beneficiaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#86efac',
  },
  beneficiaryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  beneficiaryDetails: {
    marginLeft: Spacing.md,
    flex: 1,
  },
  beneficiaryName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  beneficiaryPhone: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  driverCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  driverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  driverAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  driverDetails: {
    marginLeft: Spacing.md,
    flex: 1,
  },
  driverName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  driverVehicle: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  driverRating: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  driverRatingText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1f2937',
    marginLeft: 4,
  },
  callButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  etaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    marginBottom: Spacing.md,
  },
  etaText: {
    marginLeft: 8,
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
    flex: 1,
  },
  etaDistance: {
    fontSize: 13,
    color: '#6b7280',
  },
  fareCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    backgroundColor: '#f0f9ff',
    borderRadius: 12,
    marginBottom: Spacing.md,
  },
  fareLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  fareAmount: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.primary,
  },
  addressesSection: {
    marginTop: Spacing.sm,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addressDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary,
    marginRight: 12,
  },
  addressLine: {
    width: 2,
    height: 16,
    backgroundColor: '#e5e7eb',
    marginLeft: 4,
    marginVertical: 4,
  },
  addressText: {
    fontSize: 14,
    color: '#6b7280',
    flex: 1,
  },
});
