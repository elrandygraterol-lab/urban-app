# NavigationPanel Component

## Overview

The `NavigationPanel` component provides real-time turn-by-turn navigation for drivers. It displays current navigation instructions, distance to next maneuver, visual progress tracking, and ETA updates.

## Features

- ✅ **Real-time turn-by-turn navigation** with step-by-step instructions
- ✅ **Progress tracking system** with visual progress bar
- ✅ **Next maneuver notifications** with distance and direction
- ✅ **ETA updates** based on remaining distance and duration
- ✅ **Sequential navigation** support (pickup → destination)
- ✅ **Visual maneuver icons** for intuitive direction guidance
- ✅ **Upcoming steps preview** showing next 3 maneuvers
- ✅ **Phase indicators** showing current navigation phase

## Requirements

Satisfies bugfix requirement:
- **2.4**: Real-time turn-by-turn navigation for drivers

## Installation

The component is located at `src/components/driver/NavigationPanel.tsx` and uses the `MapRoutingService` for route calculation.

```typescript
import NavigationPanel from '@/src/components/driver/NavigationPanel';
```

## Usage

### Basic Navigation

```typescript
import React, { useState } from 'react';
import NavigationPanel from '@/src/components/driver/NavigationPanel';

function DriverScreen() {
  const [currentLocation, setCurrentLocation] = useState({
    latitude: 40.7128,
    longitude: -74.0060,
  });

  const destination = {
    latitude: 40.7589,
    longitude: -73.9851,
  };

  return (
    <NavigationPanel
      currentLocation={currentLocation}
      destination={destination}
    />
  );
}
```

### Sequential Navigation (Pickup → Destination)

```typescript
import React, { useState } from 'react';
import NavigationPanel from '@/src/components/driver/NavigationPanel';

function TaxiDriverScreen() {
  const [currentLocation, setCurrentLocation] = useState({
    latitude: 40.7128,
    longitude: -74.0060,
  });

  const pickupLocation = {
    latitude: 40.7489,
    longitude: -73.9680,
  };

  const destination = {
    latitude: 40.7589,
    longitude: -73.9851,
  };

  const handlePhaseChange = (phase: 'pickup' | 'destination' | 'completed') => {
    console.log(`Navigation phase changed to: ${phase}`);
    
    if (phase === 'destination') {
      // Driver has reached pickup location
      // Update UI to show passenger pickup
    } else if (phase === 'completed') {
      // Driver has reached destination
      // Complete the trip
    }
  };

  return (
    <NavigationPanel
      currentLocation={currentLocation}
      destination={destination}
      pickupLocation={pickupLocation}
      onPhaseChange={handlePhaseChange}
    />
  );
}
```

### With Route Calculation Callback

```typescript
import React, { useState } from 'react';
import NavigationPanel from '@/src/components/driver/NavigationPanel';
import type { NavigationStep } from '@/src/services/MapRoutingService';

function DriverScreen() {
  const [currentLocation, setCurrentLocation] = useState({
    latitude: 40.7128,
    longitude: -74.0060,
  });

  const destination = {
    latitude: 40.7589,
    longitude: -73.9851,
  };

  const handleRouteCalculated = (
    steps: NavigationStep[],
    distance: number,
    duration: number
  ) => {
    console.log(`Route calculated: ${distance.toFixed(1)}km, ${duration.toFixed(0)} minutes`);
    console.log(`Total steps: ${steps.length}`);
    
    // Update map to show route
    // Display route summary to driver
  };

  return (
    <NavigationPanel
      currentLocation={currentLocation}
      destination={destination}
      onRouteCalculated={handleRouteCalculated}
    />
  );
}
```

## API Reference

### Props

#### `currentLocation` (required)
```typescript
currentLocation: Location
```
Current location of the driver. Should be updated in real-time as the driver moves.

**Type:**
```typescript
interface Location {
  latitude: number;
  longitude: number;
}
```

**Example:**
```typescript
const currentLocation = {
  latitude: 40.7128,
  longitude: -74.0060,
};
```

#### `destination` (required)
```typescript
destination: Location
```
Final destination location.

**Example:**
```typescript
const destination = {
  latitude: 40.7589,
  longitude: -73.9851,
};
```

#### `pickupLocation` (optional)
```typescript
pickupLocation?: Location
```
Optional pickup location for sequential navigation. When provided, the component will first navigate to the pickup location, then automatically transition to navigating to the destination.

**Example:**
```typescript
const pickupLocation = {
  latitude: 40.7489,
  longitude: -73.9680,
};
```

#### `onPhaseChange` (optional)
```typescript
onPhaseChange?: (phase: 'pickup' | 'destination' | 'completed') => void
```
Callback invoked when the navigation phase changes.

**Phases:**
- `'pickup'`: Navigating to pickup location
- `'destination'`: Navigating to final destination
- `'completed'`: Navigation completed (arrived at destination)

**Example:**
```typescript
const handlePhaseChange = (phase) => {
  if (phase === 'destination') {
    console.log('Driver reached pickup location');
  } else if (phase === 'completed') {
    console.log('Driver reached destination');
  }
};
```

#### `onRouteCalculated` (optional)
```typescript
onRouteCalculated?: (steps: NavigationStep[], distance: number, duration: number) => void
```
Callback invoked when a route is successfully calculated.

**Parameters:**
- `steps`: Array of navigation steps with turn-by-turn instructions
- `distance`: Total route distance in kilometers
- `duration`: Estimated travel time in minutes

**Example:**
```typescript
const handleRouteCalculated = (steps, distance, duration) => {
  console.log(`Route: ${distance}km, ${duration} min, ${steps.length} steps`);
};
```

## Components

### NavigationInstructionGenerator

Internal class that generates turn-by-turn instructions using Google Maps Directions API.

**Methods:**

#### `generateInstructions(origin, destination)`
Generate navigation instructions for a route.

**Returns:**
```typescript
{
  steps: NavigationStep[];
  distance: number; // in km
  duration: number; // in minutes
}
```

#### `findCurrentStep(currentLocation, steps)`
Find the current navigation step based on driver's location.

**Returns:** `number` (step index)

#### `calculateRemaining(currentStepIndex, steps, currentLocation)`
Calculate remaining distance and duration from current position.

**Returns:**
```typescript
{
  distance: number; // in km
  duration: number; // in minutes
}
```

## UI Elements

### Phase Indicator
Shows the current navigation phase (pickup or destination).

### Current Instruction
Large, prominent display of the current turn-by-turn instruction with:
- Maneuver icon (arrow showing direction)
- Instruction text (e.g., "Turn right onto Main St")
- Distance to maneuver (e.g., "In 200m")

### Progress Bar
Visual progress bar showing:
- Percentage of route completed
- Remaining distance
- Estimated time of arrival (ETA)

### Next Maneuver
Preview of the next turn after the current instruction.

### Upcoming Steps
Scrollable list showing the next 3 upcoming maneuvers.

## Maneuver Icons

The component displays intuitive arrow icons for different maneuvers:

| Maneuver | Icon | Description |
|----------|------|-------------|
| `turn-left` | ← | Turn left |
| `turn-right` | → | Turn right |
| `turn-slight-left` | ↖ | Slight left turn |
| `turn-slight-right` | ↗ | Slight right turn |
| `turn-sharp-left` | ⬅ | Sharp left turn |
| `turn-sharp-right` | ➡ | Sharp right turn |
| `uturn-left` | ↶ | U-turn left |
| `uturn-right` | ↷ | U-turn right |
| `merge` | ⤴ | Merge onto road |
| `roundabout-left` | ↺ | Roundabout left |
| `roundabout-right` | ↻ | Roundabout right |
| `straight` | ↑ | Continue straight |

## States

### Loading State
Displayed while calculating the initial route.

### Error State
Displayed if route calculation fails. Shows error message.

### Active Navigation State
Main navigation UI with instructions, progress, and upcoming steps.

### Completed State
Displayed when driver arrives at destination. Shows success message.

## Real-Time Updates

The component automatically updates navigation progress as the driver moves:

1. **Location Updates**: Pass updated `currentLocation` prop as driver moves
2. **Step Detection**: Automatically detects when driver completes a step
3. **Progress Calculation**: Updates remaining distance and duration
4. **ETA Updates**: Recalculates ETA based on current progress
5. **Phase Transitions**: Automatically transitions from pickup to destination phase

## Sequential Navigation Flow

When `pickupLocation` is provided:

1. **Phase 1 - Pickup Navigation**
   - Navigate to pickup location
   - Display "Navigating to Pickup" indicator
   - Show turn-by-turn instructions to pickup

2. **Phase 2 - Destination Navigation**
   - Automatically triggered when driver reaches pickup (within 50m)
   - Display "Navigating to Destination" indicator
   - Show turn-by-turn instructions to destination
   - Calls `onPhaseChange('destination')`

3. **Phase 3 - Completed**
   - Triggered when driver reaches destination (within 50m)
   - Display "You have arrived!" message
   - Calls `onPhaseChange('completed')`

## Integration with MapRoutingService

The component uses `MapRoutingService` for route calculation:

```typescript
import { mapRoutingService } from '@/src/services/MapRoutingService';

// Calculate taxi-optimized route
const route = await mapRoutingService.calculateTaxiRoute(origin, destination);

// Extract navigation steps
const steps = route.steps || [];
```

## Styling

The component uses React Native StyleSheet with a clean, modern design:

- **Primary Color**: Blue (#2196F3) for maneuver icons
- **Success Color**: Green (#4CAF50) for progress and completion
- **Background**: White (#FFFFFF) with light gray accents
- **Text**: Dark gray (#333333) for primary text, lighter gray for secondary

## Performance Considerations

- **Efficient Updates**: Only recalculates progress when location changes
- **Memoized Callbacks**: Uses `useCallback` to prevent unnecessary re-renders
- **Lazy Calculation**: Only calculates route when needed
- **Automatic Cleanup**: Properly manages state and effects

## Error Handling

The component handles errors gracefully:

1. **Route Calculation Errors**: Displays error message, allows retry
2. **API Failures**: Falls back to MapRoutingService's fallback mechanism
3. **Invalid Locations**: Validates locations before calculation
4. **Network Issues**: Shows appropriate error messages

## Testing

### Unit Tests

Test the component with different scenarios:

```typescript
import { render, waitFor } from '@testing-library/react-native';
import NavigationPanel from './NavigationPanel';

test('displays current instruction', async () => {
  const { getByText } = render(
    <NavigationPanel
      currentLocation={{ latitude: 40.7128, longitude: -74.0060 }}
      destination={{ latitude: 40.7589, longitude: -73.9851 }}
    />
  );

  await waitFor(() => {
    expect(getByText(/Turn/)).toBeTruthy();
  });
});
```

### Integration Tests

Test with real location updates:

```typescript
test('updates progress as driver moves', async () => {
  const { rerender, getByText } = render(
    <NavigationPanel
      currentLocation={{ latitude: 40.7128, longitude: -74.0060 }}
      destination={{ latitude: 40.7589, longitude: -73.9851 }}
    />
  );

  // Simulate driver movement
  rerender(
    <NavigationPanel
      currentLocation={{ latitude: 40.7200, longitude: -74.0000 }}
      destination={{ latitude: 40.7589, longitude: -73.9851 }}
    />
  );

  await waitFor(() => {
    expect(getByText(/remaining/)).toBeTruthy();
  });
});
```

## Troubleshooting

### Route Not Calculating
**Issue**: Component stuck in loading state

**Solutions:**
1. Verify Google Maps API key is configured
2. Check network connectivity
3. Ensure locations are valid coordinates
4. Check console for error messages

### Progress Not Updating
**Issue**: Navigation doesn't update as driver moves

**Solutions:**
1. Ensure `currentLocation` prop is being updated
2. Verify location updates are frequent enough (every 1-5 seconds)
3. Check that location coordinates are changing

### Phase Not Transitioning
**Issue**: Doesn't transition from pickup to destination

**Solutions:**
1. Verify driver is within 50m of pickup location
2. Check that `pickupLocation` prop is provided
3. Ensure location updates are accurate

## Related Documentation

- [MapRoutingService](../../services/MapRoutingService.README.md)
- [Google Maps Directions API](https://developers.google.com/maps/documentation/directions)
- [React Native Location](https://docs.expo.dev/versions/latest/sdk/location/)

## License

Part of the taxi app project.
