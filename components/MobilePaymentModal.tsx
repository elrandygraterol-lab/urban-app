import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Animated,
  Platform,
  Dimensions,
  FlatList,
  Pressable,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { paymentAPI, rideAPI } from '@/services/api';
import { formatCurrency, Currency } from '@/utils/currency';
import { useUnifiedNotifications } from '@/context/UnifiedNotificationContext';

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
  rideId?: string;
  passengerName?: string;
  platformMethod?: PlatformPaymentMethod;
  onPaymentComplete: (paymentData: {
    method: 'mobile_payment' | 'cash';
    referenceNumber?: string;
    phoneNumber?: string;
    bankName?: string;
    referencia?: string;
    fecha?: string;
    banco?: string;
    telefonoP?: string;
    identificacion?: string;
    pagador?: string;
  }) => void;
  onCancel: () => void;
  onBeforeCancel?: () => void;
}

type PaymentMethod = 'mobile' | 'cash';

const INITIAL_TIME = 5 * 60;
const EXTENSION_TIME = 3 * 60;
const MAX_EXTENSIONS = 3;

const VENEZUELAN_BANKS = [
  { id: '0102', name: 'Banco de Venezuela', code: '0102' },
  { id: '0104', name: 'Venezolano de Crédito', code: '0104' },
  { id: '0105', name: 'Mercantil', code: '0105' },
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
  { id: '0151', name: 'BFC', code: '0151' },
  { id: '0156', name: '100% Banco', code: '0156' },
  { id: '0157', name: 'DelSur', code: '0157' },
  { id: '0163', name: 'Banco del Tesoro', code: '0163' },
  { id: '0166', name: 'Banco Agrícola', code: '0166' },
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

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function getTimerColor(remaining: number): string {
  if (remaining > 180) return Colors.primary;
  if (remaining > 60) return Colors.orange;
  return Colors.error;
}

const SCREEN_WIDTH = Dimensions.get('window').width;

// ── Bank Selector Dropdown Component ──

function BankSelector({
  selectedBank,
  onSelectBank,
}: {
  selectedBank: string;
  onSelectBank: (id: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.92)).current;

  const selectedBankData = VENEZUELAN_BANKS.find((b) => b.id === selectedBank);

  const filteredBanks = useMemo(() => {
    if (!search.trim()) return VENEZUELAN_BANKS;
    const q = search.toLowerCase().trim();
    return VENEZUELAN_BANKS.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        b.code.includes(q)
    );
  }, [search]);

  const openDropdown = () => {
    setIsOpen(true);
    setSearch('');
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        damping: 20,
        stiffness: 200,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const closeDropdown = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.92,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setIsOpen(false);
    });
  };

  const handleSelect = (id: string) => {
    onSelectBank(id);
    closeDropdown();
  };

  return (
    <>
      {/* Trigger button */}
      <TouchableOpacity
        style={styles.bankSelectTrigger}
        onPress={openDropdown}
        activeOpacity={0.7}
      >
        <View style={styles.bankSelectTriggerLeft}>
          <Ionicons name="business-outline" size={16} color={selectedBank ? Colors.primary : '#9ca3af'} />
          <Text style={[styles.bankSelectTriggerText, !selectedBank && styles.bankSelectPlaceholder]}>
            {selectedBankData ? selectedBankData.name : 'Seleccionar banco'}
          </Text>
        </View>
        <Ionicons name="chevron-down" size={16} color="#9ca3af" />
      </TouchableOpacity>

      {/* Dropdown modal */}
      {isOpen && (
        <Modal transparent visible={isOpen} animationType="none" onRequestClose={closeDropdown}>
          <Pressable style={styles.bankOverlay} onPress={closeDropdown}>
            <Animated.View
              style={[
                styles.bankDropdown,
                {
                  opacity: fadeAnim,
                  transform: [{ scale: scaleAnim }],
                },
              ]}
            >
              <Pressable onPress={(e) => e.stopPropagation()}>
                {/* Header */}
                <View style={styles.bankDropdownHeader}>
                  <Text style={styles.bankDropdownTitle}>Seleccionar Banco</Text>
                  <TouchableOpacity onPress={closeDropdown} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Ionicons name="close" size={22} color="#6b7280" />
                  </TouchableOpacity>
                </View>

                {/* Search */}
                <View style={styles.bankSearchWrap}>
                  <Ionicons name="search" size={16} color="#9ca3af" />
                  <TextInput
                    style={styles.bankSearchInput}
                    placeholder="Buscar banco..."
                    placeholderTextColor="#c4c4c4"
                    value={search}
                    onChangeText={setSearch}
                    autoFocus
                  />
                  {search.length > 0 && (
                    <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name="close-circle" size={16} color="#9ca3af" />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Bank list */}
                <FlatList
                  data={filteredBanks}
                  keyExtractor={(item) => item.id}
                  style={styles.bankDropdownList}
                  contentContainerStyle={styles.bankDropdownListContent}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  removeClippedSubviews={Platform.OS === 'android'}
                  maxToRenderPerBatch={15}
                  windowSize={5}
                  initialNumToRender={15}
                  ListEmptyComponent={
                    <View style={styles.bankEmpty}>
                      <Ionicons name="search-outline" size={32} color="#d1d5db" />
                      <Text style={styles.bankEmptyText}>Ningún banco coincide con tu búsqueda</Text>
                    </View>
                  }
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[
                        styles.bankDropdownItem,
                        selectedBank === item.id && styles.bankDropdownItemActive,
                      ]}
                      onPress={() => handleSelect(item.id)}
                    >
                      <View style={styles.bankDropdownItemLeft}>
                        <View style={styles.bankDot}>
                          <Text style={styles.bankDotText}>{item.name.charAt(0)}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text
                            style={[
                              styles.bankDropdownItemName,
                              selectedBank === item.id && styles.bankDropdownItemNameActive,
                            ]}
                          >
                            {item.name}
                          </Text>
                          <Text style={styles.bankDropdownItemCode}>Código {item.code}</Text>
                        </View>
                      </View>
                      {selectedBank === item.id && (
                        <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
                      )}
                    </TouchableOpacity>
                  )}
                />
              </Pressable>
            </Animated.View>
          </Pressable>
        </Modal>
      )}
    </>
  );
}

// ── Main Component ──

export default function MobilePaymentModal({
  visible,
  amount,
  currency = 'VES',
  exchangeRate,
  rideId,
  passengerName,
  platformMethod,
  onPaymentComplete,
  onCancel,
  onBeforeCancel,
}: MobilePaymentModalProps) {
  const insets = useSafeAreaInsets();
  const { showToast, showStatus, dismissStatus } = useUnifiedNotifications();
  // Modo manual: verificación previa al viaje (sin rideId), el padre crea el ride después
  const isManualMode = rideId == null;
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('mobile');
  const [selectedBank, setSelectedBank] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [referencia, setReferencia] = useState('');
  const [fecha, setFecha] = useState('');
  const [telefonoP, setTelefonoP] = useState('');
  const [identificacion, setIdentificacion] = useState('');
  const [pagador, setPagador] = useState('');

  const [timeRemaining, setTimeRemaining] = useState(INITIAL_TIME);
  const [extensionsUsed, setExtensionsUsed] = useState(0);
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [isAutoCancelling, setIsAutoCancelling] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isPaymentCompletedRef = useRef(false);

  // Collapsible state
  const [isCollapsed, setIsCollapsed] = useState(false);
  const expandAnim = useRef(new Animated.Value(1)).current;

  // Slide animation
  const slideAnim = useRef(new Animated.Value(0)).current;

  // Reset processing states when modal opens
  useEffect(() => {
    if (visible) {
      setIsProcessing(false);
      setIsAutoCancelling(false);
      setShowCancelConfirm(false);
      setCancelError(null);
    }
  }, [visible]);

  // Auto-fill nombre del pasajero y fecha actual al abrir el modal
  useEffect(() => {
    if (visible) {
      const today = new Date();
      const dd = String(today.getDate()).padStart(2, '0');
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const yyyy = today.getFullYear();
      setFecha(`${dd}/${mm}/${yyyy}`);
      if (passengerName) {
        setPagador(passengerName);
      }
    }
  }, [visible, passengerName]);

  const resetForm = useCallback(() => {
    setSelectedBank('');
    // setShowTestData(true); // REMOVED - this state doesn't exist
    setPaymentMethod('mobile');
    setTimeRemaining(INITIAL_TIME);
    setExtensionsUsed(0);
    setIsTimerActive(false);
    setReferencia('');
    setFecha('');
    setTelefonoP('');
    setIdentificacion('');
    setPagador('');
    setIsCollapsed(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const handleTimeoutCancel = useCallback(async () => {
    if (isPaymentCompletedRef.current) return;
    if (isManualMode) {
      resetForm();
      onCancel();
      return;
    }
    setIsAutoCancelling(true);
    setCancelError(null);
    try {
      await rideAPI.cancelRide(rideId, { reason: 'payment_timeout' });
      resetForm();
      onCancel();
    } catch {
      setCancelError('Tiempo agotado. Error al cancelar el viaje.');
    } finally {
      setIsAutoCancelling(false);
    }
  }, [rideId, isManualMode, resetForm, onCancel]);

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 1,
        tension: 50,
        friction: 9,
        useNativeDriver: true,
      }).start();
    } else {
      slideAnim.setValue(0);
    }
  }, [visible]);

  // Collapse animation
  useEffect(() => {
    Animated.timing(expandAnim, {
      toValue: isCollapsed ? 0 : 1,
      duration: 250,
      useNativeDriver: false,
    }).start();
  }, [isCollapsed, expandAnim]);

  const otherCurrency: Currency = currency === 'USD' ? 'VES' : 'USD';
  const equivalentAmount =
    exchangeRate && exchangeRate > 0
      ? currency === 'USD'
        ? amount * exchangeRate
        : amount / exchangeRate
      : null;

  // Timer
  useEffect(() => {
    if (visible && paymentMethod === 'mobile') {
      setIsTimerActive(true);
      setTimeRemaining(INITIAL_TIME);
      setExtensionsUsed(0);
      setIsAutoCancelling(false);
    } else {
      setIsTimerActive(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [visible, paymentMethod]);

  useEffect(() => {
    if (isTimerActive && paymentMethod === 'mobile') {
      timerRef.current = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            setIsTimerActive(false);
            handleTimeoutCancel();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }
  }, [isTimerActive, paymentMethod, rideId, handleTimeoutCancel]);

  const handleExtendTime = () => {
    if (extensionsUsed >= MAX_EXTENSIONS) return;
    setTimeRemaining((p) => p + EXTENSION_TIME);
    setExtensionsUsed((p) => p + 1);
  };

  const handleSubmitPayment = async () => {
    if (paymentMethod === 'cash') {
      const numAmount = Number(amount) || 0;
      let dualMessage: string;
      if (currency === 'USD') {
        const bsEquivalent = exchangeRate && exchangeRate > 0 ? (numAmount * exchangeRate).toFixed(2) : null;
        dualMessage = `$ ${numAmount.toFixed(2)}${bsEquivalent ? `  →  Bs. ${bsEquivalent}` : ''}`;
      } else {
        const usdEquivalent = exchangeRate && exchangeRate > 0 ? (numAmount / exchangeRate).toFixed(2) : null;
        dualMessage = `Bs. ${numAmount.toFixed(2)}${usdEquivalent ? `  →  $ ${usdEquivalent}` : ''}`;
      }
      showStatus(
        'info',
        `Pagarás ${dualMessage} en efectivo al conductor.`,
        'Pago en Efectivo',
        undefined,
        undefined,
        4000
      );
      setTimeout(() => {
        resetForm();
        onPaymentComplete({ method: 'cash' });
      }, 500);
      return;
    }

    if (!referencia || !fecha || !selectedBank || !telefonoP || !identificacion) {
      showToast('Completa todos los campos del Pago Móvil.', 'warning');
      return;
    }
    if (referencia.length < 1 || referencia.length > 12 || !/^\d{1,12}$/.test(referencia)) {
      showToast('La referencia debe tener entre 1 y 12 dígitos numéricos.', 'error');
      return;
    }
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(fecha)) {
      showToast('Formato de fecha inválido. Usa DD/MM/YYYY.', 'error');
      return;
    }
    const [d, m, y] = fecha.split('/').map(Number);
    const dateObj = new Date(y, m - 1, d);
    if (dateObj.getFullYear() !== y || dateObj.getMonth() !== m - 1 || dateObj.getDate() !== d) {
      showToast('La fecha ingresada no es válida.', 'error');
      return;
    }
    if (telefonoP.length < 10) {
      showToast('Número de teléfono muy corto.', 'error');
      return;
    }
    if (identificacion.length < 6) {
      showToast('Identificación demasiado corta.', 'error');
      return;
    }
    if (pagador.trim().length < 2) {
      showToast('El nombre del pagador es muy corto.', 'error');
      return;
    }
    // Defensive reformat: garantiza DD/MM/YYYY antes del API call
    const fechaParts = fecha.split('/');
    const safeFecha = fechaParts.length === 3
      ? `${fechaParts[0].padStart(2, '0')}/${fechaParts[1].padStart(2, '0')}/${fechaParts[2]}`
      : fecha;

    setIsProcessing(true);
    // Mark that payment is being processed to prevent auto-cancel
    isPaymentCompletedRef.current = true;
    try {
      const selectedBankData = VENEZUELAN_BANKS.find((b) => b.id === selectedBank);
      const response = await paymentAPI.verifyP2CPayment(isManualMode ? null : rideId, {
        referencia,
        fecha: safeFecha,
        banco: selectedBankData?.code || selectedBank,
        telefonoP,
        monto: amount,
        identificacion,
        pagador,
      });

      showStatus(
        'success',
        `Pago Móvil de ${formatCurrency(amount, currency)} verificado`,
        'Pago Verificado',
        undefined,
        undefined,
        3000
      );

      // Cerrar modal y notificar al padre inmediatamente
      setTimeout(() => {
        resetForm();
        onPaymentComplete({
          method: 'mobile_payment',
          referencia,
          fecha,
          banco: selectedBankData?.code || selectedBank,
          telefonoP,
          identificacion,
          pagador,
        });
      }, 500);
    } catch (error: any) {
      let msg = 'Error procesando el pago. Intenta nuevamente.';
      let retry = true;
      if (error.response) {
        const { status, data } = error.response;
        const serverMsg = data?.error?.message as string | undefined;
        switch (status) {
          case 422:
            msg = serverMsg || 'Pago rechazado por el banco. Verifica los datos.';
            retry = false;
            break;
          case 409:
            msg = serverMsg || 'Este pago ya fue procesado.';
            retry = false;
            break;
          case 404:
            msg = serverMsg || 'Pago no encontrado en el banco. Verifica los datos.';
            retry = false;
            break;
          case 503:
            msg = serverMsg || 'Servicio de pagos no disponible. Intenta más tarde.';
            break;
          default:
            msg = serverMsg || msg;
        }
      }
      if (retry) {
        showStatus(
          'error',
          msg,
          'Error de Pago',
          undefined,
          { label: 'Reintentar', onPress: () => { handleSubmitPayment(); dismissStatus(); } },
          12000
        );
      } else {
        showStatus('error', msg, 'Error de Pago', undefined, undefined, 8000);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancel = () => {
    setShowCancelConfirm(true);
  };

  const handleConfirmCancel = async () => {
    setShowCancelConfirm(false);
    setCancelError(null);
    setIsAutoCancelling(true);
    onBeforeCancel?.();
    try {
      if (isManualMode) {
        resetForm();
        onCancel();
      } else {
        await rideAPI.cancelRide(rideId, {});
        resetForm();
        onCancel();
      }
    } catch {
      setCancelError('No se pudo cancelar el viaje. Intenta nuevamente.');
    } finally {
      setIsAutoCancelling(false);
    }
  };

  const handleDismissCancel = () => {
    setShowCancelConfirm(false);
  };

  const timerColor = getTimerColor(timeRemaining);

  // ── Collapsible content max-height interpolation ──
  const formMaxHeight = expandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 2000],
  });

  const chevronRotation = expandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['180deg', '0deg'],
  });

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleCancel}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <View style={styles.overlay}>
        <Animated.View
          style={[
            styles.container,
            {
              transform: [
                {
                  translateY: slideAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [300, 0],
                  }),
                },
              ],
            },
          ]}
        >
          {/* ── Header ── */}
          <View style={styles.header}>
            <View style={styles.headerAccent} />
            <View style={styles.headerContent}>
              <View style={styles.headerIconWrap}>
                <Ionicons name="wallet-outline" size={20} color={Colors.primary} />
              </View>
              <Text style={styles.title}>Confirmar Pago</Text>
              <Text style={styles.subtitle}>Elige cómo quieres pagar</Text>
            </View>
          </View>

          {/* ── Collapsible Handle ── */}
          <TouchableOpacity
            style={styles.collapseHandle}
            onPress={() => setIsCollapsed(!isCollapsed)}
            activeOpacity={0.7}
          >
            <View style={styles.collapseHandleLeft}>
              <Text style={styles.collapseHandleLabel}>
                {formatCurrency(amount, currency)}
              </Text>
              <View style={styles.collapseMethodBadge}>
                <Text style={styles.collapseMethodText}>
                  {paymentMethod === 'mobile' ? 'Pago Móvil' : 'Efectivo'}
                </Text>
              </View>
            </View>
            <Animated.View style={{ transform: [{ rotate: chevronRotation }] }}>
              <Ionicons name="chevron-up" size={18} color="#6b7280" />
            </Animated.View>
          </TouchableOpacity>

          {/* ── Loading overlay for auto-cancel ── */}
          {isAutoCancelling && (
            <View style={styles.autoCancelOverlay}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.autoCancelText}>Cancelando viaje...</Text>
            </View>
          )}

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            scrollEnabled={!isCollapsed}
          >
            {/* ── Form content (collapsible) ── */}
            <Animated.View
              style={[
                {
                  maxHeight: formMaxHeight,
                  opacity: expandAnim,
                  overflow: 'hidden',
                },
              ]}
            >
              {/* ── Monto ── */}
              <View style={styles.amountCard}>
                <Text style={styles.amountLabel}>Monto a Pagar</Text>
                <Text style={styles.amountValue}>{formatCurrency(amount, currency)}</Text>
                {equivalentAmount !== null && (
                  <Text style={styles.amountEquiv}>
                    ≈ {formatCurrency(equivalentAmount, otherCurrency)}
                    <Text style={styles.amountRate}>  1 USD = Bs. {exchangeRate!.toFixed(2)}</Text>
                  </Text>
                )}
              </View>

              {/* ── Timer ── */}
              {paymentMethod === 'mobile' && (
                <View style={[styles.timerRow, { borderColor: timerColor }]}>
                  <View style={styles.timerLeft}>
                    <Ionicons name="time-outline" size={16} color={timerColor} />
                    <View style={{ marginLeft: 6 }}>
                      <Text style={styles.timerLbl}>Restante</Text>
                      <Text style={[styles.timerVal, { color: timerColor }]}>
                        {formatTime(timeRemaining)}
                      </Text>
                    </View>
                  </View>
                  {extensionsUsed < MAX_EXTENSIONS && (
                    <TouchableOpacity style={styles.timerBtn} onPress={handleExtendTime}>
                      <Ionicons name="add" size={14} color={Colors.primary} />
                      <Text style={styles.timerBtnText}>Extender</Text>
                    </TouchableOpacity>
                  )}
                  {extensionsUsed >= MAX_EXTENSIONS && (
                    <View style={styles.timerMaxed}>
                      <Text style={styles.timerMaxedText}>Máximo alcanzado</Text>
                    </View>
                  )}
                </View>
              )}

              {/* ── Método de Pago (compact) ── */}
              <Text style={styles.sectionTitle}>Método</Text>
              <View style={styles.methodRow}>
                <TouchableOpacity
                  style={[styles.methodPill, paymentMethod === 'mobile' && styles.methodPillActive]}
                  onPress={() => setPaymentMethod('mobile')}
                >
                  <View style={[styles.pillIconWrap, paymentMethod === 'mobile' && styles.pillIconWrapActive]}>
                    <Ionicons
                      name="phone-portrait-outline"
                      size={15}
                      color={paymentMethod === 'mobile' ? Colors.primary : '#9ca3af'}
                    />
                  </View>
                  <Text style={[styles.pillLabel, paymentMethod === 'mobile' && styles.pillLabelActive]}>
                    Pago Móvil
                  </Text>
                  {paymentMethod === 'mobile' && (
                    <Ionicons name="checkmark-circle" size={12} color={Colors.primary} />
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.methodPill, paymentMethod === 'cash' && styles.methodPillActive]}
                  onPress={() => setPaymentMethod('cash')}
                >
                  <View style={[styles.pillIconWrap, paymentMethod === 'cash' && styles.pillIconWrapActive]}>
                    <Ionicons
                      name="cash-outline"
                      size={15}
                      color={paymentMethod === 'cash' ? Colors.primary : '#9ca3af'}
                    />
                  </View>
                  <Text style={[styles.pillLabel, paymentMethod === 'cash' && styles.pillLabelActive]}>
                    Efectivo
                  </Text>
                  {paymentMethod === 'cash' && (
                    <Ionicons name="checkmark-circle" size={12} color={Colors.primary} />
                  )}
                </TouchableOpacity>
              </View>

              {/* ── Cash info ── */}
              {paymentMethod === 'cash' && (
                <View style={styles.infoBox}>
                  <Ionicons name="information-circle" size={16} color={Colors.orange} />
                  <Text style={styles.infoText}>Pagarás en efectivo al conductor al subir al vehículo.</Text>
                </View>
              )}

              {/* ── Formulario Pago Móvil ── */}
              {paymentMethod === 'mobile' && (
                <>
                  {/* Cuenta destino */}
                  <Text style={styles.sectionTitle}>Destino del pago</Text>
                  {platformMethod?.type === 'pago_movil' && (
                    <View style={styles.destCard}>
                      <View style={styles.destAccent} />
                      <View style={styles.destContent}>
                        <View style={styles.destHead}>
                          <View style={styles.destIconCircle}>
                            <Ionicons name="phone-portrait" size={15} color={Colors.primary} />
                          </View>
                          <Text style={styles.destTitle}>Paga a:</Text>
                        </View>
                        <Text style={styles.destBank}>{platformMethod.mobileBank}</Text>
                        <View style={styles.destDivider} />
                        <View style={styles.destInfoRow}>
                          <Ionicons name="call-outline" size={13} color="#6b7280" style={styles.destInfoIcon} />
                          <Text style={styles.destInfoLabel}>Teléfono</Text>
                          <Text style={styles.destInfoValue}>{platformMethod.mobilePhone}</Text>
                        </View>
                        <View style={styles.destInfoRow}>
                          <Ionicons name="person-outline" size={13} color="#6b7280" style={styles.destInfoIcon} />
                          <Text style={styles.destInfoLabel}>Cédula</Text>
                          <Text style={styles.destInfoValue}>{platformMethod.mobileCedula}</Text>
                        </View>
                        {platformMethod.description && (
                          <>
                            <View style={styles.destDivider} />
                            <View style={styles.destInfoRow}>
                              <Ionicons name="information-circle-outline" size={13} color="#6b7280" style={styles.destInfoIcon} />
                              <Text style={styles.destInfoLabel}>Ref.</Text>
                              <Text style={styles.destInfoValueDesc}>{platformMethod.description}</Text>
                            </View>
                          </>
                        )}
                      </View>
                    </View>
                  )}
                  {platformMethod?.type === 'bank_transfer' && (
                    <View style={styles.destCard}>
                      <View style={styles.destAccent} />
                      <View style={styles.destContent}>
                        <View style={styles.destHead}>
                          <View style={styles.destIconCircle}>
                            <Ionicons name="business" size={15} color={Colors.primary} />
                          </View>
                          <Text style={styles.destTitle}>Transfiere a:</Text>
                        </View>
                        <Text style={styles.destBank}>{platformMethod.transferBank}</Text>
                        <View style={styles.destDivider} />
                        <View style={styles.destInfoRow}>
                          <Ionicons name="card-outline" size={13} color="#6b7280" style={styles.destInfoIcon} />
                          <Text style={styles.destInfoLabel}>N° Cuenta</Text>
                          <Text style={styles.destInfoValue}>{platformMethod.accountNumber}</Text>
                        </View>
                        <View style={styles.destInfoRow}>
                          <Ionicons name="receipt-outline" size={13} color="#6b7280" style={styles.destInfoIcon} />
                          <Text style={styles.destInfoLabel}>Tipo</Text>
                          <Text style={styles.destInfoValue}>{platformMethod.accountType || 'Corriente'}</Text>
                        </View>
                        <View style={styles.destInfoRow}>
                          <Ionicons name="document-text-outline" size={13} color="#6b7280" style={styles.destInfoIcon} />
                          <Text style={styles.destInfoLabel}>RIF</Text>
                          <Text style={styles.destInfoValue}>{platformMethod.transferCedula}</Text>
                        </View>
                        {platformMethod.description && (
                          <>
                            <View style={styles.destDivider} />
                            <View style={styles.destInfoRow}>
                              <Ionicons name="information-circle-outline" size={13} color="#6b7280" style={styles.destInfoIcon} />
                              <Text style={styles.destInfoLabel}>Ref.</Text>
                              <Text style={styles.destInfoValueDesc}>{platformMethod.description}</Text>
                            </View>
                          </>
                        )}
                      </View>
                    </View>
                  )}

                  {/* Banco — Web-style dropdown selector */}
                  <Text style={styles.fieldLabel}>Banco</Text>
                  <BankSelector
                    selectedBank={selectedBank}
                    onSelectBank={setSelectedBank}
                  />

                  {/* Referencia */}
                  <Text style={styles.fieldLabel}>Referencia</Text>
                  <View style={styles.fieldRow}>
                    <Ionicons name="document-text-outline" size={15} color="#9ca3af" />
                    <TextInput
                      style={styles.fieldInput}
                      placeholder="123456"
                      placeholderTextColor="#c4c4c4"
                      value={referencia}
                      onChangeText={setReferencia}
                      keyboardType="number-pad"
                      maxLength={12}
                    />
                  </View>

                  {/* Fecha */}
                  <Text style={styles.fieldLabel}>Fecha (DD/MM/YYYY)</Text>
                  <View style={styles.fieldRow}>
                    <Ionicons name="calendar-outline" size={15} color="#9ca3af" />
                    <TextInput
                      style={styles.fieldInput}
                      placeholder="15/12/2024"
                      placeholderTextColor="#c4c4c4"
                      value={fecha}
                      onChangeText={(t) => {
                        let f = t.replace(/[^0-9]/g, '');
                        if (f.length > 2) f = f.slice(0, 2) + '/' + f.slice(2);
                        if (f.length > 5) f = f.slice(0, 5) + '/' + f.slice(5);
                        setFecha(f.slice(0, 10));
                      }}
                      keyboardType="number-pad"
                      maxLength={10}
                    />
                  </View>

                  {/* Teléfono */}
                  <Text style={styles.fieldLabel}>Teléfono</Text>
                  <View style={styles.fieldRow}>
                    <Ionicons name="call-outline" size={15} color="#9ca3af" />
                    <TextInput
                      style={styles.fieldInput}
                      placeholder="04125317509"
                      placeholderTextColor="#c4c4c4"
                      value={telefonoP}
                      onChangeText={setTelefonoP}
                      keyboardType="phone-pad"
                      maxLength={15}
                    />
                  </View>

                  {/* Identificación */}
                  <Text style={styles.fieldLabel}>Identificación</Text>
                  <View style={styles.fieldRow}>
                    <Ionicons name="card-outline" size={15} color="#9ca3af" />
                    <TextInput
                      style={styles.fieldInput}
                      placeholder="V25213842"
                      placeholderTextColor="#c4c4c4"
                      value={identificacion}
                      onChangeText={setIdentificacion}
                      maxLength={15}
                    />
                  </View>



                  {/* Info */}
                  <View style={styles.infoBanner}>
                    <Ionicons name="information-circle-outline" size={14} color={Colors.primary} />
                    <Text style={styles.infoBannerText}>
                      Ingresa los datos exactos de tu transacción. El pago se verificará automáticamente.
                    </Text>
                  </View>
                </>
              )}
            </Animated.View>
          </ScrollView>

          {/* ── Actions ── */}
          {cancelError && (
            <View style={[styles.cancelErrorBanner, {}]}>
              <Ionicons name="alert-circle" size={14} color="#dc2626" />
              <Text style={styles.cancelErrorText}>{cancelError}</Text>
              <TouchableOpacity onPress={() => setCancelError(null)}>
                <Ionicons name="close" size={16} color="#dc2626" />
              </TouchableOpacity>
            </View>
          )}
          {!showCancelConfirm && (
          <View style={[styles.actions, { paddingBottom: Math.max(insets.bottom + 8, 24) }]}>
            <TouchableOpacity style={styles.btnCancel} onPress={handleCancel} disabled={isProcessing || isAutoCancelling}>
              <Text style={styles.btnCancelText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btnSubmit, (isProcessing || isAutoCancelling) && styles.btnSubmitDisabled]}
              onPress={handleSubmitPayment}
              disabled={isProcessing || isAutoCancelling}
            >
              {isProcessing ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Text style={styles.btnSubmitText}>Confirmar Pago</Text>
                  <Ionicons name="checkmark-circle" size={16} color="#fff" />
                </>
              )}
            </TouchableOpacity>
          </View>
          )}
        </Animated.View>

        {/* Cancel confirmation overlay */}
        {showCancelConfirm && (
          <View style={styles.cancelOverlayContainer}>
            <TouchableOpacity
              style={styles.cancelOverlayBackdrop}
              activeOpacity={1}
              onPress={handleDismissCancel}
            />
            <View style={styles.cancelConfirmCard}>
              <Text style={styles.cancelConfirmTitle}>¿Cancelar viaje?</Text>
              <Text style={styles.cancelConfirmMsg}>El viaje se cancelará si no completas el pago.</Text>
              <View style={styles.cancelConfirmActions}>
                <TouchableOpacity style={styles.cancelConfirmNo} onPress={handleDismissCancel} disabled={isAutoCancelling}>
                  <Text style={styles.cancelConfirmNoText}>No</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancelConfirmYes} onPress={handleConfirmCancel} disabled={isAutoCancelling}>
                  {isAutoCancelling ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.cancelConfirmYesText}>Sí, Cancelar</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
    paddingBottom: 12,
  },
  container: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '92%',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: { elevation: 16 },
    }),
  },

  // ── Header ──
  header: {
    overflow: 'hidden',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  headerAccent: {
    height: 4,
    backgroundColor: Colors.primary,
  },
  headerContent: {
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f0fdf4',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },

  // ── Collapse Handle ──
  collapseHandle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#fafafa',
  },
  collapseHandleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  collapseHandleLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.primary,
  },
  collapseMethodBadge: {
    backgroundColor: '#f0fdf4',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  collapseMethodText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.primary,
  },

  // ── Auto-cancel overlay ──
  autoCancelOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.85)',
    zIndex: 100,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  autoCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },

  // ── Scroll ──
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },

  // ── Amount ──
  amountCard: {
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#dcfce7',
  },
  amountLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  amountValue: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.primary,
    marginTop: 3,
  },
  amountEquiv: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6b7280',
    marginTop: 2,
  },
  amountRate: {
    fontSize: 10,
    color: '#9ca3af',
  },

  // ── Timer ──
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f0fdf4',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 14,
    borderWidth: 1,
  },
  timerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timerLbl: {
    fontSize: 10,
    color: '#6b7280',
    fontWeight: '500',
  },
  timerVal: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 1,
  },
  timerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 3,
  },
  timerBtnText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.primary,
  },
  timerMaxed: {
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  timerMaxedText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#9ca3af',
    fontStyle: 'italic',
  },

  // ── Section title ──
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },

  // ── Payment method pills (compact) ──
  methodRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  methodPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
  },
  methodPillActive: {
    borderColor: Colors.primary,
    backgroundColor: '#f0fdf4',
  },
  pillIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillIconWrapActive: {
    backgroundColor: '#f0fdf4',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 2,
      },
      android: { elevation: 1 },
    }),
  },
  pillLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    flex: 1,
  },
  pillLabelActive: {
    color: Colors.primary,
  },

  // ── Cash info ──
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#fff7ed',
    borderRadius: 8,
    padding: 10,
    gap: 8,
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: '#92400e',
    lineHeight: 16,
  },

  // ── Destination account ──
  destCard: {
    flexDirection: 'row',
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  destAccent: {
    width: 5,
    backgroundColor: '#2FB908',
  },
  destContent: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  destHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  destIconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#dcfce7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  destTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },
  destBank: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 0,
  },
  destDivider: {
    height: 1,
    backgroundColor: '#dcfce7',
    marginVertical: 8,
  },
  destInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 8,
  },
  destInfoIcon: {
    width: 16,
    textAlign: 'center',
  },
  destInfoLabel: {
    width: 72,
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  destInfoValue: {
    fontSize: 13,
    color: '#111827',
    fontWeight: '600',
    flex: 1,
  },
  destInfoValueDesc: {
    fontSize: 13,
    color: '#6b7280',
    fontStyle: 'italic',
    flex: 1,
  },

  // ── Bank Selector (Dropdown) ──
  bankSelectTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 40,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    marginBottom: 10,
  },
  bankSelectTriggerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  bankSelectTriggerText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1f2937',
    flex: 1,
  },
  bankSelectPlaceholder: {
    color: '#9ca3af',
    fontWeight: '400',
  },

  // ── Bank Dropdown Modal ──
  bankOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  bankDropdown: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: SCREEN_WIDTH - 48,
    maxHeight: '80%',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 16,
      },
      android: { elevation: 12 },
    }),
  },
  bankDropdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  bankDropdownTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  bankSearchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 10,
    height: 38,
    gap: 6,
  },
  bankSearchInput: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
    padding: 0,
    height: 38,
  },
  bankDropdownList: {
    maxHeight: 320,
  },
  bankDropdownListContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  bankDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 4,
  },
  bankDropdownItemActive: {
    backgroundColor: '#f0fdf4',
  },
  bankDropdownItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  bankDot: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bankDotText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6b7280',
  },
  bankDropdownItemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  bankDropdownItemNameActive: {
    color: Colors.primary,
  },
  bankDropdownItemCode: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 1,
  },
  bankEmpty: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  bankEmptyText: {
    fontSize: 13,
    color: '#9ca3af',
    textAlign: 'center',
  },

  // ── Info banner ──
  fieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 5,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 38,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    marginBottom: 10,
    gap: 7,
  },
  fieldInput: {
    flex: 1,
    fontSize: 13,
    color: '#111827',
    padding: 0,
    height: 38,
  },

  // ── Info banner ──
  infoBanner: {
    flexDirection: 'row',
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    padding: 10,
    gap: 7,
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 11,
    color: '#1e40af',
    lineHeight: 16,
  },

  // ── Actions ──
  actions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 16,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  btnCancel: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 10,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  btnCancelText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
  },
  btnSubmit: {
    flex: 2,
    backgroundColor: Colors.primary,
    borderRadius: 10,
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  btnSubmitDisabled: {
    opacity: 0.5,
  },
  btnSubmitText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },

  // ── Cancel confirmation overlay ──
  cancelOverlayContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  cancelOverlayBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  cancelConfirmCard: {
    width: '85%',
    maxWidth: 340,
    paddingHorizontal: 24,
    paddingVertical: 20,
    backgroundColor: '#fffbeb',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  cancelConfirmTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#92400e',
    marginBottom: 6,
    textAlign: 'center',
  },
  cancelConfirmMsg: {
    fontSize: 13,
    color: '#b45309',
    marginBottom: 16,
    textAlign: 'center',
    lineHeight: 18,
  },
  cancelConfirmActions: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelConfirmNo: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 10,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  cancelConfirmNoText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  cancelConfirmYes: {
    flex: 1,
    backgroundColor: '#dc2626',
    borderRadius: 10,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelConfirmYesText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  cancelErrorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 8,
    marginHorizontal: 20,
    marginBottom: 8,
    backgroundColor: '#fef2f2',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  cancelErrorText: {
    flex: 1,
    fontSize: 12,
    color: '#dc2626',
    fontWeight: '500',
  },
});
