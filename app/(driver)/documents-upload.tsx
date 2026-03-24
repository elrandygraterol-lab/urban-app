import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { driverAPI } from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import { Colors as COLORS } from '@/constants/theme';
import { uploadDocumentToCloudinary } from '@/services/cloudinary';

type DocumentType = 'drivers_license' | 'vehicle_registration' | 'insurance' | 'vehicle_photo_front' | 'vehicle_photo_back' | 'vehicle_photo_side';

interface DocumentUpload {
  type: DocumentType;
  label: string;
  uri?: string;
  isUploading: boolean;
  isUploaded: boolean;
}

const REQUIRED_DOCUMENTS: DocumentUpload[] = [
  { type: 'drivers_license', label: 'Licencia de Conducir', isUploading: false, isUploaded: false },
  { type: 'vehicle_registration', label: 'Registro del Vehículo', isUploading: false, isUploaded: false },
  { type: 'insurance', label: 'Póliza de Seguro', isUploading: false, isUploaded: false },
  { type: 'vehicle_photo_front', label: 'Foto Frontal del Vehículo', isUploading: false, isUploaded: false },
  { type: 'vehicle_photo_back', label: 'Foto Trasera del Vehículo', isUploading: false, isUploaded: false },
  { type: 'vehicle_photo_side', label: 'Foto Lateral del Vehículo', isUploading: false, isUploaded: false },
];

export default function DocumentsUploadScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [documents, setDocuments] = useState<DocumentUpload[]>(REQUIRED_DOCUMENTS);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!user?.id) {
    return (
      <View style={styles.container}>
        <Text>Error: Usuario no autenticado</Text>
      </View>
    );
  }

  const pickImage = async (index: number) => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled) {
        const newDocuments = [...documents];
        newDocuments[index].uri = result.assets[0].uri;
        setDocuments(newDocuments);
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudo seleccionar la imagen');
    }
  };

  const uploadDocument = async (index: number) => {
    const doc = documents[index];
    if (!doc.uri) {
      Alert.alert('Error', 'Por favor selecciona una imagen primero');
      return;
    }

    try {
      const newDocuments = [...documents];
      newDocuments[index].isUploading = true;
      setDocuments(newDocuments);

      // Upload to Cloudinary
      const cloudinaryResponse = await uploadDocumentToCloudinary(
        doc.uri,
        doc.type,
        user!.id
      );

      // Send to backend with Cloudinary URL
      const formData = new FormData();
      formData.append('documentType', doc.type);
      formData.append('documentUrl', cloudinaryResponse.secure_url);
      formData.append('cloudinaryPublicId', cloudinaryResponse.public_id);

      await driverAPI.uploadDocument(user!.id, doc.type, formData);

      newDocuments[index].isUploading = false;
      newDocuments[index].isUploaded = true;
      setDocuments(newDocuments);

      Alert.alert('Éxito', `${doc.label} subido correctamente a Cloudinary`);
    } catch (error) {
      const newDocuments = [...documents];
      newDocuments[index].isUploading = false;
      setDocuments(newDocuments);
      Alert.alert('Error', error instanceof Error ? error.message : 'No se pudo subir el documento');
    }
  };

  const allDocumentsUploaded = documents.every((doc) => doc.isUploaded);

  const handleSubmit = async () => {
    if (!allDocumentsUploaded) {
      Alert.alert('Error', 'Por favor sube todos los documentos requeridos');
      return;
    }

    setIsSubmitting(true);
    try {
      // Navigate to verification status screen
      router.push('/(driver)/verification-status');
    } catch (error) {
      Alert.alert('Error', 'No se pudo completar el registro');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.title}>Documentos de Verificación</Text>
        <Text style={styles.subtitle}>Sube todos los documentos requeridos para verificar tu cuenta</Text>
      </View>

      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: `${(documents.filter((d) => d.isUploaded).length / documents.length) * 100}%` },
            ]}
          />
        </View>
        <Text style={styles.progressText}>
          {documents.filter((d) => d.isUploaded).length} de {documents.length} documentos
        </Text>
      </View>

      <View style={styles.documentsContainer}>
        {documents.map((doc, index) => (
          <View key={doc.type} style={styles.documentCard}>
            <View style={styles.documentHeader}>
              <Text style={styles.documentLabel}>{doc.label}</Text>
              {doc.isUploaded && <Text style={styles.uploadedBadge}>✓ Subido</Text>}
            </View>

            {doc.uri && (
              <Image source={{ uri: doc.uri }} style={styles.documentPreview} />
            )}

            <View style={styles.documentActions}>
              <TouchableOpacity
                style={styles.selectButton}
                onPress={() => pickImage(index)}
                disabled={doc.isUploading}
              >
                <Text style={styles.selectButtonText}>
                  {doc.uri ? 'Cambiar Imagen' : 'Seleccionar Imagen'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.uploadButton, doc.isUploading && styles.buttonDisabled]}
                onPress={() => uploadDocument(index)}
                disabled={!doc.uri || doc.isUploading || doc.isUploaded}
              >
                {doc.isUploading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.uploadButtonText}>
                    {doc.isUploaded ? 'Subido' : 'Subir'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.submitButton, (!allDocumentsUploaded || isSubmitting) && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={!allDocumentsUploaded || isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitButtonText}>Completar Registro</Text>
          )}
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
    marginBottom: 24,
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
  progressContainer: {
    marginBottom: 24,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
  },
  progressText: {
    fontSize: 12,
    color: COLORS.lightGray,
  },
  documentsContainer: {
    marginBottom: 24,
    gap: 16,
  },
  documentCard: {
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 16,
    padding: 16,
    backgroundColor: '#f9f9f9',
  },
  documentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  documentLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.darkGray,
  },
  uploadedBadge: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '600',
  },
  documentPreview: {
    width: '100%',
    height: 150,
    borderRadius: 12,
    marginBottom: 12,
  },
  documentActions: {
    flexDirection: 'row',
    gap: 12,
  },
  selectButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  selectButtonText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  uploadButton: {
    flex: 1,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonContainer: {
    marginBottom: 40,
  },
  submitButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 24,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
