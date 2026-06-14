/**
 * VehicleIconRenderer Usage Examples
 *
 * Demonstrates how to use the VehicleIconRenderer component
 * with react-native-maps and MapRoutingService
 */

import React, { useState, useEffect, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { VehicleIconRenderer, calculateOrientation } from './VehicleIconRenderer';
import { mapRoutingService } from '../../services/MapRoutingService';

/**
 * Example 1: Static Taxi Icon
 *
 * Displays a taxi icon at a fixed location without orientation
 */
export const StaticTaxiIconExample: React.FC = () => {
  const taxiLocation = {
    latitude: 19.4326,
    longitude: -99.1332,
  };

  return (
    <MapView
      style={styles.map}
      initialRegion={{
        ...taxiLocation,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }}
    >
      <Marker coordinate={taxiLocation}>
        <VehicleIconRenderer vehicleType="TAXI" />
      </Marker>
    </MapView>
  );
};

/**
 * Example 2: Taxi Icon with Orientation
 *
 * Displays a taxi icon oriented towards its destination
 */
export const OrientedTaxiIconExample: React.FC = () => {
  const currentLocation = {
    latitude: 19.4326,
    longitude: -99.1332,
  };

  const destination = {
    latitude: 19.4978,
    longitude: -99.1269,
  };

  // Calculate orientation towards destination
  const orientation = calculateOrientation(currentLocation, destination);

  return (
    <MapView
      style={styles.map}
      initialRegion={{
        ...currentLocation,
        latitudeDelta: 0.1,
        longitudeDelta: 0.1,
      }}
    >
      {/* Taxi icon oriented towards destination */}
      <Marker coordinate={currentLocation}>
        <VehicleIconRenderer vehicleType="TAXI" orientation={orientation} size={50} />
      </Marker>

      {/* Destination marker */}
      <Marker coordinate={destination} />
    </MapView>
  );
};

/**
 * Example 3: Moving Taxi with Route
 *
 * Displays a taxi moving along a route with dynamic orientation
 */
export const MovingTaxiExample: React.FC = () => {
  const [route, setRoute] = useState<any>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [orientation, setOrientation] = useState(0);

  const origin = useMemo(
    () => ({
      latitude: 19.4326,
      longitude: -99.1332,
    }),
    []
  );

  const destination = useMemo(
    () => ({
      latitude: 19.4978,
      longitude: -99.1269,
    }),
    []
  );

  // Calculate route on mount
  useEffect(() => {
    const loadRoute = async () => {
      try {
        const routeData = await mapRoutingService.calculateTaxiRoute(origin, destination);
        setRoute(routeData);
      } catch (error) {
        console.error('Error loading route:', error);
      }
    };

    loadRoute();
  }, [destination, origin]);

  // Simulate movement along route
  useEffect(() => {
    if (!route || !route.coordinates) return;

    const interval = setInterval(() => {
      setCurrentIndex(prev => {
        const next = prev + 1;
        if (next >= route.coordinates.length - 1) {
          clearInterval(interval);
          return prev;
        }

        // Calculate orientation for next segment
        const currentPos = route.coordinates[next];
        const nextPos = route.coordinates[next + 1];
        if (nextPos) {
          const newOrientation = calculateOrientation(currentPos, nextPos);
          setOrientation(newOrientation);
        }

        return next;
      });
    }, 1000); // Move every second

    return () => clearInterval(interval);
  }, [route]);

  if (!route) {
    return <View style={styles.container} />;
  }

  const currentPosition = route.coordinates[currentIndex];

  return (
    <MapView
      style={styles.map}
      initialRegion={{
        ...origin,
        latitudeDelta: 0.1,
        longitudeDelta: 0.1,
      }}
    >
      {/* Route polyline */}
      <Polyline coordinates={route.coordinates} strokeColor="#22c55e" strokeWidth={4} />

      {/* Moving taxi icon */}
      <Marker coordinate={currentPosition}>
        <VehicleIconRenderer vehicleType="TAXI" orientation={orientation} size={50} />
      </Marker>

      {/* Origin marker */}
      <Marker coordinate={origin} pinColor="green" />

      {/* Destination marker */}
      <Marker coordinate={destination} pinColor="red" />
    </MapView>
  );
};

/**
 * Example 4: Multiple Vehicles
 *
 * Displays multiple vehicles with different types and orientations
 */
export const MultipleVehiclesExample: React.FC = () => {
  const vehicles = [
    {
      id: '1',
      type: 'TAXI' as const,
      location: { latitude: 19.4326, longitude: -99.1332 },
      heading: 45,
    },
    {
      id: '2',
      type: 'TAXI' as const,
      location: { latitude: 19.44, longitude: -99.13 },
      heading: 180,
    },
    {
      id: '3',
      type: 'GENERIC' as const,
      location: { latitude: 19.45, longitude: -99.125 },
      heading: 270,
    },
  ];

  return (
    <MapView
      style={styles.map}
      initialRegion={{
        latitude: 19.44,
        longitude: -99.13,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }}
    >
      {vehicles.map(vehicle => (
        <Marker key={vehicle.id} coordinate={vehicle.location}>
          <VehicleIconRenderer vehicleType={vehicle.type} orientation={vehicle.heading} size={45} />
        </Marker>
      ))}
    </MapView>
  );
};

/**
 * Example 5: Real-time Vehicle Tracking
 *
 * Tracks a vehicle's position and updates orientation in real-time
 */
export const RealTimeTrackingExample: React.FC<{
  vehicleId: string;
  onLocationUpdate?: (location: any) => void;
}> = ({ vehicleId, onLocationUpdate }) => {
  const [vehicleLocation, setVehicleLocation] = useState({
    latitude: 19.4326,
    longitude: -99.1332,
  });
  const [orientation, setOrientation] = useState(0);

  // Simulate real-time updates (replace with actual socket/API calls)
  useEffect(() => {
    const interval = setInterval(() => {
      // Simulate location update
      setVehicleLocation(prev => {
        const newLocation = {
          latitude: prev.latitude + (Math.random() - 0.5) * 0.001,
          longitude: prev.longitude + (Math.random() - 0.5) * 0.001,
        };

        // Calculate orientation based on movement
        const newOrientation = calculateOrientation(prev, newLocation);
        setOrientation(newOrientation);

        if (onLocationUpdate) {
          onLocationUpdate(newLocation);
        }

        return newLocation;
      });
    }, 2000); // Update every 2 seconds

    return () => clearInterval(interval);
  }, [onLocationUpdate]);

  return (
    <MapView
      style={styles.map}
      region={{
        ...vehicleLocation,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }}
      followsUserLocation
    >
      <Marker coordinate={vehicleLocation}>
        <VehicleIconRenderer vehicleType="TAXI" orientation={orientation} size={50} />
      </Marker>
    </MapView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
});
