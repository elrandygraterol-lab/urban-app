import { Theme } from '@/constants/theme';

/**
 * Hook to access the UrbanTaxi theme
 * Provides access to colors, typography, spacing, and other design tokens
 */
export function useTheme() {
  return Theme;
}

export default useTheme;
