import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
  Linking,
  Modal,
  TextInput,
  Image,
  AppState,
} from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Constants from 'expo-constants';
import api from '@/services/api';
import { getRoute } from '@/services/mapsService';
import { getSocket, onPaymentConfirmed } from '@/services/socket';
import { useSound } from '@/hooks/useSound';
import { Colors as colors } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { formatCurrency, Currency } from '@/utils/currency';
import { DriverTaxiIcon, PassengerIcon, DropoffIcon } from '@/src/components/map/markers';
import {
  bearingAlongRoute,
  animateNavigationCamera,
  computeNearestStepIndex,
  computeNearestRouteIndex,
  haversineDistance,
} from '@/src/utils/mapNav';
import { formatAddressForCard } from '@/utils/addressFormatter';
import { useRideTracking } from '@/hooks/useRideTracking';
import { useTTS } from '@/hooks/useTTS';
import { useExchangeRate } from '@/hooks/useExchangeRate';
import { useUnifiedNotifications } from '@/context/UnifiedNotificationContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Ride {
  id: string;
  status: 'accepted' | 'arrived' | 'in_progress' | 'completed';
  passengerName: string;
  passengerPhone: string;
  passengerProfilePicture?: string;
  isDelegated?: boolean;
  pickupAddress: string;
  destinationAddress: string;
  pickupLocation: { latitude: number; longitude: number };
  destinationLocation: { latitude: number; longitude: number };
  estimatedFare: number;
  actualDistance?: number;
  actualDuration?: number;
  currency?: Currency;
  routePoints?: RoutePoint[];
  payment?: {
    id: string;
    status: 'pending' | 'completed' | 'failed' | 'refunded';
    amount: number;
    paymentMode?: 'cash' | 'pago_movil' | 'dual';
    processedAt: string | null;
  } | null;
}

interface RoutePoint {
  id: string;
  sequence: number;
  pointType: 'pickup' | 'destination';
  latitude: number;
  longitude: number;
  address: string;
  completedAt: string | null;
}

interface RouteCoordinate {
  latitude: number;
  longitude: number;
}

interface Step {
  instruction: string;
  name: string;
  distance: number; // km al siguiente punto de maniobra
  duration: number; // minutos
  maneuver?: { type: string };
  location?: { latitude: number; longitude: number };
}

export default function ActiveRideScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const rideId = params.rideId as string;
  const isManualFlow = params.source === 'manual';
  const { playNotificationSound } = useSound();
  const { convertToUsd, convertToBs } = useExchangeRate();
  const { showToast, showStatus } = useUnifiedNotifications();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const locationSubscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const isFirstFetchRef = useRef(true);
  const currentRideIdRef = useRef('');
  const distanceScaleRef = useRef<number | null>(null);
  const durationScaleRef = useRef<number | null>(null);

  const [ride, setRide] = useState<Ride | null>(null);
  const [loading, setLoading] = useState(true);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<RouteCoordinate[]>([]);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [routeDistance, setRouteDistance] = useState<number | null>(null);
  const [routeDuration, setRouteDuration] = useState<number | null>(null);
  const [backendEtaMinutes, setBackendEtaMinutes] = useState<number | null>(null);
  const [backendEtaDistance, setBackendEtaDistance] = useState<number | null>(null);
  const [heading, setHeading] = useState<number>(0);
  const [routeBearing, setRouteBearing] = useState<number>(0);
  const lastRouteUpdateRef = useRef<number>(0); // Timestamp of last route update
  const ROUTE_UPDATE_INTERVAL = 30000; // Update route every 30 seconds (30000ms)

  // Route deviation detection — recalculate immediately when driver leaves the route
  const DEVIATION_THRESHOLD_METERS = 50; // Distance from route that triggers reroute
  const REROUTE_COOLDOWN = 8000; // Minimum ms between automatic reroutes
  const lastRerouteTimeRef = useRef<number>(0);
  const isReroutingRef = useRef(false);
  const routePolylineRef = useRef<RouteCoordinate[]>([]); // Stored polyline for deviation checks
  const rideRef = useRef<Ride | null>(null); // Always-current ride for GPS callback
  const locationRef = useRef<{ latitude: number; longitude: number } | null>(null);

  // Keep rideRef and locationRef in sync
  useEffect(() => {
    rideRef.current = ride;
  }, [ride]);

  useEffect(() => {
    locationRef.current = location;
  }, [location]);

  // Payment state
  const [isPaymentConfirmed, setIsPaymentConfirmed] = useState(false);
  // Track passenger's current payment method (updated via WebSocket, Req. 3.4)
  const [passengerPaymentMode, setPassengerPaymentMode] = useState<'cash' | 'pago_movil' | 'dual'>(
    'cash'
  );

  // Route points state (Req. 6.8)
  const [routePoints, setRoutePoints] = useState<RoutePoint[]>([]);
  const [isCompletingRoutePoint, setIsCompletingRoutePoint] = useState(false);

  // Rating modal states
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [passengerRating, setPassengerRating] = useState(0);
  const [passengerComment, setPassengerComment] = useState('');
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);
  const [finalFare, setFinalFare] = useState<number | null>(null);

  // Panel collapse state
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);

  const [isApproximateRoute, setIsApproximateRoute] = useState(false);

  // Navigation chooser modal state
  const [showNavChooser, setShowNavChooser] = useState(false);
  const [navDestCoords, setNavDestCoords] = useState<{ lat: number; lng: number } | null>(null);

  const [routeSteps, setRouteSteps] = useState<Step[]>([]);
  const [nearestStepIndex, setNearestStepIndex] = useState<number>(0);
  const [nearestRouteIndex, setNearestRouteIndex] = useState<number>(0);
  const announcedStepIndexRef = useRef<number>(-1);

  const tts = useTTS();

  // GPS tracking hook — sends location to backend during active rides (accepted, arrived, in_progress)
  const { isTracking: isGpsTracking, permissionDenied: gpsPermissionDenied } = useRideTracking(
    rideId || null,
    ride?.status ?? ''
  );

  useEffect(() => {
    currentRideIdRef.current = rideId;

    // Reset all ride-specific state to prevent stale data from previous ride bleeding in
    setRide(null);
    setLoading(true);
    setIsPaymentConfirmed(false);
    setRoutePoints([]);
    setFinalFare(null);
    setRouteCoordinates([]);
    setRouteSteps([]);
    setShowRatingModal(false);
    setPassengerRating(0);
    setPassengerComment('');
    setIsSubmittingRating(false);
    setPassengerPaymentMode('cash');
    setRouteDistance(null);
    setRouteDuration(null);
    setBackendEtaMinutes(null);
    setBackendEtaDistance(null);

    fetchRide();
    initializeLocation();
    const cleanup = setupSocketListeners();

    // Cleanup on unmount or rideId change
    return () => {
      if (cleanup) cleanup();
      if (locationSubscriptionRef.current) {
        locationSubscriptionRef.current.remove();
      }
      isFirstFetchRef.current = true;
      distanceScaleRef.current = null;
      durationScaleRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rideId]);

  // Fetch and draw route when ride status changes or payment is confirmed
  useEffect(() => {
    if (ride && location) {
      // Reset map interaction state when ride status changes
      setUserInteractedWithMap(false);
      setIsInitialMapSetup(true);
      fetchAndDrawRoute();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ride?.status, isPaymentConfirmed, location, ride]);

  // Poll payment status while waiting at pickup (arrived, not yet paid)
  useEffect(() => {
    if (ride?.status !== 'arrived' || isPaymentConfirmed) return;

    // Cash payments: auto-confirm when driver arrives at pickup
    if (passengerPaymentMode === 'cash') {
      console.log('[ACTIVE_RIDE] 💵 Cash payment — auto-confirming on arrival');
      setIsPaymentConfirmed(true);
      return;
    }

    // Digital payments (pago_móvil / dual): poll until backend confirms
    const interval = setInterval(async () => {
      try {
        const response = await api.get(`/api/rides/${rideId}`);
        const rideData = response.data?.data?.ride || response.data?.data || response.data;
        if (rideData?.payment?.status === 'completed') {
          console.log('[ACTIVE_RIDE] 💳 Payment detected via polling');
          setIsPaymentConfirmed(true);
          clearInterval(interval);
        }
      } catch {
        /* retry on next interval */
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [ride?.status, isPaymentConfirmed, rideId, passengerPaymentMode]);

  // Stop TTS when ride is completed or arrived
  useEffect(() => {
    if (ride?.status === 'arrived' || ride?.status === 'completed') {
      tts.stop();
    }
  }, [ride?.status, tts]);

  // Compute scale factor so backend haversine×1.3 ETA matches OSRM road distance dynamically
  useEffect(() => {
    if (
      routeDistance != null &&
      backendEtaDistance != null &&
      distanceScaleRef.current == null &&
      backendEtaDistance > 0
    ) {
      distanceScaleRef.current = routeDistance / backendEtaDistance;
      console.log('[ACTIVE_RIDE] Distance scale factor:', distanceScaleRef.current.toFixed(3));
    }
  }, [routeDistance, backendEtaDistance]);

  useEffect(() => {
    if (
      routeDuration != null &&
      backendEtaMinutes != null &&
      durationScaleRef.current == null &&
      backendEtaMinutes > 0
    ) {
      durationScaleRef.current = routeDuration / backendEtaMinutes;
      console.log('[ACTIVE_RIDE] Duration scale factor:', durationScaleRef.current.toFixed(3));
    }
  }, [routeDuration, backendEtaMinutes]);

  // Resume route tracking when app returns from background (e.g., after external nav)
  useEffect(() => {
    const sub = AppState.addEventListener('change', nextState => {
      if (nextState === 'active' && rideRef.current) {
        console.log('[ACTIVE_RIDE] App returned to foreground, refreshing state...');
        // Re-fetch ride data to get latest status
        fetchRide().then(() => {
          // Re-initialize GPS and route after getting latest ride state
          if (locationRef.current) {
            fetchAndDrawRoute();
          } else {
            // GPS was lost while in background, request fresh location
            Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
              .then(pos => {
                const coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
                setLocation(coords);
                locationRef.current = coords;
                fetchAndDrawRoute();
              })
              .catch(() =>
                console.log('[ACTIVE_RIDE] Failed to get fresh location after background')
              );
          }
        });
      }
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // State to track if user has manually interacted with map
  const [userInteractedWithMap, setUserInteractedWithMap] = useState(false);
  const [isInitialMapSetup, setIsInitialMapSetup] = useState(true);

  // GPS tracking: smoothly follow driver on map during navigation
  useEffect(() => {
    if (location && mapRef.current && ride && !userInteractedWithMap) {
      if (
        ride.status === 'accepted' ||
        ride.status === 'arrived' ||
        ride.status === 'in_progress'
      ) {
        animateNavigationCamera(mapRef, location, routeBearing || heading || 0, {
          duration: 1000,
          zoom: 18,
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location?.latitude, location?.longitude, heading, routeBearing, ride, userInteractedWithMap]);

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
  }, [location, routeSteps, routeCoordinates, tts]);

  const fetchRide = async () => {
    try {
      const response = await api.get(`/api/rides/${rideId}`);

      // Ignore stale response if a newer rideId has been set (race condition with tab reuse)
      if (currentRideIdRef.current !== rideId) {
        console.warn('[ACTIVE_RIDE] ⚠️ Ignoring stale fetchRide response — rideId changed');
        return;
      }

      const rideData = response.data?.data || response.data;
      setRide(rideData);

      // Guard: if first fetch after mount returns completed, the data is stale
      if (isFirstFetchRef.current && rideData?.status === 'completed') {
        const correctedStatus = isManualFlow ? 'accepted' : 'in_progress';
        console.warn(
          '[ACTIVE_RIDE] ⚠️ First fetch returned completed — overriding to',
          correctedStatus
        );
        setRide(prev => (prev ? { ...prev, status: correctedStatus } : null));
      }
      isFirstFetchRef.current = false;

      // Populate route points state if available
      if (rideData.routePoints && rideData.routePoints.length > 0) {
        setRoutePoints(rideData.routePoints);
      }
      // Check if payment was already completed (e.g., driver re-opened screen after passenger paid)
      if (rideData.payment) {
        if (rideData.payment.status === 'completed') {
          console.log('[ACTIVE_RIDE] 💳 Payment already completed on load');
          setIsPaymentConfirmed(true);
        }
        // Read payment mode from the payment record (works for pending too)
        if (rideData.payment.paymentMode === 'pago_movil') {
          setPassengerPaymentMode('pago_movil');
        } else if (rideData.payment.paymentMode === 'dual') {
          setPassengerPaymentMode('dual');
        }
      }
    } catch (error) {
      console.error('Failed to load ride details:', error);
      // Don't show technical error to user, just log it
    } finally {
      // Only set loading=false if this response is still relevant
      if (currentRideIdRef.current === rideId) {
        setLoading(false);
      }
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

      // Fetch initial route after getting first location
      if (rideRef.current) {
        fetchAndDrawRoute();
      }

      // Start watching location for real-time updates
      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 3000,
          distanceInterval: 5,
          pausesUpdatesAutomatically: false,
          activityType: Location.ActivityType.AutomotiveNavigation,
        },
        newLocation => {
          const newCoords = {
            latitude: newLocation.coords.latitude,
            longitude: newLocation.coords.longitude,
          };

          console.log('[ACTIVE_RIDE] 📍 Location updated:', newCoords);

          setLocation(newCoords);
          locationRef.current = newCoords; // Update immediately, don't wait for React render

          // Update heading if available
          if (newLocation.coords.heading !== null && newLocation.coords.heading !== undefined) {
            setHeading(newLocation.coords.heading);
          }

          // Only send location updates if ride is still active (not completed)
          // This prevents "Ride ID does not match active ride" errors after completion
          if (rideRef.current && rideRef.current.status !== 'completed') {
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
            console.log('[ACTIVE_RIDE] 🔄 Periodic route update');
            lastRouteUpdateRef.current = now;
            if (rideRef.current && rideRef.current.status !== 'completed') {
              fetchAndDrawRoute();
            }
          }

          // Check for route deviation and trigger immediate reroute if needed
          checkDeviationAndReroute(newCoords);
        }
      );

      locationSubscriptionRef.current = subscription;
    } catch (error) {
      console.error('Failed to get location:', error);
    }
  };

  /**
   * Check if the driver has deviated from the planned route.
   * If distance to nearest route point exceeds threshold, trigger immediate reroute.
   */
  const checkDeviationAndReroute = (coords: { latitude: number; longitude: number }) => {
    if (!rideRef.current) return;
    if (isReroutingRef.current) return;

    const polyline = routePolylineRef.current;
    if (polyline.length < 2) return;

    const now = Date.now();
    if (now - lastRerouteTimeRef.current < REROUTE_COOLDOWN) return;

    const nearestIdx = computeNearestRouteIndex(polyline, coords);
    const nearestPoint = polyline[nearestIdx];
    const distanceFromRoute = haversineDistance(coords, nearestPoint);

    if (distanceFromRoute > DEVIATION_THRESHOLD_METERS) {
      console.log(
        `[ACTIVE_RIDE] 🔀 Deviation detected: ${Math.round(distanceFromRoute)}m off route. Recalculating...`
      );
      lastRerouteTimeRef.current = now;
      lastRouteUpdateRef.current = now; // Reset 30s periodic timer
      fetchAndDrawRoute();
    }
  };

  const fetchAndDrawRoute = async () => {
    const currentLocation = locationRef.current;
    const ride = rideRef.current;
    if (!ride || !currentLocation) return;
    if (isReroutingRef.current) return;

    isReroutingRef.current = true;
    setLoadingRoute(true);

    // Determine origin and destination based on ride status
    let origin, destination;

    try {
      if (ride.status === 'accepted') {
        // Route from driver's current location to pickup
        origin = currentLocation;
        destination = ride.pickupLocation;
      } else if (ride.status === 'arrived') {
        // If passenger already paid, navigate to destination
        // If not paid yet, still navigate to pickup (waiting for payment)
        origin = currentLocation;
        destination = isPaymentConfirmed ? ride.destinationLocation : ride.pickupLocation;
      } else if (ride.status === 'in_progress') {
        // If there are multiple route points, navigate to the current active one
        const currentRoutePoints = routePoints.length > 0 ? routePoints : (ride.routePoints ?? []);
        const activePoint = currentRoutePoints.find(rp => !rp.completedAt);
        origin = currentLocation;
        if (activePoint) {
          destination = { latitude: activePoint.latitude, longitude: activePoint.longitude };
        } else {
          // All route points completed or no route points — navigate to final destination
          destination = ride.destinationLocation;
        }
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
      const routeData = await getRoute(origin, destination);

      if (routeData.coordinates && routeData.coordinates.length > 0) {
        // Append the exact destination point so the route ends at the marker position
        const routeCoords = [...routeData.coordinates, destination];
        setRouteCoordinates(routeCoords);
        routePolylineRef.current = routeCoords; // Keep for deviation checks
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
          points: routeCoords.length,
          distance: routeData.distance,
          duration: routeData.duration,
        });

        // Only fit map to route on initial setup, not on updates
        if (isInitialMapSetup && mapRef.current && routeCoords.length > 0) {
          mapRef.current.fitToCoordinates(routeCoords, {
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
      isReroutingRef.current = false;
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
        const prevStatus = rideRef.current?.status;
        const newStatus = data.status;

        // Block accepted→completed via socket for ALL flows — use button to complete
        if (prevStatus === 'accepted' && newStatus === 'completed') {
          console.warn('[ACTIVE_RIDE] ⚠️ Ignoring accepted→completed via socket — must use button');
          return;
        }

        setRide(prev => (prev ? { ...prev, status: newStatus } : null));
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

      const currentStatus = rideRef.current?.status;

      // Only accept completed event if ride is already in_progress (normal flow complete)
      // or already completed (echo from button press). Block premature completions.
      if (currentStatus !== 'in_progress' && currentStatus !== 'completed') {
        console.warn('[ACTIVE_RIDE] ⚠️ Ignoring completed event — ride not in completable state');
        return;
      }

      // Play notification sound
      playNotificationSound();

      // Store final fare
      setFinalFare(data.finalFare);

      // Update ride state to reflect completion
      setRide(prev => (prev ? { ...prev, status: 'completed' } : null));

      // Show rating modal only for non-manual rides
      if (!isManualFlow) {
        setShowRatingModal(true);
      } else {
        console.log('[ACTIVE_RIDE] Manual ride completed — navigating home');
        router.replace('/(driver)');
      }
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

      showStatus('ride_cancelled', message, 'Viaje Cancelado', undefined, {
        label: 'Entendido',
        onPress: () => router.replace('/(driver)'),
      });

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
      // ✅ Sin Alert.alert ni playNotificationSound aquí —
      // la notificación personalizada del pago ya informa al conductor
    };

    // Listen for payment confirmation
    const handlePaymentConfirmed = (data: any) => {
      console.log('[ACTIVE_RIDE] ========================================');
      console.log('[ACTIVE_RIDE] 💳 PAYMENT CONFIRMED EVENT RECEIVED');
      console.log('[ACTIVE_RIDE]    Ride ID:', data.rideId);
      console.log('[ACTIVE_RIDE]    Payment ID:', data.paymentId);
      console.log('[ACTIVE_RIDE]    Amount:', data.amount);
      console.log('[ACTIVE_RIDE] ========================================');

      // Enable the "Start Ride" button and update navigation
      setIsPaymentConfirmed(true);

      // Play notification sound
      playNotificationSound();

      // ✅ No Alert.alert aquí — la notificación personalizada se muestra
      // a través del UnifiedNotificationOverlay (useGlobalSocketListeners)
    };

    // Listen for ETA updates from backend (unified with passenger ETA)
    const handleETAUpdate = (data: {
      rideId: string;
      eta: {
        estimatedMinutes: number;
        distanceKm: number;
      };
    }) => {
      if (data.rideId !== rideId) return;
      setBackendEtaMinutes(data.eta.estimatedMinutes);
      setBackendEtaDistance(data.eta.distanceKm);
    };

    // Listen for connection events
    const handleConnect = () => {
      console.log('[ACTIVE_RIDE] ========================================');
      console.log('[ACTIVE_RIDE] ✅ SOCKET RECONNECTED');
      console.log('[ACTIVE_RIDE]    Socket ID:', socket.id);
      console.log('[ACTIVE_RIDE] ========================================');

      // Re-register payment listener and refresh ride state after reconnect
      onPaymentConfirmed(handlePaymentConfirmed);
      fetchRide();
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
    socket.on('ride:eta_update', handleETAUpdate);
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);

    console.log('[ACTIVE_RIDE] ========================================');
    console.log('[ACTIVE_RIDE] ✅ Socket listeners registered');
    console.log('[ACTIVE_RIDE]    - ride:status_changed');
    console.log('[ACTIVE_RIDE]    - ride:completed');
    console.log('[ACTIVE_RIDE]    - ride:cancelled');
    console.log('[ACTIVE_RIDE]    - ride:payment_completed');
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
      socket.off('ride:payment_completed', handlePaymentConfirmed);
      socket.off('ride:eta_update', handleETAUpdate);
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
        const rideData = response.data?.data || response.data;

        // Store final fare from response
        const fareValue = rideData.finalFare ?? ride?.estimatedFare ?? 0;
        if (fareValue > 0) {
          setFinalFare(fareValue);
        }

        // Update ride state
        setRide(prev => (prev ? { ...prev, status: 'completed' } : null));

        // Show rating modal only for non-manual rides
        if (!isManualFlow) {
          setShowRatingModal(true);
        } else {
          console.log('[ACTIVE_RIDE] Manual ride completed — navigating home');
          router.replace('/(driver)');
        }

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
          // Device doesn't support calls — show number via toast
          console.warn('Cannot make calls on this device');
          showToast(`Número del pasajero: ${ride.passengerPhone}`, 'warning', 5000);
        }
      })
      .catch(err => {
        console.error('Error making call:', err);
        showToast(`No se pudo iniciar llamada. Número: ${ride.passengerPhone}`, 'error', 5000);
      });
  };

  // Complete the current active route point and advance to the next one (Req. 6.8)
  const handleCompleteRoutePoint = async (sequence: number) => {
    if (!ride || isCompletingRoutePoint) return;

    setIsCompletingRoutePoint(true);
    try {
      const response = await api.patch(`/api/rides/${rideId}/route-points/${sequence}/complete`);
      const data = response.data.data;

      // Mark the point as completed in local state
      setRoutePoints(prev =>
        prev.map(rp => (rp.sequence === sequence ? { ...rp, completedAt: data.completedAt } : rp))
      );

      // If there's a next point, update the route destination
      if (data.nextPoint) {
        const nextPoint = data.nextPoint;
        console.log('[ACTIVE_RIDE] ➡️ Advancing to next route point:', nextPoint);

        // Trigger route recalculation to the next point
        if (location) {
          setLoadingRoute(true);
          try {
            const routeData = await getRoute(location, {
              latitude: nextPoint.latitude,
              longitude: nextPoint.longitude,
            });
            if (routeData.coordinates && routeData.coordinates.length > 0) {
              const destPoint = { latitude: nextPoint.latitude, longitude: nextPoint.longitude };
              const routeCoords = [...routeData.coordinates, destPoint];
              setRouteCoordinates(routeCoords);
              routePolylineRef.current = routeCoords;
              setRouteDistance(routeData.distance);
              setRouteDuration(routeData.duration);
              setRouteSteps(routeData.steps ?? []);
              setNearestRouteIndex(0);
              setNearestStepIndex(0);
              announcedStepIndexRef.current = -1;
            }
          } catch (routeError) {
            console.error('[ACTIVE_RIDE] Failed to fetch route to next point:', routeError);
          } finally {
            setLoadingRoute(false);
          }
        }
      } else {
        // All route points completed — no more intermediate stops
        console.log('[ACTIVE_RIDE] ✅ All route points completed');
      }
    } catch (error: any) {
      console.error('[ACTIVE_RIDE] Failed to complete route point:', error);
      const message =
        error?.response?.data?.message || 'No se pudo confirmar la parada. Intenta de nuevo.';
      showToast(message, 'error');
    } finally {
      setIsCompletingRoutePoint(false);
    }
  };

  const handleOpenExternalNav = () => {
    if (!ride) return;

    // Use the same point that the destination marker shows on the map
    let destCoords: { latitude: number; longitude: number };

    if (isNavigatingToPickup) {
      destCoords = ride.pickupLocation;
    } else if (ride.status === 'in_progress' && routePoints.length > 1) {
      const activePoint = routePoints.find(rp => !rp.completedAt);
      destCoords = activePoint
        ? { latitude: activePoint.latitude, longitude: activePoint.longitude }
        : ride.destinationLocation;
    } else {
      destCoords = ride.destinationLocation;
    }

    setNavDestCoords({ lat: destCoords.latitude, lng: destCoords.longitude });
    setShowNavChooser(true);
  };

  const openExternalNavApp = async (url: string, label: string) => {
    setShowNavChooser(false);
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
    } else {
      showToast(`${label} no está instalado`, 'warning', 3000);
    }
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

      setShowRatingModal(false);
      setIsSubmittingRating(false);

      setRouteCoordinates([]);
      setRouteSteps([]);
      showToast('Valoración enviada exitosamente.', 'success');
      setTimeout(() => router.replace('/(driver)'), 800);
    } catch (error) {
      console.error('Failed to submit rating:', error);
      setIsSubmittingRating(false);

      showToast('No se pudo enviar la valoración. Por favor, intenta de nuevo.', 'error');
    }
  };

  const handleSkipRating = () => {
    setShowRatingModal(false);
    setRouteCoordinates([]);
    setRouteSteps([]);
    setTimeout(() => router.replace('/(driver)'), 800);
  };

  // Navigation Banner — show when navigating (accepted or in_progress) and near a maneuver
  const currentStep = routeSteps.length > 0 ? routeSteps[nearestStepIndex] : null;
  const distanceToManeuver =
    currentStep?.location && location ? haversineDistance(location, currentStep.location) : null;
  const isImminent = distanceToManeuver !== null && distanceToManeuver < 50;
  // Only show banner if within 500m of a maneuver point with an actual instruction
  const showNavBanner =
    (ride?.status === 'accepted' || ride?.status === 'arrived' || ride?.status === 'in_progress') &&
    currentStep &&
    distanceToManeuver !== null &&
    distanceToManeuver <= 500 &&
    currentStep.instruction &&
    currentStep.instruction.length > 0;

  const getManeuverIcon = (type?: string): any => {
    switch (type) {
      case 'depart':
        return 'navigate-outline';
      case 'turn-left':
        return 'arrow-back';
      case 'turn-right':
        return 'arrow-forward';
      case 'turn-sharp-left':
        return 'return-up-back';
      case 'turn-sharp-right':
        return 'return-up-forward';
      case 'uturn-left':
      case 'uturn-right':
        return 'refresh';
      case 'arrive':
        return 'flag';
      default:
        return 'arrow-up';
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

  // Determine navigation target based on status + payment
  const isNavigatingToPickup =
    ride.status === 'accepted' || (ride.status === 'arrived' && !isPaymentConfirmed);

  const targetLocation = isNavigatingToPickup ? ride.pickupLocation : ride.destinationLocation;

  // Check if running in Expo Go
  const isExpoGo = Constants.appOwnership === 'expo';

  // Use scaled backend ETA (→ matches OSRM initially, decreases dynamically) or fall back to routeDistance
  const displayDistance =
    backendEtaDistance != null && distanceScaleRef.current != null
      ? backendEtaDistance * distanceScaleRef.current
      : (routeDistance ?? backendEtaDistance);
  const displayDuration =
    backendEtaMinutes != null && durationScaleRef.current != null
      ? backendEtaMinutes * durationScaleRef.current
      : (routeDuration ?? backendEtaMinutes);

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
          {/* Driver's current location */}
          {location && (
            <Marker
              coordinate={location}
              title="Tu Ubicación"
              description="Conductor"
              anchor={{ x: 0.5, y: 0.5 }}
              flat={false}
              rotation={routeBearing || heading || 0}
              tracksViewChanges={true}
            >
              <DriverTaxiIcon />
            </Marker>
          )}

          {isNavigatingToPickup && (
            <Marker
              coordinate={ride.pickupLocation}
              title="Punto de Recogida"
              description={ride.pickupAddress}
              anchor={{ x: 0.5, y: 1 }}
            >
              <PassengerIcon size={44} />
            </Marker>
          )}

          {/* Destination location marker - only visible when navigating to destination */}
          {!isNavigatingToPickup && (
            <Marker
              coordinate={
                ride.status === 'in_progress' && routePoints.length > 1
                  ? (() => {
                      const activePoint = routePoints.find(rp => !rp.completedAt);
                      return activePoint
                        ? { latitude: activePoint.latitude, longitude: activePoint.longitude }
                        : ride.destinationLocation;
                    })()
                  : ride.destinationLocation
              }
              title={
                ride.status === 'in_progress' && routePoints.length > 1
                  ? (() => {
                      const activePoint = routePoints.find(rp => !rp.completedAt);
                      return activePoint
                        ? activePoint.pointType === 'pickup'
                          ? 'Punto de Recogida'
                          : 'Destino'
                        : 'Destino';
                    })()
                  : 'Destino'
              }
              description={ride.destinationAddress}
              anchor={{ x: 0.5, y: 1 }}
            >
              <DropoffIcon size={24} />
            </Marker>
          )}

          {/* Route polyline - Different colors based on ride status */}
          {routeCoordinates.length > 0 && (
            <Polyline
              coordinates={
                routeCoordinates.length >= 2 && nearestRouteIndex > 0
                  ? routeCoordinates.slice(nearestRouteIndex)
                  : routeCoordinates
              }
              strokeColor={
                isNavigatingToPickup
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
        <View
          style={{
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
          }}
        >
          <Ionicons name="warning" size={16} color="#92400e" />
          <Text
            style={{
              fontSize: 13,
              color: '#92400e',
              marginLeft: 8,
              fontWeight: '500',
              flex: 1,
            }}
          >
            ⚠️ Ruta aproximada — sin conexión al servidor de rutas
          </Text>
        </View>
      )}

      {/* GPS Permission Denied Banner */}
      {gpsPermissionDenied &&
        (ride.status === 'accepted' ||
          ride.status === 'arrived' ||
          ride.status === 'in_progress') && (
          <View
            style={{
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
            }}
          >
            <Ionicons name="location-outline" size={16} color="#991b1b" />
            <Text
              style={{
                fontSize: 13,
                color: '#991b1b',
                marginLeft: 8,
                fontWeight: '500',
                flex: 1,
              }}
            >
              GPS desactivado — la distancia real no se registrará
            </Text>
          </View>
        )}

      {/* GPS Active Indicator */}
      {isGpsTracking && (
        <View
          style={{
            position: 'absolute',
            top: insets.top + 4,
            right: 12,
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: 'rgba(0,0,0,0.5)',
            borderRadius: 10,
            paddingHorizontal: 8,
            paddingVertical: 4,
            zIndex: 101,
          }}
        >
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: '#22c55e',
              marginRight: 5,
            }}
          />
          <Text style={{ color: '#fff', fontSize: 11, fontWeight: '600' }}>GPS</Text>
        </View>
      )}

      {/* Navigation Banner — auto-show/hide based on maneuver proximity, during accepted & in_progress */}
      {showNavBanner && (
        <View
          style={{
            position: 'absolute',
            top: 110,
            alignSelf: 'center',
            backgroundColor: isImminent ? '#1a56db' : 'rgba(15, 23, 42, 0.85)',
            borderRadius: 10,
            paddingVertical: 8,
            paddingHorizontal: 12,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            zIndex: 90,
            marginHorizontal: 16,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.25,
            shadowRadius: 4,
            elevation: 6,
          }}
        >
          <View
            style={{
              width: 30,
              height: 30,
              borderRadius: 15,
              backgroundColor: isImminent ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Ionicons name={getManeuverIcon(currentStep.maneuver?.type)} size={16} color="#fff" />
          </View>
          <Text
            style={{
              color: '#fff',
              fontSize: 13,
              fontWeight: '600',
              flexShrink: 1,
            }}
            numberOfLines={1}
          >
            {currentStep.instruction}
          </Text>
          {distanceToManeuver !== null && (
            <Text
              style={{
                color: isImminent ? '#fbbf24' : 'rgba(255,255,255,0.8)',
                fontSize: 12,
                fontWeight: '700',
                minWidth: 36,
                textAlign: 'right',
              }}
            >
              {formatDistance(distanceToManeuver)}
            </Text>
          )}
        </View>
      )}

      {/* Recenter Button — visible when user has manually interacted with map */}
      {userInteractedWithMap && ride.status !== 'completed' && (
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
            bottom: isPanelCollapsed ? 70 : '68%',
            right: 16,
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: '#fff',
            justifyContent: 'center',
            alignItems: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.25,
            shadowRadius: 4,
            elevation: 8,
            zIndex: 10,
          }}
          activeOpacity={0.8}
        >
          <Ionicons name="locate" size={22} color={colors.primary} />
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
      {displayDistance != null && displayDuration != null && !loadingRoute && (
        <View
          style={{
            position: 'absolute',
            top: 60,
            alignSelf: 'center',
            backgroundColor:
              ride.status === 'accepted' || (ride.status === 'arrived' && !isPaymentConfirmed)
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
              {displayDistance.toFixed(1)} km
            </Text>
          </View>
          <View style={{ width: 1, height: 20, backgroundColor: 'rgba(255,255,255,0.3)' }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="time" size={18} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>
              {Math.round(displayDuration)} min
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
          zIndex: 20,
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
                  ride.status === 'accepted' || (ride.status === 'arrived' && !isPaymentConfirmed)
                    ? '#FFF4E6'
                    : '#E8F5E9',
                padding: 14,
                borderRadius: 16,
                marginBottom: 20,
                gap: 12,
              }}
            >
              <View
                style={{
                  backgroundColor:
                    ride.status === 'accepted' || (ride.status === 'arrived' && !isPaymentConfirmed)
                      ? '#FF8C00'
                      : '#22c55e',
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Ionicons
                  name={
                    ride.status === 'accepted' || (ride.status === 'arrived' && !isPaymentConfirmed)
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
                  {(() => {
                    // Lógica de título según estado + pago
                    if (ride.status === 'completed') return 'Viaje Completado';
                    if (ride.status === 'in_progress') {
                      if (routePoints.length > 1) {
                        const activePoint = routePoints.find(rp => !rp.completedAt);
                        if (activePoint) {
                          return activePoint.pointType === 'pickup'
                            ? 'Navegando al Punto de Recogida'
                            : 'Navegando al Destino';
                        }
                      }
                      return 'Navegando al Destino';
                    }
                    if (ride.status === 'accepted') return 'Navegando al Punto de Recogida';
                    // arrived: si ya pagó → destino, si no → recogida
                    if (ride.status === 'arrived') {
                      return isPaymentConfirmed
                        ? 'Navegando al Punto de Destino'
                        : 'Navegando al Punto de Recogida';
                    }
                    return 'Navegando al Punto de Recogida';
                  })()}
                </Text>
                {displayDistance != null && displayDuration != null && (
                  <Text style={{ fontSize: 14, color: colors.lightGray }}>
                    {displayDistance.toFixed(1)} km • {Math.round(displayDuration)} min restantes
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
              {/* Delegated Ride Badge (Req. 9.6) */}
              {ride.isDelegated && (
                <View
                  style={{
                    backgroundColor: '#EEF2FF',
                    borderRadius: 8,
                    padding: 10,
                    marginBottom: 12,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    borderWidth: 1,
                    borderColor: '#C7D2FE',
                  }}
                >
                  <Ionicons name="gift-outline" size={18} color="#6366F1" />
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: '600',
                      color: '#6366F1',
                      flex: 1,
                    }}
                  >
                    Viaje Delegado - Contacta al beneficiario
                  </Text>
                </View>
              )}

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
                  {ride.passengerProfilePicture && !ride.isDelegated ? (
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
                  {ride.isDelegated && (
                    <Text
                      style={{
                        fontSize: 12,
                        color: '#6366F1',
                        fontWeight: '600',
                        marginBottom: 4,
                      }}
                    >
                      Beneficiario (no registrado)
                    </Text>
                  )}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="call-outline" size={16} color={colors.lightGray} />
                    <Text style={{ fontSize: 14, color: colors.lightGray }}>
                      {ride.passengerPhone}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Call Button - Disabled for delegated rides (street passengers) and when ride is in progress */}
              <TouchableOpacity
                onPress={handleCallPassenger}
                disabled={ride.isDelegated || ride.status === 'in_progress'}
                style={{
                  backgroundColor:
                    ride.isDelegated || ride.status === 'in_progress' ? '#D1D5DB' : colors.primary,
                  paddingVertical: 14,
                  borderRadius: 12,
                  flexDirection: 'row',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: 8,
                  opacity: ride.isDelegated || ride.status === 'in_progress' ? 0.5 : 1,
                }}
              >
                <Ionicons name="call" size={20} color="#fff" />
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>
                  {ride.status === 'in_progress'
                    ? ride.isDelegated
                      ? 'Beneficiario en el Vehículo'
                      : 'Pasajero en el Vehículo'
                    : ride.isDelegated
                      ? 'Llamar al Beneficiario'
                      : 'Llamar al Pasajero'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Route Points Sequence — shown during in_progress when multiple stops exist (Req. 6.8) */}
            {ride.status === 'in_progress' &&
              routePoints.length > 1 &&
              (() => {
                const activePoint = routePoints.find(rp => !rp.completedAt) ?? null;
                const completedCount = routePoints.filter(rp => rp.completedAt).length;
                return (
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
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: 14,
                      }}
                    >
                      <Text style={{ fontSize: 15, fontWeight: 'bold', color: colors.darkGray }}>
                        Puntos de Ruta
                      </Text>
                      <Text style={{ fontSize: 13, color: colors.lightGray }}>
                        {completedCount}/{routePoints.length} completados
                      </Text>
                    </View>

                    {routePoints.map((rp, index) => {
                      const isCompleted = !!rp.completedAt;
                      const isActive = !isCompleted && rp === activePoint;

                      return (
                        <View
                          key={rp.id}
                          style={{
                            flexDirection: 'row',
                            marginBottom: index < routePoints.length - 1 ? 12 : 0,
                          }}
                        >
                          {/* Sequence indicator */}
                          <View style={{ alignItems: 'center', marginRight: 12, width: 32 }}>
                            <View
                              style={{
                                width: 32,
                                height: 32,
                                borderRadius: 16,
                                backgroundColor: isCompleted
                                  ? '#22c55e'
                                  : isActive
                                    ? rp.pointType === 'pickup'
                                      ? '#FF8C00'
                                      : colors.primary
                                    : '#E5E7EB',
                                justifyContent: 'center',
                                alignItems: 'center',
                              }}
                            >
                              {isCompleted ? (
                                <Ionicons name="checkmark" size={18} color="#fff" />
                              ) : (
                                <Ionicons
                                  name={rp.pointType === 'pickup' ? 'person' : 'flag'}
                                  size={16}
                                  color={isActive ? '#fff' : '#9CA3AF'}
                                />
                              )}
                            </View>
                            {/* Connector line */}
                            {index < routePoints.length - 1 && (
                              <View
                                style={{
                                  width: 2,
                                  flex: 1,
                                  minHeight: 12,
                                  backgroundColor: isCompleted ? '#22c55e' : '#E5E7EB',
                                  marginTop: 4,
                                }}
                              />
                            )}
                          </View>

                          {/* Point info */}
                          <View style={{ flex: 1, paddingTop: 4 }}>
                            <View
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 6,
                                marginBottom: 2,
                              }}
                            >
                              <Text
                                style={{
                                  fontSize: 12,
                                  fontWeight: '600',
                                  color: isCompleted
                                    ? '#22c55e'
                                    : isActive
                                      ? rp.pointType === 'pickup'
                                        ? '#FF8C00'
                                        : colors.primary
                                      : '#9CA3AF',
                                  textTransform: 'uppercase',
                                  letterSpacing: 0.5,
                                }}
                              >
                                {rp.pointType === 'pickup' ? 'Recogida' : 'Destino'}{' '}
                                {rp.sequence + 1}
                              </Text>
                              {isActive && (
                                <View
                                  style={{
                                    backgroundColor:
                                      rp.pointType === 'pickup' ? '#FFF4E6' : '#EEF2FF',
                                    paddingHorizontal: 6,
                                    paddingVertical: 2,
                                    borderRadius: 6,
                                  }}
                                >
                                  <Text
                                    style={{
                                      fontSize: 10,
                                      fontWeight: '700',
                                      color: rp.pointType === 'pickup' ? '#FF8C00' : colors.primary,
                                    }}
                                  >
                                    ACTIVO
                                  </Text>
                                </View>
                              )}
                              {isCompleted && (
                                <Text style={{ fontSize: 11, color: '#22c55e' }}>✓ Completado</Text>
                              )}
                            </View>
                            <Text
                              style={{
                                fontSize: 14,
                                color: isCompleted ? '#9CA3AF' : colors.darkGray,
                                lineHeight: 18,
                                textDecorationLine: isCompleted ? 'line-through' : 'none',
                              }}
                              numberOfLines={2}
                            >
                              {rp.address}
                            </Text>
                          </View>
                        </View>
                      );
                    })}

                    {/* Confirm current stop button */}
                    {activePoint && (
                      <TouchableOpacity
                        onPress={() => handleCompleteRoutePoint(activePoint.sequence)}
                        disabled={isCompletingRoutePoint}
                        style={{
                          backgroundColor: isCompletingRoutePoint
                            ? '#D1D5DB'
                            : activePoint.pointType === 'pickup'
                              ? '#FF8C00'
                              : colors.primary,
                          paddingVertical: 12,
                          borderRadius: 12,
                          flexDirection: 'row',
                          justifyContent: 'center',
                          alignItems: 'center',
                          gap: 8,
                          marginTop: 14,
                          opacity: isCompletingRoutePoint ? 0.7 : 1,
                        }}
                      >
                        {isCompletingRoutePoint ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Ionicons name="checkmark-circle" size={20} color="#fff" />
                        )}
                        <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600' }}>
                          {isCompletingRoutePoint
                            ? 'Confirmando...'
                            : activePoint.pointType === 'pickup'
                              ? 'Confirmar Recogida'
                              : 'Confirmar Entrega'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })()}

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
                <View style={{ alignItems: 'flex-end' }}>
                  <Text
                    style={{
                      fontSize: 20,
                      fontWeight: 'bold',
                      color: colors.primary,
                    }}
                  >
                    {formatCurrency(ride.estimatedFare, ride.currency || 'VES')}
                  </Text>
                  <Text style={{ fontSize: 13, color: '#16a34a', fontWeight: '600' }}>
                    {ride.currency === 'USD'
                      ? `Bs. ${convertToBs(ride.estimatedFare)}`
                      : `$ ${convertToUsd(ride.estimatedFare)}`}
                  </Text>
                </View>
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
                  name={
                    passengerPaymentMode === 'pago_movil'
                      ? 'phone-portrait-outline'
                      : 'cash-outline'
                  }
                  size={16}
                  color={passengerPaymentMode === 'pago_movil' ? '#3b82f6' : colors.mediumGray}
                />
                <Text
                  style={{
                    fontSize: 13,
                    color: passengerPaymentMode === 'pago_movil' ? '#3b82f6' : colors.mediumGray,
                    fontWeight: '500',
                  }}
                >
                  {passengerPaymentMode === 'pago_movil' ? 'Pago Móvil' : 'Efectivo'}
                </Text>
              </View>
            </View>

            {/* Action Button */}
            {ride.status === 'accepted' && (
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
                <TouchableOpacity
                  onPress={() => updateRideStatus('arrived')}
                  style={{
                    flex: 2,
                    backgroundColor: colors.primary,
                    paddingVertical: 12,
                    borderRadius: 10,
                    alignItems: 'center',
                    shadowColor: colors.primary,
                    shadowOffset: { width: 0, height: 3 },
                    shadowOpacity: 0.25,
                    shadowRadius: 6,
                    elevation: 3,
                  }}
                >
                  <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>He Llegado</Text>
                </TouchableOpacity>
                {(ride.status === 'accepted' ||
                  ride.status === 'in_progress' ||
                  (ride.status === 'arrived' && isPaymentConfirmed)) && (
                  <TouchableOpacity
                    onPress={handleOpenExternalNav}
                    style={{
                      flex: 1,
                      backgroundColor: '#F3F4F6',
                      paddingVertical: 12,
                      borderRadius: 10,
                      justifyContent: 'center',
                      alignItems: 'center',
                      flexDirection: 'row',
                      gap: 6,
                    }}
                  >
                    <Ionicons name="navigate-outline" size={16} color={colors.darkGray} />
                    <Text style={{ color: colors.darkGray, fontSize: 13, fontWeight: '600' }}>
                      Waze
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {ride.status === 'arrived' && (
              <>
                {/* Payment message: different for cash vs mobile */}
                {passengerPaymentMode !== 'pago_movil' ? (
                  <View style={{ backgroundColor: '#f0fdf4', padding: 14, borderRadius: 12, marginBottom: 14, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Ionicons name="cash-outline" size={20} color="#16a34a" />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: '#16a34a', marginBottom: 2 }}>
                        Cobrar en efectivo
                      </Text>
                      <Text style={{ fontSize: 12, color: '#4b5563' }}>
                        {formatCurrency(Number(ride.estimatedFare), ride.currency)} — Si el pasajero no paga, cancela el viaje.
                      </Text>
                    </View>
                  </View>
                ) : !isPaymentConfirmed ? (
                  <View style={{ backgroundColor: '#FFF4E6', padding: 16, borderRadius: 12, marginBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <ActivityIndicator size="small" color="#FF8C00" />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: '600', color: '#FF8C00', marginBottom: 4 }}>
                        Esperando confirmación de pago
                      </Text>
                      <Text style={{ fontSize: 13, color: '#666' }}>
                        El pasajero debe confirmar el pago antes de iniciar el viaje
                      </Text>
                    </View>
                  </View>
                ) : null}

                {/* Buttons row */}
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity
                    onPress={() => updateRideStatus('in_progress')}
                    disabled={passengerPaymentMode === 'pago_movil' && !isPaymentConfirmed}
                    style={{
                      flex: 2,
                      backgroundColor: (passengerPaymentMode !== 'pago_movil' || isPaymentConfirmed) ? colors.primary : '#D1D5DB',
                      paddingVertical: 12,
                      borderRadius: 10,
                      alignItems: 'center',
                      opacity: (passengerPaymentMode !== 'pago_movil' || isPaymentConfirmed) ? 1 : 0.6,
                      flexDirection: 'row',
                      justifyContent: 'center',
                      gap: 6,
                    }}
                  >
                    <Ionicons name={(passengerPaymentMode !== 'pago_movil' || isPaymentConfirmed) ? 'play-circle' : 'time-outline'} size={18} color="#fff" />
                    <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>
                      {(passengerPaymentMode !== 'pago_movil' || isPaymentConfirmed) ? 'Iniciar' : 'Esperando Pago'}
                    </Text>
                  </TouchableOpacity>

                  {/* Cancel button — only for cash payments */}
                  {passengerPaymentMode !== 'pago_movil' && (
                    <TouchableOpacity
                      onPress={async () => {
                        try {
                          await api.post(`/api/rides/${rideId}/cancel`, { reason: 'Pasajero no pagó en efectivo' });
                          router.back();
                        } catch (e) { /* ignore */ }
                      }}
                      style={{
                        flex: 1,
                        backgroundColor: '#fff',
                        paddingVertical: 12,
                        borderRadius: 10,
                        alignItems: 'center',
                        borderWidth: 1,
                        borderColor: '#fecaca',
                      }}
                    >
                      <Text style={{ color: '#ef4444', fontSize: 14, fontWeight: '600' }}>Cancelar</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </>
            )}

            {ride.status === 'in_progress' && (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  onPress={() => updateRideStatus('completed')}
                  style={{
                    flex: 2,
                    backgroundColor: colors.primary,
                    paddingVertical: 12,
                    borderRadius: 10,
                    alignItems: 'center',
                    flexDirection: 'row',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                >
                  <Ionicons name="checkmark-circle" size={18} color="#fff" />
                  <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>He Llegado</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleOpenExternalNav}
                  style={{
                    flex: 1,
                    backgroundColor: '#F3F4F6',
                    paddingVertical: 12,
                    borderRadius: 10,
                    justifyContent: 'center',
                    alignItems: 'center',
                    flexDirection: 'row',
                    gap: 6,
                  }}
                >
                  <Ionicons name="navigate-outline" size={16} color={colors.darkGray} />
                  <Text style={{ color: colors.darkGray, fontSize: 13, fontWeight: '600' }}>
                    Waze
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        )}
      </View>

      {/* Navigation App Chooser Modal */}
      <Modal
        visible={showNavChooser}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowNavChooser(false)}
      >
        <TouchableOpacity
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'center',
            alignItems: 'center',
          }}
          activeOpacity={1}
          onPress={() => setShowNavChooser(false)}
        >
          <View
            style={{
              backgroundColor: '#fff',
              borderRadius: 20,
              padding: 24,
              width: '85%',
              maxWidth: 340,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.2,
              shadowRadius: 16,
              elevation: 10,
            }}
          >
            <Text
              style={{
                fontSize: 18,
                fontWeight: 'bold',
                color: colors.darkGray,
                textAlign: 'center',
                marginBottom: 8,
              }}
            >
              Abrir en app de navegación
            </Text>
            <Text
              style={{
                fontSize: 13,
                color: colors.lightGray,
                textAlign: 'center',
                marginBottom: 20,
              }}
            >
              Selecciona tu app favorita
            </Text>

            {[
              {
                label: 'Waze',
                icon: 'navigate-circle',
                color: '#33CCFF',
                url: navDestCoords
                  ? `https://waze.com/ul?ll=${navDestCoords.lat},${navDestCoords.lng}&navigate=yes`
                  : '',
              },
              {
                label: 'Google Maps',
                icon: 'navigate',
                color: '#4285F4',
                url: navDestCoords
                  ? Platform.OS === 'ios'
                    ? `comgooglemaps://?daddr=${navDestCoords.lat},${navDestCoords.lng}&directionsmode=driving`
                    : `geo:${navDestCoords.lat},${navDestCoords.lng}?q=${navDestCoords.lat},${navDestCoords.lng}`
                  : '',
              },
              ...(Platform.OS === 'ios'
                ? [
                    {
                      label: 'Apple Maps',
                      icon: 'navigate',
                      color: '#000',
                      url: navDestCoords
                        ? `http://maps.apple.com/?daddr=${navDestCoords.lat},${navDestCoords.lng}&dirctionsmode=driving`
                        : '',
                    },
                  ]
                : []),
            ].map((app, i) => (
              <TouchableOpacity
                key={app.label}
                onPress={() => openExternalNavApp(app.url, app.label)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: '#F9FAFB',
                  padding: 14,
                  borderRadius: 14,
                  marginBottom: i < 2 ? 10 : 0,
                  borderWidth: 1,
                  borderColor: '#E5E7EB',
                }}
                activeOpacity={0.7}
              >
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: app.color,
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginRight: 14,
                  }}
                >
                  <Ionicons name={app.icon as any} size={22} color="#fff" />
                </View>
                <Text style={{ fontSize: 16, fontWeight: '600', color: colors.darkGray }}>
                  {app.label}
                </Text>
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              onPress={() => setShowNavChooser(false)}
              style={{
                marginTop: 16,
                paddingVertical: 12,
                borderRadius: 12,
                backgroundColor: '#F3F4F6',
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 15, fontWeight: '600', color: colors.lightGray }}>
                Cancelar
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

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
                  paddingVertical: 12,
                  paddingHorizontal: 8,
                  borderRadius: 12,
                  backgroundColor: '#F3F4F6',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onPress={handleSkipRating}
                disabled={isSubmittingRating}
              >
                <Text
                  style={{ fontSize: 14, fontWeight: '600', color: colors.lightGray }}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                >
                  Omitir
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  paddingHorizontal: 8,
                  borderRadius: 12,
                  backgroundColor:
                    passengerRating === 0 || isSubmittingRating ? '#D1D5DB' : colors.primary,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onPress={handleSubmitRating}
                disabled={passengerRating === 0 || isSubmittingRating}
              >
                {isSubmittingRating ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text
                    style={{ fontSize: 14, fontWeight: '600', color: '#fff' }}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                  >
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
