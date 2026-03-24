import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
const TOKEN_KEY = 'auth_token';

// Create axios instance
const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 10000,
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
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
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
  login: (email: string, password: string) =>
    api.post('/api/auth/login', { email, password }),
  
  registerPassenger: (data: {
    email: string;
    password: string;
    name: string;
    phone: string;
  }) => api.post('/api/auth/register/passenger', data),
  
  registerDriver: (data: {
    email: string;
    password: string;
    name: string;
    phone: string;
    vehicleType: 'taxi' | 'moto-taxi';
    licensePlate: string;
    vehicleModel: string;
  }) => api.post('/api/auth/register/driver', data),
  
  forgotPassword: (email: string) =>
    api.post('/api/auth/forgot-password', { email }),
  
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
    vehicleType: 'taxi' | 'moto-taxi';
    paymentMethodId: string;
  }) => api.post('/api/rides/request', data),
  
  acceptRide: (rideId: string) => api.post(`/api/rides/${rideId}/accept`),
  
  rejectRide: (rideId: string) => api.post(`/api/rides/${rideId}/reject`),
  
  arriveAtPickup: (rideId: string) => api.post(`/api/rides/${rideId}/arrive`),
  
  startRide: (rideId: string) => api.post(`/api/rides/${rideId}/start`),
  
  completeRide: (rideId: string) => api.post(`/api/rides/${rideId}/complete`),
  
  cancelRide: (rideId: string, reason?: string) =>
    api.post(`/api/rides/${rideId}/cancel`, { reason }),
  
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
  
  deletePaymentMethod: (methodId: string) =>
    api.delete(`/api/payments/methods/${methodId}`),
  
  processPayment: (rideId: string, paymentMethodId: string) =>
    api.post('/api/payments/process', { rideId, paymentMethodId }),
  
  getReceipt: (rideId: string) => api.get(`/api/payments/receipts/${rideId}`),
};

export const ratingAPI = {
  rateDriver: (rideId: string, rating: number, comment?: string) =>
    api.post('/api/ratings/driver', { rideId, rating, comment }),
  
  ratePassenger: (rideId: string, rating: number, comment?: string) =>
    api.post('/api/ratings/passenger', { rideId, rating, comment }),
  
  getDriverRating: (driverId: string) =>
    api.get(`/api/ratings/driver/${driverId}`),
};

export const driverAPI = {
  updateAvailability: (isAvailable: boolean) =>
    api.put('/api/drivers/availability', { isAvailable }),
  
  getEarnings: (period: 'day' | 'week' | 'month') =>
    api.get(`/api/drivers/earnings/${period}`),
  
  uploadDocument: (driverId: string, documentType: string, file: FormData) =>
    api.post(`/api/drivers/${driverId}/documents`, file, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  
  getDocuments: (driverId: string) => api.get(`/api/drivers/${driverId}/documents`),
  
  getMyProfile: () => api.get('/api/drivers/me'),
};

export const userAPI = {
  getMe: () => api.get('/api/auth/me'),
  
  updateMe: (data: {
    name?: string;
    phone?: string;
    profilePhotoUrl?: string;
  }) => api.put('/api/users/me', data),
  
  deleteAccount: () => api.delete('/api/users/me'),
};

export const notificationAPI = {
  registerDevice: (data: {
    token: string;
    platform: 'android' | 'ios' | 'web';
  }) => api.post('/api/notifications/register-device', data),
  
  getPreferences: () => api.get('/api/notifications/preferences'),
  
  updatePreferences: (data: {
    rideRequests?: boolean;
    rideUpdates?: boolean;
    payments?: boolean;
    promotions?: boolean;
  }) => api.put('/api/notifications/preferences', data),
};

export default api;
