/**
 * API Configuration
 * Central configuration for API endpoints and axios instance
 */

import axios from 'axios';

// Debug: Log environment variable
console.log('[API CONFIG] EXPO_PUBLIC_API_URL:', process.env.EXPO_PUBLIC_API_URL);
console.log('[API CONFIG] __DEV__:', __DEV__);

// API Base URL - Uses EXPO_PUBLIC_API_URL from .env
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL
  ? `${process.env.EXPO_PUBLIC_API_URL}/api`
  : __DEV__
    ? 'http://192.168.1.7:3000/api'
    : 'https://api.urbantaxi.com/api';

console.log('[API CONFIG] Final API_BASE_URL:', API_BASE_URL);

// Create axios instance with default config
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  async config => {
    // Token will be added here from auth store
    return config;
  },
  error => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  response => response,
  async error => {
    if (error.response?.status === 401) {
      // Handle unauthorized - logout user
    }
    return Promise.reject(error);
  }
);

// Export config object for backward compatibility
export const config = {
  apiUrl: API_BASE_URL,
};

export default config;
