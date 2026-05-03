import api from './api';
import type {
  Store,
  StoreCategory,
  StoreReview,
  StoreStatistics,
  CreateStoreRequest,
  UpdateStoreRequest,
  GetStoresParams,
  GetStoresResponse,
  CreateReviewRequest,
  UpdateReviewRequest,
  GetReviewsParams,
  GetReviewsResponse,
  TrackEventRequest,
  GetStatsParams,
} from '@/types/store';

/**
 * Store API Client
 * 
 * Extends the existing Axios client with store management endpoints
 * Uses existing auth token from Zustand store via api interceptors
 */

// ============================================================================
// Store CRUD Methods
// ============================================================================

/**
 * Create a new store
 * Requires "owner" role
 */
export const createStore = (data: CreateStoreRequest) => 
  api.post<{ store_id: number; status: string; created_at: string; message: string }>('/api/stores', data);

/**
 * Get stores with filtering and pagination
 * Available to all authenticated users
 */
export const getStores = (params?: GetStoresParams) => 
  api.get<GetStoresResponse>('/api/stores', { params });

/**
 * Get a specific store by ID
 * Available to all authenticated users
 */
export const getStoreById = (storeId: number) => 
  api.get<Store>(`/api/stores/${storeId}`);

/**
 * Get stores owned by the current user
 * Requires "owner" role
 */
export const getMyStores = () => 
  api.get<{ stores: Store[] }>('/api/stores/my-stores');

/**
 * Update a store
 * Must be owner of the store or admin
 */
export const updateStore = (storeId: number, data: UpdateStoreRequest) => 
  api.put<{ message: string; store: Store }>(`/api/stores/${storeId}`, data);

/**
 * Delete a store
 * Must be owner of the store or admin
 */
export const deleteStore = (storeId: number) => 
  api.delete<{ message: string }>(`/api/stores/${storeId}`);

/**
 * Update store status (admin only)
 * Used for approving/rejecting stores
 */
export const updateStoreStatus = (
  storeId: number, 
  status: 'activa' | 'rechazada' | 'inactiva',
  rejection_reason?: string
) => 
  api.put<{ message: string; store: Store }>(`/api/stores/${storeId}/status`, { 
    status, 
    rejection_reason 
  });

// ============================================================================
// Category Methods
// ============================================================================

/**
 * Get all store categories
 * Available to all authenticated users
 */
export const getCategories = () => 
  api.get<{ categories: StoreCategory[] }>('/api/categories');

/**
 * Create a new category (admin only)
 */
export const createCategory = (data: { name: string; description: string; icon_url?: string }) => 
  api.post<StoreCategory>('/api/categories', data);

// ============================================================================
// Review Methods
// ============================================================================

/**
 * Create a review for a store
 * One review per user per store
 */
export const createReview = (storeId: number, data: CreateReviewRequest) => 
  api.post<StoreReview>(`/api/stores/${storeId}/reviews`, data);

/**
 * Get reviews for a store
 */
export const getReviews = (storeId: number, params?: GetReviewsParams) => 
  api.get<GetReviewsResponse>(`/api/stores/${storeId}/reviews`, { params });

/**
 * Update a review
 * Must be the author of the review
 */
export const updateReview = (reviewId: number, data: UpdateReviewRequest) => 
  api.put<{ message: string; review: StoreReview }>(`/api/reviews/${reviewId}`, data);

/**
 * Delete a review
 * Must be the author of the review or admin
 */
export const deleteReview = (reviewId: number) => 
  api.delete<{ message: string }>(`/api/reviews/${reviewId}`);

// ============================================================================
// Statistics Methods
// ============================================================================

/**
 * Track an event (view, call, directions)
 * Available to all authenticated users
 */
export const trackEvent = (storeId: number, data: TrackEventRequest) => 
  api.post<{ message: string }>(`/api/stores/${storeId}/track`, data);

/**
 * Get store statistics
 * Must be owner of the store or admin
 */
export const getStats = (storeId: number, params?: GetStatsParams) => 
  api.get<StoreStatistics>(`/api/stores/${storeId}/stats`, { params });

// ============================================================================
// Image Upload Methods
// ============================================================================

/**
 * Upload an image for a store
 * Must be owner of the store or admin
 */
export const uploadImage = (
  storeId: number,
  image: { uri: string; name: string; type: string },
  imageType: 'logo' | 'photo' | 'menu',
  displayOrder?: number
) => {
  const formData = new FormData();
  
  // Create file object for React Native
  const file = {
    uri: image.uri,
    name: image.name,
    type: image.type,
  } as any;
  
  formData.append('image', file);
  formData.append('image_type', imageType);
  if (displayOrder !== undefined) {
    formData.append('display_order', displayOrder.toString());
  }
  
  return api.post<{
    image_id: number;
    image_url: string;
    image_type: string;
    display_order: number;
  }>(`/api/stores/${storeId}/images`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
};

/**
 * Delete an image from a store
 * Must be owner of the store or admin
 */
export const deleteImage = (storeId: number, imageId: number) => 
  api.delete<{ message: string }>(`/api/stores/${storeId}/images/${imageId}`);

// ============================================================================
// Export all methods as a single object (alternative usage pattern)
// ============================================================================

export const storeAPI = {
  // Store CRUD
  createStore,
  getStores,
  getStoreById,
  getMyStores,
  updateStore,
  deleteStore,
  updateStoreStatus,
  
  // Categories
  getCategories,
  createCategory,
  
  // Reviews
  createReview,
  getReviews,
  updateReview,
  deleteReview,
  
  // Statistics
  trackEvent,
  getStats,
  
  // Images
  uploadImage,
  deleteImage,
};

export default storeAPI;
