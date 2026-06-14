/**
 * DelegatedRideModal
 *
 * Modal that allows a registered passenger to request a ride for a non-registered beneficiary.
 * The requester (registered passenger) pays for the ride, and the driver sees the beneficiary's
 * contact info (not the requester's).
 *
 * Features:
 *  - Input fields for beneficiary's full name and phone number
 *  - Real-time phone format validation (international format)
 *  - Map to select exactly 1 pickup point and 1 destination point
 *  - DualPaymentSelector for the requester to choose payment method
 *  - Validates Requirements: 9.1, 9.2, 9.3
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/theme';
import { RoutePoint, delegatedRidesAPI } from '@/services/api';
import { formatCurrency, Currency } from '@/utils/currency';
import DualPaymentSelector, { DualPaymentConfig } from '@/components/DualPaymentSelector';
import { logError, logInfo } from '@/utils/errorLogger';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DelegatedRideModalProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Pickup point for the beneficiary */
  pickupPoint: RoutePoint | null;
  /** Destination point for the beneficiary */
  destinationPoint: RoutePoint | null;
  /** Estimated fare for the ride */
  estimatedFare: number;
  /** Currency for the fare */
  currency?: Currency;
  /** Called when the user wants to select/change the pickup point */
  onSelectPickup: () => void;
  /** Called when the user wants to select/change the destination point */
  onSelectDestination: () => void;
  /** Called when the delegated ride is successfully created */
  onSuccess: (rideId: string) => void;
  /** Called when the user dismisses the modal */
  onClose: () => void;
}

export interface DelegatedRideData {
  beneficiaryName: string;
  beneficiaryPhone: string;
  pickupPoint: RoutePoint;
  destinationPoint: RoutePoint;
  paymentConfig: DualPaymentConfig;
}

// ─── Constants ────────────────────────────────────────────────────────────────

// International phone format regex (basic validation)
// Accepts formats like: +58 414 1234567, +58-414-1234567, +584141234567, 04141234567
const PHONE_REGEX = /^(\+?58)?[-\s]?0?4\d{2}[-\s]?\d{7}$/;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Validates phone number format in real-time
 * Returns null if valid, error message if invalid
 */
function validatePhoneFormat(phone: string): string | null {
  if (!phone.trim()) {
    return 'El número de teléfono es requerido';
  }

  // Remove spaces and dashes for validation
  const cleanPhone = phone.replace(/[-\s]/g, '');

  if (cleanPhone.length < 10) {
    return 'El número debe tener al menos 10 dígitos';
  }

  if (!PHONE_REGEX.test(phone)) {
    return 'Formato inválido. Ej: +58 414 1234567 o 04141234567';
  }

  return null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DelegatedRideModal({
  visible,
  pickupPoint,
  destinationPoint,
  estimatedFare,
  currency = 'VES',
  onSelectPickup,
  onSelectDestination,
  onSuccess,
  onClose,
}: DelegatedRideModalProps) {
  const insets = useSafeAreaInsets();

  // Form state
  const [beneficiaryName, setBeneficiaryName] = useState('');
  const [beneficiaryPhone, setBeneficiaryPhone] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [paymentConfig, setPaymentConfig] = useState<DualPaymentConfig>({
    mode: 'cash',
  });
  const [isConfirming, setIsConfirming] = useState(false);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!visible) {
      setBeneficiaryName('');
      setBeneficiaryPhone('');
      setPhoneError(null);
      setPaymentConfig({ mode: 'cash' });
      setIsConfirming(false);
    }
  }, [visible]);

  // Real-time phone validation
  const handlePhoneChange = useCallback((text: string) => {
    setBeneficiaryPhone(text);

    // Only show error if user has typed something
    if (text.trim().length > 0) {
      const error = validatePhoneFormat(text);
      setPhoneError(error);
    } else {
      setPhoneError(null);
    }
  }, []);

  // Validate form before confirming
  const isFormValid = useCallback(() => {
    if (!beneficiaryName.trim()) return false;
    if (!beneficiaryPhone.trim()) return false;
    if (validatePhoneFormat(beneficiaryPhone) !== null) return false;
    if (!pickupPoint) return false;
    if (!destinationPoint) return false;

    // Validate payment configuration
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
      const expected = Math.round(estimatedFare * 100) / 100;
      if (sum !== expected) {
        return false;
      }
    }

    return true;
  }, [
    beneficiaryName,
    beneficiaryPhone,
    pickupPoint,
    destinationPoint,
    paymentConfig,
    estimatedFare,
  ]);

  const handleConfirm = useCallback(async () => {
    if (!isFormValid() || !pickupPoint || !destinationPoint) return;

    setIsConfirming(true);

    try {
      logInfo('DelegatedRideModal', 'Creating delegated ride', {
        beneficiaryName: beneficiaryName.trim(),
        beneficiaryPhone: beneficiaryPhone.trim(),
        paymentMode: paymentConfig.mode,
      });

      // Call the API to create the delegated ride
      const response = await delegatedRidesAPI.create({
        beneficiaryName: beneficiaryName.trim(),
        beneficiaryPhone: beneficiaryPhone.trim(),
        pickupPoint,
        destinationPoint,
        paymentConfig: {
          mode: paymentConfig.mode,
          cashAmount: paymentConfig.cashAmount,
          pagoMovilAmount: paymentConfig.pagoMovilAmount,
          pagoMovilReference:
            paymentConfig.mode === 'pago_movil' || paymentConfig.mode === 'dual'
              ? 'REF-' + Date.now() // Placeholder - in real app, this would come from payment flow
              : undefined,
        },
      });

      const rideId = response.data.rideId;

      logInfo('DelegatedRideModal', 'Delegated ride created successfully', { rideId });

      // Show success message
      Alert.alert(
        '✅ Viaje Solicitado',
        `El viaje para ${beneficiaryName.trim()} ha sido solicitado exitosamente.\n\n` +
          `El conductor contactará al beneficiario al número ${beneficiaryPhone.trim()}.\n\n` +
          `Puedes seguir el estado del viaje en tiempo real.`,
        [
          {
            text: 'Ver Viaje',
            onPress: () => {
              onSuccess(rideId);
            },
          },
        ]
      );
    } catch (error: any) {
      logError('DelegatedRideModal', error, { context: 'Creating delegated ride' });

      // Handle specific error cases
      let errorMessage = 'No se pudo solicitar el viaje. Por favor, intenta nuevamente.';

      if (error.response?.status === 422) {
        // Validation error
        const serverMessage = error.response?.data?.error?.message;
        if (serverMessage) {
          errorMessage = serverMessage;
        } else {
          errorMessage = 'Los datos ingresados no son válidos. Verifica e intenta nuevamente.';
        }
      } else if (error.response?.status === 402) {
        // Payment processing error
        errorMessage =
          'El pago no pudo ser procesado. Verifica tu método de pago e intenta nuevamente.';
      } else if (error.response?.status === 404) {
        // Not found (e.g., requester not found)
        errorMessage = 'No se pudo verificar tu cuenta. Por favor, inicia sesión nuevamente.';
      } else if (error.response?.status === 401) {
        // Unauthorized
        errorMessage = 'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.';
      } else if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        // Timeout
        errorMessage = 'La solicitud tardó demasiado. Verifica tu conexión e intenta nuevamente.';
      } else if (!error.response) {
        // Network error
        errorMessage = 'No hay conexión a internet. Verifica tu conexión e intenta nuevamente.';
      }

      Alert.alert('Error', errorMessage, [{ text: 'OK' }]);
    } finally {
      setIsConfirming(false);
    }
  }, [
    isFormValid,
    beneficiaryName,
    beneficiaryPhone,
    pickupPoint,
    destinationPoint,
    paymentConfig,
    onSuccess,
  ]);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 24) }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Ionicons name="person-add-outline" size={24} color={Colors.primary} />
              <Text style={styles.title}>Pedir Viaje Para Otro</Text>
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
            Solicita un viaje para una persona que no tiene la aplicación. Tú pagarás el viaje y el
            conductor contactará al beneficiario.
          </Text>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Beneficiary Information Card */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="person-outline" size={20} color={Colors.primary} />
                <Text style={styles.cardTitle}>Datos del Beneficiario</Text>
              </View>

              {/* Name input */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Nombre Completo *</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="person" size={18} color={Colors.mediumGray} />
                  <TextInput
                    style={styles.textInput}
                    value={beneficiaryName}
                    onChangeText={setBeneficiaryName}
                    placeholder="Ej: Juan Pérez"
                    placeholderTextColor={Colors.lightGray}
                    autoCapitalize="words"
                    autoCorrect={false}
                    editable={!isConfirming}
                    accessibilityLabel="Nombre completo del beneficiario"
                  />
                </View>
              </View>

              {/* Phone input */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Número de Teléfono *</Text>
                <View style={[styles.inputWrapper, phoneError && styles.inputWrapperError]}>
                  <Ionicons name="call" size={18} color={Colors.mediumGray} />
                  <TextInput
                    style={styles.textInput}
                    value={beneficiaryPhone}
                    onChangeText={handlePhoneChange}
                    placeholder="+58 414 1234567"
                    placeholderTextColor={Colors.lightGray}
                    keyboardType="phone-pad"
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!isConfirming}
                    accessibilityLabel="Número de teléfono del beneficiario"
                  />
                </View>
                {phoneError && (
                  <View style={styles.errorBox}>
                    <Ionicons name="alert-circle" size={14} color={Colors.error} />
                    <Text style={styles.errorText}>{phoneError}</Text>
                  </View>
                )}
                <Text style={styles.hintText}>
                  El conductor usará este número para contactar al beneficiario
                </Text>
              </View>
            </View>

            {/* Route Points Card */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="location-outline" size={20} color={Colors.primary} />
                <Text style={styles.cardTitle}>Puntos de Ruta</Text>
              </View>

              {/* Pickup point */}
              <TouchableOpacity
                style={styles.locationButton}
                onPress={onSelectPickup}
                disabled={isConfirming}
                accessibilityRole="button"
                accessibilityLabel="Seleccionar punto de recogida"
              >
                <View style={styles.locationIconContainer}>
                  <Ionicons
                    name="radio-button-on"
                    size={20}
                    color={pickupPoint ? Colors.success : Colors.mediumGray}
                  />
                </View>
                <View style={styles.locationInfo}>
                  <Text style={styles.locationLabel}>Punto de Recogida</Text>
                  {pickupPoint ? (
                    <Text style={styles.locationAddress} numberOfLines={2}>
                      {pickupPoint.address}
                    </Text>
                  ) : (
                    <Text style={styles.locationPlaceholder}>Toca para seleccionar en el mapa</Text>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={20} color={Colors.mediumGray} />
              </TouchableOpacity>

              {/* Destination point */}
              <TouchableOpacity
                style={styles.locationButton}
                onPress={onSelectDestination}
                disabled={isConfirming}
                accessibilityRole="button"
                accessibilityLabel="Seleccionar punto de destino"
              >
                <View style={styles.locationIconContainer}>
                  <Ionicons
                    name="location"
                    size={20}
                    color={destinationPoint ? Colors.error : Colors.mediumGray}
                  />
                </View>
                <View style={styles.locationInfo}>
                  <Text style={styles.locationLabel}>Punto de Destino</Text>
                  {destinationPoint ? (
                    <Text style={styles.locationAddress} numberOfLines={2}>
                      {destinationPoint.address}
                    </Text>
                  ) : (
                    <Text style={styles.locationPlaceholder}>Toca para seleccionar en el mapa</Text>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={20} color={Colors.mediumGray} />
              </TouchableOpacity>
            </View>

            {/* Fare Card */}
            {pickupPoint && destinationPoint && estimatedFare > 0 && (
              <View style={styles.fareCard}>
                <View style={styles.fareCardHeader}>
                  <Ionicons name="cash-outline" size={20} color={Colors.primary} />
                  <Text style={styles.fareCardTitle}>Tarifa Estimada</Text>
                </View>
                <View style={styles.fareRow}>
                  <Text style={styles.fareLabel}>Total a Pagar</Text>
                  <Text style={styles.fareValue}>{formatCurrency(estimatedFare, currency)}</Text>
                </View>
              </View>
            )}

            {/* Payment Method Card */}
            {pickupPoint && destinationPoint && estimatedFare > 0 && (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Ionicons name="wallet-outline" size={20} color={Colors.primary} />
                  <Text style={styles.cardTitle}>Tu Método de Pago</Text>
                </View>
                <DualPaymentSelector
                  totalFare={estimatedFare}
                  value={paymentConfig}
                  onChange={setPaymentConfig}
                  disabled={isConfirming}
                />
                <View style={styles.infoBox}>
                  <Ionicons name="information-circle-outline" size={16} color={Colors.primary} />
                  <Text style={styles.infoText}>
                    Tú pagarás el viaje completo. El beneficiario no necesita tener la aplicación.
                  </Text>
                </View>
              </View>
            )}

            {/* Important Notice */}
            <View style={styles.noticeCard}>
              <Ionicons name="alert-circle-outline" size={20} color="#f59e0b" />
              <Text style={styles.noticeText}>
                <Text style={styles.noticeTextBold}>Importante:</Text> El beneficiario no recibirá
                notificaciones automáticas. Asegúrate de informarle sobre el viaje y coordinar la
                recogida.
              </Text>
            </View>
          </ScrollView>

          {/* Confirm Button */}
          <TouchableOpacity
            style={[
              styles.confirmButton,
              (!isFormValid() || isConfirming) && styles.confirmButtonDisabled,
            ]}
            onPress={handleConfirm}
            disabled={!isFormValid() || isConfirming}
            accessibilityRole="button"
            accessibilityLabel="Confirmar viaje delegado"
          >
            {isConfirming ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                <Text style={styles.confirmButtonText}>Confirmar Viaje</Text>
              </>
            )}
          </TouchableOpacity>
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
  closeButton: {
    padding: 4,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.mediumGray,
    lineHeight: 18,
    marginBottom: 20,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    gap: 16,
    paddingBottom: 16,
  },
  card: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.darkGray,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.darkGray,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: '#d1d5db',
    gap: 10,
  },
  inputWrapperError: {
    borderColor: Colors.error,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.darkGray,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    color: Colors.error,
  },
  hintText: {
    fontSize: 12,
    color: Colors.mediumGray,
    marginTop: 4,
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#d1d5db',
    gap: 12,
  },
  locationIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f9fafb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationInfo: {
    flex: 1,
    gap: 4,
  },
  locationLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.mediumGray,
  },
  locationAddress: {
    fontSize: 14,
    color: Colors.darkGray,
    lineHeight: 18,
  },
  locationPlaceholder: {
    fontSize: 14,
    color: Colors.lightGray,
    fontStyle: 'italic',
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
    marginBottom: 8,
  },
  fareCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.darkGray,
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
    fontSize: 18,
    fontWeight: '700',
    color: Colors.primary,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: '#1e40af',
    lineHeight: 16,
  },
  noticeCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#fffbeb',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  noticeText: {
    flex: 1,
    fontSize: 13,
    color: '#92400e',
    lineHeight: 18,
  },
  noticeTextBold: {
    fontWeight: '700',
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
});
