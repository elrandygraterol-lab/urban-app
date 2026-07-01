import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
  Linking,
  Modal,
  Keyboard,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '@/store/authStore';
import { PRIVACY_TEXT, TERMS_TEXT } from '@/constants/legalText';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useUnifiedNotifications } from '@/context/UnifiedNotificationContext';
import { compressImage } from '@/utils/imageUtils';

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
  const { showToast, showStatus, showActionSheet, dismissStatus } = useUnifiedNotifications();

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
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [termsScrolled, setTermsScrolled] = useState(false);
  const [termsError, setTermsError] = useState('');

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
      showToast('Necesitamos permiso para acceder a tus fotos', 'error');
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
            quality: 0.8,
          });
          if (!result.canceled && result.assets?.[0]) {
            const asset = result.assets[0];
            const compressedUri = await compressImage(asset.uri, { type: 'photo' });
            setProfilePhoto({
              uri: compressedUri,
              name: 'profile_photo.jpg',
              type: 'image/jpeg',
              size: asset.fileSize || 0,
            });
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
            quality: 0.8,
          });
          if (!result.canceled && result.assets?.[0]) {
            const asset = result.assets[0];
            const compressedUri = await compressImage(asset.uri, { type: 'photo' });
            setProfilePhoto({
              uri: compressedUri,
              name: 'profile_photo.jpg',
              type: 'image/jpeg',
              size: asset.fileSize || 0,
            });
          }
        },
      },
    ], 'Elige una opción');
  };

  // Document picker
  const handlePickDocument = async (setter: (file: DocumentFile) => void) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showToast('Necesitamos permiso para acceder a tus archivos', 'error');
      return;
    }
    showActionSheet('Seleccionar documento', [
      {
        label: 'Tomar foto',
        icon: 'camera',
        onPress: async () => {
          const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            quality: 0.8,
          });
          if (!result.canceled && result.assets?.[0]) {
            const asset = result.assets[0];
            const compressedUri = await compressImage(asset.uri, { type: 'photo' });
            setter({
              uri: compressedUri,
              name: 'document.jpg',
              type: 'image/jpeg',
              size: asset.fileSize || 0,
            });
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
            quality: 0.8,
          });
          if (!result.canceled && result.assets?.[0]) {
            const asset = result.assets[0];
            const compressedUri = await compressImage(asset.uri, { type: 'photo' });
            setter({
              uri: compressedUri,
              name: 'document.jpg',
              type: 'image/jpeg',
              size: asset.fileSize || 0,
            });
          }
        },
      },
    ], 'Elige una opción');
  };

  const handleRegister = async () => {
    Keyboard.dismiss();
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

    if (!acceptedTerms) {
      setTermsError('Debes aceptar los Términos de Servicio y Política de Privacidad');
      showToast('Debes aceptar los Términos y Política de Privacidad', 'error');
      return;
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
          showStatus(
            'warning',
            'La app necesita acceso a tu ubicación para calcular rutas y mostrar conductores cercanos.',
            'Permiso de ubicación requerido',
            undefined,
            { label: 'Abrir Configuración', onPress: () => { Linking.openSettings(); dismissStatus(); } }
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
        { label: 'Ir a Login', onPress: () => { router.replace('/(auth)/login' as any); dismissStatus(); } }
      );
    } catch (error: any) {
      console.error('[REGISTER_SCREEN] Registration error:', error);
      const msg = error?.response?.data?.error?.message || error?.message || '';
      const lower = msg.toLowerCase();

      if (
        lower.includes('phone number') ||
        lower.includes('teléfono') ||
        lower.includes('telefono')
      ) {
        showToast('Este número de teléfono ya está registrado', 'error');
      } else if (lower.includes('email') || lower.includes('correo')) {
        showToast('Este correo electrónico ya está registrado', 'error');
      } else if (
        lower.includes('duplicate') ||
        lower.includes('unique') ||
        lower.includes('exist')
      ) {
        showToast('Este usuario ya existe', 'error');
      } else if (
        lower.includes('validation') ||
        lower.includes('validación') ||
        lower.includes('invalido') ||
        lower.includes('inválido')
      ) {
        showToast('Verifica que todos los campos estén completos y sean correctos', 'error');
      } else {
        showToast('No se pudo completar el registro. Intenta de nuevo.', 'error');
      }
    }
  };

  return (
    <SafeAreaView style={styles.screenSafe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* --- ILLUSTRATION --- */}
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

          {/* --- CARD --- */}
          <View style={styles.cardContainer}>
            <View style={styles.formContainer}>
              {/* Header */}
              <View style={styles.formHeader}>
                <Text style={styles.formTitle}>Crear cuenta</Text>
                <Text style={styles.formSubtitle}>Completa el formulario para registrarte</Text>
              </View>

          {/* Role Selector */}
          <Text style={styles.roleLabel}>Tipo de cuenta</Text>
          <View style={styles.roleRow}>
            {(['passenger', 'driver'] as UserRole[]).map(r => (
              <TouchableOpacity
                key={r}
                onPress={() => setRole(r)}
                style={[styles.roleBtn, role === r && styles.roleBtnActive]}
              >
                <Ionicons
                  name={r === 'passenger' ? 'person-outline' : 'car-outline'}
                  size={18}
                  color={role === r ? '#22c55e' : '#94a3b8'}
                />
                <Text style={[styles.roleBtnText, role === r && styles.roleBtnTextActive]}>
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
              style={[
                styles.input,
                confirmPasswordError ? styles.inputError : null,
                { paddingRight: 40 },
              ]}
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
          {confirmPasswordError ? (
            <Text style={styles.errorText}>{confirmPasswordError}</Text>
          ) : null}

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
              <Text
                style={[
                  styles.label,
                  { marginTop: 16, fontSize: 16, fontWeight: '700', color: '#111827' },
                ]}
              >
                Datos del Vehículo
              </Text>

              <Text style={styles.label}>Tipo de vehículo</Text>
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
                {(['taxi', 'moto_taxi'] as VehicleType[]).map(v => (
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
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: '600',
                        color: vehicleType === v ? '#22c55e' : '#6b7280',
                      }}
                    >
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

              <Text
                style={[
                  styles.label,
                  { marginTop: 16, fontSize: 16, fontWeight: '700', color: '#111827' },
                ]}
              >
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

          {/* Privacy & Terms — single line, clean */}
          <View style={styles.termsContainer}>
            <TouchableOpacity
              style={styles.termsCheckRow}
              onPress={() => {
                if (acceptedTerms) {
                  setAcceptedTerms(false);
                  setTermsError('');
                } else {
                  setShowTermsModal(true);
                  setTermsScrolled(false);
                  setTermsError('');
                }
              }}
              activeOpacity={0.7}
            >
              <View style={[styles.termsCheckbox, acceptedTerms && styles.termsCheckboxActive]}>
                {acceptedTerms && <Ionicons name="checkmark" size={14} color="#fff" />}
              </View>
              <Text style={styles.termsText}>
                Acepto los{' '}
                <Text style={styles.termsLink} onPress={() => { setShowTermsModal(true); setTermsScrolled(false); }}>
                  Términos de Servicio
                </Text>
                {' '}y{' '}
                <Text style={styles.termsLink} onPress={() => { setShowTermsModal(true); setTermsScrolled(false); }}>
                  Política de Privacidad
                </Text>
              </Text>
            </TouchableOpacity>
            {termsError ? <Text style={styles.termsError}>{termsError}</Text> : null}
            <View style={styles.termsLinksContainer}>
              <Text style={styles.termsLinksLabel}>Enlaces:</Text>
              <Text style={styles.termsUrl} onPress={() => Linking.openURL('https://administracionurbantaxis.com/terminos')}>
                administracionurbantaxis.com/terminos
              </Text>
              <Text style={styles.termsUrl} onPress={() => Linking.openURL('https://administracionurbantaxis.com/privacidad')}>
                administracionurbantaxis.com/privacidad
              </Text>
              <Text style={styles.termsContact}>
                Contacto: <Text style={styles.termsContactBold}>urbantaxisapp@gmail.com</Text>
              </Text>
            </View>
          </View>

          {/* Terms & Privacy Modal */}
          <Modal
            visible={showTermsModal}
            animationType="slide"
            presentationStyle="fullScreen"
          >
            <SafeAreaView style={styles.termsModalSafe}>
              <View style={styles.termsModalHeader}>
                <Text style={styles.termsModalTitle}>Términos y Privacidad</Text>
                <TouchableOpacity onPress={() => setShowTermsModal(false)}>
                  <Ionicons name="close" size={22} color="#9ca3af" />
                </TouchableOpacity>
              </View>
              <ScrollView
                style={styles.termsModalScroll}
                contentContainerStyle={styles.termsModalContent}
                showsVerticalScrollIndicator={true}
                onScroll={({ nativeEvent }) => {
                  const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
                  const scrolledEnough = layoutMeasurement.height + contentOffset.y >= contentSize.height * 0.6;
                  if (scrolledEnough && !termsScrolled) {
                    setTermsScrolled(true);
                  }
                }}
                scrollEventThrottle={100}
              >
                <Text style={styles.termsModalHeading}>TÉRMINOS DE SERVICIO</Text>
                <Text style={styles.termsModalText}>{TERMS_TEXT}</Text>
                <View style={styles.termsDivider} />
                <Text style={styles.termsModalHeading}>POLÍTICA DE PRIVACIDAD</Text>
                <Text style={styles.termsModalText}>{PRIVACY_TEXT}</Text>
              </ScrollView>
              <View style={styles.termsModalFooter}>
                <TouchableOpacity
                  style={styles.termsRejectBtn}
                  onPress={() => {
                    setAcceptedTerms(false);
                    setShowTermsModal(false);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.termsRejectBtnText}>Rechazar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.termsAcceptBtn, !termsScrolled && !acceptedTerms && styles.termsAcceptBtnDisabled]}
                  onPress={() => {
                    if (termsScrolled || acceptedTerms) {
                      setAcceptedTerms(true);
                      setTermsError('');
                      setShowTermsModal(false);
                    }
                  }}
                  activeOpacity={0.8}
                  disabled={acceptedTerms || !termsScrolled}
                >
                  <Text style={styles.termsAcceptBtnText}>
                    {acceptedTerms ? 'Aceptado' : 'Aceptar'}
                  </Text>
                </TouchableOpacity>
              </View>
            </SafeAreaView>
          </Modal>

          {/* Submit */}
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={handleRegister}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryBtnText}>Crear cuenta</Text>
            )}
          </TouchableOpacity>

          {/* Login link */}
          <View style={styles.linkRow}>
            <Text style={styles.linkRowText}>¿Ya tienes cuenta? </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/login' as any)}>
              <Text style={styles.linkRowAction}>Inicia sesión</Text>
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
  screenSafe: {
    flex: 1,
    backgroundColor: '#e8f5e9',
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
  formContainer: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 32,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 6,
    marginTop: 16,
  },
  input: {
    height: 50,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#0f172a',
    backgroundColor: '#f8fafc',
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
    height: 50,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderStyle: 'dashed',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  photoPreviewContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  /* Terms & Privacy */
  termsContainer: {
    marginTop: 20,
    marginBottom: 4,
  },
  termsCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  termsCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#d1d5db',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  termsCheckboxActive: {
    backgroundColor: '#22c55e',
    borderColor: '#22c55e',
  },
  termsLinksRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginLeft: 30,
    marginTop: 2,
  },
  termsLinksContainer: {
    marginTop: 8,
    marginLeft: 30,
    paddingLeft: 4,
  },
  termsLinksLabel: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '600',
    marginBottom: 3,
  },
  termsUrl: {
    fontSize: 12,
    color: '#3b82f6',
    fontWeight: '500',
    lineHeight: 20,
    textDecorationLine: 'underline',
  },
  termsContact: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  termsContactBold: {
    fontWeight: '600',
    color: '#475569',
  },
  termsText: {
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 20,
  },
  termsLink: {
    fontSize: 13,
    color: '#22c55e',
    fontWeight: '600',
    lineHeight: 20,
  },
  termsError: {
    fontSize: 12,
    color: '#ef4444',
    marginTop: 6,
    marginLeft: 30,
  },
  /* Terms modal */
  termsModalSafe: {
    flex: 1,
    backgroundColor: '#fff',
  },
  termsModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  termsModalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1f2937',
  },
  termsModalScroll: {
    flex: 1,
  },
  termsModalContent: {
    padding: 20,
    paddingBottom: 30,
  },
  termsModalHeading: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  termsDivider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 24,
  },
  termsModalText: {
    fontSize: 13,
    lineHeight: 21,
    color: '#4b5563',
  },
  termsModalFooter: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    gap: 10,
  },
  termsRejectBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
  },
  termsRejectBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  termsAcceptBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: '#22c55e',
    alignItems: 'center',
  },
  termsAcceptBtnDisabled: {
    backgroundColor: '#a3e4b8',
  },
  termsAcceptBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  /* Primary btn */
  primaryBtn: {
    marginTop: 20,
    height: 48,
    backgroundColor: '#22c55e',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 20,
  },
  linkRowText: {
    fontSize: 14,
    color: '#64748b',
  },
  linkRowAction: {
    fontSize: 14,
    color: '#22c55e',
    fontWeight: '700',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
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


  /* Role selector */
  roleLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 8,
  },
  roleRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 4,
  },
  roleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
  },
  roleBtnActive: {
    borderColor: '#22c55e',
    backgroundColor: '#f0fdf4',
  },
  roleBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94a3b8',
  },
  roleBtnTextActive: {
    color: '#22c55e',
  },
});
