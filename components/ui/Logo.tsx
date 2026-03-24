import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Colors, Typography, Spacing } from '@/constants/theme';

interface LogoProps {
  size?: 'small' | 'medium' | 'large';
  style?: ViewStyle;
  showTagline?: boolean;
}

export const Logo: React.FC<LogoProps> = ({
  size = 'medium',
  style,
  showTagline = false,
}) => {
  const sizeMap = {
    small: { fontSize: 24, iconSize: 20 },
    medium: { fontSize: 32, iconSize: 28 },
    large: { fontSize: 48, iconSize: 40 },
  };

  const { fontSize, iconSize } = sizeMap[size];

  return (
    <View style={[styles.container, style]}>
      <View style={styles.logoContainer}>
        {/* Green circle background */}
        <View
          style={[
            styles.circle,
            {
              width: iconSize * 1.5,
              height: iconSize * 1.5,
              borderRadius: (iconSize * 1.5) / 2,
            },
          ]}
        >
          {/* Taxi icon representation */}
          <Text style={[styles.icon, { fontSize: iconSize }]}>🚕</Text>
        </View>
      </View>

      <Text
        style={[
          Typography.h2,
          styles.text,
          {
            fontSize,
            fontWeight: '700',
          },
        ]}
      >
        Urban
        <Text style={[styles.textAccent, { fontSize }]}>Taxi</Text>
      </Text>

      {showTagline && (
        <Text style={[Typography.bodySmall, styles.tagline]}>
          ¿Listo para tu siguiente destino?
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    marginBottom: Spacing.md,
  },
  circle: {
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: {
    textAlign: 'center',
  },
  text: {
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  textAccent: {
    color: Colors.primary,
    fontWeight: '700',
  },
  tagline: {
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
    fontStyle: 'italic',
  },
});
