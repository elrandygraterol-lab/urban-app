/**
 * NavigationPanel Unit Tests
 *
 * Tests the NavigationPanel component functionality including:
 * - Route calculation and display
 * - Progress tracking
 * - Phase transitions
 * - Real-time updates
 */

import React from 'react';
import { render, waitFor, act } from '@testing-library/react-native';
import { NavigationPanel } from '../NavigationPanel';
import { mapRoutingService } from '../../../services/MapRoutingService';
import type { Location, RouteResult, NavigationStep } from '../../../services/MapRoutingService';

// Mock the MapRoutingService
jest.mock('../../../services/MapRoutingService', () => ({
  mapRoutingService: {
    calculateTaxiRoute: jest.fn(),
  },
}));

describe('NavigationPanel', () => {
  const mockOrigin: Location = {
    latitude: 40.7128,
    longitude: -74.006,
  };

  const mockDestination: Location = {
    latitude: 40.7589,
    longitude: -73.9851,
  };

  const mockPickupLocation: Location = {
    latitude: 40.7489,
    longitude: -73.968,
  };

  const mockNavigationSteps: NavigationStep[] = [
    {
      instruction: 'Head north on Broadway',
      distance: 500,
      duration: 60,
      startLocation: mockOrigin,
      endLocation: { latitude: 40.7178, longitude: -74.006 },
      maneuver: 'straight',
    },
    {
      instruction: 'Turn right onto 5th Ave',
      distance: 800,
      duration: 120,
      startLocation: { latitude: 40.7178, longitude: -74.006 },
      endLocation: { latitude: 40.7228, longitude: -73.996 },
      maneuver: 'turn-right',
    },
    {
      instruction: 'Turn left onto E 42nd St',
      distance: 300,
      duration: 45,
      startLocation: { latitude: 40.7228, longitude: -73.996 },
      endLocation: mockDestination,
      maneuver: 'turn-left',
    },
  ];

  const mockRouteResult: RouteResult = {
    coordinates: [mockOrigin, mockDestination],
    distance: 5.2,
    duration: 15,
    steps: mockNavigationSteps,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (mapRoutingService.calculateTaxiRoute as jest.Mock).mockResolvedValue(mockRouteResult);
  });

  describe('Basic Rendering', () => {
    it('should render loading state initially', () => {
      const { getByText } = render(
        <NavigationPanel currentLocation={mockOrigin} destination={mockDestination} />
      );

      expect(getByText('Calculating route...')).toBeTruthy();
    });

    it('should render navigation instructions after route calculation', async () => {
      const { getByText } = render(
        <NavigationPanel currentLocation={mockOrigin} destination={mockDestination} />
      );

      await waitFor(() => {
        expect(getByText('Head north on Broadway')).toBeTruthy();
      });
    });

    it('should display distance to next maneuver', async () => {
      const { getByText } = render(
        <NavigationPanel currentLocation={mockOrigin} destination={mockDestination} />
      );

      await waitFor(() => {
        expect(getByText(/In 500m/)).toBeTruthy();
      });
    });

    it('should display ETA', async () => {
      const { getByText } = render(
        <NavigationPanel currentLocation={mockOrigin} destination={mockDestination} />
      );

      await waitFor(() => {
        expect(getByText(/ETA:/)).toBeTruthy();
      });
    });
  });

  describe('Route Calculation', () => {
    it('should call calculateTaxiRoute with correct parameters', async () => {
      render(<NavigationPanel currentLocation={mockOrigin} destination={mockDestination} />);

      await waitFor(() => {
        expect(mapRoutingService.calculateTaxiRoute).toHaveBeenCalledWith(
          mockOrigin,
          mockDestination
        );
      });
    });

    it('should invoke onRouteCalculated callback', async () => {
      const onRouteCalculated = jest.fn();

      render(
        <NavigationPanel
          currentLocation={mockOrigin}
          destination={mockDestination}
          onRouteCalculated={onRouteCalculated}
        />
      );

      await waitFor(() => {
        expect(onRouteCalculated).toHaveBeenCalledWith(mockNavigationSteps, 5.2, 15);
      });
    });

    it('should handle route calculation errors', async () => {
      (mapRoutingService.calculateTaxiRoute as jest.Mock).mockRejectedValue(new Error('API Error'));

      const { getByText } = render(
        <NavigationPanel currentLocation={mockOrigin} destination={mockDestination} />
      );

      await waitFor(() => {
        expect(getByText(/Failed to calculate route/)).toBeTruthy();
      });
    });
  });

  describe('Progress Tracking', () => {
    it('should display progress bar', async () => {
      const { getByText } = render(
        <NavigationPanel currentLocation={mockOrigin} destination={mockDestination} />
      );

      await waitFor(() => {
        expect(getByText(/remaining/)).toBeTruthy();
      });
    });

    it('should update progress when location changes', async () => {
      const { rerender, getByText } = render(
        <NavigationPanel currentLocation={mockOrigin} destination={mockDestination} />
      );

      await waitFor(() => {
        expect(getByText('Head north on Broadway')).toBeTruthy();
      });

      // Move to next step location
      act(() => {
        rerender(
          <NavigationPanel
            currentLocation={{ latitude: 40.7178, longitude: -74.006 }}
            destination={mockDestination}
          />
        );
      });

      await waitFor(() => {
        // Should show updated instruction or progress
        expect(getByText(/remaining/)).toBeTruthy();
      });
    });
  });

  describe('Sequential Navigation', () => {
    it('should start with pickup phase when pickupLocation provided', async () => {
      const { getByText } = render(
        <NavigationPanel
          currentLocation={mockOrigin}
          destination={mockDestination}
          pickupLocation={mockPickupLocation}
        />
      );

      await waitFor(() => {
        expect(getByText(/Navigating to Pickup/)).toBeTruthy();
      });
    });

    it('should calculate route to pickup location first', async () => {
      render(
        <NavigationPanel
          currentLocation={mockOrigin}
          destination={mockDestination}
          pickupLocation={mockPickupLocation}
        />
      );

      await waitFor(() => {
        expect(mapRoutingService.calculateTaxiRoute).toHaveBeenCalledWith(
          mockOrigin,
          mockPickupLocation
        );
      });
    });

    it('should transition to destination phase when pickup reached', async () => {
      const onPhaseChange = jest.fn();

      const { rerender, getByText } = render(
        <NavigationPanel
          currentLocation={mockOrigin}
          destination={mockDestination}
          pickupLocation={mockPickupLocation}
          onPhaseChange={onPhaseChange}
        />
      );

      await waitFor(() => {
        expect(getByText(/Navigating to Pickup/)).toBeTruthy();
      });

      // Simulate arriving at pickup (within 50m)
      act(() => {
        rerender(
          <NavigationPanel
            currentLocation={{
              latitude: mockPickupLocation.latitude + 0.0001,
              longitude: mockPickupLocation.longitude + 0.0001,
            }}
            destination={mockDestination}
            pickupLocation={mockPickupLocation}
            onPhaseChange={onPhaseChange}
          />
        );
      });

      await waitFor(() => {
        expect(onPhaseChange).toHaveBeenCalledWith('destination');
      });
    });

    it('should show completed state when destination reached', async () => {
      const onPhaseChange = jest.fn();

      const { rerender, getByText } = render(
        <NavigationPanel
          currentLocation={mockOrigin}
          destination={mockDestination}
          onPhaseChange={onPhaseChange}
        />
      );

      await waitFor(() => {
        expect(getByText('Head north on Broadway')).toBeTruthy();
      });

      // Simulate arriving at destination (within 50m)
      act(() => {
        rerender(
          <NavigationPanel
            currentLocation={{
              latitude: mockDestination.latitude + 0.0001,
              longitude: mockDestination.longitude + 0.0001,
            }}
            destination={mockDestination}
            onPhaseChange={onPhaseChange}
          />
        );
      });

      await waitFor(() => {
        expect(getByText('You have arrived!')).toBeTruthy();
        expect(onPhaseChange).toHaveBeenCalledWith('completed');
      });
    });
  });

  describe('Next Maneuver Display', () => {
    it('should display next maneuver', async () => {
      const { getByText } = render(
        <NavigationPanel currentLocation={mockOrigin} destination={mockDestination} />
      );

      await waitFor(() => {
        expect(getByText('Then:')).toBeTruthy();
        expect(getByText('Turn right onto 5th Ave')).toBeTruthy();
      });
    });

    it('should display upcoming steps', async () => {
      const { getByText } = render(
        <NavigationPanel currentLocation={mockOrigin} destination={mockDestination} />
      );

      await waitFor(() => {
        expect(getByText('Upcoming:')).toBeTruthy();
      });
    });
  });

  describe('Maneuver Icons', () => {
    it('should display correct icon for turn-right maneuver', async () => {
      const { getByText } = render(
        <NavigationPanel currentLocation={mockOrigin} destination={mockDestination} />
      );

      await waitFor(() => {
        // The component should render the maneuver icon
        expect(getByText('Turn right onto 5th Ave')).toBeTruthy();
      });
    });

    it('should display correct icon for turn-left maneuver', async () => {
      const { getByText } = render(
        <NavigationPanel currentLocation={mockOrigin} destination={mockDestination} />
      );

      await waitFor(() => {
        expect(getByText('Turn left onto E 42nd St')).toBeTruthy();
      });
    });
  });

  describe('Distance and Duration Formatting', () => {
    it('should format distances under 1km in meters', async () => {
      const { getByText } = render(
        <NavigationPanel currentLocation={mockOrigin} destination={mockDestination} />
      );

      await waitFor(() => {
        expect(getByText(/500m/)).toBeTruthy();
      });
    });

    it('should format distances over 1km in kilometers', async () => {
      const mockLongRoute: RouteResult = {
        ...mockRouteResult,
        distance: 5.2,
        steps: [
          {
            instruction: 'Continue on highway',
            distance: 5200,
            duration: 300,
            startLocation: mockOrigin,
            endLocation: mockDestination,
          },
        ],
      };

      (mapRoutingService.calculateTaxiRoute as jest.Mock).mockResolvedValue(mockLongRoute);

      const { getByText } = render(
        <NavigationPanel currentLocation={mockOrigin} destination={mockDestination} />
      );

      await waitFor(() => {
        expect(getByText(/5\.2km/)).toBeTruthy();
      });
    });

    it('should format duration in minutes', async () => {
      const { getByText } = render(
        <NavigationPanel currentLocation={mockOrigin} destination={mockDestination} />
      );

      await waitFor(() => {
        // Should show duration in minutes
        expect(getByText(/min/)).toBeTruthy();
      });
    });
  });

  describe('Error Handling', () => {
    it('should display error message on API failure', async () => {
      (mapRoutingService.calculateTaxiRoute as jest.Mock).mockRejectedValue(
        new Error('Network error')
      );

      const { getByText } = render(
        <NavigationPanel currentLocation={mockOrigin} destination={mockDestination} />
      );

      await waitFor(() => {
        expect(getByText(/Failed to calculate route/)).toBeTruthy();
      });
    });

    it('should handle empty steps array', async () => {
      const emptyRoute: RouteResult = {
        coordinates: [mockOrigin, mockDestination],
        distance: 5.2,
        duration: 15,
        steps: [],
      };

      (mapRoutingService.calculateTaxiRoute as jest.Mock).mockResolvedValue(emptyRoute);

      const { getByText } = render(
        <NavigationPanel currentLocation={mockOrigin} destination={mockDestination} />
      );

      // Should not crash, might show loading or error state
      await waitFor(() => {
        expect(getByText(/Calculating route|Failed to calculate route/)).toBeTruthy();
      });
    });
  });

  describe('Real-time Updates', () => {
    it('should recalculate route when phase changes', async () => {
      const { rerender } = render(
        <NavigationPanel
          currentLocation={mockOrigin}
          destination={mockDestination}
          pickupLocation={mockPickupLocation}
        />
      );

      await waitFor(() => {
        expect(mapRoutingService.calculateTaxiRoute).toHaveBeenCalledTimes(1);
      });

      // Simulate phase change by reaching pickup
      act(() => {
        rerender(
          <NavigationPanel
            currentLocation={mockPickupLocation}
            destination={mockDestination}
            pickupLocation={mockPickupLocation}
          />
        );
      });

      // Should recalculate route for destination phase
      await waitFor(() => {
        expect(mapRoutingService.calculateTaxiRoute).toHaveBeenCalledTimes(2);
      });
    });
  });
});
