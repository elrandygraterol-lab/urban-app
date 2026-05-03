import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { BusinessHoursEditor } from '@/components/stores/BusinessHoursEditor';
import { CategoryPicker } from '@/components/stores/CategoryPicker';
import { useStoreStore } from '@/store/storeStore';
import { useAuthStore } from '@/store/authStore';
import { uploadImage } from '@/services/storeApi';
import { compressImage, validateImageSize, formatFileSize, getImageSize } from '@/utils/imageUtils';
import type { BusinessHours, DayHours, CreateStoreRequest } from '@/types/store';

// Default business hours
const DEFAULT_BUSINESS_HOURS: BusinessHours = {
  monday: { open: '09:00', close: '18:00', closed: false },
  tuesday: { open: '09:00', close: '18:00', closed: false },
  wednesday: { open: '09:00', close: '18:00', closed: false },
  thursday: { open: '09:00', close: '18:00', closed: false },
  friday: { open: '09:00', close: '18:00', closed: false },
  saturday: { open: '10:00', close: '14:00', closed: false },
  sunday: { open: null, close: null, closed: true },
};

interface ImageAsset {
  uri: string;
  name: string;
  type: string;
}

export default function StoreFormScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const storeId = params.storeId ? Number(params.storeId) : null;
  const isEditMode = !!storeId;

  const { user } = useAuthStore();
  const { categories, fetchCategories, createStore, updateStore, fetchStoreById, selectedStore, loading } = useStoreStore();

  // Multi-step state
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 4;

  // Form data
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [description, setDescription] = useState('');
  
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState<number | undefined>();
  const [longitude, setLongitude] = useState<number | undefined>();
  
  const [businessHours, setBusinessHours] = useState<BusinessHours>(DEFAULT_BUSINESS_HOURS);
  
  const [logo, setLogo] = useState<ImageAsset | null>(null);
  const [photos, setPhotos] = useState<ImageAsset[]>([]);
  const [menuImages, setMenuImages] = useState<ImageAsset[]>([]);
  
  // Existing images from server (for edit mode)
  const [existingImages, setExistingImages] = useState<{ id: number; url: string; type: 'logo' | 'photo' }[]>([]);
  const [imagesToDelete, setImagesToDelete] = useState<number[]>([]);

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // Loading state for initial data fetch
  const [isLoadingStore, setIsLoadingStore] = useState(false);

  // Load categories on mount
  useEffect(() => {
    fetchCategories();
  }, []);

  // Load existing store data in edit mode
  useEffect(() => {
    if (isEditMode && storeId) {
      loadStoreData();
    }
  }, [isEditMode, storeId]);

  // Verify user has owner role
  useEffect(() => {
    // Note: The backend will verify the role, but we can show a warning here
    // In a real implementation, you'd check user.role === 'owner'
    // For now, we'll let the backend handle the verification
  }, [user]);

  // ============================================================================
  // Load Store Data for Edit Mode
  // ============================================================================

  const loadStoreData = async () => {
    if (!storeId) return;
    
    setIsLoadingStore(true);
    try {
      await fetchStoreById(storeId);
      
      // Wait for selectedStore to be updated
      // Note: In a real implementation, you might want to use a callback or promise
      // For now, we'll access it directly after the fetch
    } catch (error) {
      console.error('Error loading store data:', error);
      Alert.alert('Error', 'No se pudo cargar la información de la tienda');
      router.back();
    } finally {
      setIsLoadingStore(false);
    }
  };

  // Pre-fill form when store data is loaded
  useEffect(() => {
    if (isEditMode && selectedStore && selectedStore.store_id === storeId) {
      // Basic info
      setName(selectedStore.name);
      setCategoryId(selectedStore.category_id);
      setDescription(selectedStore.description);
      
      // Contact & location
      setPhone(selectedStore.phone);
      setEmail(selectedStore.email || '');
      setWebsite(selectedStore.website || '');
      setAddress(selectedStore.address);
      setLatitude(selectedStore.latitude);
      setLongitude(selectedStore.longitude);
      
      // Business hours
      if (selectedStore.business_hours) {
        setBusinessHours(selectedStore.business_hours);
      }
      
      // Existing images
      if (selectedStore.images && selectedStore.images.length > 0) {
        const images = selectedStore.images.map(img => ({
          id: img.image_id,
          url: img.image_url,
          type: img.image_type as 'logo' | 'photo',
        }));
        setExistingImages(images);
      }
    }
  }, [isEditMode, selectedStore, storeId]);

  // ============================================================================
  // Validation Functions
  // ============================================================================

  const validateStep1 = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = 'El nombre es requerido';
    } else if (name.length < 3) {
      newErrors.name = 'El nombre debe tener al menos 3 caracteres';
    } else if (name.length > 100) {
      newErrors.name = 'El nombre no puede exceder 100 caracteres';
    }

    if (!categoryId) {
      newErrors.category = 'Selecciona una categoría';
    }

    if (!description.trim()) {
      newErrors.description = 'La descripción es requerida';
    } else if (description.length < 10) {
      newErrors.description = 'La descripción debe tener al menos 10 caracteres';
    } else if (description.length > 500) {
      newErrors.description = 'La descripción no puede exceder 500 caracteres';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!phone.trim()) {
      newErrors.phone = 'El teléfono es requerido';
    } else if (!/^\+?[\d\s\-()]+$/.test(phone)) {
      newErrors.phone = 'Formato de teléfono inválido';
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Formato de email inválido';
    }

    if (!address.trim()) {
      newErrors.address = 'La dirección es requerida';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep3 = (): boolean => {
    // Business hours are optional, so always valid
    return true;
  };

  const validateStep4 = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (photos.length > 10) {
      newErrors.photos = 'Máximo 10 fotos permitidas';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ============================================================================
  // Navigation Functions
  // ============================================================================

  const handleNext = () => {
    let isValid = false;

    switch (currentStep) {
      case 1:
        isValid = validateStep1();
        break;
      case 2:
        isValid = validateStep2();
        break;
      case 3:
        isValid = validateStep3();
        break;
      case 4:
        isValid = validateStep4();
        break;
    }

    if (isValid && currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    } else {
      router.back();
    }
  };

  // ============================================================================
  // Image Picker Functions
  // ============================================================================

  const pickLogo = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('Permiso requerido', 'Necesitamos acceso a tu galería para seleccionar el logo');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1, // Use max quality, we'll compress it ourselves
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      
      // Validate image size (max 5MB)
      const isValid = await validateImageSize(asset.uri);
      if (!isValid) {
        const size = await getImageSize(asset.uri);
        Alert.alert(
          'Imagen muy grande',
          `La imagen seleccionada (${formatFileSize(size)}) excede el límite de 5MB. Por favor, selecciona una imagen más pequeña.`
        );
        return;
      }
      
      // Compress the image
      console.log('[StoreForm] Compressing logo image...');
      const compressedUri = await compressImage(asset.uri, {
        type: 'logo',
        quality: 'high',
      });
      
      setLogo({
        uri: compressedUri,
        name: `logo_${Date.now()}.jpg`,
        type: 'image/jpeg',
      });
      
      // If replacing existing logo, mark it for deletion
      const existingLogo = existingImages.find(img => img.type === 'logo');
      if (existingLogo) {
        setImagesToDelete([...imagesToDelete, existingLogo.id]);
        setExistingImages(existingImages.filter(img => img.id !== existingLogo.id));
      }
      
      console.log('[StoreForm] Logo compressed and ready for upload');
    }
  };
  
  const removeExistingImage = (imageId: number) => {
    setImagesToDelete([...imagesToDelete, imageId]);
    setExistingImages(existingImages.filter(img => img.id !== imageId));
  };

  const pickPhotos = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('Permiso requerido', 'Necesitamos acceso a tu galería para seleccionar fotos');
      return;
    }

    const existingPhotoCount = existingImages.filter(img => img.type === 'photo').length;
    const totalPhotoCount = existingPhotoCount + photos.length;
    
    if (totalPhotoCount >= 10) {
      Alert.alert('Límite alcanzado', 'Solo puedes tener un máximo de 10 fotos');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 1, // Use max quality, we'll compress it ourselves
    });

    if (!result.canceled) {
      const totalPhotos = totalPhotoCount + result.assets.length;
      if (totalPhotos > 10) {
        Alert.alert('Límite excedido', `Solo puedes tener 10 fotos. Tienes ${totalPhotoCount}, intentas agregar ${result.assets.length}`);
        return;
      }
      
      // Compress all selected photos
      console.log(`[StoreForm] Compressing ${result.assets.length} photos...`);
      const compressedPhotos = await Promise.all(
        result.assets.map(async (asset, index) => {
          // Validate image size
          const isValid = await validateImageSize(asset.uri);
          if (!isValid) {
            const size = await getImageSize(asset.uri);
            console.warn(`[StoreForm] Photo ${index + 1} is too large (${formatFileSize(size)}), skipping`);
            return null;
          }
          
          // Compress the image
          const compressedUri = await compressImage(asset.uri, {
            type: 'photo',
            quality: 'medium',
          });
          
          return {
            uri: compressedUri,
            name: `photo_${Date.now()}_${index}.jpg`,
            type: 'image/jpeg',
          };
        })
      );
      
      // Filter out null values (images that were too large)
      const validPhotos = compressedPhotos.filter(photo => photo !== null) as ImageAsset[];
      
      if (validPhotos.length < result.assets.length) {
        Alert.alert(
          'Algunas imágenes no se agregaron',
          `${result.assets.length - validPhotos.length} imagen(es) excedieron el límite de 5MB y no se agregaron.`
        );
      }

      setPhotos([...photos, ...validPhotos]);
      console.log(`[StoreForm] ${validPhotos.length} photos compressed and ready for upload`);
    }
  };

  const removePhoto = (index: number) => {
    setPhotos(photos.filter((_, i) => i !== index));
  };

  const pickMenuImages = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (status !== 'granted') {
      Alert.alert('Permiso requerido', 'Necesitamos acceso a tu galería para seleccionar imágenes de menú');
      return;
    }

    if (menuImages.length >= 10) {
      Alert.alert('Límite alcanzado', 'Solo puedes tener un máximo de 10 imágenes de menú');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 1, // Use max quality, we'll compress it ourselves
    });

    if (!result.canceled) {
      const totalMenuImages = menuImages.length + result.assets.length;
      if (totalMenuImages > 10) {
        Alert.alert('Límite excedido', `Solo puedes tener 10 imágenes de menú. Tienes ${menuImages.length}, intentas agregar ${result.assets.length}`);
        return;
      }

      // Compress all selected menu images
      console.log(`[StoreForm] Compressing ${result.assets.length} menu images...`);
      const compressedMenuImages = await Promise.all(
        result.assets.map(async (asset, index) => {
          // Validate image size
          const isValid = await validateImageSize(asset.uri);
          if (!isValid) {
            const size = await getImageSize(asset.uri);
            console.warn(`[StoreForm] Menu image ${index + 1} is too large (${formatFileSize(size)}), skipping`);
            return null;
          }

          // Compress the image
          const compressedUri = await compressImage(asset.uri, {
            type: 'photo',
            quality: 'medium',
          });

          return {
            uri: compressedUri,
            name: `menu_${Date.now()}_${index}.jpg`,
            type: 'image/jpeg',
          };
        })
      );

      // Filter out null values (images that were too large)
      const validMenuImages = compressedMenuImages.filter(img => img !== null) as ImageAsset[];

      if (validMenuImages.length < result.assets.length) {
        Alert.alert(
          'Algunas imágenes no se agregaron',
          `${result.assets.length - validMenuImages.length} imagen(es) excedieron el límite de 5MB y no se agregaron.`
        );
      }

      setMenuImages([...menuImages, ...validMenuImages]);
      console.log(`[StoreForm] ${validMenuImages.length} menu images compressed and ready for upload`);
    }
  };

  const removeMenuImage = (index: number) => {
    setMenuImages(menuImages.filter((_, i) => i !== index));
  };

  // ============================================================================
  // Location Functions
  // ============================================================================

  // Auto-capture GPS when entering step 2 (new store only, no existing coords)
  useEffect(() => {
    if (currentStep === 2 && !isEditMode && !latitude && !longitude) {
      captureLocationAutomatically();
    }
  }, [currentStep]);

  const captureLocationAutomatically = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Ubicación no disponible',
        'Permiso de ubicación denegado. Ingrese las coordenadas manualmente'
      );
      return;
    }
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    setLatitude(location.coords.latitude);
    setLongitude(location.coords.longitude);
  };

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permiso requerido', 'Necesitamos acceso a tu ubicación para obtener las coordenadas');
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      setLatitude(location.coords.latitude);
      setLongitude(location.coords.longitude);
      
      Alert.alert('Ubicación obtenida', 'Se han guardado las coordenadas de tu ubicación actual');
    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert('Error', 'No se pudo obtener la ubicación');
    }
  };

  // ============================================================================
  // Form Submission
  // ============================================================================

  const handleSubmit = async () => {
    if (!validateStep4()) {
      return;
    }

    try {
      // Prepare store data
      const storeData: CreateStoreRequest = {
        name: name.trim(),
        address: address.trim(),
        phone: phone.trim(),
        category_id: categoryId!,
        description: description.trim(),
        email: email.trim() || undefined,
        website: website.trim() || undefined,
        business_hours: businessHours,
        latitude,
        longitude,
      };

      let resultStoreId: number;

      if (isEditMode && storeId) {
        // Update existing store
        await updateStore(storeId, storeData);
        resultStoreId = storeId;
        
        // Delete marked images
        // Note: Image deletion would be done here using the deleteImage API
        // For now, we'll skip this as it requires proper error handling
        // In a real implementation, you'd call deleteImage for each imageId in imagesToDelete
        
      } else {
        // Create new store
        resultStoreId = await createStore(storeData);
      }

      // Upload new images if any
      if (logo || photos.length > 0 || menuImages.length > 0) {
        // Upload logo
        if (logo) {
          try {
            await uploadImage(resultStoreId, logo, 'logo');
          } catch (imgError) {
            console.error('[StoreForm] Error uploading logo:', imgError);
          }
        }

        // Upload photos
        for (let i = 0; i < photos.length; i++) {
          try {
            await uploadImage(resultStoreId, photos[i], 'photo', i);
          } catch (imgError) {
            console.error(`[StoreForm] Error uploading photo ${i + 1}:`, imgError);
          }
        }

        // Upload menu images
        for (let i = 0; i < menuImages.length; i++) {
          try {
            await uploadImage(resultStoreId, menuImages[i], 'menu', i);
          } catch (imgError) {
            console.error(`[StoreForm] Error uploading menu image ${i + 1}:`, imgError);
          }
        }
      }

      Alert.alert(
        'Éxito',
        isEditMode 
          ? 'Tu tienda ha sido actualizada exitosamente'
          : 'Tu tienda ha sido registrada y está pendiente de aprobación',
        [
          {
            text: 'OK',
            onPress: () => router.push('/(tabs)/stores/my-stores'),
          },
        ]
      );
    } catch (error: any) {
      console.error('Error saving store:', error);
      
      // Check for role verification error
      if (error.response?.status === 403) {
        Alert.alert(
          'Acceso denegado',
          'Solo los usuarios con rol de Propietario pueden gestionar tiendas. Por favor, contacta al administrador.'
        );
      } else {
        Alert.alert(
          'Error',
          error.response?.data?.error?.message || `No se pudo ${isEditMode ? 'actualizar' : 'crear'} la tienda. Intenta de nuevo.`
        );
      }
    }
  };

  // ============================================================================
  // Render Functions
  // ============================================================================

  const renderProgressIndicator = () => (
    <View style={styles.progressContainer}>
      {[1, 2, 3, 4].map((step) => (
        <View key={step} style={styles.progressStepContainer}>
          <View
            style={[
              styles.progressStep,
              step === currentStep && styles.progressStepActive,
              step < currentStep && styles.progressStepCompleted,
            ]}
          >
            {step < currentStep ? (
              <Ionicons name="checkmark" size={16} color={Colors.white} />
            ) : (
              <Text
                style={[
                  styles.progressStepText,
                  step === currentStep && styles.progressStepTextActive,
                ]}
              >
                {step}
              </Text>
            )}
          </View>
          {step < totalSteps && (
            <View
              style={[
                styles.progressLine,
                step < currentStep && styles.progressLineCompleted,
              ]}
            />
          )}
        </View>
      ))}
    </View>
  );

  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Información Básica</Text>
      <Text style={styles.stepSubtitle}>
        Proporciona los datos principales de tu tienda
      </Text>

      {/* Name Input */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>
          Nombre de la tienda <Text style={styles.required}>*</Text>
        </Text>
        <TextInput
          style={[styles.input, errors.name && styles.inputError]}
          value={name}
          onChangeText={setName}
          placeholder="Ej: Tienda Don José"
          maxLength={100}
        />
        <Text style={styles.charCounter}>{name.length}/100</Text>
        {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
      </View>

      {/* Category Picker */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>
          Categoría <Text style={styles.required}>*</Text>
        </Text>
        <CategoryPicker
          selectedCategory={categoryId}
          onSelect={setCategoryId}
          categories={categories}
        />
        {errors.category && <Text style={styles.errorText}>{errors.category}</Text>}
      </View>

      {/* Description Input */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>
          Descripción <Text style={styles.required}>*</Text>
        </Text>
        <TextInput
          style={[styles.textArea, errors.description && styles.inputError]}
          value={description}
          onChangeText={setDescription}
          placeholder="Describe tu tienda, productos y servicios..."
          multiline
          numberOfLines={4}
          maxLength={500}
        />
        <Text style={styles.charCounter}>{description.length}/500</Text>
        {errors.description && <Text style={styles.errorText}>{errors.description}</Text>}
      </View>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Contacto y Ubicación</Text>
      <Text style={styles.stepSubtitle}>
        Información para que los clientes puedan contactarte
      </Text>

      {/* Phone Input */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>
          Teléfono <Text style={styles.required}>*</Text>
        </Text>
        <TextInput
          style={[styles.input, errors.phone && styles.inputError]}
          value={phone}
          onChangeText={setPhone}
          placeholder="+52 123 456 7890"
          keyboardType="phone-pad"
        />
        {errors.phone && <Text style={styles.errorText}>{errors.phone}</Text>}
      </View>

      {/* Email Input */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Email (opcional)</Text>
        <TextInput
          style={[styles.input, errors.email && styles.inputError]}
          value={email}
          onChangeText={setEmail}
          placeholder="correo@ejemplo.com"
          keyboardType="email-address"
          autoCapitalize="none"
        />
        {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
      </View>

      {/* Website Input */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Sitio web (opcional)</Text>
        <TextInput
          style={styles.input}
          value={website}
          onChangeText={setWebsite}
          placeholder="https://www.ejemplo.com"
          keyboardType="url"
          autoCapitalize="none"
        />
      </View>

      {/* Address Input */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>
          Dirección <Text style={styles.required}>*</Text>
        </Text>
        <TextInput
          style={[styles.textArea, errors.address && styles.inputError]}
          value={address}
          onChangeText={setAddress}
          placeholder="Calle, número, colonia, ciudad..."
          multiline
          numberOfLines={3}
        />
        {errors.address && <Text style={styles.errorText}>{errors.address}</Text>}
      </View>

      {/* Location Coordinates */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Coordenadas (opcional)</Text>
        <TouchableOpacity style={styles.locationButton} onPress={getCurrentLocation}>
          <Ionicons name="location" size={20} color={Colors.primary} />
          <Text style={styles.locationButtonText}>
            {latitude && longitude
              ? `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
              : 'Obtener ubicación actual'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Horario de Atención</Text>
      <Text style={styles.stepSubtitle}>
        Configura los horarios de tu tienda (opcional)
      </Text>

      <BusinessHoursEditor hours={businessHours} onChange={setBusinessHours} />
    </View>
  );

  const renderStep4 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Imágenes</Text>
      <Text style={styles.stepSubtitle}>
        Agrega fotos de tu tienda para atraer más clientes
      </Text>

      {/* Logo */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Logo (opcional)</Text>
        <TouchableOpacity style={styles.imagePickerButton} onPress={pickLogo}>
          {logo ? (
            <View style={styles.logoPreview}>
              <Image source={{ uri: logo.uri }} style={styles.logoImage} resizeMode="cover" />
              <TouchableOpacity
                style={styles.removeImageButton}
                onPress={() => setLogo(null)}
              >
                <Ionicons name="close-circle" size={24} color={Colors.error} />
              </TouchableOpacity>
            </View>
          ) : existingImages.find(img => img.type === 'logo') ? (
            <View style={styles.logoPreview}>
              <Image 
                source={{ uri: existingImages.find(img => img.type === 'logo')!.url }} 
                style={styles.logoImage} 
                resizeMode="cover" 
              />
              <TouchableOpacity
                style={styles.removeImageButton}
                onPress={() => removeExistingImage(existingImages.find(img => img.type === 'logo')!.id)}
              >
                <Ionicons name="close-circle" size={24} color={Colors.error} />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.imagePickerContent}>
              <Ionicons name="image-outline" size={40} color={Colors.mediumGray} />
              <Text style={styles.imagePickerText}>Seleccionar logo</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Photos */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>
          Fotos (máximo 10) - {existingImages.filter(img => img.type === 'photo').length + photos.length}/10
        </Text>
        <TouchableOpacity
          style={styles.imagePickerButton}
          onPress={pickPhotos}
          disabled={existingImages.filter(img => img.type === 'photo').length + photos.length >= 10}
        >
          <View style={styles.imagePickerContent}>
            <Ionicons name="images-outline" size={40} color={Colors.mediumGray} />
            <Text style={styles.imagePickerText}>
              Agregar fotos
            </Text>
          </View>
        </TouchableOpacity>

        {/* Existing Photo Previews */}
        {existingImages.filter(img => img.type === 'photo').length > 0 && (
          <View style={styles.photoGrid}>
            {existingImages.filter(img => img.type === 'photo').map((image) => (
              <View key={image.id} style={styles.photoPreview}>
                <Image source={{ uri: image.url }} style={styles.photoImage} resizeMode="cover" />
                <TouchableOpacity
                  style={styles.removeImageButton}
                  onPress={() => removeExistingImage(image.id)}
                >
                  <Ionicons name="close-circle" size={24} color={Colors.error} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* New Photo Previews */}
        {photos.length > 0 && (
          <View style={styles.photoGrid}>
            {photos.map((photo, index) => (
              <View key={index} style={styles.photoPreview}>
                <Image source={{ uri: photo.uri }} style={styles.photoImage} resizeMode="cover" />
                <TouchableOpacity
                  style={styles.removeImageButton}
                  onPress={() => removePhoto(index)}
                >
                  <Ionicons name="close-circle" size={24} color={Colors.error} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {errors.photos && <Text style={styles.errorText}>{errors.photos}</Text>}
      </View>

      {/* Menu Images */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>
          Imágenes de Menú (máximo 10) - {menuImages.length}/10
        </Text>
        <TouchableOpacity
          style={styles.imagePickerButton}
          onPress={pickMenuImages}
          disabled={menuImages.length >= 10}
        >
          <View style={styles.imagePickerContent}>
            <Ionicons name="restaurant-outline" size={40} color={Colors.mediumGray} />
            <Text style={styles.imagePickerText}>
              Agregar imágenes de menú
            </Text>
          </View>
        </TouchableOpacity>

        {/* Menu Image Previews */}
        {menuImages.length > 0 && (
          <View style={styles.photoGrid}>
            {menuImages.map((image, index) => (
              <View key={index} style={styles.photoPreview}>
                <Image source={{ uri: image.uri }} style={styles.photoImage} resizeMode="cover" />
                <TouchableOpacity
                  style={styles.removeImageButton}
                  onPress={() => removeMenuImage(index)}
                >
                  <Ionicons name="close-circle" size={24} color={Colors.error} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.darkGray} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isEditMode ? 'Editar Tienda' : 'Nueva Tienda'}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Loading indicator for edit mode */}
      {isLoadingStore ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Cargando información de la tienda...</Text>
        </View>
      ) : (
        <>
          {/* Progress Indicator */}
          {renderProgressIndicator()}

          {/* Form Content */}
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {currentStep === 1 && renderStep1()}
            {currentStep === 2 && renderStep2()}
            {currentStep === 3 && renderStep3()}
            {currentStep === 4 && renderStep4()}
          </ScrollView>

          {/* Navigation Buttons */}
          <View style={styles.footer}>
            {currentStep < totalSteps ? (
              <TouchableOpacity
                style={styles.nextButton}
                onPress={handleNext}
                disabled={loading}
              >
                <Text style={styles.nextButtonText}>Siguiente</Text>
                <Ionicons name="arrow-forward" size={20} color={Colors.white} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.submitButton}
                onPress={handleSubmit}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <>
                    <Text style={styles.submitButtonText}>
                      {isEditMode ? 'Actualizar Tienda' : 'Registrar Tienda'}
                    </Text>
                    <Ionicons name="checkmark" size={20} color={Colors.white} />
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        </>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  loadingText: {
    ...Typography.body,
    color: Colors.mediumGray,
    marginTop: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...Typography.h3,
  },
  headerSpacer: {
    width: 40,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.white,
  },
  progressStepContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressStep: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.lightGray,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressStepActive: {
    backgroundColor: Colors.primary,
  },
  progressStepCompleted: {
    backgroundColor: Colors.primary,
  },
  progressStepText: {
    ...Typography.bodySmall,
    color: Colors.white,
    fontWeight: '600',
  },
  progressStepTextActive: {
    color: Colors.white,
  },
  progressLine: {
    width: 40,
    height: 2,
    backgroundColor: Colors.lightGray,
    marginHorizontal: Spacing.xs,
  },
  progressLineCompleted: {
    backgroundColor: Colors.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.md,
  },
  stepContainer: {
    marginBottom: Spacing.xl,
  },
  stepTitle: {
    ...Typography.h2,
    marginBottom: Spacing.xs,
  },
  stepSubtitle: {
    ...Typography.bodySmall,
    color: Colors.mediumGray,
    marginBottom: Spacing.lg,
  },
  inputGroup: {
    marginBottom: Spacing.lg,
  },
  label: {
    ...Typography.body,
    fontWeight: '600',
    marginBottom: Spacing.sm,
  },
  required: {
    color: Colors.error,
  },
  input: {
    height: 56,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    backgroundColor: Colors.white,
    paddingHorizontal: Spacing.md,
    ...Typography.input,
  },
  inputError: {
    borderColor: Colors.error,
  },
  textArea: {
    minHeight: 100,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    backgroundColor: Colors.white,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    ...Typography.input,
    textAlignVertical: 'top',
  },
  charCounter: {
    ...Typography.caption,
    color: Colors.mediumGray,
    textAlign: 'right',
    marginTop: Spacing.xs,
  },
  errorText: {
    ...Typography.caption,
    color: Colors.error,
    marginTop: Spacing.xs,
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  locationButtonText: {
    ...Typography.body,
    color: Colors.primary,
    fontWeight: '600',
  },
  imagePickerButton: {
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    backgroundColor: Colors.white,
    overflow: 'hidden',
  },
  imagePickerContent: {
    padding: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePickerText: {
    ...Typography.body,
    color: Colors.mediumGray,
    marginTop: Spacing.sm,
  },
  logoPreview: {
    position: 'relative',
    width: '100%',
    aspectRatio: 1,
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  removeImageButton: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.full,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  photoPreview: {
    position: 'relative',
    width: '31%',
    aspectRatio: 1,
    borderRadius: BorderRadius.sm,
    overflow: 'hidden',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  footer: {
    padding: Spacing.md,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  nextButtonText: {
    ...Typography.button,
    color: Colors.white,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  submitButtonText: {
    ...Typography.button,
    color: Colors.white,
  },
});
