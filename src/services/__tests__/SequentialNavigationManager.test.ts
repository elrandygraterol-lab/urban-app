/**
 * SequentialNavigationManager Unit Tests
 *
 * Tests the sequential navigation manager for pickup → destination navigation.
 * Requirements: 2.5
 */

import { SequentialNavigationManager } from '../SequentialNavigationManager';
import { Location, NavigationStep, mapRoutingService } from '../MapRoutingService';

// Mock MapRoutingService
jest.mock('../MapRoutingService', () => ({
  mapRoutingService: {
    calculateTaxiRoute: jest.fn(),
  },
  Location: {},
  NavigationStep: {},
}));

describe('SequentialNavigationManager', () => {
  const mockCurrentLocation: Location = {
    latitude: 19.4326,
    longitude: -99.1332,
  };

  const mockPickupLocation: Location = {
    latitude: 19.435,
    longitude: -99.14,
  };

  const mockDestinationLocation: Location = {
    latitude: 19.4284,
    longitude: -99.1276,
  };

  const mockNavigationSteps: NavigationStep[] = [
    {
      instruction: 'Head north on Av. Reforma',
      distance: 500,
      duration: 60,
      startLocation: mockCurrentLocation,
      endLocation: { latitude: 19.433, longitude: -99.1332 },
      maneuver: 'straight',
    },
    {
      instruction: 'Turn right onto Calle 5',
      distance: 300,
      duration: 45,
      startLocation: { latitude: 19.433, longitude: -99.1332 },
      endLocation: mockPickupLocation,
      maneuver: 'turn-right',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock implementation
    (mapRoutingService.calculateTaxiRoute as jest.Mock).mockResolvedValue({
      coordinates: [mockCurrentLocation, mockPickupLocation],
      distance: 2.5,
      duration: 8,
      steps: mockNavigationSteps,
    });
  });

  describe('Initialization', () => {
    it('should initialize with pickup phase when pickup location is provided', async () => {
      const manager = new SequentialNavigationManager(mockPickupLocation, mockDestinationLocation);

      await manager.initialize(mockCurrentLocation);

      expect(manager.getCurrentPhase()).toBe('pickup');
    });

    it('should initialize with destination phase when no pickup location', async () => {
      const manager = new SequentialNavigationManager(undefined, mockDestinationLocation);

      await manager.initialize(mockCurrentLocation);

      expect(manager.getCurrentPhase()).toBe('destination');
    });

    it('should call onPhaseChange callback on initialization', async () => {
      const onPhaseChange = jest.fn();

      const manager = new SequentialNavigationManager(mockPickupLocation, mockDestinationLocation, {
        onPhaseChange,
      });

      await manager.initialize(mockCurrentLocation);

      expect(onPhaseChange).toHaveBeenCalledWith(
        'pickup',
        expect.objectContaining({
          phase: 'pickup',
          target: mockPickupLocation,
          distance: 2.5,
          duration: 8,
        })
      );
    });

    it('should calculate route using MapRoutingService', async () => {
      const manager = new SequentialNavigationManager(mockPickupLocation, mockDestinationLocation);

      await manager.initialize(mockCurrentLocation);

      expect(mapRoutingService.calculateTaxiRoute).toHaveBeenCalledWith(
        mockCurrentLocation,
        mockPickupLocation
      );
    });

    it('should handle initialization errors', async () => {
      const onError = jest.fn();
      const error = new Error('API Error');

      (mapRoutingService.calculateTaxiRoute as jest.Mock).mockRejectedValue(error);

      const manager = new SequentialNavigationManager(mockPickupLocation, mockDestinationLocation, {
        onError,
      });

      await expect(manager.initialize(mockCurrentLocation)).rejects.toThrow('API Error');
      expect(onError).toHaveBeenCalledWith(error, 'pickup');
    });
  });

  describe('Phase Configuration', () => {
    it('should return current phase config', async () => {
      const manager = new SequentialNavigationManager(mockPickupLocation, mockDestinationLocation);

      await manager.initialize(mockCurrentLocation);

      const config = manager.getCurrentPhaseConfig();

      expect(config).toBeDefined();
      expect(config?.phase).toBe('pickup');
      expect(config?.target).toEqual(mockPickupLocation);
      expect(config?.instructions).toHaveLength(2);
    });

    it('should enhance instructions with phase context', async () => {
      const manager = new SequentialNavigationManager(mockPickupLocation, mockDestinationLocation);

      await manager.initialize(mockCurrentLocation);

      const config = manager.getCurrentPhaseConfig();
      const firstInstruction = config?.instructions[0].instruction;

      expect(firstInstruction).toContain('[To Pickup]');
    });
  });

  describe('Progress Updates', () => {
    it('should update current step based on location', async () => {
      const onStepChange = jest.fn();

      const manager = new SequentialNavigationManager(mockPickupLocation, mockDestinationLocation, {
        onStepChange,
      });

      await manager.initialize(mockCurrentLocation);

      // Move to second step location
      const newLocation = { latitude: 19.433, longitude: -99.1332 };
      await manager.updateProgress(newLocation);

      expect(onStepChange).toHaveBeenCalled();
    });

    it('should calculate remaining distance correctly', async () => {
      const manager = new SequentialNavigationManager(mockPickupLocation, mockDestinationLocation);

      await manager.initialize(mockCurrentLocation);

      const remaining = manager.getRemainingDistance(mockCurrentLocation);

      expect(remaining).toBeGreaterThan(0);
      expect(remaining).toBeLessThanOrEqual(2.5);
    });

    it('should calculate remaining duration correctly', async () => {
      const manager = new SequentialNavigationManager(mockPickupLocation, mockDestinationLocation);

      await manager.initialize(mockCurrentLocation);

      const remaining = manager.getRemainingDuration(mockCurrentLocation);

      expect(remaining).toBeGreaterThan(0);
      expect(remaining).toBeLessThanOrEqual(8);
    });
  });

  describe('Phase Transitions', () => {
    it('should transition from pickup to destination when near pickup', async () => {
      const onTransitionStart = jest.fn();
      const onTransitionComplete = jest.fn();
      const onPhaseChange = jest.fn();

      // Mock destination route
      (mapRoutingService.calculateTaxiRoute as jest.Mock)
        .mockResolvedValueOnce({
          coordinates: [mockCurrentLocation, mockPickupLocation],
          distance: 2.5,
          duration: 8,
          steps: mockNavigationSteps,
        })
        .mockResolvedValueOnce({
          coordinates: [mockPickupLocation, mockDestinationLocation],
          distance: 3.2,
          duration: 10,
          steps: mockNavigationSteps,
        });

      const manager = new SequentialNavigationManager(mockPickupLocation, mockDestinationLocation, {
        onTransitionStart,
        onTransitionComplete,
        onPhaseChange,
      });

      await manager.initialize(mockCurrentLocation);

      // Move very close to pickup (within threshold)
      const nearPickup: Location = {
        latitude: mockPickupLocation.latitude + 0.0001, // ~11 meters
        longitude: mockPickupLocation.longitude + 0.0001,
      };

      await manager.updateProgress(nearPickup);

      expect(onTransitionStart).toHaveBeenCalledWith('pickup', 'destination');
      expect(onTransitionComplete).toHaveBeenCalledWith(
        'destination',
        expect.objectContaining({ phase: 'destination' })
      );
      expect(manager.getCurrentPhase()).toBe('destination');
    });

    it('should complete navigation when near destination', async () => {
      const onNavigationComplete = jest.fn();

      const manager = new SequentialNavigationManager(
        undefined, // No pickup
        mockDestinationLocation,
        { onNavigationComplete }
      );

      await manager.initialize(mockCurrentLocation);

      // Move very close to destination
      const nearDestination: Location = {
        latitude: mockDestinationLocation.latitude + 0.0001,
        longitude: mockDestinationLocation.longitude + 0.0001,
      };

      await manager.updateProgress(nearDestination);

      expect(onNavigationComplete).toHaveBeenCalled();
      expect(manager.getCurrentPhase()).toBe('completed');
    });

    it('should not update during transition', async () => {
      const onStepChange = jest.fn();

      const manager = new SequentialNavigationManager(mockPickupLocation, mockDestinationLocation, {
        onStepChange,
      });

      await manager.initialize(mockCurrentLocation);

      // Manually access private state to set transitioning flag
      // This simulates the manager being in a transitioning state
      (manager as any).state.isTransitioning = true;

      // This should not trigger any updates
      await manager.updateProgress(mockCurrentLocation);

      // onStepChange should not be called during transition
      expect(onStepChange).not.toHaveBeenCalled();

      // State should remain transitioning
      expect((manager as any).state.isTransitioning).toBe(true);
    });
  });

  describe('Proximity Threshold', () => {
    it('should use default proximity threshold of 50 meters', async () => {
      const onNavigationComplete = jest.fn();

      const manager = new SequentialNavigationManager(undefined, mockDestinationLocation, {
        onNavigationComplete,
      });

      await manager.initialize(mockCurrentLocation);

      // 40 meters away (within default threshold)
      const nearDestination: Location = {
        latitude: mockDestinationLocation.latitude + 0.0003,
        longitude: mockDestinationLocation.longitude + 0.0003,
      };

      await manager.updateProgress(nearDestination);

      expect(onNavigationComplete).toHaveBeenCalled();
    });

    it('should allow custom proximity threshold', async () => {
      const onNavigationComplete = jest.fn();

      const manager = new SequentialNavigationManager(undefined, mockDestinationLocation, {
        onNavigationComplete,
      });

      manager.setProximityThreshold(200); // 200 meters

      await manager.initialize(mockCurrentLocation);

      // 150 meters away (within custom threshold of 200m)
      // Using larger offset to ensure we're within 200m threshold
      const nearDestination: Location = {
        latitude: mockDestinationLocation.latitude + 0.0013,
        longitude: mockDestinationLocation.longitude + 0.0013,
      };

      await manager.updateProgress(nearDestination);

      expect(onNavigationComplete).toHaveBeenCalled();
    });
  });

  describe('State Management', () => {
    it('should return current state', async () => {
      const manager = new SequentialNavigationManager(mockPickupLocation, mockDestinationLocation);

      await manager.initialize(mockCurrentLocation);

      const state = manager.getState();

      expect(state).toEqual({
        currentPhase: 'pickup',
        pickupConfig: expect.any(Object),
        destinationConfig: undefined,
        currentStepIndex: 0,
        isTransitioning: false,
      });
    });

    it('should return current step', async () => {
      const manager = new SequentialNavigationManager(mockPickupLocation, mockDestinationLocation);

      await manager.initialize(mockCurrentLocation);

      const step = manager.getCurrentStep();

      expect(step).toBeDefined();
      expect(step?.instruction).toContain('Head north');
    });
  });

  describe('Force Transition', () => {
    it('should allow manual phase transition', async () => {
      const onPhaseChange = jest.fn();

      (mapRoutingService.calculateTaxiRoute as jest.Mock)
        .mockResolvedValueOnce({
          coordinates: [mockCurrentLocation, mockPickupLocation],
          distance: 2.5,
          duration: 8,
          steps: mockNavigationSteps,
        })
        .mockResolvedValueOnce({
          coordinates: [mockPickupLocation, mockDestinationLocation],
          distance: 3.2,
          duration: 10,
          steps: mockNavigationSteps,
        });

      const manager = new SequentialNavigationManager(mockPickupLocation, mockDestinationLocation, {
        onPhaseChange,
      });

      await manager.initialize(mockCurrentLocation);

      expect(manager.getCurrentPhase()).toBe('pickup');

      // Force transition
      await manager.forceTransition(mockPickupLocation);

      expect(manager.getCurrentPhase()).toBe('destination');
    });
  });

  describe('Cancellation', () => {
    it('should cancel navigation', async () => {
      const manager = new SequentialNavigationManager(mockPickupLocation, mockDestinationLocation);

      await manager.initialize(mockCurrentLocation);

      expect(manager.getCurrentPhase()).toBe('pickup');

      manager.cancel();

      expect(manager.getCurrentPhase()).toBe('completed');
      expect(manager.getCurrentPhaseConfig()).toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle route calculation errors during transition', async () => {
      const onError = jest.fn();

      (mapRoutingService.calculateTaxiRoute as jest.Mock)
        .mockResolvedValueOnce({
          coordinates: [mockCurrentLocation, mockPickupLocation],
          distance: 2.5,
          duration: 8,
          steps: mockNavigationSteps,
        })
        .mockRejectedValueOnce(new Error('Network error'));

      const manager = new SequentialNavigationManager(mockPickupLocation, mockDestinationLocation, {
        onError,
      });

      await manager.initialize(mockCurrentLocation);

      // Move near pickup to trigger transition
      const nearPickup: Location = {
        latitude: mockPickupLocation.latitude + 0.0001,
        longitude: mockPickupLocation.longitude + 0.0001,
      };

      await expect(manager.updateProgress(nearPickup)).rejects.toThrow('Network error');
      expect(onError).toHaveBeenCalledWith(expect.any(Error), 'destination');
    });
  });
});
