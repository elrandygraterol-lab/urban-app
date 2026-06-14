import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { Colors as COLORS, Fonts as FONTS } from '@/constants/theme';
import { useUnifiedNotifications } from '@/context/UnifiedNotificationContext';

export default function DriverRegistrationScreen() {
  const router = useRouter();
  const { register, isLoading } = useAuthStore();
  const { showToast, showStatus } = useUnifiedNotifications();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    name: '',
    phone: '',
    vehicleType: 'taxi' as 'taxi' | 'moto_taxi',
    licensePlate: '',
    vehicleModel: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.email) newErrors.email = 'Email es requerido';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) newErrors.email = 'Email inválido';

    if (!formData.password) newErrors.password = 'Contraseña es requerida';
    else if (formData.password.length < 8)
      newErrors.password = 'Contraseña debe tener al menos 8 caracteres';

    if (formData.password !== formData.confirmPassword)
      newErrors.confirmPassword = 'Las contraseñas no coinciden';

    if (!formData.name) newErrors.name = 'Nombre es requerido';
    if (!formData.phone) newErrors.phone = 'Teléfono es requerido';
    if (!formData.licensePlate) newErrors.licensePlate = 'Placa es requerida';
    if (!formData.vehicleModel) newErrors.vehicleModel = 'Modelo es requerido';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegister = async () => {
    if (!validateForm()) return;

    try {
      // Format phone number with international prefix if not present
      let formattedPhone = formData.phone.trim();
      if (!formattedPhone.startsWith('+')) {
        // Add Venezuela country code (+58) by default
        formattedPhone = `+58${formattedPhone}`;
      }

      await register({
        email: formData.email,
        password: formData.password,
        name: formData.name,
        phone: formattedPhone,
        role: 'driver',
        vehicleType: formData.vehicleType,
        licensePlate: formData.licensePlate,
        vehicleModel: formData.vehicleModel,
      });

      showStatus('success', 'Tu cuenta ha sido creada correctamente. Ahora puedes iniciar sesión.', 'Registro exitoso', undefined, {
        label: 'Ir a Login',
        onPress: () => router.replace('/(auth)/login'),
      });
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Registro fallido', 'error');
    }
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.title}>Registro de Conductor</Text>
        <Text style={styles.subtitle}>Completa tu información personal y del vehículo</Text>
      </View>

      {/* Personal Information Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Información Personal</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Nombre Completo</Text>
          <TextInput
            style={[styles.input, errors.name && styles.inputError]}
            placeholder="Tu nombre"
            value={formData.name}
            onChangeText={text => {
              setFormData({ ...formData, name: text });
              if (errors.name) setErrors({ ...errors, name: '' });
            }}
            editable={!isLoading}
          />
          {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={[styles.input, errors.email && styles.inputError]}
            placeholder="tu@email.com"
            value={formData.email}
            onChangeText={text => {
              setFormData({ ...formData, email: text });
              if (errors.email) setErrors({ ...errors, email: '' });
            }}
            keyboardType="email-address"
            editable={!isLoading}
          />
          {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Teléfono</Text>
          <TextInput
            style={[styles.input, errors.phone && styles.inputError]}
            placeholder="Teléfono (ej: 4121234567)"
            value={formData.phone}
            onChangeText={text => {
              setFormData({ ...formData, phone: text });
              if (errors.phone) setErrors({ ...errors, phone: '' });
            }}
            keyboardType="phone-pad"
            editable={!isLoading}
          />
          {errors.phone && <Text style={styles.errorText}>{errors.phone}</Text>}
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Contraseña</Text>
          <TextInput
            style={[styles.input, errors.password && styles.inputError]}
            placeholder="Mínimo 8 caracteres"
            value={formData.password}
            onChangeText={text => {
              setFormData({ ...formData, password: text });
              if (errors.password) setErrors({ ...errors, password: '' });
            }}
            secureTextEntry
            editable={!isLoading}
          />
          {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Confirmar Contraseña</Text>
          <TextInput
            style={[styles.input, errors.confirmPassword && styles.inputError]}
            placeholder="Repite tu contraseña"
            value={formData.confirmPassword}
            onChangeText={text => {
              setFormData({ ...formData, confirmPassword: text });
              if (errors.confirmPassword) setErrors({ ...errors, confirmPassword: '' });
            }}
            secureTextEntry
            editable={!isLoading}
          />
          {errors.confirmPassword && <Text style={styles.errorText}>{errors.confirmPassword}</Text>}
        </View>
      </View>

      {/* Vehicle Information Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Información del Vehículo</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Tipo de Vehículo</Text>
          <View style={styles.vehicleTypeContainer}>
            {(['taxi', 'moto_taxi'] as const).map(type => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.vehicleTypeButton,
                  formData.vehicleType === type && styles.vehicleTypeButtonActive,
                ]}
                onPress={() => setFormData({ ...formData, vehicleType: type })}
                disabled={isLoading}
              >
                <Text
                  style={[
                    styles.vehicleTypeText,
                    formData.vehicleType === type && styles.vehicleTypeTextActive,
                  ]}
                >
                  {type === 'taxi' ? 'Taxi' : 'Moto-taxi'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Placa del Vehículo</Text>
          <TextInput
            style={[styles.input, errors.licensePlate && styles.inputError]}
            placeholder="ABC-1234"
            value={formData.licensePlate}
            onChangeText={text => {
              setFormData({ ...formData, licensePlate: text.toUpperCase() });
              if (errors.licensePlate) setErrors({ ...errors, licensePlate: '' });
            }}
            editable={!isLoading}
          />
          {errors.licensePlate && <Text style={styles.errorText}>{errors.licensePlate}</Text>}
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Modelo del Vehículo</Text>
          <TextInput
            style={[styles.input, errors.vehicleModel && styles.inputError]}
            placeholder="Toyota Corolla 2020"
            value={formData.vehicleModel}
            onChangeText={text => {
              setFormData({ ...formData, vehicleModel: text });
              if (errors.vehicleModel) setErrors({ ...errors, vehicleModel: '' });
            }}
            editable={!isLoading}
          />
          {errors.vehicleModel && <Text style={styles.errorText}>{errors.vehicleModel}</Text>}
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.registerButton, isLoading && styles.buttonDisabled]}
          onPress={handleRegister}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.registerButtonText}>Continuar con Documentos</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.back()} disabled={isLoading}>
          <Text style={styles.backLink}>Volver</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  header: {
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.darkGray,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.lightGray,
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.darkGray,
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.darkGray,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: COLORS.darkGray,
    backgroundColor: '#fff',
  },
  inputError: {
    borderColor: '#FF6B6B',
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: 12,
    marginTop: 4,
  },
  vehicleTypeContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  vehicleTypeButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    borderRadius: 24,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  vehicleTypeButtonActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  vehicleTypeText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.lightGray,
  },
  vehicleTypeTextActive: {
    color: COLORS.primary,
  },
  buttonContainer: {
    marginBottom: 40,
    gap: 12,
  },
  registerButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 24,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  registerButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  backLink: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    paddingVertical: 12,
  },
});
