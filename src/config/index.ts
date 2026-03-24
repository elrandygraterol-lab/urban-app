// API Configuration
export const API_CONFIG = {
  BASE_URL: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000',
  TIMEOUT: 10000,
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000,
};

// App Configuration
export const APP_CONFIG = {
  APP_NAME: 'UrbanTaxi',
  VERSION: '1.0.0',
  SUPPORTED_LANGUAGES: ['es', 'en'],
  DEFAULT_LANGUAGE: 'es',
};

// Map Configuration
export const MAP_CONFIG = {
  DEFAULT_REGION: {
    latitude: 10.4806, // Caracas, Venezuela
    longitude: -66.9036,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  },
  DRIVER_SEARCH_RADIUS_KM: 5,
  LOCATION_UPDATE_INTERVAL: 5000, // 5 seconds
};

// Ride Configuration
export const RIDE_CONFIG = {
  REQUEST_TIMEOUT_MS: 120000, // 2 minutes
  CANCELLATION_FEE_GRACE_PERIOD_MS: 120000, // 2 minutes
  SCHEDULED_RIDE_NOTIFICATION_ADVANCE_MS: 900000, // 15 minutes
};

// Theme Colors (UrbanTaxi Brand)
export const COLORS = {
  // Primary Colors
  PRIMARY_GREEN: '#22c55e',
  SECONDARY_GREEN: '#4ade80',
  LIGHT_GREEN: '#86efac',
  PRIMARY_ORANGE: '#FF9500',
  LIGHT_ORANGE: '#E6C896',
  
  // Neutral Colors
  DARK_GRAY: '#505050',
  LIGHT_GRAY: '#A9A9A9',
  WHITE: '#FFFFFF',
  BLACK: '#000000',
  
  // Status Colors
  SUCCESS: '#22c55e',
  ERROR: '#FF3B30',
  WARNING: '#FF9500',
  INFO: '#007AFF',
  
  // Background Colors
  BACKGROUND: '#FFFFFF',
  BACKGROUND_SECONDARY: '#F5F5F5',
  
  // Border Colors
  BORDER: '#22c55e',
  BORDER_LIGHT: '#86efac',
};

// Typography
export const TYPOGRAPHY = {
  FONT_SIZES: {
    XS: 12,
    SM: 14,
    MD: 16,
    LG: 18,
    XL: 20,
    XXL: 24,
    XXXL: 32,
  },
  FONT_WEIGHTS: {
    REGULAR: '400' as const,
    MEDIUM: '500' as const,
    SEMIBOLD: '600' as const,
    BOLD: '700' as const,
  },
};

// Spacing
export const SPACING = {
  XS: 4,
  SM: 8,
  MD: 16,
  LG: 24,
  XL: 32,
  XXL: 48,
};

// Border Radius
export const BORDER_RADIUS = {
  SM: 8,
  MD: 16,
  LG: 24,
  FULL: 9999,
};

// Storage Keys
export const STORAGE_KEYS = {
  AUTH_TOKEN: 'auth_token',
  REFRESH_TOKEN: 'refresh_token',
  USER_DATA: 'user_data',
  LANGUAGE: 'language',
  THEME: 'theme',
};

// Validation Rules
export const VALIDATION = {
  PASSWORD_MIN_LENGTH: 8,
  PHONE_MIN_LENGTH: 10,
  RATING_MIN: 1,
  RATING_MAX: 5,
};

export default {
  API_CONFIG,
  APP_CONFIG,
  MAP_CONFIG,
  RIDE_CONFIG,
  COLORS,
  TYPOGRAPHY,
  SPACING,
  BORDER_RADIUS,
  STORAGE_KEYS,
  VALIDATION,
};
