import api from './client';

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

  resetPassword: (code: string, email: string, newPassword: string) =>
    api.post('/api/auth/reset-password', { code, email, newPassword }),

  refreshToken: () => api.post('/api/auth/refresh'),

  logout: () => api.post('/api/auth/logout'),

  getMe: () => api.get('/api/auth/me'),
};
