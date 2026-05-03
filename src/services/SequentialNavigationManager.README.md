# SequentialNavigationManager

## Overview

The `SequentialNavigationManager` manages two-phase navigation for taxi rides: pickup → destination. It automatically handles transitions between phases, provides phase-specific instructions, and maintains navigation state throughout the journey.

## Requirements

**Validates: Requirement 2.5** - Sequential navigation from pickup to destination

## Features

- **Two-Phase Navigation**: Manages pickup and destination phases separately
- **Automatic Transitions**: Automatically transitions from pickup to destination when proximity threshold is met
- **Phase-Specific Instructions**: Enhances navigation instructions with phase context
- **Progress Tracking**: Tracks current step, remaining distance, and ETA for each phase
- **Flexible Callbacks**: Provides callbacks for phase changes, step changes, transitions, and errors
- **Configurable Thresholds**: Allows customization of proximity threshold for phase completion

## Usage

### Basic Usage

```typescript
import { SequentialNavigationManager } from './services/SequentialNavigationManager';

// Create manager with pickup and destination
const manager = new SequentialNavigationManager(
  pickupLocation,
  destinationLocation,
  {
    onPhaseChange: (phase, config) => {
      console.log('Phase changed to:', phase);
      console.log('Route distance:', config.distance, 'km');
      console.log('ETA:', config.eta);
    },
    onNavigationComplete: () => {
      console.log('Navigation completed!');
    },
  }
);

// Initialize navigation
await manager.initialize(currentLocation);

// Update progress as driver moves
await manager.updateProgress(currentLocation);
```

### Without Pickup Location

If there's no pickup location (direct to destination):

```typescript
const manager = new SequentialNavigationManager(
  undefined, // No pickup
  destinationLocation,
  callbacks
);
```

### Available Callbacks

```typescript
interface SequentialNavigationCallbacks {
  // Called when phase changes (pickup → destination → completed)
  onPhaseChange?: (phase: NavigationPhase, config: NavigationPhaseConfig) => void;
  
  // Called when current step changes
  onStepChange?: (stepIndex: number, step: NavigationStep) => void;
  
  // Called when transition starts
  onTransitionStart?: (fromPhase: NavigationPhase, toPhase: NavigationPhase) => void;
  
  // Called when transition completes
  onTransitionComplete?: (phase: NavigationPhase, config: NavigationPhaseConfig) => void;
  
  // Called when navigation is complete
  onNavigationComplete?: () => void;
  
  // Called on errors
  onError?: (error: Error, phase: NavigationPhase) => void;
}
```

## API Reference

### Constructor

```typescript
constructor(
  pickupLocation: Location | undefined,
  destinationLocation: Location,
  callbacks: SequentialNavigationCallbacks = {}
)
```

### Methods

#### `initialize(currentLocation: Location): Promise<void>`

Initializes navigation by calculating routes for all phases. Must be called before using other methods.

#### `updateProgress(currentLocation: Location): Promise<void>`

Updates navigation progress based on current location. Handles step progression and automatic phase transitions.

#### `getCurrentPhaseConfig(): NavigationPhaseConfig | undefined`

Returns the configuration for the current navigation phase.

#### `getState(): SequentialNavigationState`

Returns the current navigation state.

#### `getCurrentPhase(): NavigationPhase`

Returns the current phase: 'pickup', 'destination', or 'completed'.

#### `getCurrentStep(): NavigationStep | undefined`

Returns the current navigation step.

#### `getRemainingDistance(currentLocation: Location): number`

Returns remaining distance for current phase in kilometers.

#### `getRemainingDuration(currentLocation: Location): number`

Returns remaining duration for current phase in minutes.

#### `setProximityThreshold(meters: number): void`

Sets the proximity threshold for phase completion (default: 50 meters).

#### `forceTransition(currentLocation: Location): Promise<void>`

Forces transition to next phase (useful for testing or manual control).

#### `cancel(): void`

Cancels navigation and cleans up state.

## Types

### NavigationPhase

```typescript
type NavigationPhase = 'pickup' | 'destination' | 'completed';
```

### NavigationPhaseConfig

```typescript
interface NavigationPhaseConfig {
  phase: NavigationPhase;
  target: Location;
  instructions: NavigationStep[];
  distance: number; // in km
  duration: number; // in minutes
  eta: Date;
}
```

### SequentialNavigationState

```typescript
interface SequentialNavigationState {
  currentPhase: NavigationPhase;
  pickupConfig?: NavigationPhaseConfig;
  destinationConfig?: NavigationPhaseConfig;
  currentStepIndex: number;
  isTransitioning: boolean;
}
```

## Phase Transitions

The manager automatically transitions between phases when the driver reaches the target location:

1. **Pickup Phase**: Driver navigates to pickup location
   - Instructions prefixed with "[To Pickup]"
   - When within 50m of pickup, transitions to destination phase

2. **Destination Phase**: Driver navigates to destination
   - Instructions prefixed with "[To Destination]"
   - When within 50m of destination, marks navigation as completed

3. **Completed**: Navigation finished
   - No active navigation
   - `onNavigationComplete` callback triggered

## Integration with NavigationPanel

The `NavigationPanel` component uses `SequentialNavigationManager` internally:

```typescript
<NavigationPanel
  currentLocation={driverLocation}
  destination={rideDestination}
  pickupLocation={ridePickup}
  onPhaseChange={(phase) => {
    console.log('Navigation phase:', phase);
  }}
  onRouteCalculated={(steps, distance, duration) => {
    console.log('Route calculated:', distance, 'km,', duration, 'min');
  }}
/>
```

## Error Handling

The manager handles errors gracefully:

- API failures during route calculation
- Invalid locations
- Network errors

All errors are reported via the `onError` callback with the error and affected phase.

## Example: Complete Flow

```typescript
// 1. Create manager
const manager = new SequentialNavigationManager(
  { latitude: 19.4326, longitude: -99.1332 }, // Pickup
  { latitude: 19.4284, longitude: -99.1276 }, // Destination
  {
    onPhaseChange: (phase, config) => {
      if (phase === 'pickup') {
        console.log('Navigating to pickup:', config.distance, 'km');
      } else if (phase === 'destination') {
        console.log('Picked up passenger, navigating to destination');
      }
    },
    onNavigationComplete: () => {
      console.log('Trip completed!');
    },
  }
);

// 2. Initialize
await manager.initialize(currentLocation);

// 3. Update in a loop (e.g., every second)
setInterval(async () => {
  const currentLocation = await getCurrentGPSLocation();
  await manager.updateProgress(currentLocation);
  
  // Display current instruction
  const step = manager.getCurrentStep();
  if (step) {
    console.log('Current instruction:', step.instruction);
    console.log('Distance to next turn:', step.distance, 'm');
  }
}, 1000);
```

## Testing

The manager can be tested with mock locations:

```typescript
// Test pickup phase
const manager = new SequentialNavigationManager(pickup, destination, callbacks);
await manager.initialize(startLocation);

// Simulate movement toward pickup
await manager.updateProgress(nearPickupLocation);

// Verify transition to destination phase
expect(manager.getCurrentPhase()).toBe('destination');
```

## Performance Considerations

- Route calculations are performed only when needed (initialization and phase transitions)
- Progress updates are lightweight (distance calculations only)
- Callbacks are optional and only called when state changes
- Manager can be cancelled to free resources

## Related Components

- `MapRoutingService`: Provides road-based routing using Google Maps API
- `NavigationPanel`: UI component that uses SequentialNavigationManager
- `NavigationInstructionGenerator`: Deprecated, replaced by SequentialNavigationManager
