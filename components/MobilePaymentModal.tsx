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
import { paymentAPI } from '@/services/api';
import { formatCurrency, Currency } from '@/utils/currency';

interface PlatformPaymentMethod {
  id: string;
  name: string;
  type: 'pago_movil' | 'bank_transfer';
  mobilePhone?: string;
  mobileCedula?: string;
  mobileBank?: string;
  accountNumber?: string;
  accountType?: string;
  transferCedula?: string;
  transferBank?: string;
  description?: string;
  isActive: boolean;
}

interface MobilePaymentModalProps {
  visible: boolean;
  amount: number;
  currency?: Currency;
  exchangeRate?: number;
  rideId: string;
  platformMethod?: PlatformPaymentMethod;
  onPaymentComplete: (paymentData: {
    method: 'mobile_payment' | 'cash';
    referenceNumber?: string;
    phoneNumber?: string;
    bankName?: string;
    // P2C specific fields
    referencia?: string;
    fecha?: string;
    banco?: string;
    telefonoP?: string;  // Usar telefonoP según documentación VOB
    identificacion?: string;  // Usar identificacion según documentación VOB
    pagador?: string;  // Usar pagador según documentación VOB
  }) => void;
  onCancel: () => void;
}

// Datos de prueba para el pago móvil
const TEST_PAYMENT_DATA = {
  mobile: {
    referencia: '123456',
    fecha: '15/12/2024',
    banco: '0102',
    telefonoP: '5844122144339',
    identificacion: 'V25213842',
    pagador: 'Juan Pérez',
  },
};

type PaymentMethod = 'mobile' | 'cash';

const INITIAL_TIME = 5 * 60; // 5 minutos en segundos
const EXTENSION_TIME = 3 * 60; // 3 minutos en segundos
const MAX_EXTENSIONS = 3;

export default function MobilePaymentModal({
  visible,
  amount,
  currency = 'VES',
  exchangeRate,
  rideId,
  platformMethod,
  onPaymentComplete,
  onCancel,
}: MobilePaymentModalProps) {
  const insets = useSafeAreaInsets();
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('mobile');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [selectedBank, setSelectedBank] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showTestData, setShowTestData] = useState(true);

  // P2C specific fields
  const [referencia, setReferencia] = useState('');
  const [fecha, setFecha] = useState('');
  const [telefonoP, setTelefonoP] = useState('');
  const [identificacion, setIdentificacion] = useState('');
  const [pagador, setPagador] = useState('');

  // Timer states
  const [timeRemaining, setTimeRemaining] = useState(INITIAL_TIME);
  const [extensionsUsed, setExtensionsUsed] = useState(0);
  const [isTimerActive, setIsTimerActive] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const otherCurrency: Currency = currency === 'USD' ? 'VES' : 'USD';
  const equivalentAmount =
    exchangeRate && exchangeRate > 0
      ? currency === 'USD'
        ? amount * exchangeRate
        : amount / exchangeRate
      : null;

  const banks = [
    { id: '0102', name: 'Banco de Venezuela', code: '0102' },
    { id: '0104', name: 'Venezolano de Crédito', code: '0104' },
    { id: '0105', name: 'Mercantil Banco', code: '0105' },
    { id: '0108', name: 'BBVA Provincial', code: '0108' },
    { id: '0114', name: 'Bancaribe', code: '0114' },
    { id: '0115', name: 'Banex', code: '0115' },
    { id: '0116', name: 'Banplus', code: '0116' },
    { id: '0128', name: 'Bancrecer', code: '0128' },
    { id: '0134', name: 'Banesco', code: '0134' },
    { id: '0137', name: 'Sofitasa', code: '0137' },
    { id: '0138', name: 'Banfanb', code: '0138' },
    { id: '0140', name: 'Banco del Sur', code: '0140' },
    { id: '0146', name: 'BanBif', code: '0146' },
    { id: '0149', name: 'Banco Exterior', code: '0149' },
    { id: '0151', name: 'BFC Banco Fondo Común', code: '0151' },
    { id: '0156', name: '100% Banco', code: '0156' },
    { id: '0157', name: 'DelSur', code: '0157' },
    { id: '0163', name: 'Banco del Tesoro', code: '0163' },
    { id: '0166', name: 'Banco Agrícola de Venezuela', code: '0166' },
    { id: '0168', name: 'Banvalu', code: '0168' },
    { id: '0169', name: 'Mi Banco', code: '0169' },
    { id: '0171', name: 'BOD', code: '0171' },
    { id: '0172', name: 'Banco Caroní', code: '0172' },
    { id: '0173', name: 'Banco Plaza', code: '0173' },
    { id: '0175', name: 'Banco Bicentenario', code: '0175' },
    { id: '0176', name: 'Bangente', code: '0176' },
    { id: '0190', name: 'Citibank', code: '0190' },
    { id: '0191', name: 'BNC', code: '0191' },
  ];

  // Timer effect - Solo para pago móvil
  useEffect(() => {
    if (visible && paymentMethod === 'mobile') {
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
    if (isTimerActive && paymentMethod === 'mobile') {
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
      // P2C test data - usando datos oficiales de la documentación VOB
      setReferencia(TEST_PAYMENT_DATA.mobile.referencia);
      setFecha(TEST_PAYMENT_DATA.mobile.fecha);
      setSelectedBank(TEST_PAYMENT_DATA.mobile.banco);
      setTelefonoP(TEST_PAYMENT_DATA.mobile.telefonoP);
      setIdentificacion(TEST_PAYMENT_DATA.mobile.identificacion);
      setPagador(TEST_PAYMENT_DATA.mobile.pagador);
    }
    setShowTestData(false);
  };

  const resetForm = () => {
    setPhoneNumber('');
    setReferenceNumber('');
    setSelectedBank('');
    setShowTestData(true);
    setPaymentMethod('mobile');
    setTimeRemaining(INITIAL_TIME);
    setExtensionsUsed(0);
    setIsTimerActive(false);
    // Reset P2C fields
    setReferencia('');
    setFecha('');
    setTelefonoP('');
    setIdentificacion('');
    setPagador('');
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
        `Pagarás ${formatCurrency(amount, currency)} en efectivo al conductor al finalizar el viaje.`,
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
      // Validar pago móvil P2C
      if (!referencia || !fecha || !selectedBank || !telefonoP || !identificacion || !pagador) {
        Alert.alert('Error', 'Por favor completa todos los campos del Pago Móvil');
        return;
      }

      // Validar referencia de 6 dígitos
      if (referencia.length !== 6 || !/^\d{6}$/.test(referencia)) {
        Alert.alert('Error', 'La referencia debe tener exactamente 6 dígitos numéricos');
        return;
      }

      if (telefonoP.length < 10) {
        Alert.alert('Error', 'Número de teléfono inválido');
        return;
      }

      if (identificacion.length < 6) {
        Alert.alert('Error', 'Identificación inválida');
        return;
      }

      if (pagador.trim().length < 2) {
        Alert.alert('Error', 'Nombre del pagador inválido');
        return;
      }
    }

    setIsProcessing(true);

    try {
      if (paymentMethod === 'mobile') {
        const selectedBankData = banks.find(b => b.id === selectedBank);

        // Call P2C verification API - Requisito 2.1
        const response = await paymentAPI.verifyP2CPayment(rideId, {
          referencia,
          fecha,
          banco: selectedBankData?.code || selectedBank,
          telefonoP,
          monto: amount,
          identificacion,
          pagador,
        });

        console.log('✅ P2C Payment verified:', response.data);

        // Preparar datos del pago P2C
        const paymentData = {
          method: 'mobile_payment' as const,
          referencia,
          fecha,
          banco: selectedBankData?.code || selectedBank,
          telefonoP,
          monto: amount,
          identificacion,
          pagador,
        };

        // Show success message - Requisito 2.2 (200 response)
        Alert.alert(
          'Pago Verificado',
          `Tu Pago Móvil de ${formatCurrency(amount, currency)} ha sido verificado exitosamente.\n\nReferencia: ${referencia}`,
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
      }
    } catch (error: any) {
      console.error('Payment processing error:', error);
      
      // Handle different error responses according to requirements
      let errorMessage = 'Error procesando el pago. Por favor intenta nuevamente.';
      let showRetry = true;

      if (error.response) {
        const status = error.response.status;
        const data = error.response.data;

        switch (status) {
          case 422:
            // Pago rechazado (Requisitos 2.3, 2.6, 2.7, 2.8)
            // Handles: status="R"/"RM", E001, E010, E021 errors
            errorMessage = data.message || 'Pago rechazado por el banco. Verifica los datos ingresados.';
            showRetry = false;
            break;
          case 409:
            // Pago ya procesado (Requisito 2.4)
            // Handles: BVC-PAID error
            errorMessage = 'Este pago ya ha sido procesado anteriormente.';
            showRetry = false;
            break;
          case 404:
            // Pago no encontrado (Requisito 2.5)
            // Handles: PAYMENT-NOT-FOUND error
            errorMessage = 'El pago no fue encontrado en el banco. Verifica los datos.';
            showRetry = false;
            break;
          case 503:
            // Servicio no disponible (Requisito 8.5)
            // Handles: VOB system unavailable
            errorMessage = 'El servicio de pagos no está disponible. Por favor intenta más tarde.';
            showRetry = true;
            break;
          default:
            errorMessage = data.message || errorMessage;
        }
      }

      const alertButtons: any[] = [
        { text: 'OK', style: 'cancel' as const },
      ];

      if (showRetry) {
        alertButtons.unshift({
          text: 'Reintentar',
          onPress: handleSubmitPayment,
        });
      }

      Alert.alert('Error de Pago', errorMessage, alertButtons);
    } finally {
      setIsProcessing(false);
    }
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

            {/* Timer - Solo para pago móvil */}
            {paymentMethod === 'mobile' && (
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
              <Text style={styles.amountValue}>{formatCurrency(amount, currency)}</Text>
              {equivalentAmount !== null && (
                <Text style={styles.amountEquivalent}>
                  {formatCurrency(equivalentAmount, otherCurrency)}
                  {'  '}
                  <Text style={styles.amountRate}>
                    (@ {exchangeRate!.toFixed(2)})
                  </Text>
                </Text>
              )}
            </View>

            {/* Payment Method Selection - Solo Pago Móvil y Efectivo */}
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
                  <Text style={styles.paymentMethodSubtext}>
                    Verificación automática
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
                  <Text style={styles.paymentMethodSubtext}>
                    Pagar al conductor
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

            {/* Test Data Banner - Solo para pago móvil */}
            {paymentMethod === 'mobile' && showTestData && (
              <TouchableOpacity style={styles.testDataBanner} onPress={handleUseTestData}>
                <Ionicons name="information-circle" size={24} color={Colors.primary} />
                <View style={styles.testDataText}>
                  <Text style={styles.testDataTitle}>Modo de Prueba</Text>
                  <Text style={styles.testDataSubtitle}>Toca aquí para usar datos de prueba</Text>
                </View>
                <Ionicons name="chevron-forward" size={24} color={Colors.primary} />
              </TouchableOpacity>
            )}

            {/* Payment Forms - Solo Pago Móvil */}
            {paymentMethod === 'mobile' && (
              <>
                {/* Admin-configured account info */}
                {platformMethod && platformMethod.type === 'pago_movil' && (
                  <View style={styles.destinationInfoBox}>
                    <View style={styles.destinationHeader}>
                      <Ionicons name="phone-portrait" size={20} color={Colors.primary} />
                      <Text style={styles.destinationTitle}>Paga con Pago Móvil a:</Text>
                    </View>
                    <Text style={styles.destinationText}>
                      {platformMethod.mobileBank}
                    </Text>
                    <Text style={styles.destinationDetail}>
                      Teléfono: {platformMethod.mobilePhone}
                    </Text>
                    <Text style={styles.destinationDetail}>
                      Cédula: {platformMethod.mobileCedula}
                    </Text>
                    {platformMethod.description && (
                      <Text style={styles.destinationDetail}>
                        {platformMethod.description}
                      </Text>
                    )}
                  </View>
                )}

                {/* Admin-configured bank transfer info */}
                {platformMethod && platformMethod.type === 'bank_transfer' && (
                  <View style={styles.destinationInfoBox}>
                    <View style={styles.destinationHeader}>
                      <Ionicons name="business" size={20} color={Colors.primary} />
                      <Text style={styles.destinationTitle}>Transfiere a:</Text>
                    </View>
                    <Text style={styles.destinationText}>
                      {platformMethod.transferBank}
                    </Text>
                    <Text style={styles.destinationDetail}>
                      Cuenta: {platformMethod.accountNumber}
                    </Text>
                    <Text style={styles.destinationDetail}>
                      Tipo: {platformMethod.accountType || 'Corriente'}
                    </Text>
                    <Text style={styles.destinationDetail}>
                      Cédula/RIF: {platformMethod.transferCedula}
                    </Text>
                    {platformMethod.description && (
                      <Text style={styles.destinationDetail}>
                        {platformMethod.description}
                      </Text>
                    )}
                  </View>
                )}

                {/* Bank Selection - Scrollable Picker */}
                <View style={styles.section}>
                  <Text style={styles.label}>Banco</Text>
                  <ScrollView style={styles.bankDropdownContainer} nestedScrollEnabled>
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
                          <Text style={styles.bankCode}>{bank.code}</Text>
                        </View>
                        {selectedBank === bank.id && (
                          <Ionicons name="checkmark-circle" size={24} color={Colors.primary} />
                        )}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                {/* Referencia - 6 dígitos */}
                <View style={styles.section}>
                  <Text style={styles.label}>Referencia (6 dígitos)</Text>
                  <View style={styles.inputContainer}>
                    <Ionicons name="document-text-outline" size={20} color={Colors.mediumGray} />
                    <TextInput
                      style={styles.input}
                      placeholder="123456"
                      value={referencia}
                      onChangeText={setReferencia}
                      keyboardType="number-pad"
                      maxLength={6}
                    />
                  </View>
                </View>

                {/* Fecha */}
                <View style={styles.section}>
                  <Text style={styles.label}>Fecha (DD/MM/YYYY)</Text>
                  <View style={styles.inputContainer}>
                    <Ionicons name="calendar-outline" size={20} color={Colors.mediumGray} />
                    <TextInput
                      style={styles.input}
                      placeholder="15/12/2024"
                      value={fecha}
                      onChangeText={setFecha}
                      keyboardType="numeric"
                      maxLength={10}
                    />
                  </View>
                </View>

                {/* Teléfono */}
                <View style={styles.section}>
                  <Text style={styles.label}>Teléfono</Text>
                  <View style={styles.inputContainer}>
                    <Ionicons name="call-outline" size={20} color={Colors.mediumGray} />
                    <TextInput
                      style={styles.input}
                      placeholder="5844122144339"
                      value={telefonoP}
                      onChangeText={setTelefonoP}
                      keyboardType="phone-pad"
                      maxLength={15}
                    />
                  </View>
                </View>

                {/* Identificación */}
                <View style={styles.section}>
                  <Text style={styles.label}>Identificación</Text>
                  <View style={styles.inputContainer}>
                    <Ionicons name="card-outline" size={20} color={Colors.mediumGray} />
                    <TextInput
                      style={styles.input}
                      placeholder="V25213842"
                      value={identificacion}
                      onChangeText={setIdentificacion}
                      keyboardType="default"
                      maxLength={15}
                    />
                  </View>
                </View>

                {/* Nombre del Pagador */}
                <View style={styles.section}>
                  <Text style={styles.label}>Nombre del Pagador</Text>
                  <View style={styles.inputContainer}>
                    <Ionicons name="person-outline" size={20} color={Colors.mediumGray} />
                    <TextInput
                      style={styles.input}
                      placeholder="Juan Pérez"
                      value={pagador}
                      onChangeText={setPagador}
                      keyboardType="default"
                      maxLength={50}
                    />
                  </View>
                </View>
              </>
            )}

            {/* Info Box - Solo para pago móvil */}
            {paymentMethod === 'mobile' && (
              <View style={styles.infoBox}>
                <Ionicons name="information-circle-outline" size={20} color={Colors.primary} />
                <Text style={styles.infoText}>
                  El pago móvil será verificado automáticamente con el banco VOB. Asegúrate de 
                  ingresar los datos exactos de tu transacción.
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
  amountEquivalent: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6b7280',
    marginTop: 4,
  },
  amountRate: {
    fontSize: 12,
    color: '#9ca3af',
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
  paymentMethodSubtext: {
    fontSize: 10,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 2,
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
    maxHeight: 280,
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
  destinationInfoBox: {
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  destinationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  destinationTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.primary,
  },
  destinationText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  destinationDetail: {
    fontSize: 13,
    color: '#4b5563',
    marginTop: 2,
  },
});
