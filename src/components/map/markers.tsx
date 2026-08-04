import React from 'react';
import { Platform, View } from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';

const BORDER = 3;

const CircleMarker: React.FC<{ size: number; color: string; children: React.ReactNode }> = ({
  size,
  color,
  children,
}) => {
  const innerSize = size - BORDER * 2;
  return (
    <View
      renderToHardwareTextureAndroid={Platform.OS === 'android'}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      <View
        renderToHardwareTextureAndroid={Platform.OS === 'android'}
        style={{
          width: innerSize,
          height: innerSize,
          borderRadius: innerSize / 2,
          backgroundColor: color,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {children}
      </View>
    </View>
  );
};

export const DriverTaxiIcon: React.FC = () => (
  <CircleMarker size={36} color="#1F2937">
    <MaterialIcons name="local-taxi" size={18} color="#FFFFFF" />
  </CircleMarker>
);

export const PassengerIcon: React.FC<{ size?: number }> = ({ size = 36 }) => (
  <CircleMarker size={size} color="#FF8C00">
    <Ionicons name="person" size={size * 0.5} color="#FFFFFF" />
  </CircleMarker>
);

export const PickupIcon: React.FC<{ size?: number }> = ({ size = 36 }) => (
  <CircleMarker size={size} color="#FF8C00">
    <Ionicons name="location" size={size * 0.5} color="#FFFFFF" />
  </CircleMarker>
);

export const DropoffIcon: React.FC<{ size?: number }> = ({ size = 36 }) => (
  <CircleMarker size={size} color="#2FB908">
    <Ionicons name="location" size={size * 0.5} color="#FFFFFF" />
  </CircleMarker>
);

export const SecondPickupIcon: React.FC<{ size?: number; color?: string }> = ({
  size = 32,
  color = '#FF8C00',
}) => (
  <CircleMarker size={size} color={color}>
    <Ionicons name="person-add" size={size * 0.5} color="#FFFFFF" />
  </CircleMarker>
);

export const SecondDropoffIcon: React.FC<{ size?: number; color?: string }> = ({
  size = 32,
  color = '#2FB908',
}) => (
  <CircleMarker size={size} color={color}>
    <Ionicons name="flag" size={size * 0.5} color="#FFFFFF" />
  </CircleMarker>
);
