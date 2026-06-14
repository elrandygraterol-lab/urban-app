/**
 * SequentialNavigationManager Usage Examples
 *
 * This file demonstrates various usage patterns for the SequentialNavigationManager.
 */

import { SequentialNavigationManager } from './SequentialNavigationManager';
import { Location } from './MapRoutingService';

// Example 1: Basic Sequential Navigation (Pickup → Destination)
export async function basicSequentialNavigation() {
  const currentLocation: Location = {
    latitude: 19.4326,
    longitude: -99.1332,
  };

  const pickupLocation: Location = {
    latitude: 19.435,
    longitude: -99.14,
  };

  const destinationLocation: Location = {
    latitude: 19.4284,
    longitude: -99.1276,
  };

  const manager = new SequentialNavigationManager(pickupLocation, destinationLocation, {
    onPhaseChange: (phase, config) => {
      console.log(`Phase changed to: ${phase}`);
      console.log(`Distance: ${config.distance.toFixed(2)} km`);
      console.log(`Duration: ${config.duration.toFixed(0)} minutes`);
      console.log(`ETA: ${config.eta.toLocaleTimeString()}`);
    },
    onStepChange: (stepIndex, step) => {
      console.log(`Step ${stepIndex + 1}: ${step.instruction}`);
      console.log(`Distance to next turn: ${step.distance}m`);
    },
    onNavigationComplete: () => {
      console.log('Navigation completed! Trip finished.');
    },
  });

  // Initialize navigation
  await manager.initialize(currentLocation);

  // Simulate progress updates
  // In a real app, this would be called when GPS location updates
  await manager.updateProgress(currentLocation);
}

// Example 2: Direct to Destination (No Pickup)
export async function directToDestination() {
  const currentLocation: Location = {
    latitude: 19.4326,
    longitude: -99.1332,
  };

  const destinationLocation: Location = {
    latitude: 19.4284,
    longitude: -99.1276,
  };

  // No pickup location - goes directly to destination
  const manager = new SequentialNavigationManager(
    undefined, // No pickup
    destinationLocation,
    {
      onPhaseChange: (phase, config) => {
        console.log(`Navigating directly to destination`);
        console.log(`Distance: ${config.distance.toFixed(2)} km`);
      },
    }
  );

  await manager.initialize(currentLocation);
}

// Example 3: Monitoring Navigation State
export async function monitorNavigationState() {
  const currentLocation: Location = {
    latitude: 19.4326,
    longitude: -99.1332,
  };

  const pickupLocation: Location = {
    latitude: 19.435,
    longitude: -99.14,
  };

  const destinationLocation: Location = {
    latitude: 19.4284,
    longitude: -99.1276,
  };

  const manager = new SequentialNavigationManager(pickupLocation, destinationLocation);

  await manager.initialize(currentLocation);

  // Get current state
  const state = manager.getState();
  console.log('Current phase:', state.currentPhase);
  console.log('Current step index:', state.currentStepIndex);
  console.log('Is transitioning:', state.isTransitioning);

  // Get current phase configuration
  const phaseConfig = manager.getCurrentPhaseConfig();
  if (phaseConfig) {
    console.log('Phase:', phaseConfig.phase);
    console.log('Target:', phaseConfig.target);
    console.log('Total steps:', phaseConfig.instructions.length);
  }

  // Get current step
  const currentStep = manager.getCurrentStep();
  if (currentStep) {
    console.log('Current instruction:', currentStep.instruction);
    console.log('Maneuver:', currentStep.maneuver);
  }

  // Get remaining distance and duration
  const remainingDistance = manager.getRemainingDistance(currentLocation);
  const remainingDuration = manager.getRemainingDuration(currentLocation);
  console.log(`Remaining: ${remainingDistance.toFixed(2)} km, ${remainingDuration.toFixed(0)} min`);
}

// Example 4: Custom Proximity Threshold
export async function customProximityThreshold() {
  const currentLocation: Location = {
    latitude: 19.4326,
    longitude: -99.1332,
  };

  const pickupLocation: Location = {
    latitude: 19.435,
    longitude: -99.14,
  };

  const destinationLocation: Location = {
    latitude: 19.4284,
    longitude: -99.1276,
  };

  const manager = new SequentialNavigationManager(pickupLocation, destinationLocation);

  // Set custom proximity threshold (default is 50 meters)
  manager.setProximityThreshold(100); // 100 meters

  await manager.initialize(currentLocation);
}

// Example 5: Error Handling
export async function errorHandling() {
  const currentLocation: Location = {
    latitude: 19.4326,
    longitude: -99.1332,
  };

  const destinationLocation: Location = {
    latitude: 19.4284,
    longitude: -99.1276,
  };

  const manager = new SequentialNavigationManager(undefined, destinationLocation, {
    onError: (error, phase) => {
      console.error(`Error in ${phase} phase:`, error.message);

      // Handle specific error types
      if (error.message.includes('API')) {
        console.log('API error - showing fallback route');
      } else if (error.message.includes('network')) {
        console.log('Network error - retrying...');
      }
    },
  });

  try {
    await manager.initialize(currentLocation);
  } catch (error) {
    console.error('Failed to initialize navigation:', error);
  }
}

// Example 6: Phase Transition Tracking
export async function trackPhaseTransitions() {
  const currentLocation: Location = {
    latitude: 19.4326,
    longitude: -99.1332,
  };

  const pickupLocation: Location = {
    latitude: 19.435,
    longitude: -99.14,
  };

  const destinationLocation: Location = {
    latitude: 19.4284,
    longitude: -99.1276,
  };

  const manager = new SequentialNavigationManager(pickupLocation, destinationLocation, {
    onTransitionStart: (fromPhase, toPhase) => {
      console.log(`Starting transition from ${fromPhase} to ${toPhase}`);
      // Show loading indicator
    },
    onTransitionComplete: (phase, config) => {
      console.log(`Transition complete to ${phase}`);
      console.log(`New route: ${config.distance.toFixed(2)} km`);
      // Hide loading indicator
      // Update UI with new route
    },
  });

  await manager.initialize(currentLocation);
}

// Example 7: Real-time Progress Updates
export async function realTimeProgressUpdates() {
  const pickupLocation: Location = {
    latitude: 19.435,
    longitude: -99.14,
  };

  const destinationLocation: Location = {
    latitude: 19.4284,
    longitude: -99.1276,
  };

  let currentLocation: Location = {
    latitude: 19.4326,
    longitude: -99.1332,
  };

  const manager = new SequentialNavigationManager(pickupLocation, destinationLocation, {
    onStepChange: (stepIndex, step) => {
      // Update UI with new instruction
      console.log(`New instruction: ${step.instruction}`);
    },
  });

  await manager.initialize(currentLocation);

  // Simulate GPS updates every second
  const updateInterval = setInterval(async () => {
    // In a real app, get actual GPS location
    // currentLocation = await getGPSLocation();

    await manager.updateProgress(currentLocation);

    // Display current navigation info
    const step = manager.getCurrentStep();
    const remaining = manager.getRemainingDistance(currentLocation);

    if (step) {
      console.log(`Current: ${step.instruction}`);
      console.log(`Remaining: ${remaining.toFixed(2)} km`);
    }

    // Check if completed
    if (manager.getCurrentPhase() === 'completed') {
      clearInterval(updateInterval);
      console.log('Navigation completed!');
    }
  }, 1000);
}

// Example 8: Manual Phase Transition (for testing)
export async function manualPhaseTransition() {
  const currentLocation: Location = {
    latitude: 19.4326,
    longitude: -99.1332,
  };

  const pickupLocation: Location = {
    latitude: 19.435,
    longitude: -99.14,
  };

  const destinationLocation: Location = {
    latitude: 19.4284,
    longitude: -99.1276,
  };

  const manager = new SequentialNavigationManager(pickupLocation, destinationLocation);

  await manager.initialize(currentLocation);

  console.log('Current phase:', manager.getCurrentPhase()); // 'pickup'

  // Force transition to destination phase (useful for testing)
  await manager.forceTransition(pickupLocation);

  console.log('Current phase:', manager.getCurrentPhase()); // 'destination'
}

// Example 9: Cancelling Navigation
export async function cancelNavigation() {
  const currentLocation: Location = {
    latitude: 19.4326,
    longitude: -99.1332,
  };

  const destinationLocation: Location = {
    latitude: 19.4284,
    longitude: -99.1276,
  };

  const manager = new SequentialNavigationManager(undefined, destinationLocation);

  await manager.initialize(currentLocation);

  // User cancels the ride
  manager.cancel();

  console.log('Navigation cancelled');
  console.log('Current phase:', manager.getCurrentPhase()); // 'completed'
}

// Example 10: Integration with React Component
export function useSequentialNavigation(
  currentLocation: Location,
  pickupLocation: Location | undefined,
  destinationLocation: Location
) {
  // This would be used in a React component with useState and useEffect

  const manager = new SequentialNavigationManager(pickupLocation, destinationLocation, {
    onPhaseChange: (phase, config) => {
      // Update component state
      console.log('Phase changed:', phase);
    },
    onStepChange: (stepIndex, step) => {
      // Update current instruction in UI
      console.log('Step changed:', step.instruction);
    },
    onNavigationComplete: () => {
      // Show completion message
      console.log('Navigation complete!');
    },
  });

  return manager;
}
