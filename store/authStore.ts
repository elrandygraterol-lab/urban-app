import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

export type UserRole = 'passenger' | 'driver' | null;

export interface User {
  id: string;
  email: string;
  name: string;
  phone: string;
  role: 'passenger' | 'driver';
  profilePhotoUrl?: string;
  driverId?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  // Actions
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => Promise<void>;
  login: (email: string, password: string, role?: 'passenger' | 'driver') => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  loadStoredAuth: () => Promise<void>;
  switchRole: (role: 'passenger' | 'driver') => void;
}

interface RegisterData {
  email: string;
  password: string;
  name: string;
  phone: string;
  role: 'passenger' | 'driver';
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

  setUser: user => {
    set({ user, isAuthenticated: !!user });
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
      const url = `${process.env.EXPO_PUBLIC_API_URL}/api/auth/login`;
      console.log('[LOGIN] Starting login...');
      console.log('[LOGIN] URL:', url);
      console.log('[LOGIN] Email/Phone:', email);
      console.log('[LOGIN] Role:', role || 'not specified');

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailOrPhone: email, password }),
      });

      console.log('[LOGIN] Response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('[LOGIN] Error response:', errorData);

        // Extract error message
        let errorMessage = 'Login failed';

        if (errorData?.error) {
          errorMessage = errorData.error.message || errorMessage;

          // If there are validation details, format them
          if (errorData.error.details && Array.isArray(errorData.error.details)) {
            const validationErrors = errorData.error.details
              .map((detail: any) => {
                const field = detail.field || detail.path?.[0] || 'Campo';
                const message = detail.message || 'inválido';
                return `• ${field}: ${message}`;
              })
              .join('\n');

            if (validationErrors) {
              errorMessage = `Errores de validación:\n\n${validationErrors}`;
            }
          }
        } else if (errorData?.message) {
          errorMessage = errorData.message;
        }

        throw new Error(errorMessage);
      }

      const result = await response.json();
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
      const endpoint =
        data.role === 'driver' ? '/api/auth/register/driver' : '/api/auth/register/passenger';

      const url = `${process.env.EXPO_PUBLIC_API_URL}${endpoint}`;
      console.log('[REGISTER] Starting registration...');
      console.log('[REGISTER] URL:', url);
      console.log('[REGISTER] Data:', { ...data, password: '[HIDDEN]' });

      // Create FormData for file uploads
      const formData = new FormData();

      // Add basic fields
      formData.append('email', data.email);
      formData.append('password', data.password);
      formData.append('name', data.name);
      formData.append('phone', data.phone);
      formData.append('role', data.role);

      // Add profile photo if provided (optional for both roles)
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

        // Add driver documents
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

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        body: formData,
      });

      console.log('[REGISTER] Response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('[REGISTER] Error response:', errorData);

        // Extract validation details if available
        let errorMessage = 'Registration failed';

        if (errorData?.error) {
          errorMessage = errorData.error.message || errorMessage;

          // If there are validation details, format them
          if (errorData.error.details && Array.isArray(errorData.error.details)) {
            const validationErrors = errorData.error.details
              .map((detail: any) => {
                const field = detail.field || detail.path?.[0] || 'Campo';
                const message = detail.message || 'inválido';
                return `• ${field}: ${message}`;
              })
              .join('\n');

            if (validationErrors) {
              errorMessage = `Errores de validación:\n\n${validationErrors}`;
            }
          }
        } else if (errorData?.message) {
          errorMessage = errorData.message;
        }

        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log('[REGISTER] Success! Full result:', JSON.stringify(result));

      // Registration successful - user should login manually
      // We don't auto-authenticate to avoid navigation conflicts
      console.log('[REGISTER] Complete! User should now login.');
    } catch (error) {
      console.error('[REGISTER] Error:', error);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  logout: async () => {
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
        const user = JSON.parse(userJson);
        set({ token, user, isAuthenticated: true });
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
