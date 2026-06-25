import api from './client';

export const paymentAPI = {
  getPaymentMethods: () => api.get('/api/payments/methods'),

  getPlatformPaymentMethods: () => api.get('/api/payments/platform-methods'),

  addPaymentMethod: (data: {
    methodType: 'cash' | 'card' | 'digital_wallet';
    cardToken?: string;
    walletProvider?: string;
  }) => api.post('/api/payments/methods', data),

  deletePaymentMethod: (methodId: string) => api.delete(`/api/payments/methods/${methodId}`),

  processPayment: (rideId: string, paymentMethodId: string) =>
    api.post('/api/payments/process', { rideId, paymentMethodId }),

  verifyP2CPayment: (rideId: string, paymentData: {
    referencia: string;
    fecha: string;
    banco: string;
    telefonoP: string;
    monto: number;
    identificacion: string;
    pagador: string;
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
    amount: data.amount,
    referenceNumber: data.referenceNumber,
    phoneNumber: data.phoneNumber,
    accountNumber: data.accountNumber,
    bankName: data.bankName,
  }),

  getReceipt: (rideId: string) => api.get(`/api/payments/receipts/${rideId}`),
};
