import * as SecureStore from 'expo-secure-store';
import api, { API_URL, TOKEN_KEY } from './client';

export const userAPI = {
  getMe: () => api.get('/api/auth/me'),

  updateMe: (data: { name?: string; phone?: string; profilePhotoUrl?: string }) =>
    api.put('/api/users/me', data),

  deleteAccount: () => api.delete('/api/users/me'),

  uploadPhoto: (uri: string): Promise<any> => {
    return new Promise(async (resolve, reject) => {
      try {
        const token = await SecureStore.getItemAsync(TOKEN_KEY);
        const filename = uri.split('/').pop() || 'photo.jpg';
        const ext = filename.split('.').pop()?.toLowerCase() || 'jpg';
        const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
        const formData = new FormData();
        formData.append('photo', { uri, name: filename, type: mime } as any);
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${API_URL}/api/users/me/photo`);
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.onload = () => {
          try {
            const body = JSON.parse(xhr.responseText);
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve(body);
            } else {
              reject(new Error(body.message || `HTTP ${xhr.status}`));
            }
          } catch {
            reject(new Error('Error al subir foto'));
          }
        };
        xhr.onerror = () => reject(new Error('Network request failed'));
        xhr.ontimeout = () => reject(new Error('Request timeout'));
        xhr.timeout = 30000;
        xhr.send(formData);
      } catch (error) {
        reject(error);
      }
    });
  },
};
