/**
 * RouteCalculator Usage Examples
 *
 * Demonstrates how to use the RouteCalculator for road-based route calculations
 */

import { routeCalculator, RouteCalculationOptions } from './RouteCalculator';
import { Location } from '../services/MapRoutingService';

// Example 1: Basic Distance Calculation
async function example1_BasicDistanceCalculation() {
  console.log('=== Example 1: Basic Distance Calculation ===');

  const pickup: Location = { latitude: 40.7128, longitude: -74.006 }; // New York
  const destination: Location = { latitude: 40.7589, longitude: -73.9851 }; // Times Square

  try {
    const result = await routeCalculator.calculateDistance(pickup, destination);

    console.log('Distance:', result.distance, 'km');
    console.log('Duration:', result.duration, 'minutes');
    console.log('Is road-based:', result.isRoadBased);
    console.log('Route validated:', result.validated);
  } catch (error) {
    console.error('Error calculating distance:', error);
  }
}

// Example 2: Distance Calculation with Traffic
async function example2_DistanceWithTraffic() {
  console.log('=== Example 2: Distance Calculation with Traffic ===');

  const pickup: Location = { latitude: 40.7128, longitude: -74.006 };
  const destination: Location = { latitude: 40.7589, longitude: -73.9851 };

  const options: RouteCalculationOptions = {
    includeTraffic: true,
  };

  try {
    const result = await routeCalculator.calculateDistance(pickup, destination, options);

    console.log('Distance:', result.distance, 'km');
    console.log('Duration without traffic:', result.durationWithoutTraffic, 'minutes');
    console.log('Duration with traffic:', result.duration, 'minutes');
    console.log('Traffic delay:', result.trafficDelay, 'minutes');

    if (result.trafficData) {
      console.log('Congestion level:', result.trafficData.congestionLevel);
      console.log('Affected segments:', result.trafficData.affectedSegments.length);
    }
  } catch (error) {
    console.error('Error calculating distance with traffic:', error);
  }
}

// Example 3: Distance Calculation with Routing Options
async function example3_DistanceWithRoutingOptions() {
  console.log('=== Example 3: Distance Calculation with Routing Options ===');

  const pickup: Location = { latitude: 40.7128, longitude: -74.006 };
  const destination: Location = { latitude: 40.7589, longitude: -73.9851 };

  const options: RouteCalculationOptions = {
    avoidTolls: true,
    avoidHighways: false,
    includeTraffic: true,
  };

  try {
    const result = await routeCalculator.calculateDistance(pickup, destination, options);

    console.log('Distance (avoiding tolls):', result.distance, 'km');
    console.log('Duration:', result.duration, 'minutes');
    console.log('Route validated:', result.validated);
  } catch (error) {
    console.error('Error calculating distance:', error);
  }
}

// Example 4: Travel Time Calculation
async function example4_TravelTimeCalculation() {
  console.log('=== Example 4: Travel Time Calculation ===');

  const pickup: Location = { latitude: 40.7128, longitude: -74.006 };
  const destination: Location = { latitude: 40.7589, longitude: -73.9851 };

  try {
    const travelTime = await routeCalculator.calculateTravelTime(pickup, destination);

    console.log('Estimated travel time:', travelTime, 'minutes');
    console.log(
      'Estimated arrival:',
      new Date(Date.now() + travelTime * 60000).toLocaleTimeString()
    );
  } catch (error) {
    console.error('Error calculating travel time:', error);
  }
}

// Example 5: Route Validation
async function example5_RouteValidation() {
  console.log('=== Example 5: Route Validation ===');

  const pickup: Location = { latitude: 40.7128, longitude: -74.006 };
  const destination: Location = { latitude: 40.7589, longitude: -73.9851 };

  try {
    const result = await routeCalculator.calculateDistance(pickup, destination);

    if (result.validated) {
      console.log('✓ Route is valid and follows real roads');
      console.log('  Distance:', result.distance, 'km');
      console.log('  Duration:', result.duration, 'minutes');
    } else {
      console.log('✗ Route validation failed');
      console.log('  This might be a straight-line fallback route');
    }
  } catch (error) {
    console.error('Error validating route:', error);
  }
}

// Example 6: Taxi Fare Estimation
async function example6_TaxiFareEstimation() {
  console.log('=== Example 6: Taxi Fare Estimation ===');

  const pickup: Location = { latitude: 40.7128, longitude: -74.006 };
  const destination: Location = { latitude: 40.7589, longitude: -73.9851 };

  const BASE_FARE = 3.0; // $3.00 base fare
  const PER_KM_RATE = 2.5; // $2.50 per km
  const PER_MINUTE_RATE = 0.5; // $0.50 per minute

  try {
    const result = await routeCalculator.calculateDistance(pickup, destination, {
      includeTraffic: true,
    });

    const distanceFare = result.distance * PER_KM_RATE;
    const timeFare = result.duration * PER_MINUTE_RATE;
    const totalFare = BASE_FARE + distanceFare + timeFare;

    console.log('Distance:', result.distance.toFixed(2), 'km');
    console.log('Duration:', result.duration.toFixed(0), 'minutes');
    console.log('---');
    console.log('Base fare:', `$${BASE_FARE.toFixed(2)}`);
    console.log('Distance fare:', `$${distanceFare.toFixed(2)}`);
    console.log('Time fare:', `$${timeFare.toFixed(2)}`);
    console.log('Total estimated fare:', `$${totalFare.toFixed(2)}`);

    if (result.trafficDelay > 0) {
      console.log('---');
      console.log('Traffic delay:', result.trafficDelay.toFixed(0), 'minutes');
      console.log(
        'Additional cost due to traffic:',
        `$${(result.trafficDelay * PER_MINUTE_RATE).toFixed(2)}`
      );
    }
  } catch (error) {
    console.error('Error estimating fare:', error);
  }
}

// Example 7: Multiple Route Comparison
async function example7_MultipleRouteComparison() {
  console.log('=== Example 7: Multiple Route Comparison ===');

  const pickup: Location = { latitude: 40.7128, longitude: -74.006 };
  const destination: Location = { latitude: 40.7589, longitude: -73.9851 };

  try {
    // Route 1: Fastest (with highways)
    const fastestRoute = await routeCalculator.calculateDistance(pickup, destination, {
      avoidHighways: false,
      avoidTolls: false,
      includeTraffic: true,
    });

    // Route 2: Cheapest (avoid tolls and highways)
    const cheapestRoute = await routeCalculator.calculateDistance(pickup, destination, {
      avoidHighways: true,
      avoidTolls: true,
      includeTraffic: true,
    });

    console.log('Fastest Route:');
    console.log('  Distance:', fastestRoute.distance.toFixed(2), 'km');
    console.log('  Duration:', fastestRoute.duration.toFixed(0), 'minutes');

    console.log('\nCheapest Route:');
    console.log('  Distance:', cheapestRoute.distance.toFixed(2), 'km');
    console.log('  Duration:', cheapestRoute.duration.toFixed(0), 'minutes');

    console.log('\nComparison:');
    const timeSaved = cheapestRoute.duration - fastestRoute.duration;
    const distanceDiff = cheapestRoute.distance - fastestRoute.distance;
    console.log('  Time saved (fastest):', timeSaved.toFixed(0), 'minutes');
    console.log('  Distance difference:', distanceDiff.toFixed(2), 'km');
  } catch (error) {
    console.error('Error comparing routes:', error);
  }
}

// Example 8: Real-time ETA Updates
async function example8_RealtimeETAUpdates() {
  console.log('=== Example 8: Real-time ETA Updates ===');

  const pickup: Location = { latitude: 40.7128, longitude: -74.006 };
  const destination: Location = { latitude: 40.7589, longitude: -73.9851 };

  try {
    // Initial calculation
    const initialResult = await routeCalculator.calculateDistance(pickup, destination, {
      includeTraffic: true,
    });

    console.log('Initial ETA:', initialResult.duration.toFixed(0), 'minutes');
    console.log('Traffic delay:', initialResult.trafficDelay.toFixed(0), 'minutes');

    // Simulate driver progress (moved 30% of the way)
    const currentLocation: Location = {
      latitude: pickup.latitude + (destination.latitude - pickup.latitude) * 0.3,
      longitude: pickup.longitude + (destination.longitude - pickup.longitude) * 0.3,
    };

    // Recalculate from current position
    const updatedResult = await routeCalculator.calculateDistance(currentLocation, destination, {
      includeTraffic: true,
    });

    console.log('\nUpdated ETA (30% complete):');
    console.log('  Remaining distance:', updatedResult.distance.toFixed(2), 'km');
    console.log('  Remaining time:', updatedResult.duration.toFixed(0), 'minutes');
    console.log('  Current traffic delay:', updatedResult.trafficDelay.toFixed(0), 'minutes');
  } catch (error) {
    console.error('Error updating ETA:', error);
  }
}

// Run all examples
export async function runAllExamples() {
  await example1_BasicDistanceCalculation();
  console.log('\n');

  await example2_DistanceWithTraffic();
  console.log('\n');

  await example3_DistanceWithRoutingOptions();
  console.log('\n');

  await example4_TravelTimeCalculation();
  console.log('\n');

  await example5_RouteValidation();
  console.log('\n');

  await example6_TaxiFareEstimation();
  console.log('\n');

  await example7_MultipleRouteComparison();
  console.log('\n');

  await example8_RealtimeETAUpdates();
}

// Uncomment to run examples:
// runAllExamples().catch(console.error);
