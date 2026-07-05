import axios from 'axios';
import api, { DEFAULT_TIMEOUT, CANCELLATION_TIMEOUT } from './client';
import type {
  GetCancellationPolicyResponse,
  CancelRideRequest,
  CancelRideResponse,
} from '@/types/api';

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
    pickupPoints?: RoutePoint[];
    destinationPoints?: RoutePoint[];
  }) => api.post('/api/rides/request', data),

  acceptRide: (rideId: string) => api.post(`/api/rides/${rideId}/accept`),

  rejectRide: (rideId: string) => api.post(`/api/rides/${rideId}/reject`),

  arriveAtPickup: (rideId: string) => api.post(`/api/rides/${rideId}/arrive`),

  startRide: (rideId: string) => api.post(`/api/rides/${rideId}/start`),

  completeRide: (rideId: string) => api.post(`/api/rides/${rideId}/complete`),

  getCancellationPolicy: async (rideId: string): Promise<GetCancellationPolicyResponse> => {
    try {
      const response = await api.get<GetCancellationPolicyResponse>(
        `/api/rides/${rideId}/cancellation-policy`,
        { timeout: DEFAULT_TIMEOUT }
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNABORTED') {
          throw new Error('Request timeout - please check your connection');
        }
        if (error.response?.status === 404) {
          throw new Error('Ride not found');
        }
        if (error.response?.status === 403) {
          throw new Error('Not authorized to view this ride');
        }
        throw new Error(
          error.response?.data?.error?.message || 'Failed to get cancellation policy'
        );
      }
      throw error;
    }
  },

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
        throw new Error(error.response?.data?.error?.message || 'Failed to cancel ride');
      }
      throw error;
    }
  },

  getRide: (rideId: string) => api.get(`/api/rides/${rideId}`),

  getActiveRides: () => api.get('/api/rides/active'),

  getRideHistory: (params?: { startDate?: string; endDate?: string; page?: string; limit?: string }) =>
    api.get('/api/rides/history', { params }),

  updateLocation: (rideId: string, latitude: number, longitude: number, accuracy?: number) =>
    api.post(`/api/rides/${rideId}/location`, { latitude, longitude, accuracy }),

  changePaymentMethod: (rideId: string, data: {
    mode: 'pago_movil';
    pagoMovilReference: string;
    pagoMovilAmount: number;
  }) => api.patch(`/api/rides/${rideId}/payment-method`, data),

  trackDelegatedRide: (rideId: string) => api.get(`/api/rides/delegate/${rideId}/track`),

  getPendingRides: () => api.get('/api/rides/pending'),
};
