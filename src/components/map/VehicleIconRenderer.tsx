import React from 'react';
import { View, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

export type VehicleType = 'TAXI' | 'GENERIC';

export interface VehicleIconProps {
  vehicleType: VehicleType;
  orientation?: number;
  size?: number;
}

export class VehicleIconFactory {
  static createIcon(
    vehicleType: VehicleType,
    orientation: number = 0,
    size: number = 40
  ): React.ReactElement {
    if (vehicleType === 'TAXI') {
      return <TaxiIcon orientation={orientation} size={size} />;
    }
    return <GenericVehicleIcon orientation={orientation} size={size} />;
  }

  static getIconType(vehicleType: VehicleType): 'TAXI' | 'GENERIC' {
    return vehicleType === 'TAXI' ? 'TAXI' : 'GENERIC';
  }
}

export function calculateOrientation(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number }
): number {
  const dLon = to.longitude - from.longitude;
  const dLat = to.latitude - from.latitude;
  const angle = Math.atan2(dLon, dLat) * (180 / Math.PI);
  return (angle + 360) % 360;
}

const TaxiIcon: React.FC<{ orientation: number; size: number }> = ({
  orientation,
  size,
}) => {
  const iconSize = size * 0.55;

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: '#1F2937',
        borderWidth: 2,
        borderColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        transform: [{ rotate: `${orientation}deg` }],
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
      }}
    >
      <MaterialIcons name="local-taxi" size={iconSize} color="#FFFFFF" />
    </View>
  );
};

const GenericVehicleIcon: React.FC<{ orientation: number; size: number }> = ({
  orientation,
  size,
}) => {
  const iconSize = size * 0.55;

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: '#6B7280',
        borderWidth: 2,
        borderColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        transform: [{ rotate: `${orientation}deg` }],
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
        elevation: 3,
      }}
    >
      <MaterialIcons name="directions-car" size={iconSize} color="#FFFFFF" />
    </View>
  );
};

export const VehicleIconRenderer: React.FC<VehicleIconProps> = ({
  vehicleType,
  orientation = 0,
  size = 40,
}) => {
  return VehicleIconFactory.createIcon(vehicleType, orientation, size);
};

export default VehicleIconRenderer;
