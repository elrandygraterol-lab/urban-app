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
import { useDriverStore } from '@/store/driverStore';
import Constants from 'expo-constants';
import api from '@/services/api';
import { rideAPI } from '@/services/api';
import { getRoute } from '@/services/mapsService';
import { getSocket, onPaymentConfirmed } from '@/services/socket';
import { useSound } from '@/hooks/useSound';
import { Colors as colors } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { formatCurrency, Currency } from '@/utils/currency';
import { DriverTaxiIcon, PassengerIcon, DropoffIcon } from '@/src/components/map/markers';
import {
  computeBearing,
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
  passengerRating?: number;
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
    paymentMode?: 'cash' | 'pago_movil' | 'dual' | null;
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
  const { setIsAvailable } = useDriverStore();
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
  // Track programmatic camera moves so onRegionChangeComplete doesn't flag them as user interaction
  const isProgrammaticMoveRef = useRef(false);

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
  const prevDriverPosRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const [driverHeading, setDriverHeading] = useState<number>(0);

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
  const [passengerPaymentMode, setPassengerPaymentMode] = useState<'cash' | 'pago_movil' | 'dual' | null>(
    null
  );

  // Route points state (Req. 6.8)
  const [routePoints, setRoutePoints] = useState<RoutePoint[]>([]);
  const [isCompletingRoutePoint, setIsCompletingRoutePoint] = useState(false);

  // Rating modal states
  const [showRatingModal, setShowRatingModal] = useState(false);
  const ratingShownForRideRef = useRef<string | null>(null);
  const [passengerRating, setPassengerRating] = useState(0);
  const [passengerComment, setPassengerComment] = useState('');
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);
  const [finalFare, setFinalFare] = useState<number | null>(null);

  // Call modal state
  const [showCallModal, setShowCallModal] = useState(false);

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
    rideRef.current = null; // Immediately clear ref to stop stale location emissions
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

  // Fetch and draw route ONLY when ride status or payment changes (NOT on every location update).
  // Location-based route updates are handled separately by the periodic update (every 30s)
  // and deviation detection in the watchPositionAsync callback.
  useEffect(() => {
    if (ride && location) {
      // Reset map interaction state only on status/payment change, not on location change
      setUserInteractedWithMap(false);
      setIsInitialMapSetup(true);
      // Reset rerouting flag to ensure fetchAndDrawRoute runs on status change
      isReroutingRef.current = false;
      fetchAndDrawRoute();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ride?.status, isPaymentConfirmed]);

  // Wait for payment confirmation while at pickup (arrived, not yet paid)
  // The passenger must complete payment via the payment form (shown 3s after ride acceptance).
  // Payment confirmation arrives via the 'ride:payment_completed' socket event for ALL methods
  // (cash and pago_movil). The driver should NOT auto-confirm — the passenger must explicitly pay.
  useEffect(() => {
    if (ride?.status !== 'arrived' || isPaymentConfirmed) return;
    // No auto-confirm for any payment mode.
    // pago_movil → ride:payment_completed socket event
    // cash → ride:payment_completed socket event (passenger confirms via payment form)
    // null → ride:payment_method_changed + ride:payment_completed socket events
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

  // Resume route tracking when app returns from background (e.g., after external nav in Waze/Google Maps)
  useEffect(() => {
    const sub = AppState.addEventListener('change', nextState => {
      if (nextState !== 'active') return;
      if (!rideRef.current && !ride) return; // No active ride at all

      console.log('[ACTIVE_RIDE] App returned to foreground — full recovery starting...');

      // Reset map interaction state so the camera re-centers on the driver
      setUserInteractedWithMap(false);
      setIsInitialMapSetup(true);

      // Reset throttle so route updates immediately after restore
      lastRouteUpdateRef.current = 0;
      isReroutingRef.current = false;

      // Re-join the ride room via socket to receive real-time updates again
      const currentRideId = rideRef.current?.id || ride?.id;
      if (currentRideId) {
        const socket = getSocket();
        if (socket) {
          // Force reconnect if socket is not connected
          if (!socket.connected) {
            console.log('[ACTIVE_RIDE] Socket not connected — reconnecting...');
            socket.connect();
          }
          // Always emit join_ride — works even if socket just reconnected
          socket.emit('join_ride', { rideId: currentRideId });
          console.log('[ACTIVE_RIDE] Re-joined ride room after foreground:', currentRideId);
        }
      }

      // Re-fetch ride data to get latest status (might have changed while in background)
      fetchRide().then(() => {
        // Check if GPS subscription is still alive
        if (locationSubscriptionRef.current) {
          // Subscription alive — get fresh position and redraw route
          if (locationRef.current) {
            fetchAndDrawRoute();
          } else {
            // Ref lost but subscription alive — request fresh position
            Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.BestForNavigation })
              .then(pos => {
                const coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
                setLocation(coords);
                locationRef.current = coords;
                fetchAndDrawRoute();
              })
              .catch(() => console.log('[ACTIVE_RIDE] Failed to get fresh location after foreground'));
          }
        } else {
          // GPS subscription was lost while in background — re-initialize everything
          console.log('[ACTIVE_RIDE] GPS subscription lost — re-initializing location...');
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.BestForNavigation })
            .then(pos => {
              const coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
              setLocation(coords);
              locationRef.current = coords;
              // Re-start the watchPositionAsync subscription
              initializeLocation();
            })
            .catch(() => console.log('[ACTIVE_RIDE] Failed to get fresh location after foreground'));
        }
      });
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // State to track if user has manually interacted with map
  const [userInteractedWithMap, setUserInteractedWithMap] = useState(false);
  const [isInitialMapSetup, setIsInitialMapSetup] = useState(true);

  // GPS tracking: smoothly follow driver on map during navigation
  // Only follows when the user has NOT manually interacted with the map.
  useEffect(() => {
    if (location && mapRef.current && ride && !userInteractedWithMap) {
      if (
        ride.status === 'accepted' ||
        ride.status === 'arrived' ||
        ride.status === 'in_progress'
      ) {
        isProgrammaticMoveRef.current = true;
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
      setRouteBearing(0); // Default to north — device heading is unreliable
      return;
    }
    const brng = bearingAlongRoute(routeCoordinates, location);
    setRouteBearing(brng);
  }, [location, routeCoordinates]);

  // Update nearest step and route index when location changes
  useEffect(() => {
    if (!location) return;

    if (routeSteps.length > 0) {
      const stepIdx = computeNearestStepIndex(routeSteps, location, Math.max(0, announcedStepIndexRef.current));
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

      // Check if ride was cancelled while app was in background
      if (rideData?.status === 'cancelled') {
        console.log('[ACTIVE_RIDE] ⚠️ Ride was cancelled while app was in background');
        setIsAvailable(true);
        setRide(null);
        rideRef.current = null;
        showStatus('ride_cancelled', 'El viaje fue cancelado mientras estabas fuera de la app.', 'Viaje Cancelado');
        setTimeout(() => router.replace('/(driver)'), 3000);
        return;
      }

      setRide(rideData);
      // Update ref immediately so initializeLocation() can use it without waiting for re-render
      rideRef.current = rideData;

      // If ride was completed while in background (recovery, not first mount), trigger completion flow
      if (!isFirstFetchRef.current && rideData?.status === 'completed') {
        console.log('[ACTIVE_RIDE] ⚠️ Ride was completed while app was in background — showing rating');
        playNotificationSound();
        const fareValue = rideData.finalFare ?? rideData.estimatedFare ?? 0;
        if (fareValue > 0) {
          setFinalFare(fareValue);
        }
        if (!isManualFlow) {
          setShowRatingModal(true);
        } else {
          setIsAvailable(true);
          setTimeout(() => router.replace('/(driver)'), 800);
        }
        return;
      }

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
        if (rideData.payment.paymentMode) {
          setPassengerPaymentMode(rideData.payment.paymentMode);
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
      // Clean up any existing subscription before creating a new one
      if (locationSubscriptionRef.current) {
        locationSubscriptionRef.current.remove();
        locationSubscriptionRef.current = null;
      }

      // Get initial location
      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.BestForNavigation,
      });
      const coords = {
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
      };
      setLocation(coords);
      locationRef.current = coords; // Update ref immediately for fetchAndDrawRoute

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
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 2000,
          distanceInterval: 3,
          pausesUpdatesAutomatically: false,
          activityType: Location.ActivityType.AutomotiveNavigation,
        } as any,
        newLocation => {
          const newCoords = {
            latitude: newLocation.coords.latitude,
            longitude: newLocation.coords.longitude,
          };

          console.log('[ACTIVE_RIDE] 📍 Location updated:', newCoords);

          setLocation(newCoords);
          locationRef.current = newCoords; // Update immediately, don't wait for React render

          // Compute driver heading from actual movement (not device compass)
          if (prevDriverPosRef.current) {
            const prev = prevDriverPosRef.current;
            if (prev.latitude !== newCoords.latitude || prev.longitude !== newCoords.longitude) {
              const brng = computeBearing(prev, newCoords);
              setDriverHeading(brng);
            }
          }
          prevDriverPosRef.current = newCoords;

          // Update heading if available
          if (newLocation.coords.heading !== null && newLocation.coords.heading !== undefined) {
            setHeading(newLocation.coords.heading);
          }

          // Only send location updates if ride is still active (not completed)
          // and the current rideRef matches the component's rideId (prevents stale emissions)
          if (rideRef.current && rideRef.current.status !== 'completed' && rideRef.current.id === rideId) {
            const socket = getSocket();
            if (socket && socket.connected) {
              socket.emit('driver:location_update', {
                rideId: rideRef.current.id,
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
            const currentRide = rideRef.current;
            if (currentRide && currentRide.status !== 'completed' && currentRide.status !== 'arrived') {
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
      if (ride.status === 'arrived') {
        // Driver has arrived at pickup — no route should be drawn
        // Route only appears when ride starts (in_progress)
        setRouteCoordinates([]);
        routePolylineRef.current = [];
        setRouteDistance(null);
        setRouteDuration(null);
        setRouteSteps([]);
        setLoadingRoute(false);
        isReroutingRef.current = false;
        return;
      }

      if (ride.status === 'accepted') {
        // Route from driver's current location to pickup
        origin = currentLocation;
        destination = ride.pickupLocation;
      } else if (ride.status === 'in_progress') {
        // Navigate to destination. If there are multiple route points, find the
        // active DESTINATION point (skip pickup points — passenger has already boarded).
        const currentRoutePoints = routePoints.length > 0 ? routePoints : (ride.routePoints ?? []);
        const activeDestPoint = currentRoutePoints.find(
          rp => !rp.completedAt && rp.pointType === 'destination'
        );
        origin = currentLocation;
        if (activeDestPoint) {
          destination = { latitude: activeDestPoint.latitude, longitude: activeDestPoint.longitude };
        } else {
          // No uncompleted destination route points — navigate to final destination
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
        // OSRM already includes the destination as the last coordinate
        const routeCoords = routeData.coordinates;
        setRouteCoordinates(routeCoords);
        routePolylineRef.current = routeCoords; // Keep for deviation checks
        setRouteDistance(routeData.distance);
        setRouteDuration(routeData.duration);
        setIsApproximateRoute(false);

        // Reset backend ETA and scale refs so display uses the fresh route values
        // until the next socket ETA update arrives and recalibrates
        setBackendEtaDistance(null);
        setBackendEtaMinutes(null);
        distanceScaleRef.current = null;
        durationScaleRef.current = null;

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
          isProgrammaticMoveRef.current = true;
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

      // Guard: skip if rating was already shown for this ride
      if (ratingShownForRideRef.current === data.rideId) {
        console.log('[ACTIVE_RIDE] Rating already shown for this ride — skipping duplicate');
        return;
      }
      ratingShownForRideRef.current = data.rideId;

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

      // Build cancellation message based on who cancelled and why
      let message: string;
      if (data.cancellationReason === 'payment_timeout' || data.cancellationReason?.includes('timeout') || data.cancelledBy === 'system') {
        message = 'El tiempo de pago se ha agotado.\nEl pasajero no completó el pago a tiempo.';
      } else if (data.cancelledBy === 'driver') {
        message = 'Has cancelado el viaje.';
      } else {
        message = 'El pasajero ha cancelado el viaje.';
      }

      if (data.cancellationReason && data.cancellationReason !== 'payment_timeout') {
        message += `\n\nMotivo: ${data.cancellationReason}`;
      }

      // Add compensation information if applicable
      if (data.cancellationFee > 0) {
        message += `\n\nCompensación recibida: Bs. ${data.cancellationFee.toFixed(2)}`;
      }

      // Restore driver availability
      setIsAvailable(true);
      setRide(null);

      showStatus('ride_cancelled', message, 'Viaje Cancelado');

      // Auto-redirect to home after notification shows
      setTimeout(() => router.replace('/(driver)'), 3000);
    };

    // Listen for payment method change by passenger (Req. 3.4)
    const handlePaymentMethodChanged = (data: {
      rideId: string;
      newMethod: 'pago_movil' | 'cash' | 'bank_transfer';
      pagoMovilReference: string;
      changedAt: string;
    }) => {
      if (data.rideId !== rideId) return;

      console.log('[ACTIVE_RIDE] 💳 PAYMENT METHOD CHANGED:', data);

      // Map backend method names to frontend payment mode
      if (data.newMethod === 'cash') {
        setPassengerPaymentMode('cash');
      } else if (data.newMethod === 'pago_movil' || data.newMethod === 'bank_transfer') {
        setPassengerPaymentMode('pago_movil');
      }
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

      // Update payment mode if provided in the event (backend may send paymentMode)
      if (data.paymentMode) {
        setPassengerPaymentMode(data.paymentMode);
      }

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

      // Re-join the ride room to receive real-time updates
      const currentRideId = rideRef.current?.id;
      if (currentRideId) {
        socket.emit('join_ride', { rideId: currentRideId });
        console.log('[ACTIVE_RIDE] Re-joined ride room:', currentRideId);
      }

      // Reset throttles so route updates immediately after reconnect
      lastRouteUpdateRef.current = 0;
      isReroutingRef.current = false;

      // Re-register payment listener and refresh ride state after reconnect
      onPaymentConfirmed(handlePaymentConfirmed);
      fetchRide().then(() => {
        if (locationRef.current) {
          fetchAndDrawRoute();
        }
      });
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

  const [isCancelling, setIsCancelling] = useState(false);
  const [showCancelReasonModal, setShowCancelReasonModal] = useState(false);
  const [cancelReason, setCancelReason] = useState<string>('');

  const DRIVER_CANCEL_REASONS = [
    'Pasajero no apareció',
    'Pasajero no pagó',
    'Problema con el vehículo',
    'Tráfico intenso',
    'Otra razón',
  ];

  const handleCancelRide = async () => {
    if (!ride || isCancelling) return;

    // Block cancellation for pago_movil if passenger already paid
    if (isPaymentConfirmed && passengerPaymentMode === 'pago_movil') {
      showToast('No puedes cancelar: el pasajero ya realizó el pago móvil', 'warning');
      return;
    }

    // Open the cancel reason modal instead of cancelling directly
    setShowCancelReasonModal(true);
  };

  const handleConfirmCancelRide = async () => {
    if (!ride || isCancelling) return;
    if (!cancelReason.trim()) {
      showToast('Debes seleccionar un motivo para cancelar', 'warning');
      return;
    }

    setShowCancelReasonModal(false);
    setIsCancelling(true);
    try {
      await rideAPI.cancelRide(rideId, {
        reason: cancelReason,
      });
    } catch (error: any) {
      const msg = error?.response?.data?.error?.message || 'No se pudo cancelar el viaje';
      showToast(msg, 'error');
    } finally {
      setIsCancelling(false);
      setCancelReason('');
    }
  }; 

  const openCallModal = () => {
    if (!ride) return;
    setShowCallModal(true);
  };

  const handlePhoneCall = () => {
    if (!ride?.passengerPhone) return;
    setShowCallModal(false);
    const cleanPhone = ride.passengerPhone.replace(/[\+\s\-\(\)]/g, '');
    Linking.openURL(`tel:${cleanPhone}`).catch(() =>
      showToast(`No se pudo iniciar llamada al ${ride.passengerPhone}`, 'error', 5000)
    );
  };

  const handleWhatsApp = () => {
    if (!ride) return;
    setShowCallModal(false);
    const cleanPhone = ride.passengerPhone.replace(/[\+\s\-\(\)]/g, '');
    const waUrl = `https://wa.me/${cleanPhone}`;
    Linking.canOpenURL(waUrl)
      .then(supported => {
        if (supported) return Linking.openURL(waUrl);
        showToast('WhatsApp no está instalado en este dispositivo', 'warning', 5000);
      })
      .catch(() => showToast('No se pudo abrir WhatsApp', 'error', 5000));
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
              // OSRM already includes the destination as the last coordinate
              const routeCoords = routeData.coordinates;
              setRouteCoordinates(routeCoords);
              routePolylineRef.current = routeCoords;
              setRouteDistance(routeData.distance);
              setRouteDuration(routeData.duration);
              // Reset backend ETA and scale refs for correct display
              setBackendEtaDistance(null);
              setBackendEtaMinutes(null);
              distanceScaleRef.current = null;
              durationScaleRef.current = null;
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

    let destCoords: { latitude: number; longitude: number };

    if (isNavigatingToPickup) {
      destCoords = ride.pickupLocation;
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
      setIsAvailable(true);
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
    setIsAvailable(true);
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
            // Only flag as user interaction if the change was NOT programmatic
            // (camera animations from animateNavigationCamera/fitToCoordinates set the ref flag)
            if (!isProgrammaticMoveRef.current) {
              setUserInteractedWithMap(true);
            }
            isProgrammaticMoveRef.current = false;
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
              rotation={0}
            >
              <DriverTaxiIcon />
            </Marker>
          )}

          {/* Pickup / Passenger marker — visible while going to pickup AND while arrived (passenger hasn't boarded yet) */}
          {(ride.status === 'accepted' || ride.status === 'arrived') && (
            <Marker
              coordinate={ride.pickupLocation}
              title="Punto de Recogida"
              description={ride.pickupAddress}
              anchor={{ x: 0.5, y: 1 }}
            >
              <PassengerIcon size={44} />
            </Marker>
          )}

          {/* Destination location marker - only visible when navigating to destination (in_progress) */}
          {ride.status === 'in_progress' && (
            <Marker
              coordinate={ride.destinationLocation}
              title="Destino"
              description={ride.destinationAddress}
              anchor={{ x: 0.5, y: 1 }}
            >
              <DropoffIcon size={40} />
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


      {/* GPS Permission Denied Banner */}
      {gpsPermissionDenied &&
        (ride.status === 'accepted' ||
          ride.status === 'arrived' ||
          ride.status === 'in_progress') && (
          <View
            style={{
              position: 'absolute',
              top: 10,
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
            top: insets.top + 86,
            alignSelf: 'center',
            backgroundColor: isImminent ? '#1a56db' : 'rgba(15, 23, 42, 0.85)',
            borderRadius: 8,
            paddingVertical: 4,
            paddingHorizontal: 8,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            zIndex: 90,
            marginHorizontal: 12,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.25,
            shadowRadius: 4,
            elevation: 6,
          }}
        >
          <View
            style={{
              width: 24,
              height: 24,
              borderRadius: 12,
              backgroundColor: isImminent ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Ionicons name={getManeuverIcon(currentStep.maneuver?.type)} size={12} color="#fff" />
          </View>
          <Text
            style={{
              color: '#fff',
              fontSize: 11,
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
                fontSize: 10,
                fontWeight: '700',
                minWidth: 30,
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
              isProgrammaticMoveRef.current = true;
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
                    if (ride.status === 'in_progress') return 'Navegando al Destino';
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

              {/* Passenger contact card */}
              <View
                style={{
                  backgroundColor: '#f9fafb',
                  borderRadius: 14,
                  padding: 16,
                  marginBottom: 16,
                  borderWidth: 1,
                  borderColor: '#f3f4f6',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  {ride.passengerProfilePicture && !ride.isDelegated ? (
                    <Image
                      source={{ uri: ride.passengerProfilePicture }}
                      style={{ width: 40, height: 40, borderRadius: 20, marginRight: 10 }}
                    />
                  ) : (
                    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', marginRight: 10 }}>
                      <Text style={{ fontSize: 16, fontWeight: '700', color: '#fff' }}>
                        {ride.passengerName.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '600', color: '#1f2937' }}>
                      {ride.passengerName}
                    </Text>
                    {ride.passengerRating != null && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 }}>
                        <Ionicons name="star" size={12} color="#f59e0b" />
                        <Text style={{ fontSize: 12, color: '#6b7280', fontWeight: '500' }}>
                          {ride.passengerRating.toFixed(1)}
                        </Text>
                      </View>
                    )}
                    {ride.isDelegated && (
                      <Text style={{ fontSize: 12, color: '#6366f1', fontWeight: '500', marginTop: 1 }}>
                        Beneficiario (no registrado)
                      </Text>
                    )}
                  </View>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <Ionicons name="call-outline" size={15} color="#6b7280" />
                  <Text style={{ fontSize: 14, color: '#374151', fontWeight: '500' }}>
                    {ride.passengerPhone}
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={openCallModal}
                  disabled={ride.isDelegated || ride.status === 'in_progress'}
                  activeOpacity={0.8}
                  style={{
                    flex: 1,
                    backgroundColor: ride.isDelegated || ride.status === 'in_progress' ? '#e5e7eb' : '#16a34a',
                    paddingVertical: 10,
                    borderRadius: 10,
                    flexDirection: 'row',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <Ionicons name="call" size={16} color={ride.isDelegated || ride.status === 'in_progress' ? '#9ca3af' : '#fff'} />
                  <Text style={{ color: ride.isDelegated || ride.status === 'in_progress' ? '#9ca3af' : '#fff', fontSize: 14, fontWeight: '600' }}>
                    {ride.status === 'in_progress'
                      ? ride.isDelegated
                        ? 'En Vehículo'
                        : 'En Vehículo'
                      : ride.isDelegated
                        ? 'Llamar Beneficiario'
                        : 'Llamar'}
                  </Text>
                </TouchableOpacity>

                {/* Navigation button — opens Google Maps / Waze chooser */}
                <TouchableOpacity
                  onPress={handleOpenExternalNav}
                  activeOpacity={0.8}
                  style={{
                    backgroundColor: '#F3F4F6',
                    paddingVertical: 10,
                    paddingHorizontal: 14,
                    borderRadius: 10,
                    flexDirection: 'row',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: 6,
                    borderWidth: 1,
                    borderColor: '#E5E7EB',
                  }}
                >
                  <Ionicons name="navigate-outline" size={18} color="#4b5563" />
                  <Text style={{ color: '#4b5563', fontSize: 14, fontWeight: '600' }}>Navegar</Text>
                </TouchableOpacity>
              </View>
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
                  backgroundColor: passengerPaymentMode === 'pago_movil' ? '#eff6ff'
                    : passengerPaymentMode === 'cash' ? '#f9fafb'
                    : '#fffbeb',
                  padding: 10,
                  borderRadius: 10,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  borderWidth: 1,
                  borderColor: passengerPaymentMode === 'pago_movil' ? '#bfdbfe'
                    : passengerPaymentMode === 'cash' ? '#e5e7eb'
                    : '#fcd34d',
                }}
              >
                <Ionicons
                  name={
                    passengerPaymentMode === 'pago_movil'
                      ? 'phone-portrait-outline'
                      : passengerPaymentMode === 'cash'
                      ? 'cash-outline'
                      : 'help-circle-outline'
                  }
                  size={16}
                  color={passengerPaymentMode === 'pago_movil' ? '#3b82f6'
                    : passengerPaymentMode === 'cash' ? colors.mediumGray
                    : '#d97706'}
                />
                <Text
                  style={{
                    fontSize: 13,
                    color: passengerPaymentMode === 'pago_movil' ? '#3b82f6'
                      : passengerPaymentMode === 'cash' ? colors.mediumGray
                      : '#d97706',
                    fontWeight: '500',
                  }}
                >
                  {passengerPaymentMode === 'pago_movil' ? 'Pago Móvil'
                    : passengerPaymentMode === 'cash' ? 'Efectivo'
                    : 'Pendiente'}
                </Text>
              </View>
            </View>

            {/* Action Buttons — compact row */}
            {ride.status === 'accepted' && (
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
                <TouchableOpacity
                  onPress={() => updateRideStatus('arrived')}
                  style={{
                    flex: 2,
                    backgroundColor: colors.primary,
                    paddingVertical: 10,
                    borderRadius: 8,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>He Llegado</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleCancelRide}
                  disabled={isCancelling}
                  style={{
                    flex: 1,
                    backgroundColor: '#fff',
                    paddingVertical: 10,
                    borderRadius: 8,
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: '#fecaca',
                  }}
                >
                  {isCancelling ? (
                    <ActivityIndicator size="small" color="#ef4444" />
                  ) : (
                    <Text style={{ color: '#ef4444', fontSize: 13, fontWeight: '600' }}>Cancelar</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {ride.status === 'arrived' && (
              <>
                {/* Payment message: waiting for passenger to pay (applies to ALL methods) */}
                {!isPaymentConfirmed ? (
                  <View style={{ backgroundColor: '#FFF4E6', padding: 16, borderRadius: 12, marginBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <ActivityIndicator size="small" color="#FF8C00" />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: '600', color: '#FF8C00', marginBottom: 4 }}>
                        Esperando pago del pasajero
                      </Text>
                      <Text style={{ fontSize: 13, color: '#666' }}>
                        {passengerPaymentMode === 'pago_movil'
                          ? 'El pasajero debe confirmar el pago móvil antes de iniciar el viaje'
                          : passengerPaymentMode === 'cash'
                          ? 'El pasajero debe confirmar el pago en efectivo antes de iniciar el viaje'
                          : 'El pasajero aún no ha seleccionado el método de pago'}
                      </Text>
                    </View>
                  </View>
                ) : (
                  <View style={{ backgroundColor: '#f0fdf4', padding: 14, borderRadius: 12, marginBottom: 14, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Ionicons name="checkmark-circle" size={20} color="#16a34a" />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: '#16a34a', marginBottom: 2 }}>
                        Pago confirmado
                      </Text>
                      <Text style={{ fontSize: 12, color: '#4b5563' }}>
                        {passengerPaymentMode === 'pago_movil' ? 'Pago Móvil' : 'Efectivo'} — {formatCurrency(Number(ride.estimatedFare), ride.currency)}
                      </Text>
                    </View>
                  </View>
                )}

                {/* Buttons row */}
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity
                    onPress={() => updateRideStatus('in_progress')}
                    disabled={!isPaymentConfirmed}
                    style={{
                      flex: 2,
                      backgroundColor: isPaymentConfirmed ? colors.primary : '#D1D5DB',
                      paddingVertical: 12,
                      borderRadius: 10,
                      alignItems: 'center',
                      opacity: isPaymentConfirmed ? 1 : 0.6,
                      flexDirection: 'row',
                      justifyContent: 'center',
                      gap: 6,
                    }}
                  >
                    <Ionicons
                      name={isPaymentConfirmed ? 'play-circle' : 'time-outline'}
                      size={18} color="#fff"
                    />
                    <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>
                      {isPaymentConfirmed ? 'Iniciar' : 'Esperando Pago'}
                    </Text>
                  </TouchableOpacity>

                  {/* Cancel button — cash: always visible; pago_movil: only if not paid */}
                  {!(isPaymentConfirmed && passengerPaymentMode === 'pago_movil') && (
                    <TouchableOpacity
                      onPress={handleCancelRide}
                      disabled={isCancelling}
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
                      {isCancelling ? (
                        <ActivityIndicator size="small" color="#ef4444" />
                      ) : (
                        <Text style={{ color: '#ef4444', fontSize: 14, fontWeight: '600' }}>Cancelar</Text>
                      )}
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
                    flex: 1,
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
              </View>
            )}
          </ScrollView>
        )}
      </View>

      {/* Cancel Reason Modal */}
      <Modal
        visible={showCancelReasonModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => { setShowCancelReasonModal(false); setCancelReason(''); }}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20, paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 360, maxHeight: '90%' }}>
            <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
              {/* Header */}
              <View style={{ alignItems: 'center', marginBottom: 20 }}>
                <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#fef2f2', justifyContent: 'center', alignItems: 'center', marginBottom: 12 }}>
                  <Ionicons name="alert-circle-outline" size={32} color="#6b7280" />
                </View>
                <Text style={{ fontSize: 18, fontWeight: '700', color: '#1f2937', marginTop: 10, marginBottom: 6, textAlign: 'center' }}>
                  Confirmar cancelación
                </Text>
                <Text style={{ fontSize: 13, color: '#6b7280', textAlign: 'center', lineHeight: 18 }}>
                  Selecciona el motivo de la cancelación
                </Text>
              </View>

              {/* Cancel reason selection */}
              <View style={{ marginBottom: 16 }}>
                {DRIVER_CANCEL_REASONS.map((reason) => (
                  <TouchableOpacity
                    key={reason}
                    onPress={() => setCancelReason(reason)}
                    activeOpacity={0.7}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: 12,
                      paddingHorizontal: 14,
                      borderRadius: 10,
                      marginBottom: 6,
                      borderWidth: 2,
                      borderColor: cancelReason === reason ? '#ef4444' : '#e5e7eb',
                      backgroundColor: cancelReason === reason ? '#fef2f2' : '#f9fafb',
                    }}
                  >
                    <View style={{
                      width: 22, height: 22, borderRadius: 11, borderWidth: 2,
                      borderColor: cancelReason === reason ? '#ef4444' : '#d1d5db',
                      justifyContent: 'center', alignItems: 'center', marginRight: 12,
                    }}>
                      {cancelReason === reason && <Ionicons name="checkmark" size={14} color="#ef4444" />}
                    </View>
                    <Text style={{ fontSize: 15, fontWeight: '500', color: '#374151', flex: 1 }}>{reason}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Action buttons */}
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity
                  onPress={() => { setShowCancelReasonModal(false); setCancelReason(''); }}
                  disabled={isCancelling}
                  activeOpacity={0.7}
                  style={{
                    flex: 1, paddingVertical: 13, borderRadius: 12,
                    backgroundColor: '#f3f4f6', alignItems: 'center',
                  }}
                >
                  <Text style={{ fontSize: 15, fontWeight: '600', color: '#6b7280' }}>No cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleConfirmCancelRide}
                  disabled={!cancelReason || isCancelling}
                  activeOpacity={0.8}
                  style={{
                    flex: 1, paddingVertical: 13, borderRadius: 12,
                    backgroundColor: cancelReason ? '#ef4444' : '#d1d5db',
                    alignItems: 'center', opacity: (!cancelReason || isCancelling) ? 0.6 : 1,
                  }}
                >
                  {isCancelling ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>Cancelar viaje</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

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
        animationType="fade"
        onRequestClose={handleSkipRating}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 360, alignItems: 'center' }}>
            <Text style={{ fontSize: 19, fontWeight: '700', color: '#1f2937', textAlign: 'center', marginBottom: 6 }}>
              Califica tu viaje
            </Text>
            <Text style={{ fontSize: 14, color: '#6b7280', textAlign: 'center', marginBottom: 24 }} numberOfLines={1}>
              {ride?.passengerName || 'el pasajero'}
            </Text>

            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 6 }}>
              {[1, 2, 3, 4, 5].map(star => (
                <TouchableOpacity key={star} onPress={() => setPassengerRating(star)}>
                  <Ionicons
                    name={star <= passengerRating ? 'star' : 'star-outline'}
                    size={36}
                    color={star <= passengerRating ? '#f59e0b' : '#d1d5db'}
                  />
                </TouchableOpacity>
              ))}
            </View>
            {passengerRating > 0 && (
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#f59e0b', textAlign: 'center', marginBottom: 16 }}>
                {passengerRating === 1 && 'Muy malo'}
                {passengerRating === 2 && 'Malo'}
                {passengerRating === 3 && 'Regular'}
                {passengerRating === 4 && 'Bueno'}
                {passengerRating === 5 && 'Excelente'}
              </Text>
            )}

            <TextInput
              style={{ backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 10, fontSize: 13, color: '#374151', minHeight: 70, marginBottom: 16, width: '100%' }}
              placeholder="Comentario (opcional)"
              placeholderTextColor="#9ca3af"
              value={passengerComment}
              onChangeText={setPassengerComment}
              multiline
              numberOfLines={3}
              maxLength={200}
              textAlignVertical="top"
            />

            <View style={{ flexDirection: 'row', gap: 10, width: '100%' }}>
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: '#f3f4f6', borderRadius: 10, paddingVertical: 11, alignItems: 'center' }}
                onPress={handleSkipRating}
                disabled={isSubmittingRating}
              >
                <Text style={{ color: '#6b7280', fontSize: 14, fontWeight: '600' }}>Omitir</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 2, backgroundColor: '#22c55e', borderRadius: 10, paddingVertical: 11, alignItems: 'center', opacity: passengerRating === 0 || isSubmittingRating ? 0.5 : 1 }}
                onPress={handleSubmitRating}
                disabled={passengerRating === 0 || isSubmittingRating}
              >
                {isSubmittingRating ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>Enviar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Call Options Modal */}
      <Modal
        visible={showCallModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowCallModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 320, alignItems: 'center' }}>
            <Text style={{ fontSize: 17, fontWeight: '700', color: '#1f2937', textAlign: 'center', marginBottom: 4 }}>
              Contactar al Pasajero
            </Text>
            <Text style={{ fontSize: 13, color: '#6b7280', textAlign: 'center', marginBottom: 24 }}>
              {ride?.passengerPhone || ''}
            </Text>

            <TouchableOpacity
              onPress={handlePhoneCall}
              activeOpacity={0.8}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                width: '100%',
                backgroundColor: '#f0fdf4',
                borderRadius: 12,
                padding: 14,
                marginBottom: 10,
                borderWidth: 1,
                borderColor: '#bbf7d0',
                gap: 12,
              }}
            >
              <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: '#16a34a', justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name="call" size={20} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '600', color: '#1f2937' }}>Llamada Telefónica</Text>
                <Text style={{ fontSize: 12, color: '#6b7280', marginTop: 1 }}>Marcar directamente</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleWhatsApp}
              activeOpacity={0.8}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                width: '100%',
                backgroundColor: '#f0fdf4',
                borderRadius: 12,
                padding: 14,
                marginBottom: 16,
                borderWidth: 1,
                borderColor: '#bbf7d0',
                gap: 12,
              }}
            >
              <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: '#25D366', justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name="logo-whatsapp" size={22} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '600', color: '#1f2937' }}>WhatsApp</Text>
                <Text style={{ fontSize: 12, color: '#6b7280', marginTop: 1 }}>Abrir conversación</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setShowCallModal(false)}
              style={{ paddingVertical: 8, paddingHorizontal: 24 }}
            >
              <Text style={{ fontSize: 14, color: '#9ca3af', fontWeight: '600' }}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
