import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  ActivityIndicator,
} from 'react-native';
import { Colors, Typography, BorderRadius, Spacing } from '@/constants/theme';

interface ButtonProps {
  onPress: () => void;
  title: string;
  variant?: 'primary' | 'cancel' | 'secondary';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  onPress,
  title,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  style,
  textStyle,
  icon,
}) => {
  const getButtonStyle = (): ViewStyle => {
    const baseStyle: ViewStyle = {
      borderRadius: BorderRadius.md,
      justifyContent: 'center',
      alignItems: 'center',
      flexDirection: 'row',
      paddingHorizontal: Spacing.lg,
    };

    // Size variants
    const sizeStyles = {
      small: { height: 40, paddingHorizontal: Spacing.md },
      medium: { height: 56, paddingHorizontal: Spacing.lg },
      large: { height: 64, paddingHorizontal: Spacing.xl },
    };

    // Color variants
    const colorStyles = {
      primary: {
        backgroundColor: disabled ? Colors.buttonDisabled : Colors.buttonPrimary,
      },
      cancel: {
        backgroundColor: disabled ? Colors.buttonDisabled : Colors.buttonCancel,
      },
      secondary: {
        backgroundColor: disabled ? Colors.buttonDisabled : Colors.secondary,
      },
    };

    return {
      ...baseStyle,
      ...sizeStyles[size],
      ...colorStyles[variant],
    };
  };

  const getTextStyle = (): TextStyle => {
    return {
      ...Typography.button,
      color: Colors.textWhite,
      marginLeft: icon ? Spacing.sm : 0,
    };
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      style={[getButtonStyle(), style, { opacity: disabled ? 0.6 : 1 }]}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator color={Colors.textWhite} />
      ) : (
        <>
          {icon}
          <Text style={[getTextStyle(), textStyle]}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
