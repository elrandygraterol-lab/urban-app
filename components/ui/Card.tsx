import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Colors, BorderRadius, Spacing, Shadows } from '@/constants/theme';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  shadow?: 'sm' | 'md' | 'lg' | 'none';
  padding?: 'sm' | 'md' | 'lg';
  borderColor?: string;
  borderWidth?: number;
}

export const Card: React.FC<CardProps> = ({
  children,
  style,
  shadow = 'md',
  padding = 'md',
  borderColor,
  borderWidth = 0,
}) => {
  const paddingMap = {
    sm: Spacing.sm,
    md: Spacing.md,
    lg: Spacing.lg,
  };

  const shadowMap = {
    sm: Shadows.sm,
    md: Shadows.md,
    lg: Shadows.lg,
    none: {},
  };

  const cardStyle: ViewStyle = {
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.cardBackground,
    padding: paddingMap[padding],
    borderColor: borderColor || 'transparent',
    borderWidth: borderWidth,
    ...shadowMap[shadow],
  };

  return <View style={[cardStyle, style]}>{children}</View>;
};

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.cardBackground,
    padding: Spacing.md,
  },
});
