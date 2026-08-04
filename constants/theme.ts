/**
 * UrbanTaxi Theme Configuration
 * Complete design system for the taxi platform
 */

import { Platform } from 'react-native';

// UrbanTaxi Brand Colors
export const Colors = {
  // Primary Colors (UrbanTaxi brand green #2FB908)
  primary: '#2FB908', // Main green for primary actions
  primaryLight: '#4CCB3A', // Light green for gradients
  primaryDark: '#269006', // Dark green for hover states
  secondary: '#3DD10A', // Secondary green for accents
  light: '#9EF08A', // Very light green for backgrounds

  // Accent Colors (UrbanTaxi brand orange #F89C0A)
  orange: '#F89C0A', // Orange for cancel/warning actions
  lightOrange: '#FBBF24', // Light amber for hover cancel states

  // Neutral Colors
  darkGray: '#1f2937', // Dark gray for headings and primary text
  mediumGray: '#6b7280', // Medium gray for secondary text
  lightGray: '#9ca3af', // Light gray for placeholders
  white: '#FFFFFF', // White for backgrounds and cards
  black: '#000000', // Black for text
  background: '#f9fafb', // Light background

  // Semantic Colors
  success: '#2FB908',
  warning: '#F89C0A',
  error: '#ef4444',
  info: '#3b82f6',

  // UI Element Colors
  border: '#e5e7eb',
  inputBorder: '#d1d5db',
  inputFocus: '#2FB908',
  placeholder: '#9ca3af',
  cardBackground: '#FFFFFF',

  // Button Colors
  buttonPrimary: '#2FB908',
  buttonPrimaryHover: '#269006',
  buttonCancel: '#F89C0A',
  buttonCancelHover: '#E08809',
  buttonDisabled: '#d1d5db',

  // Text Colors
  textPrimary: '#1f2937',
  textSecondary: '#6b7280',
  textWhite: '#FFFFFF',
  textLink: '#2FB908',
} as const;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});

// Typography
export const Typography = {
  h1: {
    fontSize: 32,
    fontWeight: '700' as const,
    color: Colors.darkGray,
    lineHeight: 40,
  },
  h2: {
    fontSize: 24,
    fontWeight: '600' as const,
    color: Colors.darkGray,
    lineHeight: 32,
  },
  h3: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: Colors.darkGray,
    lineHeight: 28,
  },
  body: {
    fontSize: 16,
    fontWeight: '400' as const,
    color: Colors.darkGray,
    lineHeight: 24,
  },
  bodySmall: {
    fontSize: 14,
    fontWeight: '400' as const,
    color: Colors.darkGray,
    lineHeight: 20,
  },
  caption: {
    fontSize: 12,
    fontWeight: '400' as const,
    color: Colors.lightGray,
    lineHeight: 16,
  },
  button: {
    fontSize: 16,
    fontWeight: '600' as const,
    lineHeight: 24,
  },
  input: {
    fontSize: 16,
    fontWeight: '400' as const,
    color: Colors.darkGray,
    lineHeight: 24,
  },
  placeholder: {
    fontSize: 16,
    fontWeight: '400' as const,
    color: Colors.lightGray,
    lineHeight: 24,
  },
};

// Spacing
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

// Border Radius
export const BorderRadius = {
  sm: 8,
  md: 16,
  lg: 24,
  full: 9999,
};

// Shadows
export const Shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
};

// Component Styles
export const ComponentStyles = {
  input: {
    height: 56,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: Colors.inputBorder,
    backgroundColor: Colors.white,
    paddingHorizontal: 20,
  },
  button: {
    height: 56,
    borderRadius: 24,
    paddingHorizontal: 24,
  },
  card: {
    borderRadius: 16,
    backgroundColor: Colors.cardBackground,
    padding: 16,
  },
};

// Complete Theme Object
export const Theme = {
  colors: Colors,
  typography: Typography,
  spacing: Spacing,
  borderRadius: BorderRadius,
  shadows: Shadows,
  components: ComponentStyles,
  fonts: Fonts,
} as const;

export type ThemeType = typeof Theme;
export type ColorName = keyof typeof Colors;
