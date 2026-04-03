/**
 * useGlobalSocketListeners Hook
 * Registers global socket.io listeners that remain active across all screens
 * Fixes bug where payment and cancellation notifications were only received on home screen
 */

import { useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'expo-router';
import { Alert } from 'react-native';
import { getSocket, connectSocket } from '@/services/socket';
import { useSound } from './useSound';
import type { User } from '@/store/authStore';

interface UseGlobalSocketListenersProps {
  user: User | null;
  isAuthenticated: boolean;
}

export const useGlobalSocketListeners = ({
  user,
  isAuthenticated,
}: UseGlobalSocketListenersProps) => {
  const router = useRouter();
  const { playNotificationSound } = useSound();
  
  // Ref to track if listeners are already registered
  const listenersRegisteredRef = useRef(false);
  
  // Ref to store active ride request alert (to prevent duplicates)
  const activeRideRequestRef = useRef<string | null>(null);

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

      // Prevent duplicate alerts for the same ride
      if (activeRideRequestRef.current === data.id) {
        console.log('[GLOBAL_SOCKET] ⚠️ Alert already showing for this ride, skipping duplicate');
        return;
      }

      // Mark this ride as having an active alert
      activeRideRequestRef.current = data.id;

      // Play notification sound
      playNotificationSound();

      // Show native Alert with ride details
      Alert.alert(
        '🚗 Nueva Solicitud de Viaje',
        `Pasajero: ${data.passengerName}\n\nRecogida: ${data.pickupAddress}\n\nDestino: ${data.destinationAddress}\n\nTarifa: Bs. ${data.estimatedFare.toFixed(2)}\nDistancia: ${data.distance.toFixed(1)} km`,
        [
          {
            text: 'Rechazar',
            style: 'cancel',
            onPress: () => {
              activeRideRequestRef.current = null;
              console.log('[GLOBAL_SOCKET] Ride request rejected by driver');
            },
          },
          {
            text: 'Ver Detalles',
            onPress: () => {
              activeRideRequestRef.current = null;
              // Navigate to driver home screen where they can accept
              router.push('/(driver)');
            },
          },
        ],
        {
          cancelable: false,
          onDismiss: () => {
            activeRideRequestRef.current = null;
          },
        }
      );

      // Auto-clear the active request after 30 seconds (when it expires)
      setTimeout(() => {
        if (activeRideRequestRef.current === data.id) {
          activeRideRequestRef.current = null;
          console.log('[GLOBAL_SOCKET] ⏰ Ride request expired, cleared active alert');
        }
      }, 30000);
    },
    [user?.role, playNotificationSound, router]
  );

  // Handler for ride:payment_completed event
  const handlePaymentCompleted = useCallback(
    (data: {
      rideId: string;
      paymentId: string;
      amount: number;
      driverEarnings: number;
      platformCommission: number;
    }) => {
      console.log('[GLOBAL_SOCKET] 💰 Payment completed event received:', data);

      // Play notification sound
      playNotificationSound();

      // Use native Alert for critical payment notification
      // This ensures the driver ALWAYS sees it, regardless of screen
      Alert.alert(
        '¡Pago Recibido!',
        `El pasajero completó el pago.\n\nTus ganancias: Bs. ${data.driverEarnings.toFixed(2)}\nComisión plataforma: Bs. ${data.platformCommission.toFixed(2)}\nTotal pagado: Bs. ${data.amount.toFixed(2)}`,
        [
          {
            text: 'Ver Ganancias',
            onPress: () => {
              router.push('/(driver)/earnings');
            },
          },
          {
            text: 'OK',
            style: 'default',
          },
        ],
        { cancelable: false }
      );
    },
    [playNotificationSound, router]
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

      // Use native Alert for cancellation notification
      Alert.alert('Viaje Cancelado', message, [{ text: 'OK' }]);
    },
    [user]
  );

  // Register global socket listeners
  useEffect(() => {
    console.log('[GLOBAL_SOCKET] ========================================');
    console.log('[GLOBAL_SOCKET] useEffect TRIGGERED');
    console.log('[GLOBAL_SOCKET]    isAuthenticated:', isAuthenticated);
    console.log('[GLOBAL_SOCKET]    user:', user?.id, user?.role);
    console.log('[GLOBAL_SOCKET] ========================================');

    // Only register listeners if user is authenticated
    if (!isAuthenticated || !user) {
      console.log('[GLOBAL_SOCKET] ❌ User not authenticated, skipping listener registration');
      console.log('[GLOBAL_SOCKET]    isAuthenticated:', isAuthenticated);
      console.log('[GLOBAL_SOCKET]    user:', user);
      return;
    }

    // Helper function to register all listeners
    const registerListeners = (socket: any) => {
      if (!socket) {
        console.log('[GLOBAL_SOCKET] ❌ Socket not available for listener registration');
        return;
      }

      // Check if listeners are already registered for this socket
      if (listenersRegisteredRef.current && socket.id) {
        console.log('[GLOBAL_SOCKET] ⚠️ Listeners already registered, skipping duplicate registration');
        return;
      }

      console.log('[GLOBAL_SOCKET] ========================================');
      console.log('[GLOBAL_SOCKET] ✅ REGISTERING GLOBAL SOCKET LISTENERS');
      console.log('[GLOBAL_SOCKET]    User ID:', user.id);
      console.log('[GLOBAL_SOCKET]    User Role:', user.role);
      console.log('[GLOBAL_SOCKET]    Socket ID:', socket.id);
      console.log('[GLOBAL_SOCKET]    Socket Connected:', socket.connected);
      console.log('[GLOBAL_SOCKET]    Socket Transport:', socket.io?.engine?.transport?.name);
      console.log('[GLOBAL_SOCKET] ========================================');

      // IMPORTANT: Remove existing listeners FIRST to prevent duplicates
      socket.off('ride:payment_completed', handlePaymentCompleted);
      socket.off('ride:cancelled', handleRideCancelled);
      socket.off('ride:request_created', handleRideRequest);
      socket.off('connect');
      socket.offAny(); // Remove debug listener

      // Test: Check existing listeners
      const existingListeners = socket.listeners('ride:payment_completed');
      console.log('[GLOBAL_SOCKET] 📊 Existing listeners for ride:payment_completed:', existingListeners.length);

      // Register listeners
      socket.on('ride:payment_completed', handlePaymentCompleted);
      socket.on('ride:cancelled', handleRideCancelled);
      
      // Register ride request listener (ONLY for drivers)
      if (user.role === 'driver') {
        socket.on('ride:request_created', handleRideRequest);
        console.log('[GLOBAL_SOCKET] ✅ Registered ride:request_created listener for driver');
      }

      // DEBUG: Listen to ALL events to see what's coming
      const debugAllEvents = (eventName: string, ...args: any[]) => {
        console.log('[GLOBAL_SOCKET] 📨 DEBUG: Event received:', eventName);
        if (eventName === 'ride:payment_completed') {
          console.log('[GLOBAL_SOCKET] ========================================');
          console.log('[GLOBAL_SOCKET] 💰💰💰 PAYMENT EVENT IN DEBUG LISTENER!');
          console.log('[GLOBAL_SOCKET]    Data:', JSON.stringify(args, null, 2));
          console.log('[GLOBAL_SOCKET]    This means event IS arriving!');
          console.log('[GLOBAL_SOCKET]    But handlePaymentCompleted might not be called');
          console.log('[GLOBAL_SOCKET] ========================================');
        }
      };

      socket.onAny(debugAllEvents);

      // Verify listeners were registered
      const afterListeners = socket.listeners('ride:payment_completed');
      console.log('[GLOBAL_SOCKET] 📊 After registration, listeners for ride:payment_completed:', afterListeners.length);

      // Mark listeners as registered
      listenersRegisteredRef.current = true;

      // Handle socket reconnection - re-register listeners with fresh callbacks
      const handleConnect = () => {
        console.log('[GLOBAL_SOCKET] ========================================');
        console.log('[GLOBAL_SOCKET] 🔄 Socket reconnected');
        console.log('[GLOBAL_SOCKET]    Socket ID:', socket.id);
        console.log('[GLOBAL_SOCKET]    Re-registering listeners...');
        console.log('[GLOBAL_SOCKET] ========================================');
        
        // Reset flag and re-register on reconnection
        listenersRegisteredRef.current = false;
        registerListeners(socket);
      };

      socket.on('connect', handleConnect);

      console.log('[GLOBAL_SOCKET] ========================================');
      console.log('[GLOBAL_SOCKET] ✅ LISTENERS REGISTERED SUCCESSFULLY');
      console.log('[GLOBAL_SOCKET]    - ride:payment_completed');
      console.log('[GLOBAL_SOCKET]    - ride:cancelled');
      if (user.role === 'driver') {
        console.log('[GLOBAL_SOCKET]    - ride:request_created (driver only)');
      }
      console.log('[GLOBAL_SOCKET]    - connect');
      console.log('[GLOBAL_SOCKET] ========================================');
    };

    // Initialize socket connection if not already connected
    let socket = getSocket();
    
    if (!socket) {
      console.log('[GLOBAL_SOCKET] 🔌 Socket not initialized, connecting...');
      
      // Connect socket asynchronously
      connectSocket()
        .then(connectedSocket => {
          console.log('[GLOBAL_SOCKET] ✅ Socket connected successfully');
          
          // Register listeners after connection
          registerListeners(connectedSocket);
        })
        .catch(error => {
          console.error('[GLOBAL_SOCKET] ❌ Failed to connect socket:', error);
        });
      
      // Return early - listeners will be registered after connection
      return;
    }
    
    // Socket already exists, register listeners immediately
    registerListeners(socket);

    // Cleanup function
    return () => {
      console.log('[GLOBAL_SOCKET] ========================================');
      console.log('[GLOBAL_SOCKET] 🧹 CLEANING UP GLOBAL SOCKET LISTENERS');
      console.log('[GLOBAL_SOCKET]    User ID:', user.id);
      console.log('[GLOBAL_SOCKET] ========================================');

      const currentSocket = getSocket();
      if (currentSocket) {
        currentSocket.off('ride:payment_completed', handlePaymentCompleted);
        currentSocket.off('ride:cancelled', handleRideCancelled);
        currentSocket.off('ride:request_created', handleRideRequest);
        currentSocket.off('connect');
        currentSocket.offAny();
        console.log('[GLOBAL_SOCKET] ✅ Listeners removed');
      } else {
        console.log('[GLOBAL_SOCKET] ⚠️ Socket not available for cleanup');
      }
      
      // Reset flag on cleanup
      listenersRegisteredRef.current = false;
      // Clear active ride request ref
      activeRideRequestRef.current = null;
    };
  }, [isAuthenticated, user?.id, user?.role, handlePaymentCompleted, handleRideCancelled, handleRideRequest]);

  // No return value needed - this hook only manages side effects
};
