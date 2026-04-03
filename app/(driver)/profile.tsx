import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../constants/theme';
import { useAuthStore } from '../../store/authStore';
import { useDriverStore } from '../../store/driverStore';
import { useLanguage } from '../../hooks/useLanguage';
import { translations } from '../../i18n/translations';
import { userAPI, notificationAPI, driverAPI } from '../../services/api';
import { getSocket } from '@/services/socket';

interface NotificationPreferences {
  rideRequests?: boolean;
  rideUpdates?: boolean;
  payments?: boolean;
  promotions?: boolean;
}

interface PaymentInfo {
  pagoMovilPhone?: string;
  pagoMovilBank?: string;
  pagoMovilCedula?: string;
  bankTransferBank?: string;
  bankTransferAccount?: string;
  bankTransferAccountType?: string;
}

export default function DriverProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { isAvailable, isUpdatingAvailability, setIsAvailable, toggleAvailability } = useDriverStore();
  const { language, setLanguage } = useLanguage();
  const t = translations[language].profile;

  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const [isPaymentSectionExpanded, setIsPaymentSectionExpanded] = useState(false);
  const [isSavingPayment, setIsSavingPayment] = useState(false);

  // User data
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [email, setEmail] = useState(user?.email || '');

  // Payment information
  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo>({
    pagoMovilPhone: '',
    pagoMovilBank: '',
    pagoMovilCedula: '',
    bankTransferBank: '',
    bankTransferAccount: '',
    bankTransferAccountType: 'Corriente',
  });

  // Notification preferences
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPreferences>({
    rideRequests: true,
    rideUpdates: true,
    payments: true,
    promotions: false,
  });

  useEffect(() => {
    loadUserData();
    
    // Monitor socket connection status
    const socket = getSocket();
    if (socket) {
      setIsSocketConnected(socket.connected);
      
      const handleConnect = () => setIsSocketConnected(true);
      const handleDisconnect = () => setIsSocketConnected(false);
      
      // Listen for availability changes from other sources (e.g., home screen toggle)
      const handleAvailabilityChanged = (data: { driverId: string; isAvailable: boolean; timestamp: string }) => {
        console.log('[DRIVER PROFILE] ========================================');
        console.log('[DRIVER PROFILE] Availability changed event received');
        console.log('[DRIVER PROFILE]    Driver ID:', data.driverId);
        console.log('[DRIVER PROFILE]    Is Available:', data.isAvailable);
        console.log('[DRIVER PROFILE]    Timestamp:', data.timestamp);
        console.log('[DRIVER PROFILE] ========================================');
        
        // Update the availability state
        setIsAvailable(data.isAvailable);
      };
      
      socket.on('connect', handleConnect);
      socket.on('disconnect', handleDisconnect);
      socket.on('driver:availability_changed', handleAvailabilityChanged);
      
      return () => {
        socket.off('connect', handleConnect);
        socket.off('disconnect', handleDisconnect);
        socket.off('driver:availability_changed', handleAvailabilityChanged);
      };
    }
  }, []);

  const loadUserData = async () => {
    try {
      setIsLoading(true);

      // Load user info
      const userResponse = await userAPI.getMe();

      if (!userResponse || !userResponse.data || !userResponse.data.data) {
        console.warn('User API returned invalid response:', userResponse);
        Alert.alert('Error', t.loadError);
        return;
      }

      const userData = userResponse.data.data;

      if (!userData.name || !userData.phone || !userData.email) {
        console.warn('User data is incomplete:', userData);
        setName(userData.name || '');
        setPhone(userData.phone || '');
        setEmail(userData.email || '');
      } else {
        setName(userData.name);
        setPhone(userData.phone);
        setEmail(userData.email);
      }

      // Load driver profile to get availability status
      try {
        const driverProfile = await driverAPI.getMyProfile();
        if (driverProfile.data && driverProfile.data.isAvailable !== undefined) {
          setIsAvailable(driverProfile.data.isAvailable);
        }
        
        // Load payment information
        if (driverProfile.data) {
          setPaymentInfo({
            pagoMovilPhone: driverProfile.data.pagoMovilPhone || '',
            pagoMovilBank: driverProfile.data.pagoMovilBank || '',
            pagoMovilCedula: driverProfile.data.pagoMovilCedula || '',
            bankTransferBank: driverProfile.data.bankTransferBank || '',
            bankTransferAccount: driverProfile.data.bankTransferAccount || '',
            bankTransferAccountType: driverProfile.data.bankTransferAccountType || 'Corriente',
          });
        }
      } catch (error) {
        console.log('Could not load driver availability:', error);
      }

      // Load notification preferences
      try {
        const prefsResponse = await notificationAPI.getPreferences();
        if (prefsResponse.data && prefsResponse.data.preferences) {
          setNotificationPrefs(prefsResponse.data.preferences);
        }
      } catch (error) {
        console.log('No notification preferences found, using defaults');
      }
    } catch (error) {
      console.error('Error loading user data:', error);
      Alert.alert('Error', t.loadError);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    try {
      setIsSaving(true);
      await userAPI.updateMe({ name, phone });
      setIsEditing(false);
      Alert.alert('Éxito', t.updateSuccess);
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', t.updateError);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSavePaymentInfo = async () => {
    try {
      // Validar que al menos un método esté configurado
      const hasPagoMovil = paymentInfo.pagoMovilPhone && paymentInfo.pagoMovilBank && paymentInfo.pagoMovilCedula;
      const hasBankTransfer = paymentInfo.bankTransferBank && paymentInfo.bankTransferAccount;

      if (!hasPagoMovil && !hasBankTransfer) {
        Alert.alert(
          'Error',
          'Debes configurar al menos un método de pago completo:\n\n• Pago Móvil: teléfono, banco y cédula\n• Transferencia: banco y cuenta'
        );
        return;
      }

      setIsSavingPayment(true);
      await driverAPI.updatePaymentInfo(paymentInfo);
      Alert.alert('Éxito', 'Información de pago actualizada exitosamente');
      setIsPaymentSectionExpanded(false);
    } catch (error: any) {
      console.error('Error updating payment info:', error);
      const errorMessage = error.response?.data?.message || 'Error al actualizar información de pago';
      Alert.alert('Error', errorMessage);
    } finally {
      setIsSavingPayment(false);
    }
  };

  const handleToggleAvailability = async (value: boolean) => {
    // Use the store's toggle function
    await toggleAvailability();
  };

  const handleUpdateNotificationPref = async (
    key: keyof NotificationPreferences,
    value: boolean
  ) => {
    const newPrefs = { ...notificationPrefs, [key]: value };
    setNotificationPrefs(newPrefs);

    try {
      await notificationAPI.updatePreferences(newPrefs);
    } catch (error) {
      console.error('Error updating notification preferences:', error);
      // Revert on error
      setNotificationPrefs(notificationPrefs);
    }
  };

  const handleLanguageChange = async (newLanguage: 'es' | 'en') => {
    try {
      await setLanguage(newLanguage);
    } catch (error) {
      console.error('Error changing language:', error);
    }
  };

  const handleLogout = () => {
    Alert.alert(t.logoutConfirmTitle, t.logoutConfirmMessage, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.logoutConfirmButton,
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(t.deleteConfirmTitle, t.deleteConfirmMessage, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.deleteConfirmButton,
        style: 'destructive',
        onPress: () => {
          Alert.alert(t.deleteSecondConfirmTitle, t.deleteSecondConfirmMessage, [
            { text: t.cancel, style: 'cancel' },
            {
              text: t.deleteSecondConfirmButton,
              style: 'destructive',
              onPress: async () => {
                try {
                  await userAPI.deleteAccount();
                  await logout();
                  Alert.alert('Éxito', t.deleteSuccess);
                  router.replace('/(auth)/login');
                } catch (error) {
                  console.error('Error deleting account:', error);
                  Alert.alert('Error', t.deleteError);
                }
              },
            },
          ]);
        },
      },
    ]);
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Driver Availability Section - FIRST */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Disponibilidad</Text>

        <View style={styles.card}>
          {/* Socket Connection Status */}
          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <View style={[styles.iconContainer, isSocketConnected && styles.iconContainerActive]}>
                <Ionicons
                  name={isSocketConnected ? 'wifi' : 'wifi-outline'}
                  size={22}
                  color={isSocketConnected ? Colors.primary : Colors.mediumGray}
                />
              </View>
              <View style={styles.availabilityTextContainer}>
                <Text style={styles.settingLabel}>Socket</Text>
                <Text style={styles.availabilitySubtext}>
                  {isSocketConnected ? 'Conectado' : 'Desconectado'}
                </Text>
              </View>
            </View>
            <View
              style={[
                styles.statusIndicator,
                isSocketConnected ? styles.statusConnected : styles.statusDisconnected,
              ]}
            />
          </View>

          <View style={styles.divider} />

          {/* Driver Availability Toggle */}
          <View style={styles.availabilityItem}>
            <View style={styles.settingLeft}>
              <View style={[styles.iconContainer, isAvailable && styles.iconContainerActive]}>
                <Ionicons
                  name={isAvailable ? 'checkmark-circle' : 'close-circle'}
                  size={22}
                  color={isAvailable ? Colors.primary : Colors.mediumGray}
                />
              </View>
              <View style={styles.availabilityTextContainer}>
                <Text style={styles.availabilityLabel}>
                  {isAvailable ? 'En Línea' : 'Fuera de Línea'}
                </Text>
                <Text style={styles.availabilitySubtext}>
                  {isAvailable ? 'Recibiendo solicitudes' : 'No recibiendo solicitudes'}
                </Text>
              </View>
            </View>
            <Switch
              value={isAvailable}
              onValueChange={handleToggleAvailability}
              disabled={isUpdatingAvailability}
              trackColor={{ false: Colors.lightGray, true: Colors.light }}
              thumbColor={isAvailable ? Colors.primary : Colors.white}
            />
          </View>
        </View>
      </View>

      {/* Personal Information Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t.personalInfo}</Text>
          {!isEditing && (
            <TouchableOpacity onPress={() => setIsEditing(true)} style={styles.editButton}>
              <Ionicons name="pencil" size={20} color={Colors.primary} />
              <Text style={styles.editButtonText}>{t.edit}</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t.name}</Text>
            <TextInput
              style={[styles.input, !isEditing && styles.inputDisabled]}
              value={name}
              onChangeText={setName}
              editable={isEditing}
              placeholder={t.name}
              placeholderTextColor={Colors.placeholder}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t.email}</Text>
            <TextInput
              style={[styles.input, styles.inputDisabled]}
              value={email}
              editable={false}
              placeholder={t.email}
              placeholderTextColor={Colors.placeholder}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t.phone}</Text>
            <TextInput
              style={[styles.input, !isEditing && styles.inputDisabled]}
              value={phone}
              onChangeText={setPhone}
              editable={isEditing}
              placeholder={t.phone}
              placeholderTextColor={Colors.placeholder}
              keyboardType="phone-pad"
            />
          </View>

          {isEditing && (
            <View style={styles.editActions}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={() => {
                  setIsEditing(false);
                  setName(user?.name || '');
                  setPhone(user?.phone || '');
                }}
              >
                <Text style={styles.cancelButtonText}>{t.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.saveButton]}
                onPress={handleSaveProfile}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <Text style={styles.saveButtonText}>{t.save}</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      {/* Payment Methods Section */}
      <View style={styles.section}>
        <TouchableOpacity
          style={styles.sectionHeader}
          onPress={() => setIsPaymentSectionExpanded(!isPaymentSectionExpanded)}
          activeOpacity={0.7}
        >
          <Text style={styles.sectionTitle}>Métodos de Pago</Text>
          <Ionicons
            name={isPaymentSectionExpanded ? 'chevron-up' : 'chevron-down'}
            size={24}
            color={Colors.primary}
          />
        </TouchableOpacity>

        {isPaymentSectionExpanded && (
          <View style={styles.card}>
            {/* Pago Móvil Section */}
            <View style={styles.paymentMethodSection}>
              <View style={styles.paymentMethodHeader}>
                <View style={styles.settingLeft}>
                  <View style={styles.iconContainer}>
                    <Ionicons name="phone-portrait" size={22} color={Colors.primary} />
                  </View>
                  <Text style={styles.paymentMethodTitle}>Pago Móvil</Text>
                </View>
                {paymentInfo.pagoMovilPhone && paymentInfo.pagoMovilBank && paymentInfo.pagoMovilCedula && (
                  <View style={styles.configuredBadge}>
                    <Ionicons name="checkmark-circle" size={16} color={Colors.primary} />
                    <Text style={styles.configuredText}>Configurado</Text>
                  </View>
                )}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Cédula *</Text>
                <TextInput
                  style={styles.input}
                  value={paymentInfo.pagoMovilCedula}
                  onChangeText={(text) => setPaymentInfo({ ...paymentInfo, pagoMovilCedula: text })}
                  placeholder="V-12345678"
                  placeholderTextColor={Colors.placeholder}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Teléfono *</Text>
                <TextInput
                  style={styles.input}
                  value={paymentInfo.pagoMovilPhone}
                  onChangeText={(text) => setPaymentInfo({ ...paymentInfo, pagoMovilPhone: text })}
                  placeholder="0414-1234567"
                  placeholderTextColor={Colors.placeholder}
                  keyboardType="phone-pad"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Banco *</Text>
                <TextInput
                  style={styles.input}
                  value={paymentInfo.pagoMovilBank}
                  onChangeText={(text) => setPaymentInfo({ ...paymentInfo, pagoMovilBank: text })}
                  placeholder="Ej: Banco de Venezuela"
                  placeholderTextColor={Colors.placeholder}
                />
              </View>
            </View>

            <View style={styles.divider} />

            {/* Transferencia Bancaria Section */}
            <View style={styles.paymentMethodSection}>
              <View style={styles.paymentMethodHeader}>
                <View style={styles.settingLeft}>
                  <View style={styles.iconContainer}>
                    <Ionicons name="business" size={22} color={Colors.primary} />
                  </View>
                  <Text style={styles.paymentMethodTitle}>Transferencia Bancaria</Text>
                </View>
                {paymentInfo.bankTransferAccount && paymentInfo.bankTransferBank && (
                  <View style={styles.configuredBadge}>
                    <Ionicons name="checkmark-circle" size={16} color={Colors.primary} />
                    <Text style={styles.configuredText}>Configurado</Text>
                  </View>
                )}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Banco</Text>
                <TextInput
                  style={styles.input}
                  value={paymentInfo.bankTransferBank}
                  onChangeText={(text) => setPaymentInfo({ ...paymentInfo, bankTransferBank: text })}
                  placeholder="Ej: Banco de Venezuela"
                  placeholderTextColor={Colors.placeholder}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Número de Cuenta</Text>
                <TextInput
                  style={styles.input}
                  value={paymentInfo.bankTransferAccount}
                  onChangeText={(text) => setPaymentInfo({ ...paymentInfo, bankTransferAccount: text })}
                  placeholder="0102-1234-5678-9012"
                  placeholderTextColor={Colors.placeholder}
                  keyboardType="number-pad"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Tipo de Cuenta</Text>
                <View style={styles.accountTypeButtons}>
                  <TouchableOpacity
                    style={[
                      styles.accountTypeButton,
                      paymentInfo.bankTransferAccountType === 'Corriente' && styles.accountTypeButtonActive,
                    ]}
                    onPress={() => setPaymentInfo({ ...paymentInfo, bankTransferAccountType: 'Corriente' })}
                  >
                    <Text
                      style={[
                        styles.accountTypeButtonText,
                        paymentInfo.bankTransferAccountType === 'Corriente' && styles.accountTypeButtonTextActive,
                      ]}
                    >
                      Corriente
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.accountTypeButton,
                      paymentInfo.bankTransferAccountType === 'Ahorro' && styles.accountTypeButtonActive,
                    ]}
                    onPress={() => setPaymentInfo({ ...paymentInfo, bankTransferAccountType: 'Ahorro' })}
                  >
                    <Text
                      style={[
                        styles.accountTypeButtonText,
                        paymentInfo.bankTransferAccountType === 'Ahorro' && styles.accountTypeButtonTextActive,
                      ]}
                    >
                      Ahorro
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <View style={styles.paymentInfoNote}>
              <Ionicons name="information-circle" size={20} color="#6b7280" />
              <Text style={styles.paymentInfoNoteText}>
                Debes configurar al menos un método de pago completo para recibir tus ganancias.{'\n\n'}
                • Pago Móvil: cédula, teléfono y banco{'\n'}
                • Transferencia: banco, cuenta y tipo
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.button, styles.saveButton]}
              onPress={handleSavePaymentInfo}
              disabled={isSavingPayment}
            >
              {isSavingPayment ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <Text style={styles.saveButtonText}>Guardar Métodos de Pago</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Settings Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t.settings}</Text>

        <View style={styles.card}>
          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <View style={styles.iconContainer}>
                <Ionicons name="language" size={22} color={Colors.primary} />
              </View>
              <Text style={styles.settingLabel}>{t.language}</Text>
            </View>
            <View style={styles.languageButtons}>
              <TouchableOpacity
                style={[styles.languageButton, language === 'es' && styles.languageButtonActive]}
                onPress={() => handleLanguageChange('es')}
              >
                <Text
                  style={[
                    styles.languageButtonText,
                    language === 'es' && styles.languageButtonTextActive,
                  ]}
                >
                  {t.spanish}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.languageButton, language === 'en' && styles.languageButtonActive]}
                onPress={() => handleLanguageChange('en')}
              >
                <Text
                  style={[
                    styles.languageButtonText,
                    language === 'en' && styles.languageButtonTextActive,
                  ]}
                >
                  {t.english}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>

      {/* Notifications Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t.notifications}</Text>

        <View style={styles.card}>
          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <View style={styles.iconContainer}>
                <Ionicons name="notifications" size={22} color={Colors.primary} />
              </View>
              <Text style={styles.settingLabel}>Solicitudes de viaje</Text>
            </View>
            <Switch
              value={notificationPrefs.rideRequests}
              onValueChange={value => handleUpdateNotificationPref('rideRequests', value)}
              trackColor={{ false: Colors.lightGray, true: Colors.light }}
              thumbColor={notificationPrefs.rideRequests ? Colors.primary : Colors.white}
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <View style={styles.iconContainer}>
                <Ionicons name="car" size={22} color={Colors.primary} />
              </View>
              <Text style={styles.settingLabel}>Actualizaciones de viaje</Text>
            </View>
            <Switch
              value={notificationPrefs.rideUpdates}
              onValueChange={value => handleUpdateNotificationPref('rideUpdates', value)}
              trackColor={{ false: Colors.lightGray, true: Colors.light }}
              thumbColor={notificationPrefs.rideUpdates ? Colors.primary : Colors.white}
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <View style={styles.iconContainer}>
                <Ionicons name="card" size={22} color={Colors.primary} />
              </View>
              <Text style={styles.settingLabel}>Pagos</Text>
            </View>
            <Switch
              value={notificationPrefs.payments}
              onValueChange={value => handleUpdateNotificationPref('payments', value)}
              trackColor={{ false: Colors.lightGray, true: Colors.light }}
              thumbColor={notificationPrefs.payments ? Colors.primary : Colors.white}
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <View style={styles.iconContainer}>
                <Ionicons name="megaphone" size={22} color={Colors.primary} />
              </View>
              <Text style={styles.settingLabel}>Promociones</Text>
            </View>
            <Switch
              value={notificationPrefs.promotions}
              onValueChange={value => handleUpdateNotificationPref('promotions', value)}
              trackColor={{ false: Colors.lightGray, true: Colors.light }}
              thumbColor={notificationPrefs.promotions ? Colors.primary : Colors.white}
            />
          </View>
        </View>
      </View>

      {/* Account Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t.account}</Text>

        <View style={styles.card}>
          <TouchableOpacity style={styles.actionItem} onPress={handleLogout}>
            <View style={styles.settingLeft}>
              <View style={styles.iconContainer}>
                <Ionicons name="log-out-outline" size={22} color={Colors.primary} />
              </View>
              <Text style={styles.actionLabel}>{t.logout}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.actionItem} onPress={handleDeleteAccount}>
            <View style={styles.settingLeft}>
              <View style={[styles.iconContainer, { backgroundColor: '#fef2f2' }]}>
                <Ionicons name="trash-outline" size={22} color={Colors.error} />
              </View>
              <Text style={[styles.actionLabel, styles.dangerText]}>{t.deleteAccount}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f9ff',
  },
  contentContainer: {
    padding: Spacing.md,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f9ff',
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  editButtonText: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: Spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  availabilityItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  availabilityTextContainer: {
    flex: 1,
  },
  availabilityLabel: {
    fontSize: 16,
    color: '#1f2937',
    fontWeight: '600',
  },
  availabilitySubtext: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  inputGroup: {
    marginBottom: Spacing.md,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    height: 52,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: Spacing.md,
    fontSize: 16,
    color: Colors.darkGray,
    backgroundColor: Colors.white,
  },
  inputDisabled: {
    backgroundColor: '#f9fafb',
    borderColor: '#e5e7eb',
    color: '#9ca3af',
  },
  editActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  button: {
    flex: 1,
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: Colors.white,
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  cancelButtonText: {
    color: '#6b7280',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#f0fdf4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainerActive: {
    backgroundColor: '#dcfce7',
  },
  settingLabel: {
    fontSize: 16,
    color: '#1f2937',
    fontWeight: '500',
    flex: 1,
  },
  languageButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  languageButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    backgroundColor: Colors.white,
  },
  languageButtonActive: {
    borderColor: Colors.primary,
    backgroundColor: '#f0fdf4',
  },
  languageButtonText: {
    color: '#9ca3af',
    fontSize: 14,
    fontWeight: '600',
  },
  languageButtonTextActive: {
    color: Colors.primary,
  },
  divider: {
    height: 1,
    backgroundColor: '#f3f4f6',
    marginVertical: Spacing.xs,
  },
  actionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  actionLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1f2937',
  },
  dangerText: {
    color: Colors.error,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  statusConnected: {
    backgroundColor: Colors.primary,
  },
  statusDisconnected: {
    backgroundColor: Colors.error,
  },
  bottomSpacer: {
    height: Spacing.xxl,
  },
  paymentMethodSection: {
    marginBottom: Spacing.md,
  },
  paymentMethodHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  paymentMethodTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  configuredBadge: {
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
  configuredText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
  },
  accountTypeButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  accountTypeButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    backgroundColor: Colors.white,
    alignItems: 'center',
  },
  accountTypeButtonActive: {
    borderColor: Colors.primary,
    backgroundColor: '#f0fdf4',
  },
  accountTypeButtonText: {
    color: '#9ca3af',
    fontSize: 14,
    fontWeight: '600',
  },
  accountTypeButtonTextActive: {
    color: Colors.primary,
  },
  paymentInfoNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#f9fafb',
    padding: Spacing.md,
    borderRadius: 10,
    marginTop: Spacing.md,
    marginBottom: Spacing.md,
  },
  paymentInfoNoteText: {
    flex: 1,
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 18,
  },
});
