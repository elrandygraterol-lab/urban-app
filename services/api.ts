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

  resetPassword: (token: string, newPassword: string) =>
    api.post('/api/auth/reset-password', { token, newPassword }),

  refreshToken: () => api.post('/api/auth/refresh'),

  logout: () => api.post('/api/auth/logout'),

  getMe: () => api.get('/api/auth/me'),
};

// Route point shape used in pickupPoints / destinationPoints arrays
export interface RoutePoint {
  latitude: number;
  longitude: number;
  address: string;
}

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
    /** Ordered pickup points: primary first, optional second (Req. 6.5, 6.7) */
    pickupPoints?: RoutePoint[];
    /** Ordered destination points: primary first, optional second (Req. 6.5, 6.7) */
    destinationPoints?: RoutePoint[];
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

  updateLocation: (rideId: string, latitude: number, longitude: number, accuracy?: number) =>
    api.post(`/api/rides/${rideId}/location`, { latitude, longitude, accuracy }),

  changePaymentMethod: (rideId: string, data: {
    mode: 'pago_movil';
    pagoMovilReference: string;
    pagoMovilAmount: number;
  }) => api.patch(`/api/rides/${rideId}/payment-method`, data),

  /**
   * Track a delegated ride in real-time (for the requester).
   * Returns the current ride status, driver location, and beneficiary info.
   * 
   * Requirements: 9.10
   * Task: 14.5.3
   */
  trackDelegatedRide: (rideId: string) => api.get(`/api/rides/delegate/${rideId}/track`),
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

  // P2C Payment verification endpoint
  verifyP2CPayment: (rideId: string, paymentData: {
    referencia: string;
    fecha: string;
    banco: string;
    telefonoP: string;  // Usar telefonoP según documentación VOB
    monto: number;
    identificacion: string;  // Usar identificacion según documentación VOB
    pagador: string;  // Usar pagador según documentación VOB
  }) => api.post('/api/payments/verify-p2c', {
    rideId,
    ...paymentData,
  }),

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

export const passengersAPI = {
  /**
   * Search for a passenger by phone number or user code.
   * Returns only { id, name, code } — no sensitive data.
   * Rate limited to 10 requests/minute per authenticated user.
   *
   * Requisitos: 7.1, 7.2
   */
  search: (query: string) =>
    api.get<{ passengers: Array<{ id: string; name: string; code: string }> }>(
      '/api/passengers/search',
      { params: { q: query } }
    ),
};

export const sharedRidesAPI = {
  /**
   * Send a shared-ride invitation to another passenger.
   * Creates a SharedRideInvitation with a 60-second expiry.
   *
   * Requisitos: 4.6, 7.2
   */
  invite: (data: {
    inviteeId: string;
    pickupPoints: RoutePoint[];
    destinationPoints: RoutePoint[];
    estimatedFare: number;
  }) =>
    api.post<{ invitationId: string }>('/api/shared-rides/invite', data),

  /**
   * Accept a shared-ride invitation (second passenger).
   * Requisitos: 4.7, 7.4
   */
  accept: (invitationId: string, data: {
    inviteePickupLat: number;
    inviteePickupLng: number;
    inviteePickupAddr: string;
  }) => api.post(`/api/shared-rides/${invitationId}/accept`, data),

  /**
   * Reject a shared-ride invitation (second passenger).
   * Requisitos: 4.8
   */
  reject: (invitationId: string) =>
    api.post(`/api/shared-rides/${invitationId}/reject`),

  /**
   * Confirm the shared ride after the invitee has accepted (first passenger).
   * Requisitos: 4.7
   */
  confirm: (invitationId: string) =>
    api.post(`/api/shared-rides/${invitationId}/confirm`),
};

export const delegatedRidesAPI = {
  /**
   * Create a delegated ride (Pedir Viaje Para Otro).
   * The requester (registered passenger) pays for the ride, and the driver sees
   * the beneficiary's contact info (not the requester's).
   *
   * Requisitos: 9.1, 9.2, 9.3, 9.4, 9.5, 9.11
   */
  create: (data: {
    beneficiaryName: string;
    beneficiaryPhone: string;
    pickupPoint: RoutePoint;
    destinationPoint: RoutePoint;
    paymentConfig: {
      mode: 'cash' | 'pago_movil' | 'dual';
      cashAmount?: number;
      pagoMovilAmount?: number;
      pagoMovilReference?: string;
    };
  }) =>
    api.post<{ rideId: string; message: string }>('/api/rides/delegate', data),

  /**
   * Track a delegated ride in real-time (for the requester).
   * Returns the current ride status and driver location.
   *
   * Requisitos: 9.10
   */
  track: (rideId: string) =>
    api.get<{
      ride: {
        id: string;
        status: string;
        beneficiaryName: string;
        beneficiaryPhone: string;
        pickupPoint: RoutePoint;
        destinationPoint: RoutePoint;
        estimatedFare: number;
        driverLocation?: {
          latitude: number;
          longitude: number;
        };
      };
    }>(`/api/rides/delegate/${rideId}/track`),
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

  getNotifications: (params?: { page?: number; limit?: number }) =>
    api.get('/api/notifications', { params }),

  markAsRead: (notificationId: string) =>
    api.put(`/api/notifications/${notificationId}/read`),

  getUnreadCount: (): Promise<{ data: { count: number } }> =>
    api.get('/api/notifications/unread-count'),

  markAllRead: (): Promise<{ data: { updated: number } }> =>
    api.post('/api/notifications/mark-read'),
};

export default api;
