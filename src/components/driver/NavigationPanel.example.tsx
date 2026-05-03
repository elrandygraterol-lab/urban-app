/**
 * NavigationPanel Example Usage
 * 
 * Demonstrates how to use the NavigationPanel component in a driver screen.
 */

import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Button, Text } from 'react-native';
import NavigationPanel from './NavigationPanel';
import type { NavigationStep, Location } from '../../services/MapRoutingService';

/**
 * Example 1: Basic Navigation
 * Simple navigation from current location to destination
 */
export function BasicNavigationExample() {
  const [currentLocation, setCurrentLocation] = useState<Location>({
    latitude: 40.7128,
    longitude: -74.0060,
  });

  const destination: Location = {
    latitude: 40.7589,
    longitude: -73.9851,
  };

  // Simulate location updates (in real app, use GPS)
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentLocation(prev => ({
        latitude: prev.latitude + 0.001,
        longitude: prev.longitude + 0.001,
      }));
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <View style={styles.container}>
      <NavigationPanel
        currentLocation={currentLocation}
        destination={destination}
      />
    </View>
  );
}

/**
 * Example 2: Sequential Navigation (Pickup → Destination)
 * Taxi driver navigation with pickup phase
 */
export function SequentialNavigationExample() {
  const [currentLocation, setCurrentLocation] = useState<Location>({
    latitude: 40.7128,
    longitude: -74.0060,
  });

  const [currentPhase, setCurrentPhase] = useState<'pickup' | 'destination' | 'completed'>('pickup');

  const pickupLocation: Location = {
    latitude: 40.7489,
    longitude: -73.9680,
  };

  const destination: Location = {
    latitude: 40.7589,
    longitude: -73.9851,
  };

  const handlePhaseChange = (phase: 'pickup' | 'destination' | 'completed') => {
    console.log(`Navigation phase changed to: ${phase}`);
    setCurrentPhase(phase);

    if (phase === 'destination') {
      // Driver reached pickup - notify passenger
      console.log('Driver has arrived at pickup location');
      // In real app: send notification, update trip status
    } else if (phase === 'completed') {
      // Driver reached destination - complete trip
      console.log('Driver has arrived at destination');
      // In real app: complete trip, process payment
    }
  };

  // Simulate location updates
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentLocation(prev => ({
        latitude: prev.latitude + 0.001,
        longitude: prev.longitude + 0.001,
      }));
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.statusBar}>
        <Text style={styles.statusText}>Current Phase: {currentPhase}</Text>
      </View>
      <NavigationPanel
        currentLocation={currentLocation}
        destination={destination}
        pickupLocation={pickupLocation}
        onPhaseChange={handlePhaseChange}
      />
    </View>
  );
}

/**
 * Example 3: Navigation with Route Callback
 * Display route summary when calculated
 */
export function NavigationWithCallbackExample() {
  const [currentLocation, setCurrentLocation] = useState<Location>({
    latitude: 40.7128,
    longitude: -74.0060,
  });

  const [routeSummary, setRouteSummary] = useState<{
    distance: number;
    duration: number;
    steps: number;
  } | null>(null);

  const destination: Location = {
    latitude: 40.7589,
    longitude: -73.9851,
  };

  const handleRouteCalculated = (
    steps: NavigationStep[],
    distance: number,
    duration: number
  ) => {
    console.log(`Route calculated: ${distance.toFixed(1)}km, ${duration.toFixed(0)} minutes`);
    setRouteSummary({
      distance,
      duration,
      steps: steps.length,
    });
  };

  // Simulate location updates
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentLocation(prev => ({
        latitude: prev.latitude + 0.001,
        longitude: prev.longitude + 0.001,
      }));
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <View style={styles.container}>
      {routeSummary && (
        <View style={styles.summaryBar}>
          <Text style={styles.summaryText}>
            {routeSummary.distance.toFixed(1)}km • {routeSummary.duration.toFixed(0)} min • {routeSummary.steps} steps
          </Text>
        </View>
      )}
      <NavigationPanel
        currentLocation={currentLocation}
        destination={destination}
        onRouteCalculated={handleRouteCalculated}
      />
    </View>
  );
}

/**
 * Example 4: Interactive Navigation Demo
 * Allows manual location updates for testing
 */
export function InteractiveNavigationExample() {
  const [currentLocation, setCurrentLocation] = useState<Location>({
    latitude: 40.7128,
    longitude: -74.0060,
  });

  const destination: Location = {
    latitude: 40.7589,
    longitude: -73.9851,
  };

  const moveNorth = () => {
    setCurrentLocation(prev => ({
      ...prev,
      latitude: prev.latitude + 0.01,
    }));
  };

  const moveSouth = () => {
    setCurrentLocation(prev => ({
      ...prev,
      latitude: prev.latitude - 0.01,
    }));
  };

  const moveEast = () => {
    setCurrentLocation(prev => ({
      ...prev,
      longitude: prev.longitude + 0.01,
    }));
  };

  const moveWest = () => {
    setCurrentLocation(prev => ({
      ...prev,
      longitude: prev.longitude - 0.01,
    }));
  };

  const reset = () => {
    setCurrentLocation({
      latitude: 40.7128,
      longitude: -74.0060,
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.controlsContainer}>
        <Text style={styles.controlsTitle}>Manual Controls</Text>
        <View style={styles.controlsGrid}>
          <View style={styles.controlRow}>
            <Button title="↑ North" onPress={moveNorth} />
          </View>
          <View style={styles.controlRow}>
            <Button title="← West" onPress={moveWest} />
            <Button title="Reset" onPress={reset} />
            <Button title="East →" onPress={moveEast} />
          </View>
          <View style={styles.controlRow}>
            <Button title="↓ South" onPress={moveSouth} />
          </View>
        </View>
        <Text style={styles.locationText}>
          Current: {currentLocation.latitude.toFixed(4)}, {currentLocation.longitude.toFixed(4)}
        </Text>
      </View>
      <NavigationPanel
        currentLocation={currentLocation}
        destination={destination}
      />
    </View>
  );
}

/**
 * Example 5: Full Taxi Trip Flow
 * Complete example with trip lifecycle
 */
export function FullTaxiTripExample() {
  const [currentLocation, setCurrentLocation] = useState<Location>({
    latitude: 40.7128,
    longitude: -74.0060,
  });

  const [tripStatus, setTripStatus] = useState<'idle' | 'navigating' | 'completed'>('idle');
  const [currentPhase, setCurrentPhase] = useState<'pickup' | 'destination' | 'completed'>('pickup');

  const pickupLocation: Location = {
    latitude: 40.7489,
    longitude: -73.9680,
  };

  const destination: Location = {
    latitude: 40.7589,
    longitude: -73.9851,
  };

  const startTrip = () => {
    setTripStatus('navigating');
  };

  const handlePhaseChange = (phase: 'pickup' | 'destination' | 'completed') => {
    setCurrentPhase(phase);

    if (phase === 'destination') {
      console.log('Passenger picked up - starting trip to destination');
      // In real app: start meter, update trip status
    } else if (phase === 'completed') {
      console.log('Trip completed');
      setTripStatus('completed');
      // In real app: stop meter, process payment, rate passenger
    }
  };

  const handleRouteCalculated = (
    steps: NavigationStep[],
    distance: number,
    duration: number
  ) => {
    console.log(`Route: ${distance.toFixed(1)}km, ETA: ${duration.toFixed(0)} min`);
    // In real app: display fare estimate to driver
  };

  // Simulate location updates
  useEffect(() => {
    if (tripStatus === 'navigating') {
      const interval = setInterval(() => {
        setCurrentLocation(prev => ({
          latitude: prev.latitude + 0.001,
          longitude: prev.longitude + 0.001,
        }));
      }, 5000);

      return () => clearInterval(interval);
    }
  }, [tripStatus]);

  if (tripStatus === 'idle') {
    return (
      <View style={styles.container}>
        <View style={styles.idleContainer}>
          <Text style={styles.idleTitle}>New Trip Request</Text>
          <Text style={styles.idleText}>
            Pickup: {pickupLocation.latitude.toFixed(4)}, {pickupLocation.longitude.toFixed(4)}
          </Text>
          <Text style={styles.idleText}>
            Destination: {destination.latitude.toFixed(4)}, {destination.longitude.toFixed(4)}
          </Text>
          <Button title="Accept Trip" onPress={startTrip} />
        </View>
      </View>
    );
  }

  if (tripStatus === 'completed') {
    return (
      <View style={styles.container}>
        <View style={styles.completedContainer}>
          <Text style={styles.completedTitle}>Trip Completed!</Text>
          <Text style={styles.completedText}>Thank you for using our service</Text>
          <Button title="New Trip" onPress={() => setTripStatus('idle')} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.tripStatusBar}>
        <Text style={styles.tripStatusText}>
          {currentPhase === 'pickup' ? '🚕 Going to pickup' : '🎯 Passenger on board'}
        </Text>
      </View>
      <NavigationPanel
        currentLocation={currentLocation}
        destination={destination}
        pickupLocation={pickupLocation}
        onPhaseChange={handlePhaseChange}
        onRouteCalculated={handleRouteCalculated}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  statusBar: {
    backgroundColor: '#E3F2FD',
    padding: 12,
    alignItems: 'center',
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1976D2',
  },
  summaryBar: {
    backgroundColor: '#F5F5F5',
    padding: 12,
    alignItems: 'center',
  },
  summaryText: {
    fontSize: 14,
    color: '#666666',
  },
  controlsContainer: {
    backgroundColor: '#F5F5F5',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  controlsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  controlsGrid: {
    alignItems: 'center',
  },
  controlRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginVertical: 4,
  },
  locationText: {
    fontSize: 12,
    color: '#666666',
    textAlign: 'center',
    marginTop: 12,
  },
  idleContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  idleTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  idleText: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 8,
  },
  completedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  completedTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 12,
  },
  completedText: {
    fontSize: 16,
    color: '#666666',
    marginBottom: 20,
  },
  tripStatusBar: {
    backgroundColor: '#FFF9C4',
    padding: 12,
    alignItems: 'center',
  },
  tripStatusText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
  },
});
