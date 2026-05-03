import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';

/**
 * Image compression and optimization utilities
 * Implements requirement 21.6: Lazy loading and image optimization
 */

// Maximum dimensions for different image types
const MAX_DIMENSIONS = {
  logo: { width: 400, height: 400 },
  photo: { width: 1200, height: 1200 },
  thumbnail: { width: 300, height: 300 },
};

// Compression quality settings
const COMPRESSION_QUALITY = {
  high: 0.9,
  medium: 0.8,
  low: 0.6,
};

export interface CompressImageOptions {
  type?: 'logo' | 'photo' | 'thumbnail';
  quality?: 'high' | 'medium' | 'low';
  maxWidth?: number;
  maxHeight?: number;
}

/**
 * Compress and resize an image before upload
 * @param uri - The local URI of the image
 * @param options - Compression options
 * @returns The URI of the compressed image
 */
export async function compressImage(
  uri: string,
  options: CompressImageOptions = {}
): Promise<string> {
  try {
    const {
      type = 'photo',
      quality = 'medium',
      maxWidth,
      maxHeight,
    } = options;

    // Get image dimensions
    const imageInfo = await FileSystem.getInfoAsync(uri);
    if (!imageInfo.exists) {
      throw new Error('Image file does not exist');
    }

    // Determine target dimensions
    const targetDimensions = MAX_DIMENSIONS[type];
    const targetWidth = maxWidth || targetDimensions.width;
    const targetHeight = maxHeight || targetDimensions.height;

    // Compress and resize the image
    const manipulatedImage = await ImageManipulator.manipulateAsync(
      uri,
      [
        {
          resize: {
            width: targetWidth,
            height: targetHeight,
          },
        },
      ],
      {
        compress: COMPRESSION_QUALITY[quality],
        format: ImageManipulator.SaveFormat.JPEG,
      }
    );

    console.log(`[ImageUtils] Compressed image from ${uri} to ${manipulatedImage.uri}`);
    console.log(`[ImageUtils] Target dimensions: ${targetWidth}x${targetHeight}, Quality: ${quality}`);

    return manipulatedImage.uri;
  } catch (error) {
    console.error('[ImageUtils] Error compressing image:', error);
    // Return original URI if compression fails
    return uri;
  }
}

/**
 * Get the file size of an image in bytes
 * @param uri - The local URI of the image
 * @returns The file size in bytes
 */
export async function getImageSize(uri: string): Promise<number> {
  try {
    const imageInfo = await FileSystem.getInfoAsync(uri);
    if (imageInfo.exists && 'size' in imageInfo) {
      return imageInfo.size;
    }
    return 0;
  } catch (error) {
    console.error('[ImageUtils] Error getting image size:', error);
    return 0;
  }
}

/**
 * Format file size for display
 * @param bytes - File size in bytes
 * @returns Formatted file size string
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Validate image file size (max 5MB)
 * @param uri - The local URI of the image
 * @returns True if valid, false otherwise
 */
export async function validateImageSize(uri: string): Promise<boolean> {
  const MAX_SIZE = 5 * 1024 * 1024; // 5MB
  const size = await getImageSize(uri);
  return size <= MAX_SIZE;
}

/**
 * Generate appropriate image sizes for different use cases
 * This helps with requesting appropriate image sizes from backend
 */
export function getImageSizeParam(context: 'list' | 'detail' | 'fullscreen'): string {
  switch (context) {
    case 'list':
      return 'w=200&h=200'; // Small thumbnails for lists
    case 'detail':
      return 'w=800&h=800'; // Medium size for detail views
    case 'fullscreen':
      return 'w=1200&h=1200'; // Large size for fullscreen
    default:
      return 'w=800&h=800';
  }
}

/**
 * Append size parameters to image URL if it's from a CDN that supports it
 * @param url - The original image URL
 * @param context - The context where the image will be displayed
 * @returns URL with size parameters if applicable
 */
export function getOptimizedImageUrl(
  url: string,
  context: 'list' | 'detail' | 'fullscreen' = 'detail'
): string {
  if (!url) return url;

  // Check if URL is from Cloudinary (common CDN)
  if (url.includes('cloudinary.com')) {
    // Cloudinary supports transformation parameters
    // Example: https://res.cloudinary.com/demo/image/upload/w_200,h_200,c_fill/sample.jpg
    const sizeParam = getImageSizeParam(context);
    const [width, height] = sizeParam.split('&').map(p => p.split('=')[1]);
    
    // Insert transformation parameters before the image path
    const parts = url.split('/upload/');
    if (parts.length === 2) {
      return `${parts[0]}/upload/w_${width},h_${height},c_fill,q_auto,f_auto/${parts[1]}`;
    }
  }

  // For other CDNs or direct URLs, return as-is
  // In production, you might want to add support for other CDNs
  return url;
}

/**
 * Generate a blurhash placeholder for better loading experience
 * Note: This is a placeholder function. In production, blurhash should be
 * generated on the backend and stored with the image metadata
 */
export function getDefaultBlurhash(): string {
  // Default blurhash for a neutral gray image
  return 'L6PZfSi_.AyE_3t7t7R**0o#DgR4';
}
