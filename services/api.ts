import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';
import type {
  GetCancellationPolicyResponse,
  CancelRideRequest,
  CancelRideResponse,
} from '@/types/api';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
const TOKEN_KEY = 'auth_token';

// Timeout configurations
const DEFAULT_TIMEOUT = 10000; // 10 seconds
const CANCELLATION_TIMEOUT = 15000; // 15 seconds for cancellation operations

// Create axios instance
const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: DEFAULT_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add JWT token
api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    try {
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error('Error getting token from secure store:', error);
    }
    return config;
  },
  error => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  response => response,
  async (error: AxiosError) => {
    if (error.response) {
      // Server responded with error status
      const status = error.response.status;

      if (status === 401) {
        // Unauthorized - token expired or invalid
        await SecureStore.deleteItemAsync(TOKEN_KEY);
        // You might want to redirect to login here
        console.log('Token expired or invalid');
      } else if (status === 403) {
        // Forbidden
        console.log('Access forbidden');
      } else if (status === 404) {
        // Not found
        console.log('Resource not found');
      } else if (status >= 500) {
        // Server error
        console.log('Server error');
      }
    } else if (error.request) {
      // Request made but no response
      console.log('Network error - no response received');
    } else {
      // Error setting up request
      console.log('Request setup error:', error.message);
    }

    return Promise.reject(error);
  }
);

// API methods
export const authAPI = {
  login: (email: string, password: string) => api.post('/api/auth/login', { email, password }),

  registerPassenger: (data: { email: string; password: string; name: string; phone: string }) =>
    api.post('/api/auth/register/passenger', data),

  registerDriver: (data: {
    email: string;
    password: string;
    name: string;
    phone: string;
    vehicleType: 'taxi' | 'moto_taxi';
    licensePlate: string;
    vehicleModel: string;
  }) => api.post('/api/auth/register/driver', data),

  forgotPassword: (email: string) => api.post('/api/auth/forgot-password', { email }),

  resetPassword: (token: string, password: string) =>
    api.post('/api/auth/reset-password', { token, password }),

  refreshToken: () => api.post('/api/auth/refresh'),

  logout: () => api.post('/api/auth/logout'),

  getMe: () => api.get('/api/auth/me'),
};

export const rideAPI = {
  requestRide: (data: {
    pickupLatitude: number;
    pickupLongitude: number;
    pickupAddress: string;
    destinationLatitude: number;
    destinationLongitude: number;
    destinationAddress: string;
    vehicleType: 'taxi' | 'moto_taxi';
    paymentMethodId: string;
  }) => api.post('/api/rides/request', data),

  acceptRide: (rideId: string) => api.post(`/api/rides/${rideId}/accept`),

  rejectRide: (rideId: string) => api.post(`/api/rides/${rideId}/reject`),

  arriveAtPickup: (rideId: string) => api.post(`/api/rides/${rideId}/arrive`),

  startRide: (rideId: string) => api.post(`/api/rides/${rideId}/start`),

  completeRide: (rideId: string) => api.post(`/api/rides/${rideId}/complete`),

  /**
   * Get cancellation policy for a ride
   * Returns the applicable cancellation policy without cancelling the ride
   * 
   * @param rideId - The ID of the ride
   * @returns Promise with cancellation policy details
   * @throws {AxiosError} When request fails
   */
  getCancellationPolicy: async (rideId: string): Promise<GetCancellationPolicyResponse> => {
    try {
      const response = await api.get<GetCancellationPolicyResponse>(
        `/api/rides/${rideId}/cancellation-policy`,
        { timeout: DEFAULT_TIMEOUT }
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        // Handle specific error cases
        if (error.code === 'ECONNABORTED') {
          throw new Error('Request timeout - please check your connection');
        }
        if (error.response?.status === 404) {
          throw new Error('Ride not found');
        }
        if (error.response?.status === 403) {
          throw new Error('Not authorized to view this ride');
        }
        // Re-throw with error message from server if available
        throw new Error(
          error.response?.data?.error?.message || 'Failed to get cancellation policy'
        );
      }
      throw error;
    }
  },

  /**
   * Cancel a ride with policy enforcement
   * Applies cancellation policies based on time elapsed and ride status
   * 
   * @param rideId - The ID of the ride to cancel
   * @param data - Optional cancellation data (reason)
   * @returns Promise with cancellation result
   * @throws {AxiosError} When request fails
   */
  cancelRide: async (
    rideId: string,
    data?: CancelRideRequest
  ): Promise<CancelRideResponse> => {
    try {
      const response = await api.post<CancelRideResponse>(
        `/api/rides/${rideId}/cancel`,
        data || {},
        { timeout: CANCELLATION_TIMEOUT }
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        // Handle specific error cases
        if (error.code === 'ECONNABORTED') {
          throw new Error('Cancellation timeout - please try again');
        }
        if (error.response?.status === 400) {
          throw new Error(
            error.response?.data?.error?.message || 'Cannot cancel ride in current status'
          );
        }
        if (error.response?.status === 403) {
          throw new Error('Not authorized to cancel this ride');
        }
        if (error.response?.status === 404) {
          throw new Error('Ride not found');
        }
        // Re-throw with error message from server if available
        throw new Error(error.response?.data?.error?.message || 'Failed to cancel ride');
      }
      throw error;
    }
  },

  getRide: (rideId: string) => api.get(`/api/rides/${rideId}`),

  getActiveRides: () => api.get('/api/rides/active'),

  getRideHistory: (params?: { startDate?: string; endDate?: string }) =>
    api.get('/api/rides/history', { params }),

  updateLocation: (rideId: string, latitude: number, longitude: number) =>
    api.post(`/api/rides/${rideId}/location`, { latitude, longitude }),
};

export const paymentAPI = {
  getPaymentMethods: () => api.get('/api/payments/methods'),

  addPaymentMethod: (data: {
    methodType: 'cash' | 'card' | 'digital_wallet';
    cardToken?: string;
    walletProvider?: string;
  }) => api.post('/api/payments/methods', data),

  deletePaymentMethod: (methodId: string) => api.delete(`/api/payments/methods/${methodId}`),

  processPayment: (rideId: string, paymentMethodId: string) =>
    api.post('/api/payments/process', { rideId, paymentMethodId }),

  completePayment: (rideId: string, data: {
    method: 'mobile_payment' | 'transfer' | 'cash';
    amount: number;
    referenceNumber?: string;
    phoneNumber?: string;
    accountNumber?: string;
    bankName?: string;
  }) => api.post(`/api/payments/rides/${rideId}/confirm-mobile-payment`, {
    method: data.method,
    referenceNumber: data.referenceNumber,
    phoneNumber: data.phoneNumber,
    accountNumber: data.accountNumber,
    bankName: data.bankName,
  }),

  getReceipt: (rideId: string) => api.get(`/api/payments/receipts/${rideId}`),
};

export const ratingAPI = {
  rateDriver: (rideId: string, rating: number, comment?: string) =>
    api.post('/api/ratings/driver', { rideId, rating, comment }),

  ratePassenger: (rideId: string, rating: number, comment?: string) =>
    api.post('/api/ratings/passenger', { rideId, rating, comment }),

  getDriverRating: (driverId: string) => api.get(`/api/ratings/driver/${driverId}`),
};

export const driverAPI = {
  updateAvailability: (isAvailable: boolean, latitude?: number, longitude?: number) =>
    api.put('/api/drivers/availability', { isAvailable, latitude, longitude }),

  getEarnings: (period: 'day' | 'week' | 'month') => api.get(`/api/drivers/earnings/${period}`),

  uploadDocument: (driverId: string, documentType: string, file: FormData) =>
    api.post(`/api/drivers/${driverId}/documents`, file, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  getDocuments: (driverId: string) => api.get(`/api/drivers/${driverId}/documents`),

  getMyProfile: () => api.get('/api/drivers/me'),

  updatePaymentInfo: (data: {
    pagoMovilPhone?: string;
    pagoMovilBank?: string;
    pagoMovilCedula?: string;
    bankTransferBank?: string;
    bankTransferAccount?: string;
    bankTransferAccountType?: string;
  }) => api.patch('/api/drivers/payment-info', data),
};

export const userAPI = {
  getMe: () => api.get('/api/auth/me'),

  updateMe: (data: { name?: string; phone?: string; profilePhotoUrl?: string }) =>
    api.put('/api/users/me', data),

  deleteAccount: () => api.delete('/api/users/me'),
};

export const notificationAPI = {
  registerDevice: (data: { token: string; platform: 'android' | 'ios' | 'web' }) =>
    api.post('/api/notifications/register-device', data),

  getPreferences: () => api.get('/api/notifications/preferences'),

  updatePreferences: (data: {
    rideRequests?: boolean;
    rideUpdates?: boolean;
    payments?: boolean;
    promotions?: boolean;
  }) => api.put('/api/notifications/preferences', data),
};

export default api;
