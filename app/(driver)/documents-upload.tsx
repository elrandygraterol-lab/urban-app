import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { driverAPI } from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import { Colors as COLORS } from '@/constants/theme';
import { compressImage } from '@/utils/imageUtils';
import { useUnifiedNotifications } from '@/context/UnifiedNotificationContext';
import { uploadDriverDocumentFile, getStorageProvider } from '@/services/fileUploader';
import { ActionSheet } from '@/components/ActionSheet';

type DocumentType =
  | 'drivers_license'
  | 'vehicle_registration'
  | 'insurance'
  | 'vehicle_photo_front'
  | 'vehicle_photo_back'
  | 'vehicle_photo_side';

interface DocumentUpload {
  type: DocumentType;
  label: string;
  uri?: string;
  fileName?: string;
  mimeType?: string;
  isUploading: boolean;
  isUploaded: boolean;
}

// Document types that accept PDFs and Word docs
const DOCUMENT_TYPES_ACCEPTING_FILES: DocumentType[] = [
  'drivers_license',
  'vehicle_registration',
  'insurance',
];

const REQUIRED_DOCUMENTS: DocumentUpload[] = [
  { type: 'drivers_license', label: 'Licencia de Conducir', isUploading: false, isUploaded: false },
  {
    type: 'vehicle_registration',
    label: 'Registro del Vehículo',
    isUploading: false,
    isUploaded: false,
  },
  { type: 'insurance', label: 'Póliza de Seguro', isUploading: false, isUploaded: false },
  {
    type: 'vehicle_photo_front',
    label: 'Foto Frontal del Vehículo',
    isUploading: false,
    isUploaded: false,
  },
  {
    type: 'vehicle_photo_back',
    label: 'Foto Trasera del Vehículo',
    isUploading: false,
    isUploaded: false,
  },
  {
    type: 'vehicle_photo_side',
    label: 'Foto Lateral del Vehículo',
    isUploading: false,
    isUploaded: false,
  },
];

export default function DocumentsUploadScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { showToast } = useUnifiedNotifications();
  const [documents, setDocuments] = useState<DocumentUpload[]>(REQUIRED_DOCUMENTS);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionSheet, setActionSheet] = useState<{
    visible: boolean;
    index: number;
    acceptsFiles: boolean;
  }>({ visible: false, index: -1, acceptsFiles: false });

  if (!user?.id) {
    return (
      <View style={styles.container}>
        <Text>Error: Usuario no autenticado</Text>
      </View>
    );
  }

  const pickDocument = (index: number) => {
    const doc = documents[index];
    const acceptsFiles = DOCUMENT_TYPES_ACCEPTING_FILES.includes(doc.type);

    setActionSheet({
      visible: true,
      index,
      acceptsFiles,
    });
  };

  const handleActionSheetPress = async (optionIndex: number) => {
    const { index, acceptsFiles } = actionSheet;
    if (index === -1) return;

    setActionSheet({ ...actionSheet, visible: false });

    const doc = documents[index];

    if (acceptsFiles) {
      if (optionIndex === 0) {
        // Tomar foto
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          showToast('Necesitamos permiso para acceder a la cámara', 'error');
          return;
        }
        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: 'images',
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.8,
        });
        if (!result.canceled && result.assets?.[0]) {
          const newDocuments = [...documents];
          newDocuments[index].uri = result.assets[0].uri;
          newDocuments[index].fileName = 'photo.jpg';
          newDocuments[index].mimeType = 'image/jpeg';
          setDocuments(newDocuments);
        }
      } else if (optionIndex === 1) {
        // Elegir imagen
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          showToast('Necesitamos permiso para acceder a tus archivos', 'error');
          return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: 'images',
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.8,
        });
        if (!result.canceled && result.assets?.[0]) {
          const newDocuments = [...documents];
          newDocuments[index].uri = result.assets[0].uri;
          newDocuments[index].fileName = 'photo.jpg';
          newDocuments[index].mimeType = 'image/jpeg';
          setDocuments(newDocuments);
        }
      } else if (optionIndex === 2) {
        // Seleccionar archivo (PDF, Word)
        try {
          const result = await DocumentPicker.getDocumentAsync({
            type: [
              'application/pdf',
              'application/msword',
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            ],
            copyToCacheDirectory: true,
          });

          if (!result.canceled && result.assets?.[0]) {
            const asset = result.assets[0];
            const newDocuments = [...documents];
            newDocuments[index].uri = asset.uri;
            newDocuments[index].fileName = asset.name;
            newDocuments[index].mimeType = asset.mimeType || 'application/pdf';
            setDocuments(newDocuments);
          }
        } catch (error) {
          console.error('Error picking document:', error);
          showToast('Error al seleccionar el archivo', 'error');
        }
      }
    } else {
      // Vehicle photos: only images
      try {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          showToast('Necesitamos permiso para acceder a tus archivos', 'error');
          return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: 'images',
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.8,
        });
        if (!result.canceled && result.assets?.[0]) {
          const newDocuments = [...documents];
          newDocuments[index].uri = result.assets[0].uri;
          newDocuments[index].fileName = 'photo.jpg';
          newDocuments[index].mimeType = 'image/jpeg';
          setDocuments(newDocuments);
        }
      } catch {
        showToast('Error al seleccionar la imagen', 'error');
      }
    }
  };

  const renderActionSheet = () => {
    if (!actionSheet.visible) return null;

    const { acceptsFiles } = actionSheet;
    const options = acceptsFiles
      ? [
          { text: 'Tomar foto', onPress: () => handleActionSheetPress(0) },
          { text: 'Elegir imagen', onPress: () => handleActionSheetPress(1) },
          { text: 'Seleccionar archivo (PDF, Word)', onPress: () => handleActionSheetPress(2) },
          { text: 'Cancelar', onPress: () => setActionSheet({ ...actionSheet, visible: false }), style: 'cancel' as const },
        ]
      : [
          { text: 'Elegir imagen', onPress: () => handleActionSheetPress(0) },
          { text: 'Cancelar', onPress: () => setActionSheet({ ...actionSheet, visible: false }), style: 'cancel' as const },
        ];

    return <ActionSheet visible={actionSheet.visible} options={options} onClose={() => setActionSheet({ ...actionSheet, visible: false })} title="Seleccionar origen" />;
  };

  const uploadDocument = async (index: number) => {
    const doc = documents[index];
    if (!doc.uri) {
      showToast('Por favor selecciona un archivo primero', 'error');
      return;
    }

    try {
      const newDocuments = [...documents];
      newDocuments[index].isUploading = true;
      setDocuments(newDocuments);

      // Check if file is an image (based on MIME type)
      const isImage = doc.mimeType?.startsWith('image/') ?? true;

      // Compress only if it's an image
      let uploadUri = doc.uri;
      if (isImage) {
        uploadUri = await compressImage(doc.uri, { type: 'photo' });
      }

      // Upload using fileUploader (handles Cloudinary or Local based on admin config)
      const uploadResult = await uploadDriverDocumentFile(uploadUri, user!.id, doc.type);

      // Send to backend with the URL (Cloudinary URL or local path)
      const formData = new FormData();
      formData.append('documentType', doc.type);
      formData.append('documentUrl', uploadResult.url);
      if (uploadResult.publicId) {
        formData.append('cloudinaryPublicId', uploadResult.publicId);
      }

      await driverAPI.uploadDocument(user!.id, doc.type, formData);

      const successDocs = [...documents];
      successDocs[index].isUploaded = true;
      setDocuments(successDocs);

      showToast(`${doc.label} subido correctamente`, 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'No se pudo subir el documento', 'error');
    } finally {
      setDocuments(prev => {
        if (prev[index]?.isUploading) {
          const updated = [...prev];
          updated[index] = { ...updated[index], isUploading: false };
          return updated;
        }
        return prev;
      });
    }
  };

  const allDocumentsUploaded = documents.every(doc => doc.isUploaded);

  const handleSubmit = async () => {
    if (!allDocumentsUploaded) {
      showToast('Por favor sube todos los documentos requeridos', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      // Navigate to verification status screen
      router.push('/(driver)/verification-status');
    } catch {
      showToast('No se pudo completar el registro', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.title}>Documentos de Verificación</Text>
        <Text style={styles.subtitle}>
          Sube todos los documentos requeridos para verificar tu cuenta
        </Text>
      </View>

      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${(documents.filter(d => d.isUploaded).length / documents.length) * 100}%`,
              },
            ]}
          />
        </View>
        <Text style={styles.progressText}>
          {documents.filter(d => d.isUploaded).length} de {documents.length} documentos
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
              doc.mimeType?.startsWith('image/') ? (
                <Image source={{ uri: doc.uri }} style={styles.documentPreview} />
              ) : (
                <View style={styles.filePreview}>
                  <Ionicons
                    name={doc.mimeType?.includes('pdf') ? 'document-text' : 'document'}
                    size={48}
                    color={COLORS.primary}
                  />
                  <Text style={styles.fileName} numberOfLines={1}>{doc.fileName || 'Documento'}</Text>
                </View>
              )
            )}

            <View style={styles.documentActions}>
              <TouchableOpacity
                style={styles.selectButton}
                onPress={() => pickDocument(index)}
                disabled={doc.isUploading}
              >
                <Text style={styles.selectButtonText}>
                  {doc.uri ? 'Cambiar Archivo' : 'Seleccionar Archivo'}
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
                  <Text style={styles.uploadButtonText}>{doc.isUploaded ? 'Subido' : 'Subir'}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[
            styles.submitButton,
            (!allDocumentsUploaded || isSubmitting) && styles.buttonDisabled,
          ]}
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
      {renderActionSheet()}
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
  filePreview: {
    width: '100%',
    height: 150,
    borderRadius: 12,
    marginBottom: 12,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fileName: {
    marginTop: 8,
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
    paddingHorizontal: 8,
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
