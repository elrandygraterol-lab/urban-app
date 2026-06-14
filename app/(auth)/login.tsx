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
        <ActivityIndicator size="large" color="#22c55e" />
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
          {/* Illustration Background */}
          <View style={styles.illustrationContainer}>
            <View style={styles.illustrationBg}>
              {/* Mountains/Hills */}
              <View style={styles.mountain1} />
              <View style={styles.mountain2} />
              <View style={styles.mountain3} />
              {/* Clouds */}
              <View style={styles.cloud1} />
              <View style={styles.cloud2} />
              <View style={styles.cloud3} />
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

          {/* White Card Container */}
          <View style={styles.cardContainer}>
            {/* Welcome Badge */}
            <View style={styles.welcomeBadge}>
              <Text style={styles.welcomeText}>
                <Text style={styles.welcomeBold}>Bienvenido </Text>
                <Text style={styles.welcomeNormal}>de vuelta</Text>
              </Text>
              <View style={styles.decorativeCircles}>
                <View style={styles.decorCircle} />
                <View style={styles.decorCircle} />
                <View style={styles.decorCircle} />
              </View>
            </View>

            {/* Form Container */}
            <View style={styles.formContainer}>
              {/* Email Input */}
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  placeholder="Ingresa tu email o teléfono"
                  placeholderTextColor="#9ca3af"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isLoading}
                />
              </View>

              {/* Password Input */}
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  placeholder="Ingresa tu contraseña"
                  placeholderTextColor="#9ca3af"
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
                    size={22}
                    color="#9ca3af"
                  />
                </TouchableOpacity>
              </View>

              {/* Remember Me & Forgot Password */}
              <View style={styles.optionsRow}>
                <TouchableOpacity
                  style={styles.rememberRow}
                  onPress={() => setRememberMe(!rememberMe)}
                  disabled={isLoading}
                >
                  <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                    {rememberMe && <View style={styles.checkboxInner} />}
                  </View>
                  <Text style={styles.rememberText}>Recuérdame</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => router.push('/(auth)/forgot-password' as any)}
                  disabled={isLoading}
                >
                  <Text style={styles.forgotText}>¿Olvidaste tu Contraseña?</Text>
                </TouchableOpacity>
              </View>

              {/* Login Button */}
              <TouchableOpacity
                style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
                onPress={handleLogin}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.loginButtonText}>Empezar a viajar</Text>
                )}
              </TouchableOpacity>

              {/* Register Link */}
              <View style={styles.registerRow}>
                <Text style={styles.registerText}>¿Aún no tienes una cuenta? </Text>
                <TouchableOpacity
                  onPress={() => router.push('/(auth)/register' as any)}
                  disabled={isLoading}
                >
                  <Text style={styles.registerLink}>Regístrate aquí.</Text>
                </TouchableOpacity>
              </View>

              {/* Divider */}
              <Text style={styles.dividerText}>o</Text>

              {/* Social Buttons */}
              <TouchableOpacity style={styles.socialButton} disabled={isLoading}>
                <Ionicons name="logo-google" size={22} color="#4285f4" />
                <Text style={styles.socialButtonText}>Continuar con Google</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.socialButton} disabled={isLoading}>
                <Ionicons name="logo-apple" size={22} color="#000" />
                <Text style={styles.socialButtonText}>Continuar con Apple</Text>
              </TouchableOpacity>
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
    backgroundColor: '#f0f4f0',
  },
  scrollContent: {
    flexGrow: 1,
  },
  illustrationContainer: {
    height: 300,
    position: 'relative',
    overflow: 'hidden',
  },
  illustrationBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#d4e8d4',
  },
  // Mountains/Hills
  mountain1: {
    position: 'absolute',
    bottom: 0,
    left: -20,
    width: 200,
    height: 220,
    backgroundColor: '#a8d5a8',
    borderTopLeftRadius: 120,
    borderTopRightRadius: 120,
    transform: [{ scaleX: 1.3 }],
  },
  mountain2: {
    position: 'absolute',
    bottom: 0,
    left: '25%',
    width: 180,
    height: 200,
    backgroundColor: '#8bc88b',
    borderTopLeftRadius: 100,
    borderTopRightRadius: 100,
    transform: [{ scaleX: 1.4 }],
  },
  mountain3: {
    position: 'absolute',
    bottom: 0,
    right: -30,
    width: 160,
    height: 180,
    backgroundColor: '#9ed09e',
    borderTopLeftRadius: 90,
    borderTopRightRadius: 90,
    transform: [{ scaleX: 1.5 }],
  },
  // Clouds
  cloud1: {
    position: 'absolute',
    top: 30,
    right: 20,
    width: 100,
    height: 35,
    backgroundColor: '#f5e6d3',
    borderRadius: 20,
    opacity: 0.8,
  },
  cloud2: {
    position: 'absolute',
    top: 70,
    left: 30,
    width: 80,
    height: 28,
    backgroundColor: '#f5e6d3',
    borderRadius: 15,
    opacity: 0.7,
  },
  cloud3: {
    position: 'absolute',
    top: 50,
    left: '45%',
    width: 90,
    height: 32,
    backgroundColor: '#f5e6d3',
    borderRadius: 18,
    opacity: 0.75,
  },
  logoContainer: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  logoImage: {
    width: 280,
    height: 80,
    marginBottom: 4,
  },
  tagline: {
    fontSize: 15,
    color: '#fff',
    fontStyle: 'italic',
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  cardContainer: {
    flex: 1,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -40,
    paddingTop: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 8,
  },
  welcomeBadge: {
    backgroundColor: '#22c55e',
    marginHorizontal: 40,
    marginTop: -28,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
    zIndex: 20,
  },
  welcomeText: {
    fontSize: 18,
  },
  welcomeBold: {
    color: '#fff',
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  welcomeNormal: {
    color: '#1f2937',
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  decorativeCircles: {
    flexDirection: 'row',
    gap: 6,
  },
  decorCircle: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#fbbf24',
  },
  formContainer: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 40,
    paddingBottom: 32,
  },
  inputWrapper: {
    marginBottom: 18,
    position: 'relative',
  },
  input: {
    height: 56,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingRight: 50,
    fontSize: 15,
    color: '#1f2937',
    backgroundColor: '#fafafa',
  },
  eyeIcon: {
    position: 'absolute',
    right: 18,
    top: 16,
  },
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 4,
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 1.5,
    borderColor: '#d1d5db',
    borderRadius: 5,
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    borderColor: '#22c55e',
    backgroundColor: '#22c55e',
  },
  checkboxInner: {
    width: 10,
    height: 10,
    borderRadius: 2,
    backgroundColor: '#fff',
  },
  rememberText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  forgotText: {
    fontSize: 14,
    color: '#22c55e',
    fontWeight: '600',
  },
  loginButton: {
    height: 56,
    backgroundColor: '#22c55e',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 10,
  },
  loginButtonDisabled: {
    opacity: 0.5,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  registerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 24,
  },
  registerText: {
    fontSize: 14,
    color: '#6b7280',
  },
  registerLink: {
    fontSize: 14,
    color: '#22c55e',
    fontWeight: '700',
  },
  dividerText: {
    textAlign: 'center',
    fontSize: 14,
    color: '#9ca3af',
    marginBottom: 20,
  },
  socialButton: {
    height: 56,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  socialButtonText: {
    fontSize: 15,
    color: '#374151',
    fontWeight: '600',
  },
});
