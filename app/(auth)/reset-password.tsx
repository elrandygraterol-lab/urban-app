import { useState } from 'react';
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
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { authAPI } from '@/services/api';
import { useUnifiedNotifications } from '@/context/UnifiedNotificationContext';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const { showToast, showStatus } = useUnifiedNotifications();
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [codeError, setCodeError] = useState('');
  const [newPasswordError, setNewPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');

  const handleResetPassword = async () => {
    const email = params.email?.trim();
    const trimmedCode = code.trim();

    let hasError = false;

    if (!trimmedCode || trimmedCode.length !== 6) {
      setCodeError('Ingresa el código de 6 dígitos');
      hasError = true;
    } else {
      setCodeError('');
    }

    if (!newPassword) {
      setNewPasswordError('La nueva contraseña es requerida');
      hasError = true;
    } else if (newPassword.length < 8) {
      setNewPasswordError('La contraseña debe tener al menos 8 caracteres');
      hasError = true;
    } else if (!/[A-Z]/.test(newPassword)) {
      setNewPasswordError('Debe contener al menos una mayúscula');
      hasError = true;
    } else if (!/[a-z]/.test(newPassword)) {
      setNewPasswordError('Debe contener al menos una minúscula');
      hasError = true;
    } else if (!/[0-9]/.test(newPassword)) {
      setNewPasswordError('Debe contener al menos un número');
      hasError = true;
    } else {
      setNewPasswordError('');
    }

    if (!confirmPassword) {
      setConfirmPasswordError('Confirma tu nueva contraseña');
      hasError = true;
    } else if (confirmPassword !== newPassword) {
      setConfirmPasswordError('Las contraseñas no coinciden');
      hasError = true;
    } else {
      setConfirmPasswordError('');
    }

    if (hasError) return;

    if (!email) {
      showToast('Email no encontrado. Por favor solicita un nuevo código.', 'error');
      return;
    }

    setIsLoading(true);
    try {
      await authAPI.resetPassword(trimmedCode, email, newPassword);
      showStatus(
        'success',
        'Tu contraseña ha sido actualizada correctamente.',
        'Contraseña actualizada',
        undefined,
        { label: 'Ir a Login', onPress: () => router.replace('/(auth)/login' as any) }
      );
    } catch (error: any) {
      const errorMessage =
        error?.response?.data?.error?.message ||
        error?.message ||
        'No se pudo restablecer la contraseña. Por favor intenta de nuevo.';
      showToast(errorMessage, 'error');
    } finally {
      setIsLoading(false);
    }
  };

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
          {/* Illustration */}
          <View style={styles.illustrationContainer}>
            <View style={styles.illustrationBg}>
              <View style={styles.sunGlow} />
              <View style={styles.sun} />
              <View style={styles.cloudGroup1}>
                <View style={[styles.cloudCircle, { width: 60, height: 60, left: 0 }]} />
                <View style={[styles.cloudCircle, { width: 80, height: 50, left: 40, top: 10 }]} />
                <View style={[styles.cloudCircle, { width: 50, height: 50, left: 95, top: 5 }]} />
              </View>

              <View style={styles.mountainBase} />
              <View style={styles.mountain1} />
              <View style={styles.mountain2} />
              <View style={styles.mountain3} />

              <View style={styles.foregroundHill} />
            </View>
            <View style={styles.logoContainer}>
              <Image
                source={require('@/assets/images/logo.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
              <Text style={styles.tagline}>¿Listo para tu siguiente destino?</Text>
            </View>
          </View>

          {/* Card */}
          <View style={styles.cardContainer}>
            <View style={styles.formContainer}>
              {/* Header */}
              <View style={styles.formHeader}>
                <Text style={styles.formTitle}>Restablecer contraseña</Text>
                <Text style={styles.formSubtitle}>
                  Ingresa el código de 6 dígitos que enviamos a tu email y tu nueva contraseña
                </Text>
              </View>

              {/* Email (read-only) */}
              {params.email ? (
                <View style={styles.inputWrapper}>
                  <Text style={styles.inputLabel}>Email</Text>
                  <View style={[styles.inputBox, styles.inputBoxDisabled]}>
                    <Ionicons name="mail-outline" size={18} color="#94a3b8" style={styles.inputIcon} />
                    <Text style={styles.inputDisabledText}>{params.email}</Text>
                  </View>
                </View>
              ) : null}

              {/* Verification code */}
              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>Código de verificación</Text>
                <View style={styles.inputBox}>
                  <Ionicons name="key-outline" size={18} color="#94a3b8" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="000000"
                    placeholderTextColor="#cbd5e1"
                    value={code}
                    onChangeText={(v) => { setCode(v); setCodeError(''); }}
                    keyboardType="number-pad"
                    maxLength={6}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!isLoading}
                  />
                </View>
                {codeError ? <Text style={styles.fieldError}>{codeError}</Text> : null}
              </View>

              {/* New password */}
              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>Nueva contraseña</Text>
                <View style={styles.inputBox}>
                  <Ionicons name="lock-closed-outline" size={18} color="#94a3b8" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Mínimo 8 caracteres"
                    placeholderTextColor="#cbd5e1"
                    value={newPassword}
                    onChangeText={(v) => { setNewPassword(v); setNewPasswordError(''); }}
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!isLoading}
                  />
                </View>
                {newPasswordError ? <Text style={styles.fieldError}>{newPasswordError}</Text> : null}
              </View>

              {/* Confirm password */}
              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>Confirmar contraseña</Text>
                <View style={styles.inputBox}>
                  <Ionicons name="lock-closed-outline" size={18} color="#94a3b8" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Repite tu contraseña"
                    placeholderTextColor="#cbd5e1"
                    value={confirmPassword}
                    onChangeText={(v) => { setConfirmPassword(v); setConfirmPasswordError(''); }}
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!isLoading}
                  />
                </View>
                {confirmPasswordError ? (
                  <Text style={styles.fieldError}>{confirmPasswordError}</Text>
                ) : null}
              </View>

              <TouchableOpacity
                style={[styles.primaryBtn, isLoading && styles.primaryBtnDisabled]}
                onPress={handleResetPassword}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryBtnText}>Restablecer contraseña</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.linkBtn}
                onPress={() => router.push('/(auth)/login' as any)}
                disabled={isLoading}
              >
                <Ionicons name="arrow-back-outline" size={16} color="#22c55e" />
                <Text style={styles.linkBtnText}>Volver al inicio de sesión</Text>
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
    backgroundColor: '#e8f5e9',
  },
  scrollContent: {
    flexGrow: 1,
  },

  /* Illustration */
  illustrationContainer: {
    height: 220,
    position: 'relative',
    overflow: 'hidden',
  },
  illustrationBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#dcedc8',
  },
  sunGlow: {
    position: 'absolute',
    top: 20,
    right: 40,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,235,59,0.15)',
  },
  sun: {
    position: 'absolute',
    top: 30,
    right: 52,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fff9c4',
    shadowColor: '#fdd835',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 14,
    elevation: 4,
  },
  cloudGroup1: {
    position: 'absolute',
    top: 20,
    left: 16,
    width: 140,
    height: 50,
  },
  cloudCircle: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 100,
  },
  mountainBase: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
    backgroundColor: '#81c784',
    borderTopLeftRadius: 140,
    borderTopRightRadius: 140,
  },
  mountain1: {
    position: 'absolute',
    bottom: 0,
    left: -20,
    width: 160,
    height: 130,
    backgroundColor: '#66bb6a',
    borderTopLeftRadius: 100,
    borderTopRightRadius: 100,
    transform: [{ scaleX: 1.2 }],
  },
  mountain2: {
    position: 'absolute',
    bottom: 0,
    left: '18%',
    width: 150,
    height: 160,
    backgroundColor: '#4caf50',
    borderTopLeftRadius: 90,
    borderTopRightRadius: 90,
    transform: [{ scaleX: 1.3 }],
  },
  mountain3: {
    position: 'absolute',
    bottom: 0,
    right: -10,
    width: 130,
    height: 120,
    backgroundColor: '#43a047',
    borderTopLeftRadius: 80,
    borderTopRightRadius: 80,
    transform: [{ scaleX: 1.4 }],
  },
  foregroundHill: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 30,
    backgroundColor: '#2e7d32',
    borderTopLeftRadius: 160,
    borderTopRightRadius: 160,
    opacity: 0.4,
  },
  logoContainer: {
    position: 'absolute',
    top: 6,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  logoImage: {
    width: 200,
    height: 58,
    marginBottom: 2,
  },
  tagline: {
    fontSize: 12,
    color: '#fff',
    fontStyle: 'italic',
    backgroundColor: 'rgba(0,0,0,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 3,
    borderRadius: 10,
    overflow: 'hidden',
  },

  /* Card */
  cardContainer: {
    flex: 1,
    backgroundColor: '#fff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    marginTop: -18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 10,
  },
  formHeader: {
    marginBottom: 20,
  },
  formTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4,
  },
  formSubtitle: {
    fontSize: 14,
    color: '#64748b',
  },

  /* Form */
  formContainer: {
    paddingHorizontal: 24,
    paddingTop: 28,
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
  inputBoxDisabled: {
    backgroundColor: '#e2e8f0',
  },
  inputDisabledText: {
    flex: 1,
    fontSize: 15,
    color: '#64748b',
  },
  fieldError: {
    color: '#ef4444',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 2,
  },

  /* Primary btn */
  primaryBtn: {
    height: 54,
    backgroundColor: '#22c55e',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 18,
    shadowColor: '#22c55e',
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

  /* Link btn */
  linkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  linkBtnText: {
    color: '#22c55e',
    fontSize: 14,
    fontWeight: '600',
  },
});
