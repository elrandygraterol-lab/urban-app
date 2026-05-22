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

    // Re-validate confirm password if it has a value
    if (confirmPassword) {
      validateConfirmPasswordField(confirmPassword, value);
    }
  };

  const validateConfirmPasswordField = (value: string, currentPassword?: string) => {
    setConfirmPassword(value);
    const passwordToCompare = currentPassword !== undefined ? currentPassword : password;

    if (value.length === 0) {
      setConfirmPasswordError('Confirma tu contraseña');
    } else if (value !== passwordToCompare) {
      setConfirmPasswordError('Las contraseñas no coinciden');
    } else {
      setConfirmPasswordError('');
    }
  };

  const validateLicensePlateField = (value: string) => {
    setLicensePlate(value);
    if (role === 'driver') {
      if (value.trim().length === 0) {
        setLicensePlateError('La placa es requerida');
      } else if (value.trim().length < 6) {
        setLicensePlateError('Ingresa una placa válida');
      } else {
        setLicensePlateError('');
      }
    }
  };

  const validateVehicleModelField = (value: string) => {
    setVehicleModel(value);
    if (role === 'driver') {
      if (value.trim().length === 0) {
        setVehicleModelError('El modelo del vehículo es requerido');
      } else if (value.trim().length < 3) {
        setVehicleModelError('Ingresa un modelo válido');
      } else {
        setVehicleModelError('');
      }
    }
  };

  const pickProfilePhoto = async () => {
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
              mediaTypes: 'images',
              allowsEditing: true,
              aspect: [1, 1],
              quality: 0.8,
            });

            if (!result.canceled && result.assets[0]) {
              const asset = result.assets[0];
              const file: DocumentFile = {
                uri: asset.uri,
                name: `profile_${Date.now()}.jpg`,
                type: 'image/jpeg',
                size: asset.fileSize || 0,
              };
              setProfilePhoto(file);
            }
          },
        },
        {
          text: 'Elegir de galería',
          onPress: async () => {
            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: 'images',
              allowsEditing: true,
              aspect: [1, 1],
              quality: 0.8,
            });

            if (!result.canceled && result.assets[0]) {
              const asset = result.assets[0];
              const file: DocumentFile = {
                uri: asset.uri,
                name: `profile_${Date.now()}.jpg`,
                type: 'image/jpeg',
                size: asset.fileSize || 0,
              };
              setProfilePhoto(file);
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

  const pickDocument = async (type: 'license' | 'medical') => {
    try {
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
              mediaTypes: 'images',
              allowsEditing: true,
              quality: 0.8,
            });

            if (!result.canceled && result.assets[0]) {
              const asset = result.assets[0];
              const file: DocumentFile = {
                uri: asset.uri,
                name: `${type}_${Date.now()}.jpg`,
                type: 'image/jpeg',
                size: asset.fileSize || 0,
              };

              if (type === 'license') {
                setDriverLicense(file);
              } else {
                setMedicalCertificate(file);
              }
            }
          },
        },
        {
          text: 'Elegir de galería',
          onPress: async () => {
            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: 'images',
              allowsEditing: true,
              quality: 0.8,
            });

            if (!result.canceled && result.assets[0]) {
              const asset = result.assets[0];
              const file: DocumentFile = {
                uri: asset.uri,
                name: `${type}_${Date.now()}.jpg`,
                type: 'image/jpeg',
                size: asset.fileSize || 0,
              };

              if (type === 'license') {
                setDriverLicense(file);
              } else {
                setMedicalCertificate(file);
              }
            }
          },
        },
        {
          text: 'Cancelar',
          style: 'cancel',
        },
      ]);
    } catch (error) {
      console.error('Error picking document:', error);
      Alert.alert('Error', 'No se pudo seleccionar el documento');
    }
  };

  const removeDocument = (type: 'license' | 'medical') => {
    if (type === 'license') {
      setDriverLicense(null);
    } else {
      setMedicalCertificate(null);
    }
  };

  const handleRegister = async () => {
    // Check if there are any validation errors
    if (nameError || emailError || phoneError || passwordError || confirmPasswordError) {
      Alert.alert('Errores en el formulario', 'Por favor corrige los errores antes de continuar');
      return;
    }

    // Validation
    if (!name.trim()) {
      Alert.alert('Error', 'Por favor ingresa tu nombre completo');
      return;
    }

    if (!email.trim() || !validateEmail(email.trim())) {
      Alert.alert('Error', 'Por favor ingresa un email válido');
      return;
    }

    if (!phone.trim() || !validatePhone(phone.trim())) {
      Alert.alert('Error', 'Por favor ingresa un teléfono válido (mínimo 10 dígitos)');
      return;
    }

    if (!password) {
      Alert.alert('Error', 'Por favor ingresa una contraseña');
      return;
    }

    if (password.length < 8) {
      Alert.alert('Error', 'La contraseña debe tener al menos 8 caracteres');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Las contraseñas no coinciden');
      return;
    }

    if (role === 'driver') {
      if (!licensePlate.trim()) {
        Alert.alert('Error', 'Por favor ingresa la placa del vehículo');
        return;
      }
      if (!vehicleModel.trim()) {
        Alert.alert('Error', 'Por favor ingresa el modelo del vehículo');
        return;
      }
      if (!driverLicense) {
        Alert.alert('Error', 'Por favor adjunta tu licencia de conducir');
        return;
      }
      if (!medicalCertificate) {
        Alert.alert('Error', 'Por favor adjunta tu certificado médico');
        return;
      }
    }

    try {
      let formattedPhone = phone.trim();
      if (!formattedPhone.startsWith('+')) {
        formattedPhone = `+58${formattedPhone}`;
      }

      // Request location permission for passengers before registering
      if (role === 'passenger') {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            'Permiso de ubicación requerido',
            'La app necesita acceso a tu ubicación para mostrarte conductores cercanos y calcular tarifas. Por favor activa el permiso.',
            [
              { text: 'Abrir Configuración', onPress: () => Linking.openSettings() },
              { text: 'Continuar de todas formas', style: 'cancel' },
            ]
          );
          // Don't block registration — user can grant later, but warn them
        }
      }

      await register({
        name: name.trim(),
        email: email.trim(),
        phone: formattedPhone,
        password,
        role,
        profilePhoto,
        ...(role === 'driver' && {
          vehicleType,
          licensePlate: licensePlate.trim().toUpperCase(),
          vehicleModel: vehicleModel.trim(),
          driverLicense,
          medicalCertificate,
        }),
      });

      Alert.alert(
        '✅ Registro exitoso',
        'Tu cuenta ha sido creada correctamente. Ahora puedes iniciar sesión.',
        [
          {
            text: 'Ir a Login',
            onPress: () => router.replace('/(auth)/login' as any),
          },
        ],
        { cancelable: false }
      );
    } catch (error: any) {
      console.error('[REGISTER_SCREEN] Registration error:', error);

      const rawMessage: string = error?.message ?? '';

      // Phone already registered
      if (
        rawMessage.includes('phone') ||
        rawMessage.includes('teléfono') ||
        rawMessage.includes('telefono') ||
        rawMessage.includes('already') ||
        rawMessage.includes('duplicate') ||
        rawMessage.includes('unique') ||
        rawMessage.toLowerCase().includes('phone number')
      ) {
        Alert.alert(
          'Número ya registrado',
          'Este número de teléfono ya está asociado a una cuenta. Intenta con otro número o inicia sesión.'
        );
        return;
      }

      // Email already registered
      if (rawMessage.includes('email') && (rawMessage.includes('already') || rawMessage.includes('unique') || rawMessage.includes('duplicate'))) {
        Alert.alert(
          'Correo ya registrado',
          'Este correo electrónico ya está asociado a una cuenta. Intenta con otro correo o inicia sesión.'
        );
        return;
      }

      // Validation errors
      if (rawMessage.includes('Validation failed') && !rawMessage.includes('Errores de validación:')) {
        Alert.alert(
          'Datos inválidos',
          '• Verifica que todos los campos estén completos\n• El correo debe ser válido y único\n• El teléfono debe ser válido\n• La contraseña debe tener al menos 8 caracteres'
        );
        return;
      }

      // Generic user-friendly fallback — never show raw technical errors
      Alert.alert(
        'No se pudo completar el registro',
        'Ocurrió un problema al crear tu cuenta. Verifica tu conexión a internet e intenta de nuevo.'
      );
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header with Illustration */}
        <View style={styles.illustrationContainer}>
          <View style={styles.illustrationBg}>
            <View style={styles.mountain1} />
            <View style={styles.mountain2} />
            <View style={styles.cloud1} />
            <View style={styles.cloud2} />
          </View>

          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>

          <View style={styles.logoContainer}>
            <Image
              source={require('@/assets/images/logo.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
            <Text style={styles.tagline}>Únete a nuestra comunidad</Text>
          </View>
        </View>

        {/* Welcome Badge */}
        <View style={styles.welcomeBadge}>
          <Text style={styles.welcomeText}>Crear cuenta nueva</Text>
          <View style={styles.decorativeCircles}>
            <View style={styles.decorCircle} />
            <View style={styles.decorCircle} />
            <View style={styles.decorCircle} />
          </View>
        </View>

        {/* Form Container */}
        <View style={styles.formContainer}>
          {/* Role Selector */}
          <Text style={styles.sectionTitle}>Selecciona tu rol</Text>
          <View style={styles.roleSelector}>
            <TouchableOpacity
              style={[styles.roleButton, role === 'passenger' && styles.roleButtonActive]}
              onPress={() => setRole('passenger')}
              disabled={isLoading}
            >
              <Ionicons name="person" size={20} color={role === 'passenger' ? '#fff' : '#22c55e'} />
              <Text
                style={[styles.roleButtonText, role === 'passenger' && styles.roleButtonTextActive]}
              >
                Pasajero
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.roleButton, role === 'driver' && styles.roleButtonActive]}
              onPress={() => setRole('driver')}
              disabled={isLoading}
            >
              <Ionicons name="car" size={20} color={role === 'driver' ? '#fff' : '#22c55e'} />
              <Text
                style={[styles.roleButtonText, role === 'driver' && styles.roleButtonTextActive]}
              >
                Conductor
              </Text>
            </TouchableOpacity>

          </View>

          {/* Name Input */}
          <View style={styles.inputWrapper}>
            <TextInput
              style={[styles.input, nameError ? styles.inputError : null]}
              placeholder="Nombre completo"
              placeholderTextColor="#9ca3af"
              value={name}
              onChangeText={validateNameField}
              autoCapitalize="words"
              editable={!isLoading}
            />
            {nameError ? <Text style={styles.errorText}>{nameError}</Text> : null}
          </View>

          {/* Email Input */}
          <View style={styles.inputWrapper}>
            <TextInput
              style={[styles.input, emailError ? styles.inputError : null]}
              placeholder="Email"
              placeholderTextColor="#9ca3af"
              value={email}
              onChangeText={validateEmailField}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isLoading}
            />
          </View>
          {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}

          {/* Phone Input */}
          <View style={styles.inputWrapper}>
            <TextInput
              style={[styles.input, phoneError ? styles.inputError : null]}
              placeholder="Teléfono (ej: 4121234567)"
              placeholderTextColor="#9ca3af"
              value={phone}
              onChangeText={validatePhoneField}
              keyboardType="phone-pad"
              editable={!isLoading}
            />
            {phoneError ? <Text style={styles.errorText}>{phoneError}</Text> : null}
          </View>

          {/* Password Input */}
          <View style={styles.inputWrapper}>
            <TextInput
              style={[styles.input, passwordError ? styles.inputError : null]}
              placeholder="Contraseña (mínimo 8 caracteres)"
              placeholderTextColor="#9ca3af"
              value={password}
              onChangeText={validatePasswordField}
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
          {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}

          {/* Confirm Password Input */}
          <View style={styles.inputWrapper}>
            <TextInput
              style={[styles.input, confirmPasswordError ? styles.inputError : null]}
              placeholder="Confirmar contraseña"
              placeholderTextColor="#9ca3af"
              value={confirmPassword}
              onChangeText={value => validateConfirmPasswordField(value)}
              secureTextEntry={!showConfirmPassword}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isLoading}
            />
            <TouchableOpacity
              style={styles.eyeIcon}
              onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              disabled={isLoading}
            >
              <Ionicons
                name={showConfirmPassword ? 'eye-outline' : 'eye-off-outline'}
                size={20}
                color="#9ca3af"
              />
            </TouchableOpacity>
          </View>
          {confirmPasswordError ? (
            <Text style={styles.errorText}>{confirmPasswordError}</Text>
          ) : null}

          {/* Profile Photo (Optional) */}
          <Text style={styles.documentLabel}>
            Foto de perfil <Text style={styles.optional}>(opcional)</Text>
          </Text>
          {profilePhoto ? (
            <View style={styles.documentSelected}>
              <View style={styles.documentInfo}>
                <Ionicons name="person-circle" size={24} color="#22c55e" />
                <View style={styles.documentDetails}>
                  <Text style={styles.documentName} numberOfLines={1}>
                    {profilePhoto.name}
                  </Text>
                  <Text style={styles.documentSize}>
                    {(profilePhoto.size / 1024).toFixed(2)} KB
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => setProfilePhoto(null)}
                disabled={isLoading}
              >
                <Ionicons name="close" size={16} color="#fff" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.uploadButton}
              onPress={pickProfilePhoto}
              disabled={isLoading}
            >
              <Ionicons name="camera-outline" size={28} color="#22c55e" />
              <Text style={styles.uploadText}>Agregar foto de perfil</Text>
            </TouchableOpacity>
          )}

          {/* Driver-specific Fields */}
          {role === 'driver' && (
            <>
              <Text style={styles.sectionTitle}>Información del vehículo</Text>

              <View style={styles.vehicleTypeSelector}>
                <TouchableOpacity
                  style={[
                    styles.vehicleButton,
                    vehicleType === 'taxi' && styles.vehicleButtonActive,
                  ]}
                  onPress={() => setVehicleType('taxi')}
                  disabled={isLoading}
                >
                  <Ionicons
                    name="car"
                    size={18}
                    color={vehicleType === 'taxi' ? '#fff' : '#22c55e'}
                  />
                  <Text
                    style={[
                      styles.vehicleButtonText,
                      vehicleType === 'taxi' && styles.vehicleButtonTextActive,
                    ]}
                  >
                    Taxi
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.vehicleButton,
                    vehicleType === 'moto_taxi' && styles.vehicleButtonActive,
                  ]}
                  onPress={() => setVehicleType('moto_taxi')}
                  disabled={isLoading}
                >
                  <Ionicons
                    name="bicycle"
                    size={18}
                    color={vehicleType === 'moto_taxi' ? '#fff' : '#22c55e'}
                  />
                  <Text
                    style={[
                      styles.vehicleButtonText,
                      vehicleType === 'moto_taxi' && styles.vehicleButtonTextActive,
                    ]}
                  >
                    Moto-taxi
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.inputWrapper}>
                <TextInput
                  style={[styles.input, licensePlateError ? styles.inputError : null]}
                  placeholder="Placa del vehículo"
                  placeholderTextColor="#9ca3af"
                  value={licensePlate}
                  onChangeText={validateLicensePlateField}
                  autoCapitalize="characters"
                  editable={!isLoading}
                />
                {licensePlateError ? (
                  <Text style={styles.errorText}>{licensePlateError}</Text>
                ) : null}
              </View>

              <View style={styles.inputWrapper}>
                <TextInput
                  style={[styles.input, vehicleModelError ? styles.inputError : null]}
                  placeholder="Modelo del vehículo"
                  placeholderTextColor="#9ca3af"
                  value={vehicleModel}
                  onChangeText={validateVehicleModelField}
                  editable={!isLoading}
                />
                {vehicleModelError ? (
                  <Text style={styles.errorText}>{vehicleModelError}</Text>
                ) : null}
              </View>

              {/* Driver License Document */}
              <Text style={styles.documentLabel}>
                Licencia de conducir <Text style={styles.required}>*</Text>
              </Text>
              {driverLicense ? (
                <View style={styles.documentSelected}>
                  <View style={styles.documentInfo}>
                    <Ionicons name="document-text" size={24} color="#22c55e" />
                    <View style={styles.documentDetails}>
                      <Text style={styles.documentName} numberOfLines={1}>
                        {driverLicense.name}
                      </Text>
                      <Text style={styles.documentSize}>
                        {(driverLicense.size / 1024).toFixed(2)} KB
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => removeDocument('license')}
                    disabled={isLoading}
                  >
                    <Ionicons name="close" size={16} color="#fff" />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.uploadButton}
                  onPress={() => pickDocument('license')}
                  disabled={isLoading}
                >
                  <Ionicons name="cloud-upload-outline" size={28} color="#22c55e" />
                  <Text style={styles.uploadText}>Adjuntar documento</Text>
                </TouchableOpacity>
              )}

              {/* Medical Certificate Document */}
              <Text style={[styles.documentLabel, { marginTop: 12 }]}>
                Certificado médico <Text style={styles.required}>*</Text>
              </Text>
              {medicalCertificate ? (
                <View style={styles.documentSelected}>
                  <View style={styles.documentInfo}>
                    <Ionicons name="document-text" size={24} color="#22c55e" />
                    <View style={styles.documentDetails}>
                      <Text style={styles.documentName} numberOfLines={1}>
                        {medicalCertificate.name}
                      </Text>
                      <Text style={styles.documentSize}>
                        {(medicalCertificate.size / 1024).toFixed(2)} KB
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => removeDocument('medical')}
                    disabled={isLoading}
                  >
                    <Ionicons name="close" size={16} color="#fff" />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.uploadButton}
                  onPress={() => pickDocument('medical')}
                  disabled={isLoading}
                >
                  <Ionicons name="cloud-upload-outline" size={28} color="#22c55e" />
                  <Text style={styles.uploadText}>Adjuntar documento</Text>
                </TouchableOpacity>
              )}
            </>
          )}

          {/* Register Button */}
          <TouchableOpacity
            style={[styles.registerButton, isLoading && styles.registerButtonDisabled]}
            onPress={handleRegister}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.registerButtonText}>Crear cuenta</Text>
            )}
          </TouchableOpacity>

          {/* Login Link */}
          <View style={styles.loginRow}>
            <Text style={styles.loginText}>¿Ya tienes cuenta? </Text>
            <TouchableOpacity
              onPress={() => router.push('/(auth)/login' as any)}
              disabled={isLoading}
            >
              <Text style={styles.loginLink}>Inicia sesión</Text>
            </TouchableOpacity>
          </View>
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
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  illustrationContainer: {
    height: 280,
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
  backButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  logoContainer: {
    position: 'absolute',
    top: 80,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  logoImage: {
    width: 280,
    height: 80,
    marginBottom: 8,
  },
  tagline: {
    fontSize: 14,
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
    color: '#fff',
    fontSize: 18,
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
    backgroundColor: '#fff',
    marginTop: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 28,
    paddingTop: 28,
    paddingBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 8,
  },
  roleSelector: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  roleButton: {
    flex: 1,
    height: 54,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
  },
  roleButtonActive: {
    backgroundColor: '#22c55e',
    borderColor: '#22c55e',
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  roleButtonText: {
    fontSize: 15,
    color: '#6b7280',
    fontWeight: '600',
  },
  roleButtonTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  inputWrapper: {
    marginBottom: 16,
    position: 'relative',
  },
  input: {
    height: 56,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 20,
    fontSize: 15,
    color: '#1f2937',
    backgroundColor: '#fafafa',
  },
  inputError: {
    borderColor: '#ef4444',
    borderWidth: 1.5,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 12,
    marginTop: 6,
    marginLeft: 20,
    fontWeight: '500',
  },
  eyeIcon: {
    position: 'absolute',
    right: 18,
    top: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginTop: 8,
    marginBottom: 12,
  },
  vehicleTypeSelector: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  vehicleButton: {
    flex: 1,
    height: 52,
    backgroundColor: '#fafafa',
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  vehicleButtonActive: {
    backgroundColor: '#22c55e',
    borderColor: '#22c55e',
  },
  vehicleButtonText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '600',
  },
  vehicleButtonTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  documentLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 10,
  },
  required: {
    color: '#ef4444',
  },
  optional: {
    color: '#9ca3af',
    fontWeight: '400',
    fontSize: 13,
  },
  uploadButton: {
    height: 76,
    borderWidth: 1.5,
    borderColor: '#22c55e',
    borderRadius: 12,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    marginBottom: 12,
  },
  uploadText: {
    fontSize: 14,
    color: '#22c55e',
    fontWeight: '600',
    marginTop: 8,
  },
  documentSelected: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#22c55e',
    borderRadius: 12,
    backgroundColor: '#f0fdf4',
    marginBottom: 12,
  },
  documentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  documentDetails: {
    flex: 1,
    marginLeft: 10,
  },
  documentName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 2,
  },
  documentSize: {
    fontSize: 11,
    color: '#6b7280',
  },
  removeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#ef4444',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  registerButton: {
    height: 56,
    backgroundColor: '#22c55e',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 20,
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 10,
  },
  registerButtonDisabled: {
    opacity: 0.5,
  },
  registerButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 16,
  },
  loginText: {
    fontSize: 14,
    color: '#6b7280',
  },
  loginLink: {
    fontSize: 14,
    color: '#22c55e',
    fontWeight: '600',
  },
});
