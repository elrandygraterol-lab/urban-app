import React from 'react';
import { View } from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';

const BORDER = 3;

// ============================================================
// PNG ICON SOURCES — Para usar con el prop "icon" de <Marker>
// Los PNGs son pre-renderizados, evitando el bug de GPU
// Mali/Exynos que ocurre al aplicar overflow + borderRadius
// durante la conversion View -> textura OpenGL en Android.
// ============================================================
export const MARKER_ICONS = {
  driverTaxi: require('../../assets/iconos-maps/conductor.png'),
  passenger: require('../../assets/iconos-maps/pasajero.png'),
  pickup: require('../../assets/iconos-maps/recogida.png'),
  dropoff: require('../../assets/iconos-maps/destino.png'),
};

// ============================================================
// VIEW-BASED COMPONENTS
// Solo para uso FUERA del mapa (ej. botones de ruta en UI).
// NO usar como children de <Marker> — causa el bug de GPU.
// Para marcadores de mapa, usar MARKER_ICONS con el prop icon.
// ============================================================

const CircleMarker: React.FC<{ size: number; color: string; children: React.ReactNode }> = ({
  size,
  color,
  children,
}) => {
  const innerSize = size - BORDER * 2;
  return (
    <View
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
