import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useUnifiedNotifications } from '@/context/UnifiedNotificationContext';
import { SafeAreaView } from 'react-native-safe-area-context';

type UserRole = 'passenger' | 'driver' | 'owner';
type VehicleType = 'taxi' | 'moto_taxi';

interface DocumentFile {
  uri: string;
  name: string;
  type: string;
  size: number;
}

export default function RegisterScreen() {
  const router = useRouter();
  const { register, isLoading } = useAuthStore();
  const { showToast, showStatus } = useUnifiedNotifications();

  // Common fields
  const [role, setRole] = useState<UserRole>('passenger');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Validation errors
  const [nameError, setNameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  const [licensePlateError, setLicensePlateError] = useState('');
  const [vehicleModelError, setVehicleModelError] = useState('');

  // Driver-specific fields
  const [vehicleType, setVehicleType] = useState<VehicleType>('taxi');
  const [licensePlate, setLicensePlate] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');

  // Profile photo (optional for both roles)
  const [profilePhoto, setProfilePhoto] = useState<DocumentFile | null>(null);

  // Driver documents (required for drivers)
  const [driverLicense, setDriverLicense] = useState<DocumentFile | null>(null);
  const [medicalCertificate, setMedicalCertificate] = useState<DocumentFile | null>(null);

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePhone = (phone: string): boolean => {
    const phoneRegex = /^\+?[\d\s-()]{10,}$/;
    return phoneRegex.test(phone);
  };

  // Real-time validation functions
  const validateNameField = (value: string) => {
    setName(value);
    if (value.trim().length === 0) {
      setNameError('El nombre es requerido');
    } else if (value.trim().length < 3) {
      setNameError('El nombre debe tener al menos 3 caracteres');
    } else {
      setNameError('');
    }
  };

  const validateEmailField = (value: string) => {
    setEmail(value);
    if (value.trim().length === 0) {
      setEmailError('El email es requerido');
    } else if (!validateEmail(value.trim())) {
      setEmailError('Ingresa un email válido (ejemplo@correo.com)');
    } else {
      setEmailError('');
    }
  };

  const validatePhoneField = (value: string) => {
    setPhone(value);
    if (value.trim().length === 0) {
      setPhoneError('El teléfono es requerido');
    } else if (!validatePhone(value.trim())) {
      setPhoneError('Ingresa un teléfono válido (mínimo 10 dígitos)');
    } else {
      setPhoneError('');
    }
  };

  const validatePasswordField = (value: string) => {
    setPassword(value);
    if (value.length === 0) {
      setPasswordError('La contraseña es requerida');
    } else if (value.length < 8) {
      setPasswordError('La contraseña debe tener al menos 8 caracteres');
    } else if (!/[A-Z]/.test(value)) {
      setPasswordError('Debe contener al menos una mayúscula');
    } else if (!/[a-z]/.test(value)) {
      setPasswordError('Debe contener al menos una minúscula');
    } else if (!/[0-9]/.test(value)) {
      setPasswordError('Debe contener al menos un número');
    } else {
      setPasswordError('');
    }
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
      setConfirmPasswordError('Confirma tu contraseña');
    } else if (value !== password) {
      setConfirmPasswordError('Las contraseñas no coinciden');
    } else {
      setConfirmPasswordError('');
    }
  };

  const validateLicensePlateField = (value: string) => {
    setLicensePlate(value);
    if (!value.trim()) {
      setLicensePlateError('La placa es requerida');
    } else if (value.trim().length < 3) {
      setLicensePlateError('Ingresa una placa válida');
    } else {
      setLicensePlateError('');
    }
  };

  const validateVehicleModelField = (value: string) => {
    setVehicleModel(value);
    if (!value.trim()) {
      setVehicleModelError('El modelo del vehículo es requerido');
    } else if (value.trim().length < 2) {
      setVehicleModelError('Ingresa un modelo válido');
    } else {
      setVehicleModelError('');
    }
  };

  // Profile photo picker
  const handlePickProfilePhoto = async () => {
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
            quality: 0.8,
          });
          if (!result.canceled && result.assets?.[0]) {
            const asset = result.assets[0];
            setProfilePhoto({
              uri: asset.uri,
              name: 'profile_photo.jpg',
              type: 'image/jpeg',
              size: asset.fileSize || 0,
            });
          }
        },
      },
      {
        text: 'Elegir de galería',
        onPress: async () => {
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            quality: 0.8,
          });
          if (!result.canceled && result.assets?.[0]) {
            const asset = result.assets[0];
            setProfilePhoto({
              uri: asset.uri,
              name: 'profile_photo.jpg',
              type: 'image/jpeg',
              size: asset.fileSize || 0,
            });
          }
        },
      },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  // Document picker
  const handlePickDocument = async (setter: (file: DocumentFile) => void) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso requerido', 'Necesitamos permiso para acceder a tus archivos');
      return;
    }
    Alert.alert('Seleccionar documento', 'Elige una opción', [
      {
        text: 'Tomar foto',
        onPress: async () => {
          const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            quality: 0.8,
          });
          if (!result.canceled && result.assets?.[0]) {
            const asset = result.assets[0];
            setter({
              uri: asset.uri,
              name: 'document.jpg',
              type: 'image/jpeg',
              size: asset.fileSize || 0,
            });
          }
        },
      },
      {
        text: 'Elegir de galería',
        onPress: async () => {
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            quality: 0.8,
          });
          if (!result.canceled && result.assets?.[0]) {
            const asset = result.assets[0];
            setter({
              uri: asset.uri,
              name: 'document.jpg',
              type: 'image/jpeg',
              size: asset.fileSize || 0,
            });
          }
        },
      },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  const handleRegister = async () => {
    if (nameError || emailError || phoneError || passwordError || confirmPasswordError) {
      showToast('Por favor corrige los errores antes de continuar', 'error');
      return;
    }

    if (!name.trim()) {
      showToast('Por favor ingresa tu nombre completo', 'error');
      return;
    }
    if (!validateEmail(email.trim())) {
      showToast('Por favor ingresa un email válido', 'error');
      return;
    }
    if (!validatePhone(phone.trim())) {
      showToast('Por favor ingresa un teléfono válido (mínimo 10 dígitos)', 'error');
      return;
    }
    if (!password) {
      showToast('Por favor ingresa una contraseña', 'error');
      return;
    }
    if (password.length < 8) {
      showToast('La contraseña debe tener al menos 8 caracteres', 'error');
      return;
    }
    if (password !== confirmPassword) {
      showToast('Las contraseñas no coinciden', 'error');
      return;
    }

    if (role === 'driver') {
      if (!licensePlate.trim()) {
        showToast('Por favor ingresa la placa del vehículo', 'error');
        return;
      }
      if (!vehicleModel.trim()) {
        showToast('Por favor ingresa el modelo del vehículo', 'error');
        return;
      }
      if (!driverLicense) {
        showToast('Por favor adjunta tu licencia de conducir', 'error');
        return;
      }
      if (!medicalCertificate) {
        showToast('Por favor adjunta tu certificado médico', 'error');
        return;
      }
    }

    try {
      let formattedPhone = phone.trim();
      // Convertir números venezolanos al formato internacional
      if (formattedPhone.startsWith('0')) {
        formattedPhone = '+58' + formattedPhone.substring(1);
      } else if (!formattedPhone.startsWith('+')) {
        formattedPhone = '+' + formattedPhone;
      }

      if (role === 'passenger') {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            'Permiso de ubicación requerido',
            'La app necesita acceso a tu ubicación para calcular rutas y mostrar conductores cercanos.',
            [
              { text: 'Abrir Configuración', onPress: () => Linking.openSettings() },
              { text: 'Continuar de todas formas', style: 'cancel' },
            ]
          );
        }
      }

      await register({
        email: email.trim(),
        phone: formattedPhone,
        password,
        name: name.trim(),
        role: role as any,
        profilePhoto,
        ...(role === 'driver' && {
          vehicleType,
          licensePlate: licensePlate.trim(),
          vehicleModel: vehicleModel.trim(),
          driverLicense,
          medicalCertificate,
        }),
      });

      showStatus(
        'success',
        'Tu cuenta ha sido creada correctamente. Ahora puedes iniciar sesión.',
        'Registro exitoso',
        undefined,
        { label: 'Ir a Login', onPress: () => router.replace('/(auth)/login' as any) }
      );
    } catch (error: any) {
      console.error('[REGISTER_SCREEN] Registration error:', error);
      const msg = error?.response?.data?.error?.message || error?.message || '';
      const lower = msg.toLowerCase();

      if (lower.includes('phone number') || lower.includes('teléfono') || lower.includes('telefono')) {
        showToast('Este número de teléfono ya está registrado', 'error');
      } else if (lower.includes('email') || lower.includes('correo')) {
        showToast('Este correo electrónico ya está registrado', 'error');
      } else if (lower.includes('duplicate') || lower.includes('unique') || lower.includes('exist')) {
        showToast('Este usuario ya existe', 'error');
      } else if (lower.includes('validation') || lower.includes('validación') || lower.includes('invalido') || lower.includes('inválido')) {
        showToast('Verifica que todos los campos estén completos y sean correctos', 'error');
      } else {
        showToast('No se pudo completar el registro. Intenta de nuevo.', 'error');
      }
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f0f9ff' }} edges={['top', 'bottom']}>
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <Text style={{ fontSize: 24, fontWeight: '800', color: '#111827', marginBottom: 6 }}>
          Crear Cuenta
        </Text>
        <Text style={{ fontSize: 14, color: '#6b7280', marginBottom: 24 }}>
          Completa el formulario para registrarte
        </Text>

        {/* Role Selector */}
        <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 }}>
          Tipo de cuenta
        </Text>
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
          {(['passenger', 'driver'] as UserRole[]).map((r) => (
            <TouchableOpacity
              key={r}
              onPress={() => setRole(r)}
              style={{
                flex: 1,
                paddingVertical: 12,
                borderRadius: 12,
                borderWidth: 2,
                alignItems: 'center',
                backgroundColor: role === r ? '#f0fdf4' : '#fff',
                borderColor: role === r ? '#22c55e' : '#e5e7eb',
              }}
            >
              <Ionicons
                name={r === 'passenger' ? 'person' : 'car'}
                size={20}
                color={role === r ? '#22c55e' : '#9ca3af'}
              />
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '600',
                  color: role === r ? '#22c55e' : '#9ca3af',
                  marginTop: 4,
                }}
              >
                {r === 'passenger' ? 'Pasajero' : 'Conductor'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Name */}
        <Text style={styles.label}>Nombre completo</Text>
        <TextInput
          style={[styles.input, nameError ? styles.inputError : null]}
          value={name}
          onChangeText={validateNameField}
          placeholder="Ej: Juan Pérez"
          placeholderTextColor="#9ca3af"
        />
        {nameError ? <Text style={styles.errorText}>{nameError}</Text> : null}

        {/* Email */}
        <Text style={styles.label}>Email</Text>
        <TextInput
          style={[styles.input, emailError ? styles.inputError : null]}
          value={email}
          onChangeText={validateEmailField}
          placeholder="ejemplo@correo.com"
          placeholderTextColor="#9ca3af"
          keyboardType="email-address"
          autoCapitalize="none"
        />
        {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}

        {/* Phone */}
        <Text style={styles.label}>Teléfono</Text>
        <TextInput
          style={[styles.input, phoneError ? styles.inputError : null]}
          value={phone}
          onChangeText={validatePhoneField}
          placeholder="04121234567"
          placeholderTextColor="#9ca3af"
          keyboardType="phone-pad"
        />
        {phoneError ? <Text style={styles.errorText}>{phoneError}</Text> : null}

        {/* Password */}
        <Text style={styles.label}>Contraseña</Text>
        <View style={{ position: 'relative' }}>
          <TextInput
            style={[styles.input, passwordError ? styles.inputError : null, { paddingRight: 40 }]}
            value={password}
            onChangeText={validatePasswordField}
            placeholder="Mínimo 8 caracteres"
            placeholderTextColor="#9ca3af"
            secureTextEntry={!showPassword}
          />
          <TouchableOpacity
            onPress={() => setShowPassword(!showPassword)}
            style={{ position: 'absolute', right: 12, top: 12 }}
          >
            <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color="#9ca3af" />
          </TouchableOpacity>
        </View>
        {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}

        {/* Confirm Password */}
        <Text style={styles.label}>Confirmar Contraseña</Text>
        <View style={{ position: 'relative' }}>
          <TextInput
            style={[styles.input, confirmPasswordError ? styles.inputError : null, { paddingRight: 40 }]}
            value={confirmPassword}
            onChangeText={validateConfirmPasswordField}
            placeholder="Repite tu contraseña"
            placeholderTextColor="#9ca3af"
            secureTextEntry={!showConfirmPassword}
          />
          <TouchableOpacity
            onPress={() => setShowConfirmPassword(!showConfirmPassword)}
            style={{ position: 'absolute', right: 12, top: 12 }}
          >
            <Ionicons name={showConfirmPassword ? 'eye-off' : 'eye'} size={20} color="#9ca3af" />
          </TouchableOpacity>
        </View>
        {confirmPasswordError ? <Text style={styles.errorText}>{confirmPasswordError}</Text> : null}

        {/* Profile Photo (optional) */}
        <Text style={styles.label}>Foto de perfil (opcional)</Text>
        {profilePhoto ? (
          <TouchableOpacity style={styles.photoPreviewContainer} onPress={handlePickProfilePhoto}>
            <Image
              source={{ uri: profilePhoto.uri }}
              style={{ width: 96, height: 96, borderRadius: 48 }}
              resizeMode="cover"
            />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.uploadBtn} onPress={handlePickProfilePhoto}>
            <View style={{ alignItems: 'center' }}>
              <Ionicons name="camera-outline" size={28} color="#9ca3af" />
              <Text style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>Agregar foto</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Driver fields */}
        {role === 'driver' && (
          <>
            <Text style={[styles.label, { marginTop: 16, fontSize: 16, fontWeight: '700', color: '#111827' }]}>
              Datos del Vehículo
            </Text>

            <Text style={styles.label}>Tipo de vehículo</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
              {(['taxi', 'moto_taxi'] as VehicleType[]).map((v) => (
                <TouchableOpacity
                  key={v}
                  onPress={() => setVehicleType(v)}
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    borderRadius: 10,
                    borderWidth: 2,
                    alignItems: 'center',
                    backgroundColor: vehicleType === v ? '#f0fdf4' : '#fff',
                    borderColor: vehicleType === v ? '#22c55e' : '#e5e7eb',
                  }}
                >
                  <Text style={{ fontSize: 13, fontWeight: '600', color: vehicleType === v ? '#22c55e' : '#6b7280' }}>
                    {v === 'taxi' ? 'Taxi' : 'Moto-Taxi'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Placa del vehículo</Text>
            <TextInput
              style={[styles.input, licensePlateError ? styles.inputError : null]}
              value={licensePlate}
              onChangeText={validateLicensePlateField}
              placeholder="Ej: AB123CD"
              placeholderTextColor="#9ca3af"
              autoCapitalize="characters"
            />
            {licensePlateError ? <Text style={styles.errorText}>{licensePlateError}</Text> : null}

            <Text style={styles.label}>Modelo del vehículo</Text>
            <TextInput
              style={[styles.input, vehicleModelError ? styles.inputError : null]}
              value={vehicleModel}
              onChangeText={validateVehicleModelField}
              placeholder="Ej: Toyota Corolla 2020"
              placeholderTextColor="#9ca3af"
            />
            {vehicleModelError ? <Text style={styles.errorText}>{vehicleModelError}</Text> : null}

            <Text style={[styles.label, { marginTop: 16, fontSize: 16, fontWeight: '700', color: '#111827' }]}>
              Documentos requeridos
            </Text>

            <Text style={styles.label}>Licencia de conducir</Text>
            <TouchableOpacity
              style={styles.uploadBtn}
              onPress={() => handlePickDocument(setDriverLicense)}
            >
              {driverLicense ? (
                <Text style={{ color: '#22c55e', fontWeight: '600' }}>✓ Licencia adjunta</Text>
              ) : (
                <Text style={{ color: '#9ca3af' }}>Seleccionar archivo</Text>
              )}
            </TouchableOpacity>

            <Text style={styles.label}>Certificado médico</Text>
            <TouchableOpacity
              style={styles.uploadBtn}
              onPress={() => handlePickDocument(setMedicalCertificate)}
            >
              {medicalCertificate ? (
                <Text style={{ color: '#22c55e', fontWeight: '600' }}>✓ Certificado adjunto</Text>
              ) : (
                <Text style={{ color: '#9ca3af' }}>Seleccionar archivo</Text>
              )}
            </TouchableOpacity>
          </>
        )}

        {/* Submit */}
        <TouchableOpacity
          style={{
            marginTop: 24,
            backgroundColor: '#22c55e',
            paddingVertical: 16,
            borderRadius: 12,
            alignItems: 'center',
          }}
          onPress={handleRegister}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: '#fff', fontSize: 17, fontWeight: '700' }}>Crear Cuenta</Text>
          )}
        </TouchableOpacity>

        {/* Login link */}
        <TouchableOpacity
          style={{ marginTop: 16, alignItems: 'center' }}
          onPress={() => router.push('/(auth)/login' as any)}
        >
          <Text style={{ color: '#22c55e', fontSize: 14, fontWeight: '600' }}>
            ¿Ya tienes cuenta? Inicia sesión
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
    marginTop: 14,
  },
  input: {
    height: 48,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#fff',
  },
  inputError: {
    borderColor: '#ef4444',
  },
  errorText: {
    fontSize: 12,
    color: '#ef4444',
    marginTop: 4,
    marginLeft: 4,
  },
  uploadBtn: {
    height: 48,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderStyle: 'dashed',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  photoPreviewContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
});
