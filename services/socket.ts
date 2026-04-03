/**
 * WebSocket Service
 * Manages Socket.io connection for real-time ride tracking with automatic token refresh
 */

import { io, Socket } from 'socket.io-client';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';

const SOCKET_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
const TOKEN_KEY = 'auth_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const USER_KEY = 'auth_user';

// Socket instance
let socket: Socket | null = null;

// Connection state
let isConnected = false;
let isConnecting = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5; // Aumentado de 3 a 5

// Token refresh state
let isRefreshingToken = false;
let tokenRefreshPromise: Promise<string | null> | null = null;

// Connection state listeners
const connectionListeners: Set<(connected: boolean) => void> = new Set();

/**
 * Add connection state listener
 */
export const addConnectionListener = (listener: (connected: boolean) => void): void => {
  connectionListeners.add(listener);
  // Immediately notify current state
  listener(isConnected);
};

/**
 * Remove connection state listener
 */
export const removeConnectionListener = (listener: (connected: boolean) => void): void => {
  connectionListeners.delete(listener);
};

/**
 * Notify all listeners of connection state change
 */
const notifyConnectionChange = (connected: boolean): void => {
  isConnected = connected;
  connectionListeners.forEach(listener => {
    try {
      listener(connected);
    } catch (error) {
      console.error('[SOCKET] Error in connection listener:', error);
    }
  });
};

/**
 * Check if JWT token is expired or about to expire
 */
const isTokenExpired = (token: string): boolean => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const exp = payload.exp * 1000; // Convert to milliseconds
    const now = Date.now();
    const timeUntilExpiry = exp - now;

    // Consider token expired if it expires in less than 5 minutes
    const isExpired = timeUntilExpiry < 5 * 60 * 1000;

    if (isExpired) {
      console.log('[SOCKET] Token is expired or expiring soon');
      console.log(
        '[SOCKET] Time until expiry:',
        Math.floor(timeUntilExpiry / 1000 / 60),
        'minutes'
      );
    }

    return isExpired;
  } catch (error) {
    console.error('[SOCKET] Error checking token expiry:', error);
    return true; // Assume expired if we can't parse it
  }
};

/**
 * Refresh the authentication token
 */
const refreshAuthToken = async (): Promise<string | null> => {
  // If already refreshing, return the existing promise
  if (isRefreshingToken && tokenRefreshPromise) {
    console.log('[SOCKET] Token refresh already in progress, waiting...');
    return tokenRefreshPromise;
  }

  isRefreshingToken = true;

  tokenRefreshPromise = (async () => {
    try {
      console.log('[SOCKET] 🔄 Refreshing authentication token...');

      const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);

      if (!refreshToken) {
        console.error('[SOCKET] ❌ No refresh token found');
        return null;
      }

      const response = await axios.post(
        `${SOCKET_URL}/api/auth/refresh`,
        { refreshToken },
        { timeout: 10000 }
      );

      if (response.data.success && response.data.data) {
        const { accessToken, refreshToken: newRefreshToken } = response.data.data;

        // Store new tokens
        await SecureStore.setItemAsync(TOKEN_KEY, accessToken);
        if (newRefreshToken) {
          await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, newRefreshToken);
        }

        console.log('[SOCKET] ✅ Token refreshed successfully');
        return accessToken;
      }

      console.error('[SOCKET] ❌ Token refresh failed: Invalid response');
      return null;
    } catch (error: any) {
      console.error('[SOCKET] ❌ Token refresh error:', error.message);

      // If refresh token is invalid, clear all auth data
      if (error.response?.status === 401) {
        console.log('[SOCKET] Refresh token invalid, clearing auth data');
        await SecureStore.deleteItemAsync(TOKEN_KEY);
        await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
        await SecureStore.deleteItemAsync(USER_KEY);
      }

      return null;
    } finally {
      isRefreshingToken = false;
      tokenRefreshPromise = null;
    }
  })();

  return tokenRefreshPromise;
};

/**
 * Get a valid authentication token (refresh if needed)
 */
const getValidToken = async (providedToken?: string): Promise<string | null> => {
  let token: string | null = providedToken || null;

  if (!token) {
    token = await SecureStore.getItemAsync(TOKEN_KEY);
  }

  if (!token) {
    console.error('[SOCKET] No token available');
    return null;
  }

  // Check if token is expired
  if (isTokenExpired(token)) {
    console.log('[SOCKET] Token expired, attempting refresh...');
    const newToken = await refreshAuthToken();
    return newToken;
  }

  return token;
};

/**
 * Initialize and connect to WebSocket server
 * @param authToken - Optional authentication token. If not provided, will try to read from SecureStore
 */
export const connectSocket = async (authToken?: string): Promise<Socket> => {
  console.log('[SOCKET] ========== CONNECT SOCKET CALLED ==========');
  console.log('[SOCKET] URL:', SOCKET_URL);

  // Return existing socket if already connected
  if (socket && isConnected) {
    console.log('[SOCKET] Already connected, returning existing socket');
    return socket;
  }

  // Prevent multiple connection attempts
  if (isConnecting) {
    console.log('[SOCKET] Connection already in progress, waiting...');
    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(() => {
        if (socket && isConnected) {
          clearInterval(checkInterval);
          resolve(socket);
        }
      }, 100);

      setTimeout(() => {
        clearInterval(checkInterval);
        reject(new Error('Socket connection timeout'));
      }, 10000);
    });
  }

  isConnecting = true;

  try {
    // Get valid token (will refresh if expired)
    const token = await getValidToken(authToken);

    if (!token) {
      isConnecting = false;
      console.error('[SOCKET] ❌ No valid authentication token available');
      throw new Error('No valid authentication token');
    }

    console.log('[SOCKET] ✅ Valid token obtained');
    console.log('[SOCKET] Connecting to:', SOCKET_URL);

    // Disconnect existing socket if any
    if (socket) {
      socket.disconnect();
      socket = null;
    }

    // Create socket connection - Try websocket first, fallback to polling
    socket = io(SOCKET_URL, {
      auth: {
        token,
      },
      transports: ['websocket', 'polling'], // ← Intentar websocket primero, luego polling
      reconnection: true,
      reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
      reconnectionDelay: 2000, // ← Aumentado a 2 segundos
      reconnectionDelayMax: 10000, // ← Aumentado a 10 segundos
      timeout: 60000, // ← Aumentado a 60 segundos (1 minuto)
      upgrade: true, // ← Permitir upgrade
      forceNew: true, // ← Forzar nueva conexión
      rememberUpgrade: true, // ← Recordar el upgrade exitoso
    });

    // Connection event handlers
    socket.on('connect', () => {
      console.log('[SOCKET] ========================================');
      console.log('[SOCKET] ✅ CONNECTED SUCCESSFULLY!');
      console.log('[SOCKET]    Socket ID:', socket?.id);
      console.log('[SOCKET]    Transport:', socket?.io.engine.transport.name);
      console.log('[SOCKET]    URL:', SOCKET_URL);
      console.log('[SOCKET]    Token present:', !!token);
      console.log('[SOCKET] ========================================');
      isConnecting = false;
      reconnectAttempts = 0;
      notifyConnectionChange(true); // Notificar cambio de estado
    });

    socket.on('disconnect', reason => {
      console.log('[SOCKET] ❌ Disconnected:', reason);
      notifyConnectionChange(false); // Notificar cambio de estado

      // Don't try to reconnect if disconnected intentionally
      if (reason === 'io client disconnect' || reason === 'io server disconnect') {
        console.log('[SOCKET] Intentional disconnect, not reconnecting');
        return;
      }
    });

    socket.on('connect_error', async error => {
      console.error('[SOCKET] ========================================');
      console.error('[SOCKET] ❌ CONNECTION ERROR');
      console.error('[SOCKET]    Error:', error.message);
      console.error('[SOCKET]    Attempt:', reconnectAttempts + 1, '/', MAX_RECONNECT_ATTEMPTS);
      console.error('[SOCKET]    URL:', SOCKET_URL);
      console.error('[SOCKET] ========================================');

      isConnecting = false;
      reconnectAttempts++;

      // If we've tried multiple times, try refreshing the token
      if (reconnectAttempts >= 2 && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        console.log('[SOCKET] Attempting token refresh...');
        const newToken = await refreshAuthToken();

        if (newToken && socket) {
          // Update socket auth with new token
          socket.auth = { token: newToken };
          console.log('[SOCKET] ✅ Token refreshed, will retry connection');
        } else {
          console.error('[SOCKET] ❌ Token refresh failed');
        }
      }

      // If max attempts reached, give up silently
      if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        console.error('[SOCKET] ❌ Max reconnection attempts reached, giving up');
        disconnectSocket();
      }
    });

    socket.on('error', error => {
      console.error('[SOCKET] ========================================');
      console.error('[SOCKET] ❌ SOCKET ERROR');
      console.error('[SOCKET]    Error:', error);
      console.error('[SOCKET]    Socket ID:', socket?.id);
      console.error('[SOCKET]    Connected:', socket?.connected);
      console.error('[SOCKET] ========================================');
    });

    // Wait for connection with increased timeout - but don't fail if timeout
    try {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          console.warn('[SOCKET] ⚠️ Connection timeout after 60 seconds');
          console.warn('[SOCKET] Socket will continue trying to connect in background');
          console.warn('[SOCKET] Verifique que:');
          console.warn('[SOCKET]   1. El backend esté corriendo en:', SOCKET_URL);
          console.warn('[SOCKET]   2. La IP sea correcta y accesible desde el dispositivo');
          console.warn('[SOCKET]   3. No haya firewall bloqueando el puerto 3000');
          // Don't reject, just resolve - let socket keep trying in background
          resolve();
        }, 60000);

        socket!.once('connect', () => {
          clearTimeout(timeout);
          console.log('[SOCKET] ✅ Connection established successfully');
          resolve();
        });

        socket!.once('connect_error', error => {
          clearTimeout(timeout);
          console.error('[SOCKET] ❌ Connection failed:', error.message);
          console.error('[SOCKET] URL intentada:', SOCKET_URL);
          console.error('[SOCKET] Tipo de error:', (error as any).type || 'unknown');
          // Don't reject on first error, let it retry
          resolve();
        });
      });
    } catch (timeoutError) {
      // Even if timeout, return the socket - it will keep trying to connect
      console.warn('[SOCKET] Returning socket despite timeout - will connect in background');
    }

    console.log('[SOCKET] ========== CONNECT SOCKET COMPLETE ==========');
    return socket;
  } catch (error) {
    isConnecting = false;
    console.error('[SOCKET] ❌ Failed to connect:', error);
    console.error('[SOCKET] ========== CONNECT SOCKET FAILED ==========');
    throw error;
  }
};

/**
 * Disconnect from WebSocket server
 */
export const disconnectSocket = (): void => {
  if (socket) {
    socket.disconnect();
    socket.removeAllListeners();
    socket = null;
    reconnectAttempts = 0;
    notifyConnectionChange(false); // Notificar cambio de estado
  }
};

/**
 * Reconnect with a fresh token (useful after app resume)
 */
export const reconnectSocket = async (): Promise<Socket | null> => {
  console.log('[SOCKET] Reconnecting with fresh token...');

  // Disconnect existing socket
  disconnectSocket();

  try {
    // Get fresh token
    const token = await getValidToken();

    if (!token) {
      console.error('[SOCKET] Cannot reconnect: No valid token');
      return null;
    }

    // Connect with fresh token
    return await connectSocket(token);
  } catch (error) {
    console.error('[SOCKET] Reconnection failed:', error);
    return null;
  }
};

/**
 * Get current socket instance
 */
export const getSocket = (): Socket | null => {
  return socket;
};

/**
 * Check if socket is connected
 */
export const isSocketConnected = (): boolean => {
  return isConnected && socket !== null;
};

/**
 * Join a ride room
 */
export const joinRide = (rideId: string): void => {
  if (!socket || !isConnected) {
    console.warn('Cannot join ride: Socket not connected');
    return;
  }

  socket.emit('join_ride', { rideId });
  console.log(`📍 Joined ride room: ride:${rideId}`);
};

/**
 * Leave a ride room
 */
export const leaveRide = (rideId: string): void => {
  if (!socket || !isConnected) {
    console.warn('Cannot leave ride: Socket not connected');
    return;
  }

  socket.emit('leave_ride', { rideId });
  console.log(`📍 Left ride room: ride:${rideId}`);
};

/**
 * Listen for ride accepted event
 */
export const onRideAccepted = (
  callback: (data: {
    rideId: string;
    status: string;
    driver: {
      id: string;
      name: string;
      phone: string;
      rating: number;
      vehicleInfo: {
        type: string;
        model: string;
        licensePlate: string;
        color: string;
      };
      currentLocation?: {
        latitude: number;
        longitude: number;
      };
    };
    acceptedAt: string;
  }) => void
): void => {
  if (!socket) {
    console.warn('Cannot listen for ride accepted: Socket not initialized');
    return;
  }

  // Remove any existing listeners for this event to prevent duplicates
  socket.off('ride:accepted');
  socket.on('ride:accepted', callback);
};

/**
 * Listen for ride status changed event
 */
export const onRideStatusChanged = (
  callback: (data: {
    rideId: string;
    status: 'pending' | 'accepted' | 'arrived' | 'in_progress' | 'completed' | 'cancelled';
    timestamp: string;
  }) => void
): void => {
  if (!socket) {
    console.warn('Cannot listen for ride status: Socket not initialized');
    return;
  }

  // Remove any existing listeners for this event to prevent duplicates
  socket.off('ride:status_changed');
  socket.on('ride:status_changed', callback);
};

/**
 * Listen for driver location updates
 */
export const onDriverLocationUpdate = (
  callback: (data: {
    rideId: string;
    latitude: number;
    longitude: number;
    timestamp: string;
  }) => void
): void => {
  if (!socket) {
    console.warn('Cannot listen for location updates: Socket not initialized');
    return;
  }

  // Remove any existing listeners for this event to prevent duplicates
  socket.off('driver:location_update');
  socket.on('driver:location_update', callback);
};

/**
 * Listen for ETA updates
 */
export const onETAUpdate = (
  callback: (data: {
    rideId: string;
    eta: {
      estimatedMinutes: number;
      distanceKm: number;
      averageSpeedKmh: number;
      trafficFactor: number;
      timestamp: string;
    };
    driverLocation: {
      latitude: number;
      longitude: number;
    };
    targetType: 'pickup' | 'destination';
  }) => void
): void => {
  if (!socket) {
    console.warn('Cannot listen for ETA updates: Socket not initialized');
    return;
  }

  // Remove any existing listeners for this event to prevent duplicates
  socket.off('ride:eta_update');
  socket.on('ride:eta_update', callback);
};

/**
 * Listen for driver arrived event
 */
export const onDriverArrived = (
  callback: (data: {
    rideId: string;
    status: 'arrived';
    driverName: string;
    arrivedAt: string;
    timestamp: string;
  }) => void
): void => {
  if (!socket) {
    console.warn('Cannot listen for driver arrived: Socket not initialized');
    return;
  }

  // Remove any existing listeners for this event to prevent duplicates
  socket.off('ride:driver_arrived');
  socket.on('ride:driver_arrived', callback);
};

/**
 * Listen for ride cancelled event
 * @returns Cleanup function to remove the listener
 */
export const onRideCancelled = (
  callback: (data: {
    rideId: string;
    status: 'cancelled';
    cancelledBy: 'passenger' | 'driver' | 'system';
    cancellationReason: string;
    cancellationFee: number;
    cancelledAt: string;
    timestamp: string;
  }) => void
): (() => void) => {
  if (!socket) {
    console.warn('Cannot listen for ride cancelled: Socket not initialized');
    return () => {}; // Return no-op cleanup function
  }

  // Remove any existing listeners for this event to prevent duplicates
  socket.off('ride:cancelled');
  socket.on('ride:cancelled', callback);
  
  // Return cleanup function that removes this specific listener
  return () => {
    if (socket) {
      socket.off('ride:cancelled', callback);
    }
  };
};

/**
 * Listen for ride completed event
 * @returns Cleanup function to remove the listener
 */
export const onRideCompleted = (
  callback: (data: {
    rideId: string;
    status: 'completed';
    completedAt: string;
    actualDistanceKm: number;
    actualDurationMinutes: number;
    finalFare: number;
    timestamp: string;
  }) => void
): (() => void) => {
  if (!socket) {
    console.warn('Cannot listen for ride completed: Socket not initialized');
    return () => {}; // Return no-op cleanup function
  }

  // Remove any existing listeners for this event to prevent duplicates
  socket.off('ride:completed');
  socket.on('ride:completed', callback);
  
  // Return cleanup function that removes this specific listener
  return () => {
    if (socket) {
      socket.off('ride:completed', callback);
    }
  };
};

/**
 * Listen for driver availability changes
 * Notifies when driver's availability status changes (e.g., after ride cancellation)
 * @returns Cleanup function to remove the listener
 */
export const onDriverAvailabilityChanged = (
  callback: (data: {
    driverId: string;
    isAvailable: boolean;
    timestamp: string;
    location?: {
      latitude: number;
      longitude: number;
    };
  }) => void
): (() => void) => {
  if (!socket) {
    console.warn('Cannot listen for driver availability changed: Socket not initialized');
    return () => {};
  }

  // Remove any existing listeners for this event to prevent duplicates
  socket.off('driver:availability_changed');
  socket.on('driver:availability_changed', callback);

  // Return cleanup function
  return () => {
    if (socket) {
      socket.off('driver:availability_changed', callback);
    }
  };
};

/**
 * Listen for payment confirmation
 * Notifies when passenger confirms payment for a ride
 * @returns Cleanup function to remove the listener
 */
export const onPaymentConfirmed = (
  callback: (data: {
    rideId: string;
    paymentId: string;
    status: string;
    amount: number;
    timestamp: string;
  }) => void
): (() => void) => {
  if (!socket) {
    console.warn('Cannot listen for payment confirmed: Socket not initialized');
    return () => {};
  }

  // Remove any existing listeners for this event to prevent duplicates
  socket.off('ride:payment_confirmed');
  socket.on('ride:payment_confirmed', callback);

  // Return cleanup function
  return () => {
    if (socket) {
      socket.off('ride:payment_confirmed', callback);
    }
  };
};

/**
 * Remove all event listeners
 */
export const removeAllListeners = (): void => {
  if (!socket) {
    return;
  }

  socket.off('ride:accepted');
  socket.off('ride:status_changed');
  socket.off('driver:location_update');
  socket.off('ride:eta_update');
  socket.off('ride:driver_arrived');
  socket.off('ride:cancelled');
  socket.off('ride:completed');
  socket.off('driver:availability_changed');
};

/**
 * Remove specific event listener
 */
export const removeListener = (event: string, callback?: (...args: any[]) => void): void => {
  if (!socket) {
    return;
  }

  if (callback) {
    socket.off(event, callback);
  } else {
    socket.off(event);
  }
};

export default {
  connectSocket,
  disconnectSocket,
  reconnectSocket,
  getSocket,
  isSocketConnected,
  addConnectionListener,
  removeConnectionListener,
  joinRide,
  leaveRide,
  onRideAccepted,
  onRideStatusChanged,
  onDriverLocationUpdate,
  onETAUpdate,
  onDriverArrived,
  onRideCancelled,
  removeAllListeners,
  removeListener,
};
