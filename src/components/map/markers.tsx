import React from 'react';
import { View, Image } from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import passengerImage from '../../assets/passengerMarker';

export const DriverTaxiIcon: React.FC = () => {
  return (
    <View
      style={{
        backgroundColor: '#9CA3AF',
        padding: 6,
        borderRadius: 18,
        borderWidth: 2,
        borderColor: '#fff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
        elevation: 4,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <MaterialIcons name="local-taxi" size={20} color="#fff" />
    </View>
  );
};

export const PassengerIcon: React.FC<{ size?: number }> = ({ size = 52 }) => {
  return (
    <Image
      source={passengerImage}
      style={{
        width: size,
        height: size,
        resizeMode: 'contain',
        backgroundColor: 'transparent',
      }}
    />
  );
};

export const PickupIcon: React.FC<{ size?: number }> = ({ size = 52 }) => {
  return (
    <Image
      source={passengerImage}
      style={{
        width: size,
        height: size,
        resizeMode: 'contain',
        backgroundColor: 'transparent',
      }}
    />
  );
};

/** Second pickup point marker — uses a distinct blue/purple color to differentiate from the primary pickup */
export const SecondPickupIcon: React.FC<{ size?: number }> = ({ size = 20 }) => {
  return (
    <View
      style={{
        backgroundColor: '#6366f1', // indigo-500 — visually distinct from primary green pickup
        padding: 8,
        borderRadius: 20,
        borderWidth: 3,
        borderColor: '#fff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 5,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Ionicons name="person-add" size={size} color="#fff" />
    </View>
  );
};

export const DropoffIcon: React.FC<{ size?: number }> = ({ size = 20 }) => {
  return (
    <View
      style={{
        backgroundColor: '#FF8C00',
        padding: 8,
        borderRadius: 20,
        borderWidth: 3,
        borderColor: '#fff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 5,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Ionicons name="flag" size={size} color="#fff" />
    </View>
  );
};

/** Second destination point marker — uses a distinct red/rose color to differentiate from the primary orange destination */
export const SecondDropoffIcon: React.FC<{ size?: number }> = ({ size = 20 }) => {
  return (
    <View
      style={{
        backgroundColor: '#e11d48', // rose-600 — visually distinct from primary orange destination
        padding: 8,
        borderRadius: 20,
        borderWidth: 3,
        borderColor: '#fff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 5,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Ionicons name="flag" size={size} color="#fff" />
    </View>
  );
};
