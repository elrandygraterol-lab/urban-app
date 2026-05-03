import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
  Linking,
  Alert,
  Modal,
  TextInput,
  Image,
} from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Constants from 'expo-constants';
import api from '@/services/api';
import mapsService from '@/services/mapsService';
import { getSocket, onPaymentConfirmed } from '@/services/socket';
import { useSound } from '@/hooks/useSound';
import { Colors as colors } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { DriverTaxiIcon, PassengerIcon, DropoffIcon } from '@/src/components/map/markers';
import { bearingAlongRoute, animateNavigationCamera, computeNearestStepIndex, computeNearestRouteIndex, haversineDistance } from '@/src/utils/mapNav';
import { formatCurrency, Currency } from '@/utils/currency';
import { formatAddressForCard } from '@/utils/addressFormatter';
import { useDriverStore } from '@/store/driverStore';
import { useRideTracking } from '@/hooks/useRideTracking';
import { useTTS } from '@/hooks/useTTS';

interface Ride {
  id: string;
  status: 'accepted' | 'arrived' | 'in_progress' | 'completed';
  passengerName: string;
  passengerPhone: string;
  passengerProfilePicture?: string;
  pickupAddress: string;
  destinationAddress: string;
  pickupLocation: { latitude: number; longitude: number };
  destinationLocation: { latitude: number; longitude: number };
  estimatedFare: number;
  actualDistance?: number;
  actualDuration?: number;
  currency?: Currency;
}

interface RouteCoordinate {
  latitude: number;
  longitude: number;
}

interface Step {
  instruction: string;
  name: string;
  distance: number;   // km al siguiente punto de maniobra
  duration: number;   // minutos
  maneuver?: { type: string };
  location?: { latitude: number; longitude: number };
}

export default function ActiveRideScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const rideId = params.rideId as string;
  const { playNotificationSound } = useSound();
  const mapRef = useRef<MapView>(null);
  const locationSubscriptionRef = useRef<Location.LocationSubscription | null>(null);

  const [ride, setRide] = useState<Ride | null>(null);
  const [loading, setLoading] = useState(true);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<RouteCoordinate[]>([]);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [routeDistance, setRouteDistance] = useState<number | null>(null);
  const [routeDuration, setRouteDuration] = useState<number | null>(null);
  const [heading, setHeading] = useState<number>(0);
  const [routeBearing, setRouteBearing] = useState<number>(0);
  const lastRouteUpdateRef = useRef<number>(0); // Timestamp of last route update
  const ROUTE_UPDATE_INTERVAL = 30000; // Update route every 30 seconds (30000ms)

  // Payment state
  const [isPaymentConfirmed, setIsPaymentConfirmed] = useState(false);
  // Track passenger's current payment method (updated via WebSocket, Req. 3.4)
  const [passengerPaymentMode, setPassengerPaymentMode] = useState<'cash' | 'pago_movil' | 'dual'>('cash');

  // Rating modal states
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [passengerRating, setPassengerRating] = useState(0);
  const [passengerComment, setPassengerComment] = useState('');
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);
  const [finalFare, setFinalFare] = useState<number | null>(null);

  // Panel collapse state
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);

  const [isApproximateRoute, setIsApproximateRoute] = useState(false);

  const [routeSteps, setRouteSteps] = useState<Step[]>([]);
  const [nearestStepIndex, setNearestStepIndex] = useState<number>(0);
  const [nearestRouteIndex, setNearestRouteIndex] = useState<number>(0);
  const announcedStepIndexRef = useRef<number>(-1);

  const { addEarning } = useDriverStore();
  const tts = useTTS();

  // GPS tracking hook — sends location to backend every 10s during in_progress rides
  const { isTracking: isGpsTracking, permissionDenied: gpsPermissionDenied } = useRideTracking(
    rideId || null,
    ride?.status ?? ''
  );

  useEffect(() => {
    fetchRide();
    initializeLocation();
    const cleanup = setupSocketListeners();

    // Cleanup on unmount
    return () => {
      if (cleanup) cleanup();
      if (locationSubscriptionRef.current) {
        locationSubscriptionRef.current.remove();
      }
    };
  }, [rideId]);

  // Fetch and draw route when ride or location changes
  useEffect(() => {
    if (ride && location) {
      // Reset map interaction state when ride status changes
      setUserInteractedWithMap(false);
      setIsInitialMapSetup(true);
      fetchAndDrawRoute();
    }
  }, [ride?.status, location]);

  // Stop TTS when ride is completed or arrived
  useEffect(() => {
    if (ride?.status === 'arrived' || ride?.status === 'completed') {
      tts.stop();
    }
  }, [ride?.status]);

  // State to track if user has manually interacted with map
  const [userInteractedWithMap, setUserInteractedWithMap] = useState(false);
  const [isInitialMapSetup, setIsInitialMapSetup] = useState(true);

  // Auto-center map on driver location during navigation (only if user hasn't interacted)
  useEffect(() => {
    if (location && mapRef.current && ride && !userInteractedWithMap) {
      // Only auto-center when actively navigating (accepted or in_progress)
      if (ride.status === 'accepted' || ride.status === 'in_progress') {
        animateNavigationCamera(mapRef, location, routeBearing || heading, {
          duration: 500,
          zoom: 17,
          pitch: 50,
        });
      }
    }
  }, [location, ride?.status, heading, routeBearing, userInteractedWithMap]);

  useEffect(() => {
    if (!location || routeCoordinates.length < 2) {
      setRouteBearing(heading || 0);
      return;
    }
    const brng = bearingAlongRoute(routeCoordinates, location);
    setRouteBearing(brng);
  }, [location, routeCoordinates, heading]);

  // Update nearest step and route index when location changes
  useEffect(() => {
    if (!location) return;

    if (routeSteps.length > 0) {
      const stepIdx = computeNearestStepIndex(routeSteps, location);
      setNearestStepIndex(stepIdx);

      // TTS announcement: speak when within 200m of the maneuver point
      const step = routeSteps[stepIdx];
      if (step?.location) {
        const distToManeuver = haversineDistance(location, step.location);
        if (distToManeuver <= 200 && stepIdx !== announcedStepIndexRef.current) {
          // Last step: announce arrival
          const isLastStep = stepIdx === routeSteps.length - 1;
          tts.speak(isLastStep ? 'Has llegado a tu destino' : step.instruction);
          announcedStepIndexRef.current = stepIdx;
        }
      }
    }

    if (routeCoordinates.length >= 2) {
      const routeIdx = computeNearestRouteIndex(routeCoordinates, location);
      setNearestRouteIndex(routeIdx);
    }
  }, [location, routeSteps, routeCoordinates]);

  const fetchRide = async () => {
    try {
      const response = await api.get(`/api/rides/${rideId}`);
      // Backend returns { success: true, data: {...} }
      const rideData = response.data.data || response.data;
      setRide(rideData);
    } catch (error) {
      console.error('Failed to load ride details:', error);
      // Don't show technical error to user, just log it
    } finally {
      setLoading(false);
    }
  };

  const initializeLocation = async () => {
    try {
      // Get initial location
      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const coords = {
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
      };
      setLocation(coords);

      // Set initial heading if available
      if (currentLocation.coords.heading !== null && currentLocation.coords.heading !== undefined) {
        setHeading(currentLocation.coords.heading);
      }

      // Start watching location for real-time updates
      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 3000, // Update every 3 seconds for smoother tracking
          distanceInterval: 5, // Or every 5 meters
        },
        newLocation => {
          const newCoords = {
            latitude: newLocation.coords.latitude,
            longitude: newLocation.coords.longitude,
          };

          console.log('[ACTIVE_RIDE] 📍 Location updated:', newCoords);

          setLocation(newCoords);

          // Update heading if available
          if (newLocation.coords.heading !== null && newLocation.coords.heading !== undefined) {
            setHeading(newLocation.coords.heading);
          }

          // Only send location updates if ride is still active (not completed)
          // This prevents "Ride ID does not match active ride" errors after completion
          if (ride && ride.status !== 'completed') {
            // Send location update to server via socket
            const socket = getSocket();
            if (socket && socket.connected) {
              socket.emit('driver:location_update', {
                rideId: rideId,
                latitude: newCoords.latitude,
                longitude: newCoords.longitude,
                heading: newLocation.coords.heading,
              });
            }
          }

          // Check if we should update the route (every 30 seconds)
          const now = Date.now();
          if (now - lastRouteUpdateRef.current > ROUTE_UPDATE_INTERVAL) {
            console.log('[ACTIVE_RIDE] 🔄 Updating route from new location');
            lastRouteUpdateRef.current = now;
            // Trigger route recalculation
            if (ride && ride.status !== 'completed') {
              fetchAndDrawRoute();
            }
          }
        }
      );

      locationSubscriptionRef.current = subscription;
    } catch (error) {
      console.error('Failed to get location:', error);
    }
  };

  const fetchAndDrawRoute = async () => {
    if (!ride || !location) return;

    setLoadingRoute(true);

    try {
      // Determine origin and destination based on ride status
      let origin, destination;

      if (ride.status === 'accepted' || ride.status === 'arrived') {
        // Route from driver's current location to pickup
        origin = location;
        destination = ride.pickupLocation;
      } else if (ride.status === 'in_progress') {
        // Route from driver's current location to destination (navigation mode)
        origin = location;
        destination = ride.destinationLocation;
      } else {
        // No route needed for completed rides
        setLoadingRoute(false);
        return;
      }

      console.log('[ACTIVE_RIDE] Fetching route:', {
        status: ride.status,
        origin,
        destination,
      });

      // Fetch route from backend
      const routeData = await mapsService.getRoute(origin, destination);

      if (routeData.coordinates && routeData.coordinates.length > 0) {
        setRouteCoordinates(routeData.coordinates);
        setRouteDistance(routeData.distance);
        setRouteDuration(routeData.duration);
        setIsApproximateRoute(false);

        // Save route steps for turn-by-turn navigation
        setRouteSteps(routeData.steps ?? []);
        // Reset navigation progress on route recalculation
        setNearestRouteIndex(0);
        setNearestStepIndex(0);
        announcedStepIndexRef.current = -1;

        console.log('[ACTIVE_RIDE] Route loaded:', {
          points: routeData.coordinates.length,
          distance: routeData.distance,
          duration: routeData.duration,
        });

        // Only fit map to route on initial setup, not on updates
        if (isInitialMapSetup && mapRef.current && routeData.coordinates.length > 0) {
          mapRef.current.fitToCoordinates(routeData.coordinates, {
            edgePadding: { top: 100, right: 50, bottom: 300, left: 50 },
            animated: true,
          });
          setIsInitialMapSetup(false);
        }
      }
    } catch (error) {
      console.error('[ACTIVE_RIDE] Failed to fetch route:', error);
      // Fallback to straight line if OSRM fails
      if (origin && destination) {
        setRouteCoordinates([origin, destination]);
        setIsApproximateRoute(true);
      }
    } finally {
      setLoadingRoute(false);
    }
  };

  const setupSocketListeners = () => {
    const socket = getSocket();
    if (!socket) {
      console.warn('[ACTIVE_RIDE] ⚠️ Socket not available');
      return;
    }

    if (!socket.connected) {
      console.warn('[ACTIVE_RIDE] ⚠️ Socket not connected');
      console.warn('[ACTIVE_RIDE] Socket ID:', socket.id);
      console.warn('[ACTIVE_RIDE] Attempting to reconnect...');
    }

    console.log('[ACTIVE_RIDE] ========================================');
    console.log('[ACTIVE_RIDE] Setting up socket listeners');
    console.log('[ACTIVE_RIDE]    Ride ID:', rideId);
    console.log('[ACTIVE_RIDE]    Socket ID:', socket.id);
    console.log('[ACTIVE_RIDE]    Socket Connected:', socket.connected);
    console.log('[ACTIVE_RIDE]    Transport:', socket.io?.engine?.transport?.name);
    console.log('[ACTIVE_RIDE] ========================================');

    // Join the ride room to receive ride-specific events
    console.log('[ACTIVE_RIDE] 🔌 Joining ride room:', `ride:${rideId}`);
    socket.emit('join_ride', { rideId });

    // Listen for ride status changes (only for this screen)
    const handleStatusChanged = (data: any) => {
      console.log('[ACTIVE_RIDE] 📍 Status changed:', data);
      if (data.rideId === rideId) {
        setRide(prev => (prev ? { ...prev, status: data.status } : null));
        // Route will be updated by useEffect when status changes
      }
    };

    // Listen for ride completion
    const handleRideCompleted = (data: {
      rideId: string;
      status: 'completed';
      completedAt: string;
      actualDistanceKm: number;
      actualDurationMinutes: number;
      finalFare: number;
      timestamp: string;
    }) => {
      console.log('[ACTIVE_RIDE] ========================================');
      console.log('[ACTIVE_RIDE] ✅ RIDE COMPLETED EVENT RECEIVED');
      console.log('[ACTIVE_RIDE]    Ride ID:', data.rideId);
      console.log('[ACTIVE_RIDE]    Current Ride ID:', rideId);
      console.log('[ACTIVE_RIDE]    Final Fare:', data.finalFare);
      console.log('[ACTIVE_RIDE] ========================================');

      // Only handle if this is the current ride
      if (data.rideId !== rideId) {
        console.log('[ACTIVE_RIDE] ⚠️ Completed ride does not match current ride, ignoring');
        return;
      }

      // Play notification sound
      playNotificationSound();

      // Store final fare and show rating modal
      setFinalFare(data.finalFare);
      setShowRatingModal(true);

      // Update ride state to reflect completion
      setRide(prev => (prev ? { ...prev, status: 'completed' } : null));
    };

    // Listen for ride cancellation
    const handleRideCancelled = (data: {
      rideId: string;
      status: 'cancelled';
      cancelledBy: 'passenger' | 'driver' | 'system';
      cancellationReason: string;
      cancellationFee: number;
      cancelledAt: string;
      timestamp: string;
    }) => {
      console.log('[ACTIVE_RIDE] ========================================');
      console.log('[ACTIVE_RIDE] 🚫 RIDE CANCELLED EVENT RECEIVED');
      console.log('[ACTIVE_RIDE]    Ride ID:', data.rideId);
      console.log('[ACTIVE_RIDE]    Current Ride ID:', rideId);
      console.log('[ACTIVE_RIDE]    Cancelled By:', data.cancelledBy);
      console.log('[ACTIVE_RIDE]    Cancellation Fee:', data.cancellationFee);
      console.log('[ACTIVE_RIDE]    Reason:', data.cancellationReason);
      console.log('[ACTIVE_RIDE] ========================================');

      // Only handle if this is the current ride
      if (data.rideId !== rideId) {
        console.log('[ACTIVE_RIDE] ⚠️ Cancelled ride does not match current ride, ignoring');
        return;
      }

      // Play notification sound
      playNotificationSound();

      // Build cancellation message
      let message = `El pasajero ha cancelado el viaje`;

      if (data.cancellationReason) {
        message += `\n\nMotivo: ${data.cancellationReason}`;
      }

      // Add compensation information if applicable
      if (data.cancellationFee > 0) {
        message += `\n\nCompensación recibida: Bs. ${data.cancellationFee.toFixed(2)}`;
      }

      // Show alert and navigate back to home screen
      Alert.alert(
        'Viaje Cancelado',
        message,
        [
          {
            text: 'Entendido',
            onPress: () => {
              console.log('[ACTIVE_RIDE] Navigating back to home screen');
              router.replace('/(driver)');
            },
          },
        ],
        { cancelable: false }
      );

      // Update ride state to reflect cancellation
      // Since 'cancelled' is not a valid status in the Ride interface,
      // we simply set ride to null to indicate the ride is no longer active.
      setRide(null);
    };

    // Listen for payment method change by passenger (Req. 3.4)
    const handlePaymentMethodChanged = (data: {
      rideId: string;
      newMethod: 'pago_movil';
      pagoMovilReference: string;
      changedAt: string;
    }) => {
      if (data.rideId !== rideId) return;

      console.log('[ACTIVE_RIDE] 💳 PAYMENT METHOD CHANGED:', data);

      setPassengerPaymentMode('pago_movil');
      playNotificationSound();

      Alert.alert(
        'Método de Pago Actualizado',
        `El pasajero ha cambiado su método de pago a Pago Móvil.\n\nReferencia: ${data.pagoMovilReference}`,
        [{ text: 'Entendido' }]
      );
    };

    // Listen for payment confirmation
    const handlePaymentConfirmed = (data: any) => {
      console.log('[ACTIVE_RIDE] ========================================');
      console.log('[ACTIVE_RIDE] 💳 PAYMENT CONFIRMED EVENT RECEIVED');
      console.log('[ACTIVE_RIDE]    Ride ID:', data.rideId);
      console.log('[ACTIVE_RIDE]    Payment ID:', data.paymentId);
      console.log('[ACTIVE_RIDE]    Amount:', data.amount);
      console.log('[ACTIVE_RIDE] ========================================');

      // Enable the "Start Ride" button
      setIsPaymentConfirmed(true);

      // Play notification sound
      playNotificationSound();

      // Show alert to driver
      Alert.alert(
        'Pago Confirmado',
        'El pasajero ha confirmado el pago. Ahora puedes iniciar el viaje.',
        [{ text: 'Entendido' }]
      );
    };

    // Listen for connection events
    const handleConnect = () => {
      console.log('[ACTIVE_RIDE] ========================================');
      console.log('[ACTIVE_RIDE] ✅ SOCKET RECONNECTED');
      console.log('[ACTIVE_RIDE]    Socket ID:', socket.id);
      console.log('[ACTIVE_RIDE] ========================================');
    };

    const handleDisconnect = (reason: string) => {
      console.log('[ACTIVE_RIDE] ========================================');
      console.log('[ACTIVE_RIDE] ❌ SOCKET DISCONNECTED');
      console.log('[ACTIVE_RIDE]    Reason:', reason);
      console.log('[ACTIVE_RIDE] ========================================');
    };

    // Register listeners
    socket.on('ride:status_changed', handleStatusChanged);
    socket.on('ride:completed', handleRideCompleted);
    socket.on('ride:cancelled', handleRideCancelled);
    socket.on('ride:payment_method_changed', handlePaymentMethodChanged);
    onPaymentConfirmed(handlePaymentConfirmed);
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);

    console.log('[ACTIVE_RIDE] ========================================');
    console.log('[ACTIVE_RIDE] ✅ Socket listeners registered');
    console.log('[ACTIVE_RIDE]    - ride:status_changed');
    console.log('[ACTIVE_RIDE]    - ride:completed');
    console.log('[ACTIVE_RIDE]    - ride:cancelled');
    console.log('[ACTIVE_RIDE]    - ride:payment_confirmed');
    console.log('[ACTIVE_RIDE]    - connect');
    console.log('[ACTIVE_RIDE]    - disconnect');
    console.log('[ACTIVE_RIDE] ========================================');
    console.log('[ACTIVE_RIDE] ℹ️ NOTE: Payment notifications handled by useGlobalSocketListeners');
    console.log('[ACTIVE_RIDE] ℹ️ GlobalNotificationModal will show notification on ANY screen');
    console.log('[ACTIVE_RIDE] ========================================');

    // Cleanup function
    return () => {
      console.log('[ACTIVE_RIDE] Cleaning up socket listeners');

      // Leave the ride room
      console.log('[ACTIVE_RIDE] 🔌 Leaving ride room:', `ride:${rideId}`);
      socket.emit('leave_ride', { rideId });

      socket.off('ride:status_changed', handleStatusChanged);
      socket.off('ride:completed', handleRideCompleted);
      socket.off('ride:cancelled', handleRideCancelled);
      socket.off('ride:payment_method_changed', handlePaymentMethodChanged);
      socket.off('ride:payment_confirmed', handlePaymentConfirmed);
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
    };
  };

  const updateRideStatus = async (newStatus: string) => {
    try {
      const endpoint =
        newStatus === 'arrived'
          ? `/api/rides/${rideId}/arrive`
          : newStatus === 'in_progress'
            ? `/api/rides/${rideId}/start`
            : `/api/rides/${rideId}/complete`;

      const response = await api.post(endpoint);

      // If completing the ride, show rating modal immediately
      if (newStatus === 'completed') {
        const rideData = response.data.data || response.data;

        // Store final fare from response
        if (rideData.finalFare) {
          setFinalFare(rideData.finalFare);
          // Add earning to wallet
          addEarning(rideData.finalFare, ride?.currency || 'VES', ride?.id);
        } else if (ride?.estimatedFare) {
          // Fallback if finalFare is not provided
          addEarning(ride.estimatedFare, ride.currency || 'VES', ride.id);
        }

        // Update ride state
        setRide(prev => (prev ? { ...prev, status: 'completed' } : null));

        // Show rating modal
        setShowRatingModal(true);

        // Play notification sound
        playNotificationSound();
      } else {
        // For other status changes, just fetch the updated ride
        fetchRide();
      }

      // Route will be updated automatically by useEffect when status changes
    } catch (error) {
      console.error(`Failed to update ride status to ${newStatus}:`, error);
      // Don't show technical error to user, just log it
    }
  };

  const handleCallPassenger = () => {
    if (!ride) return;

    const phoneUrl = `tel:${ride.passengerPhone}`;
    Linking.canOpenURL(phoneUrl)
      .then(supported => {
        if (supported) {
          return Linking.openURL(phoneUrl);
        } else {
          console.warn('Cannot make calls on this device');
          // Don't show error, device doesn't support calls
        }
      })
      .catch(err => {
        console.error('Error making call:', err);
        // Don't show technical error to user
      });
  };

  const handleOpenExternalNav = () => {
    if (!ride) return;

    // Determine destination based on ride status
    const destCoords =
      ride.status === 'accepted'
        ? ride.pickupLocation
        : ride.destinationLocation;

    const { latitude: lat, longitude: lng } = destCoords;

    // Build deep link options filtered by platform
    const options: Array<{ label: string; url: string }> = [
      {
        label: 'Waze',
        url: `waze://?ll=${lat},${lng}&navigate=yes`,
      },
      {
        label: 'Google Maps',
        url: Platform.OS === 'ios'
          ? `google.maps://?daddr=${lat},${lng}`
          : `geo:0,0?q=${lat},${lng}`,
      },
    ];

    if (Platform.OS === 'ios') {
      options.push({
        label: 'Apple Maps',
        url: `maps://?daddr=${lat},${lng}`,
      });
    }

    const openApp = async (url: string, label: string) => {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert(
          'App no disponible',
          `${label} no está instalado en este dispositivo.`,
          [{ text: 'Aceptar' }]
        );
      }
    };

    Alert.alert(
      'Abrir navegación',
      'Selecciona tu app de navegación:',
      [
        ...options.map(opt => ({
          text: opt.label,
          onPress: () => openApp(opt.url, opt.label),
        })),
        { text: 'Cancelar', style: 'cancel' as const },
      ]
    );
  };

  const handleSubmitRating = async () => {
    if (!ride || passengerRating === 0) return;

    setIsSubmittingRating(true);

    try {
      await api.post('/api/ratings/passenger', {
        rideId: ride.id,
        rating: passengerRating,
        comment: passengerComment.trim() || undefined,
      });

      console.log('✅ Rating submitted successfully');

      // Close rating modal
      setShowRatingModal(false);
      setIsSubmittingRating(false);

      // Show success message and navigate home
      Alert.alert(
        '¡Gracias!',
        'Tu valoración ha sido enviada exitosamente.',
        [
          {
            text: 'Aceptar',
            onPress: () => {
              console.log('[ACTIVE_RIDE] Navigating back to home screen');
              router.replace('/(driver)');
            },
          },
        ],
        { cancelable: false }
      );
    } catch (error) {
      console.error('Failed to submit rating:', error);
      setIsSubmittingRating(false);

      Alert.alert('Error', 'No se pudo enviar la valoración. Por favor, intenta de nuevo.', [
        { text: 'Aceptar' },
      ]);
    }
  };

  const handleSkipRating = () => {
    setShowRatingModal(false);

    // Navigate home after skipping
    Alert.alert(
      '🎉 Viaje Completado',
      `El viaje ha sido completado exitosamente.\n\nTarifa Final: Bs. ${finalFare?.toFixed(2) || '0.00'}`,
      [
        {
          text: 'Aceptar',
          onPress: () => {
            console.log('[ACTIVE_RIDE] Navigating back to home screen');
            router.replace('/(driver)');
          },
        },
      ],
      { cancelable: false }
    );
  };

  // Navigation Banner component (inline)
  const currentStep = routeSteps.length > 0 ? routeSteps[nearestStepIndex] : null;
  const distanceToManeuver = currentStep?.location && location
    ? haversineDistance(location, currentStep.location)
    : null;
  const isImminent = distanceToManeuver !== null && distanceToManeuver < 50;

  const getManeuverIcon = (type?: string): any => {
    switch (type) {
      case 'depart': return 'navigate-outline';
      case 'turn-left': return 'arrow-back';
      case 'turn-right': return 'arrow-forward';
      case 'turn-sharp-left': return 'return-up-back';
      case 'turn-sharp-right': return 'return-up-forward';
      case 'uturn-left':
      case 'uturn-right': return 'refresh';
      case 'arrive': return 'flag';
      default: return 'arrow-up';
    }
  };

  const formatDistance = (meters: number): string => {
    if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
    return `${Math.round(meters)} m`;
  };

  if (loading || !ride) {
    return (
      <View
        style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const targetLocation =
    ride.status === 'accepted' || ride.status === 'arrived'
      ? ride.pickupLocation
      : ride.destinationLocation;

  // Check if running in Expo Go
  const isExpoGo = Constants.appOwnership === 'expo';

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      {isExpoGo ? (
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: '#f5f5f5',
            padding: 20,
          }}
        >
          <Text
            style={{
              fontSize: 18,
              fontWeight: 'bold',
              color: colors.darkGray,
              marginBottom: 12,
              textAlign: 'center',
            }}
          >
            🗺️ Mapa no disponible en Expo Go
          </Text>
          <Text
            style={{ fontSize: 14, color: colors.lightGray, textAlign: 'center', marginBottom: 8 }}
          >
            react-native-maps requiere un Development Build
          </Text>
          <Text style={{ fontSize: 12, color: colors.lightGray, textAlign: 'center' }}>
            Ejecuta: npx expo run:android
          </Text>
        </View>
      ) : (
        <MapView
          ref={mapRef}
          style={{ flex: 1 }}
          initialRegion={{
            latitude: targetLocation.latitude,
            longitude: targetLocation.longitude,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}
          rotateEnabled={true}
          pitchEnabled={true}
          showsBuildings={true}
          showsUserLocation={false}
          showsMyLocationButton={false}
          onPanDrag={() => setUserInteractedWithMap(true)}
          onRegionChangeComplete={() => {
            // User manually changed region
            setUserInteractedWithMap(true);
          }}
        >
          {/* Driver's current location with rotation based on heading */}
          {/* Color changes: Green when going to pickup, Orange when transporting passenger */}
          {location && (
            <Marker
              coordinate={location}
              title="Tu Ubicación"
              description="Conductor"
              anchor={{ x: 0.5, y: 0.5 }}
              flat={true}
              rotation={routeBearing || heading}
            >
              <DriverTaxiIcon />
            </Marker>
          )}

          {(ride.status === 'accepted' || ride.status === 'arrived') && (
            <Marker
              coordinate={ride.pickupLocation}
              title="Punto de Recogida"
              description={ride.pickupAddress}
              anchor={{ x: 0.5, y: 1 }}
            >
              <PassengerIcon size={22} />
            </Marker>
          )}

          {/* Destination location marker - Green with flag icon */}
          <Marker
            coordinate={ride.destinationLocation}
            title="Destino"
            description={ride.destinationAddress}
            anchor={{ x: 0.5, y: 1 }}
          >
            <DropoffIcon size={24} />
          </Marker>

          {/* Route polyline - Different colors based on ride status */}
          {routeCoordinates.length > 0 && (
            <Polyline
              coordinates={
                routeCoordinates.length >= 2 && nearestRouteIndex > 0
                  ? routeCoordinates.slice(nearestRouteIndex)
                  : routeCoordinates
              }
              strokeColor={
                ride.status === 'accepted' || ride.status === 'arrived'
                  ? '#FF8C00' // Orange for going to pickup
                  : '#22c55e' // Green for going to destination
              }
              strokeWidth={5}
              lineCap="round"
              lineJoin="round"
            />
          )}
        </MapView>
      )}

      {/* Approximate Route Banner */}
      {isApproximateRoute && (
        <View style={{
          position: 'absolute',
          top: 10,
          left: 16,
          right: 16,
          backgroundColor: '#fef3c7',
          borderRadius: 8,
          padding: 10,
          flexDirection: 'row',
          alignItems: 'center',
          borderWidth: 1,
          borderColor: '#f59e0b',
          zIndex: 100,
        }}>
          <Ionicons name="warning" size={16} color="#92400e" />
          <Text style={{
            fontSize: 13,
            color: '#92400e',
            marginLeft: 8,
            fontWeight: '500',
            flex: 1,
          }}>
            ⚠️ Ruta aproximada — sin conexión al servidor de rutas
          </Text>
        </View>
      )}

      {/* GPS Permission Denied Banner */}
      {gpsPermissionDenied && ride.status === 'in_progress' && (
        <View style={{
          position: 'absolute',
          top: isApproximateRoute ? 60 : 10,
          left: 16,
          right: 16,
          backgroundColor: '#fee2e2',
          borderRadius: 8,
          padding: 10,
          flexDirection: 'row',
          alignItems: 'center',
          borderWidth: 1,
          borderColor: '#ef4444',
          zIndex: 100,
        }}>
          <Ionicons name="location-outline" size={16} color="#991b1b" />
          <Text style={{
            fontSize: 13,
            color: '#991b1b',
            marginLeft: 8,
            fontWeight: '500',
            flex: 1,
          }}>
            GPS desactivado — la distancia real no se registrará
          </Text>
        </View>
      )}

      {/* GPS Active Indicator */}
      {isGpsTracking && (
        <View style={{
          position: 'absolute',
          top: 12,
          right: 16,
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: 'rgba(0,0,0,0.55)',
          borderRadius: 12,
          paddingHorizontal: 8,
          paddingVertical: 4,
          zIndex: 101,
        }}>
          <View style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: '#22c55e',
            marginRight: 5,
          }} />
          <Text style={{ color: '#fff', fontSize: 11, fontWeight: '600' }}>GPS</Text>
        </View>
      )}

      {/* Navigation Banner - Turn-by-turn instructions */}
      {currentStep &&
        ride.status !== 'arrived' &&
        ride.status !== 'completed' && (
          <View
            style={{
              position: 'absolute',
              top: 10,
              left: 16,
              right: 56, // leave space for GPS indicator on the right
              backgroundColor: isImminent ? '#1a56db' : 'rgba(15, 23, 42, 0.92)',
              borderRadius: 12,
              padding: 12,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              zIndex: 200,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.3,
              shadowRadius: 4,
              elevation: 6,
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: isImminent ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.15)',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Ionicons
                name={getManeuverIcon(currentStep.maneuver?.type)}
                size={22}
                color="#fff"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: '#fff',
                  fontSize: 15,
                  fontWeight: '700',
                  lineHeight: 20,
                }}
                numberOfLines={1}
              >
                {currentStep.instruction}
              </Text>
              {currentStep.name ? (
                <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 1 }} numberOfLines={1}>
                  {currentStep.name}
                </Text>
              ) : null}
            </View>
            {distanceToManeuver !== null && (
              <Text
                style={{
                  color: isImminent ? '#fbbf24' : 'rgba(255,255,255,0.9)',
                  fontSize: 13,
                  fontWeight: '700',
                  minWidth: 48,
                  textAlign: 'right',
                }}
              >
                {formatDistance(distanceToManeuver)}
              </Text>
            )}
          </View>
        )}

      {/* Recenter Button — visible when user has manually interacted with map */}
      {userInteractedWithMap &&
        ride.status !== 'arrived' &&
        ride.status !== 'completed' && (
          <TouchableOpacity
            onPress={() => {
              setUserInteractedWithMap(false);
              if (location) {
                animateNavigationCamera(mapRef, location, routeBearing || heading, {
                  duration: 500,
                  zoom: 17,
                  pitch: 50,
                });
              }
            }}
            style={{
              position: 'absolute',
              bottom: 160,
              right: 16,
              width: 48,
              height: 48,
              borderRadius: 24,
              backgroundColor: '#fff',
              justifyContent: 'center',
              alignItems: 'center',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.25,
              shadowRadius: 4,
              elevation: 5,
              zIndex: 150,
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="locate" size={24} color={colors.primary} />
          </TouchableOpacity>
        )}

      {/* Loading route indicator */}
      {loadingRoute && (
        <View
          style={{
            position: 'absolute',
            top: 60,
            alignSelf: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            paddingHorizontal: 16,
            paddingVertical: 8,
            borderRadius: 20,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <ActivityIndicator size="small" color="#fff" />
          <Text style={{ color: '#fff', fontSize: 14 }}>Cargando ruta...</Text>
        </View>
      )}

      {/* Route info badge with status indicator */}
      {routeDistance != null && routeDuration != null && !loadingRoute && (
        <View
          style={{
            position: 'absolute',
            top: 60,
            alignSelf: 'center',
            backgroundColor:
              ride.status === 'accepted' || ride.status === 'arrived'
                ? '#FF8C00' // Orange for going to pickup
                : '#22c55e', // Green for going to destination
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderRadius: 25,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.3,
            shadowRadius: 4,
            elevation: 5,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="navigate" size={18} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>
              {routeDistance.toFixed(1)} km
            </Text>
          </View>
          <View style={{ width: 1, height: 20, backgroundColor: 'rgba(255,255,255,0.3)' }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="time" size={18} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>
              {Math.round(routeDuration)} min
            </Text>
          </View>
        </View>
      )}

      {/* Ride Info Card - Collapsible */}
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: '#fff',
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
          elevation: 5,
          maxHeight: isPanelCollapsed ? 50 : '65%',
        }}
      >
        {/* Collapsible Handle - Always visible */}
        <TouchableOpacity
          style={{
            alignItems: 'center',
            paddingVertical: 12,
            backgroundColor: '#fff',
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
          }}
          onPress={() => setIsPanelCollapsed(!isPanelCollapsed)}
          activeOpacity={0.7}
        >
          <View
            style={{
              width: 40,
              height: 4,
              backgroundColor: '#D1D5DB',
              borderRadius: 2,
            }}
          />
        </TouchableOpacity>

        {/* Panel Content - Hidden when collapsed */}
        {!isPanelCollapsed && (
          <ScrollView
            showsVerticalScrollIndicator={false}
            style={{ maxHeight: '100%' }}
            contentContainerStyle={{ padding: 20, paddingBottom: 32 }}
          >
            {/* Status Badge */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor:
                  ride.status === 'accepted' || ride.status === 'arrived' ? '#FFF4E6' : '#E8F5E9',
                padding: 14,
                borderRadius: 16,
                marginBottom: 20,
                gap: 12,
              }}
            >
              <View
                style={{
                  backgroundColor:
                    ride.status === 'accepted' || ride.status === 'arrived' ? '#FF8C00' : '#22c55e',
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Ionicons
                  name={
                    ride.status === 'accepted' || ride.status === 'arrived'
                      ? 'navigate-circle'
                      : 'checkmark-circle'
                  }
                  size={28}
                  color="#fff"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 17,
                    fontWeight: 'bold',
                    color: colors.darkGray,
                    marginBottom: 4,
                  }}
                >
                  {ride.status === 'accepted' || ride.status === 'arrived'
                    ? 'Navegando al Punto de Recogida'
                    : 'Navegando al Destino'}
                </Text>
                {routeDistance != null && routeDuration != null && (
                  <Text style={{ fontSize: 14, color: colors.lightGray }}>
                    {routeDistance.toFixed(1)} km • {Math.round(routeDuration)} min restantes
                  </Text>
                )}
              </View>
            </View>

            {/* Passenger Info Card */}
            <View
              style={{
                backgroundColor: '#F9FAFB',
                borderRadius: 16,
                padding: 16,
                marginBottom: 20,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  marginBottom: 16,
                }}
              >
                <View
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 28,
                    backgroundColor: colors.primary,
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginRight: 14,
                    overflow: 'hidden',
                  }}
                >
                  {ride.passengerProfilePicture ? (
                    <Image
                      source={{ uri: ride.passengerProfilePicture }}
                      style={{ width: 56, height: 56 }}
                      resizeMode="cover"
                    />
                  ) : (
                    <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#fff' }}>
                      {ride.passengerName.charAt(0).toUpperCase()}
                    </Text>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 18,
                      fontWeight: 'bold',
                      color: colors.darkGray,
                      marginBottom: 4,
                    }}
                  >
                    {ride.passengerName}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="call-outline" size={16} color={colors.lightGray} />
                    <Text style={{ fontSize: 14, color: colors.lightGray }}>
                      {ride.passengerPhone}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Call Button - Disabled when ride is in progress */}
              <TouchableOpacity
                onPress={handleCallPassenger}
                disabled={ride.status === 'in_progress'}
                style={{
                  backgroundColor: ride.status === 'in_progress' ? '#D1D5DB' : colors.primary,
                  paddingVertical: 14,
                  borderRadius: 12,
                  flexDirection: 'row',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: 8,
                  opacity: ride.status === 'in_progress' ? 0.5 : 1,
                }}
              >
                <Ionicons name="call" size={20} color="#fff" />
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>
                  {ride.status === 'in_progress' ? 'Pasajero en el Vehículo' : 'Llamar al Pasajero'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Trip Details */}
            <View
              style={{
                backgroundColor: '#fff',
                borderWidth: 1,
                borderColor: '#E5E7EB',
                borderRadius: 16,
                padding: 16,
                marginBottom: 20,
              }}
            >
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: 'bold',
                  color: colors.darkGray,
                  marginBottom: 16,
                }}
              >
                Detalles del Viaje
              </Text>

              {/* Pickup Location */}
              <View style={{ marginBottom: 16 }}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    marginBottom: 6,
                  }}
                >
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: '#FFF4E6',
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                  >
                    <Ionicons name="person" size={18} color="#FF8C00" />
                  </View>
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: '600',
                      color: colors.lightGray,
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                    }}
                  >
                    Punto de Recogida
                  </Text>
                </View>
                <Text
                  style={{
                    fontSize: 15,
                    color: colors.darkGray,
                    marginLeft: 42,
                    lineHeight: 20,
                  }}
                >
                  {formatAddressForCard(ride.pickupAddress)}
                </Text>
              </View>

              {/* Destination Location */}
              <View style={{ marginBottom: 16 }}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    marginBottom: 6,
                  }}
                >
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: '#E8F5E9',
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                  >
                    <Ionicons name="flag" size={18} color="#22c55e" />
                  </View>
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: '600',
                      color: colors.lightGray,
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                    }}
                  >
                    Destino
                  </Text>
                </View>
                <Text
                  style={{
                    fontSize: 15,
                    color: colors.darkGray,
                    marginLeft: 42,
                    lineHeight: 20,
                  }}
                >
                  {formatAddressForCard(ride.destinationAddress)}
                </Text>
              </View>

              {/* Fare */}
              <View
                style={{
                  backgroundColor: '#F0FDF4',
                  padding: 12,
                  borderRadius: 12,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <Text style={{ fontSize: 14, color: colors.lightGray, fontWeight: '500' }}>
                  Tarifa Estimada
                </Text>
                <Text
                  style={{
                    fontSize: 20,
                    fontWeight: 'bold',
                    color: colors.primary,
                  }}
                >
                  {formatCurrency(ride.estimatedFare, ride.currency || 'VES')}
                </Text>
              </View>

              {/* Payment method indicator — updates in real-time via WebSocket (Req. 3.4) */}
              <View
                style={{
                  backgroundColor: passengerPaymentMode === 'pago_movil' ? '#eff6ff' : '#f9fafb',
                  padding: 10,
                  borderRadius: 10,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  borderWidth: 1,
                  borderColor: passengerPaymentMode === 'pago_movil' ? '#bfdbfe' : '#e5e7eb',
                }}
              >
                <Ionicons
                  name={passengerPaymentMode === 'pago_movil' ? 'phone-portrait-outline' : 'cash-outline'}
                  size={16}
                  color={passengerPaymentMode === 'pago_movil' ? '#3b82f6' : colors.mediumGray}
                />
                <Text style={{ fontSize: 13, color: passengerPaymentMode === 'pago_movil' ? '#3b82f6' : colors.mediumGray, fontWeight: '500' }}>
                  {passengerPaymentMode === 'pago_movil' ? 'Pago Móvil' : 'Efectivo'}
                </Text>
              </View>
            </View>

            {/* External Navigation Button */}
            {(ride.status === 'accepted' || ride.status === 'in_progress') && (
              <TouchableOpacity
                onPress={handleOpenExternalNav}
                style={{
                  backgroundColor: '#F3F4F6',
                  paddingVertical: 12,
                  borderRadius: 12,
                  flexDirection: 'row',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 12,
                }}
              >
                <Ionicons name="navigate-outline" size={18} color={colors.darkGray} />
                <Text style={{ color: colors.darkGray, fontSize: 15, fontWeight: '600' }}>
                  Abrir en app de navegación
                </Text>
              </TouchableOpacity>
            )}

            {/* Action Button */}
            {ride.status === 'accepted' && (
              <TouchableOpacity
                onPress={() => updateRideStatus('arrived')}
                style={{
                  backgroundColor: colors.primary,
                  paddingVertical: 16,
                  borderRadius: 12,
                  alignItems: 'center',
                  shadowColor: colors.primary,
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  elevation: 4,
                  flexDirection: 'row',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <Ionicons name="location" size={20} color="#fff" />
                <Text style={{ color: '#fff', fontSize: 17, fontWeight: 'bold' }}>
                  He Llegado al Punto de Recogida
                </Text>
              </TouchableOpacity>
            )}

            {ride.status === 'arrived' && (
              <>
                {/* Payment waiting message */}
                {!isPaymentConfirmed && (
                  <View
                    style={{
                      backgroundColor: '#FFF4E6',
                      padding: 16,
                      borderRadius: 12,
                      marginBottom: 16,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                    }}
                  >
                    <ActivityIndicator size="small" color="#FF8C00" />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: 15,
                          fontWeight: '600',
                          color: '#FF8C00',
                          marginBottom: 4,
                        }}
                      >
                        Esperando confirmación de pago
                      </Text>
                      <Text style={{ fontSize: 13, color: '#666' }}>
                        El pasajero debe confirmar el pago antes de iniciar el viaje
                      </Text>
                    </View>
                  </View>
                )}

                {/* Start Ride button */}
                <TouchableOpacity
                  onPress={() => updateRideStatus('in_progress')}
                  disabled={!isPaymentConfirmed}
                  style={{
                    backgroundColor: isPaymentConfirmed ? colors.primary : '#D1D5DB',
                    paddingVertical: 16,
                    borderRadius: 12,
                    alignItems: 'center',
                    shadowColor: isPaymentConfirmed ? colors.primary : '#000',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: isPaymentConfirmed ? 0.3 : 0.1,
                    shadowRadius: 8,
                    elevation: 4,
                    opacity: isPaymentConfirmed ? 1 : 0.6,
                    flexDirection: 'row',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                >
                  <Ionicons
                    name={isPaymentConfirmed ? 'play-circle' : 'time-outline'}
                    size={20}
                    color="#fff"
                  />
                  <Text style={{ color: '#fff', fontSize: 17, fontWeight: 'bold' }}>
                    {isPaymentConfirmed ? 'Iniciar Viaje' : 'Esperando Pago'}
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {ride.status === 'in_progress' && (
              <TouchableOpacity
                onPress={() => updateRideStatus('completed')}
                style={{
                  backgroundColor: colors.primary,
                  paddingVertical: 16,
                  borderRadius: 12,
                  alignItems: 'center',
                  shadowColor: colors.primary,
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  elevation: 4,
                  flexDirection: 'row',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                <Text style={{ color: '#fff', fontSize: 17, fontWeight: 'bold' }}>
                  He Llegado al Destino
                </Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        )}
      </View>

      {/* Rating Modal */}
      <Modal
        visible={showRatingModal}
        transparent={true}
        animationType="slide"
        onRequestClose={handleSkipRating}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 20,
          }}
        >
          <View
            style={{
              backgroundColor: '#fff',
              borderRadius: 20,
              padding: 24,
              width: '100%',
              maxWidth: 400,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.25,
              shadowRadius: 8,
              elevation: 5,
            }}
          >
            {/* Rating Header */}
            <View style={{ marginBottom: 20 }}>
              <Text
                style={{
                  fontSize: 24,
                  fontWeight: 'bold',
                  color: colors.darkGray,
                  textAlign: 'center',
                  marginBottom: 8,
                }}
              >
                ¿Cómo fue el viaje?
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  color: colors.lightGray,
                  textAlign: 'center',
                }}
              >
                Valora tu experiencia con {ride?.passengerName || 'el pasajero'}
              </Text>
            </View>

            {/* Passenger Info */}
            {ride && (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: '#F9FAFB',
                  padding: 16,
                  borderRadius: 12,
                  marginBottom: 20,
                }}
              >
                <View
                  style={{
                    width: 50,
                    height: 50,
                    borderRadius: 25,
                    backgroundColor: colors.primary,
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginRight: 12,
                  }}
                >
                  <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#fff' }}>
                    {ride.passengerName.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: colors.darkGray }}>
                    {ride.passengerName}
                  </Text>
                  {finalFare && (
                    <Text style={{ fontSize: 14, color: colors.lightGray, marginTop: 2 }}>
                      Tarifa: {formatCurrency(finalFare, ride.currency || 'VES')}
                    </Text>
                  )}
                </View>
              </View>
            )}

            {/* Star Rating Component */}
            <View style={{ marginBottom: 20 }}>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '600',
                  color: colors.darkGray,
                  marginBottom: 12,
                  textAlign: 'center',
                }}
              >
                Tu valoración
              </Text>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'center',
                  gap: 8,
                  marginBottom: 8,
                }}
              >
                {[1, 2, 3, 4, 5].map(star => (
                  <TouchableOpacity
                    key={star}
                    onPress={() => setPassengerRating(star)}
                    style={{
                      padding: 4,
                    }}
                  >
                    <Ionicons
                      name={star <= passengerRating ? 'star' : 'star-outline'}
                      size={40}
                      color={star <= passengerRating ? '#FFD700' : '#D1D5DB'}
                    />
                  </TouchableOpacity>
                ))}
              </View>
              {passengerRating > 0 && (
                <Text
                  style={{
                    fontSize: 14,
                    color: colors.primary,
                    textAlign: 'center',
                    fontWeight: '600',
                  }}
                >
                  {passengerRating === 1 && 'Muy malo'}
                  {passengerRating === 2 && 'Malo'}
                  {passengerRating === 3 && 'Regular'}
                  {passengerRating === 4 && 'Bueno'}
                  {passengerRating === 5 && 'Excelente'}
                </Text>
              )}
            </View>

            {/* Comment Input */}
            <View style={{ marginBottom: 20 }}>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '600',
                  color: colors.darkGray,
                  marginBottom: 8,
                }}
              >
                Comentario (opcional)
              </Text>
              <TextInput
                style={{
                  backgroundColor: '#F9FAFB',
                  borderWidth: 1,
                  borderColor: '#E5E7EB',
                  borderRadius: 12,
                  padding: 12,
                  fontSize: 14,
                  color: colors.darkGray,
                  minHeight: 100,
                  textAlignVertical: 'top',
                }}
                placeholder="Cuéntanos más sobre tu experiencia..."
                placeholderTextColor="#A9A9A9"
                value={passengerComment}
                onChangeText={setPassengerComment}
                multiline
                numberOfLines={4}
                maxLength={500}
              />
              <Text
                style={{
                  fontSize: 12,
                  color: colors.lightGray,
                  textAlign: 'right',
                  marginTop: 4,
                }}
              >
                {passengerComment.length}/500
              </Text>
            </View>

            {/* Rating Modal Buttons */}
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                style={{
                  flex: 1,
                  paddingVertical: 14,
                  borderRadius: 12,
                  backgroundColor: '#F3F4F6',
                  alignItems: 'center',
                }}
                onPress={handleSkipRating}
                disabled={isSubmittingRating}
              >
                <Text style={{ fontSize: 16, fontWeight: '600', color: colors.lightGray }}>
                  Omitir
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{
                  flex: 1,
                  paddingVertical: 14,
                  borderRadius: 12,
                  backgroundColor:
                    passengerRating === 0 || isSubmittingRating ? '#D1D5DB' : colors.primary,
                  alignItems: 'center',
                }}
                onPress={handleSubmitRating}
                disabled={passengerRating === 0 || isSubmittingRating}
              >
                {isSubmittingRating ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={{ fontSize: 16, fontWeight: '600', color: '#fff' }}>
                    Enviar Valoración
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
