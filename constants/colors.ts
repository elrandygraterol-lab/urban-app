/**
 * UrbanTaxi Brand Colors
 * Color palette for the taxi platform
 */

export const Colors = {
  // Primary Colors
  primary: '#22c55e', // Main green for primary actions
  secondary: '#4ade80', // Secondary green for hover states
  light: '#86efac', // Light green for backgrounds

  // Accent Colors
  orange: '#FF9500', // Orange for cancel/warning actions
  lightOrange: '#E6C896', // Light orange for hover cancel states

  // Neutral Colors
  darkGray: '#505050', // Dark gray for headings and primary text
  lightGray: '#A9A9A9', // Light gray for secondary text and placeholders
  white: '#FFFFFF', // White for backgrounds and cards
  black: '#000000', // Black for text

  // Semantic Colors
  success: '#22c55e',
  warning: '#FF9500',
  error: '#FF3B30',
  info: '#007AFF',

  // UI Element Colors
  border: '#22c55e',
  inputBorder: '#22c55e',
  placeholder: '#A9A9A9',
  background: '#FFFFFF',
  cardBackground: '#FFFFFF',

  // Button Colors
  buttonPrimary: '#22c55e',
  buttonPrimaryHover: '#4ade80',
  buttonCancel: '#FF9500',
  buttonCancelHover: '#E6C896',
  buttonDisabled: '#A9A9A9',

  // Text Colors
  textPrimary: '#505050',
  textSecondary: '#A9A9A9',
  textWhite: '#FFFFFF',
  textLink: '#22c55e',
} as const;

export type ColorName = keyof typeof Colors;
