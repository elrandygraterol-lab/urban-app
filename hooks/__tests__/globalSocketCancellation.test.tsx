/**
 * Tests for the driver app recovery fix:
 *  - ride:request_cancelled dismisses the pending request card when it matches.
 *  - ride:cancelled also dismisses a still-visible request card.
 *  - Foreground revalidation dismisses a card whose ride is no longer pending.
 */

import React from 'react';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const TestRenderer = require('react-test-renderer') as any;
const act = TestRenderer.act as any;

const mockDismissRideRequest = jest.fn();
const mockShowRideRequest = jest.fn();
const mockShowStatus = jest.fn();
const mockShowSuccess = jest.fn();
const mockShowError = jest.fn();
const mockShowWarning = jest.fn();
const mockPlayNotificationSound = jest.fn();
let mockActiveRideRequest: any = null;

jest.mock('@/context/UnifiedNotificationContext', () => ({
  useUnifiedNotifications: () => ({
    showRideRequest: mockShowRideRequest,
    dismissRideRequest: mockDismissRideRequest,
    activeRideRequest: mockActiveRideRequest,
    showStatus: mockShowStatus,
    showSuccess: mockShowSuccess,
    showError: mockShowError,
    showWarning: mockShowWarning,
  }),
}));

jest.mock('@/hooks/useSound', () => ({
  useSound: () => ({ playNotificationSound: mockPlayNotificationSound }),
}));

jest.mock('@/hooks/useExchangeRate', () => ({
  useExchangeRate: () => ({
    convertToUsd: (v: number) => v.toFixed(2),
    convertToBs: (v: number) => v.toFixed(2),
  }),
}));

jest.mock('@/store/driverStore', () => ({
  useDriverStore: jest.fn(),
}));

const mockGetPendingRides = jest.fn();
jest.mock('@/services/api', () => ({
  rideAPI: {
    getPendingRides: (...args: unknown[]) => mockGetPendingRides(...args),
    getRide: jest.fn(),
  },
}));

let mockSocket: any = null;
let socketEventHandlers: Record<string, Function> = {};
jest.mock('@/services/socket', () => ({
  connectSocket: jest.fn(async () => {
    mockSocket = {
      id: 'socket-456',
      connected: true,
      on: jest.fn((event: string, handler: Function) => {
        socketEventHandlers[event] = handler;
      }),
      off: jest.fn((event: string) => {
        delete socketEventHandlers[event];
      }),
      once: jest.fn(),
      emit: jest.fn(),
      offAny: jest.fn(),
      onAny: jest.fn(),
      listeners: jest.fn(() => []),
      io: { engine: { transport: { name: 'polling' } } },
      nsp: '/',
      auth: {},
    };
    return mockSocket;
  }),
  getSocket: jest.fn(() => mockSocket),
  disconnectSocket: jest.fn(),
  addConnectionListener: jest.fn(),
  removeConnectionListener: jest.fn(),
}));

let appStateChangeHandler: ((state: string) => void) | null = null;
jest.mock('react-native', () => ({
  AppState: {
    addEventListener: jest.fn((_type: string, handler: (s: string) => void) => {
      appStateChangeHandler = handler;
      return { remove: jest.fn() };
    }),
  },
}));

import { useGlobalSocketListeners } from '../useGlobalSocketListeners';

const DRIVER_USER = {
  id: 'driver-123',
  role: 'driver' as const,
  email: 'driver@test.com',
  name: 'Test Driver',
  phone: '+1234567890',
};

const TestComponent = () => {
  useGlobalSocketListeners({ user: DRIVER_USER, isAuthenticated: true });
  return null;
};

const mountDriverHook = async () => {
  mockDismissRideRequest.mockClear();
  mockGetPendingRides.mockClear();
  socketEventHandlers = {};
  appStateChangeHandler = null;

  let renderer: any;
  await act(async () => {
    renderer = TestRenderer.create(<TestComponent />);
  });
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 10));
  });

  return {
    renderer,
    unmount: () => {
      act(() => renderer.unmount());
    },
  };
};

describe('Driver recovery: pending request cancellation (ride:request_cancelled)', () => {
  it('registers the ride:request_cancelled listener for drivers', async () => {
    mockActiveRideRequest = { id: 'ride-abc' };
    const { unmount } = await mountDriverHook();
    expect(socketEventHandlers['ride:request_cancelled']).toBeDefined();
    unmount();
  });

  it('dismisses the request card when the cancelled ride matches the active request', async () => {
    mockActiveRideRequest = { id: 'ride-abc' };
    const { unmount } = await mountDriverHook();

    act(() => {
      socketEventHandlers['ride:request_cancelled']({ rideId: 'ride-abc', status: 'request_cancelled', cancelledAt: '2026-09-20T10:00:00Z' });
    });

    expect(mockDismissRideRequest).toHaveBeenCalled();
    unmount();
  });

  it('does not dismiss the card when the cancelled ride does not match', async () => {
    mockActiveRideRequest = { id: 'ride-abc' };
    const { unmount } = await mountDriverHook();

    act(() => {
      socketEventHandlers['ride:request_cancelled']({ rideId: 'ride-other', status: 'request_cancelled' });
    });

    expect(mockDismissRideRequest).not.toHaveBeenCalled();
    unmount();
  });
});

describe('Driver recovery: ride:cancelled as a fallback for a visible card', () => {
  it('dismisses the request card when the cancelled accepted ride matches', async () => {
    mockActiveRideRequest = { id: 'ride-abc' };
    const { unmount } = await mountDriverHook();

    act(() => {
      socketEventHandlers['ride:cancelled']({
        rideId: 'ride-abc',
        status: 'cancelled',
        cancelledBy: 'passenger',
        cancellationReason: 'Cambio de planes',
        cancellationFee: 0,
        driverId: 'driver-123',
        passengerId: 'passenger-1',
        cancelledAt: '2026-09-20T10:00:00Z',
        timestamp: '2026-09-20T10:00:00Z',
      });
    });

    expect(mockDismissRideRequest).toHaveBeenCalled();
    expect(mockShowStatus).toHaveBeenCalledWith('ride_cancelled', expect.any(String), undefined, expect.any(Object));
    unmount();
  });
});

describe('Driver recovery: foreground revalidation of pending request card', () => {
  it('dismisses a card whose ride is no longer pending when app returns to foreground', async () => {
    mockActiveRideRequest = { id: 'ride-abc' };
    mockGetPendingRides.mockResolvedValue({ data: { data: [] } });
    const { unmount } = await mountDriverHook();

    await act(async () => {
      appStateChangeHandler?.('active');
    });
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
    });

    expect(mockGetPendingRides).toHaveBeenCalled();
    expect(mockDismissRideRequest).toHaveBeenCalled();
    unmount();
  });

  it('keeps a card whose ride is still pending when app returns to foreground', async () => {
    mockActiveRideRequest = { id: 'ride-abc' };
    mockGetPendingRides.mockResolvedValue({ data: { data: [{ id: 'ride-abc' }] } });
    const { unmount } = await mountDriverHook();

    await act(async () => {
      appStateChangeHandler?.('active');
    });
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
    });

    expect(mockDismissRideRequest).not.toHaveBeenCalled();
    unmount();
  });

  it('does nothing on non-foreground states', async () => {
    mockActiveRideRequest = { id: 'ride-abc' };
    mockGetPendingRides.mockResolvedValue({ data: [] });
    const { unmount } = await mountDriverHook();

    await act(async () => {
      appStateChangeHandler?.('background');
    });
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
    });

    expect(mockGetPendingRides).not.toHaveBeenCalled();
    unmount();
  });
});