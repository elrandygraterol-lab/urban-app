import api from './client';

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
