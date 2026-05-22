import React, { forwardRef } from 'react';
import { TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';

interface CenterLocationButtonProps {
  onPress: () => void;
  style?: ViewStyle | ViewStyle[];
  disabled?: boolean;
  onLayout?: () => void;
}

const CenterLocationButton = forwardRef<any, CenterLocationButtonProps>(
  ({ onPress, style, disabled = false, onLayout, ...rest }, ref) => {
    return (
      <TouchableOpacity
        ref={ref}
        style={[styles.button, style, disabled && styles.disabled]}
        onPress={onPress}
        onLayout={onLayout}
        disabled={disabled}
        activeOpacity={0.7}
        {...rest}
      >
        <Ionicons 
          name="locate" 
          size={18} 
          color={disabled ? Colors.lightGray : Colors.primary} 
        />
      </TouchableOpacity>
    );
  }
);

CenterLocationButton.displayName = 'CenterLocationButton';

export default CenterLocationButton;

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