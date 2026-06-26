import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  ActivityIndicator,
  StatusBar,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing } from '../../constants/theme';
import { useAuthStore } from '../../store/authStore';
import { useLanguage } from '../../hooks/useLanguage';
import { translations } from '../../i18n/translations';
import { userAPI, notificationAPI, passengerAPI } from '../../services/api';
import * as ImagePicker from 'expo-image-picker';
import { useUnifiedNotifications } from '@/context/UnifiedNotificationContext';
import { useSmartTutorial } from '@/hooks/useSmartTutorial';
import { setActiveTutorialScreen } from '@/utils/tutorialState';
import { resolveFileUrl } from '@/services/fileUrl';

// const WalkthroughView = walkthroughable(View);

interface NotificationPreferences {
  driverArrival?: boolean;
  rideUpdates?: boolean;
  tripReminders?: boolean;
  promotions?: boolean;
}

export default function PassengerProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuthStore();
  const { language, setLanguage } = useLanguage();
  const t = translations[language].profile;
  const { isActive: needsTutorial } = useSmartTutorial('passenger_profile');
  const { showToast, showStatus, showActionSheet } = useUnifiedNotifications();

  useEffect(() => {
    if (needsTutorial) {
      setActiveTutorialScreen('passenger_profile');
    }
  }, [needsTutorial]);

  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [email, setEmail] = useState(user?.email || '');

  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPreferences>({
    driverArrival: true,
    rideUpdates: true,
    tripReminders: true,
    promotions: true,
  });

  const [paymentInfo, setPaymentInfo] = useState({
    pagoMovilPhone: '',
    pagoMovilBank: '',
    pagoMovilCedula: '',
    bankTransferBank: '',
    bankTransferAccount: '',
    bankTransferAccountType: 'Corriente',
  });
  const [isPaymentSectionExpanded, setIsPaymentSectionExpanded] = useState(false);
  const [isSavingPayment, setIsSavingPayment] = useState(false);

  useEffect(() => {
    const loadUserData = async () => {
      try {
        setIsLoading(true);
        const userResponse = await userAPI.getMe();

        if (!userResponse || !userResponse.data || !userResponse.data.data) {
          console.warn('User API returned invalid response:', userResponse);
          showToast(t.loadError, 'error');
          return;
        }

        const userData = userResponse.data.data;

        if (user) {
          useAuthStore.getState().setUser({
            ...user,
            name: userData.name || user.name,
            phone: userData.phone || user.phone,
            email: userData.email || user.email,
            profilePhotoUrl: user.profilePhotoUrl || userData.profilePhotoUrl,
          });
        }

        setName(userData.name || '');
        setPhone(userData.phone || '');
        setEmail(userData.email || '');

        try {
          const prefsResponse = await notificationAPI.getPreferences();
          if (prefsResponse.data && prefsResponse.data.preferences) {
            setNotificationPrefs(prefsResponse.data.preferences);
          }
        } catch {
          console.log('No notification preferences found, using defaults');
        }

        try {
          const payResponse = await passengerAPI.getPaymentInfo();
          if (payResponse.data?.data) {
            setPaymentInfo(payResponse.data.data);
          }
        } catch {
          console.log('No payment info found for passenger');
        }
      } catch (error) {
        console.error('Error loading user data:', error);
        showToast(t.loadError, 'error');
      } finally {
        setIsLoading(false);
      }
    };

    loadUserData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const handleSavePaymentInfo = async () => {
    try {
      const hasPagoMovil =
        paymentInfo.pagoMovilPhone && paymentInfo.pagoMovilBank && paymentInfo.pagoMovilCedula;
      const hasBankTransfer = paymentInfo.bankTransferBank && paymentInfo.bankTransferAccount;

      if (!hasPagoMovil && !hasBankTransfer) {
        showToast(
          'Debes configurar al menos un método de pago completo',
          'error'
        );
        return;
      }

      setIsSavingPayment(true);
      await passengerAPI.updatePaymentInfo(paymentInfo);
      showToast('Información de pago actualizada exitosamente', 'success');
      setIsPaymentSectionExpanded(false);
    } catch (error: any) {
      const errorMessage =
        error?.response?.data?.error?.message || 'Error al actualizar información de pago';
      showToast(errorMessage, 'error');
    } finally {
      setIsSavingPayment(false);
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
    showStatus('info', t.logoutConfirmMessage, t.logoutConfirmTitle, undefined, {
      label: t.logoutConfirmButton,
      onPress: async () => {
        await logout();
        router.replace('/(auth)/login');
      },
    });
  };

  const handleDeleteAccount = () => {
    showStatus('info', t.deleteConfirmMessage, t.deleteConfirmTitle, undefined, {
      label: t.deleteConfirmButton,
      onPress: () => {
        showStatus('info', t.deleteSecondConfirmMessage, t.deleteSecondConfirmTitle, undefined, {
          label: t.deleteSecondConfirmButton,
          onPress: async () => {
            try {
              await userAPI.deleteAccount();
              await logout();
              showToast(t.deleteSuccess, 'success');
              router.replace('/(auth)/login');
            } catch (error) {
              console.error('Error deleting account:', error);
              showToast(t.deleteError, 'error');
            }
          },
        });
      },
    });
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
      const result = await userAPI.uploadPhoto(uri);
      const profilePhotoUrl = result.profilePhotoUrl || result.data?.profilePhotoUrl;
      // Update local user state
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
      <View style={[styles.safeArea, { paddingTop: insets.top }]}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.contentContainer, { paddingBottom: 16 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
          <Text style={styles.headerTitle}>Perfil</Text>
          {!isEditing && (
            <TouchableOpacity onPress={() => setIsEditing(true)} style={styles.headerEditBtn}>
              <Ionicons name="pencil-outline" size={18} color="#fff" />
              <Text style={styles.headerEditText}>{t.edit}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Avatar Card */}
        <View style={styles.avatarCard}>
          <TouchableOpacity onPress={handleChangePhoto} style={styles.avatarWrapper}>
            {resolveFileUrl(user?.profilePhotoUrl) ? (
              <Image
                source={{ uri: `${resolveFileUrl(user?.profilePhotoUrl)}?t=${Date.now()}` }}
                style={styles.avatarImage}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="person" size={36} color={Colors.primary} />
              </View>
            )}
            <View style={styles.cameraBadge}>
              <Ionicons name="camera" size={13} color="#fff" />
            </View>
          </TouchableOpacity>
          <Text style={styles.avatarName}>{user?.name || ''}</Text>
          <Text style={styles.avatarRole}>Pasajero</Text>
        </View>

        {/* Personal Information */}
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>{t.personalInfo}</Text>

          <View style={styles.card}>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>{t.name}</Text>
              <TextInput
                style={[styles.fieldInput, !isEditing && styles.fieldInputDisabled]}
                value={name}
                onChangeText={setName}
                editable={isEditing}
                placeholder={t.name}
                placeholderTextColor="#94a3b8"
              />
            </View>

            <View style={styles.fieldDivider} />

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>{t.email}</Text>
              <TextInput
                style={[styles.fieldInput, styles.fieldInputDisabled]}
                value={email}
                editable={false}
                placeholder={t.email}
                placeholderTextColor="#94a3b8"
              />
            </View>

            <View style={styles.fieldDivider} />

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>{t.phone}</Text>
              <TextInput
                style={[styles.fieldInput, !isEditing && styles.fieldInputDisabled]}
                value={phone}
                onChangeText={setPhone}
                editable={isEditing}
                placeholder={t.phone}
                placeholderTextColor="#94a3b8"
                keyboardType="phone-pad"
              />
            </View>

            {isEditing && (
              <View style={styles.editActions}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => {
                    setIsEditing(false);
                    setName(user?.name || '');
                    setPhone(user?.phone || '');
                  }}
                >
                  <Text style={styles.cancelBtnText}>{t.cancel}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.saveBtn}
                  onPress={handleSaveProfile}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.saveBtnText}>{t.save}</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        {/* Settings */}
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>{t.settings}</Text>

          <View style={styles.card}>
            <View style={styles.rowItem}>
              <View style={styles.rowLeft}>
                <View style={styles.iconBox}>
                  <Ionicons name="language-outline" size={20} color={Colors.primary} />
                </View>
                <Text style={styles.rowLabel}>{t.language}</Text>
              </View>
              <View style={styles.langGroup}>
                <TouchableOpacity
                  style={[styles.langBtn, language === 'es' && styles.langBtnActive]}
                  onPress={() => handleLanguageChange('es')}
                >
                  <Text style={[styles.langBtnText, language === 'es' && styles.langBtnTextActive]}>
                    {t.spanish}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.langBtn, language === 'en' && styles.langBtnActive]}
                  onPress={() => handleLanguageChange('en')}
                >
                  <Text style={[styles.langBtnText, language === 'en' && styles.langBtnTextActive]}>
                    {t.english}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        {/* Payment Methods */}
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>MÉTODOS DE PAGO</Text>

          <View style={styles.card}>
            <TouchableOpacity
              style={styles.rowItem}
              onPress={() => setIsPaymentSectionExpanded(!isPaymentSectionExpanded)}
              activeOpacity={0.7}
            >
              <View style={styles.rowLeft}>
                <View style={styles.iconBox}>
                  <Ionicons name="wallet-outline" size={20} color={Colors.primary} />
                </View>
                <Text style={styles.rowLabel}>Pago Móvil y Transferencia</Text>
              </View>
              <Ionicons
                name={isPaymentSectionExpanded ? 'chevron-up' : 'chevron-down'}
                size={20}
                color="#9ca3af"
              />
            </TouchableOpacity>

            {isPaymentSectionExpanded && (
              <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
                {/* Pago Móvil */}
                <View style={{ marginBottom: 16 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Ionicons name="phone-portrait-outline" size={18} color={Colors.primary} />
                      <Text style={{ fontSize: 15, fontWeight: '600', color: '#1f2937' }}>Pago Móvil</Text>
                    </View>
                    {paymentInfo.pagoMovilPhone && paymentInfo.pagoMovilBank && paymentInfo.pagoMovilCedula && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#f0fdf4', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                        <Ionicons name="checkmark-circle" size={12} color={Colors.primary} />
                        <Text style={{ fontSize: 11, color: Colors.primary, fontWeight: '600' }}>Listo</Text>
                      </View>
                    )}
                  </View>
                  <TextInput
                    style={{ borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, marginBottom: 8, color: '#1f2937' }}
                    value={paymentInfo.pagoMovilCedula}
                    onChangeText={text => setPaymentInfo({ ...paymentInfo, pagoMovilCedula: text })}
                    placeholder="Cédula — V-12345678"
                    placeholderTextColor="#9ca3af"
                  />
                  <TextInput
                    style={{ borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, marginBottom: 8, color: '#1f2937' }}
                    value={paymentInfo.pagoMovilPhone}
                    onChangeText={text => setPaymentInfo({ ...paymentInfo, pagoMovilPhone: text })}
                    placeholder="Teléfono — 0414-1234567"
                    placeholderTextColor="#9ca3af"
                    keyboardType="phone-pad"
                  />
                  <TextInput
                    style={{ borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#1f2937' }}
                    value={paymentInfo.pagoMovilBank}
                    onChangeText={text => setPaymentInfo({ ...paymentInfo, pagoMovilBank: text })}
                    placeholder="Banco — Ej: Venezuela"
                    placeholderTextColor="#9ca3af"
                  />
                </View>

                <View style={{ height: 1, backgroundColor: '#f3f4f6', marginBottom: 16 }} />

                {/* Transferencia */}
                <View style={{ marginBottom: 16 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Ionicons name="business-outline" size={18} color={Colors.primary} />
                      <Text style={{ fontSize: 15, fontWeight: '600', color: '#1f2937' }}>Transferencia</Text>
                    </View>
                    {paymentInfo.bankTransferAccount && paymentInfo.bankTransferBank && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#f0fdf4', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                        <Ionicons name="checkmark-circle" size={12} color={Colors.primary} />
                        <Text style={{ fontSize: 11, color: Colors.primary, fontWeight: '600' }}>Listo</Text>
                      </View>
                    )}
                  </View>
                  <TextInput
                    style={{ borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, marginBottom: 8, color: '#1f2937' }}
                    value={paymentInfo.bankTransferBank}
                    onChangeText={text => setPaymentInfo({ ...paymentInfo, bankTransferBank: text })}
                    placeholder="Banco"
                    placeholderTextColor="#9ca3af"
                  />
                  <TextInput
                    style={{ borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, marginBottom: 8, color: '#1f2937' }}
                    value={paymentInfo.bankTransferAccount}
                    onChangeText={text => setPaymentInfo({ ...paymentInfo, bankTransferAccount: text })}
                    placeholder="N° de Cuenta — 0102-1234-5678"
                    placeholderTextColor="#9ca3af"
                    keyboardType="number-pad"
                  />
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity
                      style={{ flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: paymentInfo.bankTransferAccountType === 'Corriente' ? Colors.primary : '#e5e7eb', backgroundColor: paymentInfo.bankTransferAccountType === 'Corriente' ? '#f0fdf4' : '#fff' }}
                      onPress={() => setPaymentInfo({ ...paymentInfo, bankTransferAccountType: 'Corriente' })}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '600', color: paymentInfo.bankTransferAccountType === 'Corriente' ? Colors.primary : '#6b7280' }}>Corriente</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={{ flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: paymentInfo.bankTransferAccountType === 'Ahorro' ? Colors.primary : '#e5e7eb', backgroundColor: paymentInfo.bankTransferAccountType === 'Ahorro' ? '#f0fdf4' : '#fff' }}
                      onPress={() => setPaymentInfo({ ...paymentInfo, bankTransferAccountType: 'Ahorro' })}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '600', color: paymentInfo.bankTransferAccountType === 'Ahorro' ? Colors.primary : '#6b7280' }}>Ahorro</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12, backgroundColor: '#f9fafb', padding: 10, borderRadius: 8 }}>
                  <Ionicons name="information-circle-outline" size={14} color="#6b7280" />
                  <Text style={{ fontSize: 12, color: '#6b7280', flex: 1 }}>Configura al menos un método para recibir reembolsos por cancelaciones.</Text>
                </View>

                <TouchableOpacity
                  style={{ backgroundColor: Colors.primary, paddingVertical: 13, borderRadius: 12, alignItems: 'center' }}
                  onPress={handleSavePaymentInfo}
                  disabled={isSavingPayment}
                >
                  {isSavingPayment ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>Guardar Métodos de Pago</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        {/* Notifications */}
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>{t.notifications}</Text>

          <View style={styles.card}>
            <SwitchRow
              icon="car-sport-outline"
              label="Llegada del conductor"
              value={notificationPrefs.driverArrival}
              onToggle={(v) => handleUpdateNotificationPref('driverArrival', v)}
            />
            <View style={styles.switchDivider} />
            <SwitchRow
              icon="notifications-outline"
              label="Actualizaciones de viaje"
              value={notificationPrefs.rideUpdates}
              onToggle={(v) => handleUpdateNotificationPref('rideUpdates', v)}
            />
            <View style={styles.switchDivider} />
            <SwitchRow
              icon="time-outline"
              label="Recordatorios de viaje"
              value={notificationPrefs.tripReminders}
              onToggle={(v) => handleUpdateNotificationPref('tripReminders', v)}
            />
            <View style={styles.switchDivider} />
            <SwitchRow
              icon="megaphone-outline"
              label="Promociones"
              value={notificationPrefs.promotions}
              onToggle={(v) => handleUpdateNotificationPref('promotions', v)}
            />
          </View>
        </View>

        {/* Account */}
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>{t.account}</Text>

          <View style={styles.card}>
            <TouchableOpacity
              style={styles.rowItem}
              onPress={() => router.push('/(auth)/terms-of-service' as any)}
            >
              <View style={styles.rowLeft}>
                <View style={styles.iconBox}>
                  <Ionicons name="document-text-outline" size={20} color={Colors.primary} />
                </View>
                <Text style={styles.rowLabel}>Términos de Servicio</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
            </TouchableOpacity>

            <View style={styles.actionDivider} />

            <TouchableOpacity
              style={styles.rowItem}
              onPress={() => router.push('/(auth)/privacy-policy' as any)}
            >
              <View style={styles.rowLeft}>
                <View style={styles.iconBox}>
                  <Ionicons name="shield-checkmark-outline" size={20} color={Colors.primary} />
                </View>
                <Text style={styles.rowLabel}>Política de Privacidad</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
            </TouchableOpacity>

            <View style={styles.actionDivider} />

            <TouchableOpacity style={styles.rowItem} onPress={handleLogout}>
              <View style={styles.rowLeft}>
                <View style={styles.iconBox}>
                  <Ionicons name="log-out-outline" size={20} color={Colors.primary} />
                </View>
                <Text style={styles.rowLabel}>{t.logout}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
            </TouchableOpacity>

            <View style={styles.actionDivider} />

            <TouchableOpacity style={styles.rowItem} onPress={handleDeleteAccount}>
              <View style={styles.rowLeft}>
                <View style={[styles.iconBox, { backgroundColor: '#fef2f2' }]}>
                  <Ionicons name="trash-outline" size={20} color={Colors.error} />
                </View>
                <Text style={[styles.rowLabel, { color: Colors.error }]}>{t.deleteAccount}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function SwitchRow({
  icon,
  label,
  value,
  onToggle,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: boolean;
  onToggle: (v: boolean) => void;
}) {
  return (
    <View style={styles.switchRow}>
      <View style={styles.switchLeft}>
        <View style={styles.iconBox}>
          <Ionicons name={icon} size={20} color={Colors.primary} />
        </View>
        <Text style={styles.switchLabel}>{label}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: '#e2e8f0', true: '#bbf7d0' }}
        thumbColor={value ? Colors.primary : '#fff'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scroll: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  contentContainer: {
    paddingHorizontal: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },

  /* Header */
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 20,
    paddingHorizontal: 4,
    backgroundColor: '#f8fafc',
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0f172a',
  },
  headerEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 100,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  headerEditText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },

  /* Avatar Card */
  avatarCard: {
    alignItems: 'center',
    paddingVertical: 24,
    marginBottom: 24,
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 12,
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: '#e2e8f0',
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#f0fdf4',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#e2e8f0',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#f8fafc',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  avatarName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 2,
  },
  avatarRole: {
    fontSize: 14,
    color: '#94a3b8',
    fontWeight: '500',
  },

  /* Section */
  sectionBlock: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
    marginLeft: 4,
  },

  /* Card */
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },

  /* Fields */
  fieldGroup: {
    paddingVertical: 14,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  fieldInput: {
    height: 46,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 16,
    color: '#0f172a',
    backgroundColor: '#fff',
  },
  fieldInputDisabled: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    color: '#94a3b8',
  },
  fieldDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
  },

  /* Edit Actions */
  editActions: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 16,
    paddingBottom: 8,
  },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
  },
  cancelBtnText: {
    color: '#64748b',
    fontSize: 15,
    fontWeight: '600',
  },
  saveBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },

  /* Row (shared by settings, notifications, account) */
  rowItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#f0fdf4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowLabel: {
    fontSize: 15,
    color: '#1e293b',
    fontWeight: '500',
    flex: 1,
  },

  /* Language */
  langGroup: {
    flexDirection: 'row',
    gap: 6,
  },
  langBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
  },
  langBtnActive: {
    borderColor: Colors.primary,
    backgroundColor: '#f0fdf4',
  },
  langBtnText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
  },
  langBtnTextActive: {
    color: Colors.primary,
  },

  /* Switch Row */
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
  },
  switchLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  switchLabel: {
    fontSize: 15,
    color: '#1e293b',
    fontWeight: '500',
    flex: 1,
  },
  switchDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
  },

  /* Action Divider */
  actionDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
  },
});
