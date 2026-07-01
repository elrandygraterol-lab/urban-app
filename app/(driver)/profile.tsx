import React, { useState, useEffect, useCallback } from 'react';
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
  Image,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Colors, Spacing } from '../../constants/theme';
import { useAuthStore } from '../../store/authStore';
import { useDriverStore } from '../../store/driverStore';
import { useLanguage } from '../../hooks/useLanguage';
import { translations } from '../../i18n/translations';
import { userAPI, notificationAPI, driverAPI } from '../../services/api';
import {
  getSocket,
  addConnectionListener,
  removeConnectionListener,
  reconnectSocket,
  getSocketDiagnostics,
} from '@/services/socket';

import { resolveFileUrl } from '@/services/fileUrl';
import { compressImage } from '@/utils/imageUtils';
import { useUnifiedNotifications } from '@/context/UnifiedNotificationContext';

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
  const { isAvailable, isUpdatingAvailability, setIsAvailable, toggleAvailability } =
    useDriverStore();
  const { language, setLanguage } = useLanguage();
  const t = translations[language].profile;
  const { showToast, showStatus, showActionSheet, dismissStatus } = useUnifiedNotifications();

  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const [isReconnectingSocket, setIsReconnectingSocket] = useState(false);
  const [socketRetryCount, setSocketRetryCount] = useState(0);
  const [socketTransport, setSocketTransport] = useState<string | null>(null);
  const [socketLastError, setSocketLastError] = useState<string | null>(null);
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
    promotions: true,
  });

  const loadUserData = useCallback(async () => {
    try {
      setIsLoading(true);

      // Load user info
      const userResponse = await userAPI.getMe();

      if (!userResponse || !userResponse.data || !userResponse.data.data) {
        console.warn('User API returned invalid response:', userResponse);
        showToast(t.loadError, 'error');
        return;
      }

      const userData = userResponse.data.data;

      // Update auth store with fresh data (API response takes priority)
      const currentUser = useAuthStore.getState().user;
      if (currentUser) {
        useAuthStore.getState().setUser({
          ...currentUser,
          name: userData.name || currentUser.name,
          phone: userData.phone || currentUser.phone,
          email: userData.email || currentUser.email,
          profilePhotoUrl: userData.profilePhotoUrl || currentUser.profilePhotoUrl,
        });
      }

      setName(userData.name || '');
      setPhone(userData.phone || '');
      setEmail(userData.email || '');

      // Load driver profile to get availability status
      try {
        const driverProfile = await driverAPI.getMyProfile();
        const profile = driverProfile.data.data;
        if (profile && profile.isAvailable !== undefined) {
          setIsAvailable(profile.isAvailable);
        }

        // Load payment information
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
        console.log('Could not load driver availability:', error);
      }

      // Load notification preferences
      try {
        const prefsResponse = await notificationAPI.getPreferences();
        if (prefsResponse.data && prefsResponse.data.preferences) {
          setNotificationPrefs(prefsResponse.data.preferences);
        }
      } catch {
        console.log('No notification preferences found, using defaults');
      }
    } catch (error) {
      console.error('Error loading user data:', error);
      showToast(t.loadError, 'error');
    } finally {
      setIsLoading(false);
    }
  }, [showToast, setIsAvailable, t]);

  useFocusEffect(useCallback(() => {
    loadUserData();
  }, [loadUserData]));

  useEffect(() => {
    // Usar addConnectionListener en lugar de getSocket() directo
    // Esto funciona aunque el socket aún no se haya inicializado
    const connectionListener = (connected: boolean) => {
      console.log(
        '[DRIVER PROFILE] 🔌 Socket connection state:',
        connected ? 'Conectado' : 'Desconectado'
      );
      setIsSocketConnected(connected);

      // Update diagnostic info whenever state changes
      const diag = getSocketDiagnostics();
      setSocketRetryCount(diag.reconnectAttempts);
      setSocketTransport(diag.lastTransport);
      setSocketLastError(diag.lastError);
    };
    addConnectionListener(connectionListener);

    // Listen for availability changes from other sources (e.g., home screen toggle)
    // Solo si el socket ya está disponible; si no, se escuchará tras reconexión
    const socket = getSocket();
    if (socket) {
      const handleAvailabilityChanged = (data: {
        driverId: string;
        isAvailable: boolean;
        timestamp: string;
      }) => {
        console.log('[DRIVER PROFILE] ========================================');
        console.log('[DRIVER PROFILE] Availability changed event received');
        console.log('[DRIVER PROFILE]    Driver ID:', data.driverId);
        console.log('[DRIVER PROFILE]    Is Available:', data.isAvailable);
        console.log('[DRIVER PROFILE]    Timestamp:', data.timestamp);
        console.log('[DRIVER PROFILE] ========================================');

        // Update the availability state
        setIsAvailable(data.isAvailable);
      };
      socket.on('driver:availability_changed', handleAvailabilityChanged);

      return () => {
        removeConnectionListener(connectionListener);
        socket.off('driver:availability_changed', handleAvailabilityChanged);
      };
    }

    return () => {
      removeConnectionListener(connectionListener);
    };
  }, [setIsAvailable]);

  const handleSaveProfile = async () => {
    try {
      setIsSaving(true);
      await userAPI.updateMe({ name, phone });
      setIsEditing(false);
      showToast(t.updateSuccess, 'success');
    } catch (error) {
      console.error('Error updating profile:', error);
      showToast(t.updateError, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSavePaymentInfo = async () => {
    try {
      // Validar que al menos un método esté configurado
      const hasPagoMovil =
        paymentInfo.pagoMovilPhone && paymentInfo.pagoMovilBank && paymentInfo.pagoMovilCedula;
      const hasBankTransfer = paymentInfo.bankTransferBank && paymentInfo.bankTransferAccount;

      if (!hasPagoMovil && !hasBankTransfer) {
        showToast(
          'Debes configurar al menos un método de pago completo:\n\n• Pago Móvil: teléfono, banco y cédula\n• Transferencia: banco y cuenta',
          'error'
        );
        return;
      }

      setIsSavingPayment(true);
      await driverAPI.updatePaymentInfo(paymentInfo);
      showToast('Información de pago actualizada exitosamente', 'success');
      setIsPaymentSectionExpanded(false);
    } catch (error: any) {
      console.error('Error updating payment info:', error);
      const errorMessage =
        error?.response?.data?.error?.message || 'Error al actualizar información de pago';
      showToast(errorMessage, 'error');
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
    showStatus(
      'info',
      'Esta opción estará disponible en una futura actualización. Por ahora, las notificaciones permanecen activadas por defecto.',
      'En desarrollo'
    );
  };

  const handleLanguageChange = async (newLanguage: 'es' | 'en') => {
    try {
      await setLanguage(newLanguage);
    } catch (error) {
      console.error('Error changing language:', error);
    }
  };

  const handleLogout = () => {
    showStatus('warning', t.logoutConfirmMessage, t.logoutConfirmTitle, undefined, {
      label: t.logoutConfirmButton,
      onPress: async () => {
        dismissStatus();
        await logout();
        router.replace('/(auth)/login');
      },
    });
  };

  const handleDeleteAccount = () => {
    showStatus('warning', t.deleteConfirmMessage, t.deleteConfirmTitle, undefined, {
      label: t.deleteConfirmButton,
      onPress: () => {
        showStatus('warning', t.deleteSecondConfirmMessage, t.deleteSecondConfirmTitle, undefined, {
          label: t.deleteSecondConfirmButton,
          onPress: async () => {
            try {
              dismissStatus();
              await userAPI.deleteAccount();
              showToast(t.deleteSuccess, 'success');
              setTimeout(async () => {
                await logout();
                router.replace('/(auth)/login');
              }, 800);
            } catch (error) {
              console.error('Error deleting account:', error);
              showToast(t.deleteError, 'error');
            }
          },
        });
      },
    });
  };

  const handleWebDeleteRequest = () => {
    Linking.openURL('https://administracionurbantaxis.com/eliminar-cuenta');
  };

  const handleChangePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        showStatus('info', 'Necesitamos permiso para acceder a tus fotos', 'Permiso requerido');
        return;
      }

      showActionSheet('Foto de perfil', [
        {
          label: 'Tomar foto',
          icon: 'camera',
          onPress: async () => {
            const result = await ImagePicker.launchCameraAsync({
              mediaTypes: ['images'],
              allowsEditing: true,
              aspect: [1, 1],
              quality: 0.8,
            });

            if (!result.canceled && result.assets[0]) {
              await uploadPhoto(result.assets[0].uri);
            }
          },
        },
        {
          label: 'Elegir de galería',
          icon: 'images',
          onPress: async () => {
            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['images'],
              allowsEditing: true,
              aspect: [1, 1],
              quality: 0.8,
            });

            if (!result.canceled && result.assets[0]) {
              await uploadPhoto(result.assets[0].uri);
            }
          },
        },
      ], 'Elige una opción');
    } catch (error) {
      console.error('Error picking profile photo:', error);
      showToast('No se pudo seleccionar la foto', 'error');
    }
  };

  const uploadPhoto = async (uri: string) => {
    try {
      const compressedUri = await compressImage(uri, { type: 'photo' });
      const result = await userAPI.uploadPhoto(compressedUri);
      const profilePhotoUrl = result.profilePhotoUrl || result.data?.profilePhotoUrl;
      if (user) {
        useAuthStore.getState().setUser({ ...user, profilePhotoUrl });
      }
      showToast('Foto de perfil actualizada', 'success');
    } catch (error) {
      console.error('Error uploading photo:', error);
      showToast('No se pudo actualizar la foto de perfil', 'error');
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Profile Header Card ── */}
        <View style={styles.profileCard}>
          <TouchableOpacity onPress={handleChangePhoto} style={styles.profileAvatarWrapper}>
            {resolveFileUrl(user?.profilePhotoUrl) ? (
              <Image
                source={{ uri: `${resolveFileUrl(user?.profilePhotoUrl)}?t=${Date.now()}` }}
                style={styles.profileAvatar}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.profileAvatarPlaceholder}>
                <Ionicons name="person" size={36} color={Colors.primary} />
              </View>
            )}
            <View style={styles.profileAvatarBadge}>
              <Ionicons name="camera" size={12} color={Colors.white} />
            </View>
          </TouchableOpacity>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{user?.name || ''}</Text>
            <Text style={styles.profileRole}>Conductor</Text>
            {user?.rating !== undefined && (
              <View style={styles.profileRating}>
                <Ionicons name="star" size={14} color="#f59e0b" />
                <Text style={styles.profileRatingText}>
                  {Number(user.rating).toFixed(1)}
                </Text>
              </View>
            )}
          </View>
          <TouchableOpacity
            style={styles.profileEditBtn}
            onPress={() => setIsEditing(!isEditing)}
          >
            <Ionicons
              name={isEditing ? 'close' : 'create-outline'}
              size={20}
              color={Colors.primary}
            />
          </TouchableOpacity>
        </View>

        {/* ── Edit Mode ── */}
        {isEditing && (
          <View style={styles.editCard}>
            <View style={styles.inputRow}>
              <View style={styles.inputIcon}>
                <Ionicons name="person-outline" size={18} color={Colors.primary} />
              </View>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder={t.name}
                placeholderTextColor={Colors.placeholder}
              />
            </View>
            <View style={styles.inputRow}>
              <View style={styles.inputIcon}>
                <Ionicons name="call-outline" size={18} color={Colors.primary} />
              </View>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder={t.phone}
                placeholderTextColor={Colors.placeholder}
                keyboardType="phone-pad"
              />
            </View>
            <View style={styles.inputRow}>
              <View style={styles.inputIcon}>
                <Ionicons name="mail-outline" size={18} color={Colors.placeholder} />
              </View>
              <TextInput
                style={[styles.input, styles.inputDisabled]}
                value={email}
                editable={false}
                placeholder={t.email}
                placeholderTextColor={Colors.placeholder}
              />
            </View>
            <View style={styles.editActions}>
              <TouchableOpacity
                style={styles.editCancelBtn}
                onPress={() => {
                  setIsEditing(false);
                  setName(user?.name || '');
                  setPhone(user?.phone || '');
                }}
              >
                <Text style={styles.editCancelText}>{t.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.editSaveBtn}
                onPress={handleSaveProfile}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator color={Colors.white} size="small" />
                ) : (
                  <Text style={styles.editSaveText}>{t.save}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── Availability Section ── */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionLabel}>DISPONIBILIDAD</Text>

          <View style={styles.settingRow}>
            <View style={styles.settingRowLeft}>
              <View style={styles.settingDot}>
                <View
                  style={[
                    styles.dot,
                    isSocketConnected ? styles.dotGreen : styles.dotRed,
                  ]}
                />
              </View>
              <View>
                <Text style={styles.settingRowTitle}>
                  {isReconnectingSocket ? 'Reconectando...' : 'Servidor'}
                </Text>
                <Text style={styles.settingRowSub}>
                  {isReconnectingSocket
                    ? 'Conectando...'
                    : isSocketConnected
                      ? socketTransport
                        ? `Conectado (${socketTransport})`
                        : 'Conectado'
                      : 'Desconectado — Toca para reconectar'}
                </Text>
              </View>
            </View>
            {!isSocketConnected && (
              <TouchableOpacity
                style={styles.retryBtn}
                onPress={async () => {
                  if (!isReconnectingSocket) {
                    setIsReconnectingSocket(true);
                    try { await reconnectSocket(); } catch {}
                    setIsReconnectingSocket(false);
                  }
                }}
                disabled={isReconnectingSocket}
              >
                {isReconnectingSocket ? (
                  <ActivityIndicator size="small" color={Colors.primary} />
                ) : (
                  <Text style={styles.retryBtnText}>Reconectar</Text>
                )}
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.rowDivider} />

          <View style={styles.settingRow}>
            <View style={styles.settingRowLeft}>
              <View style={styles.settingDot}>
                <Ionicons
                  name={isAvailable ? 'checkmark-circle' : 'close-circle'}
                  size={22}
                  color={isAvailable ? Colors.primary : Colors.mediumGray}
                />
              </View>
              <View>
                <Text style={styles.settingRowTitle}>
                  {isAvailable ? 'En Línea' : 'Fuera de Línea'}
                </Text>
                <Text style={styles.settingRowSub}>
                  {isAvailable ? 'Recibiendo solicitudes' : 'No recibiendo solicitudes'}
                </Text>
              </View>
            </View>
            <Switch
              value={isAvailable}
              onValueChange={handleToggleAvailability}
              disabled={isUpdatingAvailability}
              trackColor={{ false: '#e5e7eb', true: '#bbf7d0' }}
              thumbColor={isAvailable ? Colors.primary : '#9ca3af'}
            />
          </View>
        </View>

        {/* ── Payment Section ── */}
        <View style={styles.sectionCard}>
          <TouchableOpacity
            style={styles.sectionRow}
            onPress={() => setIsPaymentSectionExpanded(!isPaymentSectionExpanded)}
            activeOpacity={0.7}
          >
            <Text style={styles.sectionLabel}>MÉTODOS DE PAGO</Text>
            <Ionicons
              name={isPaymentSectionExpanded ? 'chevron-up' : 'chevron-down'}
              size={20}
              color="#9ca3af"
            />
          </TouchableOpacity>

          {isPaymentSectionExpanded && (
            <View style={styles.paymentContent}>
              {/* Pago Móvil */}
              <View style={styles.paymentBlock}>
                <View style={styles.paymentBlockHeader}>
                  <View style={styles.settingRowLeft}>
                    <View style={styles.settingDot}>
                      <Ionicons name="phone-portrait-outline" size={20} color={Colors.primary} />
                    </View>
                    <Text style={styles.paymentBlockTitle}>Pago Móvil</Text>
                  </View>
                  {paymentInfo.pagoMovilPhone && paymentInfo.pagoMovilBank && paymentInfo.pagoMovilCedula && (
                    <View style={styles.configuredBadge}>
                      <Ionicons name="checkmark-circle" size={14} color={Colors.primary} />
                      <Text style={styles.configuredText}>Listo</Text>
                    </View>
                  )}
                </View>
                <View style={styles.paymentInputGroup}>
                  <TextInput
                    style={styles.paymentInput}
                    value={paymentInfo.pagoMovilCedula}
                    onChangeText={text => setPaymentInfo({ ...paymentInfo, pagoMovilCedula: text })}
                    placeholder="Cédula — V-12345678"
                    placeholderTextColor={Colors.placeholder}
                  />
                  <TextInput
                    style={styles.paymentInput}
                    value={paymentInfo.pagoMovilPhone}
                    onChangeText={text => setPaymentInfo({ ...paymentInfo, pagoMovilPhone: text })}
                    placeholder="Teléfono — 0414-1234567"
                    placeholderTextColor={Colors.placeholder}
                    keyboardType="phone-pad"
                  />
                  <TextInput
                    style={styles.paymentInput}
                    value={paymentInfo.pagoMovilBank}
                    onChangeText={text => setPaymentInfo({ ...paymentInfo, pagoMovilBank: text })}
                    placeholder="Banco — Ej: Venezuela"
                    placeholderTextColor={Colors.placeholder}
                  />
                </View>
              </View>

              <View style={styles.rowDivider} />

              {/* Transferencia */}
              <View style={styles.paymentBlock}>
                <View style={styles.paymentBlockHeader}>
                  <View style={styles.settingRowLeft}>
                    <View style={styles.settingDot}>
                      <Ionicons name="business-outline" size={20} color={Colors.primary} />
                    </View>
                    <Text style={styles.paymentBlockTitle}>Transferencia</Text>
                  </View>
                  {paymentInfo.bankTransferAccount && paymentInfo.bankTransferBank && (
                    <View style={styles.configuredBadge}>
                      <Ionicons name="checkmark-circle" size={14} color={Colors.primary} />
                      <Text style={styles.configuredText}>Listo</Text>
                    </View>
                  )}
                </View>
                <View style={styles.paymentInputGroup}>
                  <TextInput
                    style={styles.paymentInput}
                    value={paymentInfo.bankTransferBank}
                    onChangeText={text => setPaymentInfo({ ...paymentInfo, bankTransferBank: text })}
                    placeholder="Banco"
                    placeholderTextColor={Colors.placeholder}
                  />
                  <TextInput
                    style={styles.paymentInput}
                    value={paymentInfo.bankTransferAccount}
                    onChangeText={text => setPaymentInfo({ ...paymentInfo, bankTransferAccount: text })}
                    placeholder="N° de Cuenta — 0102-1234-5678"
                    placeholderTextColor={Colors.placeholder}
                    keyboardType="number-pad"
                  />
                  <View style={styles.accountTypeRow}>
                    <TouchableOpacity
                      style={[
                        styles.accountTypeBtn,
                        paymentInfo.bankTransferAccountType === 'Corriente' && styles.accountTypeBtnActive,
                      ]}
                      onPress={() => setPaymentInfo({ ...paymentInfo, bankTransferAccountType: 'Corriente' })}
                    >
                      <Text style={[
                        styles.accountTypeBtnText,
                        paymentInfo.bankTransferAccountType === 'Corriente' && styles.accountTypeBtnTextActive,
                      ]}>Corriente</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.accountTypeBtn,
                        paymentInfo.bankTransferAccountType === 'Ahorro' && styles.accountTypeBtnActive,
                      ]}
                      onPress={() => setPaymentInfo({ ...paymentInfo, bankTransferAccountType: 'Ahorro' })}
                    >
                      <Text style={[
                        styles.accountTypeBtnText,
                        paymentInfo.bankTransferAccountType === 'Ahorro' && styles.accountTypeBtnTextActive,
                      ]}>Ahorro</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              <View style={styles.paymentNote}>
                <Ionicons name="information-circle-outline" size={16} color="#6b7280" />
                <Text style={styles.paymentNoteText}>
                  Configura al menos un método para recibir tus ganancias.
                </Text>
              </View>

              <TouchableOpacity
                style={styles.paymentSaveBtn}
                onPress={handleSavePaymentInfo}
                disabled={isSavingPayment}
              >
                {isSavingPayment ? (
                  <ActivityIndicator color={Colors.white} size="small" />
                ) : (
                  <Text style={styles.paymentSaveText}>Guardar Métodos de Pago</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ── Settings Section ── */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionLabel}>CONFIGURACIÓN</Text>

          <View style={styles.settingRow}>
            <View style={styles.settingRowLeft}>
              <View style={styles.settingDot}>
                <Ionicons name="language-outline" size={20} color={Colors.primary} />
              </View>
              <Text style={styles.settingRowTitle}>{t.language}</Text>
            </View>
            <View style={styles.langRow}>
              <TouchableOpacity
                style={[styles.langBtn, language === 'es' && styles.langBtnActive]}
                onPress={() => handleLanguageChange('es')}
              >
                <Text style={[styles.langBtnText, language === 'es' && styles.langBtnTextActive]}>
                  ES
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.langBtn, language === 'en' && styles.langBtnActive]}
                onPress={() => handleLanguageChange('en')}
              >
                <Text style={[styles.langBtnText, language === 'en' && styles.langBtnTextActive]}>
                  EN
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ── Notifications Section ── */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionLabel}>NOTIFICACIONES</Text>

          <View style={styles.settingRow}>
            <View style={styles.settingRowLeft}>
              <View style={styles.settingDot}>
                <Ionicons name="notifications-outline" size={20} color={Colors.primary} />
              </View>
              <Text style={styles.settingRowTitle}>Solicitudes de viaje</Text>
            </View>
            <Switch
              value={notificationPrefs.rideRequests}
              onValueChange={value => handleUpdateNotificationPref('rideRequests', value)}
              trackColor={{ false: '#e5e7eb', true: '#bbf7d0' }}
              thumbColor={notificationPrefs.rideRequests ? Colors.primary : '#9ca3af'}
            />
          </View>
          <View style={styles.rowDivider} />
          <View style={styles.settingRow}>
            <View style={styles.settingRowLeft}>
              <View style={styles.settingDot}>
                <Ionicons name="car-outline" size={20} color={Colors.primary} />
              </View>
              <Text style={styles.settingRowTitle}>Actualizaciones de viaje</Text>
            </View>
            <Switch
              value={notificationPrefs.rideUpdates}
              onValueChange={value => handleUpdateNotificationPref('rideUpdates', value)}
              trackColor={{ false: '#e5e7eb', true: '#bbf7d0' }}
              thumbColor={notificationPrefs.rideUpdates ? Colors.primary : '#9ca3af'}
            />
          </View>
          <View style={styles.rowDivider} />
          <View style={styles.settingRow}>
            <View style={styles.settingRowLeft}>
              <View style={styles.settingDot}>
                <Ionicons name="card-outline" size={20} color={Colors.primary} />
              </View>
              <Text style={styles.settingRowTitle}>Pagos</Text>
            </View>
            <Switch
              value={notificationPrefs.payments}
              onValueChange={value => handleUpdateNotificationPref('payments', value)}
              trackColor={{ false: '#e5e7eb', true: '#bbf7d0' }}
              thumbColor={notificationPrefs.payments ? Colors.primary : '#9ca3af'}
            />
          </View>
          <View style={styles.rowDivider} />
          <View style={styles.settingRow}>
            <View style={styles.settingRowLeft}>
              <View style={styles.settingDot}>
                <Ionicons name="megaphone-outline" size={20} color={Colors.primary} />
              </View>
              <Text style={styles.settingRowTitle}>Promociones</Text>
            </View>
            <Switch
              value={notificationPrefs.promotions}
              onValueChange={value => handleUpdateNotificationPref('promotions', value)}
              trackColor={{ false: '#e5e7eb', true: '#bbf7d0' }}
              thumbColor={notificationPrefs.promotions ? Colors.primary : '#9ca3af'}
            />
          </View>
        </View>

        {/* ── Account Section ── */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionLabel}>CUENTA</Text>

          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => router.push('/(driver)/manage-ride' as any)}
          >
            <View style={styles.settingRowLeft}>
              <View style={styles.settingDot}>
                <Ionicons name="car-sport-outline" size={20} color={Colors.primary} />
              </View>
              <Text style={styles.settingRowTitle}>Gestionar Viaje</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#d1d5db" />
          </TouchableOpacity>

          <View style={styles.rowDivider} />

          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => router.push('/(auth)/terms-of-service' as any)}
          >
            <View style={styles.settingRowLeft}>
              <View style={styles.settingDot}>
                <Ionicons name="document-text-outline" size={20} color={Colors.primary} />
              </View>
              <Text style={styles.settingRowTitle}>Términos de Servicio</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#d1d5db" />
          </TouchableOpacity>

          <View style={styles.rowDivider} />

          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => router.push('/(auth)/privacy-policy' as any)}
          >
            <View style={styles.settingRowLeft}>
              <View style={styles.settingDot}>
                <Ionicons name="shield-checkmark-outline" size={20} color={Colors.primary} />
              </View>
              <Text style={styles.settingRowTitle}>Política de Privacidad</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#d1d5db" />
          </TouchableOpacity>

          <View style={styles.rowDivider} />

          <TouchableOpacity style={styles.settingRow} onPress={handleLogout}>
            <View style={styles.settingRowLeft}>
              <View style={styles.settingDot}>
                <Ionicons name="log-out-outline" size={20} color={Colors.primary} />
              </View>
              <Text style={styles.settingRowTitle}>{t.logout}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#d1d5db" />
          </TouchableOpacity>

          <View style={styles.rowDivider} />

          <TouchableOpacity style={styles.settingRow} onPress={handleDeleteAccount}>
            <View style={styles.settingRowLeft}>
              <View style={[styles.settingDot, styles.dotDanger]}>
                <Ionicons name="trash-outline" size={20} color={Colors.error} />
              </View>
              <Text style={[styles.settingRowTitle, styles.textDanger]}>{t.deleteAccount}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#d1d5db" />
          </TouchableOpacity>

          <View style={styles.rowDivider} />

          <TouchableOpacity style={styles.settingRow} onPress={handleWebDeleteRequest}>
            <View style={styles.settingRowLeft}>
              <View style={[styles.settingDot, styles.dotDanger]}>
                <Ionicons name="globe-outline" size={20} color={Colors.error} />
              </View>
              <Text style={[styles.settingRowTitle, styles.textDanger]}>Solicitar por web</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#d1d5db" />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },

  // ── Profile Card ─────────────────────────────────────────────────────────
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  profileAvatarWrapper: {
    position: 'relative',
    marginRight: 14,
  },
  profileAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  profileAvatarPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#f0fdf4',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#dcfce7',
  },
  profileAvatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.white,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  profileRole: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
  },
  profileRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  profileRatingText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
  },
  profileEditBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#f0fdf4',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Edit Card ────────────────────────────────────────────────────────────
  editCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  inputIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#f0fdf4',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: 46,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#111827',
    backgroundColor: Colors.white,
  },
  inputDisabled: {
    backgroundColor: '#f9fafb',
    borderColor: '#e5e7eb',
    color: '#9ca3af',
  },
  editActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  editCancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
  },
  editCancelText: {
    color: '#6b7280',
    fontSize: 14,
    fontWeight: '600',
  },
  editSaveBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  editSaveText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '600',
  },

  // ── Section Cards ────────────────────────────────────────────────────────
  sectionCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9ca3af',
    letterSpacing: 1.2,
    marginBottom: 14,
  },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  // ── Setting Rows ─────────────────────────────────────────────────────────
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  settingRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  settingDot: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#f0fdf4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dotGreen: {
    backgroundColor: '#22c55e',
  },
  dotRed: {
    backgroundColor: '#ef4444',
  },
  dotDanger: {
    backgroundColor: '#fef2f2',
  },
  settingRowTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  settingRowSub: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 1,
  },
  retryBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  retryBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
  },
  rowDivider: {
    height: 1,
    backgroundColor: '#f3f4f6',
    marginVertical: 8,
  },
  textDanger: {
    color: Colors.error,
  },

  // ── Language ─────────────────────────────────────────────────────────────
  langRow: {
    flexDirection: 'row',
    gap: 6,
  },
  langBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
  },
  langBtnActive: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  langBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#9ca3af',
    letterSpacing: 0.5,
  },
  langBtnTextActive: {
    color: Colors.primary,
  },

  // ── Payment Methods ──────────────────────────────────────────────────────
  paymentContent: {
    marginTop: 4,
  },
  paymentBlock: {
    paddingTop: 4,
  },
  paymentBlockHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  paymentBlockTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  configuredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  configuredText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.primary,
  },
  paymentInputGroup: {
    gap: 8,
  },
  paymentInput: {
    height: 44,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 14,
    color: '#111827',
    backgroundColor: Colors.white,
  },
  accountTypeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  accountTypeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    backgroundColor: Colors.white,
    alignItems: 'center',
  },
  accountTypeBtnActive: {
    borderColor: Colors.primary,
    backgroundColor: '#f0fdf4',
  },
  accountTypeBtnText: {
    color: '#9ca3af',
    fontSize: 13,
    fontWeight: '600',
  },
  accountTypeBtnTextActive: {
    color: Colors.primary,
  },
  paymentNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 10,
    marginTop: 12,
  },
  paymentNoteText: {
    flex: 1,
    fontSize: 12,
    color: '#6b7280',
    lineHeight: 17,
  },
  paymentSaveBtn: {
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    marginTop: 12,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  paymentSaveText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '600',
  },

  // ── Misc ─────────────────────────────────────────────────────────────────

});
