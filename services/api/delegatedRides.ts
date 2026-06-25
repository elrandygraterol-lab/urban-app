import api from './client';
import type { RoutePoint } from './ride';

export const delegatedRidesAPI = {
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
