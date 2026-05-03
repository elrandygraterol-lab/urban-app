# MapRoutingService

## Overview

The `MapRoutingService` provides road-based routing using Google Maps Directions API. It replaces straight-line routing with real road network calculations, ensuring routes follow actual roads and available routes.

## Features

- ✅ **Road-based routing** using Google Maps Directions API
- ✅ **Turn-by-turn navigation** with detailed step instructions
- ✅ **Vehicle-specific routing options** (avoid tolls, prefer highways, etc.)
- ✅ **Automatic fallback** to straight-line routing on API failures
- ✅ **Cross-platform support** (iOS, Android, Web)
- ✅ **Polyline decoding** for efficient route coordinate transmission
- ✅ **Route validation** against road networks

## Requirements

Satisfies bugfix requirements:
- **2.1**: Routes follow actual roads and available routes
- **2.7**: Trajectories follow real roads and respect traffic restrictions

## Installation

The service is automatically initialized with the Google Maps API key from environment variables:

```typescript
import mapRoutingService from '@/src/services/MapRoutingService';

// Service is ready to use - no initialization needed
```

## Configuration

Set the Google Maps API key in your `.env` file:

```bash
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
```

## Usage

### Basic Route Calculation

```typescript
import mapRoutingService from '@/src/services/MapRoutingService';

const origin = { latitude: 40.7128, longitude: -74.0060 };
const destination = { latitude: 40.7589, longitude: -73.9851 };

const route = await mapRoutingService.calculateRoute(origin, destination);

console.log(`Distance: ${route.distance} km`);
console.log(`Duration: ${route.duration} minutes`);
console.log(`Coordinates: ${route.coordinates.length} points`);
```

### Taxi-Optimized Routing

Use the `calculateTaxiRoute` method for taxi-specific routing (avoids tolls, prefers highways):

```typescript
const route = await mapRoutingService.calculateTaxiRoute(origin, destination);
```

### Custom Routing Options

```typescript
const route = await mapRoutingService.calculateRoute(origin, destination, {
  avoidTolls: true,
  avoidHighways: false,
  avoidFerries: true,
  optimizeWaypoints: true,
});
```

### Vehicle Routing Presets

Use predefined routing presets for different vehicle types:

```typescript
import { VehicleRoutingPresets } from '@/src/services/MapRoutingService';

// Taxi preset (avoid tolls, prefer highways)
const taxiRoute = await mapRoutingService.calculateRoute(
  origin,
  destination,
  VehicleRoutingPresets.TAXI
);

// Economy preset (avoid tolls and highways)
const economyRoute = await mapRoutingService.calculateRoute(
  origin,
  destination,
  VehicleRoutingPresets.ECONOMY
);

// Fast preset (prefer highways, allow tolls)
const fastRoute = await mapRoutingService.calculateRoute(
  origin,
  destination,
  VehicleRoutingPresets.FAST
);
```

### Turn-by-Turn Navigation

Access navigation steps for turn-by-turn instructions:

```typescript
const route = await mapRoutingService.calculateRoute(origin, destination);

route.steps?.forEach((step, index) => {
  console.log(`Step ${index + 1}: ${step.instruction}`);
  console.log(`  Distance: ${step.distance}m`);
  console.log(`  Duration: ${step.duration}s`);
  console.log(`  Maneuver: ${step.maneuver || 'none'}`);
});
```

### Route Validation

Validate if a route follows actual roads:

```typescript
const coordinates = [
  { latitude: 40.7128, longitude: -74.0060 },
  { latitude: 40.7589, longitude: -73.9851 },
];

const isValid = await mapRoutingService.validateRoute(coordinates);
console.log(`Route is valid: ${isValid}`);
```

## API Reference

### Types

#### `Location`
```typescript
interface Location {
  latitude: number;
  longitude: number;
}
```

#### `RouteOptions`
```typescript
interface RouteOptions {
  avoidTolls?: boolean;        // Avoid toll roads
  avoidHighways?: boolean;     // Avoid highways
  avoidFerries?: boolean;      // Avoid ferries
  optimizeWaypoints?: boolean; // Optimize waypoint order
}
```

#### `RouteResult`
```typescript
interface RouteResult {
  coordinates: Array<{ latitude: number; longitude: number }>;
  distance: number;  // in kilometers
  duration: number;  // in minutes
  steps?: NavigationStep[];
  bounds?: {
    northeast: Location;
    southwest: Location;
  };
}
```

#### `NavigationStep`
```typescript
interface NavigationStep {
  instruction: string;     // Human-readable instruction
  distance: number;        // in meters
  duration: number;        // in seconds
  startLocation: Location;
  endLocation: Location;
  maneuver?: string;       // e.g., 'turn-left', 'turn-right'
}
```

### Methods

#### `calculateRoute(origin, destination, options?)`
Calculate a route between two locations using Google Maps Directions API.

**Parameters:**
- `origin: Location` - Starting location
- `destination: Location` - Ending location
- `options?: RouteOptions` - Optional routing preferences

**Returns:** `Promise<RouteResult>`

**Example:**
```typescript
const route = await mapRoutingService.calculateRoute(
  { latitude: 40.7128, longitude: -74.0060 },
  { latitude: 40.7589, longitude: -73.9851 },
  { avoidTolls: true }
);
```

#### `calculateTaxiRoute(origin, destination)`
Calculate a route optimized for taxi/ride-sharing (avoids tolls, prefers highways).

**Parameters:**
- `origin: Location` - Starting location
- `destination: Location` - Ending location

**Returns:** `Promise<RouteResult>`

**Example:**
```typescript
const route = await mapRoutingService.calculateTaxiRoute(origin, destination);
```

#### `validateRoute(coordinates)`
Validate if a route follows actual roads.

**Parameters:**
- `coordinates: Array<Location>` - Array of coordinates to validate

**Returns:** `Promise<boolean>`

**Example:**
```typescript
const isValid = await mapRoutingService.validateRoute([origin, destination]);
```

#### `getFallbackRoute(origin, destination)`
Get a fallback straight-line route (used when API fails).

**Parameters:**
- `origin: Location` - Starting location
- `destination: Location` - Ending location

**Returns:** `RouteResult`

**Example:**
```typescript
const fallbackRoute = mapRoutingService.getFallbackRoute(origin, destination);
```

## Error Handling

The service includes comprehensive error handling:

1. **Missing API Key**: Returns fallback straight-line route
2. **API Errors**: Catches and logs errors, returns fallback route
3. **Network Failures**: Automatically falls back to straight-line routing
4. **Invalid Responses**: Validates API responses and handles errors gracefully

```typescript
try {
  const route = await mapRoutingService.calculateRoute(origin, destination);
  // Use route data
} catch (error) {
  // Service automatically returns fallback route on error
  // No need for explicit error handling
}
```

## Fallback Mechanism

When the Google Maps API is unavailable or returns an error, the service automatically falls back to a straight-line route using the Haversine formula:

```typescript
// Automatic fallback on API failure
const route = await mapRoutingService.calculateRoute(origin, destination);
// Returns either:
// - Road-based route from Google Maps (preferred)
// - Straight-line fallback route (on error)
```

## Platform Support

### iOS & Android
Uses Google Maps Directions REST API via fetch.

### Web
Can use either:
- Google Maps JavaScript API (if loaded)
- Google Maps Directions REST API (fallback)

## Performance Considerations

- **Polyline Encoding**: Routes use Google's polyline encoding for efficient data transmission
- **Caching**: Consider implementing route caching for frequently requested routes
- **Rate Limiting**: Be aware of Google Maps API quotas and rate limits

## Testing

Run the test suite:

```bash
npm test -- src/services/__tests__/MapRoutingService.test.ts
```

## Migration from Straight-Line Routing

### Before (Straight-Line)
```typescript
// Old: Straight-line calculation
const distance = calculateHaversineDistance(origin, destination);
const route = { coordinates: [origin, destination], distance };
```

### After (Road-Based)
```typescript
// New: Road-based routing
const route = await mapRoutingService.calculateRoute(origin, destination);
// route.coordinates follows actual roads
// route.distance is accurate road distance
// route.steps provides turn-by-turn navigation
```

## Troubleshooting

### API Key Not Configured
```
[MapRoutingService] Google Maps API key not configured
```
**Solution**: Set `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` in your `.env` file

### API Request Denied
```
[MapRoutingService] Google Maps API error: REQUEST_DENIED
```
**Solution**: 
1. Verify API key is correct
2. Enable Directions API in Google Cloud Console
3. Check API key restrictions

### Quota Exceeded
```
[MapRoutingService] Google Maps API error: OVER_QUERY_LIMIT
```
**Solution**: 
1. Check your Google Cloud Console quota
2. Implement route caching
3. Consider upgrading your API plan

## Related Documentation

- [Google Maps Directions API](https://developers.google.com/maps/documentation/directions)
- [Polyline Encoding Algorithm](https://developers.google.com/maps/documentation/utilities/polylinealgorithm)
- [React Native Maps](https://github.com/react-native-maps/react-native-maps)

## License

Part of the taxi app project.
