/**
 * WebSocket Service
 * Manages Socket.io connection for real-time ride tracking with automatic token refresh
 */

import { io, Socket } from 'socket.io-client';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';

const SOCKET_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000'; // definido en eas.json por perfil

// Extraer host y path de la URL para Socket.IO
// Ej: SOCKET_URL=https://administracionurbantaxis.com/urbantaxis → baseUrl=https://administracionurbantaxis.com, path=/urbantaxis/socket.io
let SOCKET_BASE_URL = SOCKET_URL;
let SOCKET_PATH = '/socket.io';

try {
  const _parsedUrl = new URL(SOCKET_URL);
  SOCKET_BASE_URL = `${_parsedUrl.protocol}//${_parsedUrl.host}`;
  SOCKET_PATH = _parsedUrl.pathname !== '/' ? `${_parsedUrl.pathname}/socket.io` : '/socket.io';
} catch (_e) {
  // Fallback: extraer base y path con regex por si new URL() falla en Hermes
  console.warn('[SOCKET] ⚠️ new URL() failed, using regex fallback:', _e);
  try {
    const match = SOCKET_URL.match(/^(https?:\/\/[^\/]+)(\/.*)?$/);
    if (match) {
      SOCKET_BASE_URL = match[1];
      const pathname = match[2] || '';
      SOCKET_PATH = pathname && pathname !== '/' ? `${pathname}/socket.io` : '/socket.io';
    }
  } catch (_e2) {
    console.error('[SOCKET] ❌ URL parsing fallback also failed:', _e2);
  }
}

// Log inmediato de la configuración de URL (aparece al cargar el módulo)
console.log('[SOCKET] 📋 ===== SOCKET MODULE INITIALIZED =====');
console.log('[SOCKET] 📋 URL Config:', JSON.stringify({
  raw: SOCKET_URL,
  baseUrl: SOCKET_BASE_URL,
  path: SOCKET_PATH,
}, null, 2));
console.log('[SOCKET] 📋 Environment variables:');
console.log('[SOCKET]    EXPO_PUBLIC_API_URL:', SOCKET_URL);
console.log('[SOCKET]    EXPO_PUBLIC_API_URL (falls back to localhost if not set)');
console.log('[SOCKET]    Parsed host:', SOCKET_BASE_URL);
console.log('[SOCKET]    Parsed path:', SOCKET_PATH);
console.log('[SOCKET]    Full socket URL:', SOCKET_BASE_URL + SOCKET_PATH);
console.log('[SOCKET]    Is localtunnel:', SOCKET_URL.includes('.loca.lt'));
    console.log('[SOCKET]    Transport mode: polling only (LiteSpeed proxy workaround)');
console.log('[SOCKET] 📋 ===== END MODULE INIT =====');

// Hacer un ping de diagnóstico al backend para confirmar conectividad
// Esto ayuda a diagnosticar si la app está usando la URL correcta
const runDiagnosticPing = async (): Promise<void> => {
  console.log('[SOCKET] 🔍 ===== STARTING DIAGNOSTIC PING =====');
  console.log('[SOCKET] 🔍 Diagnostic ping to:', `${SOCKET_URL}/api/diagnostics/ping`);
  console.log('[SOCKET] 🔍 Timeout: 10s');
  console.log('[SOCKET] 🔍 Current time:', new Date().toISOString());
  try {
    const diagnosticUrl = `${SOCKET_URL}/api/diagnostics/ping`;
    console.log('[SOCKET] 🔍 Sending GET to:', diagnosticUrl);
    const startTime = Date.now();
    const response = await axios.get(diagnosticUrl, { timeout: 10000 });
    const elapsed = Date.now() - startTime;
    console.log('[SOCKET] ✅ ===== DIAGNOSTIC PING SUCCESS =====');
    console.log('[SOCKET] ✅ Response status:', response.status, response.statusText);
    console.log('[SOCKET] ✅ Response time:', elapsed + 'ms');
    console.log('[SOCKET] ✅ Response data:', JSON.stringify(response.data));
    console.log('[SOCKET] ✅ Server IP:', response.data?.data?.ip || 'unknown');
  } catch (error: any) {
    console.error('[SOCKET] ❌ ===== DIAGNOSTIC PING FAILED =====');
    console.error('[SOCKET] ❌ Error name:', error.name);
    console.error('[SOCKET] ❌ Error message:', error.message);
    console.error('[SOCKET] ❌ Error code:', error.code || 'N/A');
    console.error('[SOCKET] ❌ URL intentada:', `${SOCKET_URL}/api/diagnostics/ping`);
    console.error('[SOCKET] ❌ ¿EXPO_PUBLIC_API_URL está correcto?');
    if (error.response) {
      console.error('[SOCKET] ❌ Response status:', error.response.status);
      console.error('[SOCKET] ❌ Response data:', JSON.stringify(error.response.data));
    } else if (error.request) {
      console.error('[SOCKET] ❌ No response received (network error / timeout / DNS)');
    }
    console.error('[SOCKET] ❌ Full error:', error.stack || 'no stack');
  }
};

// Ejecutar diagnóstico inmediatamente (fire-and-forget, no bloquea)
runDiagnosticPing();

const TOKEN_KEY = 'auth_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const USER_KEY = 'auth_user';

// Socket instance
let socket: Socket | null = null;

// Connection state
let isConnected = false;
let isConnecting = false;
let reconnectAttempts = 0;
let lastTransport: string | null = null;
let lastError: string | null = null;

// Auto-reconnect flag: set to true when socket should auto-retry indefinitely
let shouldAutoReconnect = true;

// No hard limit on reconnection attempts — keep trying indefinitely
// Socket.IO client handles its own retry with built-in reconnection

// Token refresh state
let isRefreshingToken = false;
let tokenRefreshPromise: Promise<string | null> | null = null;

// Connection state listeners
const connectionListeners: Set<(connected: boolean) => void> = new Set();

// Detailed state export for diagnostics
export const getSocketDiagnostics = () => ({
  isConnected,
  isConnecting,
  reconnectAttempts,
  lastTransport,
  lastError,
  socketExists: socket !== null,
  socketConnected: socket?.connected ?? false,
  socketId: socket?.id ?? null,
  shouldAutoReconnect,
  baseUrl: SOCKET_BASE_URL,
  path: SOCKET_PATH,
});

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
  const connectId = Date.now().toString(36).slice(-6); // unique short ID for tracing this connection attempt
  console.log('[SOCKET] ========== CONNECT SOCKET CALLED ==========');
  console.log('[SOCKET]    Connect ID:', connectId);
  console.log('[SOCKET]    URL:', SOCKET_URL);
  console.log('[SOCKET]    Base URL:', SOCKET_BASE_URL);
  console.log('[SOCKET]    Path:', SOCKET_PATH);
  console.log('[SOCKET]    Full URL:', SOCKET_BASE_URL + SOCKET_PATH);
  console.log('[SOCKET]    Existing socket:', !!socket, 'isConnected:', isConnected, 'isConnecting:', isConnecting);
  console.log('[SOCKET]    has authToken param:', !!authToken);
  console.log('[SOCKET]    Timestamp:', new Date().toISOString());

  // Return existing socket if already connected
  if (socket && isConnected) {
    console.log('[SOCKET] Already connected, returning existing socket');
    console.log('[SOCKET]    Socket ID:', socket.id);
    console.log('[SOCKET]    Transport:', socket.io?.engine?.transport?.name || 'unknown');
    return socket;
  }

  // Prevent multiple connection attempts
  if (isConnecting) {
    console.log('[SOCKET] Connection already in progress, waiting...');
    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(() => {
        if (socket && isConnected) {
          clearInterval(checkInterval);
          console.log('[SOCKET] Connection completed while waiting:', socket.id);
          resolve(socket);
        }
      }, 100);

      // Extended timeout to 30s to account for slow initial connections (network latency, DNS, etc.)
      setTimeout(() => {
        clearInterval(checkInterval);
        // Don't reject if socket connected after timeout - just resolve it
        if (socket && isConnected) {
          console.log('[SOCKET] Connection succeeded after timeout period:', socket.id);
          resolve(socket);
        } else {
          console.error('[SOCKET] Connection timeout after 30s waiting');
          reject(new Error('Socket connection timeout'));
        }
      }, 30000);
    });
  }

  isConnecting = true;
  console.log('[SOCKET] 🔌 Step 1: isConnecting set to TRUE');

  try {
    // Get valid token (will refresh if expired)
    console.log('[SOCKET] 🔑 Step 2: Getting valid token...');
    const token = await getValidToken(authToken);

    if (!token) {
      isConnecting = false;
      console.error('[SOCKET] ❌ Step 2 FAILED: No valid authentication token available');
      console.error('[SOCKET]    authToken param provided:', !!authToken);
      console.error('[SOCKET]    Token from SecureStore:', !!authToken ? '(provided)' : '(not provided)');
      throw new Error('No valid authentication token');
    }

    console.log('[SOCKET] ✅ Step 2: Valid token obtained');
    console.log('[SOCKET]    Token length:', token.length);
    console.log('[SOCKET]    Token prefix:', token.substring(0, 20) + '...');

    // Decode token payload for debugging (without verification)
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      console.log('[SOCKET]    Token user ID:', payload.id || payload.sub || 'unknown');
      console.log('[SOCKET]    Token role:', payload.role || 'unknown');
      console.log('[SOCKET]    Token exp:', payload.exp ? new Date(payload.exp * 1000).toISOString() : 'unknown');
      console.log('[SOCKET]    Token iat:', payload.iat ? new Date(payload.iat * 1000).toISOString() : 'unknown');
    } catch {
      console.error('[SOCKET]    Could not decode token payload (malformed?)');
    }

    console.log('[SOCKET] 🌐 Step 3: Connecting to server...');
    console.log('[SOCKET]    Server:', SOCKET_BASE_URL);
    console.log('[SOCKET]    Path:', SOCKET_PATH);
    console.log('[SOCKET]    Token provided in auth:', true);

    // Disconnect existing socket if any
    if (socket) {
      console.log('[SOCKET] Disconnecting existing socket before new connection');
      console.log('[SOCKET]    Old socket ID:', socket.id);
      console.log('[SOCKET]    Old socket connected:', socket.connected);
      socket.removeAllListeners();
      socket.disconnect();
      socket = null;
    }

    // Reset state for fresh connection
    reconnectAttempts = 0;
    lastError = null;
    shouldAutoReconnect = true;

    // Forzar solo polling porque LiteSpeed detrás del proxy no reenvía
    // el upgrade a WebSocket correctamente. HTTP polling funciona sin problema.
    const socketTransports: Array<'websocket' | 'polling'> = ['polling'];

    console.log('[SOCKET]    Transports:', JSON.stringify(socketTransports));
    console.log('[SOCKET]    Force polling-only mode (LiteSpeed proxy workaround)');

    // Create socket connection — with INFINITE reconnection
    console.log('[SOCKET] 🔌 Step 4: Creating Socket.IO instance...');
    socket = io(SOCKET_BASE_URL, {
      path: SOCKET_PATH,
      auth: {
        token,
      },
      transports: socketTransports,
      reconnection: true,
      reconnectionAttempts: 10,         // Limit retries to save battery
      reconnectionDelay: 2000,
      reconnectionDelayMax: 15000,     // Max 15s between retries
      timeout: 20000,                  // 20s timeout (reduced from 60s)
      upgrade: false,
      forceNew: true,
      rememberUpgrade: false,
    });

    console.log('[SOCKET] ✅ Step 4: Socket.IO instance created');
    console.log('[SOCKET]    Socket ID (pre-connect):', socket.id || 'null (not yet assigned)');
    console.log('[SOCKET]    Socket connected (pre-connect):', socket.connected);
    console.log('[SOCKET]    Socket.IO version:', (socket as any).io?.engine?.transport?.name || 'unknown');

    // Connection event handlers
    socket.on('connect', () => {
      lastTransport = socket?.io.engine.transport.name ?? null;
      lastError = null;
      isConnecting = false;
      reconnectAttempts = 0;
      const connectedAt = new Date().toISOString();
      console.log('[SOCKET] ============================================');
      console.log('[SOCKET] ✅ ===== CONNECTED SUCCESSFULLY! =====');
      console.log('[SOCKET]    Socket ID:', socket?.id);
      console.log('[SOCKET]    Transport:', lastTransport);
      console.log('[SOCKET]    URL:', SOCKET_URL);
      console.log('[SOCKET]    Token present:', !!token);
      console.log('[SOCKET]    Connected at:', connectedAt);
      console.log('[SOCKET]    Reconnect attempts before success:', reconnectAttempts);
      // Log all transports available
      try {
        const transports = socket?.io?.engine?.transport?.name;
        const upgrades = ['polling', 'websocket'];
        console.log('[SOCKET]    Current transport:', transports);
        if (transports === 'polling') {
          console.log('[SOCKET]    ⚠️ Currently on polling, upgrade to WebSocket pending...');
        }
      } catch {}
      console.log('[SOCKET] ============================================');
      notifyConnectionChange(true);
    });

    socket.on('disconnect', reason => {
      console.log('[SOCKET] ❌ ===== DISCONNECTED =====');
      console.log('[SOCKET]    Reason:', reason);
      console.log('[SOCKET]    Socket ID was:', socket?.id || 'unknown');
      console.log('[SOCKET]    Was connected:', socket?.connected);
      console.log('[SOCKET]    Transport was:', socket?.io?.engine?.transport?.name || 'unknown');
      console.log('[SOCKET]    Disconnected at:', new Date().toISOString());
      console.log('[SOCKET]    Time connected:', 'N/A');
      console.log('[SOCKET]    shouldAutoReconnect:', shouldAutoReconnect);
      console.log('[SOCKET] ========================');
      notifyConnectionChange(false);

      // Don't try to reconnect if disconnected intentionally by us
      if (reason === 'io client disconnect' || reason === 'io server disconnect') {
        console.log('[SOCKET] Intentional disconnect, setting shouldAutoReconnect = false');
        shouldAutoReconnect = false;
        return;
      }

      // For transport errors / ping timeout, keep auto-reconnect on
      console.log('[SOCKET] Transport error disconnect — Socket.IO will auto-reconnect');
      shouldAutoReconnect = true;
    });

    socket.on('connect_error', async error => {
      isConnecting = false;
      reconnectAttempts++;
      lastError = error.message;

      console.error('[SOCKET] ============================================');
      console.error(`[SOCKET] ❌ CONNECTION ERROR (Attempt ${reconnectAttempts})`);
      console.error('[SOCKET]    Error:', error.message);
      console.error('[SOCKET]    Error type:', (error as any).type || 'N/A');
      console.error('[SOCKET]    Error description:', (error as any).description || 'N/A');
      console.error('[SOCKET]    URL:', SOCKET_URL);
      console.error('[SOCKET]    Base URL:', SOCKET_BASE_URL);
      console.error('[SOCKET]    Path:', SOCKET_PATH);
      console.error('[SOCKET]    Transport:', socket?.io?.engine?.transport?.name || 'no transport yet');
      console.error('[SOCKET]    Socket ID:', socket?.id || 'no id');
      console.error('[SOCKET]    Connected:', socket?.connected);
      console.error('[SOCKET]    Time:', new Date().toISOString());
      console.error('[SOCKET]    Reconnect delay:', Math.min(2000 * Math.pow(1.5, reconnectAttempts), 30000) + 'ms');
      console.error('[SOCKET] ============================================');

      // Periodically refresh token (every 5 attempts) to handle expired tokens
      if (reconnectAttempts % 5 === 0) {
        console.log('[SOCKET] 🔄 Periodic token refresh (attempt', reconnectAttempts + ')...');
        console.log('[SOCKET]    Current time:', new Date().toISOString());
        const newToken = await refreshAuthToken();
        if (newToken && socket) {
          socket.auth = { token: newToken };
          console.log('[SOCKET] ✅ Token refreshed for next attempt');
          console.log('[SOCKET]    New token length:', newToken.length);
          console.log('[SOCKET]    New token prefix:', newToken.substring(0, 20) + '...');
        } else {
          console.error('[SOCKET] ❌ Token refresh failed');
          console.error('[SOCKET]    newToken:', !!newToken);
          console.error('[SOCKET]    socket exists:', !!socket);
        }
      }

      // NEVER call disconnectSocket() here — let Socket.IO keep retrying forever
      console.log('[SOCKET] Socket.IO will retry automatically (delay increasing up to 30s)');
      console.log('[SOCKET]    Current attempt:', reconnectAttempts);
    });

    socket.on('error', error => {
      lastError = typeof error === 'string' ? error : error.message || 'Unknown socket error';
      console.error('[SOCKET] ============================================');
      console.error('[SOCKET] ❌ ===== SOCKET ERROR =====');
      console.error('[SOCKET]    Error:', typeof error === 'object' ? JSON.stringify(error) : error);
      console.error('[SOCKET]    Socket ID:', socket?.id);
      console.error('[SOCKET]    Connected:', socket?.connected);
      console.error('[SOCKET]    Transport:', socket?.io?.engine?.transport?.name || 'unknown');
      console.error('[SOCKET]    Time:', new Date().toISOString());
      console.error('[SOCKET] ============================================');
    });

    // Wait for connection with a shorter initial timeout — returns quickly to not block UI
    console.log('[SOCKET] ⏱️ Step 5: Waiting for connection (timeout: 15s)...');
    console.log('[SOCKET]    Socket will continue in background after timeout');
    try {
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          console.warn('[SOCKET] ⚠️ Initial connection not yet established after 15s');
          console.warn('[SOCKET]    Socket STATE at timeout:');
          console.warn('[SOCKET]    - connected:', socket?.connected);
          console.warn('[SOCKET]    - id:', socket?.id);
          console.warn('[SOCKET]    - transport:', socket?.io?.engine?.transport?.name);
          console.warn('[SOCKET]    Socket will continue trying in background...');
          resolve();
        }, 15000);

        socket!.once('connect', () => {
          clearTimeout(timeout);
          console.log('[SOCKET] ✅ Initial connection established within timeout');
          resolve();
        });

        socket!.once('connect_error', (err) => {
          clearTimeout(timeout);
          console.warn('[SOCKET] ⚠️ First connect_error before timeout:', err.message);
          console.warn('[SOCKET]    Not rejecting — Socket.IO will keep retrying');
          // Don't reject on first error — Socket.IO will keep retrying
          resolve();
        });
      });
    } catch (timeoutError: any) {
      console.warn('[SOCKET] ⚠️ Timeout error caught:', timeoutError.message);
      console.warn('[SOCKET] Returning socket despite error — will connect in background');
    }

    console.log('[SOCKET] ========== CONNECT SOCKET COMPLETE (ID:', connectId + ') ==========');
    console.log('[SOCKET]    Final state — connected:', socket?.connected, 'id:', socket?.id);
    return socket;
  } catch (error: any) {
    isConnecting = false;
    console.error('[SOCKET] ❌ ===== CONNECT SOCKET FAILED =====');
    console.error('[SOCKET]    Error:', error.message);
    console.error('[SOCKET]    Stack:', error.stack || 'no stack');
    console.error('[SOCKET] ===================================');
    throw error;
  }
};

/**
 * Disconnect from WebSocket server
 */
export const disconnectSocket = (): void => {
  console.log('[SOCKET] 🔌 ===== DISCONNECT SOCKET CALLED =====');
  console.log('[SOCKET]    shouldAutoReconnect before:', shouldAutoReconnect);
  console.log('[SOCKET]    socket exists:', !!socket);
  console.log('[SOCKET]    socket connected:', socket?.connected);
  console.log('[SOCKET]    socket id:', socket?.id);
  console.log('[SOCKET]    reconnectAttempts:', reconnectAttempts);
  if (socket) {
    console.log('[SOCKET]    transport:', socket?.io?.engine?.transport?.name || 'unknown');
    socket.removeAllListeners();
    console.log('[SOCKET]    listeners removed');
    socket.disconnect();
    console.log('[SOCKET]    disconnected');
    socket = null;
    reconnectAttempts = 0;
    lastTransport = null;
    lastError = null;
    shouldAutoReconnect = false;
    notifyConnectionChange(false);
    console.log('[SOCKET] ✅ Socket disconnected and cleaned up');
  } else {
    console.log('[SOCKET] ⚠️ No socket to disconnect');
  }
};

/**
 * Reconnect with a fresh token (useful after app resume or manual tap)
 */
export const reconnectSocket = async (): Promise<Socket | null> => {
  console.log('[SOCKET] 🔄 ===== RECONNECT SOCKET CALLED =====');
  console.log('[SOCKET]    Time:', new Date().toISOString());
  console.log('[SOCKET]    Current socket exists:', !!socket);
  console.log('[SOCKET]    Current socket connected:', socket?.connected);

  // If socket is connected, don't touch it — preserves all registered listeners
  if (socket && socket.connected) {
    console.log('[SOCKET] ✅ Socket healthy (id: ' + socket.id + '), no reconnect needed');
    return socket;
  }

  // Socket exists but disconnected — try Socket.IO native reconnect
  if (socket && !socket.connected) {
    console.log('[SOCKET] 🔄 Socket disconnected, attempting native reconnect...');
    socket.connect();
    // Wait for connection
    try {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Reconnect timeout')), 10000);
        socket!.once('connect', () => {
          clearTimeout(timeout);
          resolve();
        });
        socket!.once('connect_error', (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });
      console.log('[SOCKET] ✅ Native reconnect successful');
      return socket;
    } catch (err: any) {
      console.log('[SOCKET] ⚠️ Native reconnect failed:', err.message);
    }
  }

  // Full reconnect: destroy old and create new
  console.log('[SOCKET]    Step 1: Disconnecting existing socket...');
  disconnectSocket();

  // Small delay to ensure cleanup is complete
  console.log('[SOCKET]    Step 2: Waiting 300ms for cleanup...');
  await new Promise(resolve => setTimeout(resolve, 300));

  try {
    // Get fresh token
    console.log('[SOCKET]    Step 3: Getting fresh token...');
    const token = await getValidToken();

    if (!token) {
      console.error('[SOCKET] ❌ Step 3 FAILED: No valid token');
      console.error('[SOCKET]    Token from SecureStore was null');
      return null;
    }

    console.log('[SOCKET] ✅ Fresh token obtained, length:', token.length);
    console.log('[SOCKET]    Step 4: Calling connectSocket...');
    return await connectSocket(token);
  } catch (error: any) {
    console.error('[SOCKET] ❌ Reconnection failed:', error.message);
    console.error('[SOCKET]    Stack:', error.stack || 'no stack');
    return null;
  }
};

/**
 * Get current socket instance
 */
export const getSocket = (): Socket | null => {
  const exists = socket !== null;
  console.log('[SOCKET] getSocket() called — exists:', exists, 'connected:', socket?.connected, 'id:', socket?.id || 'N/A');
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
  socket.off('ride:payment_completed');
  socket.on('ride:payment_completed', callback);

  // Return cleanup function
  return () => {
    if (socket) {
      socket.off('ride:payment_completed', callback);
    }
  };
};

/**
 * Listen for shared ride invitation received event
 * @returns Cleanup function to remove the listener
 */
export const onSharedRideInvitationReceived = (
  callback: (data: {
    invitationId: string;
    inviterId: string;
    inviterName: string;
    inviterCode?: string;
    pickupPoints: Array<{ latitude: number; longitude: number; address: string }>;
    destinationPoints: Array<{ latitude: number; longitude: number; address: string }>;
    estimatedFare: number;
    currency: string;
    expiresAt: string;
  }) => void
): (() => void) => {
  if (!socket) {
    console.warn('Cannot listen for shared ride invitation: Socket not initialized');
    return () => {};
  }

  // Remove any existing listeners for this event to prevent duplicates
  socket.off('shared_ride:invitation_received');
  socket.on('shared_ride:invitation_received', callback);

  // Return cleanup function
  return () => {
    if (socket) {
      socket.off('shared_ride:invitation_received', callback);
    }
  };
};

/**
 * Listen for shared ride invitation accepted event
 * @returns Cleanup function to remove the listener
 */
export const onSharedRideInvitationAccepted = (
  callback: (data: {
    invitationId: string;
    inviteeId: string;
    inviteeName: string;
    inviteePickupLocation: { latitude: number; longitude: number; address: string };
    updatedFare: number;
    timestamp: string;
  }) => void
): (() => void) => {
  if (!socket) {
    console.warn('Cannot listen for shared ride invitation accepted: Socket not initialized');
    return () => {};
  }

  // Remove any existing listeners for this event to prevent duplicates
  socket.off('shared_ride:invitation_accepted');
  socket.on('shared_ride:invitation_accepted', callback);

  // Return cleanup function
  return () => {
    if (socket) {
      socket.off('shared_ride:invitation_accepted', callback);
    }
  };
};

/**
 * Listen for shared ride invitation rejected event
 * @returns Cleanup function to remove the listener
 */
export const onSharedRideInvitationRejected = (
  callback: (data: {
    invitationId: string;
    inviteeId: string;
    inviteeName: string;
    timestamp: string;
  }) => void
): (() => void) => {
  if (!socket) {
    console.warn('Cannot listen for shared ride invitation rejected: Socket not initialized');
    return () => {};
  }

  // Remove any existing listeners for this event to prevent duplicates
  socket.off('shared_ride:invitation_rejected');
  socket.on('shared_ride:invitation_rejected', callback);

  // Return cleanup function
  return () => {
    if (socket) {
      socket.off('shared_ride:invitation_rejected', callback);
    }
  };
};

/**
 * Listen for shared ride invitation expired event
 * @returns Cleanup function to remove the listener
 */
export const onSharedRideInvitationExpired = (
  callback: (data: {
    invitationId: string;
    timestamp: string;
  }) => void
): (() => void) => {
  if (!socket) {
    console.warn('Cannot listen for shared ride invitation expired: Socket not initialized');
    return () => {};
  }

  // Remove any existing listeners for this event to prevent duplicates
  socket.off('shared_ride:invitation_expired');
  socket.on('shared_ride:invitation_expired', callback);

  // Return cleanup function
  return () => {
    if (socket) {
      socket.off('shared_ride:invitation_expired', callback);
    }
  };
};

/**
 * Listen for passenger location updates in shared rides
 * @returns Cleanup function to remove the listener
 */
export const onPassengerLocationUpdate = (
  callback: (data: {
    rideId: string;
    passengerId: string;
    passengerNumber: 1 | 2; // 1 for primary passenger, 2 for shared passenger
    latitude: number;
    longitude: number;
    timestamp: string;
  }) => void
): (() => void) => {
  if (!socket) {
    console.warn('Cannot listen for passenger location updates: Socket not initialized');
    return () => {};
  }

  // Remove any existing listeners for this event to prevent duplicates
  socket.off('passenger:location_update');
  socket.on('passenger:location_update', callback);

  // Return cleanup function
  return () => {
    if (socket) {
      socket.off('passenger:location_update', callback);
    }
  };
};

/**
 * Listen for delegated ride tracking updates
 * Notifies the requester (registered passenger who paid) about ride status and driver location
 * @returns Cleanup function to remove the listener
 */
export const onDelegatedRideTrackingUpdate = (
  callback: (data: {
    rideId: string;
    status: 'pending' | 'accepted' | 'arrived' | 'in_progress' | 'completed' | 'cancelled';
    beneficiaryName: string;
    beneficiaryPhone: string;
    driver?: {
      id: string;
      name: string;
      phone: string;
      location?: {
        latitude: number;
        longitude: number;
      };
    };
    eta?: {
      estimatedMinutes: number;
      distanceKm: number;
    };
    timestamp: string;
  }) => void
): (() => void) => {
  if (!socket) {
    console.warn('Cannot listen for delegated ride tracking updates: Socket not initialized');
    return () => {};
  }

  // Remove any existing listeners for this event to prevent duplicates
  socket.off('delegated_ride:tracking_update');
  socket.on('delegated_ride:tracking_update', callback);

  // Return cleanup function
  return () => {
    if (socket) {
      socket.off('delegated_ride:tracking_update', callback);
    }
  };
};

/**
 * Remove all event listeners
 */
export const removeRideListeners = (): void => {
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
  socket.off('passenger:location_update');
};

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
  socket.off('shared_ride:invitation_received');
  socket.off('shared_ride:invitation_accepted');
  socket.off('shared_ride:invitation_rejected');
  socket.off('shared_ride:invitation_expired');
  socket.off('passenger:location_update');
  socket.off('delegated_ride:tracking_update');
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
  getSocketDiagnostics,
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
  onSharedRideInvitationReceived,
  onSharedRideInvitationAccepted,
  onSharedRideInvitationRejected,
  onSharedRideInvitationExpired,
  onPassengerLocationUpdate,
  onDelegatedRideTrackingUpdate,
  removeAllListeners,
  removeListener,
};
