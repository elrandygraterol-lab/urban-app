import React from 'react';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';

const BORDER = 3;

const CircleMarker: React.FC<{ size: number; color: string; children: React.ReactNode }> = ({
  size,
  color,
  children,
}) => {
  const inner = size - BORDER * 2;
  const center = size / 2;
  const innerR = inner / 2;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle cx={center} cy={center} r={center} fill="#FFFFFF" />
        <Circle cx={center} cy={center} r={innerR} fill={color} />
      </Svg>
      <View style={{ width: inner, height: inner, alignItems: 'center', justifyContent: 'center' }}>
        {children}
      </View>
    </View>
  );
};

export const DriverTaxiIcon: React.FC = () => (
  <CircleMarker size={44} color="#1F2937">
    <MaterialIcons name="local-taxi" size={22} color="#FFFFFF" />
  </CircleMarker>
);

export const PassengerIcon: React.FC<{ size?: number }> = ({ size = 44 }) => (
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
  <CircleMarker size={size} color="#22c55e">
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
  color = '#22c55e',
}) => (
  <CircleMarker size={size} color={color}>
    <Ionicons name="flag" size={size * 0.5} color="#FFFFFF" />
  </CircleMarker>
);
