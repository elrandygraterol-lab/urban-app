/**
 * VehicleIconRenderer
 * 
 * Renders vehicle icons on the map with proper styling and orientation.
 * Implements 3D-style taxi icons with dynamic rotation based on movement direction.
 * 
 * Requirements: 2.2, 2.3
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import Svg, { Defs, LinearGradient, Stop, Circle, Path } from 'react-native-svg';

export type VehicleType = 'TAXI' | 'GENERIC';

export interface VehicleIconProps {
  vehicleType: VehicleType;
  orientation?: number; // Rotation angle in degrees (0 = north, 90 = east, etc.)
  size?: number;
}

/**
 * VehicleIconFactory
 * 
 * Factory class for creating vehicle icons based on type.
 * Selects appropriate icon rendering based on vehicle type.
 */
export class VehicleIconFactory {
  /**
   * Create a vehicle icon component based on vehicle type
   * 
   * @param vehicleType - Type of vehicle (TAXI or GENERIC)
   * @param orientation - Rotation angle in degrees
   * @param size - Icon size in pixels
   * @returns React component for the vehicle icon
   */
  static createIcon(
    vehicleType: VehicleType,
    orientation: number = 0,
    size: number = 40
  ): React.ReactElement {
    if (vehicleType === 'TAXI') {
      return <TaxiIcon3D orientation={orientation} size={size} />;
    }
    
    return <GenericVehicleIcon orientation={orientation} size={size} />;
  }

  /**
   * Get icon type identifier for a vehicle type
   * Used for testing and validation
   */
  static getIconType(vehicleType: VehicleType): '3D_TAXI' | 'GENERIC' {
    return vehicleType === 'TAXI' ? '3D_TAXI' : 'GENERIC';
  }
}

/**
 * Calculate orientation angle based on movement direction vector
 * 
 * @param from - Starting location
 * @param to - Ending location
 * @returns Rotation angle in degrees (0 = north, 90 = east, 180 = south, 270 = west)
 */
export function calculateOrientation(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number }
): number {
  const dLon = to.longitude - from.longitude;
  const dLat = to.latitude - from.latitude;
  
  // Calculate bearing angle
  const angle = Math.atan2(dLon, dLat) * (180 / Math.PI);
  
  // Normalize to 0-360 range
  return (angle + 360) % 360;
}

/**
 * 3D-style Taxi Icon Component
 * 
 * Renders a taxi icon with 3D visual effects:
 * - Gradient shading for depth
 * - Shadow for elevation
 * - Proper rotation based on movement direction
 */
const TaxiIcon3D: React.FC<{ orientation: number; size: number }> = ({
  orientation,
  size,
}) => {
  const iconSize = size * 0.6;
  
  return (
    <View
      style={[
        styles.iconContainer,
        {
          width: size,
          height: size,
          transform: [{ rotate: `${orientation}deg` }],
        },
      ]}
    >
      {/* 3D Shadow layer */}
      <View style={[styles.shadowLayer, { width: size, height: size }]} />
      
      {/* Main icon with gradient background */}
      <View style={[styles.taxiIconBackground, { width: size, height: size }]}>
        <Svg height={size} width={size} viewBox="0 0 100 100">
          <Defs>
            <LinearGradient id="taxiGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor="#FFD700" stopOpacity="1" />
              <Stop offset="50%" stopColor="#FFC700" stopOpacity="1" />
              <Stop offset="100%" stopColor="#FFB700" stopOpacity="1" />
            </LinearGradient>
            <LinearGradient id="taxiHighlight" x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.4" />
              <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
            </LinearGradient>
          </Defs>
          
          {/* Base circle with gradient */}
          <Circle cx="50" cy="50" r="45" fill="url(#taxiGradient)" />
          
          {/* Highlight for 3D effect */}
          <Circle cx="50" cy="35" r="35" fill="url(#taxiHighlight)" />
          
          {/* Border */}
          <Circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="4"
          />
        </Svg>
        
        {/* Taxi icon */}
        <View style={styles.iconContent}>
          <MaterialIcons name="local-taxi" size={iconSize} color="#000000" />
        </View>
      </View>
    </View>
  );
};

/**
 * Generic Vehicle Icon Component
 * 
 * Renders a simple generic vehicle icon without 3D effects
 */
const GenericVehicleIcon: React.FC<{ orientation: number; size: number }> = ({
  orientation,
  size,
}) => {
  const iconSize = size * 0.6;
  
  return (
    <View
      style={[
        styles.iconContainer,
        {
          width: size,
          height: size,
          transform: [{ rotate: `${orientation}deg` }],
        },
      ]}
    >
      <View style={[styles.genericIconBackground, { width: size, height: size }]}>
        <MaterialIcons name="directions-car" size={iconSize} color="#FFFFFF" />
      </View>
    </View>
  );
};

/**
 * Main VehicleIconRenderer Component
 * 
 * Public API for rendering vehicle icons on the map
 */
export const VehicleIconRenderer: React.FC<VehicleIconProps> = ({
  vehicleType,
  orientation = 0,
  size = 40,
}) => {
  return VehicleIconFactory.createIcon(vehicleType, orientation, size);
};

const styles = StyleSheet.create({
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  shadowLayer: {
    position: 'absolute',
    borderRadius: 100,
    backgroundColor: '#000000',
    opacity: 0.2,
    transform: [{ translateY: 2 }],
  },
  taxiIconBackground: {
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5, // Android shadow
    shadowColor: '#000000', // iOS shadow
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  genericIconBackground: {
    borderRadius: 100,
    backgroundColor: '#6B7280',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  iconContent: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default VehicleIconRenderer;
