/**
 * File Uploader Service
 * Decides where to upload files based on admin configuration (Cloudinary vs Local)
 */

import api from './api/client';
import { uploadToCloudinary, uploadProfileImage, uploadDocument, CloudinaryUploadResponse } from './cloudinaryUpload';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

let cachedStorageProvider: string | null = null;
let cacheExpiry = 0;
const CACHE_TTL = 60 * 1000; // 1 minute (shorter TTL for faster config propagation)

/**
 * Get the storage provider from the backend
 */
export async function getStorageProvider(): Promise<string> {
  if (cachedStorageProvider && Date.now() < cacheExpiry) {
    return cachedStorageProvider;
  }

  try {
    const response = await api.get('/api/auth/storage-config');
    const provider = response.data?.data?.storageProvider || 'local';
    cachedStorageProvider = provider;
    cacheExpiry = Date.now() + CACHE_TTL;
    return provider;
  } catch (error) {
    console.warn('Failed to get storage config, defaulting to local:', error);
    return 'local';
  }
}

/**
 * Upload result - consistent format regardless of provider
 */
export interface FileUploadResult {
  url: string;
  publicId?: string;
  provider: 'cloudinary' | 'local';
}

/**
 * Upload a profile image
 * @param uri - Local file URI
 * @param userId - User ID for folder organization
 * @returns Upload result with URL
 */
export async function uploadProfilePhoto(
  uri: string,
  userId: string
): Promise<FileUploadResult> {
  const provider = await getStorageProvider();

  if (provider === 'cloudinary') {
    const result = await uploadProfileImage(uri, userId);
    return {
      url: result.secure_url,
      publicId: result.public_id,
      provider: 'cloudinary',
    };
  }

  // Local mode: upload via backend (multipart/form-data)
  const formData = new FormData();
  const fileName = uri.split('/').pop() || 'photo.jpg';
  const photoFile = {
    uri,
    name: fileName,
    type: 'image/jpeg',
  } as any;
  formData.append('photo', photoFile);

  const response = await fetch(`${API_URL}/api/users/me/photo`, {
    method: 'POST',
    body: formData,
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to upload profile photo');
  }

  const data = await response.json();
  return {
    url: data.data?.url || data.url,
    provider: 'local',
  };
}

/**
 * Upload a driver document (license, medical certificate, etc.)
 * Supports images, PDFs, and Word documents
 * @param uri - Local file URI
 * @param driverId - Driver ID for folder organization
 * @param documentType - Type of document
 * @returns Upload result with URL
 */
export async function uploadDriverDocumentFile(
  uri: string,
  driverId: string,
  documentType: string
): Promise<FileUploadResult> {
  const provider = await getStorageProvider();

  if (provider === 'cloudinary') {
    const result = await uploadDocument(uri, driverId, documentType);
    return {
      url: result.secure_url,
      publicId: result.public_id,
      provider: 'cloudinary',
    };
  }

  // Local mode: upload via backend
  const formData = new FormData();
  const fileName = uri.split('/').pop() || 'document';
  const fileInfo = await import('expo-file-system/legacy').then(fs =>
    fs.getInfoAsync(uri)
  );
  const mimeType = (fileInfo as any).mimeType || 'application/octet-stream';

  const docFile = {
    uri,
    name: fileName,
    type: mimeType,
  } as any;
  formData.append('document', docFile);
  formData.append('documentType', documentType);

  const response = await fetch(`${API_URL}/api/uploads/driver-document`, {
    method: 'POST',
    body: formData,
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to upload driver document');
  }

  const data = await response.json();
  return {
    url: data.data?.url || data.url,
    provider: 'local',
  };
}

/**
 * Invalidate the cached storage provider
 */
export function invalidateStorageCache(): void {
  cachedStorageProvider = null;
  cacheExpiry = 0;
}
