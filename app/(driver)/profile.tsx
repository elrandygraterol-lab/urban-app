import React, { useState, useEffect, useMemo } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../constants/theme';
import { useAuthStore } from '../../store/authStore';
import { useDriverStore } from '../../store/driverStore';
import { useLanguage } from '../../hooks/useLanguage';
import { translations } from '../../i18n/translations';
import { userAPI, notificationAPI, driverAPI } from '../../services/api';
import { getSocket, addConnectionListener, removeConnectionListener, reconnectSocket, getSocketDiagnostics } from '@/services/socket';
import { resolveFileUrl } from '@/services/fileUrl';
import { subscribeToLogs, getAllLogs, clearLogs, getLogsAsText } from '@/services/logCapture';
import type { LogEntry, LogLevel } from '@/services/logCapture';
import * as Clipboard from 'expo-clipboard';

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
  const [isReconnectingSocket, setIsReconnectingSocket] = useState(false);
  const [socketRetryCount, setSocketRetryCount] = useState(0);
  const [socketTransport, setSocketTransport] = useState<string | null>(null);
  const [socketLastError, setSocketLastError] = useState<string | null>(null);
  const [isPaymentSectionExpanded, setIsPaymentSectionExpanded] = useState(false);
  const [isSavingPayment, setIsSavingPayment] = useState(false);
  const [isSystemSectionExpanded, setIsSystemSectionExpanded] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logFilter, setLogFilter] = useState<'all' | LogLevel>('all');
  const [isCopied, setIsCopied] = useState(false);
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);
  const logScrollRef = React.useRef<ScrollView>(null);

  // Computed filtered logs and counts
  const logLevelCounts = useMemo(() => ({
    all: logs.length,
    log: logs.filter(l => l.level === 'log').length,
    warn: logs.filter(l => l.level === 'warn').length,
    error: logs.filter(l => l.level === 'error').length,
  }), [logs]);

  const filteredLogs = useMemo(() => {
    if (logFilter === 'all') return logs;
    return logs.filter(l => l.level === logFilter);
  }, [logs, logFilter]);

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

  useEffect(() => {
    loadUserData();
    
    // Usar addConnectionListener en lugar de getSocket() directo
    // Esto funciona aunque el socket aún no se haya inicializado
    const connectionListener = (connected: boolean) => {
      console.log('[DRIVER PROFILE] 🔌 Socket connection state:', connected ? 'Conectado' : 'Desconectado');
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
      socket.on('driver:availability_changed', handleAvailabilityChanged);
      
      return () => {
        removeConnectionListener(connectionListener);
        socket.off('driver:availability_changed', handleAvailabilityChanged);
      };
    }
    
    return () => {
      removeConnectionListener(connectionListener);
    };
  }, []);

  // Subscribe to global log capture for the Sistema section
  useEffect(() => {
    // Load existing logs
    setLogs(getAllLogs());

    // Subscribe to new logs
    const unsubscribe = subscribeToLogs((entry) => {
      setLogs(prev => {
        const next = [...prev, entry];
        // Keep only last 1000 locally too
        if (next.length > 1000) {
          return next.slice(next.length - 1000);
        }
        return next;
      });
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Auto-scroll log view when new entries arrive (only if auto-scroll is enabled)
  useEffect(() => {
    if (isSystemSectionExpanded && autoScrollEnabled && logScrollRef.current && logs.length > 0) {
      requestAnimationFrame(() => {
        logScrollRef.current?.scrollToEnd({ animated: true });
      });
    }
  }, [logs.length, isSystemSectionExpanded, autoScrollEnabled]);

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

      // Update auth store with fresh data (including profilePhotoUrl)
      if (user) {
        useAuthStore.getState().setUser({
          ...user,
          name: userData.name || user.name,
          phone: userData.phone || user.phone,
          email: userData.email || user.email,
          profilePhotoUrl: userData.profilePhotoUrl || user.profilePhotoUrl,
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
      const errorMessage = error?.response?.data?.error?.message || 'Error al actualizar información de pago';
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
    Alert.alert(
      'En desarrollo',
      'Esta opción estará disponible en una futura actualización. Por ahora, las notificaciones permanecen activadas por defecto.'
    );
  };

  const handleLanguageChange = async (newLanguage: 'es' | 'en') => {
    try {
      await setLanguage(newLanguage);
    } catch (error) {
      console.error('Error changing language:', error);
    }
  };

  const handleCopyAllLogs = async () => {
    try {
      const text = getLogsAsText(logFilter === 'all' ? undefined : { level: logFilter });
      await Clipboard.setStringAsync(text);
      setIsCopied(true);
      Alert.alert('Copiado', `${filteredLogs.length} líneas copiadas al portapapeles`);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (error) {
      Alert.alert('Error', 'No se pudo copiar al portapapeles');
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

  const handleChangePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso requerido', 'Necesitamos permiso para acceder a tus fotos');
        return;
      }

      Alert.alert('Foto de perfil', 'Elige una opción', [
        {
          text: 'Tomar foto',
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
          text: 'Elegir de galería',
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
        {
          text: 'Cancelar',
          style: 'cancel',
        },
      ]);
    } catch (error) {
      console.error('Error picking profile photo:', error);
      Alert.alert('Error', 'No se pudo seleccionar la foto');
    }
  };

  const uploadPhoto = async (uri: string) => {
    try {
      const result = await userAPI.uploadPhoto(uri);
      const profilePhotoUrl = result.data.profilePhotoUrl;
      // Update local user state
      if (user) {
        useAuthStore.getState().setUser({ ...user, profilePhotoUrl });
      }
      Alert.alert('Éxito', 'Foto de perfil actualizada');
    } catch (error) {
      console.error('Error uploading photo:', error);
      Alert.alert('Error', 'No se pudo actualizar la foto de perfil');
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
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Driver Availability Section - FIRST */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Disponibilidad</Text>

        <View style={styles.card}>
          {/* Socket Connection Status - Tappable to reconnect */}
          {/* Socket Connection Status - Tappable to reconnect */}
          <TouchableOpacity
            style={styles.settingItem}
            activeOpacity={isSocketConnected ? 1 : 0.6}
            onPress={async () => {
              if (!isSocketConnected && !isReconnectingSocket) {
                setIsReconnectingSocket(true);
                setSocketLastError(null);
                try {
                  await reconnectSocket();
                } catch (error) {
                  console.error('[PROFILE] Manual reconnection failed:', error);
                } finally {
                  setIsReconnectingSocket(false);
                }
              }
            }}
          >
            <View style={styles.settingLeft}>
              <View style={[styles.iconContainer, isSocketConnected && styles.iconContainerActive]}>
                <Ionicons
                  name={isSocketConnected ? 'wifi' : isReconnectingSocket ? 'sync' : 'wifi-outline'}
                  size={22}
                  color={isSocketConnected ? Colors.primary : Colors.mediumGray}
                />
              </View>
              <View style={styles.availabilityTextContainer}>
                <Text style={styles.settingLabel}>
                  {isReconnectingSocket ? 'Reconectando...' : 'Socket'}
                </Text>
                <Text style={styles.availabilitySubtext}>
                  {isReconnectingSocket
                    ? 'Conectando...'
                    : isSocketConnected
                      ? socketTransport
                        ? `Conectado (${socketTransport})`
                        : 'Conectado'
                      : socketLastError
                        ? `Error: ${socketLastError.substring(0, 40)}`
                        : 'Toca para reconectar'}
                </Text>
                {!isSocketConnected && socketRetryCount > 0 && (
                  <Text style={styles.availabilitySubtext}>
                    {socketRetryCount} intentos
                  </Text>
                )}
              </View>
            </View>
            {isReconnectingSocket ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <View
                style={[
                  styles.statusIndicator,
                  isSocketConnected ? styles.statusConnected : styles.statusDisconnected,
                ]}
              />
            )}
          </TouchableOpacity>

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
          {/* Profile Photo */}
          <View style={styles.avatarSection}>
            <TouchableOpacity onPress={handleChangePhoto} style={styles.avatarContainer}>
              {resolveFileUrl(user?.profilePhotoUrl) ? (
                <Image source={{ uri: resolveFileUrl(user?.profilePhotoUrl) }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Ionicons name="person" size={40} color={Colors.primary} />
                </View>
              )}
              <View style={styles.avatarBadge}>
                <Ionicons name="camera" size={14} color={Colors.white} />
              </View>
            </TouchableOpacity>
            <Text style={styles.avatarName}>{user?.name || ''}</Text>
            <Text style={styles.avatarRole}>
              {user?.role === 'driver' ? 'Conductor' : user?.role || ''}
            </Text>
            <TouchableOpacity onPress={handleChangePhoto} style={styles.changePhotoButton}>
              <Ionicons name="camera-outline" size={16} color={Colors.primary} />
              <Text style={styles.changePhotoText}>Cambiar foto</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.avatarDivider} />

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

      {/* Sistema Section — Log viewer profesional */}
      <View style={styles.section}>
        <TouchableOpacity
          style={styles.sectionHeader}
          onPress={() => setIsSystemSectionExpanded(!isSystemSectionExpanded)}
          activeOpacity={0.7}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              backgroundColor: isSystemSectionExpanded ? '#1e293b' : '#f1f5f9',
              justifyContent: 'center',
              alignItems: 'center',
            }}>
              <Ionicons
                name="terminal-outline"
                size={18}
                color={isSystemSectionExpanded ? '#e2e8f0' : '#475569'}
              />
            </View>
            <View>
              <Text style={styles.sectionTitle}>Sistema</Text>
              {!isSystemSectionExpanded && logs.length > 0 && (
                <Text style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>
                  {filteredLogs.length} logs{logFilter !== 'all' ? ` (${logFilter})` : ''}
                </Text>
              )}
            </View>
            {logs.length > 0 && (
              <View style={{
                backgroundColor: logFilter !== 'all'
                  ? (logFilter === 'error' ? '#dc2626' : logFilter === 'warn' ? '#d97706' : Colors.primary)
                  : Colors.primary,
                borderRadius: 10,
                paddingHorizontal: 8,
                paddingVertical: 2,
                minWidth: 22,
                alignItems: 'center',
              }}>
                <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>
                  {filteredLogs.length}
                </Text>
              </View>
            )}
          </View>
          <Ionicons
            name={isSystemSectionExpanded ? 'chevron-up' : 'chevron-down'}
            size={24}
            color={Colors.primary}
          />
        </TouchableOpacity>

        {isSystemSectionExpanded && (
          <View style={styles.card}>
            {/* Socket Diagnostics Summary - compact cards */}
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
              <View style={{
                flex: 1,
                backgroundColor: isSocketConnected ? '#f0fdf4' : '#fef2f2',
                borderRadius: 10,
                padding: 10,
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                  <View style={{
                    width: 6, height: 6, borderRadius: 3,
                    backgroundColor: isSocketConnected ? '#16a34a' : '#dc2626',
                  }} />
                  <Text style={{ fontSize: 10, color: '#6b7280', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Socket
                  </Text>
                </View>
                <Text style={{ fontSize: 13, fontWeight: '700', color: isSocketConnected ? '#16a34a' : '#dc2626' }}>
                  {isSocketConnected ? 'Conectado' : 'Desconectado'}
                </Text>
                {socketTransport && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 }}>
                    <Ionicons name="radio-outline" size={10} color="#9ca3af" />
                    <Text style={{ fontSize: 10, color: '#9ca3af' }}>{socketTransport}</Text>
                  </View>
                )}
              </View>
              <View style={{
                flex: 1,
                backgroundColor: socketRetryCount > 3 ? '#fef2f2' : '#f9fafb',
                borderRadius: 10,
                padding: 10,
              }}>
                <Text style={{ fontSize: 10, color: '#6b7280', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
                  Intentos
                </Text>
                <Text style={{ fontSize: 20, fontWeight: '700', color: socketRetryCount > 0 ? '#dc2626' : '#16a34a' }}>
                  {socketRetryCount}
                </Text>
              </View>
              <View style={{
                flex: 1,
                backgroundColor: '#f9fafb',
                borderRadius: 10,
                padding: 10,
              }}>
                <Text style={{ fontSize: 10, color: '#6b7280', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
                  Logs
                </Text>
                <Text style={{ fontSize: 20, fontWeight: '700', color: '#1f2937' }}>
                  {logs.length}
                </Text>
              </View>
            </View>

            {/* Log level filter tabs */}
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 10 }}>
              {(['all', 'error', 'warn', 'log'] as const).map((level) => {
                const isActive = logFilter === level;
                const colors = level === 'error' ? { bg: '#fef2f2', activeBg: '#dc2626', text: '#dc2626', activeText: '#fff', count: logLevelCounts.error }
                  : level === 'warn' ? { bg: '#fffbeb', activeBg: '#d97706', text: '#d97706', activeText: '#fff', count: logLevelCounts.warn }
                  : level === 'log' ? { bg: '#f0fdf4', activeBg: '#16a34a', text: '#16a34a', activeText: '#fff', count: logLevelCounts.log }
                  : { bg: '#f1f5f9', activeBg: '#334155', text: '#475569', activeText: '#fff', count: logLevelCounts.all };
                return (
                  <TouchableOpacity
                    key={level}
                    style={{
                      flex: 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4,
                      backgroundColor: isActive ? colors.activeBg : colors.bg,
                      borderRadius: 8,
                      paddingVertical: 6,
                      paddingHorizontal: 4,
                    }}
                    onPress={() => setLogFilter(level)}
                    activeOpacity={0.7}
                  >
                    <Text style={{
                      fontSize: 12,
                      fontWeight: '700',
                      color: isActive ? colors.activeText : colors.text,
                      textTransform: 'capitalize',
                    }}>
                      {level === 'all' ? 'Todos' : level === 'log' ? 'Log' : level === 'warn' ? 'Warn' : 'Error'}
                    </Text>
                    <View style={{
                      backgroundColor: isActive ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.08)',
                      borderRadius: 6,
                      paddingHorizontal: 5,
                      paddingVertical: 1,
                    }}>
                      <Text style={{
                        fontSize: 10,
                        fontWeight: '600',
                        color: isActive ? colors.activeText : colors.text,
                      }}>
                        {colors.count}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Toolbar: actions */}
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
              <TouchableOpacity
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  backgroundColor: '#f9fafb',
                  borderRadius: 8,
                  paddingVertical: 8,
                  borderWidth: 1,
                  borderColor: '#e5e7eb',
                }}
                onPress={() => {
                  clearLogs();
                  setLogs([]);
                }}
              >
                <Ionicons name="trash-outline" size={16} color="#6b7280" />
                <Text style={{ fontSize: 12, color: '#6b7280', fontWeight: '600' }}>Limpiar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  backgroundColor: '#f9fafb',
                  borderRadius: 8,
                  paddingVertical: 8,
                  borderWidth: 1,
                  borderColor: '#e5e7eb',
                }}
                onPress={handleCopyAllLogs}
              >
                <Ionicons
                  name={isCopied ? 'checkmark-circle' : 'copy-outline'}
                  size={16}
                  color={isCopied ? '#16a34a' : '#6b7280'}
                />
                <Text style={{ fontSize: 12, color: isCopied ? '#16a34a' : '#6b7280', fontWeight: '600' }}>
                  {isCopied ? 'Copiado' : 'Copiar logs'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  backgroundColor: autoScrollEnabled ? '#e0f2fe' : '#f9fafb',
                  borderRadius: 8,
                  paddingVertical: 8,
                  borderWidth: 1,
                  borderColor: autoScrollEnabled ? '#7dd3fc' : '#e5e7eb',
                }}
                onPress={() => setAutoScrollEnabled(!autoScrollEnabled)}
              >
                <Ionicons
                  name={autoScrollEnabled ? 'lock-closed' : 'lock-open'}
                  size={14}
                  color={autoScrollEnabled ? '#0284c7' : '#6b7280'}
                />
                <Text style={{ fontSize: 11, color: autoScrollEnabled ? '#0284c7' : '#6b7280', fontWeight: '600' }}>
                  Auto
                </Text>
              </TouchableOpacity>
            </View>

            {/* Log terminal viewer */}
            <View style={{
              backgroundColor: '#0f172a',
              borderRadius: 12,
              overflow: 'hidden',
              borderWidth: 1,
              borderColor: '#1e293b',
            }}>
              {/* Terminal header bar */}
              <View style={{
                backgroundColor: '#1e293b',
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderBottomWidth: 1,
                borderBottomColor: '#334155',
              }}>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#ef4444' }} />
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#f59e0b' }} />
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#10b981' }} />
                </View>
                <Text style={{
                  flex: 1,
                  textAlign: 'center',
                  fontSize: 10,
                  color: '#64748b',
                  fontWeight: '600',
                  letterSpacing: 1,
                  textTransform: 'uppercase',
                }}>
                  terminal — {filteredLogs.length} líneas
                </Text>
                <Ionicons name="terminal" size={14} color="#64748b" />
              </View>

              {/* Log content */}
              <ScrollView
                ref={logScrollRef}
                style={{
                  maxHeight: 400,
                  padding: 10,
                }}
                nestedScrollEnabled
              >
                {filteredLogs.length === 0 ? (
                  <View style={{ paddingVertical: 30, alignItems: 'center' }}>
                    <Ionicons name="terminal-outline" size={32} color="#334155" />
                    <Text style={{ color: '#475569', fontSize: 12, marginTop: 8, textAlign: 'center' }}>
                      {logs.length === 0
                        ? 'Esperando logs...\nLos logs aparecerán aquí automáticamente'
                        : `No hay logs de nivel "${logFilter}"`}
                    </Text>
                  </View>
                ) : (
                  <View style={{ gap: 1 }}>
                    {filteredLogs.map((entry, index) => {
                      const levelIcon = entry.level === 'error' ? '✕' : entry.level === 'warn' ? '⚠' : ' ';
                      const levelColor = entry.level === 'error' ? '#ef4444'
                        : entry.level === 'warn' ? '#f59e0b'
                        : '#94a3b8';
                      const sourceColors: Record<string, string> = {
                        SOCKET: '#38bdf8',
                        GLOBAL_SOCKET: '#818cf8',
                        AUTH: '#34d399',
                        DRIVER_PROFILE: '#f472b6',
                        PROFILE: '#f472b6',
                        APP: '#a78bfa',
                        DIAG: '#fbbf24',
                        API: '#2dd4bf',
                      };
                      const sourceColor = sourceColors[entry.source] || '#64748b';
                      return (
                        <View
                          key={entry.id}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'flex-start',
                            paddingVertical: 2,
                            paddingHorizontal: 2,
                            borderRadius: 3,
                          }}
                        >
                          {/* Line number */}
                          <Text style={{
                            color: '#334155',
                            fontSize: 9,
                            fontFamily: 'monospace',
                            minWidth: 28,
                            textAlign: 'right',
                            marginRight: 6,
                            lineHeight: 16,
                          }}>
                            {index + 1}
                          </Text>
                          {/* Level indicator */}
                          <Text style={{
                            color: levelColor,
                            fontSize: 10,
                            fontFamily: 'monospace',
                            minWidth: 12,
                            lineHeight: 16,
                          }}>
                            {levelIcon}
                          </Text>
                          {/* Timestamp */}
                          <Text style={{
                            color: '#475569',
                            fontSize: 9,
                            fontFamily: 'monospace',
                            minWidth: 54,
                            marginRight: 4,
                            lineHeight: 16,
                          }}>
                            {entry.timestamp}
                          </Text>
                          {/* Source badge */}
                          <View style={{
                            backgroundColor: sourceColor + '20',
                            borderRadius: 3,
                            paddingHorizontal: 4,
                            paddingVertical: 1,
                            marginRight: 4,
                            marginTop: 1,
                          }}>
                            <Text style={{
                              color: sourceColor,
                              fontSize: 8,
                              fontFamily: 'monospace',
                              fontWeight: '700',
                              letterSpacing: 0.3,
                            }}>
                              {entry.source}
                            </Text>
                          </View>
                          {/* Message */}
                          <Text
                            style={{
                              color: levelColor,
                              fontSize: 10,
                              fontFamily: 'monospace',
                              flex: 1,
                              lineHeight: 16,
                            }}
                            numberOfLines={20}
                          >
                            {entry.message}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                )}
              </ScrollView>
            </View>
          </View>
        )}
      </View>

      <View style={styles.bottomSpacer} />
    </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f0f9ff',
  },
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
  avatarSection: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: Spacing.sm,
  },
  avatarImage: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 3,
    borderColor: Colors.primary,
  },
  avatarPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#f0fdf4',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: Colors.primary,
  },
  avatarBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.white,
  },
  avatarName: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.darkGray,
    marginBottom: 2,
  },
  avatarRole: {
    fontSize: 14,
    color: Colors.mediumGray,
    marginBottom: Spacing.sm,
  },
  changePhotoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  changePhotoText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
  },
  avatarDivider: {
    height: 1,
    backgroundColor: '#f3f4f6',
    marginBottom: Spacing.md,
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
});
