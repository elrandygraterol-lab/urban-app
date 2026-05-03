/**
 * Store Type Definitions
 * 
 * This file contains TypeScript type definitions for the store management system
 * Types match the backend Prisma models
 */

// ============================================================================
// Enums
// ============================================================================

export type StoreStatus = 'activa' | 'inactiva' | 'pendiente de aprobación' | 'rechazada';

export type ImageType = 'logo' | 'photo';

export type EventType = 'view' | 'call' | 'directions';

// ============================================================================
// Business Hours
// ============================================================================

export interface DayHours {
  open: string | null;  // Format: "HH:MM" (24-hour)
  close: string | null; // Format: "HH:MM" (24-hour)
  closed: boolean;
}

export interface BusinessHours {
  monday: DayHours;
  tuesday: DayHours;
  wednesday: DayHours;
  thursday: DayHours;
  friday: DayHours;
  saturday: DayHours;
  sunday: DayHours;
}

// ============================================================================
// Store Category
// ============================================================================

export interface StoreCategory {
  category_id: number;
  name: string;
  description: string;
  icon_url?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Store Image
// ============================================================================

export interface StoreImage {
  image_id: number;
  store_id: number;
  image_url: string;
  image_type: ImageType;
  display_order: number;
  uploaded_at: string;
}

// ============================================================================
// Store Review
// ============================================================================

export interface StoreReview {
  review_id: number;
  store_id: number;
  user_id: number;
  user_name?: string;  // Populated from user data
  rating: number;      // 1-5
  comment?: string;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Store Statistics
// ============================================================================

export interface StoreStatistics {
  total_views: number;
  total_calls: number;
  total_directions: number;
  days_since_registration: number;
  daily_views: {
    date: string;
    views: number;
  }[];
}

// ============================================================================
// Store
// ============================================================================

export interface Store {
  store_id: number;
  owner_id: number;
  owner_name?: string;  // Populated from owner profile
  name: string;
  address: string;
  phone: string;
  category_id: number;
  category?: StoreCategory;  // Populated category data
  description: string;
  status: StoreStatus;
  email?: string;
  website?: string;
  business_hours?: BusinessHours;
  latitude?: number;
  longitude?: number;
  logo_url?: string;
  images?: StoreImage[];  // Populated images
  average_rating: number;
  review_count: number;
  rejection_reason?: string;
  rejection_date?: string;
  deleted_at?: string;
  created_at: string;
  updated_at: string;
  
  // Computed fields (not in database)
  distance?: number;  // Distance from user in km
  is_open?: boolean;  // Current open/closed status
}

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface CreateStoreRequest {
  name: string;
  address: string;
  phone: string;
  category_id: number;
  description: string;
  email?: string;
  website?: string;
  business_hours?: BusinessHours;
  latitude?: number;
  longitude?: number;
}

export interface UpdateStoreRequest extends Partial<CreateStoreRequest> {}

export interface GetStoresParams {
  page?: number;
  limit?: number;
  category_id?: number;
  status?: StoreStatus;
  lat?: number;
  lng?: number;
  radius?: number;  // In km
  search?: string;
  sort?: 'distance' | 'name' | 'rating' | 'newest';
  min_rating?: number;
  open_now?: boolean;
}

export interface GetStoresResponse {
  stores: Store[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

export interface CreateReviewRequest {
  rating: number;  // 1-5
  comment?: string;
}

export interface UpdateReviewRequest extends Partial<CreateReviewRequest> {}

export interface GetReviewsParams {
  page?: number;
  limit?: number;
}

export interface GetReviewsResponse {
  reviews: StoreReview[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

export interface TrackEventRequest {
  event_type: EventType;
}

export interface GetStatsParams {
  period?: '7d' | '30d';
}

export interface UploadImageRequest {
  image: File | { uri: string; name: string; type: string };
  image_type: ImageType;
  display_order?: number;
}

// ============================================================================
// Store Filters (for UI state)
// ============================================================================

export interface StoreFilters {
  categories: number[];
  distanceRange?: number;  // Max distance in km
  ratingRange?: number;    // Min rating
  openNow?: boolean;
  search?: string;
  sort?: 'distance' | 'name' | 'rating' | 'newest';
}
