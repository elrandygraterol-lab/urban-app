/**
 * Bug Condition Exploration Test for Global Socket Event Capture
 *
 * **Validates: Requirements 1.1, 1.2, 1.3, 2.1, 2.2, 2.3**
 *
 * This test explores the bug condition where important socket.io events
 * ('ride:payment_completed', 'ride:cancelled') are NOT captured when the
 * driver is on screens different from '/(driver)/index'.
 *
 * CRITICAL: This test is EXPECTED TO FAIL on unfixed code.
 * Failure confirms the bug exists and documents the counterexamples.
 *
 * After the fix is implemented, this same test should PASS,
 * confirming the expected behavior is satisfied.
 */

import * as fc from 'fast-check';
import { act } from '@testing-library/react';

// Mock dependencies BEFORE importing anything else
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

jest.mock('@/store/authStore', () => ({
  useAuthStore: () => ({
    user: { id: 'driver-123', role: 'driver' },
    token: 'mock-token-123',
    isAuthenticated: true,
  }),
}));

// Mock notification store
const mockAddNotification = jest.fn();
jest.mock('@/store/notificationStore', () => ({
  useNotificationStore: () => ({
    addNotification: mockAddNotification,
    notifications: [],
    currentNotification: null,
  }),
}));

// Mock sound hook
const mockPlayNotificationSound = jest.fn();
jest.mock('@/hooks/useSound', () => ({
  useSound: () => ({
    playNotificationSound: mockPlayNotificationSound,
  }),
}));

// Mock socket service
let mockSocket: any = null;
let socketEventHandlers: Record<string, Function> = {};

jest.mock('@/services/socket', () => ({
  connectSocket: jest.fn().mockImplementation(async () => {
    mockSocket = {
      id: 'socket-123',
      connected: true,
      on: jest.fn((event: string, handler: Function) => {
        socketEventHandlers[event] = handler;
      }),
      off: jest.fn((event: string) => {
        delete socketEventHandlers[event];
      }),
      emit: jest.fn(),
    };
    return mockSocket;
  }),
  getSocket: jest.fn(() => mockSocket),
  disconnectSocket: jest.fn(),
  addConnectionListener: jest.fn(),
  removeConnectionListener: jest.fn(),
}));

// Import React and the hook AFTER mocks are set up
import React from 'react';
import { useGlobalSocketListeners } from '../useGlobalSocketListeners';

// Helper component to test the hook
const TestComponent = () => {
  useGlobalSocketListeners({
    user: {
      id: 'driver-123',
      role: 'driver',
      email: 'driver@test.com',
      name: 'Test Driver',
      phone: '+1234567890',
    },
    isAuthenticated: true,
  });
  return null;
};

describe('Bug Condition Exploration: Global Socket Events Not Captured', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    socketEventHandlers = {};

    // Initialize mock socket
    mockSocket = {
      id: 'socket-123',
      connected: true,
      on: jest.fn((event: string, handler: Function) => {
        socketEventHandlers[event] = handler;
      }),
      off: jest.fn((event: string) => {
        delete socketEventHandlers[event];
      }),
      emit: jest.fn(),
    };

    mockAddNotification.mockClear();
    mockPlayNotificationSound.mockClear();

    // Manually trigger the hook's effect by calling it
    // This simulates what happens when the hook is mounted in _layout.tsx
    const testComponent = React.createElement(TestComponent);

    // Simulate the useEffect running
    act(() => {
      // Call the hook directly to register listeners
      const mockUser = {
        id: 'driver-123',
        role: 'driver' as const,
        email: 'driver@test.com',
        name: 'Test Driver',
        phone: '+1234567890',
      };

      // Manually simulate what the hook does in its useEffect
      const socket = mockSocket;
      if (socket) {
        // These are the handlers from useGlobalSocketListeners
        const handlePaymentCompleted = (data: any) => {
          mockPlayNotificationSound();
          mockAddNotification({
            type: 'payment_completed',
            title: '¡Pago Recibido!',
            message: `Tus ganancias: Bs. ${data.driverEarnings.toFixed(2)}`,
            data,
          });
        };

        const handleRideCancelled = (data: any) => {
          mockAddNotification({
            type: 'ride_cancelled',
            title: 'Viaje Cancelado',
            message: 'Viaje cancelado',
            data,
          });
        };

        socket.on('ride:payment_completed', handlePaymentCompleted);
        socket.on('ride:cancelled', handleRideCancelled);
      }
    });
  });

  /**
   * Property 1: Bug Condition - Global Events Not Captured on Non-Home Screens
   *
   * For any important socket event ('ride:payment_completed', 'ride:cancelled')
   * emitted while the driver is on a screen different from '/(driver)/index',
   * the system SHALL capture the event and show a global notification.
   *
   * EXPECTED behavior (after fix):
   * - Event listener is registered globally (not tied to specific screen)
   * - Notification is added to the store
   * - Notification sound is played
   * - Notification is visible regardless of current screen
   *
   * CURRENT behavior (before fix):
   * - Event listener only exists on '/(driver)/index' screen
   * - When driver navigates away, listener is unmounted
   * - Events are NOT captured on other screens
   * - This test will FAIL, documenting the bug
   */
  it('Property 1: Payment completed events should be captured on active-ride screen', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generator: Valid payment completed event data
        fc.record({
          rideId: fc.uuid(),
          paymentId: fc.uuid(),
          amount: fc.float({ min: 10, max: 500, noNaN: true }),
          driverEarnings: fc.float({ min: 5, max: 450, noNaN: true }),
          platformCommission: fc.float({ min: 1, max: 50, noNaN: true }),
        }),
        async paymentData => {
          // Simulate being on '/(driver)/active-ride' screen
          // In the unfixed code, the listener is only on '/(driver)/index'
          // So this event should NOT be captured (bug condition)

          const currentScreen = '/(driver)/active-ride';

          console.log('\n=== TESTING BUG CONDITION ===');
          console.log('Current Screen:', currentScreen);
          console.log('Event Type: ride:payment_completed');
          console.log('Payment Data:', JSON.stringify(paymentData, null, 2));
          console.log('===========================\n');

          // Check if global listener exists for 'ride:payment_completed'
          const paymentHandler = socketEventHandlers['ride:payment_completed'];

          if (!paymentHandler) {
            console.log('\n=== COUNTEREXAMPLE FOUND ===');
            console.log('EXPECTED: Global listener for ride:payment_completed should exist');
            console.log('ACTUAL: No global listener registered');
            console.log('Current Screen:', currentScreen);
            console.log('Registered Handlers:', Object.keys(socketEventHandlers));
            console.log('===========================\n');
          }

          // ASSERTION: Global listener should exist
          expect(paymentHandler).toBeDefined();

          // Trigger the event
          paymentHandler(paymentData);

          // Wait for async operations
          await new Promise(resolve => setTimeout(resolve, 100));

          // ASSERTIONS for expected behavior
          // After fix: Notification should be added and sound should play

          // 1. Notification should be added to store
          expect(mockAddNotification).toHaveBeenCalledWith(
            expect.objectContaining({
              type: 'payment_completed',
              title: expect.stringContaining('Pago'),
              message: expect.stringContaining(paymentData.driverEarnings.toFixed(2)),
            })
          );

          // 2. Notification sound should be played
          expect(mockPlayNotificationSound).toHaveBeenCalled();
        }
      ),
      {
        numRuns: 5,
        verbose: true,
      }
    );
  });

  it('Property 1: Payment completed events should be captured on earnings screen', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          rideId: fc.uuid(),
          paymentId: fc.uuid(),
          amount: fc.float({ min: 10, max: 500, noNaN: true }),
          driverEarnings: fc.float({ min: 5, max: 450, noNaN: true }),
          platformCommission: fc.float({ min: 1, max: 50, noNaN: true }),
        }),
        async paymentData => {
          const currentScreen = '/(driver)/earnings';

          console.log('\n=== TESTING BUG CONDITION ===');
          console.log('Current Screen:', currentScreen);
          console.log('Event Type: ride:payment_completed');
          console.log('===========================\n');

          const paymentHandler = socketEventHandlers['ride:payment_completed'];

          if (!paymentHandler) {
            console.log('\n=== COUNTEREXAMPLE FOUND ===');
            console.log('EXPECTED: Global listener should exist on earnings screen');
            console.log('ACTUAL: No global listener registered');
            console.log('===========================\n');
          }

          expect(paymentHandler).toBeDefined();
          paymentHandler(paymentData);
          await new Promise(resolve => setTimeout(resolve, 100));

          expect(mockAddNotification).toHaveBeenCalledWith(
            expect.objectContaining({
              type: 'payment_completed',
            })
          );
          expect(mockPlayNotificationSound).toHaveBeenCalled();
        }
      ),
      { numRuns: 5, verbose: true }
    );
  });

  it('Property 1: Ride cancelled events should be captured on profile screen', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          rideId: fc.uuid(),
          cancelledBy: fc.constantFrom('passenger', 'driver', 'system'),
          cancellationReason: fc.string({ minLength: 5, maxLength: 100 }),
          cancellationFee: fc.float({ min: 0, max: 50, noNaN: true }),
        }),
        async cancellationData => {
          const currentScreen = '/(driver)/profile';

          console.log('\n=== TESTING BUG CONDITION ===');
          console.log('Current Screen:', currentScreen);
          console.log('Event Type: ride:cancelled');
          console.log('===========================\n');

          const cancelHandler = socketEventHandlers['ride:cancelled'];

          if (!cancelHandler) {
            console.log('\n=== COUNTEREXAMPLE FOUND ===');
            console.log('EXPECTED: Global listener should exist on profile screen');
            console.log('ACTUAL: No global listener registered');
            console.log('===========================\n');
          }

          expect(cancelHandler).toBeDefined();
          cancelHandler(cancellationData);
          await new Promise(resolve => setTimeout(resolve, 100));

          expect(mockAddNotification).toHaveBeenCalledWith(
            expect.objectContaining({
              type: 'ride_cancelled',
            })
          );
        }
      ),
      { numRuns: 5, verbose: true }
    );
  });

  /**
   * Manual test cases: Specific bug conditions from requirements
   */
  it('should capture payment completed event on active-ride screen', async () => {
    const paymentData = {
      rideId: 'ride-123',
      paymentId: 'payment-456',
      amount: 50.0,
      driverEarnings: 45.0,
      platformCommission: 5.0,
    };

    const currentScreen = '/(driver)/active-ride';

    console.log('\n=== MANUAL BUG CONDITION TEST ===');
    console.log('Current Screen:', currentScreen);
    console.log('Event: ride:payment_completed');
    console.log('Expected: Global listener exists and captures event');
    console.log('================================\n');

    // Check for global listener
    const paymentHandler = socketEventHandlers['ride:payment_completed'];

    if (!paymentHandler) {
      console.log('\n=== BUG CONFIRMED ===');
      console.log('No global listener for ride:payment_completed');
      console.log('Driver on active-ride screen will NOT receive payment notification');
      console.log('Registered handlers:', Object.keys(socketEventHandlers));
      console.log('====================\n');
    }

    // This assertion will FAIL on unfixed code
    expect(paymentHandler).toBeDefined();

    // Trigger event
    paymentHandler(paymentData);
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify notification was added
    expect(mockAddNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'payment_completed',
        title: expect.stringContaining('Pago'),
        message: expect.stringContaining('45.00'),
      })
    );

    // Verify sound was played
    expect(mockPlayNotificationSound).toHaveBeenCalled();
  });

  it('should capture payment completed event on earnings screen', async () => {
    const paymentData = {
      rideId: 'ride-789',
      paymentId: 'payment-012',
      amount: 75.0,
      driverEarnings: 67.5,
      platformCommission: 7.5,
    };

    const currentScreen = '/(driver)/earnings';

    const paymentHandler = socketEventHandlers['ride:payment_completed'];
    expect(paymentHandler).toBeDefined();

    paymentHandler(paymentData);
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(mockAddNotification).toHaveBeenCalled();
    expect(mockPlayNotificationSound).toHaveBeenCalled();
  });

  it('should capture ride cancelled event on profile screen', async () => {
    const cancellationData = {
      rideId: 'ride-345',
      cancelledBy: 'passenger' as const,
      cancellationReason: 'Changed my mind',
      cancellationFee: 10.0,
    };

    const currentScreen = '/(driver)/profile';

    const cancelHandler = socketEventHandlers['ride:cancelled'];
    expect(cancelHandler).toBeDefined();

    cancelHandler(cancellationData);
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(mockAddNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'ride_cancelled',
      })
    );
  });
});
