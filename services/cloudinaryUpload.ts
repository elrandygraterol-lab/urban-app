/**
 * Cloudinary Upload Service
 * Handles file uploads to Cloudinary with Sharp pre-optimization for images
 */

import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';

const CLOUDINARY_CLOUD_NAME = 'z7ivfy64';
const CLOUDINARY_UPLOAD_PRESET = 'urbantaxi_documents';

export interface CloudinaryUploadResponse {
  public_id: string;
  secure_url: string;
  url: string;
  width?: number;
  height?: number;
  format: string;
  resource_type: string;
  bytes: number;
}

/**
 * Check if a file is an image based on MIME type
 */
function isImageFile(mimeType?: string): boolean {
  return mimeType?.startsWith('image/') ?? false;
}

/**
 * Compress and resize an image before upload
 */
async function compressImage(uri: string): Promise<string> {
  try {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1200, height: 1200 } }],
      {
        compress: 0.8,
        format: ImageManipulator.SaveFormat.JPEG,
      }
    );
    return result.uri;
  } catch (error) {
    console.warn('Image compression failed, using original:', error);
    return uri;
  }
}

/**
 * Upload a file to Cloudinary
 * Images are compressed with Sharp-like optimization before upload
 * PDFs and Word docs are uploaded as raw files
 */
export async function uploadToCloudinary(
  uri: string,
  folder: string,
  options?: {
    publicId?: string;
    resourceType?: 'image' | 'raw' | 'auto';
  }
): Promise<CloudinaryUploadResponse> {
  // Get file info to determine type
  const fileInfo = await FileSystem.getInfoAsync(uri);
  const fileMimeType = (fileInfo as any).mimeType;
  const isImage = isImageFile(fileMimeType);

  // Compress images before upload
  let uploadUri = uri;
  if (isImage) {
    uploadUri = await compressImage(uri);
  }

  // Determine file extension
  const uriParts = uri.split('.');
  const ext = uriParts.pop()?.toLowerCase() || 'jpg';
  const fileName = `${options?.publicId || `${folder.replace(/\//g, '_')}_${Date.now()}`}.${ext}`;
  const mimeType = isImage ? 'image/jpeg' : 'application/octet-stream';

  // Build FormData using React Native file object (more reliable than fetch+blob)
  const formData = new FormData();
  formData.append('file', { uri: uploadUri, type: mimeType, name: fileName } as any);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
  formData.append('folder', folder);

  if (options?.publicId) {
    formData.append('public_id', options.publicId);
  }

  // Set resource type
  const resourceType = options?.resourceType || (isImage ? 'image' : 'raw');
  formData.append('resource_type', resourceType);

  // Add image optimizations
  if (isImage) {
    formData.append('quality', 'auto');
    formData.append('fetch_format', 'auto');
  }

  // Upload to Cloudinary
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);

  try {
    const uploadResponse = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`,
      {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      }
    );

    if (!uploadResponse.ok) {
      const error = await uploadResponse.json();
      throw new Error(error.error?.message || 'Failed to upload to Cloudinary');
    }

    const data: CloudinaryUploadResponse = await uploadResponse.json();
    return data;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Upload a profile image to Cloudinary (optimized for profiles)
 */
export async function uploadProfileImage(
  uri: string,
  userId: string
): Promise<CloudinaryUploadResponse> {
  // Compress to 300x300 for profile images
  try {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 300, height: 300 } }],
      {
        compress: 0.8,
        format: ImageManipulator.SaveFormat.JPEG,
      }
    );
    uri = result.uri;
  } catch (error) {
    console.warn('Profile image compression failed:', error);
  }

  return uploadToCloudinary(uri, 'urbantaxi/profiles', {
    publicId: `profile_${userId}`,
    resourceType: 'image',
  });
}

/**
 * Upload a document (image, PDF, or Word) to Cloudinary
 */
export async function uploadDocument(
  uri: string,
  driverId: string,
  documentType: string
): Promise<CloudinaryUploadResponse> {
  return uploadToCloudinary(uri, `urbantaxi/drivers/${driverId}/documents`, {
    publicId: `${documentType}_${Date.now()}`,
    resourceType: 'auto',
  });
}
