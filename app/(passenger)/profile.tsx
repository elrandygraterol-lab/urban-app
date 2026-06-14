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
  StatusBar,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
// import { useCopilot, walkthroughable, CopilotStep } from 'react-native-copilot';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../constants/theme';
import { useAuthStore } from '../../store/authStore';
import { useLanguage } from '../../hooks/useLanguage';
import { translations } from '../../i18n/translations';
import { userAPI, notificationAPI } from '../../services/api';
import * as ImagePicker from 'expo-image-picker';
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
  const { user, logout } = useAuthStore();
  const { language, setLanguage } = useLanguage();
  const t = translations[language].profile;
  // const { start: startTour } = useCopilot();
  const { isActive: needsTutorial } = useSmartTutorial('passenger_profile');

  useEffect(() => {
    if (needsTutorial) {
      setActiveTutorialScreen('passenger_profile');
      // setTimeout(() => { startTour(); }, 800);
    }
  }, [needsTutorial]);

  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // User data
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [email, setEmail] = useState(user?.email || '');

  // Notification preferences
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPreferences>({
    driverArrival: true,
    rideUpdates: true,
    tripReminders: true,
    promotions: true,
  });

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      setIsLoading(true);

      // Load user info
      const userResponse = await userAPI.getMe();

      // Defensive programming: validate response structure
      // API returns: {success: true, data: {user data}}
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
    // First confirmation
    Alert.alert(t.deleteConfirmTitle, t.deleteConfirmMessage, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.deleteConfirmButton,
        style: 'destructive',
        onPress: () => {
          // Second confirmation
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
        <StatusBar barStyle="dark-content" backgroundColor="#f0f9ff" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#f0f9ff" />
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
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
                <Image source={{ uri: resolveFileUrl(user?.profilePhotoUrl) }} style={styles.avatarImage} resizeMode="cover" />
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
            <Text style={styles.avatarRole}>Pasajero</Text>
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
                <Ionicons name="car-sport" size={22} color={Colors.primary} />
              </View>
              <Text style={styles.settingLabel}>Llegada del conductor</Text>
            </View>
            <Switch
              value={notificationPrefs.driverArrival}
              onValueChange={value => handleUpdateNotificationPref('driverArrival', value)}
              trackColor={{ false: Colors.lightGray, true: Colors.light }}
              thumbColor={notificationPrefs.driverArrival ? Colors.primary : Colors.white}
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <View style={styles.iconContainer}>
                <Ionicons name="notifications" size={22} color={Colors.primary} />
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
                <Ionicons name="time" size={22} color={Colors.primary} />
              </View>
              <Text style={styles.settingLabel}>Recordatorios de viaje</Text>
            </View>
            <Switch
              value={notificationPrefs.tripReminders}
              onValueChange={value => handleUpdateNotificationPref('tripReminders', value)}
              trackColor={{ false: Colors.lightGray, true: Colors.light }}
              thumbColor={notificationPrefs.tripReminders ? Colors.primary : Colors.white}
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
    color: Colors.mediumGray || '#9ca3af',
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
  bottomSpacer: {
    height: Spacing.xxl,
  },
});
