import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { getActivePushToken, setActivePushToken } from '@/services/api/notification';
import { uploadProfileImage, uploadDocument } from '@/services/cloudinaryUpload';
import { getStorageProvider } from '@/services/fileUploader';

export type UserRole = 'passenger' | 'driver' | 'owner' | null;

export interface User {
  id: string;
  email: string;
  name: string;
  phone: string;
  role: 'passenger' | 'driver' | 'owner';
  profilePhotoUrl?: string;
  rating?: number;
  driverId?: string;
  status?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  // Actions
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => Promise<void>;
  login: (email: string, password: string, role?: 'passenger' | 'driver' | 'owner') => Promise<void>;
  register: (data: RegisterData) => Promise<{ pendingApprovalMessage?: string }>;
  logout: () => Promise<void>;
  loadStoredAuth: () => Promise<void>;
  switchRole: (role: 'passenger' | 'driver' | 'owner') => void;
}

interface RegisterData {
  email: string;
  password: string;
  name: string;
  phone: string;
  role: 'passenger' | 'driver' | 'owner';
  // Profile photo (optional for both roles)
  profilePhoto?: {
    uri: string;
    name: string;
    type: string;
    size: number;
  } | null;
  // Driver-specific fields
  vehicleType?: 'taxi' | 'moto_taxi';
  licensePlate?: string;
  vehicleModel?: string;
  // Driver documents
  driverLicense?: {
    uri: string;
    name: string;
    type: string;
    size: number;
  } | null;
  medicalCertificate?: {
    uri: string;
    name: string;
    type: string;
    size: number;
  } | null;
}

const TOKEN_KEY = 'auth_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const USER_KEY = 'auth_user';

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isLoading: false,
  isAuthenticated: false,

  setUser: async user => {
    set({ user, isAuthenticated: !!user });
    if (user) {
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
    } else {
      await SecureStore.deleteItemAsync(USER_KEY);
    }
  },

  setToken: async token => {
    if (token) {
      await SecureStore.setItemAsync(TOKEN_KEY, token);
    } else {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    }
    set({ token });
  },

  login: async (email, password, role) => {
    set({ isLoading: true });
    try {
      const url = `${process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000'}/api/auth/login`;
      console.log('[LOGIN] Starting login...');
      console.log('[LOGIN] URL:', url);
      console.log('[LOGIN] Email/Phone:', email);
      console.log('[LOGIN] Role:', role || 'not specified');

      const axiosResponse = await axios.post(url, { emailOrPhone: email, password }, { timeout: 15000 });

      console.log('[LOGIN] Response status:', axiosResponse.status);

      const result = axiosResponse.data;
      console.log('[LOGIN] Success! Full result:', JSON.stringify(result));

      // Extract data from response (handle both formats)
      const tokens = result.data?.tokens || result.tokens;
      const user = result.data?.user || result.user;
      const accessToken = tokens?.accessToken || result.token;
      const refreshToken = tokens?.refreshToken;

      console.log('[LOGIN] Token exists:', !!accessToken);
      console.log('[LOGIN] Refresh token exists:', !!refreshToken);
      console.log('[LOGIN] User exists:', !!user);
      console.log('[LOGIN] User data:', user ? JSON.stringify(user) : 'null');

      // Validate user exists
      if (!user || typeof user !== 'object') {
        throw new Error('Invalid user data received from server');
      }

      // Validate token exists
      if (!accessToken) {
        throw new Error('No token received from server');
      }

      // Note: We don't validate role here because the backend returns the correct role
      // The user can login regardless of which role button they pressed

      console.log('[LOGIN] Saving tokens to SecureStore...');
      await SecureStore.setItemAsync(TOKEN_KEY, accessToken);
      if (refreshToken) {
        await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
      }

      console.log('[LOGIN] Saving user to SecureStore...');
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));

      console.log('[LOGIN] Setting state with user and token...');
      // IMPORTANT: Set both user AND token in state so socket can use it
      set({ user, token: accessToken, isAuthenticated: true });

      console.log('[LOGIN] Complete! User authenticated:', user.email);
    } catch (error) {
      console.error('[LOGIN] Error:', error);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  register: async data => {
    set({ isLoading: true });
    try {
      // Determine the endpoint based on role
      let endpoint = '/api/auth/register/passenger';
      if (data.role === 'driver') {
        endpoint = '/api/auth/register/driver';
      } else if (data.role === 'owner') {
        endpoint = '/api/auth/register/owner';
      }

      const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
      const url = `${apiUrl}${endpoint}`;
      console.log('[REGISTER] Starting registration...');
      console.log('[REGISTER] URL:', url);
      console.log('[REGISTER] Data:', { ...data, password: '[HIDDEN]' });

      // Check storage provider
      const storageProvider = await getStorageProvider();
      console.log('[REGISTER] Storage provider:', storageProvider);

      if (storageProvider === 'cloudinary') {
        // CLOUDINARY MODE: Upload files to Cloudinary first, then send URLs
        const formData = new FormData();
        formData.append('email', data.email);
        formData.append('password', data.password);
        formData.append('name', data.name);
        formData.append('phone', data.phone);

        // Upload profile photo to Cloudinary
        if (data.profilePhoto) {
          try {
            const tempId = `temp_${Date.now()}`;
            const result = await uploadProfileImage(data.profilePhoto.uri, tempId);
            formData.append('profilePhotoUrl', result.secure_url);
            console.log('[REGISTER] Profile photo uploaded to Cloudinary:', result.secure_url);
          } catch (error) {
            console.error('[REGISTER] Failed to upload profile photo to Cloudinary:', error);
          }
        }

        // Add driver-specific fields
        if (data.role === 'driver') {
          if (data.vehicleType) formData.append('vehicleType', data.vehicleType);
          if (data.licensePlate) formData.append('licensePlate', data.licensePlate);
          if (data.vehicleModel) formData.append('vehicleModel', data.vehicleModel);

          // Upload driver license to Cloudinary
          if (data.driverLicense) {
            try {
              const tempId = `temp_${Date.now()}`;
              const result = await uploadDocument(data.driverLicense.uri, tempId, 'drivers_license');
              formData.append('driverLicenseUrl', result.secure_url);
              console.log('[REGISTER] Driver license uploaded to Cloudinary:', result.secure_url);
            } catch (error) {
              console.error('[REGISTER] Failed to upload driver license to Cloudinary:', error);
            }
          }

          // Upload medical certificate to Cloudinary
          if (data.medicalCertificate) {
            try {
              const tempId = `temp_${Date.now()}`;
              const result = await uploadDocument(data.medicalCertificate.uri, tempId, 'medical_certificate');
              formData.append('medicalCertificateUrl', result.secure_url);
              console.log('[REGISTER] Medical certificate uploaded to Cloudinary:', result.secure_url);
            } catch (error) {
              console.error('[REGISTER] Failed to upload medical certificate to Cloudinary:', error);
            }
          }
        }

        // Send registration request with URLs
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);
        let response: Response;
        try {
          response = await fetch(url, {
            method: 'POST',
            body: formData,
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timeoutId);
        }
        const result = {
          status: response.status,
          data: await response.json(),
        };

        console.log('[REGISTER] Response status:', result.status);

        if (result.status < 200 || result.status >= 300) {
          const errorData = result.data;
          console.error('[REGISTER] Error response:', errorData);
          let errorMessage = 'Registration failed';
          if (errorData?.error) {
            errorMessage = errorData.error.message || errorMessage;
            if (errorData.error.details && Array.isArray(errorData.error.details)) {
              const validationErrors = errorData.error.details
                .map((d: any) => `• ${d.field || d.path?.[0] || 'Campo'}: ${d.message || 'inválido'}`)
                .join('\n');
              if (validationErrors) errorMessage = `Errores de validación:\n\n${validationErrors}`;
            }
          } else if (errorData?.message) {
            errorMessage = errorData.message;
          }
          throw new Error(errorMessage);
        }

        const dataResponse = result.data;
        console.log('[REGISTER] Success! Response:', JSON.stringify(dataResponse));

        // Check if email verification is required
        if (dataResponse.data?.requiresEmailVerification) {
          console.log('[REGISTER] Email verification required');
          set({ isLoading: false });
          return {};
        }

        // Check if driver approval is required (no tokens issued)
        if (dataResponse.data?.requiresApproval) {
          console.log('[REGISTER] Driver approval required:', dataResponse.data.approvalMessage);
          set({ isLoading: false });
          return { pendingApprovalMessage: dataResponse.data.approvalMessage || 'Tu solicitud ha sido enviada. Un administrador revisará tu cuenta.' };
        }

        // Extract tokens and user data
        const tokens = dataResponse.data?.tokens || dataResponse.tokens;
        const user = dataResponse.data?.user || dataResponse.user;
        const accessToken = tokens?.accessToken || dataResponse.token;

        if (accessToken && user) {
          await SecureStore.setItemAsync('auth_token', accessToken);
          if (tokens?.refreshToken) {
            await SecureStore.setItemAsync('refresh_token', tokens.refreshToken);
          }
          await SecureStore.setItemAsync('user_data', JSON.stringify(user));
          set({ user, token: accessToken, isAuthenticated: true });
        }

        return {};
      } else {
        // LOCAL MODE: Send files directly to backend (current behavior)
        const formData = new FormData();
        formData.append('email', data.email);
        formData.append('password', data.password);
        formData.append('name', data.name);
        formData.append('phone', data.phone);

        // Add profile photo if provided
        if (data.profilePhoto) {
          const photoFile = {
            uri: data.profilePhoto.uri,
            name: data.profilePhoto.name,
            type: data.profilePhoto.type,
          } as any;
          formData.append('profilePhoto', photoFile);
        }

        // Add driver-specific fields
        if (data.role === 'driver') {
          if (data.vehicleType) formData.append('vehicleType', data.vehicleType);
          if (data.licensePlate) formData.append('licensePlate', data.licensePlate);
          if (data.vehicleModel) formData.append('vehicleModel', data.vehicleModel);

          if (data.driverLicense) {
            const licenseFile = {
              uri: data.driverLicense.uri,
              name: data.driverLicense.name,
              type: data.driverLicense.type,
            } as any;
            formData.append('driverLicense', licenseFile);
          }

          if (data.medicalCertificate) {
            const medicalFile = {
              uri: data.medicalCertificate.uri,
              name: data.medicalCertificate.name,
              type: data.medicalCertificate.type,
            } as any;
            formData.append('medicalCertificate', medicalFile);
          }
        }

        // Use fetch for multipart upload
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);
        let response: Response;
        try {
          response = await fetch(url, {
            method: 'POST',
            body: formData,
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timeoutId);
        }
        const result = {
          status: response.status,
          data: await response.json(),
        };

        console.log('[REGISTER] Response status:', result.status);

        if (result.status < 200 || result.status >= 300) {
          const errorData = result.data;
          console.error('[REGISTER] Error response:', errorData);
          let errorMessage = 'Registration failed';
          if (errorData?.error) {
            errorMessage = errorData.error.message || errorMessage;
            if (errorData.error.details && Array.isArray(errorData.error.details)) {
              const validationErrors = errorData.error.details
                .map((d: any) => `• ${d.field || d.path?.[0] || 'Campo'}: ${d.message || 'inválido'}`)
                .join('\n');
              if (validationErrors) errorMessage = `Errores de validación:\n\n${validationErrors}`;
            }
          } else if (errorData?.message) {
            errorMessage = errorData.message;
          }
          throw new Error(errorMessage);
        }

        const dataResponse = result.data;
        console.log('[REGISTER] Success! Response:', JSON.stringify(dataResponse));

        // Check if email verification is required
        if (dataResponse.data?.requiresEmailVerification) {
          console.log('[REGISTER] Email verification required');
          set({ isLoading: false });
          return {};
        }

        // Check if driver approval is required (no tokens issued)
        if (dataResponse.data?.requiresApproval) {
          console.log('[REGISTER] Driver approval required:', dataResponse.data.approvalMessage);
          set({ isLoading: false });
          return { pendingApprovalMessage: dataResponse.data.approvalMessage || 'Tu solicitud ha sido enviada. Un administrador revisará tu cuenta.' };
        }

        // Extract tokens and user data
        const tokens = dataResponse.data?.tokens || dataResponse.tokens;
        const user = dataResponse.data?.user || dataResponse.user;
        const accessToken = tokens?.accessToken || dataResponse.token;

        if (accessToken && user) {
          await SecureStore.setItemAsync('auth_token', accessToken);
          if (tokens?.refreshToken) {
            await SecureStore.setItemAsync('refresh_token', tokens.refreshToken);
          }
          await SecureStore.setItemAsync('user_data', JSON.stringify(user));
          set({ user, token: accessToken, isAuthenticated: true });
        }
        return {};
      }
    } catch (error) {
      console.error('[REGISTER] Error:', error);
      throw error;
    } finally {
      set({ isLoading: false });
    }
    return {};
  },

  logout: async () => {
    const pushToken = getActivePushToken();
    setActivePushToken(null);

    if (pushToken) {
      try {
        const authToken = await SecureStore.getItemAsync(TOKEN_KEY);
        if (authToken) {
          const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
          await axios.delete(`${apiUrl}/api/notifications/device/${encodeURIComponent(pushToken)}`, {
            headers: { Authorization: `Bearer ${authToken}` },
            timeout: 5000,
          });
        }
      } catch {
        // Best-effort: no bloquear el logout si el unregister falla
      }
    }

    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    await SecureStore.deleteItemAsync(USER_KEY);
    set({ user: null, token: null, isAuthenticated: false });
  },

  loadStoredAuth: async () => {
    set({ isLoading: true });
    try {
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      const userJson = await SecureStore.getItemAsync(USER_KEY);

      if (token && userJson) {
        // Check if token is expired (client-side JWT decode)
        let validToken = token;
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          const expiresAt = (payload.exp || 0) * 1000;
          if (Date.now() >= expiresAt) {
            // Token expired — try to refresh
            const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
            if (refreshToken) {
              try {
                const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
                const res = await axios.post(`${apiUrl}/api/auth/refresh`, { refreshToken }, { timeout: 10000 });
                if (res.data?.data?.accessToken) {
                  validToken = res.data.data.accessToken;
                  await SecureStore.setItemAsync(TOKEN_KEY, validToken);
                  if (res.data.data.refreshToken) {
                    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, res.data.data.refreshToken);
                  }
                } else {
                  validToken = '';
                }
              } catch {
                validToken = '';
              }
            } else {
              validToken = '';
            }
          }
        } catch {
          validToken = '';
        }

        if (validToken) {
          const user = JSON.parse(userJson);
          set({ token: validToken, user, isAuthenticated: true });
        }
      }
    } catch (error) {
      console.error('Error loading stored auth:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  switchRole: role => {
    const { user } = get();
    if (user) {
      set({ user: { ...user, role } });
    }
  },
}));
