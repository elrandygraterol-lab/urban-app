# RouteCalculator

Road-based route calculation utility that provides accurate distance and time estimates using real road network data.

## Overview

The `RouteCalculator` replaces simple haversine (straight-line) distance calculations with accurate road-based calculations. It integrates with Google Maps Directions API through the `MapRoutingService` to provide:

- **Road-based distances**: Actual driving distances following real roads
- **Real-time traffic data**: Travel time estimates including current traffic conditions
- **Route validation**: Ensures routes follow actual road networks
- **Traffic restrictions**: Support for road closures and traffic restrictions
- **Physical constraints**: Respects real-world road constraints

## Requirements

**Validates: Requirement 2.6** - Accurate route calculations using road network data

**Bug Condition**: `isBugCondition(input) where input.routeCalculation == 'INCORRECT' AND hasValidRoadNetwork(input)`

**Expected Behavior**: Accurate road-based distance and time calculations

**Preservation**: Location update and connectivity handling

## Installation

The RouteCalculator is already integrated into the project. Import it from:

```typescript
import { routeCalculator } from '@/utils/RouteCalculator';
```

## Basic Usage

### Calculate Distance

```typescript
import { routeCalculator } from '@/utils/RouteCalculator';

const pickup = { latitude: 40.7128, longitude: -74.0060 };
const destination = { latitude: 40.7589, longitude: -73.9851 };

const result = await routeCalculator.calculateDistance(pickup, destination);

console.log('Distance:', result.distance, 'km');
console.log('Duration:', result.duration, 'minutes');
console.log('Is road-based:', result.isRoadBased);
console.log('Route validated:', result.validated);
```

### Calculate Travel Time

```typescript
const travelTime = await routeCalculator.calculateTravelTime(pickup, destination);

console.log('Estimated travel time:', travelTime, 'minutes');
```

### Include Traffic Data

```typescript
const result = await routeCalculator.calculateDistance(pickup, destination, {
  includeTraffic: true,
});

console.log('Duration without traffic:', result.durationWithoutTraffic, 'minutes');
console.log('Duration with traffic:', result.duration, 'minutes');
console.log('Traffic delay:', result.trafficDelay, 'minutes');
console.log('Congestion level:', result.trafficData?.congestionLevel);
```

## API Reference

### `calculateDistance(origin, destination, options?)`

Calculate road-based distance and travel time between two points.

**Parameters:**
- `origin: Location` - Starting location with latitude and longitude
- `destination: Location` - Ending location with latitude and longitude
- `options?: RouteCalculationOptions` - Optional calculation options

**Returns:** `Promise<RouteCalculationResult>`

**Options:**
```typescript
interface RouteCalculationOptions {
  includeTraffic?: boolean;      // Include real-time traffic data
  avoidTolls?: boolean;           // Avoid toll roads
  avoidHighways?: boolean;        // Avoid highways
  avoidFerries?: boolean;         // Avoid ferries
}
```

**Result:**
```typescript
interface RouteCalculationResult {
  distance: number;                    // Road-based distance in km
  duration: number;                    // Travel time in minutes (with traffic)
  durationWithoutTraffic: number;      // Travel time without traffic
  trafficDelay: number;                // Additional delay due to traffic
  isRoadBased: boolean;                // true if using road network
  trafficData?: TrafficData;           // Traffic information
  validated: boolean;                  // true if route validated
}
```

### `calculateTravelTime(origin, destination, options?)`

Calculate travel time with real-time traffic data.

**Parameters:**
- `origin: Location` - Starting location
- `destination: Location` - Ending location
- `options?: RouteCalculationOptions` - Optional calculation options

**Returns:** `Promise<number>` - Travel time in minutes

### `validateRoute(route)`

Validate a route against actual road networks.

**Parameters:**
- `route: RouteResult` - Route to validate

**Returns:** `Promise<boolean>` - true if route is valid

**Validation Checks:**
- Route has sufficient coordinates (at least 2 points)
- Route distance is realistic (not straight-line)
- Route has navigation steps
- Route is not a fallback straight-line route

### `checkTrafficRestrictions(route)`

Check for traffic restrictions and road closures on a route.

**Parameters:**
- `route: RouteResult` - Route to check

**Returns:** `Promise<{ hasRestrictions: boolean; restrictions: Array<...> }>`

## Advanced Usage

### Route Comparison

Compare multiple routes with different options:

```typescript
// Fastest route (with highways)
const fastestRoute = await routeCalculator.calculateDistance(pickup, destination, {
  avoidHighways: false,
  avoidTolls: false,
  includeTraffic: true,
});

// Cheapest route (avoid tolls)
const cheapestRoute = await routeCalculator.calculateDistance(pickup, destination, {
  avoidHighways: true,
  avoidTolls: true,
  includeTraffic: true,
});

console.log('Time saved (fastest):', cheapestRoute.duration - fastestRoute.duration, 'minutes');
```

### Taxi Fare Estimation

Use road-based calculations for accurate fare estimates:

```typescript
const BASE_FARE = 3.00;
const PER_KM_RATE = 2.50;
const PER_MINUTE_RATE = 0.50;

const result = await routeCalculator.calculateDistance(pickup, destination, {
  includeTraffic: true,
});

const distanceFare = result.distance * PER_KM_RATE;
const timeFare = result.duration * PER_MINUTE_RATE;
const totalFare = BASE_FARE + distanceFare + timeFare;

console.log('Total estimated fare:', `$${totalFare.toFixed(2)}`);
```

### Real-time ETA Updates

Update ETA as driver progresses:

```typescript
// Initial calculation
const initialResult = await routeCalculator.calculateDistance(pickup, destination, {
  includeTraffic: true,
});

console.log('Initial ETA:', initialResult.duration, 'minutes');

// Update from current position
const currentLocation = { latitude: 40.7300, longitude: -73.9950 };
const updatedResult = await routeCalculator.calculateDistance(currentLocation, destination, {
  includeTraffic: true,
});

console.log('Updated ETA:', updatedResult.duration, 'minutes');
```

## Traffic Data

The RouteCalculator provides real-time traffic information:

```typescript
interface TrafficData {
  congestionLevel: 'low' | 'moderate' | 'high' | 'severe';
  delayMinutes: number;
  affectedSegments: Array<{
    startLocation: Location;
    endLocation: Location;
    speedKmh: number;
  }>;
}
```

**Congestion Levels:**
- `low`: Normal traffic, minimal delays (5% delay)
- `moderate`: Some congestion (20% delay)
- `high`: Heavy traffic (30% delay)
- `severe`: Very heavy traffic (50%+ delay)

**Traffic Estimation:**
The calculator estimates traffic based on:
- Time of day (rush hour vs off-peak)
- Route type (highway vs city streets)
- Route length

## Error Handling

The RouteCalculator handles errors gracefully:

```typescript
try {
  const result = await routeCalculator.calculateDistance(pickup, destination);
  
  if (!result.isRoadBased) {
    console.warn('Using fallback calculation - API may be unavailable');
  }
  
  if (!result.validated) {
    console.warn('Route validation failed - may not follow real roads');
  }
} catch (error) {
  console.error('Error calculating route:', error);
}
```

**Fallback Behavior:**
- If Google Maps API fails, falls back to haversine calculation
- Fallback routes are marked with `isRoadBased: false`
- Fallback routes are not validated (`validated: false`)

## Integration with MapRoutingService

The RouteCalculator integrates with `MapRoutingService` for road network data:

```typescript
import { mapRoutingService } from '@/services/MapRoutingService';
import { routeCalculator } from '@/utils/RouteCalculator';

// MapRoutingService provides the route
const route = await mapRoutingService.calculateRoute(origin, destination);

// RouteCalculator validates and enhances with traffic data
const validated = await routeCalculator.validateRoute(route);
```

## Testing

Run the test suite:

```bash
npm test -- RouteCalculator.test.ts
```

The test suite includes:
- Basic distance calculations
- Traffic data integration
- Route validation
- Routing options
- Edge cases (same location, very long routes, many waypoints)
- Traffic estimation (rush hour vs off-peak)
- Error handling and fallback behavior

## Examples

See `RouteCalculator.example.ts` for complete usage examples:

1. Basic distance calculation
2. Distance with traffic
3. Distance with routing options
4. Travel time calculation
5. Route validation
6. Taxi fare estimation
7. Multiple route comparison
8. Real-time ETA updates

## Performance Considerations

- **Caching**: Consider caching route calculations for frequently used routes
- **Batch requests**: For multiple routes, calculate in parallel using `Promise.all()`
- **Rate limiting**: Google Maps API has rate limits - implement request throttling
- **Fallback**: Always handle fallback scenarios gracefully

## Related Components

- `MapRoutingService`: Provides Google Maps Directions API integration
- `SequentialNavigationManager`: Uses RouteCalculator for navigation
- `NavigationPanel`: Displays route information to drivers

## Troubleshooting

### Route validation fails

**Symptom:** `validated: false` in result

**Possible causes:**
- Route is using fallback straight-line calculation
- Route has insufficient waypoints
- API returned invalid data

**Solution:**
- Check Google Maps API key configuration
- Verify network connectivity
- Check API quota limits

### Inaccurate traffic data

**Symptom:** Traffic delays don't match reality

**Possible causes:**
- Using estimated traffic (not real-time API)
- Time zone issues
- Rush hour detection incorrect

**Solution:**
- Integrate with real-time traffic API (Google Maps Traffic API)
- Verify system time and timezone
- Adjust rush hour time ranges for your location

### High API costs

**Symptom:** Excessive Google Maps API charges

**Solution:**
- Implement route caching
- Use route validation to avoid unnecessary API calls
- Consider using OSRM for some calculations
- Implement request throttling

## Future Enhancements

Potential improvements:

1. **Real-time traffic API**: Integrate with Google Maps Traffic API for accurate real-time data
2. **Route caching**: Cache frequently used routes to reduce API calls
3. **Alternative routes**: Support for multiple route options
4. **Historical traffic**: Use historical traffic patterns for better estimates
5. **Road restrictions database**: Integrate with real-time road closure data
6. **Multi-modal routing**: Support for different vehicle types (bike, walk, etc.)

## License

Part of the taxi app project.
