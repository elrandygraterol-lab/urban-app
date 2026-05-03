import { create } from 'zustand';
import type {
  StoreReview,
  CreateReviewRequest,
  UpdateReviewRequest,
  GetReviewsParams,
} from '@/types/store';
import {
  getReviews,
  createReview,
  updateReview,
  deleteReview,
} from '@/services/storeApi';

// ============================================================================
// Review State Interface
// ============================================================================

interface ReviewState {
  // State
  reviews: StoreReview[];
  loading: boolean;
  error: string | null;
  
  // Pagination
  currentPage: number;
  totalPages: number;
  totalReviews: number;
  
  // Current store context
  currentStoreId: number | null;
  
  // Actions
  fetchReviews: (storeId: number, params?: GetReviewsParams) => Promise<void>;
  createReview: (storeId: number, data: CreateReviewRequest) => Promise<void>;
  updateReview: (reviewId: number, data: UpdateReviewRequest) => Promise<void>;
  deleteReview: (reviewId: number) => Promise<void>;
  clearReviews: () => void;
  clearError: () => void;
}

// ============================================================================
// Zustand Store
// ============================================================================

export const useReviewStore = create<ReviewState>((set, get) => ({
  // Initial State
  reviews: [],
  loading: false,
  error: null,
  currentPage: 1,
  totalPages: 1,
  totalReviews: 0,
  currentStoreId: null,

  // Fetch Reviews for a Store
  fetchReviews: async (storeId: number, params?: GetReviewsParams) => {
    set({ loading: true, error: null, currentStoreId: storeId });
    
    try {
      const response = await getReviews(storeId, params);
      const { reviews, pagination } = response.data;
      
      // Update state
      set({
        reviews,
        currentPage: pagination.page,
        totalPages: pagination.total_pages,
        totalReviews: pagination.total,
        loading: false,
      });
      
      console.log(`[ReviewStore] Fetched ${reviews.length} reviews for store ${storeId}`);
    } catch (error: any) {
      console.error('[ReviewStore] Error fetching reviews:', error);
      set({
        error: error.response?.data?.error?.message || 'Failed to fetch reviews',
        loading: false,
      });
    }
  },

  // Create Review
  createReview: async (storeId: number, data: CreateReviewRequest) => {
    set({ loading: true, error: null });
    
    try {
      const response = await createReview(storeId, data);
      const newReview = response.data;
      
      // Add new review to the beginning of the list
      set(state => ({
        reviews: [newReview, ...state.reviews],
        totalReviews: state.totalReviews + 1,
        loading: false,
      }));
      
      console.log('[ReviewStore] Review created successfully');
    } catch (error: any) {
      console.error('[ReviewStore] Error creating review:', error);
      
      // Handle specific error cases
      if (error.response?.status === 400) {
        set({
          error: error.response?.data?.error?.message || 'Invalid review data',
          loading: false,
        });
      } else if (error.response?.status === 409) {
        set({
          error: 'You have already reviewed this store',
          loading: false,
        });
      } else {
        set({
          error: error.response?.data?.error?.message || 'Failed to create review',
          loading: false,
        });
      }
      throw error;
    }
  },

  // Update Review
  updateReview: async (reviewId: number, data: UpdateReviewRequest) => {
    set({ loading: true, error: null });
    
    try {
      const response = await updateReview(reviewId, data);
      const updatedReview = response.data.review;
      
      // Update review in the list
      set(state => ({
        reviews: state.reviews.map(r => 
          r.review_id === reviewId ? updatedReview : r
        ),
        loading: false,
      }));
      
      console.log('[ReviewStore] Review updated successfully');
    } catch (error: any) {
      console.error('[ReviewStore] Error updating review:', error);
      
      // Handle 403 error (not authorized)
      if (error.response?.status === 403) {
        set({
          error: "You don't have permission to update this review",
          loading: false,
        });
      } else if (error.response?.status === 404) {
        set({
          error: 'Review not found',
          loading: false,
        });
      } else {
        set({
          error: error.response?.data?.error?.message || 'Failed to update review',
          loading: false,
        });
      }
      throw error;
    }
  },

  // Delete Review
  deleteReview: async (reviewId: number) => {
    set({ loading: true, error: null });
    
    try {
      await deleteReview(reviewId);
      
      // Remove review from the list
      set(state => ({
        reviews: state.reviews.filter(r => r.review_id !== reviewId),
        totalReviews: Math.max(0, state.totalReviews - 1),
        loading: false,
      }));
      
      console.log('[ReviewStore] Review deleted successfully');
    } catch (error: any) {
      console.error('[ReviewStore] Error deleting review:', error);
      
      // Handle 403 error (not authorized)
      if (error.response?.status === 403) {
        set({
          error: "You don't have permission to delete this review",
          loading: false,
        });
      } else if (error.response?.status === 404) {
        set({
          error: 'Review not found',
          loading: false,
        });
      } else {
        set({
          error: error.response?.data?.error?.message || 'Failed to delete review',
          loading: false,
        });
      }
      throw error;
    }
  },

  // Clear Reviews
  clearReviews: () => {
    set({
      reviews: [],
      currentPage: 1,
      totalPages: 1,
      totalReviews: 0,
      currentStoreId: null,
      error: null,
    });
  },

  // Clear Error
  clearError: () => {
    set({ error: null });
  },
}));
