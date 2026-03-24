/**
 * WebSocket Service
 * Manages Socket.io connection for real-time ride tracking
 */

import { io, Socket } from 'socket.io-client';
import * as SecureStore from 'expo-secure-store';

const SOCKET_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
const TOKEN_KEY = 'auth_token';

// Socket instance
let socket: Socket | null = null;

// Connection state
let isConnected = false;
let isConnecting = false;

/**
 * Initialize and connect to WebSocket server
 * @param authToken - Optional authentication token. If not provided, will try to read from SecureStore
 */
export const connectSocket = async (authToken?: string): Promise<Socket> => {
  console.log('[SOCKET] ========== CONNECT SOCKET CALLED ==========');
  console.log('[SOCKET] Auth token provided:', !!authToken);
  console.log('[SOCKET] Token length:', authToken?.length || 0);
  console.log('[SOCKET] Socket URL:', SOCKET_URL);
  
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

      // Timeout after 10 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        reject(new Error('Socket connection timeout'));
      }, 10000);
    });
  }

  isConnecting = true;

  try {
    // Get authentication token (use provided token or read from SecureStore)
    let token = authToken;
    
    if (!token) {
      console.log('[SOCKET] No token provided, reading from SecureStore...');
      token = await SecureStore.getItemAsync(TOKEN_KEY);
      console.log('[SOCKET] Token from SecureStore:', !!token);
    } else {
      console.log('[SOCKET] Using provided token');
    }

    if (!token) {
      isConnecting = false;
      console.error('[SOCKET] ❌ No authentication token found');
      throw new Error('No authentication token found');
    }

    console.log('[SOCKET] ✅ Token validated, length:', token.length);
    console.log('[SOCKET] Creating socket connection...');
    console.log('[SOCKET] Connecting to:', SOCKET_URL);

    // Create socket connection
    socket = io(SOCKET_URL, {
      auth: {
        token,
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    });

    console.log('[SOCKET] Socket instance created, waiting for connection...');

    // Connection event handlers
    socket.on('connect', () => {
      console.log('[SOCKET] ✅ Connected successfully! Socket ID:', socket?.id);
      isConnected = true;
      isConnecting = false;
    });

    socket.on('disconnect', (reason) => {
      console.log('[SOCKET] ❌ Disconnected:', reason);
      isConnected = false;
    });

    socket.on('connect_error', (error) => {
      console.error('[SOCKET] ⚠️ Connection error:', error.message);
      console.error('[SOCKET] Error details:', JSON.stringify(error));
      isConnecting = false;
    });

    socket.on('error', (error) => {
      console.error('[SOCKET] ⚠️ Socket error:', error);
    });

    // Wait for connection
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        console.error('[SOCKET] ❌ Connection timeout after 10 seconds');
        reject(new Error('Socket connection timeout'));
      }, 10000);

      socket!.once('connect', () => {
        clearTimeout(timeout);
        console.log('[SOCKET] ✅ Connection established successfully');
        resolve();
      });

      socket!.once('connect_error', (error) => {
        clearTimeout(timeout);
        console.error('[SOCKET] ❌ Connection failed:', error.message);
        console.error('[SOCKET] Error type:', error.type);
        console.error('[SOCKET] Error description:', error.description);
        reject(error);
      });
    });

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
    socket = null;
    isConnected = false;
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

  socket.on('ride:eta_update', callback);
};

/**
 * Listen for ride cancelled event
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
): void => {
  if (!socket) {
    console.warn('Cannot listen for ride cancelled: Socket not initialized');
    return;
  }

  socket.on('ride:cancelled', callback);
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
  socket.off('ride:cancelled');
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
  getSocket,
  isSocketConnected,
  joinRide,
  leaveRide,
  onRideAccepted,
  onRideStatusChanged,
  onDriverLocationUpdate,
  onETAUpdate,
  onRideCancelled,
  removeAllListeners,
  removeListener,
};
