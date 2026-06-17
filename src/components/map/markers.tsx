import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';

const MARKER_BORDER = '#FFFFFF';

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
});

export const DriverTaxiIcon: React.FC = () => {
  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor: '#1F2937',
          width: 44,
          height: 44,
          borderRadius: 22,
          borderWidth: 3,
          borderColor: MARKER_BORDER,
        },
      ]}
    >
      <MaterialIcons name="local-taxi" size={22} color="#FFFFFF" />
    </View>
  );
};

export const PassengerIcon: React.FC<{ size?: number }> = ({ size = 44 }) => {
  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor: '#FF8C00',
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 3,
          borderColor: MARKER_BORDER,
        },
      ]}
    >
      <Ionicons name="person" size={size * 0.5} color="#FFFFFF" />
    </View>
  );
};

export const PickupIcon: React.FC<{ size?: number }> = ({ size = 36 }) => {
  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor: '#FF8C00',
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 3,
          borderColor: MARKER_BORDER,
        },
      ]}
    >
      <Ionicons name="location" size={size * 0.5} color="#FFFFFF" />
    </View>
  );
};

export const SecondPickupIcon: React.FC<{ size?: number; color?: string }> = ({
  size = 20,
  color = '#FF8C00',
}) => {
  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor: color,
          padding: 6,
          borderRadius: 16,
          borderWidth: 2,
          borderColor: MARKER_BORDER,
        },
      ]}
    >
      <Ionicons name="person-add" size={size} color="#FFFFFF" />
    </View>
  );
};

export const DropoffIcon: React.FC<{ size?: number }> = ({ size = 20 }) => {
  const baseSize = size >= 36 ? size : size + 16;
  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor: '#22c55e',
          width: baseSize,
          height: baseSize,
          borderRadius: baseSize / 2,
          borderWidth: 3,
          borderColor: MARKER_BORDER,
        },
      ]}
    >
      <Ionicons name="location" size={baseSize * 0.5} color="#FFFFFF" />
    </View>
  );
};

export const SecondDropoffIcon: React.FC<{ size?: number; color?: string }> = ({
  size = 20,
  color = '#22c55e',
}) => {
  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor: color,
          padding: 6,
          borderRadius: 16,
          borderWidth: 2,
          borderColor: MARKER_BORDER,
        },
      ]}
    >
      <Ionicons name="flag" size={size} color="#FFFFFF" />
    </View>
  );
};
