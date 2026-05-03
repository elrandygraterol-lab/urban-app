/**
 * RouteCalculator Tests
 * 
 * Unit tests for road-based route calculations
 */

import { routeCalculator } from '../RouteCalculator';
import { mapRoutingService, Location, RouteResult } from '../../services/MapRoutingService';

// Mock MapRoutingService
jest.mock('../../services/MapRoutingService', () => ({
  mapRoutingService: {
    calculateRoute: jest.fn(),
  },
}));

describe('RouteCalculator', () => {
  const mockOrigin: Location = { latitude: 40.7128, longitude: -74.0060 }; // New York
  const mockDestination: Location = { latitude: 40.7589, longitude: -73.9851 }; // Times Square

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('calculateDistance', () => {
    it('should calculate road-based distance using MapRoutingService', async () => {
      const mockRoute: RouteResult = {
        coordinates: [
          mockOrigin,
          { latitude: 40.7300, longitude: -73.9950 },
          { latitude: 40.7450, longitude: -73.9900 },
          mockDestination,
        ],
        distance: 5.2, // km
        duration: 15, // minutes
        steps: [
          {
            instruction: 'Head north on Broadway',
            distance: 1000,
            duration: 180,
            startLocation: mockOrigin,
            endLocation: { latitude: 40.7300, longitude: -73.9950 },
            maneuver: 'turn-left',
          },
          {
            instruction: 'Turn right on 7th Ave',
            distance: 2000,
            duration: 300,
            startLocation: { latitude: 40.7300, longitude: -73.9950 },
            endLocation: mockDestination,
            maneuver: 'turn-right',
          },
        ],
      };

      (mapRoutingService.calculateRoute as jest.Mock).mockResolvedValue(mockRoute);

      const result = await routeCalculator.calculateDistance(mockOrigin, mockDestination);

      expect(result).toBeDefined();
      expect(result.distance).toBe(5.2);
      expect(result.duration).toBeGreaterThan(0);
      expect(result.isRoadBased).toBe(true);
      expect(result.validated).toBe(true);
      expect(mapRoutingService.calculateRoute).toHaveBeenCalledWith(
        mockOrigin,
        mockDestination,
        expect.any(Object)
      );
    });

    it('should include traffic data when requested', async () => {
      const mockRoute: RouteResult = {
        coordinates: [mockOrigin, mockDestination],
        distance: 5.2,
        duration: 15,
        steps: [
          {
            instruction: 'Head north',
            distance: 5200,
            duration: 900,
            startLocation: mockOrigin,
            endLocation: mockDestination,
          },
        ],
      };

      (mapRoutingService.calculateRoute as jest.Mock).mockResolvedValue(mockRoute);

      const result = await routeCalculator.calculateDistance(mockOrigin, mockDestination, {
        includeTraffic: true,
      });

      expect(result.trafficData).toBeDefined();
      expect(result.trafficDelay).toBeGreaterThanOrEqual(0);
      expect(result.duration).toBeGreaterThanOrEqual(result.durationWithoutTraffic);
    });

    it('should respect routing options', async () => {
      const mockRoute: RouteResult = {
        coordinates: [mockOrigin, mockDestination],
        distance: 6.5, // Longer route avoiding tolls
        duration: 20,
        steps: [
          {
            instruction: 'Take alternate route',
            distance: 6500,
            duration: 1200,
            startLocation: mockOrigin,
            endLocation: mockDestination,
          },
        ],
      };

      (mapRoutingService.calculateRoute as jest.Mock).mockResolvedValue(mockRoute);

      await routeCalculator.calculateDistance(mockOrigin, mockDestination, {
        avoidTolls: true,
        avoidHighways: true,
      });

      expect(mapRoutingService.calculateRoute).toHaveBeenCalledWith(
        mockOrigin,
        mockDestination,
        expect.objectContaining({
          avoidTolls: true,
          avoidHighways: true,
        })
      );
    });

    it('should fall back to haversine when API fails', async () => {
      (mapRoutingService.calculateRoute as jest.Mock).mockRejectedValue(
        new Error('API Error')
      );

      const result = await routeCalculator.calculateDistance(mockOrigin, mockDestination);

      expect(result).toBeDefined();
      expect(result.isRoadBased).toBe(false); // Fallback is not road-based
      expect(result.validated).toBe(false);
      expect(result.distance).toBeGreaterThan(0);
    });
  });

  describe('calculateTravelTime', () => {
    it('should calculate travel time with traffic', async () => {
      const mockRoute: RouteResult = {
        coordinates: [mockOrigin, mockDestination],
        distance: 5.2,
        duration: 15,
        steps: [
          {
            instruction: 'Head north',
            distance: 5200,
            duration: 900,
            startLocation: mockOrigin,
            endLocation: mockDestination,
          },
        ],
      };

      (mapRoutingService.calculateRoute as jest.Mock).mockResolvedValue(mockRoute);

      const travelTime = await routeCalculator.calculateTravelTime(mockOrigin, mockDestination);

      expect(travelTime).toBeGreaterThan(0);
      expect(travelTime).toBeGreaterThanOrEqual(15); // At least base duration
    });

    it('should include traffic delay in travel time', async () => {
      const mockRoute: RouteResult = {
        coordinates: [mockOrigin, mockDestination],
        distance: 5.2,
        duration: 15,
        steps: [
          {
            instruction: 'Head north',
            distance: 5200,
            duration: 900,
            startLocation: mockOrigin,
            endLocation: mockDestination,
          },
        ],
      };

      (mapRoutingService.calculateRoute as jest.Mock).mockResolvedValue(mockRoute);

      const travelTime = await routeCalculator.calculateTravelTime(mockOrigin, mockDestination);

      // Travel time should include some traffic delay
      expect(travelTime).toBeGreaterThanOrEqual(15);
    });
  });

  describe('validateRoute', () => {
    it('should validate route with multiple coordinates and steps', async () => {
      const validRoute: RouteResult = {
        coordinates: [
          mockOrigin,
          { latitude: 40.7300, longitude: -73.9950 },
          { latitude: 40.7450, longitude: -73.9900 },
          mockDestination,
        ],
        distance: 5.2,
        duration: 15,
        steps: [
          {
            instruction: 'Head north on Broadway',
            distance: 1000,
            duration: 180,
            startLocation: mockOrigin,
            endLocation: { latitude: 40.7300, longitude: -73.9950 },
          },
          {
            instruction: 'Turn right on 7th Ave',
            distance: 2000,
            duration: 300,
            startLocation: { latitude: 40.7300, longitude: -73.9950 },
            endLocation: mockDestination,
          },
        ],
      };

      const isValid = await routeCalculator.validateRoute(validRoute);

      expect(isValid).toBe(true);
    });

    it('should reject route with insufficient coordinates', async () => {
      const invalidRoute: RouteResult = {
        coordinates: [mockOrigin],
        distance: 0,
        duration: 0,
      };

      const isValid = await routeCalculator.validateRoute(invalidRoute);

      expect(isValid).toBe(false);
    });

    it('should reject route with no navigation steps', async () => {
      const invalidRoute: RouteResult = {
        coordinates: [mockOrigin, mockDestination],
        distance: 5.2,
        duration: 15,
        steps: [],
      };

      const isValid = await routeCalculator.validateRoute(invalidRoute);

      expect(isValid).toBe(false);
    });

    it('should reject straight-line fallback routes', async () => {
      const fallbackRoute: RouteResult = {
        coordinates: [mockOrigin, mockDestination],
        distance: 5.2,
        duration: 15,
        steps: [
          {
            instruction: 'Proceed to destination',
            distance: 5200,
            duration: 900,
            startLocation: mockOrigin,
            endLocation: mockDestination,
          },
        ],
      };

      const isValid = await routeCalculator.validateRoute(fallbackRoute);

      expect(isValid).toBe(false); // Should detect fallback route
    });

    it('should reject route with suspiciously short distance', async () => {
      const suspiciousRoute: RouteResult = {
        coordinates: [mockOrigin, mockDestination],
        distance: 1.0, // Too short for the actual distance
        duration: 5,
        steps: [
          {
            instruction: 'Head north',
            distance: 1000,
            duration: 300,
            startLocation: mockOrigin,
            endLocation: mockDestination,
          },
        ],
      };

      const isValid = await routeCalculator.validateRoute(suspiciousRoute);

      expect(isValid).toBe(false);
    });
  });

  describe('checkTrafficRestrictions', () => {
    it('should check for traffic restrictions', async () => {
      const mockRoute: RouteResult = {
        coordinates: [mockOrigin, mockDestination],
        distance: 5.2,
        duration: 15,
        steps: [
          {
            instruction: 'Head north',
            distance: 5200,
            duration: 900,
            startLocation: mockOrigin,
            endLocation: mockDestination,
          },
        ],
      };

      const result = await routeCalculator.checkTrafficRestrictions(mockRoute);

      expect(result).toBeDefined();
      expect(result.hasRestrictions).toBeDefined();
      expect(Array.isArray(result.restrictions)).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle same origin and destination', async () => {
      const sameLocation = mockOrigin;

      const mockRoute: RouteResult = {
        coordinates: [sameLocation],
        distance: 0,
        duration: 0,
        steps: [],
      };

      (mapRoutingService.calculateRoute as jest.Mock).mockResolvedValue(mockRoute);

      const result = await routeCalculator.calculateDistance(sameLocation, sameLocation);

      expect(result).toBeDefined();
      expect(result.distance).toBe(0);
    });

    it('should handle very long routes', async () => {
      const farDestination: Location = { latitude: 34.0522, longitude: -118.2437 }; // Los Angeles

      const mockRoute: RouteResult = {
        coordinates: [mockOrigin, farDestination],
        distance: 4500, // ~4500 km
        duration: 2700, // ~45 hours
        steps: [
          {
            instruction: 'Head west on I-80',
            distance: 4500000,
            duration: 162000,
            startLocation: mockOrigin,
            endLocation: farDestination,
          },
        ],
      };

      (mapRoutingService.calculateRoute as jest.Mock).mockResolvedValue(mockRoute);

      const result = await routeCalculator.calculateDistance(mockOrigin, farDestination);

      expect(result).toBeDefined();
      expect(result.distance).toBeGreaterThan(1000);
    });

    it('should handle routes with many waypoints', async () => {
      const waypoints = Array.from({ length: 50 }, (_, i) => ({
        latitude: mockOrigin.latitude + i * 0.01,
        longitude: mockOrigin.longitude + i * 0.01,
      }));

      const mockRoute: RouteResult = {
        coordinates: waypoints,
        distance: 75.5,
        duration: 90,
        steps: waypoints.slice(0, -1).map((wp, i) => ({
          instruction: `Continue to waypoint ${i + 1}`,
          distance: 1500,
          duration: 108,
          startLocation: wp,
          endLocation: waypoints[i + 1],
        })),
      };

      (mapRoutingService.calculateRoute as jest.Mock).mockResolvedValue(mockRoute);

      const result = await routeCalculator.calculateDistance(mockOrigin, mockDestination);

      expect(result).toBeDefined();
      expect(result.validated).toBe(true);
    });
  });

  describe('Traffic Data', () => {
    it('should estimate higher delays during rush hour', async () => {
      // Mock current time to be during rush hour (8 AM)
      const mockDate = new Date('2024-01-15T08:00:00');
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);

      const mockRoute: RouteResult = {
        coordinates: [mockOrigin, mockDestination],
        distance: 15, // Longer route (highway)
        duration: 20,
        steps: [
          {
            instruction: 'Take I-95 North',
            distance: 15000,
            duration: 1200,
            startLocation: mockOrigin,
            endLocation: mockDestination,
          },
        ],
      };

      (mapRoutingService.calculateRoute as jest.Mock).mockResolvedValue(mockRoute);

      const result = await routeCalculator.calculateDistance(mockOrigin, mockDestination, {
        includeTraffic: true,
      });

      expect(result.trafficData).toBeDefined();
      expect(result.trafficData?.congestionLevel).toBe('high');
      expect(result.trafficDelay).toBeGreaterThan(0);

      jest.restoreAllMocks();
    });

    it('should estimate lower delays during off-peak hours', async () => {
      // Mock current time to be during off-peak (2 PM)
      const mockDate = new Date('2024-01-15T14:00:00');
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);

      const mockRoute: RouteResult = {
        coordinates: [mockOrigin, mockDestination],
        distance: 5,
        duration: 15,
        steps: [
          {
            instruction: 'Head north',
            distance: 5000,
            duration: 900,
            startLocation: mockOrigin,
            endLocation: mockDestination,
          },
        ],
      };

      (mapRoutingService.calculateRoute as jest.Mock).mockResolvedValue(mockRoute);

      const result = await routeCalculator.calculateDistance(mockOrigin, mockDestination, {
        includeTraffic: true,
      });

      expect(result.trafficData).toBeDefined();
      expect(result.trafficData?.congestionLevel).toBe('low');
      expect(result.trafficDelay).toBeLessThan(result.duration * 0.1);

      jest.restoreAllMocks();
    });
  });
});
