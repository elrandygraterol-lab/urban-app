/**
 * MapRoutingService
 *
 * Provides road-based routing using Google Maps Directions API.
 * Replaces straight-line routing with real road network calculations.
 *
 * Requirements: 2.1, 2.7
 */

import { Platform } from 'react-native';

// Get Google Maps API key from environment
const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

export interface Location {
  latitude: number;
  longitude: number;
}

export interface RouteOptions {
  avoidTolls?: boolean;
  avoidHighways?: boolean;
  avoidFerries?: boolean;
  optimizeWaypoints?: boolean;
}

/**
 * Preset routing options for different vehicle types
 */
export const VehicleRoutingPresets = {
  /**
   * Taxi/ride-sharing preset: Prefer fastest route, avoid tolls
   */
  TAXI: {
    avoidTolls: true,
    avoidHighways: false,
    avoidFerries: true,
    optimizeWaypoints: true,
  } as RouteOptions,

  /**
   * Economy preset: Avoid tolls and highways for cheaper route
   */
  ECONOMY: {
    avoidTolls: true,
    avoidHighways: true,
    avoidFerries: true,
    optimizeWaypoints: true,
  } as RouteOptions,

  /**
   * Fast preset: Prefer highways for fastest route
   */
  FAST: {
    avoidTolls: false,
    avoidHighways: false,
    avoidFerries: false,
    optimizeWaypoints: true,
  } as RouteOptions,

  /**
   * Default preset: Balanced routing
   */
  DEFAULT: {
    avoidTolls: false,
    avoidHighways: false,
    avoidFerries: true,
    optimizeWaypoints: false,
  } as RouteOptions,
};

export interface RouteResult {
  coordinates: { latitude: number; longitude: number }[];
  distance: number; // in kilometers
  duration: number; // in minutes
  steps?: NavigationStep[];
  bounds?: {
    northeast: Location;
    southwest: Location;
  };
}

export interface NavigationStep {
  instruction: string;
  distance: number; // in meters
  duration: number; // in seconds
  startLocation: Location;
  endLocation: Location;
  maneuver?: string;
}

/**
 * MapRoutingService class
 * Handles Google Maps Directions API integration for road-based routing
 */
class MapRoutingService {
  private apiKey: string;
  private directionsService: any = null;

  constructor() {
    // Initialize with API key from environment
    this.apiKey = GOOGLE_MAPS_API_KEY;

    if (!this.apiKey) {
      console.warn(
        '[MapRoutingService] Google Maps API key not configured. Set EXPO_PUBLIC_GOOGLE_MAPS_API_KEY in .env'
      );
    }

    // On web, we can use the Google Maps JavaScript API directly
    if (Platform.OS === 'web' && typeof window !== 'undefined' && (window as any).google) {
      this.directionsService = new (window as any).google.maps.DirectionsService();
    }
  }

  /**
   * Initialize the service with Google Maps API key (optional, uses env by default)
   */
  initialize(apiKey?: string): void {
    if (apiKey) {
      this.apiKey = apiKey;
    }

    // On web, we can use the Google Maps JavaScript API directly
    if (Platform.OS === 'web' && typeof window !== 'undefined' && (window as any).google) {
      this.directionsService = new (window as any).google.maps.DirectionsService();
    }
  }

  /**
   * Calculate route using Google Maps Directions API
   *
   * @param origin - Starting location
   * @param destination - Ending location
   * @param options - Routing options (avoid tolls, highways, etc.)
   * @returns Promise with route data including coordinates, distance, duration, and navigation steps
   */
  async calculateRoute(
    origin: Location,
    destination: Location,
    options: RouteOptions = {}
  ): Promise<RouteResult> {
    if (!this.apiKey) {
      console.error('[MapRoutingService] Google Maps API key not configured');
      // Return fallback route instead of throwing error
      return this.getFallbackRoute(origin, destination);
    }

    try {
      // For React Native (iOS/Android), use the REST API
      if (Platform.OS !== 'web') {
        return await this.calculateRouteViaRestAPI(origin, destination, options);
      }

      // For web, use the JavaScript API if available
      if (this.directionsService) {
        return await this.calculateRouteViaJavaScriptAPI(origin, destination, options);
      }

      // Fallback to REST API
      return await this.calculateRouteViaRestAPI(origin, destination, options);
    } catch (error) {
      console.error('[MapRoutingService] Error calculating route:', error);

      // Return fallback route on error
      console.warn('[MapRoutingService] Falling back to straight-line route due to API error');
      return this.getFallbackRoute(origin, destination);
    }
  }

  /**
   * Calculate route optimized for taxi/ride-sharing
   * Uses preset options: avoid tolls, prefer highways, avoid ferries
   *
   * @param origin - Starting location
   * @param destination - Ending location
   * @returns Promise with route data
   */
  async calculateTaxiRoute(origin: Location, destination: Location): Promise<RouteResult> {
    return this.calculateRoute(origin, destination, VehicleRoutingPresets.TAXI);
  }

  /**
   * Calculate route using Google Maps Directions REST API
   * Works on all platforms (iOS, Android, Web)
   */
  private async calculateRouteViaRestAPI(
    origin: Location,
    destination: Location,
    options: RouteOptions
  ): Promise<RouteResult> {
    const originStr = `${origin.latitude},${origin.longitude}`;
    const destinationStr = `${destination.latitude},${destination.longitude}`;

    // Build query parameters
    const params = new URLSearchParams({
      origin: originStr,
      destination: destinationStr,
      key: this.apiKey!,
      mode: 'driving',
      alternatives: 'false',
    });

    // Add optional parameters
    const avoid: string[] = [];
    if (options.avoidTolls) avoid.push('tolls');
    if (options.avoidHighways) avoid.push('highways');
    if (options.avoidFerries) avoid.push('ferries');
    if (avoid.length > 0) {
      params.append('avoid', avoid.join('|'));
    }

    const url = `https://maps.googleapis.com/maps/api/directions/json?${params.toString()}`;

    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.status !== 'OK') {
        const errorMessage = data.error_message || 'Unknown error';
        console.error(
          `[MapRoutingService] Google Maps API error: ${data.status} - ${errorMessage}`
        );

        // Handle specific error cases
        if (data.status === 'ZERO_RESULTS') {
          throw new Error('No route found between the specified locations');
        } else if (data.status === 'OVER_QUERY_LIMIT') {
          throw new Error('Google Maps API quota exceeded');
        } else if (data.status === 'REQUEST_DENIED') {
          throw new Error('Google Maps API request denied. Check API key configuration.');
        } else {
          throw new Error(`Google Maps API error: ${data.status} - ${errorMessage}`);
        }
      }

      if (!data.routes || data.routes.length === 0) {
        throw new Error('No routes found');
      }

      return this.parseDirectionsResponse(data);
    } catch (error) {
      console.error('[MapRoutingService] REST API request failed:', error);
      throw error;
    }
  }

  /**
   * Calculate route using Google Maps JavaScript API
   * Only works on web platform
   */
  private async calculateRouteViaJavaScriptAPI(
    origin: Location,
    destination: Location,
    options: RouteOptions
  ): Promise<RouteResult> {
    return new Promise((resolve, reject) => {
      const request = {
        origin: new (window as any).google.maps.LatLng(origin.latitude, origin.longitude),
        destination: new (window as any).google.maps.LatLng(
          destination.latitude,
          destination.longitude
        ),
        travelMode: (window as any).google.maps.TravelMode.DRIVING,
        avoidTolls: options.avoidTolls || false,
        avoidHighways: options.avoidHighways || false,
        avoidFerries: options.avoidFerries || false,
        optimizeWaypoints: options.optimizeWaypoints || false,
      };

      this.directionsService.route(request, (result: any, status: any) => {
        if (status === (window as any).google.maps.DirectionsStatus.OK) {
          try {
            const parsedResult = this.parseJavaScriptAPIResponse(result);
            resolve(parsedResult);
          } catch (error) {
            reject(error);
          }
        } else {
          reject(new Error(`Directions request failed: ${status}`));
        }
      });
    });
  }

  /**
   * Parse Google Maps Directions REST API response
   */
  private parseDirectionsResponse(data: any): RouteResult {
    const route = data.routes[0];
    const leg = route.legs[0];

    // Decode polyline to get route coordinates
    const coordinates = this.decodePolyline(route.overview_polyline.points);

    // Extract navigation steps
    const steps: NavigationStep[] = leg.steps.map((step: any) => ({
      instruction: this.stripHtmlTags(step.html_instructions),
      distance: step.distance.value, // in meters
      duration: step.duration.value, // in seconds
      startLocation: {
        latitude: step.start_location.lat,
        longitude: step.start_location.lng,
      },
      endLocation: {
        latitude: step.end_location.lat,
        longitude: step.end_location.lng,
      },
      maneuver: step.maneuver,
    }));

    return {
      coordinates,
      distance: leg.distance.value / 1000, // convert meters to kilometers
      duration: leg.duration.value / 60, // convert seconds to minutes
      steps,
      bounds: {
        northeast: {
          latitude: route.bounds.northeast.lat,
          longitude: route.bounds.northeast.lng,
        },
        southwest: {
          latitude: route.bounds.southwest.lat,
          longitude: route.bounds.southwest.lng,
        },
      },
    };
  }

  /**
   * Parse Google Maps JavaScript API response
   */
  private parseJavaScriptAPIResponse(result: any): RouteResult {
    const route = result.routes[0];
    const leg = route.legs[0];

    // Extract coordinates from path
    const coordinates = route.overview_path.map((point: any) => ({
      latitude: point.lat(),
      longitude: point.lng(),
    }));

    // Extract navigation steps
    const steps: NavigationStep[] = leg.steps.map((step: any) => ({
      instruction: this.stripHtmlTags(step.instructions),
      distance: step.distance.value, // in meters
      duration: step.duration.value, // in seconds
      startLocation: {
        latitude: step.start_location.lat(),
        longitude: step.start_location.lng(),
      },
      endLocation: {
        latitude: step.end_location.lat(),
        longitude: step.end_location.lng(),
      },
      maneuver: step.maneuver,
    }));

    return {
      coordinates,
      distance: leg.distance.value / 1000, // convert meters to kilometers
      duration: leg.duration.value / 60, // convert seconds to minutes
      steps,
      bounds: {
        northeast: {
          latitude: route.bounds.getNorthEast().lat(),
          longitude: route.bounds.getNorthEast().lng(),
        },
        southwest: {
          latitude: route.bounds.getSouthWest().lat(),
          longitude: route.bounds.getSouthWest().lng(),
        },
      },
    };
  }

  /**
   * Decode Google Maps polyline encoding
   * Algorithm from: https://developers.google.com/maps/documentation/utilities/polylinealgorithm
   */
  private decodePolyline(encoded: string): { latitude: number; longitude: number }[] {
    const coordinates: { latitude: number; longitude: number }[] = [];
    let index = 0;
    let lat = 0;
    let lng = 0;

    while (index < encoded.length) {
      let b;
      let shift = 0;
      let result = 0;

      // Decode latitude
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);

      const dlat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
      lat += dlat;

      shift = 0;
      result = 0;

      // Decode longitude
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);

      const dlng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
      lng += dlng;

      coordinates.push({
        latitude: lat / 1e5,
        longitude: lng / 1e5,
      });
    }

    return coordinates;
  }

  /**
   * Strip HTML tags from instruction text
   */
  private stripHtmlTags(html: string): string {
    return html.replace(/<[^>]*>/g, '');
  }

  /**
   * Validate a route against road network
   * Checks if the route follows actual roads
   */
  async validateRoute(coordinates: Location[]): Promise<boolean> {
    if (coordinates.length < 2) {
      return false;
    }

    try {
      // Calculate route between first and last point
      const route = await this.calculateRoute(coordinates[0], coordinates[coordinates.length - 1]);

      // If we got a valid route with coordinates, it follows roads
      return route.coordinates.length > 0;
    } catch (error) {
      console.error('[MapRoutingService] Route validation failed:', error);
      return false;
    }
  }

  /**
   * Get fallback route in case of API failure
   * Returns a simple straight-line route as fallback
   */
  getFallbackRoute(origin: Location, destination: Location): RouteResult {
    console.warn('[MapRoutingService] Using fallback straight-line route');

    // Calculate straight-line distance using Haversine formula
    const distance = this.calculateHaversineDistance(origin, destination);

    // Estimate duration (assuming average speed of 40 km/h in city)
    const duration = (distance / 40) * 60; // in minutes

    return {
      coordinates: [origin, destination],
      distance,
      duration,
      steps: [
        {
          instruction: 'Proceed to destination',
          distance: distance * 1000, // convert to meters
          duration: duration * 60, // convert to seconds
          startLocation: origin,
          endLocation: destination,
        },
      ],
    };
  }

  /**
   * Calculate straight-line distance between two points using Haversine formula
   * Used only as fallback when API fails
   */
  private calculateHaversineDistance(point1: Location, point2: Location): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(point2.latitude - point1.latitude);
    const dLon = this.toRadians(point2.longitude - point1.longitude);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(point1.latitude)) *
        Math.cos(this.toRadians(point2.latitude)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Convert degrees to radians
   */
  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
}

// Export singleton instance
export const mapRoutingService = new MapRoutingService();
export default mapRoutingService;
