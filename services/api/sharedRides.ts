import api from './client';
import type { RoutePoint } from './ride';

export const sharedRidesAPI = {
  invite: (data: {
    inviteeId: string;
    pickupPoints: RoutePoint[];
    destinationPoints: RoutePoint[];
    estimatedFare: number;
  }) =>
    api.post<{ invitationId: string }>('/api/shared-rides/invite', data),

  accept: (invitationId: string, data: {
    inviteePickupLat: number;
    inviteePickupLng: number;
    inviteePickupAddr: string;
  }) => api.post(`/api/shared-rides/${invitationId}/accept`, data),

  reject: (invitationId: string) =>
    api.post(`/api/shared-rides/${invitationId}/reject`),

  confirm: (invitationId: string) =>
    api.post(`/api/shared-rides/${invitationId}/confirm`),
};
