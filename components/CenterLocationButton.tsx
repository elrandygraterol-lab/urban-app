import React from 'react';
import { TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';

interface CenterLocationButtonProps {
  onPress: () => void;
  style?: ViewStyle | ViewStyle[];
  disabled?: boolean;
}

export default function CenterLocationButton({ onPress, style, disabled = false }: CenterLocationButtonProps) {
  return (
    <TouchableOpacity
      style={[styles.button, style, disabled && styles.disabled]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <Ionicons 
        name="locate" 
        size={18} 
        color={disabled ? Colors.lightGray : Colors.primary} 
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    top: 60,
    right: 12,
    width: 34,
    height: 34,
    backgroundColor: '#fff',
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    zIndex: 1000,
  },
  disabled: {
    backgroundColor: '#f5f5f5',
  },
});