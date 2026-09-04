/**
 * useGlobalSocketListeners Hook
 * Registers global socket.io listeners that remain active across all screens
 * Fixes bug where payment and cancellation notifications were only received on home screen
 */

import { useEffect, useCallback, useRef } from 'react';
import { getSocket, connectSocket, addConnectionListener, removeConnectionListener } from '@/services/socket';
import { rideAPI } from '@/services/api';
import { useSound } from './useSound';
import { useUnifiedNotifications } from '@/context/UnifiedNotificationContext';
import { useExchangeRate } from './useExchangeRate';
import type { User } from '@/store/authStore';
import { useDriverStore } from '@/store/driverStore';

interface UseGlobalSocketListenersProps {
  user: User | null;
  isAuthenticated: boolean;
}

export const useGlobalSocketListeners = ({
  user,
  isAuthenticated,
}: UseGlobalSocketListenersProps) => {
  const { playNotificationSound } = useSound();
  const { showRideRequest, dismissRideRequest, activeRideRequest, showStatus, showSuccess, showError, showWarning } = useUnifiedNotifications();
  const { convertToUsd, convertToBs } = useExchangeRate();
  
  // Ref to track if listeners are already registered
  const listenersRegisteredRef = useRef(false);
  const registeredSocketIdRef = useRef<string | null>(null);
  const connectHandlerRef = useRef<(() => void) | null>(null);
  const disconnectHandlerRef = useRef<((reason: string) => void) | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const registerListenersRef = useRef<((s: any) => void) | null>(null);
  const setupDisconnectHandlerRef = useRef<((s: any) => void) | null>(null);
  const fetchingPendingRef = useRef(false);
  const processedCompletedRidesRef = useRef<Set<string>>(new Set());
  const processedPaymentRidesRef = useRef<Set<string>>(new Set());
  const processedRideRequestIdsRef = useRef<Set<string>>(new Set());
  const processedCancelledRideIdsRef = useRef<Set<string>>(new Set());
  const debugOnAnyRef = useRef<((...args: any[]) => void) | null>(null);

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
      console.log('[GLOBAL_SOCKET] RIDE REQUEST RECEIVED (GLOBAL)!');
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
        console.log('[GLOBAL_SOCKET] User is not a driver, ignoring ride request');
        return;
      }

      // Dedup: skip if this ride ID was already processed (e.g., after socket reconnect)
      if (processedRideRequestIdsRef.current.has(data.id)) {
        console.log('[GLOBAL_SOCKET] Ride request already processed for', data.id, '— skipping');
        return;
      }
      processedRideRequestIdsRef.current.add(data.id);
      // Keep set bounded
      if (processedRideRequestIdsRef.current.size > 50) {
        const entries = Array.from(processedRideRequestIdsRef.current);
        processedRideRequestIdsRef.current = new Set(entries.slice(-40));
      }

      // Play notification sound
      playNotificationSound();

      // Show ride request modal via notification manager (deduplication handled by context)
      const safeDistance = Number(data.distance) || 0;
      const backendDuration = Number((data as any).estimatedDuration) || 0;
      const calcDuration = backendDuration > 0
        ? backendDuration
        : safeDistance > 0
          ? Math.round((safeDistance / 25) * 60)
          : 0;
      showRideRequest({
        ...data,
        passengerRating: (data as any).passengerRating || 0,
        estimatedDuration: calcDuration,
        vehicleType: (data as any).vehicleType || 'taxi',
      });
    },
    [user?.role, playNotificationSound, showRideRequest]
  );

  // Handler for ride:request_accepted event — another driver accepted the ride,
  // so dismiss the request card/modal if it matches this ride.
  const handleRideRequestAccepted = useCallback(
    (data: { rideId: string }) => {
      if (activeRideRequest?.id === data.rideId) {
        console.log('[GLOBAL_SOCKET] Ride request taken by another driver, dismissing:', data.rideId);
        dismissRideRequest();
      }
    },
    [activeRideRequest?.id, dismissRideRequest]
  );

  // Handler for ride:payment_completed event (BOTH roles - different messages)
  const handlePaymentCompleted = useCallback(
    (data: {
      rideId: string;
      paymentId: string;
      amount: number;
      driverEarnings: number;
      platformCommission: number;
      currency?: string;
    }) => {
      console.log('[GLOBAL_SOCKET] Payment completed event received:', data);
      // No playNotificationSound here - active-ride.tsx already plays it
      // to avoid duplicate when driver is on the ride screen

      if (user?.role === 'driver') {
        const earnings = data.driverEarnings;
        const amount = data.amount;

        // Credit wallet as fallback if ride:completed hasn't done it yet
        if (earnings > 0 && !processedPaymentRidesRef.current.has(data.rideId)) {
          processedPaymentRidesRef.current.add(data.rideId);
          // Keep set bounded
          if (processedPaymentRidesRef.current.size > 25) {
            const entries = Array.from(processedPaymentRidesRef.current);
            processedPaymentRidesRef.current = new Set(entries.slice(-20));
          }
          const driverStore = useDriverStore.getState();
          driverStore.addEarning(earnings, (data.currency || 'VES') === 'USD' ? 'USD' : 'VES', data.rideId);
        }

        const dualMsg = data.currency === 'USD'
          ? `${convertToBs(earnings) !== '—' ? ` (≈ Bs. ${convertToBs(earnings)})` : ''}`
          : `${convertToUsd(earnings) !== '—' ? ` (≈ $ ${convertToUsd(earnings)})` : ''}`;
        const currencySymbol = data.currency === 'USD' ? '$' : 'Bs.';
        const amountMsg = amount && amount !== earnings
          ? `Pasajero pagó ${currencySymbol} ${amount.toFixed(2)}. `
          : '';
        showStatus(
          'payment_completed',
          `${amountMsg}Recibiste ${currencySymbol} ${earnings.toFixed(2)}${dualMsg} por el viaje`,
          '¡Pago Recibido!',
          { rideId: data.rideId, amount: data.amount, currency: data.currency }
        );
      }
      // Passenger: payment confirmation is shown inline in the payment modal
      // (with dual amounts) - no duplicate notification needed here.
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
      refundAmount?: number;
      currency?: string;
      driverCompensation?: number;
      hasPaymentMethods?: boolean;
      cancelledAt: string;
      timestamp: string;
      driverId?: string;
      passengerId?: string;
    }) => {
      console.log('[GLOBAL_SOCKET] Ride cancelled event received:', data);

      // Dedup: skip if already processed this cancellation (prevents duplicate from ride room + user room emit)
      if (processedCancelledRideIdsRef.current.has(data.rideId)) {
        console.log('[GLOBAL_SOCKET] Cancellation already processed for', data.rideId, '— skipping duplicate');
        return;
      }
      processedCancelledRideIdsRef.current.add(data.rideId);
      if (processedCancelledRideIdsRef.current.size > 25) {
        const entries = Array.from(processedCancelledRideIdsRef.current);
        processedCancelledRideIdsRef.current = new Set(entries.slice(-20));
      }
      setTimeout(() => {
        processedCancelledRideIdsRef.current.delete(data.rideId);
      }, 5000);

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

      // Determine message based on who cancelled and role
      let message = '';
      if (user?.role === 'driver' && data.cancelledBy === 'driver') {
        message = 'Has cancelado el viaje';
      } else if (data.cancelledBy === 'passenger') {
        message = 'El pasajero ha cancelado el viaje';
      } else if (data.cancelledBy === 'driver') {
        message = 'El conductor ha cancelado el viaje';
      } else {
        message = 'El viaje ha sido cancelado por el sistema';
      }

      if (data.cancellationReason && data.cancellationReason !== 'passenger_cancelled') {
        message += `\n\nMotivo: ${data.cancellationReason}`;
      }

      // Driver: show net compensation received (fee − commission) in dual currency
      if (user?.role === 'driver' && data.cancelledBy === 'passenger') {
        const compensation = data.driverCompensation ?? data.cancellationFee ?? 0;
        if (compensation > 0) {
          const currency = data.currency || 'VES';
          const symbol = currency === 'USD' ? '$' : 'Bs.';
          const dualText = currency === 'USD'
            ? `${convertToBs(compensation) !== '—' ? ` (≈ Bs. ${convertToBs(compensation)})` : ''}`
            : `${convertToUsd(compensation) !== '—' ? ` (≈ $ ${convertToUsd(compensation)})` : ''}`;
          message += `\n\nCompensación recibida: ${symbol} ${compensation.toFixed(2)}${dualText}`;
        }
      } else if (user?.role === 'passenger' && data.cancellationFee > 0) {
        const symbol = data.currency === 'USD' ? '$' : 'Bs.';
        message += `\n\nTarifa de cancelación: ${symbol} ${data.cancellationFee.toFixed(2)}`;
      }

      // Show status notification for both roles
      if (user?.role === 'driver') {
        showStatus('ride_cancelled', message, undefined, { rideId: data.rideId, cancelledBy: data.cancelledBy });
      } else if (user?.role === 'passenger') {
        if (data.cancelledBy === 'passenger') {
          const fee = data.cancellationFee || 0;
          if (fee > 0) {
            const refund = data.refundAmount || 0;
            const currencySymbol = data.currency === 'USD' ? '$' : 'Bs.';
            let refundMsg = `Se te reembolsará ${currencySymbol} ${refund.toFixed(2)} en un plazo de 24 horas.`;
            if (data.hasPaymentMethods === false) {
              refundMsg += `\n\nDebes configurar al menos un método de pago en tu perfil para recibir el reembolso.`;
            }
            showStatus('info', refundMsg, `Cancelación — Tarifa de ${currencySymbol} ${fee.toFixed(2)}`, undefined, undefined, 0);
          }
          // Fee === 0: no notification needed — state already cleared
        } else {
          const who = data.cancelledBy === 'driver' ? 'El conductor canceló el viaje' : 'El sistema canceló el viaje';
          showStatus('ride_cancelled', who, 'Viaje Cancelado', undefined, undefined, 5000);
          playNotificationSound();
        }
      }
    },
    [user?.id, user?.role, showStatus, playNotificationSound, convertToUsd, convertToBs]
  );

  // HANDLERS FOR PASSENGER

  // Handler for ride:accepted event (PASSENGER - driver accepted the ride)
  const handleRideAccepted = useCallback(
    (data: {
      rideId: string;
      status: 'accepted';
      driver: any;
      acceptedAt: string;
      timestamp: string;
    }) => {
      try {
        console.log('[GLOBAL_SOCKET] Ride accepted event received (passenger):', JSON.stringify(data));
        if (user?.role !== 'passenger') return;
        
        // Safe extraction with defensive checks
        const driverName = data?.driver?.name || 'Un conductor';
        console.log('[GLOBAL_SOCKET] Driver name extracted:', driverName);
        
        playNotificationSound();
        showStatus(
          'ride_accepted',
          `${driverName} ha aceptado tu viaje y se dirige al punto de recogida.`,
          '¡Viaje Aceptado!',
          undefined,
          undefined,
          5000
        );
      } catch (error) {
        console.error('[GLOBAL_SOCKET] Error in handleRideAccepted:', error);
        // Still show a generic notification even if there's an error
        try {
          playNotificationSound();
          showStatus(
            'ride_accepted',
            'Un conductor ha aceptado tu viaje y se dirige al punto de recogida.',
            '¡Viaje Aceptado!',
            undefined,
            undefined,
            5000
          );
        } catch (fallbackError) {
          console.error('[GLOBAL_SOCKET] Critical error in handleRideAccepted fallback:', fallbackError);
        }
      }
    },
    [user?.role, playNotificationSound, showStatus]
  );

  // Handler for ride:status_changed event (PASSENGER - status updates)
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
      try {
        console.log('[GLOBAL_SOCKET] Ride status changed event received:', JSON.stringify(data));
        if (user?.role !== 'passenger') return;
        // 'arrived' handled by dedicated ride:driver_arrived handler (screen-level)
        if (data.status === 'arrived') return;
        if (data.status === 'in_progress') {
          playNotificationSound();
          showStatus(
            'info',
            'Tu viaje ha iniciado. ¡Buen viaje hacia tu destino!',
            'Viaje en Curso',
            undefined,
            undefined,
            3000
          );
        }
      } catch (error) {
        console.error('[GLOBAL_SOCKET] Error in handleRideStatusChanged:', error);
      }
    },
    [user?.role, playNotificationSound, showStatus]
  );

  // Handler for ride:driver_arrived event (PASSENGER - explicit driver arrival)
  const handleDriverArrived = useCallback(
    (data: {
      rideId: string;
      status: 'arrived';
      driverName: string;
      arrivedAt: string;
      timestamp: string;
    }) => {
      console.log('[GLOBAL_SOCKET] Driver arrived event received:', data);
      if (user?.role !== 'passenger') return;
      // Notification handled by screen-level handleDriverArrived — only log here
    },
    [user?.role]
  );

  // Handler for ride:eta_update event (PASSENGER - ETA updates, informational)
  const handleEtaUpdate = useCallback(
    (data: {
      rideId: string;
      eta: { estimatedMinutes: number; distanceKm: number; averageSpeedKmh: number };
      driverLocation: { latitude: number; longitude: number };
      targetType: string;
    }) => {
      if (user?.role !== 'passenger') return;
      // ETA updates handled by local screen - no duplicate notification
    },
    [user?.role]
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
      console.log('[GLOBAL_SOCKET] Ride completed event received:', data);
      // No playNotificationSound here - active-ride.tsx already plays it
      // to avoid duplicate when driver is on the ride screen

      const curr = data.currency || 'VES';
      const currencySymbol = curr === 'USD' ? '$' : 'Bs.';
      const earnings = data.driverEarnings || 0;
      const fare = data.finalFare || 0;

      // Guard: skip if already processed this ride completion (prevents double wallet credit)
      if (processedCompletedRidesRef.current.has(data.rideId)) {
        console.log('[GLOBAL_SOCKET] Ride completion already processed for', data.rideId, '— skipping');
        return;
      }
      processedCompletedRidesRef.current.add(data.rideId);
      // Keep set bounded — trim to last 20 if it exceeds 25
      if (processedCompletedRidesRef.current.size > 25) {
        const entries = Array.from(processedCompletedRidesRef.current);
        processedCompletedRidesRef.current = new Set(entries.slice(-20));
      }

      if (user?.role === 'driver') {
        // Credit wallet with actual earnings from the completed ride
        if (earnings > 0) {
          const driverStore = useDriverStore.getState();
          driverStore.addEarning(earnings, curr === 'USD' ? 'USD' : 'VES', data.rideId);
        }

        const distanceMsg = data.actualDistanceKm ? `Distancia: ${data.actualDistanceKm.toFixed(1)} km. ` : '';
        const earningsMsg = earnings > 0
          ? `| Ganancia: ${currencySymbol} ${earnings.toFixed(2)}`
          : '';
        showStatus(
          'ride_completed',
          `${distanceMsg}Tarifa: ${currencySymbol} ${fare.toFixed(2)} ${earningsMsg}`,
          'Viaje Finalizado',
          { rideId: data.rideId, finalFare: fare, driverEarnings: earnings, currency: curr },
          undefined,
          7000
        );
      }
      // Passenger: ride completed handled by local screen with rating modal - no duplicate
    },
    [user?.role, playNotificationSound, showStatus]
  );

  // DRIVER: Request pending rides on connect/reconnect
  const fetchPendingRidesForDriver = useCallback(async () => {
    if (user?.role !== 'driver' || fetchingPendingRef.current) return;
    fetchingPendingRef.current = true;
    try {
      const res = await rideAPI.getPendingRides();
      const pending = res.data?.data || res.data?.rides || [];
      if (Array.isArray(pending) && pending.length > 0) {
        for (const ride of pending) {
          handleRideRequest(ride);
        }
      }
    } catch {
      // Silently ignore - the socket emit is the primary mechanism
    } finally {
      fetchingPendingRef.current = false;
    }
  }, [user?.role, handleRideRequest]);

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
      console.log('[GLOBAL_SOCKET] User not authenticated, skipping listener registration');
      console.log('[GLOBAL_SOCKET]    isAuthenticated:', isAuthenticated);
      console.log('[GLOBAL_SOCKET]    user object:', user ? 'exists' : 'null');
      console.log('[GLOBAL_SOCKET]    Returns early - no cleanup function set');
      return;
    }

    console.log('[GLOBAL_SOCKET] User authenticated, proceeding with socket setup');

    // Helper function to register all listeners
    const registerListeners = (socket: any) => {
      if (!socket) {
        console.log('[GLOBAL_SOCKET] Socket not available for listener registration');
        console.log('[GLOBAL_SOCKET]    Socket parameter is null/undefined');
        return;
      }

      console.log('[GLOBAL_SOCKET] registerListeners called');
      console.log('[GLOBAL_SOCKET]    Socket ID:', socket.id);
      console.log('[GLOBAL_SOCKET]    Socket connected:', socket.connected);
      console.log('[GLOBAL_SOCKET]    Socket transport:', socket.io?.engine?.transport?.name || 'unknown');
      console.log('[GLOBAL_SOCKET]    listenersRegisteredRef:', listenersRegisteredRef.current);

      console.log('[GLOBAL_SOCKET] ============================================');
      console.log('[GLOBAL_SOCKET] REGISTERING GLOBAL SOCKET LISTENERS');
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
      socket.off('ride:request_accepted', handleRideRequestAccepted);
      socket.off('ride:accepted', handleRideAccepted);
      socket.off('ride:status_changed', handleRideStatusChanged);
      socket.off('ride:eta_update', handleEtaUpdate);
      socket.off('ride:completed', handleRideCompleted);
      if (connectHandlerRef.current) {
        socket.off('connect', connectHandlerRef.current);
        console.log('[GLOBAL_SOCKET]    Removed previous connect handler');
      }
      // Remove only the debug onAny listener, not all onAny listeners from other sources
      if (debugOnAnyRef.current) {
        socket.offAny(debugOnAnyRef.current);
        debugOnAnyRef.current = null;
        console.log('[GLOBAL_SOCKET]    Removed previous debug onAny listener');
      }
      console.log('[GLOBAL_SOCKET]    Existing listeners cleared');

      // Register listeners (shared + role-specific)

      // SHARED - both roles receive these
      socket.on('ride:payment_completed', handlePaymentCompleted);
      console.log('[GLOBAL_SOCKET]    ride:payment_completed registered (shared)');

      socket.on('ride:cancelled', handleRideCancelled);
      console.log('[GLOBAL_SOCKET]    ride:cancelled registered (shared)');

      socket.on('ride:completed', handleRideCompleted);
      console.log('[GLOBAL_SOCKET]    ride:completed registered (shared)');

      // DRIVER-ONLY - ride request notification
      if (user.role === 'driver') {
        socket.on('ride:request_created', handleRideRequest);
        console.log('[GLOBAL_SOCKET]    ride:request_created registered (driver only)');

        socket.on('ride:request_accepted', handleRideRequestAccepted);
        console.log('[GLOBAL_SOCKET]    ride:request_accepted registered (driver only)');
      }

      // PASSENGER-ONLY - driver acceptance, status changes, ETA, driver arrived
      if (user.role === 'passenger') {
        socket.on('ride:accepted', handleRideAccepted);
        console.log('[GLOBAL_SOCKET]    ride:accepted registered (passenger only)');

        socket.on('ride:status_changed', handleRideStatusChanged);
        console.log('[GLOBAL_SOCKET]    ride:status_changed registered (passenger only)');

        socket.on('ride:eta_update', handleEtaUpdate);
        console.log('[GLOBAL_SOCKET]    ride:eta_update registered (passenger only)');

        socket.on('ride:driver_arrived', handleDriverArrived);
        console.log('[GLOBAL_SOCKET]    ride:driver_arrived registered (passenger only)');
      }

      // DEBUG: Listen to ALL events to see what's coming
      debugOnAnyRef.current = (eventName: string, ...args: any[]) => {
        console.log('[GLOBAL_SOCKET] DEBUG: Event received:', eventName, '| role:', user.role);
      };

      socket.onAny(debugOnAnyRef.current);
      console.log('[GLOBAL_SOCKET]    onAny debug listener registered');

      // Verify listeners were registered
      const afterCount = socket.listeners('ride:payment_completed').length;
      console.log('[GLOBAL_SOCKET] After registration, listeners for ride:payment_completed:', afterCount);
      if (afterCount === 0) {
        console.error('[GLOBAL_SOCKET] CRITICAL: Listener registration FAILED (count=0)');
      } else {
        console.log('[GLOBAL_SOCKET]    Listener count OK');
      }

      // Mark listeners as registered on this socket
      listenersRegisteredRef.current = true;
      registeredSocketIdRef.current = socket.id || null;
      console.log('[GLOBAL_SOCKET]    listenersRegisteredRef set to TRUE for socket:', socket.id);

      // Handle socket reconnection - re-register listeners with fresh callbacks
      connectHandlerRef.current = () => {
        console.log('[GLOBAL_SOCKET] ============================================');
        console.log('[GLOBAL_SOCKET] Socket reconnected');
        console.log('[GLOBAL_SOCKET]    Socket ID:', socket.id);
        console.log('[GLOBAL_SOCKET]    Socket transport:', socket.io?.engine?.transport?.name);
        console.log('[GLOBAL_SOCKET]    Re-registering listeners...');
        console.log('[GLOBAL_SOCKET] ============================================');
        
        // Reset flag and re-register on reconnection
        listenersRegisteredRef.current = false;
        registeredSocketIdRef.current = null;
        console.log('[GLOBAL_SOCKET]    listenersRegisteredRef reset for reconnection');
        registerListeners(socket);

        // Request pending rides for driver
        // Emit socket event so backend re-sends ride:request_created for active requests
        if (user?.role === 'driver') {
          socket.emit('driver:request_pending_rides');
          console.log('[GLOBAL_SOCKET] Emitted driver:request_pending_rides');

          // Also call REST API as fallback
          fetchPendingRidesForDriver();
        }
      };

      socket.on('connect', connectHandlerRef.current);
      console.log('[GLOBAL_SOCKET]    connect handler registered for reconnection');

      console.log('[GLOBAL_SOCKET] ============================================');
      console.log('[GLOBAL_SOCKET] LISTENERS REGISTERED SUCCESSFULLY');
      console.log('[GLOBAL_SOCKET]    - ride:payment_completed (shared)');
      console.log('[GLOBAL_SOCKET]    - ride:cancelled (shared)');
      console.log('[GLOBAL_SOCKET]    - ride:completed (shared)');
      if (user.role === 'driver') {
        console.log('[GLOBAL_SOCKET]    - ride:request_created (driver only)');
        console.log('[GLOBAL_SOCKET]    - ride:request_accepted (driver only)');
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

    // Store registerListeners in ref so the connection listener can call it
    registerListenersRef.current = registerListeners;
    setupDisconnectHandlerRef.current = setupDisconnectHandler;

    // Initialize socket connection if not already connected
    let socket = getSocket();
    console.log('[GLOBAL_SOCKET] getSocket() returned:', !!socket, 'connected:', socket?.connected);
    
    if (!socket) {
      console.log('[GLOBAL_SOCKET] Socket not initialized, connecting...');
      console.log('[GLOBAL_SOCKET]    Calling connectSocket()...');
      
      // Connect socket asynchronously
      connectSocket()
        .then(connectedSocket => {
          console.log('[GLOBAL_SOCKET] Socket connected successfully via connectSocket()');
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
          console.error('[GLOBAL_SOCKET] Failed to connect socket:', error.message);
          console.error('[GLOBAL_SOCKET]    Error name:', error.name);
          console.error('[GLOBAL_SOCKET]    Error stack:', error.stack);
          
          // Schedule a retry after 10 seconds
          const retryDelay = 10000;
          console.log('[GLOBAL_SOCKET] Scheduling retry in ' + (retryDelay/1000) + 's...');
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log('[GLOBAL_SOCKET] Retrying socket connection...');
            console.log('[GLOBAL_SOCKET]    Time:', new Date().toISOString());
            const s = getSocket();
            console.log('[GLOBAL_SOCKET]    Current socket state - exists:', !!s, 'connected:', s?.connected);
            if (!s || !s.connected) {
              console.log('[GLOBAL_SOCKET]    Calling connectSocket() (retry)...');
              connectSocket()
                .then(connectedSocket => {
                  console.log('[GLOBAL_SOCKET] Retry successful!');
                  registerListeners(connectedSocket);
                  setupDisconnectHandler(connectedSocket);
                })
                .catch(err => {
                  console.error('[GLOBAL_SOCKET] Retry also failed:', err.message);
                });
            } else {
              console.log('[GLOBAL_SOCKET]    Socket already connected, no retry needed');
            }
          }, retryDelay);
        });
      
      // Return early - listeners will be registered after connection
      console.log('[GLOBAL_SOCKET]    Returning early - cleanup will run on unmount');
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
        console.log('[GLOBAL_SOCKET] Socket disconnected event');
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
          console.log('[GLOBAL_SOCKET] Attempting auto-reconnect after disconnect...');
          console.log('[GLOBAL_SOCKET]    Time:', new Date().toISOString());
          const currentSocket = getSocket();
          console.log('[GLOBAL_SOCKET]    Current socket - exists:', !!currentSocket, 'connected:', currentSocket?.connected);
          if (!currentSocket || !currentSocket.connected) {
            console.log('[GLOBAL_SOCKET]    Calling connectSocket() (auto-reconnect)...');
            connectSocket()
              .then(connectedSocket => {
                if (connectedSocket?.connected) {
                  console.log('[GLOBAL_SOCKET] Auto-reconnect successful!');
                  console.log('[GLOBAL_SOCKET]    New Socket ID:', connectedSocket.id);
                  registerListeners(connectedSocket);
                  setupDisconnectHandler(connectedSocket);
                } else {
                  console.log('[GLOBAL_SOCKET] Socket created, waiting for connection...');
                  // Listeners will be registered on 'connect' event
                  connectedSocket?.once('connect', () => {
                    registerListeners(connectedSocket);
                    setupDisconnectHandler(connectedSocket);
                  });
                }
              })
              .catch(error => {
                console.error('[GLOBAL_SOCKET] Auto-reconnect failed:', error.message);
              });
          } else {
            console.log('[GLOBAL_SOCKET]    Socket already reconnected, skipping');
          }
        }, reconnectDelay);
      };
      
      console.log('[GLOBAL_SOCKET]    Setting disconnect handler on socket...');
      sock.on('disconnect', disconnectHandlerRef.current);
      console.log('[GLOBAL_SOCKET] setupDisconnectHandler complete');
    }
    
    // Cleanup helper
    function cleanup() {
      console.log('[GLOBAL_SOCKET] ============================================');
      console.log('[GLOBAL_SOCKET] CLEANING UP GLOBAL SOCKET LISTENERS');
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
        currentSocket.off('ride:request_accepted', handleRideRequestAccepted);
        currentSocket.off('ride:accepted', handleRideAccepted);
        currentSocket.off('ride:status_changed', handleRideStatusChanged);
        currentSocket.off('ride:eta_update', handleEtaUpdate);
        currentSocket.off('ride:driver_arrived', handleDriverArrived);
        currentSocket.off('ride:completed', handleRideCompleted);
        if (connectHandlerRef.current) {
          currentSocket.off('connect', connectHandlerRef.current);
        }
        if (disconnectHandlerRef.current) {
          currentSocket.off('disconnect', disconnectHandlerRef.current);
        }
        if (debugOnAnyRef.current) {
          currentSocket.offAny(debugOnAnyRef.current);
        }
        
        const afterCount = currentSocket.listeners('ride:payment_completed').length;
        console.log('[GLOBAL_SOCKET]    Listeners after cleanup:', afterCount);
        
        if (afterCount === 0) {
          console.log('[GLOBAL_SOCKET] All listeners removed successfully');
        } else {
          console.warn('[GLOBAL_SOCKET] Some listeners may not have been removed:', afterCount);
        }
      } else {
        console.log('[GLOBAL_SOCKET] Socket not available for cleanup');
      }
      
      // Reset flag on cleanup
      listenersRegisteredRef.current = false;
      registeredSocketIdRef.current = null;
      console.log('[GLOBAL_SOCKET]    listenersRegisteredRef reset to FALSE');
      console.log('[GLOBAL_SOCKET] ========== CLEANUP COMPLETE ==========');
    }
  }, [isAuthenticated, user?.id, user?.role, handlePaymentCompleted, handleRideCancelled, handleRideRequest, handleRideRequestAccepted, handleRideAccepted, handleRideStatusChanged, handleEtaUpdate, handleDriverArrived, handleRideCompleted, fetchPendingRidesForDriver]);

  // Re-register listeners when socket is fully recreated (e.g., after reconnectSocket destroy+create)
  useEffect(() => {
    const handleConnectionChange = (connected: boolean) => {
      if (!connected) return;
      const currentSocket = getSocket();
      if (!currentSocket) return;
      console.log('[GLOBAL_SOCKET] Connection listener: socket connected/recreated, re-registering listeners');
      if (registerListenersRef.current) {
        registerListenersRef.current(currentSocket);
      }
      if (setupDisconnectHandlerRef.current) {
        setupDisconnectHandlerRef.current(currentSocket);
      }
    };

    addConnectionListener(handleConnectionChange);

    return () => {
      removeConnectionListener(handleConnectionChange);
    };
  }, []);

  // No return value needed - this hook only manages side effects
};