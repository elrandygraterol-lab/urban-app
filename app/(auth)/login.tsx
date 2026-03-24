import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ImageBackground,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { Ionicons } from '@expo/vector-icons';

type UserRole = 'passenger' | 'driver';

export default function LoginScreen() {
  const router = useRouter();
  const { login, isLoading } = useAuthStore();
  const [role, setRole] = useState<UserRole>('passenger');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^\+?[\d\s-()]+$/;
    return emailRegex.test(email) || phoneRegex.test(email);
  };

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Por favor ingresa tu email/teléfono y contraseña');
      return;
    }

    if (!validateEmail(email.trim())) {
      Alert.alert('Error', 'Por favor ingresa un email o teléfono válido');
      return;
    }

    if (password.length < 8) {
      Alert.alert('Error', 'La contraseña debe tener al menos 8 caracteres');
      return;
    }

    try {
      await login(email.trim(), password, role);
    } catch (error: any) {
      const errorMessage = error?.response?.data?.error?.message || 
                          error?.message || 
                          'Credenciales inválidas. Por favor intenta de nuevo.';
      Alert.alert('Error de autenticación', errorMessage);
    }
  };

  return (
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
            {/* Simple illustration with shapes */}
            <View style={styles.mountain1} />
            <View style={styles.mountain2} />
            <View style={styles.cloud1} />
            <View style={styles.cloud2} />
          </View>
          
          {/* Logo */}
          <View style={styles.logoContainer}>
            <Text style={styles.logoText}>
              <Text style={styles.logoUrban}>Urban</Text>
              <Text style={styles.logoTaxi}>Taxi</Text>
            </Text>
            <Text style={styles.tagline}>¿Listo para tu siguiente destino?</Text>
          </View>
        </View>

        {/* Welcome Badge */}
        <View style={styles.welcomeBadge}>
          <Text style={styles.welcomeText}>Bienvenido de vuelta</Text>
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
                size={20} 
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
              <Text style={styles.registerLink}>Regístrate aquí</Text>
            </TouchableOpacity>
          </View>

          {/* Divider */}
          <Text style={styles.dividerText}>o</Text>

          {/* Social Buttons */}
          <TouchableOpacity 
            style={styles.socialButton}
            disabled={isLoading}
          >
            <Ionicons name="logo-google" size={20} color="#4285f4" />
            <Text style={styles.socialButtonText}>Continuar con Google</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.socialButton}
            disabled={isLoading}
          >
            <Ionicons name="logo-apple" size={20} color="#000" />
            <Text style={styles.socialButtonText}>Continuar con Apple</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
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
    height: 320,
    position: 'relative',
    overflow: 'hidden',
  },
  illustrationBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#e8f5e9',
  },
  mountain1: {
    position: 'absolute',
    bottom: 0,
    left: '10%',
    width: 180,
    height: 200,
    backgroundColor: '#a5d6a7',
    borderTopLeftRadius: 100,
    borderTopRightRadius: 100,
    transform: [{ scaleX: 1.5 }],
  },
  mountain2: {
    position: 'absolute',
    bottom: 0,
    right: '5%',
    width: 150,
    height: 160,
    backgroundColor: '#81c784',
    borderTopLeftRadius: 80,
    borderTopRightRadius: 80,
    transform: [{ scaleX: 1.3 }],
  },
  cloud1: {
    position: 'absolute',
    top: 40,
    right: 30,
    width: 80,
    height: 30,
    backgroundColor: '#fff',
    borderRadius: 15,
    opacity: 0.7,
  },
  cloud2: {
    position: 'absolute',
    top: 80,
    left: 40,
    width: 60,
    height: 25,
    backgroundColor: '#fff',
    borderRadius: 12,
    opacity: 0.6,
  },
  logoContainer: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  logoText: {
    fontSize: 48,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  logoUrban: {
    color: '#fff',
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
  },
  logoTaxi: {
    color: '#ff9800',
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
  },
  tagline: {
    fontSize: 16,
    color: '#fff',
    fontStyle: 'italic',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  welcomeBadge: {
    backgroundColor: '#22c55e',
    marginHorizontal: 40,
    marginTop: -30,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 20,
  },
  welcomeText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  decorativeCircles: {
    flexDirection: 'row',
    gap: 4,
  },
  decorCircle: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ff9800',
  },
  formContainer: {
    flex: 1,
    backgroundColor: '#fff',
    marginTop: 24,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 32,
    paddingTop: 40,
    paddingBottom: 32,
  },
  inputWrapper: {
    marginBottom: 16,
    position: 'relative',
  },
  input: {
    height: 56,
    borderWidth: 2,
    borderColor: '#22c55e',
    borderRadius: 28,
    paddingHorizontal: 24,
    fontSize: 16,
    color: '#1f2937',
    backgroundColor: '#fff',
  },
  eyeIcon: {
    position: 'absolute',
    right: 20,
    top: 18,
  },
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderRadius: 10,
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    borderColor: '#22c55e',
    backgroundColor: '#fff',
  },
  checkboxInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#22c55e',
  },
  rememberText: {
    fontSize: 14,
    color: '#6b7280',
  },
  forgotText: {
    fontSize: 14,
    color: '#22c55e',
    fontWeight: '600',
  },
  loginButton: {
    height: 56,
    backgroundColor: '#22c55e',
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
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
    fontWeight: '600',
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
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 28,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  socialButtonText: {
    fontSize: 16,
    color: '#1f2937',
    fontWeight: '600',
  },
});
