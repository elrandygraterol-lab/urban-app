/**
 * Cloudinary Service
 * Handles document uploads to Cloudinary for driver verification
 */

const CLOUDINARY_CLOUD_NAME = 'dchkq5aa9';
const CLOUDINARY_UPLOAD_PRESET = 'urbantaxi_documents'; // You need to create this in Cloudinary dashboard

interface CloudinaryUploadResponse {
  public_id: string;
  secure_url: string;
  url: string;
  width: number;
  height: number;
  format: string;
  resource_type: string;
  created_at: string;
  bytes: number;
}

/**
 * Upload a document to Cloudinary
 * @param uri - Local file URI from image picker
 * @param documentType - Type of document (drivers_license, vehicle_registration, etc.)
 * @param driverId - Driver ID for folder organization
 * @returns Promise with Cloudinary response
 */
export const uploadDocumentToCloudinary = async (
  uri: string,
  documentType: string,
  driverId: string
): Promise<CloudinaryUploadResponse> => {
  try {
    const formData = new FormData();

    // Convert URI to blob
    const response = await fetch(uri);
    const blob = await response.blob();

    // Determine file extension from URI or default to jpg
    const uriParts = uri.split('.');
    const ext = uriParts.length > 1 ? uriParts[uriParts.length - 1].split('?')[0] : 'jpg';

    // Append file to form data
    formData.append('file', blob, `${documentType}_${Date.now()}.${ext}`);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    formData.append('folder', `urbantaxi/drivers/${driverId}`);
    formData.append('public_id', `${documentType}_${Date.now()}`);
    formData.append('resource_type', 'auto');
    formData.append('quality', 'auto');
    formData.append('fetch_format', 'auto');

    // Upload to Cloudinary using 'auto' resource type (works for images, PDFs, Word docs)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    let uploadResponse: Response;
    try {
      uploadResponse = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`,
        {
          method: 'POST',
          body: formData,
          signal: controller.signal,
        }
      );
    } finally {
      clearTimeout(timeoutId);
    }

    if (!uploadResponse.ok) {
      const error = await uploadResponse.json();
      throw new Error(error.error?.message || 'Failed to upload to Cloudinary');
    }

    const data: CloudinaryUploadResponse = await uploadResponse.json();
    return data;
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    throw error;
  }
};

/**
 * Delete a document from Cloudinary
 * Note: This requires backend API call since we can't use API secret from frontend
 * @param publicId - Cloudinary public ID of the file
 */
export const deleteDocumentFromCloudinary = async (publicId: string): Promise<void> => {
  try {
    // This should be called via backend API endpoint
    // Frontend cannot delete files directly without exposing API secret
    console.warn('Document deletion should be handled by backend API');
  } catch (error) {
    console.error('Error deleting document:', error);
    throw error;
  }
};

/**
 * Get optimized Cloudinary URL for an image
 * @param publicId - Cloudinary public ID
 * @param options - Transformation options
 * @returns Optimized Cloudinary URL
 */
export const getOptimizedCloudinaryUrl = (
  publicId: string,
  options?: {
    width?: number;
    height?: number;
    quality?: string;
    format?: string;
  }
): string => {
  const baseUrl = `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload`;

  // Build transformation string
  const transformations: string[] = [];

  if (options?.width) transformations.push(`w_${options.width}`);
  if (options?.height) transformations.push(`h_${options.height}`);
  if (options?.quality) transformations.push(`q_${options.quality}`);
  if (options?.format) transformations.push(`f_${options.format}`);

  // Add auto quality and format optimization
  transformations.push('q_auto', 'f_auto');

  const transformationString = transformations.join(',');

  return `${baseUrl}/${transformationString}/${publicId}`;
};

/**
 * Extract public ID from Cloudinary URL
 * @param url - Cloudinary URL
 * @returns Public ID
 */
export const extractPublicIdFromUrl = (url: string): string => {
  try {
    // URL format: https://res.cloudinary.com/cloud_name/image/upload/v123/public_id
    const parts = url.split('/');
    const publicIdWithVersion = parts[parts.length - 1];
    // Remove file extension if present
    return publicIdWithVersion.split('.')[0];
  } catch (error) {
    console.error('Error extracting public ID:', error);
    return '';
  }
};
