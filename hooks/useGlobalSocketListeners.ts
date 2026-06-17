/**
 * useGlobalSocketListeners Hook
 * Registers global socket.io listeners that remain active across all screens
 * Fixes bug where payment and cancellation notifications were only received on home screen
 */

import { useEffect, useCallback, useRef } from 'react';
import { getSocket, connectSocket } from '@/services/socket';
import { useSound } from './useSound';
import { useUnifiedNotifications } from '@/context/UnifiedNotificationContext';
import { useExchangeRate } from './useExchangeRate';
import type { User } from '@/store/authStore';

interface UseGlobalSocketListenersProps {
  user: User | null;
  isAuthenticated: boolean;
}

export const useGlobalSocketListeners = ({
  user,
  isAuthenticated,
}: UseGlobalSocketListenersProps) => {
  const { playNotificationSound } = useSound();
  const { showRideRequest, showStatus, showSuccess, showError, showWarning } = useUnifiedNotifications();
  const { convertToUsd, convertToBs } = useExchangeRate();
  
  // Ref to track if listeners are already registered
  const listenersRegisteredRef = useRef(false);
  const registeredSocketIdRef = useRef<string | null>(null);
  const connectHandlerRef = useRef<(() => void) | null>(null);
  const disconnectHandlerRef = useRef<((reason: string) => void) | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Handler for ride:request_created event (GLOBAL - works on any screen)
  const handleRideRequest = useCallback(
    (data: {
      id: string;
      passengerName: string;
      pickupAddress: string;
      destinationAddress: string;
      estimatedFare: number;
      distance: number;
      expiresAt: string;
    }) => {
      console.log('[GLOBAL_SOCKET] ========================================');
      console.log('[GLOBAL_SOCKET] 🚗 RIDE REQUEST RECEIVED (GLOBAL)!');
      console.log('[GLOBAL_SOCKET]    Ride ID:', data.id);
      console.log('[GLOBAL_SOCKET]    Passenger:', data.passengerName);
      console.log('[GLOBAL_SOCKET]    Pickup:', data.pickupAddress);
      console.log('[GLOBAL_SOCKET]    Destination:', data.destinationAddress);
      console.log('[GLOBAL_SOCKET]    Fare:', data.estimatedFare);
      console.log('[GLOBAL_SOCKET]    Distance:', data.distance);
      console.log('[GLOBAL_SOCKET]    User Role:', user?.role);
      console.log('[GLOBAL_SOCKET] ========================================');

      // Only show to drivers
      if (user?.role !== 'driver') {
        console.log('[GLOBAL_SOCKET] ⚠️ User is not a driver, ignoring ride request');
        return;
      }

      // Play notification sound
      playNotificationSound();

      // Show ride request modal via notification manager (deduplication handled by context)
      // Backend socket only sends a subset of RideRequestData fields;
      // supply defaults for fields not included in the event payload
      const avgSpeedKmh = 25;
      const calcDuration = Math.round((data.distance / avgSpeedKmh) * 60);
      showRideRequest({
        ...data,
        passengerRating: 0,
        estimatedDuration: calcDuration,
        vehicleType: 'taxi',
      });
    },
    [user?.role, playNotificationSound, showRideRequest]
  );

  // Handler for ride:payment_completed event (BOTH roles — different messages)
  const handlePaymentCompleted = useCallback(
    (data: {
      rideId: string;
      paymentId: string;
      amount: number;
      driverEarnings: number;
      platformCommission: number;
      currency?: string;
    }) => {
      console.log('[GLOBAL_SOCKET] 💰 Payment completed event received:', data);
      // ✅ No playNotificationSound aquí — active-ride.tsx ya lo reproduce
      // para evitar duplicado cuando el conductor está en la pantalla del viaje

      if (user?.role === 'driver') {
        const earnings = data.driverEarnings;
        const dualMsg = data.currency === 'USD'
          ? `${convertToBs(earnings) !== '—' ? ` (≈ Bs. ${convertToBs(earnings)})` : ''}`
          : `${convertToUsd(earnings) !== '—' ? ` (≈ $ ${convertToUsd(earnings)})` : ''}`;
        const currencySymbol = data.currency === 'USD' ? '$' : 'Bs.';
        showStatus(
          'payment_completed',
          `Has recibido ${currencySymbol} ${earnings.toFixed(2)}${dualMsg} por el viaje`,
          '¡Pago Recibido!',
          { rideId: data.rideId, amount: data.amount, currency: data.currency }
        );
      }
      // Passenger: payment confirmation is shown inline in the payment modal
      // (with dual amounts) — no duplicate notification needed here.
    },
    [user?.role, playNotificationSound, showStatus, convertToUsd, convertToBs]
  );

  // Handler for ride:cancelled event
  const handleRideCancelled = useCallback(
    (data: {
      rideId: string;
      status: 'cancelled';
      cancelledBy: 'passenger' | 'driver' | 'system';
      cancellationReason: string;
      cancellationFee: number;
      cancelledAt: string;
      timestamp: string;
      driverId?: string;
      passengerId?: string;
    }) => {
      console.log('[GLOBAL_SOCKET] ❌ Ride cancelled event received:', data);

      // Check if this event is relevant for the current user
      if (!user) {
        console.log('[GLOBAL_SOCKET] No user logged in, ignoring cancellation event');
        return;
      }

      const isRelevantForUser =
        (user.role === 'driver' && data.driverId === user.id) ||
        (user.role === 'passenger' && data.passengerId === user.id);

      if (!isRelevantForUser) {
        console.log('[GLOBAL_SOCKET] Cancellation event not relevant for current user');
        return;
      }

      // Determine message based on who cancelled
      let message = '';
      if (data.cancelledBy === 'passenger') {
        message = 'El pasajero ha cancelado el viaje';
      } else if (data.cancelledBy === 'driver') {
        message = 'El conductor ha cancelado el viaje';
      } else {
        message = 'El viaje ha sido cancelado por el sistema';
      }

      if (data.cancellationReason) {
        message += `\n\nMotivo: ${data.cancellationReason}`;
      }

      if (data.cancellationFee > 0) {
        message += `\n\nCargo por cancelación: Bs. ${data.cancellationFee.toFixed(2)}`;
      }

      // Show status notification for cancellation
      showStatus('ride_cancelled', message, undefined, { rideId: data.rideId, cancelledBy: data.cancelledBy });
    },
    [user?.id, user?.role, showStatus]
  );

  // ── PASSENGER-SIDE HANDLERS ────────────────────────────────────────────────

  // Handler for ride:accepted event (PASSENGER — driver accepted the ride)
  // Note: the passenger's local screen shows a more detailed notification with vehicle info.
  // This global handler only plays sound to avoid duplicate notifications.
  const handleRideAccepted = useCallback(
    (data: {
      rideId: string;
      status: 'accepted';
      driver: any;
      acceptedAt: string;
      timestamp: string;
    }) => {
      console.log('[GLOBAL_SOCKET] ✅ Ride accepted event received (passenger):', data);
      if (user?.role !== 'passenger') return;
      // Notification is shown by the passenger's local screen handler (index.tsx)
      // to provide vehicle details and payment prompt — showing it here would duplicate.
    },
    [user?.role]
  );

  // Handler for ride:status_changed event (PASSENGER — status updates)
  const handleRideStatusChanged = useCallback(
    (data: {
      rideId: string;
      status: string;
      previousStatus?: string;
      arrivedAt?: string;
      startedAt?: string;
      completedAt?: string;
      finalFare?: number;
      timestamp: string;
    }) => {
      console.log('[GLOBAL_SOCKET] 🔄 Ride status changed event received:', data);
      if (user?.role !== 'passenger') return;
      // Sound handled by local screen handler to avoid duplicate

      switch (data.status) {
        case 'arrived':
          showStatus(
            'driver_arrived',
            'Tu conductor ha llegado al punto de recogida. Por favor, dirígete al vehículo.',
            '📍 ¡Tu Conductor Te Espera!',
            { rideId: data.rideId },
            undefined,
            10000
          );
          break;
        case 'in_progress':
          showStatus(
            'ride_started',
            'Tu viaje ha comenzado. ¡Buen viaje!',
            '🚗 Viaje Iniciado',
            { rideId: data.rideId },
            undefined,
            6000
          );
          break;
        case 'completed':
          showStatus(
            'ride_completed',
            data.finalFare
              ? `Tu viaje ha finalizado. Tarifa final: Bs. ${data.finalFare.toFixed(2)}`
              : 'Tu viaje ha finalizado.',
            '🏁 ¡Viaje Completado!',
            { rideId: data.rideId, finalFare: data.finalFare },
            undefined,
            8000
          );
          break;
      }
    },
    [user?.role, playNotificationSound, showStatus]
  );

  // Handler for ride:eta_update event (PASSENGER — ETA updates, informational)
  const handleEtaUpdate = useCallback(
    (data: {
      rideId: string;
      eta: { estimatedMinutes: number; distanceKm: number; averageSpeedKmh: number };
      driverLocation: { latitude: number; longitude: number };
      targetType: string;
    }) => {
      if (user?.role !== 'passenger') return;
      // ETA updates are frequent — use toast to not overwhelm
      const minutes = Math.round(data.eta.estimatedMinutes);
      if (minutes <= 1) {
        showSuccess(`¡Tu conductor está a ${minutes} minuto!`, 3000);
      }
      // We don't show every ETA update to avoid notification spam
    },
    [user?.role, showSuccess]
  );

  // Handler for ride:completed event (BOTH roles)
  const handleRideCompleted = useCallback(
    (data: {
      rideId: string;
      status: 'completed';
      completedAt: string;
      actualDistanceKm: number;
      actualDurationMinutes: number;
      finalFare: number;
      driverEarnings?: number;
      platformCommission?: number;
      currency?: string;
      timestamp: string;
    }) => {
      console.log('[GLOBAL_SOCKET] 🏁 Ride completed event received:', data);
      // ✅ No playNotificationSound aquí — active-ride.tsx ya lo reproduce
      // para evitar duplicado cuando el conductor está en la pantalla del viaje

      const curr = data.currency || 'VES';
      const currencySymbol = curr === 'USD' ? '$' : 'Bs.';
      const earnings = data.driverEarnings || 0;
      const fare = data.finalFare || 0;

      if (user?.role === 'driver') {
        const distanceMsg = data.actualDistanceKm ? `Distancia: ${data.actualDistanceKm.toFixed(1)} km. ` : '';
        const earningsMsg = earnings > 0
          ? `| Ganancia: ${currencySymbol} ${earnings.toFixed(2)}`
          : '';
        showStatus(
          'ride_completed',
          `${distanceMsg}Tarifa: ${currencySymbol} ${fare.toFixed(2)} ${earningsMsg}`,
          '🏁 Viaje Finalizado',
          { rideId: data.rideId, finalFare: fare, driverEarnings: earnings, currency: curr },
          undefined,
          7000
        );
      } else {
        showStatus(
          'ride_completed',
          `¡Viaje completado! Tarifa final: ${currencySymbol} ${fare.toFixed(2)}. Gracias por viajar con UrbanTaxi.`,
          '🏁 ¡Viaje Completado!',
          { rideId: data.rideId, finalFare: fare, currency: curr },
          undefined,
          8000
        );
      }
    },
    [user?.role, playNotificationSound, showStatus]
  );

  // Register global socket listeners
  useEffect(() => {
    console.log('[GLOBAL_SOCKET] ============================================');
    console.log('[GLOBAL_SOCKET] useEffect TRIGGERED');
    console.log('[GLOBAL_SOCKET]    isAuthenticated:', isAuthenticated);
    console.log('[GLOBAL_SOCKET]    user ID:', user?.id);
    console.log('[GLOBAL_SOCKET]    user role:', user?.role);
    console.log('[GLOBAL_SOCKET]    user name:', user?.name || 'N/A');
    console.log('[GLOBAL_SOCKET]    listenersRegisteredRef:', listenersRegisteredRef.current);
    console.log('[GLOBAL_SOCKET]    hook deps: isAuth, user.id, user.role, handlers');
    console.log('[GLOBAL_SOCKET]    Timestamp:', new Date().toISOString());
    console.log('[GLOBAL_SOCKET] ============================================');

    // Only register listeners if user is authenticated
    if (!isAuthenticated || !user) {
      console.log('[GLOBAL_SOCKET] ❌ User not authenticated, skipping listener registration');
      console.log('[GLOBAL_SOCKET]    isAuthenticated:', isAuthenticated);
      console.log('[GLOBAL_SOCKET]    user object:', user ? 'exists' : 'null');
      console.log('[GLOBAL_SOCKET]    Returns early — no cleanup function set');
      return;
    }

    console.log('[GLOBAL_SOCKET] ✅ User authenticated, proceeding with socket setup');

    // Helper function to register all listeners
    const registerListeners = (socket: any) => {
      if (!socket) {
        console.log('[GLOBAL_SOCKET] ❌ Socket not available for listener registration');
        console.log('[GLOBAL_SOCKET]    Socket parameter is null/undefined');
        return;
      }

      console.log('[GLOBAL_SOCKET] registerListeners called');
      console.log('[GLOBAL_SOCKET]    Socket ID:', socket.id);
      console.log('[GLOBAL_SOCKET]    Socket connected:', socket.connected);
      console.log('[GLOBAL_SOCKET]    Socket transport:', socket.io?.engine?.transport?.name || 'unknown');
      console.log('[GLOBAL_SOCKET]    listenersRegisteredRef:', listenersRegisteredRef.current);

      // Check if listeners are already registered for THIS socket
      if (listenersRegisteredRef.current && socket.id && registeredSocketIdRef.current === socket.id) {
        console.log('[GLOBAL_SOCKET] ⚠️ Listeners already registered on this socket, skipping');
        return;
      }

      console.log('[GLOBAL_SOCKET] ============================================');
      console.log('[GLOBAL_SOCKET] ✅ REGISTERING GLOBAL SOCKET LISTENERS');
      console.log('[GLOBAL_SOCKET]    User ID:', user.id);
      console.log('[GLOBAL_SOCKET]    User Role:', user.role);
      console.log('[GLOBAL_SOCKET]    Socket ID:', socket.id);
      console.log('[GLOBAL_SOCKET]    Socket Connected:', socket.connected);
      console.log('[GLOBAL_SOCKET]    Socket Transport:', socket.io?.engine?.transport?.name);
      console.log('[GLOBAL_SOCKET]    Socket Namespace:', socket.nsp);
      console.log('[GLOBAL_SOCKET]    Socket Handshake:', JSON.stringify(socket.auth ? { hasToken: !!socket.auth.token } : { hasToken: false }));
      console.log('[GLOBAL_SOCKET]    Timestamp:', new Date().toISOString());
      console.log('[GLOBAL_SOCKET] ============================================');

      // IMPORTANT: Remove existing listeners FIRST to prevent duplicates
      console.log('[GLOBAL_SOCKET] Removing existing listeners...');
      
      socket.off('ride:payment_completed', handlePaymentCompleted);
      socket.off('ride:cancelled', handleRideCancelled);
      socket.off('ride:request_created', handleRideRequest);
      socket.off('ride:accepted', handleRideAccepted);
      socket.off('ride:status_changed', handleRideStatusChanged);
      socket.off('ride:eta_update', handleEtaUpdate);
      socket.off('ride:completed', handleRideCompleted);
      if (connectHandlerRef.current) {
        socket.off('connect', connectHandlerRef.current);
        console.log('[GLOBAL_SOCKET]    Removed previous connect handler');
      }
      socket.offAny(); // Remove debug listener
      console.log('[GLOBAL_SOCKET]    Existing listeners cleared');

      // ── Register listeners (shared + role-specific) ─────────────────────

      // SHARED — both roles receive these
      socket.on('ride:payment_completed', handlePaymentCompleted);
      console.log('[GLOBAL_SOCKET]    ✓ ride:payment_completed registered (shared)');

      socket.on('ride:cancelled', handleRideCancelled);
      console.log('[GLOBAL_SOCKET]    ✓ ride:cancelled registered (shared)');

      socket.on('ride:completed', handleRideCompleted);
      console.log('[GLOBAL_SOCKET]    ✓ ride:completed registered (shared)');

      // DRIVER-ONLY — ride request notification
      if (user.role === 'driver') {
        socket.on('ride:request_created', handleRideRequest);
        console.log('[GLOBAL_SOCKET]    ✓ ride:request_created registered (driver only)');
      }

      // PASSENGER-ONLY — driver acceptance, status changes, ETA
      if (user.role === 'passenger') {
        socket.on('ride:accepted', handleRideAccepted);
        console.log('[GLOBAL_SOCKET]    ✓ ride:accepted registered (passenger only)');

        socket.on('ride:status_changed', handleRideStatusChanged);
        console.log('[GLOBAL_SOCKET]    ✓ ride:status_changed registered (passenger only)');

        socket.on('ride:eta_update', handleEtaUpdate);
        console.log('[GLOBAL_SOCKET]    ✓ ride:eta_update registered (passenger only)');
      }

      // DEBUG: Listen to ALL events to see what's coming
      const debugAllEvents = (eventName: string, ...args: any[]) => {
        console.log('[GLOBAL_SOCKET] 📨 DEBUG: Event received:', eventName, '| role:', user.role);
      };

      socket.onAny(debugAllEvents);
      console.log('[GLOBAL_SOCKET]    ✓ onAny debug listener registered');

      // Verify listeners were registered
      const afterCount = socket.listeners('ride:payment_completed').length;
      console.log('[GLOBAL_SOCKET] 📊 After registration, listeners for ride:payment_completed:', afterCount);
      if (afterCount === 0) {
        console.error('[GLOBAL_SOCKET] ❌ CRITICAL: Listener registration FAILED (count=0)');
      } else {
        console.log('[GLOBAL_SOCKET]    ✓ Listener count OK');
      }

      // Mark listeners as registered on this socket
      listenersRegisteredRef.current = true;
      registeredSocketIdRef.current = socket.id || null;
      console.log('[GLOBAL_SOCKET]    listenersRegisteredRef set to TRUE for socket:', socket.id);

      // Handle socket reconnection - re-register listeners with fresh callbacks
      connectHandlerRef.current = () => {
        console.log('[GLOBAL_SOCKET] ============================================');
        console.log('[GLOBAL_SOCKET] 🔄 Socket reconnected');
        console.log('[GLOBAL_SOCKET]    Socket ID:', socket.id);
        console.log('[GLOBAL_SOCKET]    Socket transport:', socket.io?.engine?.transport?.name);
        console.log('[GLOBAL_SOCKET]    Re-registering listeners...');
        console.log('[GLOBAL_SOCKET] ============================================');
        
        // Reset flag and re-register on reconnection
        listenersRegisteredRef.current = false;
        registeredSocketIdRef.current = null;
        console.log('[GLOBAL_SOCKET]    listenersRegisteredRef reset for reconnection');
        registerListeners(socket);
      };

      socket.on('connect', connectHandlerRef.current);
      console.log('[GLOBAL_SOCKET]    ✓ connect handler registered for reconnection');

      console.log('[GLOBAL_SOCKET] ============================================');
      console.log('[GLOBAL_SOCKET] ✅ LISTENERS REGISTERED SUCCESSFULLY');
      console.log('[GLOBAL_SOCKET]    - ride:payment_completed (shared)');
      console.log('[GLOBAL_SOCKET]    - ride:cancelled (shared)');
      console.log('[GLOBAL_SOCKET]    - ride:completed (shared)');
      if (user.role === 'driver') {
        console.log('[GLOBAL_SOCKET]    - ride:request_created (driver only)');
      }
      if (user.role === 'passenger') {
        console.log('[GLOBAL_SOCKET]    - ride:accepted (passenger only)');
        console.log('[GLOBAL_SOCKET]    - ride:status_changed (passenger only)');
        console.log('[GLOBAL_SOCKET]    - ride:eta_update (passenger only)');
      }
      console.log('[GLOBAL_SOCKET]    - connect (reconnection handler)');
      console.log('[GLOBAL_SOCKET]    - onAny (debug all events)');
      console.log('[GLOBAL_SOCKET] ============================================');
    };

    // Initialize socket connection if not already connected
    let socket = getSocket();
    console.log('[GLOBAL_SOCKET] getSocket() returned:', !!socket, 'connected:', socket?.connected);
    
    if (!socket) {
      console.log('[GLOBAL_SOCKET] 🔌 Socket not initialized, connecting...');
      console.log('[GLOBAL_SOCKET]    Calling connectSocket()...');
      
      // Connect socket asynchronously
      connectSocket()
        .then(connectedSocket => {
          console.log('[GLOBAL_SOCKET] ✅ Socket connected successfully via connectSocket()');
          console.log('[GLOBAL_SOCKET]    Socket ID:', connectedSocket.id);
          console.log('[GLOBAL_SOCKET]    Socket connected:', connectedSocket.connected);
          console.log('[GLOBAL_SOCKET]    Socket transport:', connectedSocket.io?.engine?.transport?.name);
          
          // Register listeners after connection
          console.log('[GLOBAL_SOCKET]    Calling registerListeners...');
          registerListeners(connectedSocket);
          
          // Add auto-reconnect on disconnect
          console.log('[GLOBAL_SOCKET]    Calling setupDisconnectHandler...');
          setupDisconnectHandler(connectedSocket);
        })
        .catch(error => {
          console.error('[GLOBAL_SOCKET] ❌ Failed to connect socket:', error.message);
          console.error('[GLOBAL_SOCKET]    Error name:', error.name);
          console.error('[GLOBAL_SOCKET]    Error stack:', error.stack);
          
          // Schedule a retry after 10 seconds
          const retryDelay = 10000;
          console.log('[GLOBAL_SOCKET] 🔄 Scheduling retry in ' + (retryDelay/1000) + 's...');
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log('[GLOBAL_SOCKET] 🔄 Retrying socket connection...');
            console.log('[GLOBAL_SOCKET]    Time:', new Date().toISOString());
            const s = getSocket();
            console.log('[GLOBAL_SOCKET]    Current socket state — exists:', !!s, 'connected:', s?.connected);
            if (!s || !s.connected) {
              console.log('[GLOBAL_SOCKET]    Calling connectSocket() (retry)...');
              connectSocket()
                .then(connectedSocket => {
                  console.log('[GLOBAL_SOCKET] ✅ Retry successful!');
                  registerListeners(connectedSocket);
                  setupDisconnectHandler(connectedSocket);
                })
                .catch(err => {
                  console.error('[GLOBAL_SOCKET] ❌ Retry also failed:', err.message);
                });
            } else {
              console.log('[GLOBAL_SOCKET]    Socket already connected, no retry needed');
            }
          }, retryDelay);
        });
      
      // Return early - listeners will be registered after connection
      console.log('[GLOBAL_SOCKET]    Returning early — cleanup will run on unmount');
      return cleanup;
    }
    
    // Socket already exists, register listeners immediately
    console.log('[GLOBAL_SOCKET] Socket already exists, registering listeners immediately');
    console.log('[GLOBAL_SOCKET]    Socket ID:', socket.id);
    console.log('[GLOBAL_SOCKET]    Socket connected:', socket.connected);
    registerListeners(socket);
    setupDisconnectHandler(socket);

    console.log('[GLOBAL_SOCKET]    Full setup complete, returning cleanup func');

    // Cleanup function
    return cleanup;
    
    // Helper: Set up handler for socket disconnect events
    function setupDisconnectHandler(sock: any) {
      console.log('[GLOBAL_SOCKET] setupDisconnectHandler called');
      console.log('[GLOBAL_SOCKET]    Socket ID:', sock?.id);
      
      if (disconnectHandlerRef.current) {
        console.log('[GLOBAL_SOCKET]    Removing previous disconnect handler');
        sock.off('disconnect', disconnectHandlerRef.current);
      }
      
      disconnectHandlerRef.current = (reason: string) => {
        console.log('[GLOBAL_SOCKET] ============================================');
        console.log('[GLOBAL_SOCKET] 🔌 Socket disconnected event');
        console.log('[GLOBAL_SOCKET]    Reason:', reason);
        console.log('[GLOBAL_SOCKET]    Time:', new Date().toISOString());
        console.log('[GLOBAL_SOCKET]    Transport was:', sock?.io?.engine?.transport?.name || 'unknown');
        console.log('[GLOBAL_SOCKET]    Socket ID was:', sock?.id || 'unknown');
        
        // If the socket was intentionally disconnected by us, don't reconnect
        if (reason === 'io client disconnect') {
          console.log('[GLOBAL_SOCKET]    Intentional disconnect from client, not auto-reconnecting');
          return;
        }
        
        console.log('[GLOBAL_SOCKET]    This is an unexpected disconnect, scheduling auto-reconnect...');
        
        // Schedule reconnection after a delay
        if (reconnectTimeoutRef.current) {
          console.log('[GLOBAL_SOCKET]    Clearing previous reconnect timer');
          clearTimeout(reconnectTimeoutRef.current);
        }
        
        const reconnectDelay = 5000;
        console.log('[GLOBAL_SOCKET]    Scheduling reconnect in ' + (reconnectDelay/1000) + 's...');
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('[GLOBAL_SOCKET] 🔄 Attempting auto-reconnect after disconnect...');
          console.log('[GLOBAL_SOCKET]    Time:', new Date().toISOString());
          const currentSocket = getSocket();
          console.log('[GLOBAL_SOCKET]    Current socket — exists:', !!currentSocket, 'connected:', currentSocket?.connected);
          if (!currentSocket || !currentSocket.connected) {
            console.log('[GLOBAL_SOCKET]    Calling connectSocket() (auto-reconnect)...');
            connectSocket()
              .then(connectedSocket => {
                console.log('[GLOBAL_SOCKET] ✅ Auto-reconnect successful!');
                console.log('[GLOBAL_SOCKET]    New Socket ID:', connectedSocket.id);
                registerListeners(connectedSocket);
                setupDisconnectHandler(connectedSocket);
              })
              .catch(error => {
                console.error('[GLOBAL_SOCKET] ❌ Auto-reconnect failed:', error.message);
              });
          } else {
            console.log('[GLOBAL_SOCKET]    Socket already reconnected, skipping');
          }
        }, reconnectDelay);
      };
      
      console.log('[GLOBAL_SOCKET]    Setting disconnect handler on socket...');
      sock.on('disconnect', disconnectHandlerRef.current);
      console.log('[GLOBAL_SOCKET] ✅ setupDisconnectHandler complete');
    }
    
    // Cleanup helper
    function cleanup() {
      console.log('[GLOBAL_SOCKET] ============================================');
      console.log('[GLOBAL_SOCKET] 🧹 CLEANING UP GLOBAL SOCKET LISTENERS');
      console.log('[GLOBAL_SOCKET]    User ID:', user?.id);
      console.log('[GLOBAL_SOCKET]    User role:', user?.role);
      console.log('[GLOBAL_SOCKET]    listenersRegisteredRef:', listenersRegisteredRef.current);
      console.log('[GLOBAL_SOCKET]    Timestamp:', new Date().toISOString());
      console.log('[GLOBAL_SOCKET] ============================================');

      if (reconnectTimeoutRef.current) {
        console.log('[GLOBAL_SOCKET]    Cleaning up reconnect timeout');
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      const currentSocket = getSocket();
      if (currentSocket) {
        console.log('[GLOBAL_SOCKET]    Socket available, removing listeners...');
        const beforeCount = currentSocket.listeners('ride:payment_completed').length;
        console.log('[GLOBAL_SOCKET]    Listeners before cleanup:', beforeCount);
        
        currentSocket.off('ride:payment_completed', handlePaymentCompleted);
        currentSocket.off('ride:cancelled', handleRideCancelled);
        currentSocket.off('ride:request_created', handleRideRequest);
        currentSocket.off('ride:accepted', handleRideAccepted);
        currentSocket.off('ride:status_changed', handleRideStatusChanged);
        currentSocket.off('ride:eta_update', handleEtaUpdate);
        currentSocket.off('ride:completed', handleRideCompleted);
        if (connectHandlerRef.current) {
          currentSocket.off('connect', connectHandlerRef.current);
        }
        if (disconnectHandlerRef.current) {
          currentSocket.off('disconnect', disconnectHandlerRef.current);
        }
        currentSocket.offAny();
        
        const afterCount = currentSocket.listeners('ride:payment_completed').length;
        console.log('[GLOBAL_SOCKET]    Listeners after cleanup:', afterCount);
        
        if (afterCount === 0) {
          console.log('[GLOBAL_SOCKET] ✅ All listeners removed successfully');
        } else {
          console.warn('[GLOBAL_SOCKET] ⚠️ Some listeners may not have been removed:', afterCount);
        }
      } else {
        console.log('[GLOBAL_SOCKET] ⚠️ Socket not available for cleanup');
      }
      
      // Reset flag on cleanup
      listenersRegisteredRef.current = false;
      registeredSocketIdRef.current = null;
      console.log('[GLOBAL_SOCKET]    listenersRegisteredRef reset to FALSE');
      console.log('[GLOBAL_SOCKET] ========== CLEANUP COMPLETE ==========');
    }
  }, [isAuthenticated, user?.id, user?.role, handlePaymentCompleted, handleRideCancelled, handleRideRequest]);

  // No return value needed - this hook only manages side effects
};
