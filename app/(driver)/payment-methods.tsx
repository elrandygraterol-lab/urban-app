import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';
import { driverAPI } from '../../services/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface PaymentInfo {
  pagoMovilPhone?: string;
  pagoMovilBank?: string;
  pagoMovilCedula?: string;
  bankTransferBank?: string;
  bankTransferAccount?: string;
  bankTransferAccountType?: string;
}

export default function DriverPaymentMethodsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo>({
    pagoMovilPhone: '',
    pagoMovilBank: '',
    pagoMovilCedula: '',
    bankTransferBank: '',
    bankTransferAccount: '',
    bankTransferAccountType: 'Corriente',
  });

  useEffect(() => {
    loadPaymentInfo();
  }, []);

  const loadPaymentInfo = async () => {
    try {
      setLoading(true);
      const response = await driverAPI.getMyProfile();
      const profile = response.data.data;
      if (profile) {
        setPaymentInfo({
          pagoMovilPhone: profile.pagoMovilPhone || '',
          pagoMovilBank: profile.pagoMovilBank || '',
          pagoMovilCedula: profile.pagoMovilCedula || '',
          bankTransferBank: profile.bankTransferBank || '',
          bankTransferAccount: profile.bankTransferAccount || '',
          bankTransferAccountType: profile.bankTransferAccountType || 'Corriente',
        });
      }
    } catch (error) {
      console.error('Error loading payment info:', error);
    } finally {
      setLoading(false);
    }
  };

  const hasPagoMovil = !!(paymentInfo.pagoMovilPhone && paymentInfo.pagoMovilBank && paymentInfo.pagoMovilCedula);
  const hasBankTransfer = !!(paymentInfo.bankTransferBank && paymentInfo.bankTransferAccount);

  const handleSave = async () => {
    if (!hasPagoMovil && !hasBankTransfer) {
      Alert.alert(
        'Error',
        'Debes configurar al menos un método de pago completo:\n\n• Pago Móvil: teléfono, banco y cédula\n• Transferencia: banco y cuenta'
      );
      return;
    }

    try {
      setSaving(true);
      await driverAPI.updatePaymentInfo(paymentInfo);
      Alert.alert('Guardado', 'Métodos de pago actualizados exitosamente', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Error al guardar los métodos de pago';
      Alert.alert('Error', message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1f2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Métodos de Pago</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Pago Móvil */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <View style={styles.iconCircle}>
                <Ionicons name="phone-portrait" size={22} color={Colors.primary} />
              </View>
              <View>
                <Text style={styles.cardTitle}>Pago Móvil</Text>
                <Text style={styles.cardSubtitle}>Recibe pagos directos a tu teléfono</Text>
              </View>
            </View>
            {hasPagoMovil && (
              <View style={styles.badge}>
                <Ionicons name="checkmark-circle" size={14} color={Colors.primary} />
                <Text style={styles.badgeText}>Configurado</Text>
              </View>
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Cédula</Text>
            <TextInput
              style={styles.input}
              value={paymentInfo.pagoMovilCedula}
              onChangeText={(t) => setPaymentInfo({ ...paymentInfo, pagoMovilCedula: t })}
              placeholder="V-12345678"
              placeholderTextColor="#9ca3af"
              autoCapitalize="characters"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Teléfono</Text>
            <TextInput
              style={styles.input}
              value={paymentInfo.pagoMovilPhone}
              onChangeText={(t) => setPaymentInfo({ ...paymentInfo, pagoMovilPhone: t })}
              placeholder="0414-1234567"
              placeholderTextColor="#9ca3af"
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Banco</Text>
            <TextInput
              style={styles.input}
              value={paymentInfo.pagoMovilBank}
              onChangeText={(t) => setPaymentInfo({ ...paymentInfo, pagoMovilBank: t })}
              placeholder="Ej: Banco de Venezuela"
              placeholderTextColor="#9ca3af"
            />
          </View>
        </View>

        {/* Bank Transfer */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <View style={styles.iconCircle}>
                <Ionicons name="business" size={22} color={Colors.primary} />
              </View>
              <View>
                <Text style={styles.cardTitle}>Transferencia Bancaria</Text>
                <Text style={styles.cardSubtitle}>Recibe pagos directamente a tu cuenta</Text>
              </View>
            </View>
            {hasBankTransfer && (
              <View style={styles.badge}>
                <Ionicons name="checkmark-circle" size={14} color={Colors.primary} />
                <Text style={styles.badgeText}>Configurado</Text>
              </View>
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Banco</Text>
            <TextInput
              style={styles.input}
              value={paymentInfo.bankTransferBank}
              onChangeText={(t) => setPaymentInfo({ ...paymentInfo, bankTransferBank: t })}
              placeholder="Ej: Banco de Venezuela"
              placeholderTextColor="#9ca3af"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Número de Cuenta</Text>
            <TextInput
              style={styles.input}
              value={paymentInfo.bankTransferAccount}
              onChangeText={(t) => setPaymentInfo({ ...paymentInfo, bankTransferAccount: t })}
              placeholder="0102-1234-5678-9012"
              placeholderTextColor="#9ca3af"
              keyboardType="number-pad"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Tipo de Cuenta</Text>
            <View style={styles.toggleRow}>
              <TouchableOpacity
                style={[styles.toggleButton, paymentInfo.bankTransferAccountType === 'Corriente' && styles.toggleButtonActive]}
                onPress={() => setPaymentInfo({ ...paymentInfo, bankTransferAccountType: 'Corriente' })}
              >
                <Text style={[styles.toggleText, paymentInfo.bankTransferAccountType === 'Corriente' && styles.toggleTextActive]}>
                  Corriente
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleButton, paymentInfo.bankTransferAccountType === 'Ahorro' && styles.toggleButtonActive]}
                onPress={() => setPaymentInfo({ ...paymentInfo, bankTransferAccountType: 'Ahorro' })}
              >
                <Text style={[styles.toggleText, paymentInfo.bankTransferAccountType === 'Ahorro' && styles.toggleTextActive]}>
                  Ahorro
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Info note */}
        <View style={styles.infoBox}>
          <Ionicons name="information-circle" size={20} color="#6b7280" />
          <Text style={styles.infoText}>
            Debes configurar al menos un método de pago completo para recibir tus ganancias.
            Tus ganancias se transferirán automáticamente al método configurado.
          </Text>
        </View>

        {/* Save button */}
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>Guardar Cambios</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f9ff',
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f0fdf4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1f2937',
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 1,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.primary,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  input: {
    height: 48,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#1f2937',
    backgroundColor: '#fafafa',
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 10,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  toggleButtonActive: {
    borderColor: Colors.primary,
    backgroundColor: '#f0fdf4',
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9ca3af',
  },
  toggleTextActive: {
    color: Colors.primary,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#f9fafb',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 18,
  },
  saveButton: {
    height: 52,
    backgroundColor: Colors.primary,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
});
