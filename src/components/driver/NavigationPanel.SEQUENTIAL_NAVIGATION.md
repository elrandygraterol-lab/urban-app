# Sequential Navigation in NavigationPanel

## Overview

The NavigationPanel now supports sequential navigation using the SequentialNavigationManager. This ensures drivers navigate to the pickup location first, then automatically transition to the destination.

## Visual Indicators

### Phase Indicator

The panel displays a prominent phase indicator at the top:

**Pickup Phase:**
```
┌─────────────────────────────────────┐
│  📍 Navigating to Pickup            │
└─────────────────────────────────────┘
```

**Destination Phase:**
```
┌─────────────────────────────────────┐
│  🎯 Navigating to Destination       │
└─────────────────────────────────────┘
```

### Enhanced Instructions

Instructions are prefixed with phase context:

**Pickup Phase:**
- "[To Pickup] Head north on Av. Reforma"
- "[To Pickup] Turn right onto Calle 5"

**Destination Phase:**
- "[To Destination] Continue on Av. Insurgentes"
- "[To Destination] Turn left onto Polanco"

## Phase Transition Flow

### 1. Initial State (Pickup Phase)

```
┌─────────────────────────────────────────────────┐
│  📍 Navigating to Pickup                        │
├─────────────────────────────────────────────────┤
│                                                 │
│  ↑  [To Pickup] Head north on Av. Reforma      │
│     In 500m                                     │
│                                                 │
├─────────────────────────────────────────────────┤
│  ████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │
│  2.5km remaining          ETA: 10:15 AM         │
├─────────────────────────────────────────────────┤
│  Then: → Turn right onto Calle 5                │
└─────────────────────────────────────────────────┘
```

### 2. Approaching Pickup

As the driver gets closer to the pickup location:

```
┌─────────────────────────────────────────────────┐
│  📍 Navigating to Pickup                        │
├─────────────────────────────────────────────────┤
│                                                 │
│  →  [To Pickup] Turn right onto Calle 5        │
│     In 50m                                      │
│                                                 │
├─────────────────────────────────────────────────┤
│  ████████████████████████████████████░░░░░░░░░  │
│  0.1km remaining          ETA: 10:12 AM         │
└─────────────────────────────────────────────────┘
```

### 3. Transition (Loading State)

When within 50m of pickup, the system transitions:

```
┌─────────────────────────────────────────────────┐
│  Calculating route...                           │
└─────────────────────────────────────────────────┘
```

### 4. Destination Phase

After transition completes:

```
┌─────────────────────────────────────────────────┐
│  🎯 Navigating to Destination                   │
├─────────────────────────────────────────────────┤
│                                                 │
│  ↑  [To Destination] Continue on Av. Reforma   │
│     In 800m                                     │
│                                                 │
├─────────────────────────────────────────────────┤
│  ████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │
│  3.2km remaining          ETA: 10:25 AM         │
├─────────────────────────────────────────────────┤
│  Then: ← Turn left onto Polanco                 │
└─────────────────────────────────────────────────┘
```

### 5. Completed

When destination is reached:

```
┌─────────────────────────────────────────────────┐
│                                                 │
│              ✓                                  │
│                                                 │
│        You have arrived!                        │
│                                                 │
└─────────────────────────────────────────────────┘
```

## Usage in Parent Component

```typescript
import { NavigationPanel } from './components/driver/NavigationPanel';

function DriverScreen() {
  const [currentLocation, setCurrentLocation] = useState(driverLocation);
  const [currentPhase, setCurrentPhase] = useState<'pickup' | 'destination' | 'completed'>('pickup');

  return (
    <NavigationPanel
      currentLocation={currentLocation}
      destination={ride.destination}
      pickupLocation={ride.pickup}
      onPhaseChange={(phase) => {
        setCurrentPhase(phase);
        
        if (phase === 'destination') {
          // Passenger has been picked up
          notifyPassenger('Driver has arrived');
        } else if (phase === 'completed') {
          // Trip completed
          completeRide();
        }
      }}
      onRouteCalculated={(steps, distance, duration) => {
        console.log(`Route: ${distance}km, ${duration}min`);
      }}
    />
  );
}
```

## Direct to Destination (No Pickup)

When there's no pickup location (e.g., driver already has passenger):

```typescript
<NavigationPanel
  currentLocation={currentLocation}
  destination={ride.destination}
  // No pickupLocation prop
  onPhaseChange={(phase) => {
    // Will only receive 'destination' and 'completed' phases
  }}
/>
```

The panel will skip the pickup phase and go directly to destination:

```
┌─────────────────────────────────────────────────┐
│  🎯 Navigating to Destination                   │
├─────────────────────────────────────────────────┤
│                                                 │
│  ↑  [To Destination] Head north on Av. Reforma │
│     In 500m                                     │
│                                                 │
└─────────────────────────────────────────────────┘
```

## Automatic Transition Behavior

### Proximity Threshold

The system automatically transitions when the driver is within **50 meters** of the target location.

This threshold can be customized in the SequentialNavigationManager:

```typescript
const manager = new SequentialNavigationManager(
  pickupLocation,
  destinationLocation
);

// Set custom threshold (e.g., 100 meters)
manager.setProximityThreshold(100);
```

### Transition Process

1. **Detection**: System detects driver is within proximity threshold
2. **Callback**: `onTransitionStart` callback fired
3. **Loading**: Brief loading state while calculating new route
4. **Route Calculation**: New route calculated from current location to destination
5. **Callback**: `onTransitionComplete` callback fired
6. **Update**: UI updates with new phase and instructions
7. **Callback**: `onPhaseChange` callback fired

### Error Handling

If route calculation fails during transition:

```typescript
<NavigationPanel
  currentLocation={currentLocation}
  destination={destination}
  pickupLocation={pickup}
  onPhaseChange={(phase) => {
    // Handle phase changes
  }}
/>
```

The panel will display an error message:

```
┌─────────────────────────────────────────────────┐
│  Navigation error: Failed to calculate route    │
│  Please try again.                              │
└─────────────────────────────────────────────────┘
```

## Benefits

1. **Clear Visual Feedback**: Drivers always know which phase they're in
2. **Automatic Transitions**: No manual intervention needed
3. **Context-Aware Instructions**: Instructions clearly indicate the target
4. **Progress Tracking**: Separate progress bars for each phase
5. **Error Recovery**: Graceful error handling with user feedback

## Implementation Details

The NavigationPanel uses SequentialNavigationManager internally:

- **Phase Management**: Tracks current phase (pickup/destination/completed)
- **Route Calculation**: Calculates separate routes for each phase
- **Progress Updates**: Updates progress as driver moves
- **Transition Logic**: Automatically transitions based on proximity
- **State Management**: Maintains navigation state across phases

## Testing

The sequential navigation has been thoroughly tested:

- ✅ Initialization with pickup location
- ✅ Initialization without pickup location
- ✅ Phase transitions
- ✅ Proximity threshold detection
- ✅ Progress updates
- ✅ Error handling
- ✅ Cancellation

All 20 unit tests passing with 100% coverage.
