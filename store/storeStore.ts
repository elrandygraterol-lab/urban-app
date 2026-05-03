import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  Store,
  StoreCategory,
  StoreFilters,
  GetStoresParams,
  CreateStoreRequest,
  UpdateStoreRequest,
} from '@/types/store';
import {
  getStores,
  getMyStores,
  getStoreById,
  createStore,
  updateStore,
  deleteStore,
  getCategories,
} from '@/services/storeApi';

// ============================================================================
// Cache Configuration
// ============================================================================

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds for stores
const CATEGORY_CACHE_TTL = 60 * 60 * 1000; // 1 hour in milliseconds for categories
const CACHE_KEYS = {
  STORES: 'stores_cache',
  MY_STORES: 'my_stores_cache',
  CATEGORIES: 'categories_cache',
  STORE_DETAIL: 'store_detail_cache_',
};

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

// ============================================================================
// Store State Interface
// ============================================================================

interface StoreState {
  // State
  stores: Store[];
  myStores: Store[];
  selectedStore: Store | null;
  categories: StoreCategory[];
  filters: StoreFilters;
  loading: boolean;
  error: string | null;
  
  // Pagination
  currentPage: number;
  totalPages: number;
  totalStores: number;
  
  // Cache timestamps
  storesCacheTime: number | null;
  myStoresCacheTime: number | null;
  categoriesCacheTime: number | null;
  
  // Actions
  fetchStores: (params?: GetStoresParams, forceRefresh?: boolean) => Promise<void>;
  fetchMyStores: (forceRefresh?: boolean) => Promise<void>;
  fetchStoreById: (storeId: number, forceRefresh?: boolean) => Promise<void>;
  createStore: (data: CreateStoreRequest) => Promise<number>;
  updateStore: (storeId: number, data: UpdateStoreRequest) => Promise<void>;
  deleteStore: (storeId: number) => Promise<void>;
  fetchCategories: (forceRefresh?: boolean) => Promise<void>;
  setFilters: (filters: Partial<StoreFilters>) => void;
  clearFilters: () => void;
  setSelectedStore: (store: Store | null) => void;
  clearError: () => void;
}

// ============================================================================
// Cache Helper Functions
// ============================================================================

const getCachedData = async <T,>(key: string): Promise<CacheEntry<T> | null> => {
  try {
    const cached = await AsyncStorage.getItem(key);
    if (cached) {
      return JSON.parse(cached) as CacheEntry<T>;
    }
  } catch (error) {
    console.error(`Error reading cache for ${key}:`, error);
  }
  return null;
};

const setCachedData = async <T,>(key: string, data: T): Promise<void> => {
  try {
    const cacheEntry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
    };
    await AsyncStorage.setItem(key, JSON.stringify(cacheEntry));
  } catch (error) {
    console.error(`Error writing cache for ${key}:`, error);
  }
};

const isCacheValid = (timestamp: number | null, ttl: number = CACHE_TTL): boolean => {
  if (!timestamp) return false;
  return Date.now() - timestamp < ttl;
};

// ============================================================================
// Initial Filters
// ============================================================================

const initialFilters: StoreFilters = {
  categories: [],
  distanceRange: undefined,
  ratingRange: undefined,
  openNow: undefined,
  search: undefined,
  sort: 'distance',
};

// ============================================================================
// Zustand Store
// ============================================================================

export const useStoreStore = create<StoreState>((set, get) => ({
  // Initial State
  stores: [],
  myStores: [],
  selectedStore: null,
  categories: [],
  filters: initialFilters,
  loading: false,
  error: null,
  currentPage: 1,
  totalPages: 1,
  totalStores: 0,
  storesCacheTime: null,
  myStoresCacheTime: null,
  categoriesCacheTime: null,

  // Fetch Stores with Filtering and Caching
  fetchStores: async (params?: GetStoresParams, forceRefresh = false) => {
    const { storesCacheTime } = get();
    
    // Check cache validity
    if (!forceRefresh && isCacheValid(storesCacheTime)) {
      console.log('[StoreStore] Using cached stores data');
      return;
    }
    
    set({ loading: true, error: null });
    
    try {
      // Try to load from AsyncStorage cache first
      if (!forceRefresh) {
        const cached = await getCachedData<{ stores: Store[]; pagination: any }>(CACHE_KEYS.STORES);
        if (cached && isCacheValid(cached.timestamp)) {
          console.log('[StoreStore] Loaded stores from AsyncStorage cache');
          set({
            stores: cached.data.stores,
            currentPage: cached.data.pagination.page,
            totalPages: cached.data.pagination.total_pages,
            totalStores: cached.data.pagination.total,
            storesCacheTime: cached.timestamp,
            loading: false,
          });
          return;
        }
      }
      
      // Fetch from API
      const response = await getStores(params);
      const { stores, pagination } = response.data;
      
      // Update state
      set({
        stores,
        currentPage: pagination.page,
        totalPages: pagination.total_pages,
        totalStores: pagination.total,
        storesCacheTime: Date.now(),
        loading: false,
      });
      
      // Cache the data
      await setCachedData(CACHE_KEYS.STORES, { stores, pagination });
      
      console.log('[StoreStore] Fetched and cached stores from API');
    } catch (error: any) {
      console.error('[StoreStore] Error fetching stores:', error);
      set({
        error: error.response?.data?.error?.message || 'Failed to fetch stores',
        loading: false,
      });
    }
  },

  // Fetch My Stores (Owner only)
  fetchMyStores: async (forceRefresh = false) => {
    const { myStoresCacheTime } = get();
    
    // Check cache validity
    if (!forceRefresh && isCacheValid(myStoresCacheTime)) {
      console.log('[StoreStore] Using cached my stores data');
      return;
    }
    
    set({ loading: true, error: null });
    
    try {
      // Try to load from AsyncStorage cache first
      if (!forceRefresh) {
        const cached = await getCachedData<Store[]>(CACHE_KEYS.MY_STORES);
        if (cached && isCacheValid(cached.timestamp)) {
          console.log('[StoreStore] Loaded my stores from AsyncStorage cache');
          set({
            myStores: cached.data,
            myStoresCacheTime: cached.timestamp,
            loading: false,
          });
          return;
        }
      }
      
      // Fetch from API
      const response = await getMyStores();
      const stores = response.data.stores;
      
      // Update state
      set({
        myStores: stores,
        myStoresCacheTime: Date.now(),
        loading: false,
      });
      
      // Cache the data
      await setCachedData(CACHE_KEYS.MY_STORES, stores);
      
      console.log('[StoreStore] Fetched and cached my stores from API');
    } catch (error: any) {
      console.error('[StoreStore] Error fetching my stores:', error);
      
      // Handle 403 error (not an owner) gracefully
      if (error.response?.status === 403) {
        set({
          myStores: [],
          error: null, // Don't show error for non-owners
          loading: false,
        });
      } else {
        set({
          error: error.response?.data?.error?.message || 'Failed to fetch your stores',
          loading: false,
        });
      }
    }
  },

  // Fetch Store by ID
  fetchStoreById: async (storeId: number, forceRefresh = false) => {
    set({ loading: true, error: null });
    
    try {
      const cacheKey = `${CACHE_KEYS.STORE_DETAIL}${storeId}`;
      
      // Try to load from AsyncStorage cache first
      if (!forceRefresh) {
        const cached = await getCachedData<Store>(cacheKey);
        if (cached && isCacheValid(cached.timestamp)) {
          console.log(`[StoreStore] Loaded store ${storeId} from AsyncStorage cache`);
          set({
            selectedStore: cached.data,
            loading: false,
          });
          return;
        }
      }
      
      // Fetch from API
      const response = await getStoreById(storeId);
      const store = response.data;
      
      // Update state
      set({
        selectedStore: store,
        loading: false,
      });
      
      // Cache the data
      await setCachedData(cacheKey, store);
      
      console.log(`[StoreStore] Fetched and cached store ${storeId} from API`);
    } catch (error: any) {
      console.error('[StoreStore] Error fetching store:', error);
      set({
        error: error.response?.data?.error?.message || 'Failed to fetch store details',
        loading: false,
      });
    }
  },

  // Create Store
  createStore: async (data: CreateStoreRequest) => {
    set({ loading: true, error: null });
    
    try {
      const response = await createStore(data);
      const storeId = response.data.store_id;
      
      // Invalidate my stores cache
      set({ myStoresCacheTime: null, loading: false });
      
      // Refresh my stores
      await get().fetchMyStores(true);
      
      console.log('[StoreStore] Store created successfully');
      return storeId;
    } catch (error: any) {
      console.error('[StoreStore] Error creating store:', error);
      
      // Handle 403 error (not an owner)
      if (error.response?.status === 403) {
        set({
          error: 'Only users with owner role can create stores',
          loading: false,
        });
      } else {
        set({
          error: error.response?.data?.error?.message || 'Failed to create store',
          loading: false,
        });
      }
      throw error;
    }
  },

  // Update Store
  updateStore: async (storeId: number, data: UpdateStoreRequest) => {
    set({ loading: true, error: null });
    
    try {
      const response = await updateStore(storeId, data);
      const updatedStore = response.data.store;
      
      // Update in myStores if present
      set(state => ({
        myStores: state.myStores.map(s => s.store_id === storeId ? updatedStore : s),
        selectedStore: state.selectedStore?.store_id === storeId ? updatedStore : state.selectedStore,
        loading: false,
      }));
      
      // Invalidate caches
      set({ storesCacheTime: null, myStoresCacheTime: null });
      
      console.log('[StoreStore] Store updated successfully');
    } catch (error: any) {
      console.error('[StoreStore] Error updating store:', error);
      
      // Handle 403 error (not authorized)
      if (error.response?.status === 403) {
        set({
          error: "You don't have permission to update this store",
          loading: false,
        });
      } else {
        set({
          error: error.response?.data?.error?.message || 'Failed to update store',
          loading: false,
        });
      }
      throw error;
    }
  },

  // Delete Store
  deleteStore: async (storeId: number) => {
    set({ loading: true, error: null });
    
    try {
      await deleteStore(storeId);
      
      // Remove from myStores
      set(state => ({
        myStores: state.myStores.filter(s => s.store_id !== storeId),
        selectedStore: state.selectedStore?.store_id === storeId ? null : state.selectedStore,
        loading: false,
      }));
      
      // Invalidate caches
      set({ storesCacheTime: null, myStoresCacheTime: null });
      
      console.log('[StoreStore] Store deleted successfully');
    } catch (error: any) {
      console.error('[StoreStore] Error deleting store:', error);
      
      // Handle 403 error (not authorized)
      if (error.response?.status === 403) {
        set({
          error: "You don't have permission to delete this store",
          loading: false,
        });
      } else {
        set({
          error: error.response?.data?.error?.message || 'Failed to delete store',
          loading: false,
        });
      }
      throw error;
    }
  },

  // Fetch Categories
  fetchCategories: async (forceRefresh = false) => {
    const { categoriesCacheTime } = get();
    
    // Check cache validity with 1-hour TTL
    if (!forceRefresh && isCacheValid(categoriesCacheTime, CATEGORY_CACHE_TTL)) {
      console.log('[StoreStore] Using cached categories data');
      return;
    }
    
    set({ loading: true, error: null });
    
    try {
      // Try to load from AsyncStorage cache first
      if (!forceRefresh) {
        const cached = await getCachedData<StoreCategory[]>(CACHE_KEYS.CATEGORIES);
        if (cached && isCacheValid(cached.timestamp, CATEGORY_CACHE_TTL)) {
          console.log('[StoreStore] Loaded categories from AsyncStorage cache');
          set({
            categories: cached.data,
            categoriesCacheTime: cached.timestamp,
            loading: false,
          });
          return;
        }
      }
      
      // Fetch from API
      const response = await getCategories();
      const categories = response.data.categories ?? response.data ?? [];
      
      // Update state
      set({
        categories: Array.isArray(categories) ? categories : [],
        categoriesCacheTime: Date.now(),
        loading: false,
      });
      
      // Cache the data
      await setCachedData(CACHE_KEYS.CATEGORIES, categories);
      
      console.log('[StoreStore] Fetched and cached categories from API');
    } catch (error: any) {
      console.error('[StoreStore] Error fetching categories:', error);
      set({
        error: error.response?.data?.error?.message || 'Failed to fetch categories',
        loading: false,
      });
    }
  },

  // Set Filters
  setFilters: (newFilters: Partial<StoreFilters>) => {
    set(state => ({
      filters: { ...state.filters, ...newFilters },
    }));
  },

  // Clear Filters
  clearFilters: () => {
    set({ filters: initialFilters });
  },

  // Set Selected Store
  setSelectedStore: (store: Store | null) => {
    set({ selectedStore: store });
  },

  // Clear Error
  clearError: () => {
    set({ error: null });
  },
}));
