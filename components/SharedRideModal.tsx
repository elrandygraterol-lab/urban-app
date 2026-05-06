/**
 * SharedRideModal
 *
 * Modal that allows a passenger to search for another passenger by phone number
 * or user code in order to set up a shared ride.
 *
 * Features:
 *  - Search field with 300 ms debounce
 *  - Calls GET /api/passengers/search?q={query} while the user types
 *  - Shows a list of results with passenger name and code
 *  - Allows selecting one passenger from the results
 *  - Shows ride summary with estimated fare and cost distribution
 *  - Calls POST /api/shared-rides/invite when confirmed
 *  - Shows waiting screen with 60-second countdown
 *  - Fires onInvitationSent(invitationId) when invitation is sent
 *  - Fires onClose() to dismiss the modal
 *  - Shows an ActivityIndicator while the request is in-flight
 *  - Shows "No se encontraron resultados" when the query returns nothing
 *
 * Requisitos: 4.1, 4.2, 4.4, 4.5, 4.6, 7.1
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/theme';
import { passengersAPI, sharedRidesAPI, RoutePoint } from '@/services/api';
import { formatCurrency, Currency } from '@/utils/currency';
import {
  onSharedRideInvitationAccepted,
  onSharedRideInvitationRejected,
  onSharedRideInvitationExpired,
} from '@/services/socket';
import DualPaymentSelector, { DualPaymentConfig } from '@/components/DualPaymentSelector';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PassengerResult {
  id: string;
  name: string;
  code: string;
}

interface SharedRideModalProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Pickup points for the shared ride */
  pickupPoints: RoutePoint[];
  /** Destination points for the shared ride */
  destinationPoints: RoutePoint[];
  /** Estimated fare for the ride */
  estimatedFare: number;
  /** Currency for the fare */
  currency?: Currency;
  /** Called when invitation is successfully sent */
  onInvitationSent: (invitationId: string, invitee: PassengerResult) => void;
  /** Called when the user dismisses the modal */
  onClose: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;
const INVITATION_TIMEOUT_SECONDS = 60;

// ─── Component ────────────────────────────────────────────────────────────────

export default function SharedRideModal({
  visible,
  pickupPoints,
  destinationPoints,
  estimatedFare,
  currency = 'VES',
  onInvitationSent,
  onClose,
}: SharedRideModalProps) {
  const insets = useSafeAreaInsets();

  // Screen state: 'search' | 'summary' | 'waiting' | 'confirmation'
  const [screenState, setScreenState] = useState<'search' | 'summary' | 'waiting' | 'confirmation'>('search');
  const [selectedPassenger, setSelectedPassenger] = useState<PassengerResult | null>(null);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PassengerResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Invitation sending state
  const [isSendingInvitation, setIsSendingInvitation] = useState(false);
  const [invitationError, setInvitationError] = useState<string | null>(null);

  // Countdown state
  const [countdown, setCountdown] = useState(INVITATION_TIMEOUT_SECONDS);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Invitation state
  const [invitationId, setInvitationId] = useState<string | null>(null);
  const [updatedFare, setUpdatedFare] = useState<number | null>(null);
  const [inviteePickupLocation, setInviteePickupLocation] = useState<{
    latitude: number;
    longitude: number;
    address: string;
  } | null>(null);

  // Payment configuration state (Req. 5.1, 5.2, 5.3)
  const [paymentConfig, setPaymentConfig] = useState<DualPaymentConfig>({
    mode: 'cash',
  });

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!visible) {
      setScreenState('search');
      setSelectedPassenger(null);
      setQuery('');
      setResults([]);
      setIsLoading(false);
      setHasSearched(false);
      setError(null);
      setInvitationError(null);
      setIsSendingInvitation(false);
      setCountdown(INVITATION_TIMEOUT_SECONDS);
      setInvitationId(null);
      setUpdatedFare(null);
      setInviteePickupLocation(null);
      setPaymentConfig({ mode: 'cash' }); // Reset payment config
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    }
  }, [visible]);

  // Debounced search
  const handleQueryChange = useCallback((text: string) => {
    setQuery(text);
    setError(null);

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    if (text.trim().length < MIN_QUERY_LENGTH) {
      setResults([]);
      setHasSearched(false);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    debounceTimer.current = setTimeout(async () => {
      try {
        const response = await passengersAPI.search(text.trim());
        setResults(response.data.passengers ?? []);
        setHasSearched(true);
      } catch (err: any) {
        console.error('SharedRideModal search error:', err);
        setError('Error al buscar pasajeros. Intenta nuevamente.');
        setResults([]);
        setHasSearched(true);
      } finally {
        setIsLoading(false);
      }
    }, DEBOUNCE_MS);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, []);

  // Subscribe to WebSocket events when waiting screen is shown
  useEffect(() => {
    if (screenState !== 'waiting' || !invitationId) {
      return;
    }

    console.log('[SharedRideModal] Subscribing to WebSocket events for invitation:', invitationId);

    // Handle invitation accepted
    const cleanupAccepted = onSharedRideInvitationAccepted((data) => {
      console.log('[SharedRideModal] Invitation accepted:', data);
      
      if (data.invitationId !== invitationId) {
        return; // Not our invitation
      }

      // Stop countdown
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }

      // Update state with new fare and pickup location
      setUpdatedFare(data.updatedFare);
      setInviteePickupLocation(data.inviteePickupLocation);
      
      // Switch to confirmation screen
      setScreenState('confirmation');
    });

    // Handle invitation rejected
    const cleanupRejected = onSharedRideInvitationRejected((data) => {
      console.log('[SharedRideModal] Invitation rejected:', data);
      
      if (data.invitationId !== invitationId) {
        return; // Not our invitation
      }

      // Stop countdown
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }

      // Show notification and close modal
      alert(`${data.inviteeName} rechazó la invitación de viaje compartido.`);
      onClose();
    });

    // Handle invitation expired
    const cleanupExpired = onSharedRideInvitationExpired((data) => {
      console.log('[SharedRideModal] Invitation expired:', data);
      
      if (data.invitationId !== invitationId) {
        return; // Not our invitation
      }

      // Stop countdown
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }

      // Show notification and close modal
      alert('La invitación de viaje compartido ha expirado. El pasajero no respondió a tiempo.');
      onClose();
    });

    // Cleanup function to unsubscribe from all events
    return () => {
      console.log('[SharedRideModal] Unsubscribing from WebSocket events');
      cleanupAccepted();
      cleanupRejected();
      cleanupExpired();
    };
  }, [screenState, invitationId, onClose]);

  const handleSelect = useCallback(
    (passenger: PassengerResult) => {
      setSelectedPassenger(passenger);
      setScreenState('summary');
    },
    []
  );

  const handleConfirmInvitation = useCallback(async () => {
    if (!selectedPassenger) return;

    // Validate payment configuration (Req. 5.3)
    const costPerPassenger = estimatedFare / 2;
    if (paymentConfig.mode === 'dual') {
      const { cashAmount, pagoMovilAmount } = paymentConfig;
      if (
        cashAmount === undefined ||
        pagoMovilAmount === undefined ||
        cashAmount <= 0 ||
        pagoMovilAmount <= 0
      ) {
        setInvitationError('Ambos montos deben ser mayores a cero en modo dual');
        return;
      }
      const sum = Math.round((cashAmount + pagoMovilAmount) * 100) / 100;
      const expected = Math.round(costPerPassenger * 100) / 100;
      if (sum !== expected) {
        const diff = Math.round((sum - expected) * 100) / 100;
        setInvitationError(
          `La suma de los montos (${sum.toFixed(2)}) no coincide con tu parte (${expected.toFixed(2)}). Diferencia: ${diff.toFixed(2)}`
        );
        return;
      }
    }

    setIsSendingInvitation(true);
    setInvitationError(null);

    try {
      const response = await sharedRidesAPI.invite({
        inviteeId: selectedPassenger.id,
        pickupPoints,
        destinationPoints,
        estimatedFare,
      });

      const invitationIdFromResponse = response.data.invitationId;

      // Store invitation ID for WebSocket event matching
      setInvitationId(invitationIdFromResponse);

      // Switch to waiting screen and start countdown
      setScreenState('waiting');
      setCountdown(INVITATION_TIMEOUT_SECONDS);

      // Start countdown timer
      countdownIntervalRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            if (countdownIntervalRef.current) {
              clearInterval(countdownIntervalRef.current);
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      // Notify parent component
      onInvitationSent(invitationIdFromResponse, selectedPassenger);
    } catch (err: any) {
      console.error('SharedRideModal invitation error:', err);
      setInvitationError(
        err.response?.data?.error?.message ||
          'Error al enviar la invitación. Intenta nuevamente.'
      );
    } finally {
      setIsSendingInvitation(false);
    }
  }, [selectedPassenger, pickupPoints, destinationPoints, estimatedFare, paymentConfig, onInvitationSent]);

  const handleBackToSearch = useCallback(() => {
    setScreenState('search');
    setSelectedPassenger(null);
    setInvitationError(null);
  }, []);

  // ── Render helpers ──────────────────────────────────────────────────────────

  const renderSearchScreen = () => (
    <>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="people-outline" size={24} color={Colors.primary} />
          <Text style={styles.title}>Buscar Pasajero</Text>
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

      <Text style={styles.subtitle}>
        Ingresa el número de teléfono o código de usuario del pasajero con quien deseas
        compartir el viaje.
      </Text>

      {/* Search input */}
      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={20} color={Colors.mediumGray} />
        <TextInput
          style={styles.searchInput}
          placeholder="Teléfono o código (ej: USR-A3F7)"
          placeholderTextColor={Colors.lightGray}
          value={query}
          onChangeText={handleQueryChange}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="default"
          returnKeyType="search"
          accessibilityLabel="Buscar pasajero por teléfono o código"
        />
        {isLoading && <ActivityIndicator size="small" color={Colors.primary} />}
        {!isLoading && query.length > 0 && (
          <TouchableOpacity
            onPress={() => handleQueryChange('')}
            accessibilityLabel="Limpiar búsqueda"
          >
            <Ionicons name="close-circle" size={20} color={Colors.mediumGray} />
          </TouchableOpacity>
        )}
      </View>

      {/* Hint when query is too short */}
      {query.length > 0 && query.trim().length < MIN_QUERY_LENGTH && (
        <Text style={styles.hintText}>
          Escribe al menos {MIN_QUERY_LENGTH} caracteres para buscar
        </Text>
      )}

      {/* Results list */}
      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListEmptyComponent={renderEmptyState}
        style={styles.list}
        contentContainerStyle={
          results.length === 0 ? styles.listEmptyContent : styles.listContent
        }
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      />
    </>
  );

  const renderSummaryScreen = () => {
    if (!selectedPassenger) return null;

    const costPerPassenger = estimatedFare / 2;

    // Check if payment configuration is valid (Req. 5.3)
    const isPaymentValid = (() => {
      if (paymentConfig.mode === 'cash' || paymentConfig.mode === 'pago_movil') {
        return true;
      }
      if (paymentConfig.mode === 'dual') {
        const { cashAmount, pagoMovilAmount } = paymentConfig;
        if (
          cashAmount === undefined ||
          pagoMovilAmount === undefined ||
          cashAmount <= 0 ||
          pagoMovilAmount <= 0
        ) {
          return false;
        }
        const sum = Math.round((cashAmount + pagoMovilAmount) * 100) / 100;
        const expected = Math.round(costPerPassenger * 100) / 100;
        return sum === expected;
      }
      return false;
    })();

    return (
      <>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBackToSearch}
            accessibilityRole="button"
            accessibilityLabel="Volver"
          >
            <Ionicons name="arrow-back" size={24} color={Colors.darkGray} />
          </TouchableOpacity>
          <Text style={styles.title}>Resumen del Viaje</Text>
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
          style={styles.summaryScrollView}
          contentContainerStyle={styles.summaryContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Selected passenger card */}
          <View style={styles.passengerCard}>
            <View style={styles.passengerCardHeader}>
              <Ionicons name="person-add" size={20} color={Colors.primary} />
              <Text style={styles.passengerCardTitle}>Pasajero Invitado</Text>
            </View>
            <View style={styles.passengerCardBody}>
              <View style={styles.passengerAvatar}>
                <Ionicons name="person" size={24} color={Colors.primary} />
              </View>
              <View style={styles.passengerInfo}>
                <Text style={styles.passengerName}>{selectedPassenger.name}</Text>
                <Text style={styles.passengerCode}>{selectedPassenger.code}</Text>
              </View>
            </View>
          </View>

          {/* Fare breakdown */}
          <View style={styles.fareCard}>
            <View style={styles.fareCardHeader}>
              <Ionicons name="cash-outline" size={20} color={Colors.primary} />
              <Text style={styles.fareCardTitle}>Distribución de Costos</Text>
            </View>
            <View style={styles.fareCardBody}>
              <View style={styles.fareRow}>
                <Text style={styles.fareLabel}>Tarifa Total</Text>
                <Text style={styles.fareValue}>
                  {formatCurrency(estimatedFare, currency)}
                </Text>
              </View>
              <View style={styles.fareDivider} />
              <View style={styles.fareRow}>
                <Text style={styles.fareLabel}>Tu Parte</Text>
                <Text style={styles.fareValueHighlight}>
                  {formatCurrency(costPerPassenger, currency)}
                </Text>
              </View>
              <View style={styles.fareRow}>
                <Text style={styles.fareLabel}>Parte de {selectedPassenger.name}</Text>
                <Text style={styles.fareValueHighlight}>
                  {formatCurrency(costPerPassenger, currency)}
                </Text>
              </View>
            </View>
          </View>

          {/* Payment method selector (Req. 5.1, 5.2, 5.3) */}
          <View style={styles.paymentCard}>
            <View style={styles.paymentCardHeader}>
              <Ionicons name="wallet-outline" size={20} color={Colors.primary} />
              <Text style={styles.paymentCardTitle}>Tu Método de Pago</Text>
            </View>
            <View style={styles.paymentCardBody}>
              <DualPaymentSelector
                totalFare={costPerPassenger}
                value={paymentConfig}
                onChange={setPaymentConfig}
                disabled={isSendingInvitation}
              />
            </View>
            <View style={styles.paymentInfoBox}>
              <Ionicons name="information-circle-outline" size={16} color={Colors.primary} />
              <Text style={styles.paymentInfoText}>
                {selectedPassenger.name} seleccionará su propio método de pago al aceptar la invitación.
              </Text>
            </View>
          </View>

          {/* Route info */}
          <View style={styles.routeCard}>
            <View style={styles.routeCardHeader}>
              <Ionicons name="location-outline" size={20} color={Colors.primary} />
              <Text style={styles.routeCardTitle}>Puntos de Ruta</Text>
            </View>
            <View style={styles.routeCardBody}>
              <View style={styles.routePoint}>
                <Ionicons name="radio-button-on" size={16} color={Colors.success} />
                <Text style={styles.routePointText}>
                  {pickupPoints.length} punto{pickupPoints.length > 1 ? 's' : ''} de recogida
                </Text>
              </View>
              <View style={styles.routePoint}>
                <Ionicons name="location" size={16} color={Colors.error} />
                <Text style={styles.routePointText}>
                  {destinationPoints.length} destino{destinationPoints.length > 1 ? 's' : ''}
                </Text>
              </View>
            </View>
          </View>

          {/* Error message */}
          {invitationError && (
            <View style={styles.errorCard}>
              <Ionicons name="alert-circle" size={20} color={Colors.error} />
              <Text style={styles.errorText}>{invitationError}</Text>
            </View>
          )}

          {/* Info message */}
          <View style={styles.infoCard}>
            <Ionicons name="information-circle-outline" size={20} color={Colors.primary} />
            <Text style={styles.infoText}>
              {selectedPassenger.name} recibirá una notificación y tendrá 60 segundos para
              aceptar o rechazar la invitación.
            </Text>
          </View>
        </ScrollView>

        {/* Confirm button */}
        <TouchableOpacity
          style={[
            styles.confirmButton,
            (isSendingInvitation || !isPaymentValid) && styles.confirmButtonDisabled
          ]}
          onPress={handleConfirmInvitation}
          disabled={isSendingInvitation || !isPaymentValid}
          accessibilityRole="button"
          accessibilityLabel="Enviar invitación"
        >
          {isSendingInvitation ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="send" size={20} color="#fff" />
              <Text style={styles.confirmButtonText}>Enviar Invitación</Text>
            </>
          )}
        </TouchableOpacity>
      </>
    );
  };

  const renderWaitingScreen = () => {
    if (!selectedPassenger) return null;

    return (
      <>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Esperando Respuesta</Text>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Cerrar"
          >
            <Ionicons name="close" size={24} color={Colors.darkGray} />
          </TouchableOpacity>
        </View>

        <View style={styles.waitingContent}>
          {/* Countdown circle */}
          <View style={styles.countdownCircle}>
            <Text style={styles.countdownNumber}>{countdown}</Text>
            <Text style={styles.countdownLabel}>segundos</Text>
          </View>

          {/* Waiting message */}
          <View style={styles.waitingMessageCard}>
            <Ionicons name="time-outline" size={32} color={Colors.primary} />
            <Text style={styles.waitingTitle}>Invitación Enviada</Text>
            <Text style={styles.waitingMessage}>
              Esperando que {selectedPassenger.name} acepte o rechace la invitación.
            </Text>
          </View>

          {/* Passenger info */}
          <View style={styles.waitingPassengerCard}>
            <View style={styles.passengerAvatar}>
              <Ionicons name="person" size={24} color={Colors.primary} />
            </View>
            <View style={styles.passengerInfo}>
              <Text style={styles.passengerName}>{selectedPassenger.name}</Text>
              <Text style={styles.passengerCode}>{selectedPassenger.code}</Text>
            </View>
          </View>

          {/* Info message */}
          <View style={styles.infoCard}>
            <Ionicons name="information-circle-outline" size={20} color={Colors.primary} />
            <Text style={styles.infoText}>
              Si no recibes respuesta en {INVITATION_TIMEOUT_SECONDS} segundos, la invitación
              expirará automáticamente.
            </Text>
          </View>
        </View>

        {/* Cancel button */}
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Cancelar invitación"
        >
          <Text style={styles.cancelButtonText}>Cancelar Invitación</Text>
        </TouchableOpacity>
      </>
    );
  };

  const renderConfirmationScreen = () => {
    if (!selectedPassenger || updatedFare === null) return null;

    const costPerPassenger = updatedFare / 2;

    return (
      <>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>¡Invitación Aceptada!</Text>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Cerrar"
          >
            <Ionicons name="close" size={24} color={Colors.darkGray} />
          </TouchableOpacity>
        </View>

        <View style={styles.summaryContent}>
          {/* Success message */}
          <View style={styles.successCard}>
            <Ionicons name="checkmark-circle" size={48} color={Colors.success} />
            <Text style={styles.successTitle}>
              {selectedPassenger.name} aceptó tu invitación
            </Text>
            <Text style={styles.successMessage}>
              Ahora puedes confirmar el viaje compartido con la tarifa actualizada.
            </Text>
          </View>

          {/* Selected passenger card */}
          <View style={styles.passengerCard}>
            <View style={styles.passengerCardHeader}>
              <Ionicons name="person-add" size={20} color={Colors.primary} />
              <Text style={styles.passengerCardTitle}>Pasajero Confirmado</Text>
            </View>
            <View style={styles.passengerCardBody}>
              <View style={styles.passengerAvatar}>
                <Ionicons name="person" size={24} color={Colors.primary} />
              </View>
              <View style={styles.passengerInfo}>
                <Text style={styles.passengerName}>{selectedPassenger.name}</Text>
                <Text style={styles.passengerCode}>{selectedPassenger.code}</Text>
              </View>
            </View>
            {inviteePickupLocation && (
              <View style={styles.pickupLocationInfo}>
                <Ionicons name="location" size={16} color={Colors.mediumGray} />
                <Text style={styles.pickupLocationText} numberOfLines={2}>
                  {inviteePickupLocation.address}
                </Text>
              </View>
            )}
          </View>

          {/* Updated fare breakdown */}
          <View style={styles.fareCard}>
            <View style={styles.fareCardHeader}>
              <Ionicons name="cash-outline" size={20} color={Colors.primary} />
              <Text style={styles.fareCardTitle}>Tarifa Actualizada</Text>
            </View>
            <View style={styles.fareCardBody}>
              <View style={styles.fareRow}>
                <Text style={styles.fareLabel}>Tarifa Total</Text>
                <Text style={styles.fareValue}>
                  {formatCurrency(updatedFare, currency)}
                </Text>
              </View>
              <View style={styles.fareDivider} />
              <View style={styles.fareRow}>
                <Text style={styles.fareLabel}>Tu Parte</Text>
                <Text style={styles.fareValueHighlight}>
                  {formatCurrency(costPerPassenger, currency)}
                </Text>
              </View>
              <View style={styles.fareRow}>
                <Text style={styles.fareLabel}>Parte de {selectedPassenger.name}</Text>
                <Text style={styles.fareValueHighlight}>
                  {formatCurrency(costPerPassenger, currency)}
                </Text>
              </View>
            </View>
          </View>

          {/* Info message */}
          <View style={styles.infoCard}>
            <Ionicons name="information-circle-outline" size={20} color={Colors.primary} />
            <Text style={styles.infoText}>
              Al confirmar, se buscará un conductor disponible para realizar el viaje compartido.
            </Text>
          </View>
        </View>

        {/* Confirm button */}
        <TouchableOpacity
          style={styles.confirmButton}
          onPress={() => {
            // TODO: Call API to confirm shared ride and search for driver
            // For now, just close the modal
            alert('Viaje compartido confirmado. Buscando conductor...');
            onClose();
          }}
          accessibilityRole="button"
          accessibilityLabel="Confirmar viaje compartido"
        >
          <Ionicons name="checkmark" size={20} color="#fff" />
          <Text style={styles.confirmButtonText}>Confirmar Viaje Compartido</Text>
        </TouchableOpacity>
      </>
    );
  };

  const renderItem = ({ item }: { item: PassengerResult }) => (
    <TouchableOpacity
      style={styles.resultItem}
      onPress={() => handleSelect(item)}
      accessibilityRole="button"
      accessibilityLabel={`Seleccionar pasajero ${item.name}, código ${item.code}`}
    >
      <View style={styles.resultAvatar}>
        <Ionicons name="person" size={20} color={Colors.primary} />
      </View>
      <View style={styles.resultInfo}>
        <Text style={styles.resultName}>{item.name}</Text>
        <Text style={styles.resultCode}>{item.code}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={Colors.mediumGray} />
    </TouchableOpacity>
  );

  const renderEmptyState = () => {
    if (isLoading) return null;
    if (!hasSearched) return null;
    if (error) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="alert-circle-outline" size={40} color={Colors.error} />
          <Text style={styles.emptyText}>{error}</Text>
        </View>
      );
    }
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="search-outline" size={40} color={Colors.mediumGray} />
        <Text style={styles.emptyText}>No se encontraron resultados</Text>
        <Text style={styles.emptySubtext}>
          Verifica el número de teléfono o código de usuario
        </Text>
      </View>
    );
  };

  // ── Main render ─────────────────────────────────────────────────────────────

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View
          style={[
            styles.container,
            { paddingBottom: Math.max(insets.bottom, 24) },
          ]}
        >
          {screenState === 'search' && renderSearchScreen()}
          {screenState === 'summary' && renderSummaryScreen()}
          {screenState === 'waiting' && renderWaitingScreen()}
          {screenState === 'confirmation' && renderConfirmationScreen()}
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
    maxHeight: '80%',
    paddingTop: 24,
    paddingHorizontal: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
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
  subtitle: {
    fontSize: 13,
    color: Colors.mediumGray,
    lineHeight: 18,
    marginBottom: 20,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    gap: 10,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.darkGray,
  },
  hintText: {
    fontSize: 12,
    color: Colors.mediumGray,
    marginBottom: 8,
    marginLeft: 4,
  },
  list: {
    marginTop: 8,
  },
  listContent: {
    paddingBottom: 8,
  },
  listEmptyContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    gap: 12,
  },
  resultAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0fdf4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultInfo: {
    flex: 1,
  },
  resultName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.darkGray,
  },
  resultCode: {
    fontSize: 12,
    color: Colors.mediumGray,
    marginTop: 2,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.darkGray,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 13,
    color: Colors.mediumGray,
    textAlign: 'center',
    lineHeight: 18,
  },
  // Summary screen styles
  summaryScrollView: {
    flex: 1,
    marginTop: 16,
  },
  summaryContent: {
    gap: 16,
    paddingBottom: 16,
  },
  passengerCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  passengerCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  passengerCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.darkGray,
  },
  passengerCardBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  passengerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f0fdf4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  passengerInfo: {
    flex: 1,
  },
  passengerName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.darkGray,
  },
  passengerCode: {
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
    gap: 8,
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  routePointText: {
    fontSize: 14,
    color: Colors.darkGray,
  },
  paymentCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  paymentCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  paymentCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.darkGray,
  },
  paymentCardBody: {
    marginBottom: 12,
  },
  paymentInfoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    padding: 10,
  },
  paymentInfoText: {
    flex: 1,
    fontSize: 12,
    color: '#1e40af',
    lineHeight: 16,
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
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    marginTop: 16,
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
  // Waiting screen styles
  waitingContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    paddingVertical: 32,
  },
  countdownCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#f0fdf4',
    borderWidth: 4,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countdownNumber: {
    fontSize: 40,
    fontWeight: '700',
    color: Colors.primary,
  },
  countdownLabel: {
    fontSize: 12,
    color: Colors.mediumGray,
    marginTop: 4,
  },
  waitingMessageCard: {
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 24,
  },
  waitingTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.darkGray,
    textAlign: 'center',
  },
  waitingMessage: {
    fontSize: 14,
    color: Colors.mediumGray,
    textAlign: 'center',
    lineHeight: 20,
  },
  waitingPassengerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    width: '100%',
  },
  cancelButton: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    paddingVertical: 16,
    marginTop: 16,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.darkGray,
  },
  // Confirmation screen styles
  successCard: {
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    padding: 24,
    borderWidth: 1,
    borderColor: '#d1fae5',
    gap: 12,
  },
  successTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.darkGray,
    textAlign: 'center',
  },
  successMessage: {
    fontSize: 14,
    color: Colors.mediumGray,
    textAlign: 'center',
    lineHeight: 20,
  },
  pickupLocationInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  pickupLocationText: {
    flex: 1,
    fontSize: 13,
    color: Colors.mediumGray,
    lineHeight: 18,
  },
});
