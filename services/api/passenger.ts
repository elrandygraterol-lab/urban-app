import api from './client';

export const passengerAPI = {
  getPaymentInfo: () => api.get('/api/users/passengers/payment-info'),

  updatePaymentInfo: (data: {
    pagoMovilPhone?: string;
    pagoMovilBank?: string;
    pagoMovilCedula?: string;
    bankTransferBank?: string;
    bankTransferAccount?: string;
    bankTransferAccountType?: string;
  }) => api.patch('/api/users/passengers/payment-info', data),
};

export const passengersAPI = {
  search: (query: string) =>
    api.get<{ passengers: Array<{ id: string; name: string; code: string }> }>(
      '/api/passengers/search',
      { params: { q: query } }
    ),
};
