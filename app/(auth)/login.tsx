import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  Keyboard,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { useUnifiedNotifications } from '@/context/UnifiedNotificationContext';
import { SafeAreaView } from 'react-native-safe-area-context';

const REMEMBER_EMAIL_KEY = 'remember_email';
const REMEMBER_PASSWORD_KEY = 'remember_password';
const REMEMBER_ME_KEY = 'remember_me';

export default function LoginScreen() {
  const router = useRouter();
  const { login, isLoading } = useAuthStore();
  const { showToast, showStatus } = useUnifiedNotifications();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoadingCredentials, setIsLoadingCredentials] = useState(true);

  // Load saved credentials on mount
  useEffect(() => {
    loadSavedCredentials();
  }, []);

  const loadSavedCredentials = async () => {
    try {
      const savedRememberMe = await SecureStore.getItemAsync(REMEMBER_ME_KEY);

      if (savedRememberMe === 'true') {
        const savedEmail = await SecureStore.getItemAsync(REMEMBER_EMAIL_KEY);
        const savedPassword = await SecureStore.getItemAsync(REMEMBER_PASSWORD_KEY);

        if (savedEmail) setEmail(savedEmail);
        if (savedPassword) setPassword(savedPassword);
        setRememberMe(true);
      }
    } catch (error) {
      console.error('[LOGIN] Error loading saved credentials:', error);
    } finally {
      setIsLoadingCredentials(false);
    }
  };

  const saveCredentials = async () => {
    try {
      if (rememberMe) {
        await SecureStore.setItemAsync(REMEMBER_EMAIL_KEY, email.trim());
        await SecureStore.setItemAsync(REMEMBER_PASSWORD_KEY, password);
        await SecureStore.setItemAsync(REMEMBER_ME_KEY, 'true');
      } else {
        await SecureStore.deleteItemAsync(REMEMBER_EMAIL_KEY);
        await SecureStore.deleteItemAsync(REMEMBER_PASSWORD_KEY);
        await SecureStore.deleteItemAsync(REMEMBER_ME_KEY);
      }
    } catch (error) {
      console.error('[LOGIN] Error saving credentials:', error);
    }
  };

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^\+?[\d\s-()]+$/;
    return emailRegex.test(email) || phoneRegex.test(email);
  };

  const handleLogin = async () => {
    Keyboard.dismiss();
    if (!email.trim() || !password.trim()) {
      showToast('Por favor ingresa tu email/teléfono y contraseña', 'error');
      return;
    }

    if (!validateEmail(email.trim())) {
      showToast('Por favor ingresa un email o teléfono válido', 'error');
      return;
    }

    if (password.length < 8) {
      showToast('La contraseña debe tener al menos 8 caracteres', 'error');
      return;
    }

    try {
      // Save credentials if remember me is checked
      await saveCredentials();

      // No pasamos rol - el backend detecta automáticamente el rol del usuario
      await login(email.trim(), password);
    } catch (error: any) {
      const rawMessage: string = error?.response?.data?.error?.message || error?.message || '';

      // Driver pending admin approval — show friendly message, no technical details
      const isPendingApproval =
        rawMessage.toLowerCase().includes('pending') ||
        rawMessage.toLowerCase().includes('not approved') ||
        rawMessage.toLowerCase().includes('pendiente') ||
        rawMessage.toLowerCase().includes('aprobado') ||
        rawMessage.toLowerCase().includes('verificacion') ||
        rawMessage.toLowerCase().includes('verificación') ||
        rawMessage.toLowerCase().includes('under review') ||
        rawMessage.toLowerCase().includes('awaiting');

      if (isPendingApproval) {
        showStatus(
          'warning',
          'Tu cuenta de conductor aún no ha sido aprobada por un administrador. Por favor espera a que sea revisada y aprobada antes de iniciar sesión.',
          'Cuenta en revisión'
        );
        return;
      }

      // Invalid credentials
      if (
        rawMessage.toLowerCase().includes('invalid') ||
        rawMessage.toLowerCase().includes('incorrect') ||
        rawMessage.toLowerCase().includes('inválid') ||
        rawMessage.toLowerCase().includes('incorrecta') ||
        rawMessage.toLowerCase().includes('wrong') ||
        rawMessage.toLowerCase().includes('not found') ||
        rawMessage.toLowerCase().includes('no encontrado')
      ) {
        showToast('El email/teléfono o la contraseña son incorrectos.', 'error');
        return;
      }

      // Generic fallback — never show raw technical errors
      showToast(
        'No se pudo iniciar sesión. Verifica tu conexión a internet e intenta de nuevo.',
        'error'
      );
    }
  };

  // Show loading indicator while loading saved credentials
  if (isLoadingCredentials) {
    return (
      <SafeAreaView
        style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}
        edges={['top', 'bottom']}
      >
        <ActivityIndicator size="large" color="#2FB908" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* --- ILLUSTRATION --- */}
          <View style={styles.illustrationContainer}>
            <View style={styles.illustrationBg}>

              {/* Sun */}
              <View style={styles.sunGlow} />
              <View style={styles.sun} />

              {/* Clouds */}
              <View style={styles.cloudGroup1}>
                <View style={[styles.cloudCircle, { width: 60, height: 60, left: 0 }]} />
                <View style={[styles.cloudCircle, { width: 80, height: 50, left: 40, top: 10 }]} />
                <View style={[styles.cloudCircle, { width: 50, height: 50, left: 95, top: 5 }]} />
              </View>
              <View style={styles.cloudGroup2}>
                <View style={[styles.cloudCircle, { width: 50, height: 50, left: 0 }]} />
                <View style={[styles.cloudCircle, { width: 70, height: 40, left: 35, top: 8 }]} />
                <View style={[styles.cloudCircle, { width: 40, height: 40, left: 80, top: 3 }]} />
              </View>

              {/* Mountains */}
              <View style={styles.mountainBase} />
              <View style={styles.mountain1} />
              <View style={styles.mountain2} />
              <View style={styles.mountain3} />

              <View style={styles.foregroundHill} />
            </View>

            {/* Logo */}
            <View style={styles.logoContainer}>
              <Image
                source={require('@/assets/images/logo.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
              <Text style={styles.tagline}>¿Listo para tu siguiente destino?</Text>
            </View>
          </View>

          {/* --- CARD --- */}
          <View style={styles.cardContainer}>

            {/* Form */}
            <View style={styles.formContainer}>
              {/* Welcome header */}
              <View style={styles.formHeader}>
                <View style={styles.formTitleAccent} />
                <Text style={styles.formTitle}>Bienvenido de vuelta</Text>
                <Text style={styles.formSubtitle}>Inicia sesión para acceder a tu cuenta</Text>
              </View>
              {/* Email */}
              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>Email o teléfono</Text>
                <View style={styles.inputBox}>
                  <Ionicons name="mail-outline" size={18} color="#94a3b8" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="ejemplo@correo.com"
                    placeholderTextColor="#cbd5e1"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!isLoading}
                  />
                </View>
              </View>

              {/* Password */}
              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>Contraseña</Text>
                <View style={styles.inputBox}>
                  <Ionicons name="lock-closed-outline" size={18} color="#94a3b8" style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, { paddingRight: 46 }]}
                    placeholder="Ingresa tu contraseña"
                    placeholderTextColor="#cbd5e1"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!isLoading}
                  />
                  <TouchableOpacity
                    style={styles.eyeIcon}
                    onPress={() => setShowPassword(!showPassword)}
                    disabled={isLoading}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                      size={20}
                      color="#94a3b8"
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Remember & Forgot */}
              <View style={styles.optionsRow}>
                <TouchableOpacity
                  style={styles.rememberRow}
                  onPress={() => setRememberMe(!rememberMe)}
                  disabled={isLoading}
                >
                  <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                    {rememberMe && <Ionicons name="checkmark" size={14} color="#fff" />}
                  </View>
                  <Text style={styles.rememberText}>Recuérdame</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => router.push('/(auth)/forgot-password' as any)}
                  disabled={isLoading}
                >
                  <Text style={styles.forgotText}>¿Olvidaste tu contraseña?</Text>
                </TouchableOpacity>
              </View>

              {/* Login Button */}
              <TouchableOpacity
                style={[styles.primaryBtn, isLoading && styles.primaryBtnDisabled]}
                onPress={handleLogin}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryBtnText}>Iniciar sesión</Text>
                )}
              </TouchableOpacity>

              {/* Register Link */}
              <View style={styles.linkRow}>
                <Text style={styles.linkRowText}>¿Aún no tienes una cuenta? </Text>
                <TouchableOpacity
                  onPress={() => router.push('/(auth)/register' as any)}
                  disabled={isLoading}
                >
                  <Text style={styles.linkRowAction}>Regístrate</Text>
                </TouchableOpacity>
              </View>


            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7f5',
  },
  scrollContent: {
    flexGrow: 1,
  },

  /* --- ILLUSTRATION --- */
  illustrationContainer: {
    height: 260,
    position: 'relative',
    overflow: 'hidden',
  },
  illustrationBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#f2f6f2',
  },

  /* Sun */
  sunGlow: {
    position: 'absolute',
    top: 40,
    right: 50,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,235,59,0.15)',
  },
  sun: {
    position: 'absolute',
    top: 55,
    right: 65,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#fff9c4',
    shadowColor: '#fdd835',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 8,
  },

  /* Clouds */
  cloudGroup1: {
    position: 'absolute',
    top: 30,
    left: 16,
    width: 150,
    height: 55,
  },
  cloudGroup2: {
    position: 'absolute',
    top: 60,
    right: 20,
    width: 130,
    height: 50,
  },
  cloudCircle: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 100,
  },

  /* Mountains */
  mountainBase: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
    backgroundColor: '#d4e2d4',
    borderTopLeftRadius: 180,
    borderTopRightRadius: 180,
  },
  mountain1: {
    position: 'absolute',
    bottom: 0,
    left: -30,
    width: 200,
    height: 160,
    backgroundColor: '#c0d6c0',
    borderTopLeftRadius: 120,
    borderTopRightRadius: 120,
    transform: [{ scaleX: 1.2 }],
  },
  mountain2: {
    position: 'absolute',
    bottom: 0,
    left: '20%',
    width: 180,
    height: 195,
    backgroundColor: '#a8c8a8',
    borderTopLeftRadius: 100,
    borderTopRightRadius: 100,
    transform: [{ scaleX: 1.3 }],
  },
  mountain3: {
    position: 'absolute',
    bottom: 0,
    right: -10,
    width: 160,
    height: 145,
    backgroundColor: '#90ba90',
    borderTopLeftRadius: 90,
    borderTopRightRadius: 90,
    transform: [{ scaleX: 1.4 }],
  },
  foregroundHill: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 40,
    backgroundColor: '#78ac78',
    borderTopLeftRadius: 200,
    borderTopRightRadius: 200,
    opacity: 0.3,
  },

  /* Logo */
  logoContainer: {
    position: 'absolute',
    top: 12,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  logoImage: {
    width: 220,
    height: 64,
    marginBottom: 2,
  },
  tagline: {
    fontSize: 13,
    color: '#fff',
    fontStyle: 'italic',
    backgroundColor: 'rgba(0,0,0,0.2)',
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
  },

  /* --- CARD --- */
  cardContainer: {
    flex: 1,
    backgroundColor: '#fff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    marginTop: -24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 10,
  },

  /* Form header */
  formHeader: {
    marginBottom: 28,
  },
  formTitleAccent: {
    width: 40,
    height: 4,
    backgroundColor: '#2FB908',
    borderRadius: 2,
    marginBottom: 16,
  },
  formTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  formSubtitle: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
  },
  /* Form */
  formContainer: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 32,
  },
  inputWrapper: {
    marginBottom: 18,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 6,
    marginLeft: 2,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 14,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 15,
    color: '#0f172a',
  },
  eyeIcon: {
    padding: 6,
  },

  /* Options */
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 2,
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderRadius: 6,
    marginRight: 9,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  checkboxChecked: {
    borderColor: '#2FB908',
    backgroundColor: '#2FB908',
  },
  rememberText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  forgotText: {
    fontSize: 14,
    color: '#2FB908',
    fontWeight: '600',
  },
  /* Primary Button */
  primaryBtn: {
    height: 48,
    backgroundColor: '#2FB908',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    shadowColor: '#2FB908',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  primaryBtnDisabled: {
    opacity: 0.5,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  /* Link Row */
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 22,
  },
  linkRowText: {
    fontSize: 14,
    color: '#64748b',
  },
  linkRowAction: {
    fontSize: 14,
    color: '#2FB908',
    fontWeight: '700',
  },

  /* Divider */
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e2e8f0',
  },
  dividerText: {
    marginHorizontal: 14,
    fontSize: 13,
    color: '#94a3b8',
    fontWeight: '500',
  },

  /* Social */

});
