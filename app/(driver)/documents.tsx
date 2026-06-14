import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  Text,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '@/store/authStore';
import api from '@/services/api';
import { Colors as colors } from '@/constants/theme';
import { uploadDocumentToCloudinary } from '@/services/cloudinary';
import { useUnifiedNotifications } from '@/context/UnifiedNotificationContext';

interface Document {
  id: string;
  type: string;
  url: string;
  status: 'pending' | 'approved' | 'rejected';
  uploadedAt: string;
}

export default function DocumentsScreen() {
  const { user } = useAuthStore();
  const { showToast } = useUnifiedNotifications();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [reVerificationStatus, setReVerificationStatus] = useState<
    'pending' | 'approved' | 'rejected' | null
  >(null);

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/users/drivers/${user?.id}/documents`);
      setDocuments(response.data);

      // Check re-verification status
      const driverResponse = await api.get(`/api/users/drivers/${user?.id}`);
      setReVerificationStatus(driverResponse.data.verification_status);
    } catch (error) {
      showToast('Failed to load documents', 'error');
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async (documentType: string) => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled) {
        uploadDocument(result.assets[0].uri, documentType);
      }
    } catch (error) {
      showToast('Failed to pick image', 'error');
    }
  };

  const uploadDocument = async (uri: string, documentType: string) => {
    try {
      setUploading(true);

      // Upload to Cloudinary
      const cloudinaryResponse = await uploadDocumentToCloudinary(
        uri,
        documentType,
        user?.id || ''
      );

      // Send to backend with Cloudinary URL
      const formData = new FormData();
      formData.append('documentType', documentType);
      formData.append('documentUrl', cloudinaryResponse.secure_url);
      formData.append('cloudinaryPublicId', cloudinaryResponse.public_id);

      await api.post(`/api/users/drivers/${user?.id}/documents`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      showToast('Documento subido correctamente a Cloudinary', 'success');
      setReVerificationStatus('pending');
      fetchDocuments();
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : 'No se pudo subir el documento',
        'error'
      );
    } finally {
      setUploading(false);
    }
  };

  const documentTypes = [
    { id: 'drivers_license', label: "Driver's License" },
    { id: 'vehicle_registration', label: 'Vehicle Registration' },
    { id: 'insurance', label: 'Insurance Certificate' },
    { id: 'vehicle_photo_front', label: 'Vehicle Front Photo' },
    { id: 'vehicle_photo_back', label: 'Vehicle Back Photo' },
    { id: 'vehicle_photo_side', label: 'Vehicle Side Photo' },
  ];

  if (loading) {
    return (
      <View
        style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#fff' }}>
      <View style={{ padding: 16 }}>
        <Text style={{ fontSize: 24, fontWeight: 'bold', color: colors.darkGray, marginBottom: 8 }}>
          Verification Documents
        </Text>

        {reVerificationStatus === 'pending' && (
          <View
            style={{ backgroundColor: '#FFF3CD', padding: 12, borderRadius: 8, marginBottom: 16 }}
          >
            <Text style={{ color: '#856404', fontSize: 14 }}>
              Your documents are pending re-verification. You can continue accepting rides while we
              review them.
            </Text>
          </View>
        )}

        {reVerificationStatus === 'rejected' && (
          <View
            style={{ backgroundColor: '#F8D7DA', padding: 12, borderRadius: 8, marginBottom: 16 }}
          >
            <Text style={{ color: '#721C24', fontSize: 14 }}>
              Some documents were rejected. Please upload updated versions.
            </Text>
          </View>
        )}

        <Text style={{ fontSize: 16, fontWeight: '600', color: colors.darkGray, marginBottom: 12 }}>
          Current Documents
        </Text>

        {documents.length === 0 ? (
          <Text style={{ color: colors.lightGray, marginBottom: 16 }}>
            No documents uploaded yet
          </Text>
        ) : (
          documents.map(doc => (
            <View
              key={doc.id}
              style={{ marginBottom: 12, padding: 12, backgroundColor: '#F5F5F5', borderRadius: 8 }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '600', color: colors.darkGray }}>
                    {documentTypes.find(d => d.id === doc.type)?.label}
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.lightGray, marginTop: 4 }}>
                    Uploaded: {new Date(doc.uploadedAt).toLocaleDateString()}
                  </Text>
                </View>
                <View
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                    borderRadius: 4,
                    backgroundColor:
                      doc.status === 'approved'
                        ? '#D4EDDA'
                        : doc.status === 'rejected'
                          ? '#F8D7DA'
                          : '#E2E3E5',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: '600',
                      color:
                        doc.status === 'approved'
                          ? '#155724'
                          : doc.status === 'rejected'
                            ? '#721C24'
                            : '#383D41',
                    }}
                  >
                    {doc.status.charAt(0).toUpperCase() + doc.status.slice(1)}
                  </Text>
                </View>
              </View>
              {doc.url && (
                <Image
                  source={{ uri: doc.url }}
                  style={{ width: '100%', height: 150, borderRadius: 8, marginTop: 8 }}
                />
              )}
            </View>
          ))
        )}

        <Text
          style={{
            fontSize: 16,
            fontWeight: '600',
            color: colors.darkGray,
            marginBottom: 12,
            marginTop: 16,
          }}
        >
          Upload Updated Documents
        </Text>

        {documentTypes.map(docType => (
          <TouchableOpacity
            key={docType.id}
            onPress={() => pickImage(docType.id)}
            disabled={uploading}
            style={{
              padding: 12,
              marginBottom: 8,
              borderRadius: 8,
              borderWidth: 2,
              borderColor: colors.primary,
              backgroundColor: uploading ? '#F5F5F5' : '#fff',
            }}
          >
            <Text style={{ color: colors.primary, fontWeight: '600', textAlign: 'center' }}>
              {uploading ? 'Uploading...' : `Upload ${docType.label}`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}
