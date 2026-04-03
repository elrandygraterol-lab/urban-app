import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface MobilePaymentModalProps {
  visible: boolean;
  amount: number;
  rideId: string;
  onPaymentComplete: (paymentData: {
    method: 'mobile_payment' | 'transfer' | 'cash';
    referenceNumber?: string;
    phoneNumber?: string;
    accountNumber?: string;
    bankName?: string;
  }) => void;
  onCancel: () => void;
}

// Datos de prueba para el pago móvil
const TEST_PAYMENT_DATA = {
  mobile: {
    bankPhone: '0414-1234567',
    referenceNumber: '123456789',
    bankName: 'Banco de Venezuela',
  },
  transfer: {
    accountNumber: '01020123456789012345',
    referenceNumber: '987654321',
    bankName: 'Banesco',
  },
};

type PaymentMethod = 'mobile' | 'transfer' | 'cash';

const INITIAL_TIME = 5 * 60; // 5 minutos en segundos
const EXTENSION_TIME = 3 * 60; // 3 minutos en segundos
const MAX_EXTENSIONS = 3;

export default function MobilePaymentModal({
  visible,
  amount,
  rideId,
  onPaymentComplete,
  onCancel,
}: MobilePaymentModalProps) {
  const insets = useSafeAreaInsets();
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('mobile');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [selectedBank, setSelectedBank] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showTestData, setShowTestData] = useState(true);

  // Timer states
  const [timeRemaining, setTimeRemaining] = useState(INITIAL_TIME);
  const [extensionsUsed, setExtensionsUsed] = useState(0);
  const [isTimerActive, setIsTimerActive] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const banks = [
    { id: 'banesco', name: 'Banesco', phone: '0134', account: '0134' },
    { id: 'venezuela', name: 'Banco de Venezuela', phone: '0102', account: '0102' },
    { id: 'mercantil', name: 'Mercantil', phone: '0105', account: '0105' },
    { id: 'provincial', name: 'Provincial', phone: '0108', account: '0108' },
  ];

  // Timer effect
  useEffect(() => {
    if (visible && paymentMethod !== 'cash') {
      setIsTimerActive(true);
      setTimeRemaining(INITIAL_TIME);
      setExtensionsUsed(0);
    } else {
      setIsTimerActive(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [visible, paymentMethod]);

  useEffect(() => {
    if (isTimerActive && paymentMethod !== 'cash') {
      timerRef.current = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            if (timerRef.current) {
              clearInterval(timerRef.current);
            }
            setIsTimerActive(false);
            handleTimeExpired();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => {
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
      };
    }
  }, [isTimerActive, paymentMethod]);

  const handleTimeExpired = () => {
    Alert.alert(
      'Tiempo Agotado',
      'El tiempo para completar el pago ha expirado. El viaje será cancelado.',
      [
        {
          text: 'OK',
          onPress: () => {
            resetForm();
            onCancel();
          },
        },
      ]
    );
  };

  const handleExtendTime = () => {
    if (extensionsUsed >= MAX_EXTENSIONS) {
      Alert.alert('Límite Alcanzado', 'Has alcanzado el límite máximo de extensiones de tiempo.', [
        { text: 'OK' },
      ]);
      return;
    }

    Alert.alert(
      'Extender Tiempo',
      `¿Deseas extender el tiempo por ${EXTENSION_TIME / 60} minutos adicionales?\n\nExtensiones usadas: ${extensionsUsed}/${MAX_EXTENSIONS}`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Extender',
          onPress: () => {
            setTimeRemaining(prev => prev + EXTENSION_TIME);
            setExtensionsUsed(prev => prev + 1);
            Alert.alert(
              'Tiempo Extendido',
              `Se han agregado ${EXTENSION_TIME / 60} minutos adicionales.`,
              [{ text: 'OK' }]
            );
          },
        },
      ]
    );
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getTimerColor = (): string => {
    if (timeRemaining > 180) return Colors.primary; // > 3 min: verde
    if (timeRemaining > 60) return Colors.orange; // > 1 min: naranja
    return Colors.error; // <= 1 min: rojo
  };

  const handleUseTestData = () => {
    if (paymentMethod === 'mobile') {
      setPhoneNumber(TEST_PAYMENT_DATA.mobile.bankPhone);
      setReferenceNumber(TEST_PAYMENT_DATA.mobile.referenceNumber);
      setSelectedBank('venezuela');
    } else if (paymentMethod === 'transfer') {
      setAccountNumber(TEST_PAYMENT_DATA.transfer.accountNumber);
      setReferenceNumber(TEST_PAYMENT_DATA.transfer.referenceNumber);
      setSelectedBank('banesco');
    }
    setShowTestData(false);
  };

  const resetForm = () => {
    setPhoneNumber('');
    setReferenceNumber('');
    setAccountNumber('');
    setSelectedBank('');
    setShowTestData(true);
    setPaymentMethod('mobile');
    setTimeRemaining(INITIAL_TIME);
    setExtensionsUsed(0);
    setIsTimerActive(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
  };

  const handleSubmitPayment = async () => {
    // Validar según método de pago
    if (paymentMethod === 'cash') {
      // Efectivo no requiere validación
      Alert.alert(
        'Pago en Efectivo',
        `Pagarás Bs. ${amount.toFixed(2)} en efectivo al conductor al finalizar el viaje.`,
        [
          {
            text: 'Confirmar',
            onPress: () => {
              const paymentData = {
                method: 'cash' as const,
              };
              resetForm();
              onPaymentComplete(paymentData);
            },
          },
          { text: 'Cancelar', style: 'cancel' },
        ]
      );
      return;
    }

    if (paymentMethod === 'mobile') {
      // Validar pago móvil
      if (!phoneNumber || !referenceNumber || !selectedBank) {
        Alert.alert('Error', 'Por favor completa todos los campos');
        return;
      }

      if (phoneNumber.length < 10) {
        Alert.alert('Error', 'Número de teléfono inválido');
        return;
      }

      if (referenceNumber.length < 6) {
        Alert.alert('Error', 'Número de referencia inválido');
        return;
      }
    } else if (paymentMethod === 'transfer') {
      // Validar transferencia
      if (!accountNumber || !referenceNumber || !selectedBank) {
        Alert.alert('Error', 'Por favor completa todos los campos');
        return;
      }

      if (accountNumber.length < 20) {
        Alert.alert('Error', 'Número de cuenta inválido');
        return;
      }

      if (referenceNumber.length < 6) {
        Alert.alert('Error', 'Número de referencia inválido');
        return;
      }
    }

    setIsProcessing(true);

    // Simular procesamiento de pago (2 segundos)
    setTimeout(() => {
      setIsProcessing(false);

      const methodName = paymentMethod === 'mobile' ? 'Pago Móvil' : 'Transferencia';
      const selectedBankData = banks.find(b => b.id === selectedBank);

      // Preparar datos del pago
      const paymentData = {
        method: paymentMethod === 'mobile' ? ('mobile_payment' as const) : ('transfer' as const),
        referenceNumber,
        phoneNumber: paymentMethod === 'mobile' ? phoneNumber : undefined,
        accountNumber: paymentMethod === 'transfer' ? accountNumber : undefined,
        bankName: selectedBankData?.name,
      };

      // Simular pago exitoso
      Alert.alert(
        'Pago Exitoso',
        `Tu ${methodName} de Bs. ${amount.toFixed(2)} ha sido procesado correctamente.\n\nReferencia: ${referenceNumber}`,
        [
          {
            text: 'OK',
            onPress: () => {
              resetForm();
              onPaymentComplete(paymentData);
            },
          },
        ]
      );
    }, 2000);
  };

  const handleCancel = () => {
    Alert.alert(
      'Cancelar Pago',
      '¿Estás seguro de que deseas cancelar el pago? El viaje será cancelado si no completas el pago.',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Sí, Cancelar',
          style: 'destructive',
          onPress: () => {
            resetForm();
            onCancel();
          },
        },
      ]
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={handleCancel}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <ScrollView contentContainerStyle={styles.scrollContent}>
            {/* Header */}
            <View style={styles.header}>
              <Ionicons name="card-outline" size={48} color={Colors.primary} />
              <Text style={styles.title}>Confirmar Pago</Text>
              <Text style={styles.subtitle}>Selecciona tu método de pago preferido</Text>
            </View>

            {/* Timer - Solo para pago móvil y transferencia */}
            {paymentMethod !== 'cash' && (
              <View style={[styles.timerContainer, { borderColor: getTimerColor() }]}>
                <View style={styles.timerContent}>
                  <Ionicons name="time-outline" size={24} color={getTimerColor()} />
                  <View style={styles.timerTextContainer}>
                    <Text style={styles.timerLabel}>Tiempo restante</Text>
                    <Text style={[styles.timerValue, { color: getTimerColor() }]}>
                      {formatTime(timeRemaining)}
                    </Text>
                  </View>
                </View>
                {extensionsUsed < MAX_EXTENSIONS && (
                  <TouchableOpacity style={styles.extendButton} onPress={handleExtendTime}>
                    <Ionicons name="add-circle-outline" size={20} color={Colors.primary} />
                    <Text style={styles.extendButtonText}>
                      Extender ({extensionsUsed}/{MAX_EXTENSIONS})
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Amount */}
            <View style={styles.amountContainer}>
              <Text style={styles.amountLabel}>Monto a Pagar</Text>
              <Text style={styles.amountValue}>Bs. {amount.toFixed(2)}</Text>
            </View>

            {/* Payment Method Selection */}
            <View style={styles.section}>
              <Text style={styles.label}>Método de Pago</Text>
              <View style={styles.paymentMethodGrid}>
                <TouchableOpacity
                  style={[
                    styles.paymentMethodButton,
                    paymentMethod === 'mobile' && styles.paymentMethodButtonSelected,
                  ]}
                  onPress={() => {
                    setPaymentMethod('mobile');
                    setShowTestData(true);
                  }}
                >
                  <Ionicons
                    name="phone-portrait-outline"
                    size={32}
                    color={paymentMethod === 'mobile' ? Colors.primary : Colors.mediumGray}
                  />
                  <Text
                    style={[
                      styles.paymentMethodText,
                      paymentMethod === 'mobile' && styles.paymentMethodTextSelected,
                    ]}
                  >
                    Pago Móvil
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.paymentMethodButton,
                    paymentMethod === 'transfer' && styles.paymentMethodButtonSelected,
                  ]}
                  onPress={() => {
                    setPaymentMethod('transfer');
                    setShowTestData(true);
                  }}
                >
                  <Ionicons
                    name="swap-horizontal-outline"
                    size={32}
                    color={paymentMethod === 'transfer' ? Colors.primary : Colors.mediumGray}
                  />
                  <Text
                    style={[
                      styles.paymentMethodText,
                      paymentMethod === 'transfer' && styles.paymentMethodTextSelected,
                    ]}
                  >
                    Transferencia
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.paymentMethodButton,
                    paymentMethod === 'cash' && styles.paymentMethodButtonSelected,
                  ]}
                  onPress={() => setPaymentMethod('cash')}
                >
                  <Ionicons
                    name="cash-outline"
                    size={32}
                    color={paymentMethod === 'cash' ? Colors.primary : Colors.mediumGray}
                  />
                  <Text
                    style={[
                      styles.paymentMethodText,
                      paymentMethod === 'cash' && styles.paymentMethodTextSelected,
                    ]}
                  >
                    Efectivo
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Cash Payment Info */}
            {paymentMethod === 'cash' && (
              <View style={styles.cashInfoBox}>
                <Ionicons name="information-circle" size={24} color={Colors.orange} />
                <Text style={styles.cashInfoText}>
                  Pagarás en efectivo al conductor al finalizar el viaje.
                </Text>
              </View>
            )}

            {/* Test Data Banner - Solo para pago móvil y transferencia */}
            {paymentMethod !== 'cash' && showTestData && (
              <TouchableOpacity style={styles.testDataBanner} onPress={handleUseTestData}>
                <Ionicons name="information-circle" size={24} color={Colors.primary} />
                <View style={styles.testDataText}>
                  <Text style={styles.testDataTitle}>Modo de Prueba</Text>
                  <Text style={styles.testDataSubtitle}>Toca aquí para usar datos de prueba</Text>
                </View>
                <Ionicons name="chevron-forward" size={24} color={Colors.primary} />
              </TouchableOpacity>
            )}

            {/* Payment Forms */}
            {paymentMethod === 'mobile' && (
              <>
                {/* Bank Selection - Dropdown Style */}
                <View style={styles.section}>
                  <Text style={styles.label}>Banco</Text>
                  <View style={styles.bankDropdownContainer}>
                    {banks.map(bank => (
                      <TouchableOpacity
                        key={bank.id}
                        style={[
                          styles.bankButton,
                          selectedBank === bank.id && styles.bankButtonSelected,
                        ]}
                        onPress={() => setSelectedBank(bank.id)}
                      >
                        <View style={styles.bankButtonContent}>
                          <Text
                            style={[
                              styles.bankButtonText,
                              selectedBank === bank.id && styles.bankButtonTextSelected,
                            ]}
                          >
                            {bank.name}
                          </Text>
                          <Text style={styles.bankCode}>{bank.phone}</Text>
                        </View>
                        {selectedBank === bank.id && (
                          <Ionicons name="checkmark-circle" size={24} color={Colors.primary} />
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Phone Number */}
                <View style={styles.section}>
                  <Text style={styles.label}>Teléfono del Banco</Text>
                  <View style={styles.inputContainer}>
                    <Ionicons name="call-outline" size={20} color={Colors.mediumGray} />
                    <TextInput
                      style={styles.input}
                      placeholder="0414-1234567"
                      value={phoneNumber}
                      onChangeText={setPhoneNumber}
                      keyboardType="phone-pad"
                      maxLength={15}
                    />
                  </View>
                </View>

                {/* Reference Number */}
                <View style={styles.section}>
                  <Text style={styles.label}>Número de Referencia</Text>
                  <View style={styles.inputContainer}>
                    <Ionicons name="document-text-outline" size={20} color={Colors.mediumGray} />
                    <TextInput
                      style={styles.input}
                      placeholder="123456789"
                      value={referenceNumber}
                      onChangeText={setReferenceNumber}
                      keyboardType="number-pad"
                      maxLength={20}
                    />
                  </View>
                </View>
              </>
            )}

            {paymentMethod === 'transfer' && (
              <>
                {/* Bank Selection - Dropdown Style */}
                <View style={styles.section}>
                  <Text style={styles.label}>Banco</Text>
                  <View style={styles.bankDropdownContainer}>
                    {banks.map(bank => (
                      <TouchableOpacity
                        key={bank.id}
                        style={[
                          styles.bankButton,
                          selectedBank === bank.id && styles.bankButtonSelected,
                        ]}
                        onPress={() => setSelectedBank(bank.id)}
                      >
                        <View style={styles.bankButtonContent}>
                          <Text
                            style={[
                              styles.bankButtonText,
                              selectedBank === bank.id && styles.bankButtonTextSelected,
                            ]}
                          >
                            {bank.name}
                          </Text>
                          <Text style={styles.bankCode}>{bank.account}</Text>
                        </View>
                        {selectedBank === bank.id && (
                          <Ionicons name="checkmark-circle" size={24} color={Colors.primary} />
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Account Number */}
                <View style={styles.section}>
                  <Text style={styles.label}>Número de Cuenta</Text>
                  <View style={styles.inputContainer}>
                    <Ionicons name="card-outline" size={20} color={Colors.mediumGray} />
                    <TextInput
                      style={styles.input}
                      placeholder="01020123456789012345"
                      value={accountNumber}
                      onChangeText={setAccountNumber}
                      keyboardType="number-pad"
                      maxLength={20}
                    />
                  </View>
                </View>

                {/* Reference Number */}
                <View style={styles.section}>
                  <Text style={styles.label}>Número de Referencia</Text>
                  <View style={styles.inputContainer}>
                    <Ionicons name="document-text-outline" size={20} color={Colors.mediumGray} />
                    <TextInput
                      style={styles.input}
                      placeholder="987654321"
                      value={referenceNumber}
                      onChangeText={setReferenceNumber}
                      keyboardType="number-pad"
                      maxLength={20}
                    />
                  </View>
                </View>
              </>
            )}

            {/* Info Box */}
            {paymentMethod !== 'cash' && (
              <View style={styles.infoBox}>
                <Ionicons name="information-circle-outline" size={20} color={Colors.primary} />
                <Text style={styles.infoText}>
                  El pago será verificado automáticamente. Asegúrate de ingresar los datos
                  correctos.
                </Text>
              </View>
            )}
          </ScrollView>

          {/* Actions */}
          <View style={[styles.actions, { paddingBottom: Math.max(insets.bottom, 24) }]}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleCancel}
              disabled={isProcessing}
            >
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.submitButton, isProcessing && styles.submitButtonDisabled]}
              onPress={handleSubmitPayment}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Text style={styles.submitButtonText}>Confirmar Pago</Text>
                  <Ionicons name="checkmark-circle" size={20} color="#fff" />
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

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
  },
  scrollContent: {
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginTop: 12,
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
    textAlign: 'center',
  },
  timerContainer: {
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  timerTextContainer: {
    marginLeft: 12,
  },
  timerLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  timerValue: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 2,
  },
  extendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 4,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  extendButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
  },
  amountContainer: {
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 24,
  },
  amountLabel: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
    fontWeight: '500',
  },
  amountValue: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.primary,
  },
  paymentMethodGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  paymentMethodButton: {
    flex: 1,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    gap: 8,
  },
  paymentMethodButtonSelected: {
    borderColor: Colors.primary,
    backgroundColor: '#f0fdf4',
  },
  paymentMethodText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
  },
  paymentMethodTextSelected: {
    color: Colors.primary,
    fontWeight: '700',
  },
  cashInfoBox: {
    flexDirection: 'row',
    backgroundColor: '#fff7ed',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    gap: 12,
  },
  cashInfoText: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
    lineHeight: 20,
    fontWeight: '500',
  },
  testDataBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  testDataText: {
    flex: 1,
    marginLeft: 12,
  },
  testDataTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  testDataSubtitle: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  section: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  bankGrid: {
    gap: 12,
  },
  bankDropdownContainer: {
    gap: 10,
  },
  bankButton: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bankButtonSelected: {
    borderColor: Colors.primary,
    backgroundColor: '#f0fdf4',
  },
  bankButtonContent: {
    flex: 1,
  },
  bankButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  bankButtonTextSelected: {
    color: Colors.primary,
    fontWeight: '700',
  },
  bankCode: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  input: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: '#111827',
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#111827',
    lineHeight: 18,
    fontWeight: '500',
  },
  actions: {
    flexDirection: 'row',
    padding: 24,
    paddingTop: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6b7280',
  },
  submitButton: {
    flex: 2,
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
});
