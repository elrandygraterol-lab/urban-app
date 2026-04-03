import React, { useState } from 'react';
import {
  TextInput,
  View,
  StyleSheet,
  ViewStyle,
  TextStyle,
  TouchableOpacity,
  Text,
} from 'react-native';
import { Colors, Typography, BorderRadius, Spacing } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';

interface InputProps {
  placeholder?: string;
  value: string;
  onChangeText: (text: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
  editable?: boolean;
  style?: ViewStyle;
  inputStyle?: TextStyle;
  label?: string;
  error?: string;
  icon?: string;
  onIconPress?: () => void;
  maxLength?: number;
  multiline?: boolean;
  numberOfLines?: number;
}

export const Input: React.FC<InputProps> = ({
  placeholder,
  value,
  onChangeText,
  secureTextEntry = false,
  keyboardType = 'default',
  editable = true,
  style,
  inputStyle,
  label,
  error,
  icon,
  onIconPress,
  maxLength,
  multiline = false,
  numberOfLines = 1,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(!secureTextEntry);

  const containerStyle: ViewStyle = {
    marginBottom: error ? Spacing.sm : Spacing.md,
  };

  const inputContainerStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: multiline ? 'flex-start' : 'center',
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    borderColor: error ? Colors.error : isFocused ? Colors.primary : Colors.inputBorder,
    backgroundColor: Colors.white,
    paddingHorizontal: Spacing.md,
    paddingVertical: multiline ? Spacing.sm : 0,
    height: multiline ? undefined : 56,
  };

  const textInputStyle: TextStyle = {
    ...Typography.input,
    flex: 1,
    color: Colors.textPrimary,
    paddingVertical: multiline ? Spacing.sm : 0,
  };

  return (
    <View style={[containerStyle, style]}>
      {label && (
        <Text
          style={[Typography.bodySmall, { marginBottom: Spacing.sm, color: Colors.textPrimary }]}
        >
          {label}
        </Text>
      )}

      <View style={inputContainerStyle}>
        {icon && (
          <Ionicons
            name={icon as any}
            size={20}
            color={isFocused ? Colors.primary : Colors.lightGray}
            style={{ marginRight: Spacing.sm }}
          />
        )}

        <TextInput
          style={[textInputStyle, inputStyle]}
          placeholder={placeholder}
          placeholderTextColor={Colors.placeholder}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry && !showPassword}
          keyboardType={keyboardType}
          editable={editable}
          maxLength={maxLength}
          multiline={multiline}
          numberOfLines={numberOfLines}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
        />

        {secureTextEntry && (
          <TouchableOpacity
            onPress={() => setShowPassword(!showPassword)}
            style={{ padding: Spacing.sm }}
          >
            <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color={Colors.lightGray} />
          </TouchableOpacity>
        )}

        {icon && onIconPress && !secureTextEntry && (
          <TouchableOpacity onPress={onIconPress} style={{ padding: Spacing.sm }}>
            <Ionicons name="close-circle" size={20} color={Colors.lightGray} />
          </TouchableOpacity>
        )}
      </View>

      {error && (
        <Text style={[Typography.caption, { color: Colors.error, marginTop: Spacing.xs }]}>
          {error}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.md,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    borderColor: Colors.inputBorder,
    backgroundColor: Colors.white,
    paddingHorizontal: Spacing.md,
    height: 56,
  },
  input: {
    ...Typography.input,
    flex: 1,
    color: Colors.textPrimary,
  },
  label: {
    ...Typography.bodySmall,
    marginBottom: Spacing.sm,
    color: Colors.textPrimary,
  },
  error: {
    ...Typography.caption,
    color: Colors.error,
    marginTop: Spacing.xs,
  },
});
