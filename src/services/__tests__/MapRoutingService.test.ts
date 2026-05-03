/**
 * MapRoutingService Tests
 * 
 * Unit tests for Google Maps Directions API integration
 */

import { mapRoutingService, VehicleRoutingPresets } from '../MapRoutingService';

// Mock environment variable
process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY = 'test-api-key';

// Mock fetch for testing
global.fetch = jest.fn();

describe('MapRoutingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Initialize service with test API key
    mapRoutingService.initialize('test-api-key');
  });

  describe('calculateRoute', () => {
    it('should calculate route using Google Maps API', async () => {
      const mockResponse = {
        status: 'OK',
        routes: [
          {
            overview_polyline: {
              points: '_p~iF~ps|U_ulLnnqC_mqNvxq`@',
            },
            legs: [
              {
                distance: { value: 5000 },
                duration: { value: 600 },
                steps: [
                  {
                    html_instructions: 'Head <b>north</b> on Main St',
                    distance: { value: 1000 },
                    duration: { value: 120 },
                    start_location: { lat: 40.7128, lng: -74.0060 },
                    end_location: { lat: 40.7228, lng: -74.0060 },
                    maneuver: 'turn-left',
                  },
                ],
              },
            ],
            bounds: {
              northeast: { lat: 40.7228, lng: -74.0060 },
              southwest: { lat: 40.7128, lng: -74.0060 },
            },
          },
        ],
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const origin = { latitude: 40.7128, longitude: -74.0060 };
      const destination = { latitude: 40.7228, longitude: -74.0060 };

      const result = await mapRoutingService.calculateRoute(origin, destination);

      expect(result).toBeDefined();
      expect(result.coordinates).toBeDefined();
      expect(result.coordinates.length).toBeGreaterThan(0);
      expect(result.distance).toBe(5); // 5000 meters = 5 km
      expect(result.duration).toBe(10); // 600 seconds = 10 minutes
      expect(result.steps).toBeDefined();
      expect(result.steps?.length).toBe(1);
    });

    it('should handle API errors gracefully with fallback', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'ZERO_RESULTS',
          error_message: 'No route found',
        }),
      });

      const origin = { latitude: 40.7128, longitude: -74.0060 };
      const destination = { latitude: 40.7228, longitude: -74.0060 };

      const result = await mapRoutingService.calculateRoute(origin, destination);

      // Should return fallback route
      expect(result).toBeDefined();
      expect(result.coordinates).toHaveLength(2);
      expect(result.coordinates[0]).toEqual(origin);
      expect(result.coordinates[1]).toEqual(destination);
    });

    it('should apply routing options correctly', async () => {
      const mockResponse = {
        status: 'OK',
        routes: [
          {
            overview_polyline: { points: '_p~iF~ps|U_ulLnnqC_mqNvxq`@' },
            legs: [
              {
                distance: { value: 5000 },
                duration: { value: 600 },
                steps: [],
              },
            ],
            bounds: {
              northeast: { lat: 40.7228, lng: -74.0060 },
              southwest: { lat: 40.7128, lng: -74.0060 },
            },
          },
        ],
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const origin = { latitude: 40.7128, longitude: -74.0060 };
      const destination = { latitude: 40.7228, longitude: -74.0060 };

      await mapRoutingService.calculateRoute(origin, destination, {
        avoidTolls: true,
        avoidHighways: true,
      });

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0][0];
      expect(fetchCall).toContain('avoid=tolls%7Chighways');
    });
  });

  describe('calculateTaxiRoute', () => {
    it('should use taxi preset options', async () => {
      const mockResponse = {
        status: 'OK',
        routes: [
          {
            overview_polyline: { points: '_p~iF~ps|U_ulLnnqC_mqNvxq`@' },
            legs: [
              {
                distance: { value: 5000 },
                duration: { value: 600 },
                steps: [],
              },
            ],
            bounds: {
              northeast: { lat: 40.7228, lng: -74.0060 },
              southwest: { lat: 40.7128, lng: -74.0060 },
            },
          },
        ],
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const origin = { latitude: 40.7128, longitude: -74.0060 };
      const destination = { latitude: 40.7228, longitude: -74.0060 };

      await mapRoutingService.calculateTaxiRoute(origin, destination);

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0][0];
      // Taxi preset avoids tolls and ferries
      expect(fetchCall).toContain('avoid=tolls%7Cferries');
    });
  });

  describe('VehicleRoutingPresets', () => {
    it('should have TAXI preset with correct options', () => {
      expect(VehicleRoutingPresets.TAXI).toEqual({
        avoidTolls: true,
        avoidHighways: false,
        avoidFerries: true,
        optimizeWaypoints: true,
      });
    });

    it('should have ECONOMY preset with correct options', () => {
      expect(VehicleRoutingPresets.ECONOMY).toEqual({
        avoidTolls: true,
        avoidHighways: true,
        avoidFerries: true,
        optimizeWaypoints: true,
      });
    });

    it('should have FAST preset with correct options', () => {
      expect(VehicleRoutingPresets.FAST).toEqual({
        avoidTolls: false,
        avoidHighways: false,
        avoidFerries: false,
        optimizeWaypoints: true,
      });
    });
  });

  describe('getFallbackRoute', () => {
    it('should return straight-line route as fallback', () => {
      const origin = { latitude: 40.7128, longitude: -74.0060 };
      const destination = { latitude: 40.7228, longitude: -74.0060 };

      const result = mapRoutingService.getFallbackRoute(origin, destination);

      expect(result).toBeDefined();
      expect(result.coordinates).toHaveLength(2);
      expect(result.coordinates[0]).toEqual(origin);
      expect(result.coordinates[1]).toEqual(destination);
      expect(result.distance).toBeGreaterThan(0);
      expect(result.duration).toBeGreaterThan(0);
      expect(result.steps).toBeDefined();
      expect(result.steps?.length).toBe(1);
    });
  });

  describe('validateRoute', () => {
    it('should return false for invalid routes', async () => {
      const result = await mapRoutingService.validateRoute([]);
      expect(result).toBe(false);
    });

    it('should validate route with single coordinate', async () => {
      const result = await mapRoutingService.validateRoute([
        { latitude: 40.7128, longitude: -74.0060 },
      ]);
      expect(result).toBe(false);
    });
  });
});
