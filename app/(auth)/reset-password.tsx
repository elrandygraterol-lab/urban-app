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
} from 'react-native';
import { useRouter } from 'expo-router';
import { authAPI } from '@/services/api';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Inline validation errors
  const [tokenError, setTokenError] = useState('');
  const [newPasswordError, setNewPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');

  const validateTokenField = (value: string) => {
    setToken(value);
    if (value.trim().length === 0) {
      setTokenError('El token de recuperación es requerido');
    } else {
      setTokenError('');
    }
  };

  const validateNewPasswordField = (value: string) => {
    setNewPassword(value);
    if (value.length === 0) {
      setNewPasswordError('La nueva contraseña es requerida');
    } else if (value.length < 8) {
      setNewPasswordError('La contraseña debe tener al menos 8 caracteres');
    } else if (!/[A-Z]/.test(value)) {
      setNewPasswordError('Debe contener al menos una mayúscula');
    } else if (!/[a-z]/.test(value)) {
      setNewPasswordError('Debe contener al menos una minúscula');
    } else if (!/[0-9]/.test(value)) {
      setNewPasswordError('Debe contener al menos un número');
    } else {
      setNewPasswordError('');
    }

    // Re-validate confirm password if it already has a value
    if (confirmPassword) {
      if (confirmPassword !== value) {
        setConfirmPasswordError('Las contraseñas no coinciden');
      } else {
        setConfirmPasswordError('');
      }
    }
  };

  const validateConfirmPasswordField = (value: string) => {
    setConfirmPassword(value);
    if (value.length === 0) {
      setConfirmPasswordError('Confirma tu nueva contraseña');
    } else if (value !== newPassword) {
      setConfirmPasswordError('Las contraseñas no coinciden');
    } else {
      setConfirmPasswordError('');
    }
  };

  const handleResetPassword = async () => {
    // Trigger validation on all fields
    const trimmedToken = token.trim();
    if (!trimmedToken) {
      setTokenError('El token de recuperación es requerido');
    }

    if (!newPassword) {
      setNewPasswordError('La nueva contraseña es requerida');
    } else if (newPassword.length < 8) {
      setNewPasswordError('La contraseña debe tener al menos 8 caracteres');
    } else if (!/[A-Z]/.test(newPassword)) {
      setNewPasswordError('Debe contener al menos una mayúscula');
    } else if (!/[a-z]/.test(newPassword)) {
      setNewPasswordError('Debe contener al menos una minúscula');
    } else if (!/[0-9]/.test(newPassword)) {
      setNewPasswordError('Debe contener al menos un número');
    }

    if (!confirmPassword) {
      setConfirmPasswordError('Confirma tu nueva contraseña');
    } else if (confirmPassword !== newPassword) {
      setConfirmPasswordError('Las contraseñas no coinciden');
    }

    // Abort if there are errors
    if (
      !trimmedToken ||
      !newPassword ||
      newPassword.length < 8 ||
      !/[A-Z]/.test(newPassword) ||
      !/[a-z]/.test(newPassword) ||
      !/[0-9]/.test(newPassword) ||
      !confirmPassword ||
      confirmPassword !== newPassword
    ) {
      return;
    }

    setIsLoading(true);
    try {
      await authAPI.resetPassword(trimmedToken, newPassword);
      Alert.alert('Éxito', 'Contraseña actualizada', [
        {
          text: 'OK',
          onPress: () => router.replace('/(auth)/login' as any),
        },
      ]);
    } catch (error: any) {
      const errorMessage =
        error?.response?.data?.error?.message ||
        error?.message ||
        'No se pudo restablecer la contraseña. Por favor intenta de nuevo.';
      Alert.alert('Error', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.logo}>UrbanTaxi</Text>
          <Text style={styles.tagline}>¿Listo para tu siguiente destino?</Text>
          <Text style={styles.title}>Restablecer contraseña</Text>
          <Text style={styles.subtitle}>
            Ingresa el token de recuperación que recibiste y tu nueva contraseña
          </Text>
        </View>

        <View style={styles.form}>
          {/* Token field */}
          <TextInput
            style={[styles.input, tokenError ? styles.inputError : null]}
            placeholder="Token de recuperación"
            placeholderTextColor="#A9A9A9"
            value={token}
            onChangeText={validateTokenField}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!isLoading}
          />
          {tokenError ? <Text style={styles.errorText}>{tokenError}</Text> : null}

          {/* New password field */}
          <TextInput
            style={[styles.input, newPasswordError ? styles.inputError : null]}
            placeholder="Nueva contraseña"
            placeholderTextColor="#A9A9A9"
            value={newPassword}
            onChangeText={validateNewPasswordField}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            editable={!isLoading}
          />
          {newPasswordError ? <Text style={styles.errorText}>{newPasswordError}</Text> : null}

          {/* Confirm password field */}
          <TextInput
            style={[styles.input, confirmPasswordError ? styles.inputError : null]}
            placeholder="Confirmar nueva contraseña"
            placeholderTextColor="#A9A9A9"
            value={confirmPassword}
            onChangeText={validateConfirmPasswordField}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            editable={!isLoading}
          />
          {confirmPasswordError ? (
            <Text style={styles.errorText}>{confirmPasswordError}</Text>
          ) : null}

          <TouchableOpacity
            style={[styles.resetButton, isLoading && styles.resetButtonDisabled]}
            onPress={handleResetPassword}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.resetButtonText}>Restablecer contraseña</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.push('/(auth)/login' as any)}
            disabled={isLoading}
          >
            <Text style={styles.backButtonText}>Volver al login</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginTop: 60,
    marginBottom: 40,
  },
  logo: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#22c55e',
    marginBottom: 8,
  },
  tagline: {
    fontSize: 16,
    color: '#505050',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#505050',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 14,
    color: '#A9A9A9',
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 20,
  },
  form: {
    flex: 1,
  },
  input: {
    height: 50,
    borderWidth: 2,
    borderColor: '#22c55e',
    borderRadius: 24,
    paddingHorizontal: 20,
    fontSize: 16,
    marginBottom: 4,
    backgroundColor: '#fff',
    color: '#505050',
  },
  inputError: {
    borderColor: '#ef4444',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 12,
    marginBottom: 16,
    marginLeft: 20,
  },
  resetButton: {
    height: 50,
    backgroundColor: '#22c55e',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  resetButtonDisabled: {
    opacity: 0.6,
  },
  resetButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  backButton: {
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    color: '#22c55e',
    fontSize: 14,
    fontWeight: '600',
  },
});
