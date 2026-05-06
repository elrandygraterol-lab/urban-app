/**
 * SharedRideInvitationModal
 *
 * Modal that displays when a passenger receives a shared ride invitation.
 * Shows invitation details, allows accepting/rejecting, and lets the invitee
 * confirm or modify their pickup location.
 *
 * Features:
 *  - Display invitation details: inviter name, pickup/destination points, estimated fare
 *  - Show countdown timer (60 seconds)
 *  - Accept/Reject buttons with API calls
 *  - On accept, show map view to confirm or adjust pickup location
 *  - Handle WebSocket events for invitation updates
 *  - Validates Requirements: 7.3, 7.4
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Dimensions,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { Colors } from '@/constants/theme';
import { sharedRidesAPI, RoutePoint } from '@/services/api';
import { formatCurrency, Currency } from '@/utils/currency';
import mapsService from '@/services/mapsService';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SharedRideInvitation {
  id: string;
  inviterId: string;
  inviterName: string;
  inviterCode?: string;
  pickupPoints: RoutePoint[];
  destinationPoints: RoutePoint[];
  estimatedFare: number;
  currency: Currency;
  expiresAt: string;
}

interface SharedRideInvitationModalProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Invitation data */
  invitation: SharedRideInvitation | null;
  /** Called when invitation is accepted */
  onAccept: (invitationId: string, pickupLocation: RoutePoint) => void;
  /** Called when invitation is rejected */
  onReject: (invitationId: string) => void;
  /** Called when the user dismisses the modal */
  onClose: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const INVITATION_TIMEOUT_SECONDS = 60;
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ─── Component ────────────────────────────────────────────────────────────────

export default function SharedRideInvitationModal({
  visible,
  invitation,
  onAccept,
  onReject,
  onClose,
}: SharedRideInvitationModalProps) {
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);

  // Screen state: 'details' | 'pickup_selection'
  const [screenState, setScreenState] = useState<'details' | 'pickup_selection'>('details');

  // Countdown state
  const [countdown, setCountdown] = useState(INVITATION_TIMEOUT_SECONDS);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Pickup location selection state
  const [selectedPickupLocation, setSelectedPickupLocation] = useState<RoutePoint | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Calculate countdown from expiration time
  useEffect(() => {
    if (!visible || !invitation) {
      return;
    }

    const calculateCountdown = () => {
      const expiresAt = new Date(invitation.expiresAt).getTime();
      const now = Date.now();
      const remainingSeconds = Math.max(0, Math.floor((expiresAt - now) / 1000));
      setCountdown(remainingSeconds);

      if (remainingSeconds === 0) {
        // Invitation expired
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
        }
        onClose();
      }
    };

    // Calculate initial countdown
    calculateCountdown();

    // Start countdown timer
    countdownIntervalRef.current = setInterval(calculateCountdown, 1000);

    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, [visible, invitation, onClose]);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!visible) {
      setScreenState('details');
      setSelectedPickupLocation(null);
      setIsLoadingLocation(false);
      setIsAccepting(false);
      setIsRejecting(false);
      setError(null);
      setCountdown(INVITATION_TIMEOUT_SECONDS);
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    }
  }, [visible]);

  // Get current location when entering pickup selection screen
  useEffect(() => {
    if (screenState === 'pickup_selection' && !selectedPickupLocation) {
      getCurrentLocation();
    }
  }, [screenState]);

  const getCurrentLocation = async () => {
    setIsLoadingLocation(true);
    setError(null);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Se requiere permiso de ubicación para continuar');
        setIsLoadingLocation(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const { latitude, longitude } = location.coords;

      // Reverse geocode to get address
      const locationData = await mapsService.reverseGeocode(latitude, longitude);

      setSelectedPickupLocation({
        latitude,
        longitude,
        address: locationData.address || 'Ubicación actual',
      });

      // Center map on current location
      if (mapRef.current) {
        mapRef.current.animateToRegion(
          {
            latitude,
            longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          },
          500
        );
      }
    } catch (err: any) {
      console.error('Error getting current location:', err);
      setError('Error al obtener ubicación actual');
    } finally {
      setIsLoadingLocation(false);
    }
  };

  const handleMapPress = async (event: any) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;

    setIsLoadingLocation(true);
    setError(null);

    try {
      // Reverse geocode to get address
      const locationData = await mapsService.reverseGeocode(latitude, longitude);

      setSelectedPickupLocation({
        latitude,
        longitude,
        address: locationData.address || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
      });
    } catch (err: any) {
      console.error('Error reverse geocoding:', err);
      setError('Error al obtener dirección');
    } finally {
      setIsLoadingLocation(false);
    }
  };

  const handleAcceptPress = () => {
    setScreenState('pickup_selection');
  };

  const handleRejectPress = async () => {
    if (!invitation) return;

    setIsRejecting(true);
    setError(null);

    try {
      await sharedRidesAPI.reject(invitation.id);
      onReject(invitation.id);
    } catch (err: any) {
      console.error('Error rejecting invitation:', err);
      setError(
        err.response?.data?.error?.message || 'Error al rechazar la invitación. Intenta nuevamente.'
      );
    } finally {
      setIsRejecting(false);
    }
  };

  const handleConfirmPickup = async () => {
    if (!invitation || !selectedPickupLocation) return;

    setIsAccepting(true);
    setError(null);

    try {
      await sharedRidesAPI.accept(invitation.id, {
        inviteePickupLat: selectedPickupLocation.latitude,
        inviteePickupLng: selectedPickupLocation.longitude,
        inviteePickupAddr: selectedPickupLocation.address,
      });

      onAccept(invitation.id, selectedPickupLocation);
    } catch (err: any) {
      console.error('Error accepting invitation:', err);
      setError(
        err.response?.data?.error?.message || 'Error al aceptar la invitación. Intenta nuevamente.'
      );
    } finally {
      setIsAccepting(false);
    }
  };

  const handleBackToDetails = () => {
    setScreenState('details');
    setSelectedPickupLocation(null);
    setError(null);
  };

  if (!invitation) {
    return null;
  }

  const costPerPassenger = invitation.estimatedFare / 2;

  // ── Render helpers ──────────────────────────────────────────────────────────

  const renderDetailsScreen = () => (
    <>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="people-outline" size={24} color={Colors.primary} />
          <Text style={styles.title}>Invitación de Viaje</Text>
        </View>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Cerrar"
        >
          <Ionicons name="close" size={24} color={Colors.darkGray} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollContent}
        contentContainerStyle={styles.scrollContentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Countdown circle */}
        <View style={styles.countdownCircle}>
          <Text style={styles.countdownNumber}>{countdown}</Text>
          <Text style={styles.countdownLabel}>segundos</Text>
        </View>

        {/* Inviter card */}
        <View style={styles.inviterCard}>
          <View style={styles.inviterCardHeader}>
            <Ionicons name="person-circle-outline" size={20} color={Colors.primary} />
            <Text style={styles.inviterCardTitle}>Invitado por</Text>
          </View>
          <View style={styles.inviterCardBody}>
            <View style={styles.inviterAvatar}>
              <Ionicons name="person" size={28} color={Colors.primary} />
            </View>
            <View style={styles.inviterInfo}>
              <Text style={styles.inviterName}>{invitation.inviterName}</Text>
              {invitation.inviterCode && (
                <Text style={styles.inviterCode}>{invitation.inviterCode}</Text>
              )}
            </View>
          </View>
        </View>

        {/* Fare breakdown */}
        <View style={styles.fareCard}>
          <View style={styles.fareCardHeader}>
            <Ionicons name="cash-outline" size={20} color={Colors.primary} />
            <Text style={styles.fareCardTitle}>Costo del Viaje</Text>
          </View>
          <View style={styles.fareCardBody}>
            <View style={styles.fareRow}>
              <Text style={styles.fareLabel}>Tarifa Total</Text>
              <Text style={styles.fareValue}>
                {formatCurrency(invitation.estimatedFare, invitation.currency)}
              </Text>
            </View>
            <View style={styles.fareDivider} />
            <View style={styles.fareRow}>
              <Text style={styles.fareLabel}>Tu Parte</Text>
              <Text style={styles.fareValueHighlight}>
                {formatCurrency(costPerPassenger, invitation.currency)}
              </Text>
            </View>
            <View style={styles.fareRow}>
              <Text style={styles.fareLabel}>Parte de {invitation.inviterName}</Text>
              <Text style={styles.fareValueHighlight}>
                {formatCurrency(costPerPassenger, invitation.currency)}
              </Text>
            </View>
          </View>
        </View>

        {/* Route info */}
        <View style={styles.routeCard}>
          <View style={styles.routeCardHeader}>
            <Ionicons name="location-outline" size={20} color={Colors.primary} />
            <Text style={styles.routeCardTitle}>Detalles de la Ruta</Text>
          </View>
          <View style={styles.routeCardBody}>
            {/* Pickup points */}
            <View style={styles.routeSection}>
              <View style={styles.routeSectionHeader}>
                <Ionicons name="radio-button-on" size={16} color={Colors.success} />
                <Text style={styles.routeSectionTitle}>Puntos de Recogida</Text>
              </View>
              {invitation.pickupPoints.map((point, index) => (
                <View key={index} style={styles.routePoint}>
                  <View style={styles.routePointBullet} />
                  <Text style={styles.routePointText} numberOfLines={2}>
                    {point.address}
                  </Text>
                </View>
              ))}
            </View>

            {/* Destination points */}
            <View style={styles.routeSection}>
              <View style={styles.routeSectionHeader}>
                <Ionicons name="location" size={16} color={Colors.error} />
                <Text style={styles.routeSectionTitle}>Destinos</Text>
              </View>
              {invitation.destinationPoints.map((point, index) => (
                <View key={index} style={styles.routePoint}>
                  <View style={styles.routePointBullet} />
                  <Text style={styles.routePointText} numberOfLines={2}>
                    {point.address}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Error message */}
        {error && (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle" size={20} color={Colors.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Info message */}
        <View style={styles.infoCard}>
          <Ionicons name="information-circle-outline" size={20} color={Colors.primary} />
          <Text style={styles.infoText}>
            Al aceptar, podrás confirmar o modificar tu punto de recogida antes de buscar un
            conductor.
          </Text>
        </View>
      </ScrollView>

      {/* Action buttons */}
      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.rejectButton, isRejecting && styles.buttonDisabled]}
          onPress={handleRejectPress}
          disabled={isRejecting || isAccepting}
          accessibilityRole="button"
          accessibilityLabel="Rechazar invitación"
        >
          {isRejecting ? (
            <ActivityIndicator size="small" color={Colors.error} />
          ) : (
            <>
              <Ionicons name="close-circle" size={20} color={Colors.error} />
              <Text style={styles.rejectButtonText}>Rechazar</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.acceptButton, isAccepting && styles.buttonDisabled]}
          onPress={handleAcceptPress}
          disabled={isAccepting || isRejecting}
          accessibilityRole="button"
          accessibilityLabel="Aceptar invitación"
        >
          {isAccepting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={20} color="#fff" />
              <Text style={styles.acceptButtonText}>Aceptar</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </>
  );

  const renderPickupSelectionScreen = () => (
    <>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBackToDetails}
          accessibilityRole="button"
          accessibilityLabel="Volver"
        >
          <Ionicons name="arrow-back" size={24} color={Colors.darkGray} />
        </TouchableOpacity>
        <Text style={styles.title}>Confirmar Punto de Recogida</Text>
        <View style={styles.closeButton} />
      </View>

      {/* Map */}
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={styles.map}
          initialRegion={{
            latitude: invitation.pickupPoints[0]?.latitude || 0,
            longitude: invitation.pickupPoints[0]?.longitude || 0,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
          onPress={handleMapPress}
          showsUserLocation
          showsMyLocationButton={false}
        >
          {selectedPickupLocation && (
            <Marker
              coordinate={{
                latitude: selectedPickupLocation.latitude,
                longitude: selectedPickupLocation.longitude,
              }}
              title="Tu punto de recogida"
              pinColor={Colors.primary}
            />
          )}
        </MapView>

        {/* Loading overlay */}
        {isLoadingLocation && (
          <View style={styles.mapLoadingOverlay}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        )}

        {/* Recenter button */}
        <TouchableOpacity
          style={styles.recenterButton}
          onPress={getCurrentLocation}
          accessibilityRole="button"
          accessibilityLabel="Centrar en mi ubicación"
        >
          <Ionicons name="locate" size={24} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Address display */}
      <View style={styles.addressContainer}>
        <View style={styles.addressHeader}>
          <Ionicons name="location" size={20} color={Colors.primary} />
          <Text style={styles.addressTitle}>Punto de Recogida Seleccionado</Text>
        </View>
        {selectedPickupLocation ? (
          <Text style={styles.addressText}>{selectedPickupLocation.address}</Text>
        ) : (
          <Text style={styles.addressPlaceholder}>Toca el mapa para seleccionar tu ubicación</Text>
        )}
      </View>

      {/* Error message */}
      {error && (
        <View style={styles.errorCard}>
          <Ionicons name="alert-circle" size={20} color={Colors.error} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Confirm button */}
      <TouchableOpacity
        style={[
          styles.confirmButton,
          (!selectedPickupLocation || isAccepting) && styles.confirmButtonDisabled,
        ]}
        onPress={handleConfirmPickup}
        disabled={!selectedPickupLocation || isAccepting}
        accessibilityRole="button"
        accessibilityLabel="Confirmar punto de recogida"
      >
        {isAccepting ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <>
            <Ionicons name="checkmark-circle" size={20} color="#fff" />
            <Text style={styles.confirmButtonText}>Confirmar y Aceptar</Text>
          </>
        )}
      </TouchableOpacity>
    </>
  );

  // ── Main render ─────────────────────────────────────────────────────────────

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 24) }]}>
          {screenState === 'details' && renderDetailsScreen()}
          {screenState === 'pickup_selection' && renderPickupSelectionScreen()}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingTop: 24,
    paddingHorizontal: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.darkGray,
  },
  backButton: {
    padding: 4,
  },
  closeButton: {
    padding: 4,
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentContainer: {
    paddingBottom: 16,
    gap: 16,
  },
  countdownCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#fef2f2',
    borderWidth: 3,
    borderColor: Colors.error,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 8,
  },
  countdownNumber: {
    fontSize: 36,
    fontWeight: '700',
    color: Colors.error,
  },
  countdownLabel: {
    fontSize: 11,
    color: Colors.mediumGray,
    marginTop: 2,
  },
  inviterCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  inviterCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  inviterCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.darkGray,
  },
  inviterCardBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  inviterAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#f0fdf4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviterInfo: {
    flex: 1,
  },
  inviterName: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.darkGray,
  },
  inviterCode: {
    fontSize: 13,
    color: Colors.mediumGray,
    marginTop: 2,
  },
  fareCard: {
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#d1fae5',
  },
  fareCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  fareCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.darkGray,
  },
  fareCardBody: {
    gap: 8,
  },
  fareRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fareLabel: {
    fontSize: 14,
    color: Colors.mediumGray,
  },
  fareValue: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.darkGray,
  },
  fareValueHighlight: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.primary,
  },
  fareDivider: {
    height: 1,
    backgroundColor: '#d1fae5',
    marginVertical: 4,
  },
  routeCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  routeCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  routeCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.darkGray,
  },
  routeCardBody: {
    gap: 16,
  },
  routeSection: {
    gap: 8,
  },
  routeSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  routeSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.darkGray,
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingLeft: 24,
  },
  routePointBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.mediumGray,
    marginTop: 6,
  },
  routePointText: {
    flex: 1,
    fontSize: 13,
    color: Colors.darkGray,
    lineHeight: 18,
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: Colors.error,
    lineHeight: 18,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#1e40af',
    lineHeight: 18,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  rejectButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    paddingVertical: 16,
    borderWidth: 1.5,
    borderColor: '#fecaca',
    gap: 8,
  },
  rejectButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.error,
  },
  acceptButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    gap: 8,
  },
  acceptButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  // Pickup selection screen styles
  mapContainer: {
    height: SCREEN_HEIGHT * 0.4,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
  },
  map: {
    flex: 1,
  },
  mapLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recenterButton: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  addressContainer: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
  },
  addressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  addressTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.darkGray,
  },
  addressText: {
    fontSize: 14,
    color: Colors.darkGray,
    lineHeight: 20,
  },
  addressPlaceholder: {
    fontSize: 14,
    color: Colors.mediumGray,
    fontStyle: 'italic',
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    marginTop: 8,
    gap: 8,
  },
  confirmButtonDisabled: {
    opacity: 0.6,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
