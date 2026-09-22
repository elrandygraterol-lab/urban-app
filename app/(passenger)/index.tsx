import React, { useState, useEffect, useRef, useCallback, Suspense, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Keyboard,
  Image,
  Modal,
  Linking,
  AppState,
  ScrollView,
} from 'react-native';
import { useUnifiedNotifications } from '@/context/UnifiedNotificationContext';
import Svg, { Path, G } from 'react-native-svg';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, withRepeat, withSequence, Easing } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { getLocation } from '@/utils/lazyLocation';
import type { LocationSubscription } from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import {
  DriverTaxiIcon,
  PassengerIcon,
  PickupIcon,
  DropoffIcon,
  SecondPickupIcon,
  SecondDropoffIcon,
} from '@/src/components/map/markers';
import { computeBearing, bearingAlongRoute, animateNavigationCamera, computeNearestRouteIndex } from '@/src/utils/mapNav';
import { useAuthStore } from '@/store/authStore';
import { paymentForm } from '@/store/paymentFormStore';
import { rideAPI, paymentAPI, ratingAPI, passengerAPI } from '@/services/api';
import { reverseGeocode, getRoute, geocodeAddress, getIpLocation, searchPlaces } from '@/services/mapsService';
import {
  addConnectionListener,
  removeConnectionListener,
  connectSocket,
  getSocket,
  joinRide,
  leaveRide,
  onRideAccepted,
  onRideStatusChanged,
  onDriverLocationUpdate,
  onETAUpdate,
  onDriverArrived,
  onRideCancelled,
  onRideCompleted,
  onSharedRideInvitationReceived,
  onSharedRideInvitationAccepted,
  onSharedRideInvitationRejected,
  onSharedRideInvitationExpired,
  onRoutePointCompleted,
  removeRideListeners,
} from '@/services/socket';
import { logInfo, logError, logWarning } from '@/utils/errorLogger';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useSocketReconnect } from '@/hooks/useSocketReconnect';
import { useNetworkRecovery, retryWithBackoff, isNetworkError } from '@/hooks/useNetworkRecovery';
import { useSound } from '@/hooks/useSound';
import { useCancellationPolicy } from '@/hooks/useCancellationPolicy';
import type { SharedRideInvitation } from '@/components/SharedRideInvitationModal';
import { formatCurrency, Currency } from '@/utils/currency';
import CenterLocationButton from '@/components/CenterLocationButton';
import { resolveFileUrl } from '@/services/fileUrl';
import MobilePaymentModal from '@/components/MobilePaymentModal';
const AddressAutocomplete = React.lazy(() => import('@/components/AddressAutocomplete'));
type Place = import('@/components/AddressAutocomplete').Place;
const SharedRideInvitationModal = React.lazy(() => import('@/components/SharedRideInvitationModal'));

// const WalkthroughView = walkthroughable(View);
// const WalkthroughTouchableOpacity = walkthroughable(TouchableOpacity);

/** Motorcycle SVG icon — more accurate than Ionicons bicycle */
function MotoIcon({ color = '#6B7280', size = 22 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size * 0.6} viewBox="0 0 48 30">
      <G fill={color}>
        {/* Rear wheel */}
        <Path d="M8 30a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm0-3a5 5 0 1 0 0-10 5 5 0 0 0 0 10z" />
        {/* Front wheel */}
        <Path d="M40 30a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm0-3a5 5 0 1 0 0-10 5 5 0 0 0 0 10z" />
        {/* Body / frame */}
        <Path d="M14 22l6-12h8l4 6h6v3H31l-4-6h-5l-5 9H14z" />
        {/* Handlebar */}
        <Path d="M34 10h6v3h-6z" />
        {/* Seat */}
        <Path d="M18 10h10v3H18z" />
        {/* Engine block */}
        <Path d="M20 13h8l2 4H18z" />
      </G>
    </Svg>
  );
}

interface LocationCoords {
  latitude: number;
  longitude: number;
}

interface RouteCoordinates {
  latitude: number;
  longitude: number;
}

interface DriverInfo {
  id: string;
  name: string;
  phone: string;
  rating: number;
  profilePhotoUrl?: string;
  vehicleInfo?: {
    type: string;
    model: string;
    licensePlate: string;
    color: string;
  };
  // Fallback fields if vehicleInfo is not available
  vehicleModel?: string;
  vehicleColor?: string;
  licensePlate?: string;
  vehicleType?: string;
  currentLocation?: {
    latitude: number;
    longitude: number;
  };
}

interface ActiveRide {
  id: string;
  status: 'pending' | 'accepted' | 'arrived' | 'in_progress' | 'completed' | 'cancelled';
  paymentMode?: 'cash' | 'pago_movil' | 'dual';
  // Pago anidado que el backend entrega en GET /rides/active (Revisión 5).
  // Permite que el gate conozca el estado real del pago en el auto-trigger.
  payment?: { status?: string; amount?: number; paymentMode?: string } | null;
  isShared?: boolean;
  sharedPassengerId?: string;
  pickupAddress?: string;
  destinationAddress?: string;
  driver?: DriverInfo;
  eta?: {
    estimatedMinutes: number;
    distanceKm: number;
  };
}

export default function PassengerHomeScreen() {
  const MemoizedMarker = React.memo(Marker);
  const MemoizedPolyline = React.memo(Polyline);

  const { user, token } = useAuthStore();
  const { playNotificationSound } = useSound();
  const mapRef = useRef<MapView>(null);

  // Enable automatic socket reconnection on app state changes
  useSocketReconnect();
  const { showToast, showStatus, dismissStatus } = useUnifiedNotifications();

  logInfo('PassengerHomeScreen', 'Component mounted', {
    userId: user?.id,
    hasToken: !!token,
    platform: Platform.OS,
  });

  // Location states
  const [currentLocation, setCurrentLocation] = useState<LocationCoords | null>(null);
  const [pickupLocation, setPickupLocation] = useState<LocationCoords | null>(null);
  const [destinationLocation, setDestinationLocation] = useState<LocationCoords | null>(null);

  // Address states
  const [destinationAddress, setDestinationAddress] = useState('');
  const [pickupAddress, setPickupAddress] = useState('');
  const [isEditingPickup, setIsEditingPickup] = useState(false);

  // Full addresses for internal use (precision)
  const [destinationFullAddress, setDestinationFullAddress] = useState('');
  const [pickupFullAddress, setPickupFullAddress] = useState('');

  // Source tracking for custom place visual distinction
  const [, setPickupLocationSource] = useState<'custom' | 'nominatim' | null>(null);
  const [, setDestinationLocationSource] = useState<'custom' | 'nominatim' | null>(null);

  // Second pickup point states (Req. 6.1, 6.3)
  const [showSecondPickup, setShowSecondPickup] = useState(false);
  const [secondPickupLocation, setSecondPickupLocation] = useState<LocationCoords | null>(null);
  const [secondPickupAddress, setSecondPickupAddress] = useState('');
  const [secondPickupFullAddress, setSecondPickupFullAddress] = useState('');
  const [, setSecondPickupLocationSource] = useState<'custom' | 'nominatim' | null>(null);
  const [isEditingSecondPickup, setIsEditingSecondPickup] = useState(false);

  // Second destination point states (Req. 6.2, 6.4, 6.6)
  const [showSecondDestination, setShowSecondDestination] = useState(false);
  const [secondDestinationLocation, setSecondDestinationLocation] = useState<LocationCoords | null>(
    null
  );
  const [secondDestinationAddress, setSecondDestinationAddress] = useState('');
  const [secondDestinationFullAddress, setSecondDestinationFullAddress] = useState('');
  const [, setSecondDestinationLocationSource] = useState<'custom' | 'nominatim' | null>(null);
  const [isEditingSecondDestination, setIsEditingSecondDestination] = useState(false);

  // Map selection mode states
  const [mapSelectionMode, setMapSelectionMode] = useState<
    'none' | 'pickup' | 'destination' | 'second_pickup' | 'second_destination'
  >('none');
  const [, setTempMarkerLocation] = useState<LocationCoords | null>(null);

  // Shared suggestions state
  const [searchSuggestions, setSearchSuggestions] = useState<Place[]>([]);
  const [showSearchSuggestions, setShowSearchSuggestions] = useState(false);
  const [isSearchingPlaces, setIsSearchingPlaces] = useState(false);
  const [activeSuggestionField, setActiveSuggestionField] = useState<'pickup' | 'destination' | null>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const justSelectedSuggestionRef = useRef(false);
  const lastPickupSearchRef = useRef('');
  const lastDestinationSearchRef = useRef('');

  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);

    const val = activeSuggestionField === 'pickup' ? pickupAddress : destinationAddress;
    const lastRef = activeSuggestionField === 'pickup' ? lastPickupSearchRef : lastDestinationSearchRef;

    // Skip search if value was just set by selecting a suggestion
    if (justSelectedSuggestionRef.current) {
      justSelectedSuggestionRef.current = false;
      lastRef.current = val;
      return;
    }

    // Avoid redundant search for unchanged value
    if (val === lastRef.current) return;
    lastRef.current = val;

    if (!val || val.length < 3) {
      setSearchSuggestions([]);
      setShowSearchSuggestions(false);
      return;
    }

    searchDebounceRef.current = setTimeout(async () => {
      setIsSearchingPlaces(true);
      try {
        const results = await searchPlaces(
          val,
          currentLocation?.latitude,
          currentLocation?.longitude
        );
        const found = results.slice(0, 5);
        setSearchSuggestions(found);
        setShowSearchSuggestions(found.length > 0);
      } catch {
        setSearchSuggestions([]);
        setShowSearchSuggestions(false);
      } finally {
        setIsSearchingPlaces(false);
      }
    }, 700);

    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [pickupAddress, destinationAddress, activeSuggestionField, currentLocation]);

  // UI states
  const [isLoadingLocation, setIsLoadingLocation] = useState(true);
  const [isRequestingRide, setIsRequestingRide] = useState(false);
  const isRequestingRideRef = useRef(false);
  const [isSearchingDriver, setIsSearchingDriver] = useState(false);
  const [userInteractedWithMap, setUserInteractedWithMap] = useState(false);

  // Dynamic search context — resolves city/state from user location for precise geocoding
  // Default: San Juan de los Morros, Guárico, Venezuela (prevails if reverse geocode fails)
  const [searchContext, setSearchContext] = useState<string>('San Juan de los Morros, Guárico, Venezuela');
  const [vehicleType, setVehicleType] = useState<'taxi' | 'moto_taxi'>('taxi');
  const [motoQuantity, setMotoQuantity] = useState<1 | 2>(1);
  const [estimatedFare, setEstimatedFare] = useState<number | null>(null);
  const [fareCurrency, setFareCurrency] = useState<Currency>('VES');
  const [fareBreakdown, setFareBreakdown] = useState<{
    baseFare: number;
    distanceCost: number;
    durationCost: number;
    // Dual currency
    dualPrice?: { usd: number; ves: number };
    exchangeRate?: number;
    // keep these for fallback display
    perKmRate?: number;
    perMinuteRate?: number;
    distance?: number;
    duration?: number; // Duración en minutos
    // Time surcharge info
    timeSurcharge?: {
      applied: boolean;
      amount: number;
      type: 'percentage' | 'fixed';
      value: number;
    };
    // Fare source info
    fareType?: 'ZONA' | 'KILOMETRO' | 'HORA';
    usedFallback?: boolean;
    fallbackType?: 'zone_origin' | 'zone_destination' | 'policy_default';
    originZoneName?: string;
    destinationZoneName?: string;
    // Multi-point breakdown
    segmentBreakdown?: {
      segment: number;
      from: string;
      to: string;
      price: number;
      usedFallback: boolean;
      fallbackType?: string;
    }[];
  } | null>(null);
  const [isCalculatingFare, setIsCalculatingFare] = useState(false);
  const [zoneInfo, setZoneInfo] = useState<{
    zoneId: string | null;
    zoneName: string | null;
    usedFallback: boolean;
  } | null>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<RouteCoordinates[]>([]);
  const [nearestRouteIndex, setNearestRouteIndex] = useState(0);
  const [displayDistance, setDisplayDistance] = useState<number | null>(null);
  const [displayDuration, setDisplayDuration] = useState<number | null>(null);
  const [isApproximateRoute, setIsApproximateRoute] = useState(false);
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);

  // Active ride tracking states
  const [activeRide, setActiveRide] = useState<ActiveRide | null>(null);
  const [listenerVersion, setListenerVersion] = useState(0); // Forces listener re-registration on foreground restore
  const [driverLocation, setDriverLocation] = useState<LocationCoords | null>(null);
  const [driverHeading, setDriverHeading] = useState<number>(0); // Driver's heading/direction
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const prevDriverLocationRef = useRef<LocationCoords | null>(null);

  // Shared ride passenger location tracking (Req. 4.10)
  const [, setPassenger1Location] = useState<LocationCoords | null>(null);
  const [, setPassenger2Location] = useState<LocationCoords | null>(null);

  // Cancellation modal states
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState<string>('');

  const PASSENGER_CANCEL_REASONS = [
    'Conductor tarda mucho',
    'Cambié de opinión',
    'Ya no necesito el viaje',
    'Encontré otro transporte',
    'Otra razón',
  ];
  const [isCancelling, setIsCancelling] = useState(false);
  const isCancellingRef = useRef(false);
  const passengerInitiatedCancelRef = useRef(false);
  const calculateRouteVersionRef = useRef(0);

  const driverCoord = useMemo(
    () => (driverLocation ? { latitude: Number(driverLocation.latitude), longitude: Number(driverLocation.longitude) } : null),
    [driverLocation?.latitude, driverLocation?.longitude]
  );
  const pickupCoord = useMemo(
    () => (pickupLocation ? { latitude: Number(pickupLocation.latitude), longitude: Number(pickupLocation.longitude) } : null),
    [pickupLocation?.latitude, pickupLocation?.longitude]
  );
  const currentCoord = useMemo(
    () => (currentLocation ? { latitude: Number(currentLocation.latitude), longitude: Number(currentLocation.longitude) } : null),
    [currentLocation?.latitude, currentLocation?.longitude]
  );
  const destinationCoord = useMemo(
    () => (destinationLocation ? { latitude: Number(destinationLocation.latitude), longitude: Number(destinationLocation.longitude) } : null),
    [destinationLocation?.latitude, destinationLocation?.longitude]
  );
  const secondPickupCoord = useMemo(
    () => (secondPickupLocation ? { latitude: Number(secondPickupLocation.latitude), longitude: Number(secondPickupLocation.longitude) } : null),
    [secondPickupLocation?.latitude, secondPickupLocation?.longitude]
  );
  const secondDestinationCoord = useMemo(
    () => (secondDestinationLocation ? { latitude: Number(secondDestinationLocation.latitude), longitude: Number(secondDestinationLocation.longitude) } : null),
    [secondDestinationLocation?.latitude, secondDestinationLocation?.longitude]
  );
  const slicedRouteCoords = useMemo(
    () => (routeCoordinates.length >= 2 && nearestRouteIndex > 0 ? routeCoordinates.slice(nearestRouteIndex) : routeCoordinates),
    [routeCoordinates, nearestRouteIndex]
  );

  // Animation values for cancel modal
  const modalScale = useSharedValue(0);
  const modalOpacity = useSharedValue(0);
  const modalTranslateY = useSharedValue(50);

  // Timer ref for search timeout
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Elapsed search time (seconds)
  const [searchDuration, setSearchDuration] = useState(0);
  const searchDurationRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Animation values for searching driver indicator
  const pulseScale = useSharedValue(1);
  const pulseRingOpacity = useSharedValue(0.3);
  const pulseScaleInner = useSharedValue(1);
  const pulseRingOpacityInner = useSharedValue(0.5);
  const loadingProgress = useSharedValue(0);

  // Animated styles for pulse rings
  const pulseRingStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: pulseRingOpacity.value,
  }));
  const pulseRingInnerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScaleInner.value }],
    opacity: pulseRingOpacityInner.value,
  }));
  const loadingBarStyle = useAnimatedStyle(() => ({
    width: `${loadingProgress.value * 100}%`,
  }));


  // Safe area insets for modal
  const insets = useSafeAreaInsets();

  // Restaurar viaje activo al montar, cuando el token esta listo, y al volver a primer plano
  const mountedRef = useRef(true);

  // Track mounted state for async guards
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const ratingShownForRideRef = useRef<string | null>(null);
  const acceptedRideIdRef = useRef<string | null>(null);
  const rideCleanupRefs = useRef<Record<string, () => void>>({});
  const activeRideRef = useRef<any>(null);

  const paymentTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rideAutoResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const estimatedFareRef = useRef<number | null>(null);
  const currentInvitationRef = useRef<SharedRideInvitation | null>(null);
  const pickupLocationRef = useRef<LocationCoords | null>(null);
  const destinationLocationRef = useRef<LocationCoords | null>(null);
  const routeCoordinatesRef = useRef<RouteCoordinates[]>([]);
  const driverArrivedNotifiedRef = useRef(false);
  const hasShownNearbyNotificationRef = useRef(false);
  const isDynamicRouteEnabledRef = useRef(true);
  const lastRouteUpdateRef = useRef<number>(0);
  const initialDistanceToDestinationRef = useRef<number>(0);
  const lastRouteUpdateLocationRef = useRef<LocationCoords | null>(null);
  const fareCurrencyRef = useRef<Currency>('VES');
  const fareBreakdownRef = useRef<{ exchangeRate?: number } | null>(null);
  const currentLocationRef = useRef<LocationCoords | null>(null);
  const calculateRouteRef = useRef<() => Promise<void>>(async () => {});
  const calculateFareWithZoneRef = useRef<() => Promise<void>>(async () => {});
  // Early listener cleanups (registered before activeRide exists, persist across reconnects)
  const earlyAcceptedListenerRef = useRef<(() => void) | null>(null);
  const earlyStatusListenerRef = useRef<(() => void) | null>(null);
  // Socket instance the early listeners are currently bound to — used to detect full
  // socket recreation (connectSocket destroys all listeners on the old instance).
  const earlyListenersSocketRef = useRef<any>(null);

  // Keep refs in sync with state — avoids stale closures in socket handlers
  useEffect(() => {
    activeRideRef.current = activeRide;
  }, [activeRide]);

  useEffect(() => {
    estimatedFareRef.current = estimatedFare;
  }, [estimatedFare]);

  useEffect(() => {
    pickupLocationRef.current = pickupLocation;
  }, [pickupLocation]);

  useEffect(() => {
    destinationLocationRef.current = destinationLocation;
  }, [destinationLocation]);

  useEffect(() => {
    routeCoordinatesRef.current = routeCoordinates;
  }, [routeCoordinates]);

  useEffect(() => {
    fareCurrencyRef.current = fareCurrency;
  }, [fareCurrency]);

  useEffect(() => {
    fareBreakdownRef.current = fareBreakdown;
  }, [fareBreakdown]);

  useEffect(() => {
    currentLocationRef.current = currentLocation;
  }, [currentLocation]);

  useEffect(() => {
    if (!token) return;

    let isMounted = true;

    const restoreActiveRide = async () => {
      try {
        const response = await rideAPI.getActiveRides();
        const rides = response.data?.data ?? response.data;
        if (rides && Array.isArray(rides) && rides.length > 0) {
          const ride = rides[0];
          if (['pending', 'accepted', 'arrived', 'in_progress'].includes(ride.status)) {
            if (isMounted) {
              if (ride.driver && (ride.driver.rating === undefined || ride.driver.rating === null)) {
                ride.driver.rating = 0;
              }
              setActiveRide(prev => {
                if (prev && prev.id === ride.id) return prev;
                return ride;
              });
              // Restaurar direcciones y coordenadas
              if (ride.pickupAddress) setPickupAddress(ride.pickupAddress);
              if (ride.destinationAddress) setDestinationAddress(ride.destinationAddress);
              if (ride.pickupLatitude && ride.pickupLongitude) {
                setPickupLocation({ latitude: Number(ride.pickupLatitude), longitude: Number(ride.pickupLongitude) });
              }
              if (ride.destinationLatitude && ride.destinationLongitude) {
                setDestinationLocation({ latitude: Number(ride.destinationLatitude), longitude: Number(ride.destinationLongitude) });
              }
              // Restaurar ubicación del conductor si está disponible
              if (ride.driver?.currentLocation) {
                setDriverLocation({
                  latitude: Number(ride.driver.currentLocation.latitude),
                  longitude: Number(ride.driver.currentLocation.longitude),
                });
              } else if (prevDriverLocationRef.current) {
                // Fallback: use last known driver location from previous session
                setDriverLocation(prevDriverLocationRef.current);
              } else if ((ride.status === 'arrived' || ride.status === 'in_progress') && ride.pickupLatitude && ride.pickupLongitude) {
                // Fallback: driver is at/near pickup, use it until socket delivers real location
                // Only for arrived/in_progress — NOT for 'accepted' (driver is still en route)
                setDriverLocation({
                  latitude: Number(ride.pickupLatitude),
                  longitude: Number(ride.pickupLongitude),
                });
              }
              // Restaurar estado de pago
              // El backend marca payment.status='completed' SOLO en flujos de confirmación
              // (verifier VOB para Pago Móvil, confirmación conductor/efectivo, admin).
              // NOTA (Revisión 4): el backend NO tiene campo 'paidAt' (solo processedAt/status);
              // usar status==='completed' es la señal real y evita reabrir el modal en viajes ya pagados.
              if (ride.payment?.status === 'completed') {
                const paymentMode = ride.payment?.paymentMode;
                console.log('[PASSENGER] Ride restored with completed payment:', { paymentMode, rideId: ride.id });
                setPaymentCompleted(true);
                paymentCompletedRef.current = true; // Ref síncrono: cierra la ventana de race (Rev. 5.1)
                acceptedRideIdRef.current = null; // Reset idempotency ref for next ride
              }
              // Restaurar tarifa estimada
              if (ride.estimatedFare) {
                setEstimatedFare(Number(ride.estimatedFare));
              }
              if (ride.currency) {
                setFareCurrency(ride.currency);
              }
              setIsSearchingDriver(ride.status === 'pending');
              // A ride restored in "accepted" state with an unpaid payment must
              // show the payment form before the trip continues.
              openPaymentModalIfDue({ id: ride.id, status: ride.status, payment: ride.payment }, ride.estimatedFare ?? undefined);
            }
          }
        } else {
          // No active rides found — if we had one, it was cancelled or completed while in background
          if (isMounted && activeRideRef.current) {
            // If ride was already completed locally (socket processed event in background),
            // preserve state so the rating modal stays visible when user returns
            if (activeRideRef.current.status === 'completed') {
              console.log('[PASSENGER] Ride completed while in background — preserving state for rating');
              // Restart auto-reset in case it was cleared by effect cleanup (listenerVersion change)
              if (rideAutoResetTimeoutRef.current) clearTimeout(rideAutoResetTimeoutRef.current);
              rideAutoResetTimeoutRef.current = setTimeout(() => {
                if (activeRideRef.current?.status === 'completed' && !hasInteractedWithRatingRef.current) {
                  console.log('[PASSENGER] Auto-redirecting to request ride after completion (restore)');
                  handleCloseRatingModal();
                }
              }, 8000);
              return;
            }

            // Socket was disconnected while ride ended — fetch final status
            let finalStatus: string | null = null;
            try {
              const fullResponse = await rideAPI.getRide(activeRideRef.current.id);
              const fullData = fullResponse.data?.data || fullResponse.data;
              finalStatus = fullData?.status;

              if (fullData?.status === 'completed' && isMounted) {
                console.log('[PASSENGER] Ride was completed while in background (socket disconnected)');
                // Guard: skip if rating was already shown for this ride
                if (ratingShownForRideRef.current === fullData.id) {
                  console.log('[PASSENGER] Rating already shown for this ride — skipping duplicate restore');
                  return;
                }
                ratingShownForRideRef.current = fullData.id;
                setActiveRide((prev: any) => prev ? { ...prev, status: 'completed' } : null);
                if (fullData.finalFare) setFinalFare(fullData.finalFare);
                playNotificationSound();
                setShowRatingModal(true);
                return;
              }

              if ((fullData?.status === 'cancelled' || fullData?.status === 'expired') && isMounted) {
                const who = fullData.cancelledBy;
                const msg = who === 'driver'
                  ? 'El conductor canceló el viaje mientras estabas fuera de la app.'
                  : 'Tu viaje fue cancelado mientras estabas fuera de la app.';
                showStatus('ride_cancelled', msg, 'Viaje Cancelado');
              }
            } catch {
              console.log('[PASSENGER] Could not fetch ride details — ride may have been removed');
            }

            if (isMounted) {
              console.log('[PASSENGER] Active ride no longer exists — clearing state', finalStatus ? `(status: ${finalStatus})` : '');
              setActiveRide(null);
              setDriverLocation(null);
              setIsSearchingDriver(false);
              setPaymentCompleted(false);
              setShowMobilePaymentModal(false);
              setShowPaymentModal(false);
              setShowRatingModal(false);
              setRouteCoordinates([]);
              prevDriverLocationRef.current = null;
            }
          }
        }
      } catch (err) {
        console.log('[PASSENGER] restoreActiveRide - error:', err);
      }
    };

    restoreActiveRide();

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        restoreActiveRide().then(() => {
          // Force socket listener re-registration even for the same ride
          setListenerVersion(v => v + 1);
          // Force socket reconnection to recover real-time driver location
          const s = getSocket();
          if (s && !s.connected) {
            console.log('[PASSENGER] App foreground - reconnecting socket');
            s.connect();
          }
        });
      }
    });

    return () => {
      isMounted = false;
      subscription.remove();
    };
  }, [token]);


  /** Full reset of the ride request state so the passenger can start a new
   *  ride from scratch. Mirrors the "system cancelled" branch of
   *  handleRideCancelled: clears the map route, pickup/destination, fare and
   *  search state, then re-centers on the user's current location.
   */
  const resetRideRequestState = useCallback(() => {
    if (paymentTimeoutRef.current) clearTimeout(paymentTimeoutRef.current);
    setShowCancelModal(false);
    setActiveRide(null);
    setDriverLocation(null);
    setIsSearchingDriver(false);
    setPaymentCompleted(false);
    setShowMobilePaymentModal(false);
    setShowPaymentModal(false);
    setShowRatingModal(false);
    setFinalFare(null);
    setPaymentMethod('cash');
    setFareCurrency('VES');
    setShowSecondPickup(false);
    setSecondPickupLocation(null);
    setSecondPickupAddress('');
    setSecondPickupFullAddress('');
    setSecondPickupLocationSource(null);
    setShowSecondDestination(false);
    setSecondDestinationLocation(null);
    setSecondDestinationAddress('');
    setSecondDestinationFullAddress('');
    setSecondDestinationLocationSource(null);
    setCancelReason('');
    setRouteCoordinates([]);
    setNearestRouteIndex(0);
    setDisplayDistance(null);
    setDisplayDuration(null);
    prevDriverLocationRef.current = null;
    setPickupLocation(null);
    setPickupAddress('');
    setPickupFullAddress('');
    setDestinationLocation(null);
    setDestinationAddress('');
    setDestinationFullAddress('');
    setEstimatedFare(null);
    setFareBreakdown(null);
    setIsCalculatingFare(false);
    setZoneInfo(null);
    setHasShownNearbyNotification(false);
    setMapSelectionMode('none');
    setIsEditingPickup(false);
    setIsEditingSecondPickup(false);
    setIsEditingSecondDestination(false);
    acceptedRideIdRef.current = null;

    // Auto-set pickup to current location so user can start a new request immediately
    const currentLoc = currentLocationRef.current;
    if (currentLoc) {
      setPickupLocation(currentLoc);
    }
  }, []);

  /** Handle search timeout - auto-cancel after 60 seconds */
  const handleSearchTimeout = useCallback(async () => {
    if (activeRide?.id) {
      try {
        await rideAPI.cancelRide(activeRide.id, { reason: 'search_timeout' });
      } catch (error) {
        console.error('[PASSENGER] Auto-cancel failed:', error);
        // The backend may already have auto-cancelled the ride (system timeout
        // also fires around 60s), making cancel-with-policy return an error.
        // The ride is cancelled either way — the full reset below clears the
        // map/route so the passenger can request a new ride from scratch.
        showToast('No se pudo cancelar la búsqueda automáticamente.', 'error');
      }
    }
    resetRideRequestState();
    setSearchDuration(0);
  }, [activeRide, rideAPI, showToast, resetRideRequestState]);

// Start searching animations + timeout when isSearchingDriver changes
  useEffect(() => {
    if (isSearchingDriver) {
      // Reset duration counter
      setSearchDuration(0);

      // Pulse ring animations
      pulseScale.value = withRepeat(
        withSequence(withTiming(1.3, { duration: 1200 }), withTiming(1, { duration: 1200 })), -1, true
      );
      pulseRingOpacity.value = withRepeat(
        withSequence(withTiming(0.1, { duration: 1200 }), withTiming(0.3, { duration: 1200 })), -1, true
      );
      pulseScaleInner.value = withRepeat(
        withSequence(withTiming(1.15, { duration: 1200 }), withTiming(1, { duration: 1200 })), -1, true
      );
      pulseRingOpacityInner.value = withRepeat(
        withSequence(withTiming(0.2, { duration: 1200 }), withTiming(0.5, { duration: 1200 })), -1, true
      );
      loadingProgress.value = withRepeat(
        withSequence(withTiming(1, { duration: 2000 }), withTiming(0, { duration: 2000 })), -1, true
      );

      // 60-second search timeout
      searchTimeoutRef.current = setTimeout(() => {
        handleSearchTimeout();
      }, 60000);

      // Elapsed time counter (updates every second)
      let count = 0;
      searchDurationRef.current = setInterval(() => {
        count++;
        setSearchDuration(count);
      }, 1000);

      return () => {
        // Cleanup animations
        pulseScale.value = 1;
        pulseRingOpacity.value = 0.3;
        pulseScaleInner.value = 1;
        pulseRingOpacityInner.value = 0.5;
        loadingProgress.value = 0;
        // Cleanup timeout
        if (searchTimeoutRef.current) {
          clearTimeout(searchTimeoutRef.current);
          searchTimeoutRef.current = null;
        }
        // Cleanup duration counter
        if (searchDurationRef.current) {
          clearInterval(searchDurationRef.current);
          searchDurationRef.current = null;
        }
        setSearchDuration(0);
      };
    } else {
      // Reset all when not searching
      pulseScale.value = 1;
      pulseRingOpacity.value = 0.3;
      pulseScaleInner.value = 1;
      pulseRingOpacityInner.value = 0.5;
      loadingProgress.value = 0;
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
        searchTimeoutRef.current = null;
      }
      if (searchDurationRef.current) {
        clearInterval(searchDurationRef.current);
        searchDurationRef.current = null;
      }
      setSearchDuration(0);
    }
  }, [isSearchingDriver]);

  // Smart Tutorial state
  // const { start: startTour } = useCopilot();
  // const { isActive: needsTutorial } = useSmartTutorial('passenger_home');
  // const tutorialStartedRef = useRef(false);

  // useEffect(() => {
  //   if (needsTutorial && !isLoadingLocation && currentLocation && !tutorialStartedRef.current) {
  //     tutorialStartedRef.current = true;
  //     setActiveTutorialScreen('passenger_home');
  //     const timer = setTimeout(() => { startTour(); }, 1200);
  //     return () => clearTimeout(timer);
  //   }
  // }, [needsTutorial, isLoadingLocation, currentLocation, startTour]);

  // Use cancellation policy hook - only fetch when ride is in a cancellable state AND user is authenticated
  const canFetchPolicy =
    !!token && !!activeRide && ['pending', 'accepted', 'arrived', 'in_progress'].includes(activeRide.status);
  const { policy: cancellationPolicy } = useCancellationPolicy(activeRide?.id || null, {
    enabled: canFetchPolicy,
  });

  // Payment modal states
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showMobilePaymentModal, setShowMobilePaymentModal] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const isProcessingPaymentRef = useRef(false);
  const [paymentCompleted, setPaymentCompleted] = useState(false);
  const [finalFare, setFinalFare] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<
    'cash' | 'card' | 'digital_wallet' | 'pago_movil' | 'bank_transfer'
  >('cash');
  const paymentMethodRef = useRef(paymentMethod);
  useEffect(() => {
    paymentMethodRef.current = paymentMethod;
  }, [paymentMethod]);
  const [selectedPlatformMethod, setSelectedPlatformMethod] = useState<any>(null);
  const [platformPaymentMethods, setPlatformPaymentMethods] = useState<any[]>([]);
  // Ref de métodos de pago: los listeners tempranos de socket capturan el closure
  // del mount donde platformPaymentMethods aún estaba vacío (fetch aún no resuelto),
  // por lo que el primer método NUNCA se seteaba en el modal (Revisión 5, BUG 1).
  // Leer el valor actual desde este ref garantiza siempre la primera cuenta real.
  const platformPaymentMethodsRef = useRef<any[]>([]);
  useEffect(() => {
    platformPaymentMethodsRef.current = platformPaymentMethods;
  }, [platformPaymentMethods]);

  // Prevents the payment form from reopening once the current ride has been paid
  const paymentCompletedRef = useRef(false);
  useEffect(() => {
    paymentCompletedRef.current = paymentCompleted;
  }, [paymentCompleted]);

  // Tracks whether the payment modal is currently open. Used by the idempotency
  // guard (Opción C) so duplicate triggers are skipped while the modal is open,
  // but legitimate reopens after closing it (button "Pagar Ahora") still work.
  const showMobilePaymentModalRef = useRef(false);
  useEffect(() => {
    showMobilePaymentModalRef.current = showMobilePaymentModal;
  }, [showMobilePaymentModal]);

  // Evita disparar varios fetchs simultáneos de métodos de pago (mount + aperturas
  // consecutivas del modal mientras la lista aún está vacía).
  const platformMethodsFetchingRef = useRef(false);

  // Carga los métodos de pago configurados por el admin (Pago Móvil / Transferencia).
  // Se usa en el mount y, bajo demanda, dentro de openPaymentModalIfDue para que la
  // tarjeta de destino SIEMPRE aparezca al abrir el formulario de pago, incluso si el
  // fetch inicial fue lento o falló (Revisión 5, BUG 1 — visible en iPhone/iOS real).
  // Al resolver, si el formulario ya está abierto y aún no hay método seleccionado,
  // lo inyecta: el sync effect re-publica al store y la tarjeta aparece en vivo.
  const loadPlatformPaymentMethods = useCallback(async () => {
    try {
      const res = await paymentAPI.getPlatformPaymentMethods();
      const methods = res.data?.data || [];
      setPlatformPaymentMethods(methods);
      // Ref síncrono: disponible de inmediato para la próxima apertura del modal,
      // sin esperar el efecto [platformPaymentMethods].
      platformPaymentMethodsRef.current = methods;
    } catch (err) {
      console.log('[PASSENGER] Could not load platform payment methods:', err);
    } finally {
      const freshMethods = platformPaymentMethodsRef.current;
      if (showMobilePaymentModalRef.current && freshMethods.length > 0) {
        setSelectedPlatformMethod(freshMethods[0]);
      }
    }
  }, []);

  // Limpia la idempotencia al iniciar un VIAJE NUEVO (cambia activeRide?.id).
  // Reforzó el reset manual de los handlers de pago. Con Opción C, el guard 0 solo
  // bloquea si el modal está abierto, así que limpiar aquí es siempre seguro
  // (Revisión 5.1 — sugerencia del revisor).
  useEffect(() => {
    acceptedRideIdRef.current = null;
  }, [activeRide?.id]);

  /**
   * Payment gate for the passenger: every path that transitions the ride into
   * "accepted" (socket event, 5s polling fallback, restore on foreground,
   * network recovery) MUST route the trip through the payment form unless the
   * ride has already been paid. Guarantees the passenger always confirms
   * payment BEFORE the trip starts.
   */
  // useCallback con deps estables (solo refs + setters): el efecto auto-trigger solo
  // se ejecuta cuando cambian status/id/paymentCompleted, NO en cada render
  // (Revisión 5, BUG 2: en efectivo/transferencia con latencia de red, el auto-trigger
  // se disparaba en cada render y reabría el modal durante el await del backend,
  // dejándolo abierto sobre el éxito o tapando el error de pago).
  const openPaymentModalIfDue = useCallback(
    (
      ride: { id?: string; status?: string; payment?: { status?: string } | null },
      fare?: number | null
    ) => {
      // Idempotency guard (Opción C): solo bloquea duplicados MIENTRAS el modal
      // está abierto para este ride. Si el usuario cerró el modal sin pagar
      // (botón "Pagar Ahora" en panel o error de pago), esta condición es false
      // → permite reabrir intencionalmente.
      if (ride.id && acceptedRideIdRef.current === ride.id && showMobilePaymentModalRef.current) {
        console.log('[PASSENGER] openPaymentModalIfDue SKIPPED — modal already open for rideId:', ride.id);
        return;
      }
      // Guardia: detectar si paymentCompleted ya está true ANTES de que el usuario pague
      if (paymentCompletedRef.current) {
        console.warn('[PASSENGER] openPaymentModalIfDue BLOCKED — paymentCompletedRef=true', {
          rideStatus: ride.status,
          ridePaymentStatus: ride.payment?.status,
          activeRide: activeRideRef.current?.status,
        });
        return;
      }
      if (ride.status !== 'accepted') return;
      // Solo bloquear si pago COMPLETADO — señal real del backend (no existe 'paidAt').
      // Revisión 4: el backend marca status='completed' solo en flujos de confirmación,
      // por lo que usar status==='completed' es seguro y evita reabrir el modal en viajes pagados.
      if (ride.payment?.status === 'completed') return;
      if (fare != null && !Number.isNaN(Number(fare))) {
        setFinalFare(Number(fare));
      }
      // Revisión 5: leer métodos desde el ref (el closure del listener early del mount
      // veía platformPaymentMethods=[] y dejaba selectedPlatformMethod en null,
      // sin la tarjeta de destino del Pago Móvil en el modal).
      const methods = platformPaymentMethodsRef.current;
      const firstMethod = methods.length > 0 ? methods[0] : null;
      if (firstMethod) {
        setSelectedPlatformMethod(firstMethod);
      }
      // Bajo demanda: si el fetch del mount aún no resolvió o falló, abre el formulario
      // igual y dispara una recarga asíncrona. Cuando lleguen los métodos, loadPlatformPaymentMethods
      // aplica el primero (loader.finally) y el sync effect re-publica al store → la tarjeta
      // de destino del Pago Móvil / Transferencia aparece en el modal ya abierto.
      if (methods.length === 0 && !platformMethodsFetchingRef.current) {
        platformMethodsFetchingRef.current = true;
        loadPlatformPaymentMethods().finally(() => {
          platformMethodsFetchingRef.current = false;
        });
      }
      // Mark as processed for idempotency
      if (ride.id) acceptedRideIdRef.current = ride.id;
      console.log('[PASSENGER] openPaymentModalIfDue → SHOWING payment modal', { rideId: ride.id });
      setShowMobilePaymentModal(true);
    },
    []
  );

  // Auto-trigger payment modal when ride becomes accepted and not paid
  // This ensures modal opens even if socket event was missed or paywall rendered first
  useEffect(() => {
    if (activeRide?.status === 'accepted' && !paymentCompleted) {
      console.log('[PASSENGER] Auto-trigger: ride accepted & not paid → opening payment modal');
      openPaymentModalIfDue({ id: activeRide.id, status: 'accepted', payment: activeRide.payment ?? null }, estimatedFareRef.current || 0);
    }
  }, [activeRide?.status, activeRide?.id, paymentCompleted, openPaymentModalIfDue]);

  // Change payment method during active ride (Req. 3)
  const [showChangePaymentModal, setShowChangePaymentModal] = useState(false);
  const [isChangingPayment, setIsChangingPayment] = useState(false);

  // Rating modal states
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [driverRating, setDriverRating] = useState(0);
  const [driverComment, setDriverComment] = useState('');
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);
  const isSubmittingRatingRef = useRef(false);
  const hasInteractedWithRatingRef = useRef(false);

  // Contact modal states
  const [showContactModal, setShowContactModal] = useState(false);

  // Shared ride invitation states (Req. 7.3, 7.4)
  const [showInvitationModal, setShowInvitationModal] = useState(false);
  const [currentInvitation, setCurrentInvitation] = useState<SharedRideInvitation | null>(null);

  useEffect(() => {
    currentInvitationRef.current = currentInvitation;
  }, [currentInvitation]);

  // Notification tracking - to avoid showing "driver nearby" notification multiple times
  const [hasShownNearbyNotification, setHasShownNearbyNotification] = useState(false);

  useEffect(() => {
    hasShownNearbyNotificationRef.current = hasShownNearbyNotification;
  }, [hasShownNearbyNotification]);

  // ========== MEJORAS DE NAVEGACIÓN ==========
  // Mejora 1: Actualización dinámica de ruta
  const [isDynamicRouteEnabled] = useState(true);
  const [lastRouteUpdate, setLastRouteUpdate] = useState<number>(0);

  useEffect(() => {
    isDynamicRouteEnabledRef.current = isDynamicRouteEnabled;
  }, [isDynamicRouteEnabled]);

  useEffect(() => {
    lastRouteUpdateRef.current = lastRouteUpdate;
  }, [lastRouteUpdate]);

  // Mejora 2: Indicador de progreso visual
  const [rideProgress, setRideProgress] = useState<number>(0); // 0-100%
  const [initialDistanceToDestination, setInitialDistanceToDestination] = useState<number>(0);

  useEffect(() => {
    initialDistanceToDestinationRef.current = initialDistanceToDestination;
  }, [initialDistanceToDestination]);

  // Mejora 3: Puntos de interés en la ruta
  const [nearbyLandmarks, setNearbyLandmarks] = useState<
    {
      id: string;
      name: string;
      latitude: number;
      longitude: number;
      type: 'landmark' | 'poi';
    }[]
  >([]);

  // Request location permissions and get current location
  useEffect(() => {
    // CRITICAL: Only initialize if user is actually a passenger
    // This prevents the screen from initializing when pre-rendered by React Navigation
    if (!user || user.role !== 'passenger') {
      console.log('[PASSENGER] ========================================');
      console.log('[PASSENGER] ⚠️ SKIPPING INITIALIZATION');
      console.log('[PASSENGER]    User:', user?.name || 'null');
      console.log('[PASSENGER]    Role:', user?.role || 'null');
      console.log('[PASSENGER]    Reason: User is not a passenger');
      console.log('[PASSENGER] ========================================');
      setIsLoadingLocation(false);
      return;
    }

    console.log('[PASSENGER] ========================================');
    console.log('[PASSENGER] ✅ INITIALIZING PASSENGER SCREEN');
    console.log('[PASSENGER]    User:', user.name);
    console.log('[PASSENGER]    Role:', user.role);
    console.log('[PASSENGER]    User ID:', user.id);
    console.log('[PASSENGER] ========================================');

    logInfo('PassengerHomeScreen', 'Requesting location permissions...');

    (async () => {
      try {
        const Loc = await getLocation();
        const { status } = await Loc.requestForegroundPermissionsAsync();

        logInfo('PassengerHomeScreen', 'Location permission status', { status });

        // Helper: apply coords and resolve address
        const applyLocation = async (coords: LocationCoords) => {
          setCurrentLocation(coords);
          setPickupLocation(coords);
          setIsLoadingLocation(false);
          logInfo('PassengerHomeScreen', 'Location applied', coords);
          try {
            const locationData = await reverseGeocode(coords.latitude, coords.longitude);
            setPickupAddress(
              locationData.address ||
                `${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}`
            );
          } catch {
            setPickupAddress(`${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}`);
          }
        };

        // Helper: apply IP geolocation coordinates as approximate fallback
        const applyIpLocation = (ipLoc: { city: string; regionName: string; latitude: number; longitude: number }) => {
          const coords: LocationCoords = { latitude: ipLoc.latitude, longitude: ipLoc.longitude };
          setCurrentLocation(coords);
          setPickupLocation(coords);
          const ctx = [ipLoc.city, ipLoc.regionName, 'Venezuela'].filter(Boolean).join(', ');
          setSearchContext(ctx);
          setPickupAddress(`${ipLoc.city}, ${ipLoc.regionName}`);
          setIsLoadingLocation(false);
          logInfo('PassengerHomeScreen', 'IP location fallback applied', { coords, ctx });
        };

        if (status !== 'granted') {
          logWarning('PassengerHomeScreen', 'Location permission denied');
          // Try IP geolocation as fallback before showing permission error
          const ipLoc = await getIpLocation();
          if (ipLoc?.latitude && ipLoc?.longitude) {
            logInfo('PassengerHomeScreen', 'IP geolocation fallback applied after GPS denied', ipLoc);
            applyIpLocation(ipLoc);
            showStatus(
              'info',
              'Usando ubicación aproximada por IP. La precisión puede ser menor que la del GPS.',
              'GPS no disponible',
              undefined,
              undefined,
              5000
            );
            return;
          }
          showStatus(
            'error',
            'Esta app necesita acceso a tu ubicación para funcionar. Por favor activa el permiso en Configuración.',
            'Permiso de ubicación requerido',
            undefined,
            { label: 'Abrir Configuración', onPress: () => Linking.openSettings() }
          );
          setIsLoadingLocation(false);
          return;
        }

        logInfo('PassengerHomeScreen', 'Getting current location...');

        // Step 1: Last known position (instant — avoids GPS cold-start delay)
        let lastKnownApplied = false;
        try {
          const lastKnown = await Loc.getLastKnownPositionAsync({
            maxAge: 3 * 60 * 1000, // prefer positions up to 3 min old
            requiredAccuracy: 20, // within 20 meters for precise initial position
          });
          if (lastKnown) {
            logInfo('PassengerHomeScreen', 'Last known position available', {
              lat: lastKnown.coords.latitude,
              lng: lastKnown.coords.longitude,
              ageMs: Date.now() - lastKnown.timestamp,
            });
            await applyLocation({
              latitude: lastKnown.coords.latitude,
              longitude: lastKnown.coords.longitude,
            });
            lastKnownApplied = true;
          }
        } catch {
          // No last known — proceed to fresh fetch
        }

        // Step 2: Fresh GPS position (updates map even if last known was applied)
        try {
          const fresh = await Loc.getCurrentPositionAsync({
            accuracy: Loc.Accuracy.BestForNavigation,
          });
          logInfo('PassengerHomeScreen', 'Fresh GPS position obtained', {
            lat: fresh.coords.latitude,
            lng: fresh.coords.longitude,
            accuracy: fresh.coords.accuracy,
          });
          await applyLocation({
            latitude: fresh.coords.latitude,
            longitude: fresh.coords.longitude,
          });
        } catch (freshError: any) {
          if (lastKnownApplied) {
            // Last known already shown — fresh GPS failed but user has a position
            logWarning('PassengerHomeScreen', 'Fresh GPS failed, keeping last known position');
          } else {
            // Step 3: No recent last known — try any last known regardless of age/accuracy
            let anyLastKnown = false;
            try {
              const staleKnown = await Loc.getLastKnownPositionAsync();
              if (staleKnown) {
                logWarning(
                  'PassengerHomeScreen',
                  'Using stale last known position as fallback: ' +
                    JSON.stringify({
                      lat: staleKnown.coords.latitude,
                      lng: staleKnown.coords.longitude,
                      ageMs: Date.now() - staleKnown.timestamp,
                    })
                );
                await applyLocation({
                  latitude: staleKnown.coords.latitude,
                  longitude: staleKnown.coords.longitude,
                });
                anyLastKnown = true;
                // Inform user the position may not be current
                showStatus(
                  'info',
                  'No se pudo obtener tu ubicación actual (sin conexión o GPS sin señal). Se está usando tu última posición registrada. La precisión puede ser menor.',
                  'Usando última ubicación conocida'
                );
              }
            } catch {
              // No last known at all
            }

            if (!anyLastKnown) {
              // Try IP geolocation as last resort fallback before showing GPS error
              try {
                const ipLoc = await getIpLocation();
                if (ipLoc?.latitude && ipLoc?.longitude) {
                  logInfo('PassengerHomeScreen', 'IP geolocation last-resort fallback applied', ipLoc);
                  applyIpLocation(ipLoc);
                  showStatus(
                    'info',
                    'No se pudo obtener tu ubicación precisa. Usando ubicación aproximada por IP.',
                    'Ubicación aproximada',
                    undefined,
                    undefined,
                    5000
                  );
                  return;
                }
              } catch {
                // IP fallback also failed — continue to error display
              }

              // Absolutely no position available — classify the error
              const msg: string = freshError?.message ?? String(freshError);
              const isNetwork =
                msg.includes('Network') ||
                msg.includes('network') ||
                msg.includes('ECONNREFUSED') ||
                msg.includes('ETIMEDOUT') ||
                msg.includes('internet');
              const isGpsOff =
                msg.includes('location is unavailable') ||
                msg.includes('location services') ||
                msg.includes('Location provider') ||
                msg.includes('GPS');

              let title = 'No se pudo obtener tu ubicación';
              let message: string;

              if (isNetwork) {
                message =
                  'No tienes conexión a internet y no hay una ubicación previa guardada. Verifica tu conexión e intenta de nuevo.';
              } else if (isGpsOff) {
                message =
                  'El GPS está desactivado o sin señal. Activa la ubicación en Configuración e intenta de nuevo.';
              } else {
                message = `Error interno al obtener la ubicación.\n\nDetalle: ${msg}\n\nSi el problema persiste, reinicia la app.`;
              }

              logWarning('PassengerHomeScreen', {
                context: 'Getting location',
                isNetwork,
                isGpsOff,
                message: msg,
              });

              showStatus('warning', message, title, undefined, {
                label: isGpsOff ? 'Abrir Configuración' : 'Reintentar',
                onPress: async () => {
                  dismissStatus();
                  if (isGpsOff) {
                    Linking.openSettings();
                    return;
                  }
                  setIsLoadingLocation(true);
                  try {
                    const retryLoc = await getLocation();
                    const { status: permStatus } = await retryLoc.requestForegroundPermissionsAsync();
                    if (permStatus !== 'granted') {
                      showStatus(
                        'error',
                        'Esta app necesita acceso a tu ubicación para funcionar. Por favor activa el permiso en Configuración.',
                        'Permiso de ubicación requerido',
                        undefined,
                        { label: 'Abrir Configuración', onPress: () => { dismissStatus(); Linking.openSettings(); } }
                      );
                      setIsLoadingLocation(false);
                      return;
                    }
                    const fresh = await retryLoc.getCurrentPositionAsync({ accuracy: retryLoc.Accuracy.BestForNavigation });
                    await applyLocation({ latitude: fresh.coords.latitude, longitude: fresh.coords.longitude });
                  } catch (retryErr: any) {
                    setIsLoadingLocation(false);
                    const errMsg: string = retryErr?.message ?? String(retryErr);
                    const retryIsGpsOff =
                      errMsg.includes('location is unavailable') ||
                      errMsg.includes('location services') ||
                      errMsg.includes('Location provider') ||
                      errMsg.includes('GPS');
                    const retryMessage = retryIsGpsOff
                      ? 'El GPS está desactivado o sin señal. Activa la ubicación en Configuración e intenta de nuevo.'
                      : 'Error al obtener la ubicación.\n\nPor favor intenta de nuevo.';
                    showStatus('warning', retryMessage, 'No se pudo obtener tu ubicación', undefined, {
                      label: retryIsGpsOff ? 'Abrir Configuración' : 'Reintentar',
                      onPress: async () => {
                        dismissStatus();
                        if (retryIsGpsOff) {
                          Linking.openSettings();
                          return;
                        }
                        setIsLoadingLocation(true);
                        try {
                          const L = await getLocation();
                          const p = await L.requestForegroundPermissionsAsync();
                          if (p.status !== 'granted') {
                            setIsLoadingLocation(false);
                            return;
                          }
                          const f = await L.getCurrentPositionAsync({ accuracy: L.Accuracy.BestForNavigation });
                          await applyLocation({ latitude: f.coords.latitude, longitude: f.coords.longitude });
                        } catch {
                          setIsLoadingLocation(false);
                          showStatus('warning', 'No se pudo obtener la ubicación. Reinicia la app e intenta de nuevo.', 'Error de Ubicación');
                        }
                      },
                    });
                  }
                },
              });

              setIsLoadingLocation(false);
            }
          }
        }

        logInfo('PassengerHomeScreen', 'Location setup complete');
      } catch (error: any) {
        // Outer catch: unexpected errors (e.g. permissions API crash)
        logError('PassengerHomeScreen', error, { context: 'Location init' });
        showToast(
          'Ocurrió un error al inicializar la ubicación. Reinicia la app e intenta de nuevo.',
          'error'
        );
        setIsLoadingLocation(false);
      }
    })();
  }, [user, showStatus, showToast]);

  // Retry location when app comes from background (e.g., user enabled GPS in Settings)
  useEffect(() => {
    if (!user || user.role !== 'passenger') return;

    const retryLocation = async () => {
      if (currentLocation) return;
      logInfo('PassengerHomeScreen', 'App active, retrying location...');
      setIsLoadingLocation(true);
      try {
        const Loc = await getLocation();
        const { status } = await Loc.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          showStatus(
            'error',
            'Esta app necesita acceso a tu ubicación para funcionar. Por favor activa el permiso en Configuración.',
            'Permiso de ubicación requerido',
            undefined,
            { label: 'Abrir Configuración', onPress: () => { dismissStatus(); Linking.openSettings(); } }
          );
          setIsLoadingLocation(false);
          return;
        }
        const fresh = await Loc.getCurrentPositionAsync({ accuracy: Loc.Accuracy.BestForNavigation });
        const coords = { latitude: fresh.coords.latitude, longitude: fresh.coords.longitude };
        setCurrentLocation(coords);
        setPickupLocation(coords);
        setIsLoadingLocation(false);
        try {
          const addr = await reverseGeocode(coords.latitude, coords.longitude);
          setPickupAddress(addr.address || `${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}`);
        } catch {
          setPickupAddress(`${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}`);
        }
        logInfo('PassengerHomeScreen', 'Location retry succeeded', coords);
      } catch (err: any) {
        setIsLoadingLocation(false);
        const errMsg: string = err?.message ?? String(err);
        const isGpsOff =
          errMsg.includes('location is unavailable') ||
          errMsg.includes('location services') ||
          errMsg.includes('Location provider') ||
          errMsg.includes('GPS');
        const retryMessage = isGpsOff
          ? 'El GPS está desactivado o sin señal. Activa la ubicación en Configuración e intenta de nuevo.'
          : 'Error al obtener la ubicación.\n\nPor favor intenta de nuevo.';
        showStatus('warning', retryMessage, 'No se pudo obtener tu ubicación', undefined, {
          label: isGpsOff ? 'Abrir Configuración' : 'Reintentar',
          onPress: () => {
            dismissStatus();
            if (isGpsOff) {
              Linking.openSettings();
              return;
            }
            retryLocation();
          },
        });
      }
    };

    const subscription = AppState.addEventListener('change', nextState => {
      if (nextState === 'active') {
        retryLocation();
      }
    });
    return () => subscription.remove();
  }, [user, currentLocation]);

  // Early handlers for ride:accepted and ride:status_changed (registered before activeRide exists)
  // These must be useCallbacks so they're available when socket connects, not waiting for activeRide
  const handleRideAccepted = useCallback(
    async (data: any) => {
      // Guard: prevent zombie rides — only process accepts for the current ride/search
      if (!activeRideRef.current?.id || activeRideRef.current.id !== data.rideId) {
        console.log('[PASSENGER] ride:accepted ignored — mismatched/unknown rideId', { currentId: activeRideRef.current?.id, eventRideId: data.rideId });
        return;
      }
      // Guard: prevent double processing from ride room + emitToUser
      if (acceptedRideIdRef.current === data.rideId) return;
      // Don't set acceptedRideIdRef here — openPaymentModalIfDue will set it after guards pass
      driverArrivedNotifiedRef.current = false;

      console.log('[PASSENGER] Ride accepted (early):', data);

      setActiveRide(prev => ({
        ...prev!,
        status: 'accepted',
        driver: data.driver,
      }));

      setIsSearchingDriver(false);

      // Clear search timeout — ride was accepted so no need to auto-cancel
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
        searchTimeoutRef.current = null;
      }

      // Update driver location on map
      if (data.driver?.currentLocation) {
        setDriverLocation(data.driver.currentLocation);
      }

      // Store final fare
      setFinalFare(estimatedFareRef.current || 0);

      // Show the payment form (choose payment method) before the trip starts.
      // Delegated to the shared payment gate so every entry path behaves the same.
      openPaymentModalIfDue({ id: data.rideId, status: 'accepted', payment: null }, estimatedFareRef.current || 0);
    },
    [openPaymentModalIfDue]
  );

  const handleRideStatusChangedEarly = useCallback(
    (data: any) => {
      console.log('[PASSENGER] Early ride:status_changed:', data);

      // Guard: zombie preventer — only process events for the current active ride
      if (!activeRideRef.current?.id || activeRideRef.current.id !== data.rideId) {
        console.log('[PASSENGER] ride:status_changed ignored — mismatched/unknown rideId', { currentId: activeRideRef.current?.id, eventRideId: data.rideId });
        return;
      }

      // Ignore arrived/completed — handled by dedicated listeners
      if (data.status === 'arrived' || data.status === 'completed') {
        console.log(`[PASSENGER] ride:status_changed ignored — ${data.status} handled by dedicated listener`);
        return;
      }

      // Defensive payment gate: any path that surfaces "accepted" must route
      // the passenger through the payment form unless the ride was already paid.
      if (data.status === 'accepted') {
        openPaymentModalIfDue({ id: data.rideId, status: data.status, payment: data.payment }, data.estimatedFare ?? data.finalFare ?? undefined);
      }

      setActiveRide(prev => ({
        ...prev!,
        status: data.status,
      }));
    },
    [openPaymentModalIfDue]
  );

  // Setup WebSocket connection and listeners
  useEffect(() => {
    // Only connect socket if user is authenticated and token exists
    if (!user || !token) {
      console.log('[PASSENGER] User not authenticated or no token, skipping socket connection');
      return;
    }

    let mounted = true;

    const setupSocket = async () => {
      try {
        console.log('[PASSENGER] Connecting socket with token...');
        // Pass token directly to avoid race condition with SecureStore
        await connectSocket(token);
        if (mounted) {
          setIsSocketConnected(true);
          console.log('[PASSENGER] ✅ WebSocket connected');
        }
      } catch (error) {
        console.error('[PASSENGER] Failed to connect WebSocket:', error);
        if (mounted) {
          setIsSocketConnected(false);
        }
      }
    };

    setupSocket();

    // Register ride:accepted / ride:status_changed ONCE PER SOCKET INSTANCE (before
    // activeRide exists). addConnectionListener re-fires on every connect, including
    // after a FULL socket recreation (connectSocket does removeAllListeners on the old
    // instance). We only re-register when the socket OBJECT changed, so native
    // reconnects (same instance, listeners preserved) never duplicate registrations.
    const registerEarlyListeners = (connected: boolean) => {
      if (!connected) return;
      const s = getSocket();
      if (!s) return;
      if (earlyListenersSocketRef.current === s) return;
      console.log('[PASSENGER] Registering early ride listeners for socket instance:', s.id);
      // NOTE: intentionally NOT calling the previous cleanup here — after a recreation it
      // would off() the NEW socket (module-level `socket`) and remove our fresh listeners.
      earlyAcceptedListenerRef.current = onRideAccepted(handleRideAccepted);
      earlyStatusListenerRef.current = onRideStatusChanged(handleRideStatusChangedEarly);
      earlyListenersSocketRef.current = s;
      // Force the ride-effect (deps: activeRide?.id, listenerVersion) to re-register its
      // ride listeners (driverLocation, eta, driverArrived, cancelled, completed,
      // routePointCompleted) and handleReconnect on the new socket instance.
      setListenerVersion(v => v + 1);
    };
    addConnectionListener(registerEarlyListeners);

    // Cleanup on unmount
    return () => {
      mounted = false;
      removeConnectionListener(registerEarlyListeners);
      removeRideListeners();
      earlyAcceptedListenerRef.current?.();
      earlyStatusListenerRef.current?.();
      earlyListenersSocketRef.current = null;
      // Don't disconnect socket here - keep it alive for the session
    };
  }, [user, token]); // Depend on both user AND token

  // Fetch platform payment methods (admin-configured Pago Móvil options)
  useEffect(() => {
    if (!token) return;
    if (platformMethodsFetchingRef.current) return;
    platformMethodsFetchingRef.current = true;
    loadPlatformPaymentMethods().finally(() => {
      platformMethodsFetchingRef.current = false;
    });
  }, [token, loadPlatformPaymentMethods]);

  // Setup ride event listeners when active ride changes
  useEffect(() => {
    if (!activeRide) {
      return;
    }

    console.log('[PASSENGER] Setting up ride event listeners for ride:', activeRide.id);

    // Reset notification flags when a new ride starts
    setHasShownNearbyNotification(false);

    // Join ride room — use raw socket.emit to bypass isConnected guard during reconnection
    joinRide(activeRide.id);

    // Re-join ride room AND re-register listeners on every socket reconnect
    const socket = getSocket();
    const handleReconnect = () => {
      console.log('[PASSENGER] Socket reconnected, re-joining ride room and re-registering listeners');
      if (activeRideRef.current?.id) {
        socket?.emit('join_ride', { rideId: activeRideRef.current.id });
      }
      // Clean up stale listeners from previous connection, then re-register fresh ones
      // NOTE: rideAccepted and rideStatusChanged are registered early in the socket connection
      // effect and persist across reconnects via their own cleanup refs (acceptedListenerCleanup, etc.)
      Object.values(rideCleanupRefs.current).forEach(fn => fn());
      rideCleanupRefs.current = {};
      rideCleanupRefs.current.driverLocationUpdate = onDriverLocationUpdate(handleDriverLocationUpdate);
      rideCleanupRefs.current.etaUpdate = onETAUpdate(handleETAUpdate);
      rideCleanupRefs.current.driverArrived = onDriverArrived(handleDriverArrived);
      rideCleanupRefs.current.rideCancelled = onRideCancelled(handleRideCancelled);
      rideCleanupRefs.current.rideCompleted = onRideCompleted(handleRideCompleted);
      rideCleanupRefs.current.routePointCompleted = onRoutePointCompleted(handleRoutePointCompleted);
      console.log('[PASSENGER] ✅ Listeners re-registered after reconnect (excluding early ones)');
      // Bump listenerVersion to trigger re-registration of shared ride invitation handlers
      setListenerVersion(v => v + 1);
    };
    socket?.on('connect', handleReconnect);

    // Listen for driver location updates — skip micro-movements <15m to prevent flicker
    const MIN_DRIVER_MOVE_METERS = 15;
    const handleDriverLocationUpdate = (data: any) => {
      const newDriverLocation = {
        latitude: data.latitude,
        longitude: data.longitude,
      };

      const prev = prevDriverLocationRef.current;
      if (prev) {
        const dLat = newDriverLocation.latitude - prev.latitude;
        const dLng = (newDriverLocation.longitude - prev.longitude) * Math.cos(newDriverLocation.latitude * Math.PI / 180);
        const distMeters = Math.sqrt(dLat * dLat + dLng * dLng) * 111320;
        if (distMeters < MIN_DRIVER_MOVE_METERS) return;
      }

      setDriverLocation(newDriverLocation);

      if (data.heading !== undefined && data.heading !== null) {
        setDriverHeading(data.heading);
      } else {
        const prev = prevDriverLocationRef.current;
        const curr: LocationCoords = newDriverLocation;
        if (prev && (prev.latitude !== curr.latitude || prev.longitude !== curr.longitude)) {
          const brng = computeBearing(prev, curr);
          setDriverHeading(brng);
        }
      }
      prevDriverLocationRef.current = newDriverLocation;

      // ========== ACTUALIZACIÓN DINÁMICA DE RUTA ==========
      // Durante 'accepted': ruta conductor → recogida (para ETA/distance precisos por OSRM)
      // Durante 'in_progress': ruta conductor → destino
      const currentStatus = activeRideRef.current?.status;
      const pkUp = pickupLocationRef.current;
      const dest = destinationLocationRef.current;
      if (isDynamicRouteEnabledRef.current) {
        const timeSinceLastUpdate = Date.now() - lastRouteUpdateRef.current;
        const needsImmediate = routeCoordinatesRef.current.length === 0;
        const lastUpdateLoc = lastRouteUpdateLocationRef.current;
        let hasMovedEnough = true;
        if (lastUpdateLoc && timeSinceLastUpdate < 10000) {
          const dLat = newDriverLocation.latitude - lastUpdateLoc.latitude;
          const dLng = (newDriverLocation.longitude - lastUpdateLoc.longitude) * Math.cos(newDriverLocation.latitude * Math.PI / 180);
          const distMeters = Math.sqrt(dLat * dLat + dLng * dLng) * 111320;
          hasMovedEnough = distMeters > 50;
        }
        if (timeSinceLastUpdate > 10000 || needsImmediate || hasMovedEnough) {
          if (currentStatus === 'accepted' && pkUp) {
            lastRouteUpdateLocationRef.current = newDriverLocation;
            updateDynamicRoute(newDriverLocation, pkUp);
          } else if (currentStatus === 'in_progress' && dest) {
            lastRouteUpdateLocationRef.current = newDriverLocation;
            updateDynamicRoute(newDriverLocation, dest);
          }
        }
      }

      // ========== MEJORA 2: Calcular Progreso del Viaje ==========
      if (
        currentStatus === 'in_progress' &&
        dest &&
        initialDistanceToDestinationRef.current > 0
      ) {
        calculateRideProgress(newDriverLocation, dest);
      }
    };

    // Listen for ETA updates
    const handleETAUpdate = (data: any) => {
      console.log('⏱️ ETA update:', data);

      const estimatedMinutes = data.eta.estimatedMinutes;
      const distanceKm = data.eta.distanceKm;

      setActiveRide(prev => ({
        ...prev!,
        eta: {
          estimatedMinutes,
          distanceKm,
        },
      }));

      // Show "driver nearby" notification when driver is close (2 minutes or less, and only for accepted status)
      if (
        !hasShownNearbyNotificationRef.current &&
        activeRideRef.current?.status === 'accepted' &&
        estimatedMinutes <= 2 &&
        estimatedMinutes > 0
      ) {
        setHasShownNearbyNotification(true);
        hasShownNearbyNotificationRef.current = true;
        playNotificationSound();

        showStatus(
          'info',
          `Tu conductor llegara en aproximadamente ${Math.ceil(estimatedMinutes)} minuto${estimatedMinutes > 1 ? 's' : ''}.\n\n` +
            `Preparate para abordar el vehiculo.`,
          'Tu conductor esta cerca'
        );
      }
    };

    // Listen for route point completed (multi-point ride progress)
    const handleRoutePointCompleted = (data: any) => {
      console.log('[PASSENGER] Route point completed:', data);
      if (data.nextPoint) {
        const label = data.nextPoint.pointType === 'pickup' ? 'parada' : 'destino';
        showToast(`Avanzando a la siguiente ${label}`, 'info', 3000);
      } else {
        showToast('Última parada completada, en camino al destino final', 'info', 3000);
      }
    };

    // Listen for driver arrived event (direct notification)
    const handleDriverArrived = (data: any) => {
      console.log('🚗 Driver arrived (direct event):', data);

      // Guard: skip if already notified for this arrival
      if (driverArrivedNotifiedRef.current) {
        console.log('[PASSENGER] Driver arrival already notified — skipping duplicate');
        return;
      }
      driverArrivedNotifiedRef.current = true;

      // Update ride status
      setActiveRide(prev => ({
        ...prev!,
        status: 'arrived',
      }));

      playNotificationSound();
      const arrivedDriverName = activeRideRef.current?.driver?.name || 'Tu conductor';
      showStatus(
        'success',
        `${arrivedDriverName} ha llegado al punto de recogida.`,
        '📍 Conductor en el Punto de Recogida',
        undefined,
        undefined,
        5000
      );
    };

    // Listen for ride cancelled event
    const handleRideCancelled = (data: any) => {
      // CRITICAL: Only handle cancellation for the CURRENT active ride
      // Otherwise, an auto-cancelled previous ride will wipe the active ride's state
      if (data.rideId !== activeRideRef.current?.id) {
        console.log(
          '❌ Cancellation for different ride, ignoring. Cancelled:',
          data.rideId,
          'Active:',
          activeRideRef.current?.id
        );
        return;
      }

      console.log('❌ Ride cancelled:', data);

      // Notification handled globally via useGlobalSocketListeners
      if (data.cancelledBy === 'system') {
        if (paymentTimeoutRef.current) clearTimeout(paymentTimeoutRef.current);
        setShowCancelModal(false);
        // Reset ride state
        setActiveRide(null);
        setDriverLocation(null);
        setIsSearchingDriver(false);
        setPaymentCompleted(false);
        setShowMobilePaymentModal(false);
        setShowPaymentModal(false);
        setShowRatingModal(false);
        setFinalFare(null);
        setPaymentMethod('cash');
        setFareCurrency('VES');
        setShowSecondPickup(false);
        setSecondPickupLocation(null);
        setSecondPickupAddress('');
        setSecondPickupFullAddress('');
        setSecondPickupLocationSource(null);
        setShowSecondDestination(false);
        setSecondDestinationLocation(null);
        setSecondDestinationAddress('');
        setSecondDestinationFullAddress('');
        setSecondDestinationLocationSource(null);
        setCancelReason('');
        setRouteCoordinates([]);
        setNearestRouteIndex(0);
        setDisplayDistance(null);
        setDisplayDuration(null);
        prevDriverLocationRef.current = null;
        setPickupLocation(null);
        setPickupAddress('');
        setPickupFullAddress('');
        setDestinationLocation(null);
        setDestinationAddress('');
        setDestinationFullAddress('');
        setEstimatedFare(null);
        setFareBreakdown(null);
        setIsCalculatingFare(false);
        setZoneInfo(null);
        setHasShownNearbyNotification(false);
        setMapSelectionMode('none');
        setIsEditingPickup(false);
        setIsEditingSecondPickup(false);
        setIsEditingSecondDestination(false);
        acceptedRideIdRef.current = null;

        // Auto-set pickup to current location so user can start a new request immediately
        const systemLoc = currentLocationRef.current;
        if (systemLoc) {
          setPickupLocation(systemLoc);
        }
      } else if (data.cancelledBy === 'driver') {
        if (paymentTimeoutRef.current) clearTimeout(paymentTimeoutRef.current);
        setShowCancelModal(false);
        // Full reset — passenger goes back to the initial state (same as passenger-initiated cancel)
        setActiveRide(null);
        setDriverLocation(null);
        setIsSearchingDriver(false);
        setPaymentCompleted(false);
        setShowMobilePaymentModal(false);
        setShowPaymentModal(false);
        setShowRatingModal(false);
        setFinalFare(null);
        setPaymentMethod('cash');
        setFareCurrency('VES');
        setShowSecondPickup(false);
        setSecondPickupLocation(null);
        setSecondPickupAddress('');
        setSecondPickupFullAddress('');
        setSecondPickupLocationSource(null);
        setShowSecondDestination(false);
        setSecondDestinationLocation(null);
        setSecondDestinationAddress('');
        setSecondDestinationFullAddress('');
        setSecondDestinationLocationSource(null);
        setCancelReason('');
        setRouteCoordinates([]);
        setNearestRouteIndex(0);
        setDisplayDistance(null);
        setDisplayDuration(null);
        prevDriverLocationRef.current = null;
        // Clear map markers
        setPickupLocation(null);
        setPickupAddress('');
        setPickupFullAddress('');
        setDestinationLocation(null);
        setDestinationAddress('');
        setDestinationFullAddress('');
        setEstimatedFare(null);
        setFareBreakdown(null);
        setIsCalculatingFare(false);
        setZoneInfo(null);
        setHasShownNearbyNotification(false);
        setMapSelectionMode('none');
        setIsEditingPickup(false);
        setIsEditingSecondPickup(false);
        setIsEditingSecondDestination(false);

        // Center map on user's current location
        const loc = currentLocationRef.current;
        if (loc && mapRef.current) {
          mapRef.current.animateToRegion(
            {
              latitude: loc.latitude,
              longitude: loc.longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            },
            1000
          );
        }

        // Auto-set pickup to current location so user can start a new request immediately
        if (loc) {
          setPickupLocation(loc);
        }
        acceptedRideIdRef.current = null;
      } else if (data.cancelledBy === 'passenger') {
        // If passenger initiated the cancel, skip the toast (cleanup already handled or will be handled)
        if (passengerInitiatedCancelRef.current) {
          passengerInitiatedCancelRef.current = false;
        } else {
          // Show cancellation fee if applicable
          const feeMessage =
            data.cancellationFee > 0
              ? `\n\nTarifa de cancelación aplicada: ${formatCurrency(data.cancellationFee, fareCurrencyRef.current)}`
              : '';

          showToast(`Tu viaje ha sido cancelado exitosamente.${feeMessage}`, 'info');
        }

        // Reset ride state
        setActiveRide(null);
        setDriverLocation(null);
        setIsSearchingDriver(false);
        setRouteCoordinates([]);
        setNearestRouteIndex(0);
        setDisplayDistance(null);
        setDisplayDuration(null);
        prevDriverLocationRef.current = null;
        setPickupLocation(null);
        setPickupAddress('');
        setPickupFullAddress('');
        setDestinationLocation(null);
        setDestinationAddress('');
        setDestinationFullAddress('');
        setEstimatedFare(null);
        setFareBreakdown(null);
        setFareCurrency('VES');
        setIsCalculatingFare(false);
        setZoneInfo(null);
        setHasShownNearbyNotification(false);
        setMapSelectionMode('none');
        setIsEditingPickup(false);
        setIsEditingSecondPickup(false);
        setIsEditingSecondDestination(false);
        setPaymentCompleted(false);
        setShowMobilePaymentModal(false);
        setShowPaymentModal(false);
        setShowRatingModal(false);
        setFinalFare(null);
        setPaymentMethod('cash');
        setShowSecondPickup(false);
        setSecondPickupLocation(null);
        setSecondPickupAddress('');
        setSecondPickupFullAddress('');
        setSecondPickupLocationSource(null);
        setShowSecondDestination(false);
        setSecondDestinationLocation(null);
        setSecondDestinationAddress('');
        setSecondDestinationFullAddress('');
        setSecondDestinationLocationSource(null);
        setCancelReason('');
        acceptedRideIdRef.current = null;

        // Auto-set pickup to current location so user can start a new request immediately
        const passengerLoc = currentLocationRef.current;
        if (passengerLoc) {
          setPickupLocation(passengerLoc);
        }
      }
    };

    // Listen for ride completed event
    const handleRideCompleted = (data: any) => {
      console.log('[PASSENGER] ========================================');
      console.log('[PASSENGER] ✅ RIDE COMPLETED EVENT RECEIVED');
      console.log('[PASSENGER]    Ride ID:', data.rideId);
      console.log('[PASSENGER]    Current Active Ride ID:', activeRideRef.current?.id);
      console.log('[PASSENGER]    Final Fare:', data.finalFare);
      console.log('[PASSENGER] ========================================');

      // Guard: only process for current active ride
      if (data.rideId !== activeRideRef.current?.id) {
        console.log('[PASSENGER] Ride completed for different ride, ignoring');
        return;
      }

      // Guard: skip if rating was already shown for this ride
      if (ratingShownForRideRef.current === data.rideId) {
        console.log('[PASSENGER] Rating already shown for this ride — skipping duplicate');
        return;
      }
      ratingShownForRideRef.current = data.rideId;

      // Close cancellation modal if open — ride is no longer cancellable
      setShowCancelModal(false);

      // Clear payment timeout — ride is done, no modal needed
      if (paymentTimeoutRef.current) clearTimeout(paymentTimeoutRef.current);

      // Store final fare
      setFinalFare(data.finalFare);

      // Play notification sound
      playNotificationSound();

      // Set ride status to completed (finalize immediately)
      setActiveRide((prev: any) => prev ? { ...prev, status: 'completed' } : null);

      // Clear route from map and driver location immediately
      setRouteCoordinates([]);
      setNearestRouteIndex(0);
      setDriverLocation(null);
      setDisplayDistance(null);
      setDisplayDuration(null);
      setHasShownNearbyNotification(false);

      // Full cleanup of ride request state — like handleRideCancelled does
      setPickupLocation(null);
      setPickupAddress('');
      setPickupFullAddress('');
      setPickupLocationSource(null);
      setDestinationLocation(null);
      setDestinationAddress('');
      setDestinationFullAddress('');
      setDestinationLocationSource(null);
      setEstimatedFare(null);
      setFareBreakdown(null);
      setIsCalculatingFare(false);
      setZoneInfo(null);
      setShowSecondPickup(false);
      setSecondPickupLocation(null);
      setSecondPickupAddress('');
      setSecondPickupFullAddress('');
      setSecondPickupLocationSource(null);
      setShowSecondDestination(false);
      setSecondDestinationLocation(null);
      setSecondDestinationAddress('');
      setSecondDestinationFullAddress('');
      setSecondDestinationLocationSource(null);
      setMapSelectionMode('none');
      setIsEditingPickup(false);
      setIsEditingSecondPickup(false);
      setIsEditingSecondDestination(false);

      // Show text-only notification — no buttons
      const fb = fareBreakdownRef.current;
      const fc = fareCurrencyRef.current;
      const dualInfo = fb?.exchangeRate && fb.exchangeRate > 0
        ? fc === 'USD'
          ? `\n≈ Bs. ${(data.finalFare * fb.exchangeRate).toFixed(2)}`
          : `\n≈ $ ${(data.finalFare / fb.exchangeRate).toFixed(2)}`
        : '';

      showStatus(
        'success',
        `Tu viaje ha finalizado exitosamente.\n\nTarifa Final: ${formatCurrency(data.finalFare, fc)}${dualInfo}`,
        'Viaje Completado',
        undefined,
        undefined,
        4000
      );

      console.log('[PASSENGER] Ride completed — opening rating modal directly');
      setShowRatingModal(true);

      // Auto-redirect back to request ride after 8s if user hasn't interacted with modal
      hasInteractedWithRatingRef.current = false;
      if (rideAutoResetTimeoutRef.current) clearTimeout(rideAutoResetTimeoutRef.current);
      rideAutoResetTimeoutRef.current = setTimeout(() => {
        if (!mountedRef.current) return;
        if (activeRideRef.current?.status === 'completed' && !hasInteractedWithRatingRef.current) {
          console.log('[PASSENGER] Auto-redirecting to request ride after completion');
          handleCloseRatingModal();
        }
      }, 8000);
    };

    // Register event listeners — store cleanup functions individually (no destructive socket.off)
    // NOTE: ride:accepted y ride:status_changed se registran una sola vez (early listeners en el
    // efecto de conexión del socket), se re-registran en cada connect y persisten en reconexiones.
    console.log('[PASSENGER] Registering socket event listeners...');
    rideCleanupRefs.current.driverLocationUpdate = onDriverLocationUpdate(handleDriverLocationUpdate);
    rideCleanupRefs.current.etaUpdate = onETAUpdate(handleETAUpdate);
    rideCleanupRefs.current.driverArrived = onDriverArrived(handleDriverArrived);
    rideCleanupRefs.current.rideCancelled = onRideCancelled(handleRideCancelled);
    rideCleanupRefs.current.rideCompleted = onRideCompleted(handleRideCompleted);
    rideCleanupRefs.current.routePointCompleted = onRoutePointCompleted(handleRoutePointCompleted);
    console.log('[PASSENGER] ✅ All socket event listeners registered');

    // Cleanup listeners when ride ends or component unmounts
    const cleanupAll = () => {
      Object.values(rideCleanupRefs.current).forEach(fn => fn());
      rideCleanupRefs.current = {};
    };

    return () => {
      console.log('[PASSENGER] Cleaning up ride event listeners for ride:', activeRide.id);
      if (rideAutoResetTimeoutRef.current) clearTimeout(rideAutoResetTimeoutRef.current);
      cleanupAll();
      if (activeRide) {
        leaveRide(activeRide.id);
      }
      socket?.off('connect', handleReconnect);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRide?.id, listenerVersion]); // Re-run when ride changes OR app returns to foreground

  // Polling fallback - refreshes ride status every 5s when ride is active
  // Ensures the passenger catches status updates even if socket events are missed
  useEffect(() => {
    if (!activeRide || !activeRide.id) return;
    const activeStatuses = ['pending', 'accepted', 'arrived', 'in_progress', 'completed'];
    if (!activeStatuses.includes(activeRide.status)) return;

    const interval = setInterval(async () => {
      try {
        const currentId = activeRideRef.current?.id;
        const currentStatus = activeRideRef.current?.status;
        if (!currentId) return;
        const res = await rideAPI.getRide(currentId);
        const updated = res.data?.data || res.data;
        const forwardStatusOrder = ['pending', 'accepted', 'arrived', 'in_progress', 'completed'];
        const currentIdx = forwardStatusOrder.indexOf(currentStatus || '');
        const newIdx = forwardStatusOrder.indexOf(updated?.status || '');
        if (updated && updated.status && updated.status !== currentStatus && newIdx > currentIdx) {
          console.log('[PASSENGER] Polling caught status change:', currentStatus, '->', updated.status);

          // If polling detects completed, clean up route and driver location
          if (updated.status === 'completed') {
            setRouteCoordinates([]);
            setNearestRouteIndex(0);
            setDriverLocation(null);
            setDisplayDistance(null);
            setDisplayDuration(null);
            setHasShownNearbyNotification(false);

            // Trigger completion flow (rating modal + auto-reset) if not already done via socket
            if (ratingShownForRideRef.current !== currentId) {
              console.log('[PASSENGER] Polling triggered completion flow for ride', currentId);
              ratingShownForRideRef.current = currentId;
              if (updated.finalFare) setFinalFare(updated.finalFare);
              playNotificationSound();
              setShowRatingModal(true);
              hasInteractedWithRatingRef.current = false;
              if (rideAutoResetTimeoutRef.current) clearTimeout(rideAutoResetTimeoutRef.current);
              rideAutoResetTimeoutRef.current = setTimeout(() => {
                if (!mountedRef.current) return;
                if (activeRideRef.current?.status === 'completed' && !hasInteractedWithRatingRef.current) {
                  console.log('[PASSENGER] Auto-redirecting to request ride after completion (polling)');
                  handleCloseRatingModal();
                }
              }, 8000);
            }
          }

          setActiveRide(prev => prev ? {
            ...prev,
            status: updated.status || prev.status,
            ...(updated.finalFare !== undefined ? { finalFare: updated.finalFare } : {}),
            ...(updated.actualDistanceKm !== undefined ? { actualDistanceKm: updated.actualDistanceKm } : {}),
            ...(updated.actualDurationMinutes !== undefined ? { actualDurationMinutes: updated.actualDurationMinutes } : {}),
            ...(updated.driver !== undefined ? { driver: updated.driver } : {}),
            ...(updated.completedAt ? { completedAt: updated.completedAt } : {}),
            ...(updated.cancelledAt ? { cancelledAt: updated.cancelledAt } : {}),
          } : updated);

          // If the ride moved forward to "accepted", the passenger must confirm
          // payment through the form unless the ride was already paid.
          openPaymentModalIfDue({ id: updated.id, status: updated.status, payment: updated.payment }, updated.estimatedFare ?? updated.finalFare);
        }
      } catch {
        // Silently ignore polling errors
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [activeRide?.id]); // Only depend on rideId — polling runs continuously for the same ride

  // Network recovery — when internet comes back, refresh ride state
  useNetworkRecovery(() => {
    console.log('[PASSENGER] Network recovered — refreshing ride state');
    const s = getSocket();
    if (s && !s.connected) {
      s.connect();
    }
    // Re-fetch active rides to catch up on missed state changes
    rideAPI.getActiveRides().then((res) => {
      const rides = res.data?.data ?? res.data;
      if (rides && Array.isArray(rides) && rides.length > 0) {
        const ride = rides[0];
        if (['pending', 'accepted', 'arrived', 'in_progress'].includes(ride.status)) {
          setActiveRide(prev => {
            if (prev && prev.id === ride.id) return { ...prev, ...ride };
            return ride;
          });
          if (ride.pickupAddress) setPickupAddress(ride.pickupAddress);
          if (ride.destinationAddress) setDestinationAddress(ride.destinationAddress);
          setIsSearchingDriver(ride.status === 'pending');
          // Network-recovered rides in "accepted" state must also confirm payment first.
          openPaymentModalIfDue({ id: ride.id, status: ride.status, payment: ride.payment }, ride.estimatedFare ?? undefined);
        }
      }
      // Force listener re-registration
      setListenerVersion(v => v + 1);
    }).catch(() => {});
  });

  // Clear route when ride ends completely (cancelled or dismissed)
  useEffect(() => {
    if (!activeRide) return;
    if ((activeRide.status === 'cancelled' || !activeRide.status) && routeCoordinates.length > 0) {
      setRouteCoordinates([]);
      setNearestRouteIndex(0);
      setDisplayDistance(null);
      setDisplayDuration(null);
    }
  }, [activeRide?.status]);
  // Fetch route when status transitions to in_progress — driver→destination
  useEffect(() => {
    if (!activeRide || !driverLocation || !isDynamicRouteEnabled) return;

    if (activeRide.status === 'accepted' && pickupLocation && routeCoordinates.length === 0) {
      updateDynamicRoute(driverLocation, pickupLocation);
    } else if (activeRide.status === 'in_progress' && destinationLocation && routeCoordinates.length === 0) {
      updateDynamicRoute(driverLocation, destinationLocation);
    }
  }, [activeRide?.status, listenerVersion, driverLocation]);

  // Camera follows driver during the ride — same navigation experience as driver
  useEffect(() => {
    if (!activeRide || !driverLocation || !mapRef.current) return;
    if (activeRide.status !== 'in_progress') return;

    const heading = routeCoordinates.length >= 2
      ? bearingAlongRoute(routeCoordinates, driverLocation)
      : 0;

    animateNavigationCamera(mapRef, driverLocation, heading, {
      duration: 1000,
      zoom: 17,
    });
  }, [driverLocation?.latitude, driverLocation?.longitude, routeCoordinates, activeRide?.status]);

  // Compute nearest route index for polyline trimming — matches driver behavior
  useEffect(() => {
    if (!driverLocation || routeCoordinates.length < 2) return;
    const idx = computeNearestRouteIndex(routeCoordinates, driverLocation);
    setNearestRouteIndex(idx);
  }, [driverLocation, routeCoordinates]);

  // Shared ride invitation listeners (Req. 7.3, 7.4)
  // These run independently of active rides
  useEffect(() => {
    if (!isSocketConnected) {
      return;
    }

    console.log('[PASSENGER] Registering shared ride invitation listeners...');

    // Handle incoming invitation
    const cleanupInvitationReceived = onSharedRideInvitationReceived(data => {
      console.log('[PASSENGER] Shared ride invitation received:', data);

      // Play notification sound
      playNotificationSound();

      // Set invitation data and show modal
      setCurrentInvitation({
        id: data.invitationId,
        inviterId: data.inviterId,
        inviterName: data.inviterName,
        inviterCode: data.inviterCode,
        pickupPoints: data.pickupPoints,
        destinationPoints: data.destinationPoints,
        estimatedFare: data.estimatedFare,
        currency: (data.currency as Currency) || 'VES',
        expiresAt: data.expiresAt,
      });
      setShowInvitationModal(true);
    });

    // Handle invitation accepted (for the inviter)
    const cleanupInvitationAccepted = onSharedRideInvitationAccepted(data => {
      console.log('[PASSENGER] Shared ride invitation accepted:', data);
      // This would be handled by the inviter's screen
      // For now, just log it
    });

    // Handle invitation rejected (for the inviter)
    const cleanupInvitationRejected = onSharedRideInvitationRejected(data => {
      console.log('[PASSENGER] Shared ride invitation rejected:', data);
      // This would be handled by the inviter's screen
      // For now, just log it
    });

    // Handle invitation expired
    const cleanupInvitationExpired = onSharedRideInvitationExpired(data => {
      console.log('[PASSENGER] Shared ride invitation expired:', data);

      // Close modal if it's still open for this invitation
      if (currentInvitationRef.current?.id === data.invitationId) {
        setShowInvitationModal(false);
        setCurrentInvitation(null);
        showToast('La invitación de viaje compartido ha expirado.', 'info');
      }
    });

    console.log('[PASSENGER] ✅ Shared ride invitation listeners registered');

    return () => {
      console.log('[PASSENGER] Cleaning up shared ride invitation listeners');
      cleanupInvitationReceived();
      cleanupInvitationAccepted();
      cleanupInvitationRejected();
      cleanupInvitationExpired();
    };
  }, [isSocketConnected, currentInvitation?.id, listenerVersion, playNotificationSound, showToast]);

  // Track and send passenger location during active shared ride (Req. 4.10)
  useEffect(() => {
    if (!activeRide?.isShared || !activeRide.id) {
      return;
    }

    // Only track location during active ride states
    if (!['accepted', 'arrived', 'in_progress'].includes(activeRide.status)) {
      return;
    }

    let locationSubscription: LocationSubscription | null = null;

    const startLocationTracking = async () => {
      try {
        const Loc = await getLocation();
        // Request location permissions
        const { status } = await Loc.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          console.warn('[PASSENGER] Location permission not granted for tracking');
          return;
        }

        // Start watching location
        locationSubscription = await Loc.watchPositionAsync(
          {
            accuracy: Loc.Accuracy.BestForNavigation,
            timeInterval: 5000,
            distanceInterval: 10,
          },
          location => {
            const { latitude, longitude } = location.coords;

            // Actualizar posicion en el mapa
            setCurrentLocation({ latitude, longitude });

            // Send location update via socket
            const socket = getSocket();
            if (socket && socket.connected) {
              socket.emit('passenger:location_update', {
                rideId: activeRide.id,
                latitude,
                longitude,
              });

              console.log('[PASSENGER] Location update sent:', { latitude, longitude });
            }
          }
        );

        console.log('[PASSENGER] Started location tracking for shared ride');
      } catch (error) {
        console.error('[PASSENGER] Error starting location tracking:', error);
      }
    };

    startLocationTracking();

    // Cleanup
    return () => {
      if (locationSubscription) {
        locationSubscription.remove();
        console.log('[PASSENGER] Stopped location tracking');
      }
    };
  }, [activeRide?.id, activeRide?.isShared, activeRide?.status]);

  // Continuous passenger location tracking — keeps the map icon precise at all times
  useEffect(() => {
    let locationSubscription: LocationSubscription | null = null;

    const startWatching = async () => {
      try {
        const Loc = await getLocation();
        const { status } = await Loc.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;

        locationSubscription = await Loc.watchPositionAsync(
          {
            accuracy: Loc.Accuracy.BestForNavigation,
            timeInterval: 5000,
            distanceInterval: 10,
          },
          location => {
            const { latitude, longitude } = location.coords;
            if (typeof latitude === 'number' && typeof longitude === 'number') {
              setCurrentLocation({ latitude, longitude });
            }
          }
        );
      } catch (_) {}
    };

    startWatching();

    return () => {
      if (locationSubscription) locationSubscription.remove();
    };
  }, []);

  // ========== MEJORAS: Inicializar cuando el viaje comienza (in_progress) ==========
  useEffect(() => {
    if (!activeRide || !driverLocation || !destinationLocation) {
      return;
    }

    // Cuando el viaje cambia a in_progress, inicializar distancia y buscar landmarks
    if (activeRide.status === 'in_progress') {
      console.log('[RIDE_IMPROVEMENTS] Ride started, initializing improvements...');

      // Mejora 2: Calcular distancia inicial para el indicador de progreso
      const R = 6371;
      const dLat = toRad(destinationLocation.latitude - driverLocation.latitude);
      const dLon = toRad(destinationLocation.longitude - driverLocation.longitude);
      const lat1 = toRad(driverLocation.latitude);
      const lat2 = toRad(destinationLocation.latitude);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const initialDistance = R * c;

      setInitialDistanceToDestination(initialDistance);
      setRideProgress(0); // Iniciar en 0%

      // Show initial Haversine distance immediately while OSRM route loads
      setDisplayDistance(initialDistance);

      console.log(
        '[RIDE_IMPROVEMENTS] Initial distance to destination:',
        initialDistance.toFixed(2),
        'km'
      );

      // Mejora 3: Buscar puntos de interés cercanos
      fetchNearbyLandmarks(driverLocation);

      // Mejora 1: Fetch OSRM route from driver to destination for accurate ETA
      updateDynamicRoute(driverLocation, destinationLocation);
    }

    // Resetear cuando el viaje termina
    if (activeRide.status === 'completed' || activeRide.status === 'cancelled') {
      setInitialDistanceToDestination(0);
      setRideProgress(0);
      setNearbyLandmarks([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRide?.status, driverLocation, destinationLocation]);

  // Handlers for invitation modal
  const handleInvitationAccept = useCallback(
    (invitationId: string, pickupLocation: any) => {
      console.log('[PASSENGER] Invitation accepted:', invitationId, pickupLocation);

      // Close modal
      setShowInvitationModal(false);
      setCurrentInvitation(null);

      // Show success message
      showToast(
        'Has aceptado la invitación. El solicitante confirmará el viaje y se buscará un conductor.',
        'success'
      );
    },
    [showToast]
  );

  const handleInvitationReject = useCallback(
    (invitationId: string) => {
      console.log('[PASSENGER] Invitation rejected:', invitationId);

      // Close modal
      setShowInvitationModal(false);
      setCurrentInvitation(null);

      // Show confirmation message
      showToast('Has rechazado la invitación de viaje compartido.', 'info');
    },
    [showToast]
  );

  const handleInvitationClose = useCallback(() => {
    console.log('[PASSENGER] Invitation modal closed');
    setShowInvitationModal(false);
    // Don't clear currentInvitation here - let it expire naturally or be handled by other events
  }, []);

  const calculateRoute = useCallback(async () => {
    if (!pickupLocation || !destinationLocation) return;

    const version = ++calculateRouteVersionRef.current;
    console.log('[ROUTE] calculateRoute called', { pickupLocation, destinationLocation, currentLocation, version });

    // Build ordered waypoints: Current location → Pickup → Destination
    const waypoints: LocationCoords[] = [];

    try {
      logInfo('PassengerHomeScreen', 'Calculating route with OSRM...', {
        pickup: pickupLocation,
        destination: destinationLocation,
        secondPickup: secondPickupLocation,
        secondDestination: secondDestinationLocation,
      });

      // Start from where the passenger actually is
      if (currentLocation) {
        waypoints.push(currentLocation);
      }
      if (pickupLocation && (!currentLocation || 
          Math.abs(pickupLocation.latitude - currentLocation.latitude) > 0.0001 ||
          Math.abs(pickupLocation.longitude - currentLocation.longitude) > 0.0001)) {
        waypoints.push(pickupLocation);
      }
      if (secondPickupLocation) waypoints.push(secondPickupLocation);
      if (destinationLocation) waypoints.push(destinationLocation);
      if (secondDestinationLocation) waypoints.push(secondDestinationLocation);

      // Si no hay suficientes waypoints, usar solo pickup→destination como fallback
      if (waypoints.length < 2) {
        if (pickupLocation) waypoints.unshift(pickupLocation);
        if (!waypoints.includes(destinationLocation!) && destinationLocation) waypoints.push(destinationLocation);
      }

      let allRouteCoords: RouteCoordinates[] = [];

      if (waypoints.length === 2) {
        // Simple single-segment route
        const routeData = await getRoute(waypoints[0], waypoints[1]);
        if (version !== calculateRouteVersionRef.current) return;
        if (!routeData.polyline || routeData.polyline.length === 0) {
          throw new Error('Empty polyline from API');
        }
        allRouteCoords = routeData.polyline.map((coord: [number, number]) => ({
          latitude: coord[1],
          longitude: coord[0],
        }));
      } else {
        // Multi-segment route: fetch each consecutive segment and concatenate
        for (let i = 0; i < waypoints.length - 1; i++) {
          try {
            const segmentData = await getRoute(waypoints[i], waypoints[i + 1]);
            if (version !== calculateRouteVersionRef.current) return;
            if (!segmentData.polyline || segmentData.polyline.length === 0) {
              throw new Error('Empty polyline from API');
            }
            const segmentCoords: RouteCoordinates[] = segmentData.polyline.map(
              (coord: [number, number]) => ({
                latitude: coord[1],
                longitude: coord[0],
              })
            );
            // Avoid duplicate junction point between segments
            if (allRouteCoords.length > 0 && segmentCoords.length > 0) {
              allRouteCoords = [...allRouteCoords, ...segmentCoords.slice(1)];
            } else {
              allRouteCoords = [...allRouteCoords, ...segmentCoords];
            }
          } catch {
            if (version !== calculateRouteVersionRef.current) return;
            // Fallback: straight line for this segment
            allRouteCoords = [...allRouteCoords, waypoints[i], waypoints[i + 1]];
          }
        }
      }

      if (version !== calculateRouteVersionRef.current) return;
      console.log('[ROUTE] setting routeCoordinates', allRouteCoords.length, 'points');
      setRouteCoordinates(allRouteCoords);

      logInfo('PassengerHomeScreen', 'Route calculated successfully', {
        pointsCount: allRouteCoords.length,
        segments: waypoints.length - 1,
      });

      setIsApproximateRoute(false);

      // Fit map to show the full route including all waypoints
      if (mapRef.current && allRouteCoords.length > 0) {
        mapRef.current.fitToCoordinates(allRouteCoords, {
          edgePadding: { top: 100, right: 50, bottom: 300, left: 50 },
          animated: true,
        });
      }
    } catch (error) {
      if (version !== calculateRouteVersionRef.current) return;
      logError('PassengerHomeScreen', error, { context: 'Calculating route with OSRM' });

      // Fallback to straight line if OSRM fails
      logWarning('PassengerHomeScreen', 'Falling back to straight line route');
      const fallbackRoute = waypoints.length >= 2 ? waypoints : [pickupLocation, destinationLocation].filter(Boolean) as LocationCoords[];
      setRouteCoordinates(fallbackRoute);
      setIsApproximateRoute(true);

      if (mapRef.current) {
        mapRef.current.fitToCoordinates(fallbackRoute, {
          edgePadding: { top: 100, right: 50, bottom: 300, left: 50 },
          animated: true,
        });
      }
    }
  }, [pickupLocation, destinationLocation, secondPickupLocation, secondDestinationLocation, currentLocation]);
  calculateRouteRef.current = calculateRoute;

  // ========== MEJORA 1: Actualización Dinámica de Ruta ==========
  const updateDynamicRoute = useCallback(
    async (driverLoc: LocationCoords, destination: LocationCoords) => {
      try {
        console.log('[DYNAMIC_ROUTE] Updating route from driver to destination');

        const routeData = await getRoute(driverLoc, destination);
        if (!routeData.coordinates || routeData.coordinates.length === 0) {
          console.warn('[DYNAMIC_ROUTE] No coordinates in route data, falling back');
          setRouteCoordinates([driverLoc, destination]);
          setIsApproximateRoute(true);
          setLastRouteUpdate(Date.now());
          setDisplayDistance(null);
          setDisplayDuration(null);
          return;
        }
        // OSRM already includes the destination as the last coordinate
        const newRouteCoords: RouteCoordinates[] = routeData.coordinates;

        setRouteCoordinates(newRouteCoords);
        setLastRouteUpdate(Date.now());
        setDisplayDistance(routeData.distance ?? null);
        setDisplayDuration(routeData.duration ?? null);

        console.log('[DYNAMIC_ROUTE] Route updated successfully', {
          pointsCount: newRouteCoords.length,
        });
      } catch (error) {
        console.error('[DYNAMIC_ROUTE] Failed to update route:', error);
        setLastRouteUpdate(Date.now());
        if (process.env.NODE_ENV !== 'production') {
          showToast('No se pudo actualizar la ruta en el mapa.', 'warning');
        }
      }
    },
    []
  );

  // ========== MEJORA 2: Calcular Progreso del Viaje ==========
  const calculateRideProgress = useCallback(
    (driverLoc: LocationCoords, destination: LocationCoords) => {
      // Calcular distancia actual del conductor al destino usando Haversine
      const R = 6371; // Radio de la Tierra en km
      const dLat = toRad(destination.latitude - driverLoc.latitude);
      const dLon = toRad(destination.longitude - driverLoc.longitude);
      const lat1 = toRad(driverLoc.latitude);
      const lat2 = toRad(destination.latitude);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const currentDistance = R * c;

      const initDist = initialDistanceToDestinationRef.current;
      // Calcular progreso: (distancia inicial - distancia actual) / distancia inicial * 100
      if (initDist > 0) {
        const progress = Math.min(
          100,
          Math.max(
            0,
            ((initDist - currentDistance) / initDist) * 100
          )
        );
        setRideProgress(Math.round(progress));

        console.log('[RIDE_PROGRESS]', {
          initial: initialDistanceToDestination.toFixed(2),
          current: currentDistance.toFixed(2),
          progress: `${progress.toFixed(1)}%`,
        });
      }
    },
    []
  );

  // Resolve dynamic search context from user's current location via reverse geocoding
  useEffect(() => {
    if (!currentLocation) return;
    let cancelled = false;

    (async () => {
      try {
        const loc = await reverseGeocode(currentLocation.latitude, currentLocation.longitude);
        if (!cancelled && loc?.address) {
          // Extract state/region from address (e.g. "Avenida Bolívar, Valencia, Carabobo, 2001, Venezuela")
          const parts = loc.address.split(', ').filter(p => !/^\d+$/.test(p.trim()));
          const countryIdx = parts.findIndex(p => p.toLowerCase().includes('venezuela'));
          if (countryIdx > 0) {
            // Include city (countryIdx-2) and state (countryIdx-1) for more precise context
            // e.g. "San Juan de los Morros, Guárico, Venezuela"
            const city = countryIdx >= 2 ? parts[countryIdx - 2] : null;
            const state = parts[countryIdx - 1];
            const ctx = city
              ? [city, state, 'Venezuela'].filter(Boolean).join(', ')
              : [state, 'Venezuela'].filter(Boolean).join(', ');
            setSearchContext(ctx);
            console.log('[SEARCH_CONTEXT] Resolved:', ctx);
          }
        }
      } catch (error) {
        console.warn('[SEARCH_CONTEXT] Reverse geocode failed, keeping default:', error);
      }
    })();

    return () => { cancelled = true; };
  }, [currentLocation]);

  // ========== MEJORA 3: Buscar Puntos de Interés Cercanos ==========
  const fetchNearbyLandmarks = useCallback(async (location: LocationCoords) => {
    try {
      console.log('[LANDMARKS] Fetching nearby landmarks...');

      // Landmarks conocidos de San Juan de los Morros (hardcoded por ahora)
      const knownLandmarks = [
        {
          id: 'morros',
          name: 'Los Morros',
          latitude: 9.9111,
          longitude: -67.3536,
          type: 'landmark' as const,
        },
        {
          id: 'plaza-bolivar',
          name: 'Plaza Bolívar',
          latitude: 9.9075,
          longitude: -67.3542,
          type: 'landmark' as const,
        },
        {
          id: 'catedral',
          name: 'Catedral de San Juan',
          latitude: 9.9078,
          longitude: -67.354,
          type: 'landmark' as const,
        },
        {
          id: 'terminal',
          name: 'Terminal de Pasajeros',
          latitude: 9.905,
          longitude: -67.36,
          type: 'poi' as const,
        },
      ];

      // Filtrar landmarks que estén dentro de 2km de la ubicación actual
      const nearby = knownLandmarks.filter(landmark => {
        const R = 6371;
        const dLat = toRad(landmark.latitude - location.latitude);
        const dLon = toRad(landmark.longitude - location.longitude);
        const lat1 = toRad(location.latitude);
        const lat2 = toRad(landmark.latitude);
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = R * c;

        return distance <= 2; // Dentro de 2km
      });

      setNearbyLandmarks(nearby);
      console.log('[LANDMARKS] Found', nearby.length, 'nearby landmarks');
    } catch (error) {
      console.error('[LANDMARKS] Failed to fetch landmarks:', error);
    }
  }, []);

  const calculateFareWithZone = useCallback(async () => {
    if (!pickupLocation || !destinationLocation) return;

    // Check if we have multiple destinations
    const hasMultipleDestinations = showSecondDestination && secondDestinationLocation;

    // Calculate total distance locally (Haversine) for all segments
    const R = 6371;
    let totalDistance = 0;

    const haversine = (lat1: number, lng1: number, lat2: number, lng2: number) => {
      const dLat = toRad(lat2 - lat1);
      const dLon = toRad(lng2 - lng1);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(toRad(lat1)) * Math.cos(toRad(lat2));
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    };

    // Determine point sequence
    const hasMultiplePickups = showSecondPickup && secondPickupLocation;
    const points: { lat: number; lng: number }[] = [
      { lat: pickupLocation.latitude, lng: pickupLocation.longitude },
    ];
    if (hasMultiplePickups) {
      points.push({ lat: secondPickupLocation.latitude, lng: secondPickupLocation.longitude });
    }
    points.push({ lat: destinationLocation.latitude, lng: destinationLocation.longitude });
    if (hasMultipleDestinations && secondDestinationLocation) {
      points.push({
        lat: secondDestinationLocation.latitude,
        lng: secondDestinationLocation.longitude,
      });
    }

    for (let i = 0; i < points.length - 1; i++) {
      totalDistance += haversine(
        points[i].lat,
        points[i].lng,
        points[i + 1].lat,
        points[i + 1].lng
      );
    }

    // Estimate duration (rough estimate: 3 min per km)
    const estimatedDuration = totalDistance * 3;

    setIsCalculatingFare(true);

    try {
      const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

      // Build request body
      const hasMultiplePickups = showSecondPickup && secondPickupLocation;
      const isMultiPoint = hasMultiplePickups || hasMultipleDestinations;

      const requestBody: any = {
        distanceKm: totalDistance,
        durationHours: estimatedDuration / 60,
      };

      if (isMultiPoint) {
        // Multi-point: send arrays of points
        const pickupPoints = [
          { latitude: pickupLocation.latitude, longitude: pickupLocation.longitude },
        ];
        if (hasMultiplePickups) {
          pickupPoints.push({
            latitude: secondPickupLocation.latitude,
            longitude: secondPickupLocation.longitude,
          });
        }

        const destPoints = [
          { latitude: destinationLocation.latitude, longitude: destinationLocation.longitude },
        ];
        if (hasMultipleDestinations) {
          destPoints.push({
            latitude: secondDestinationLocation.latitude,
            longitude: secondDestinationLocation.longitude,
          });
        }

        requestBody.pickupPoints = pickupPoints;
        requestBody.destinationPoints = destPoints;
        console.log(
          '[FARE_DEBUG] Sending multi-point request:',
          JSON.stringify({
            pickupPoints,
            destinationPoints: destPoints,
            distanceKm: totalDistance,
          })
        );
      } else {
        // Single point: use individual fields
        requestBody.pickupLat = pickupLocation.latitude;
        requestBody.pickupLng = pickupLocation.longitude;
        requestBody.destinationLat = destinationLocation.latitude;
        requestBody.destinationLng = destinationLocation.longitude;
      }

      // Use the full fare estimation engine (zone matrix + time surcharge)
      const fareController = new AbortController();
      const fareTimeoutId = setTimeout(() => fareController.abort(), 15000);
      const response = await fetch(`${apiUrl}/api/fares/estimate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
        signal: fareController.signal,
      });
      clearTimeout(fareTimeoutId);

      if (!response.ok) {
        throw new Error(`Fare estimate API returned ${response.status}`);
      }

      const result = await response.json();

      if (result.success && result.data) {
        const data = result.data;
        console.log(
          '[FARE_DEBUG] Backend response:',
          JSON.stringify({
            totalPrice: data.totalPrice,
            currency: data.currency,
            totalPriceUSD: data.totalPriceUSD,
            fareType: data.fareType,
            usedFallback: data.usedFallback,
            fallbackType: data.fallbackType,
            originZone: data.originZone,
            destinationZone: data.destinationZone,
            segmentBreakdown: data.segmentBreakdown?.map((s: any) => ({
              from: s.from,
              to: s.to,
              price: s.price,
              usedFallback: s.usedFallback,
              fallbackType: s.fallbackType,
            })),
          })
        );
        setEstimatedFare(data.totalPrice);
        setFareCurrency(data.currency as Currency);
        setZoneInfo({
          zoneId: data.originZone?.id ?? null,
          zoneName: data.originZone?.name ?? null,
          usedFallback: data.usedFallback,
        });

        // Fetch exchange rate for dual-currency display
        let dualPrice: { usd: number; ves: number } | undefined;
        let exchangeRate: number | undefined;
        try {
          const rateResp = await fetch(`${apiUrl}/api/fares/exchange-rate`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (rateResp.ok) {
            const rateResult = await rateResp.json();
            const bcv: number | null = rateResult.data?.bcv ?? null;
            if (bcv && bcv > 0) {
              exchangeRate = bcv;
              if (data.currency === 'USD') {
                dualPrice = {
                  usd: data.totalPrice,
                  ves: Math.round(data.totalPrice * bcv * 100) / 100,
                };
              } else {
                dualPrice = {
                  ves: data.totalPrice,
                  usd: Math.round((data.totalPrice / bcv) * 100) / 100,
                };
              }
            }
          }
        } catch {
          // Exchange rate unavailable — show single currency only
        }

        // Store segment breakdown if available (for multi-point)
        const segmentBreakdown = data.segmentBreakdown || [];
        if (segmentBreakdown.length > 0) {
          console.log(
            '[FareEstimate] Segments:',
            segmentBreakdown.map((s: any) => ({
              from: s.from,
              to: s.to,
              price: s.price,
              distanceKm: s.distanceKm,
            }))
          );
        }

        // Determinar la tarifa base correcta según el tipo
        let baseFareValue = 0;
        if (data.fareType === 'ZONA') {
          baseFareValue = data.priceBreakdown?.fixedPrice ?? 0;
        } else if (data.fareType === 'KILOMETRO' || data.fareType === 'HORA') {
          baseFareValue = data.priceBreakdown?.baseRate ?? 0;
        } else {
          baseFareValue = data.priceBreakdown?.baseRate ?? data.priceBreakdown?.fixedPrice ?? 0;
        }

        setFareBreakdown({
          baseFare: baseFareValue,
          distanceCost: 0,
          durationCost: 0,
          distance: totalDistance,
          duration: estimatedDuration,
          dualPrice,
          exchangeRate,
          timeSurcharge: data.timeSurcharge,
          fareType: data.fareType,
          usedFallback: data.usedFallback,
          fallbackType: data.fallbackType,
          originZoneName: data.originZone?.name,
          destinationZoneName: data.destinationZone?.name,
          segmentBreakdown: segmentBreakdown.length > 0 ? segmentBreakdown : undefined,
        });
      } else {
        throw new Error('Invalid response from fare estimate API');
      }
    } catch {
      logWarning('PassengerHomeScreen', 'Fare estimate API failed — no fare available');
      setEstimatedFare(null);
      setFareBreakdown(null);
      setZoneInfo(null);
    } finally {
      setIsCalculatingFare(false);
    }
  }, [
    pickupLocation,
    destinationLocation,
    secondPickupLocation,
    secondDestinationLocation,
    showSecondPickup,
    showSecondDestination,
    token,
  ]);
  calculateFareWithZoneRef.current = calculateFareWithZone;

  // Calculate route and fare when destination changes
  const isCalculatingRouteRef = useRef(false);
  useEffect(() => {
    console.log('[ROUTE_EFFECT] firing', { pickupLocation, destinationLocation });
    if (!pickupLocation || !destinationLocation) return;
    if (isCalculatingRouteRef.current) return;
    isCalculatingRouteRef.current = true;
    Promise.all([
      calculateRouteRef.current().catch(err =>
        logError('PassengerHomeScreen', err, { context: 'Route calc effect' })
      ),
      calculateFareWithZoneRef.current().catch(err =>
        logError('PassengerHomeScreen', err, { context: 'Fare calc effect' })
      ),
    ]).finally(() => {
      isCalculatingRouteRef.current = false;
    });
  }, [
    pickupLocation,
    destinationLocation,
    secondPickupLocation,
    secondDestinationLocation,
  ]);

  const toRad = (value: number) => (value * Math.PI) / 180;

  /**
   * Handle contact driver - show modal to choose contact method
   */
  const handleContactDriver = () => {
    if (!activeRide?.driver?.phone) {
      showToast('Número de teléfono no disponible', 'error');
      return;
    }
    setShowContactModal(true);
  };

  /**
   * Handle phone call
   */
  const handlePhoneCall = () => {
    if (!activeRide?.driver?.phone) {
      showToast('Número de teléfono no disponible', 'error');
      return;
    }

    setShowContactModal(false);

    // Remove any non-numeric characters except +
    const cleanPhone = activeRide.driver.phone.replace(/[^\d+]/g, '');
    Linking.openURL(`tel:${cleanPhone}`);
  };

  /**
   * Handle WhatsApp call
   */
  const handleWhatsAppCall = () => {
    if (!activeRide?.driver?.phone) {
      showToast('Número de teléfono no disponible', 'error');
      return;
    }

    setShowContactModal(false);

    // Remove any non-numeric characters and format for WhatsApp
    let cleanPhone = activeRide.driver.phone.replace(/[^\d]/g, '');

    // If phone starts with 0, replace with country code (assuming Venezuela +58)
    if (cleanPhone.startsWith('0')) {
      cleanPhone = '58' + cleanPhone.substring(1);
    }

    // If phone doesn't start with country code, add it
    if (!cleanPhone.startsWith('58')) {
      cleanPhone = '58' + cleanPhone;
    }

    // Use universal WhatsApp URL (works with all WhatsApp versions)
    const whatsappUrl = `https://wa.me/${cleanPhone}`;

    // Try to open WhatsApp
    Linking.openURL(whatsappUrl).catch(err => {
      console.error('Error opening WhatsApp:', err);
      showToast('No se pudo abrir WhatsApp. Asegúrate de tener WhatsApp instalado.', 'error');
    });
  };

  /**
   * Extract short address from full address
   * Returns only the first part (street/landmark) without city/state/country
   */
  const extractShortAddress = (fullAddress: string): string => {
    if (!fullAddress) return '';

    // Split by comma and take first 1-2 parts
    const parts = fullAddress.split(',').map(p => p.trim());

    // If first part is very short (like a number), include second part too
    if (parts.length > 1 && parts[0].length < 10) {
      return `${parts[0]}, ${parts[1]}`;
    }

    // Otherwise just return first part
    return parts[0];
  };

  const getRideStatusText = (status: string): string => {
    switch (status) {
      case 'pending':
        return 'Buscando...';
      case 'accepted':
        return 'En camino';
      case 'arrived':
        return 'Ha llegado';
      case 'in_progress':
        return 'En progreso';
      case 'completed':
        return 'Completado';
      case 'cancelled':
        return 'Cancelado';
      default:
        return status;
    }
  };

  const handleSearchDestination = async () => {
    if (!destinationAddress.trim()) {
      showToast('Por favor ingresa una dirección de destino', 'error');
      return;
    }

    Keyboard.dismiss();

    try {
      const userInput = destinationAddress.trim();

      let searchQuery = userInput;
      if (!searchQuery.toLowerCase().includes('venezuela')) {
        searchQuery = `${searchQuery}, ${searchContext}`;
      }

      console.log('[GEOCODING] User input:', userInput);
      console.log('[GEOCODING] Search query:', searchQuery);

      const location = await geocodeAddress(searchQuery, currentLocation?.latitude, currentLocation?.longitude);

      if (!location || !location.latitude || !location.longitude) {
        showStatus(
          'info',
          'Esta dirección aún no está registrada en nuestro mapa. Pronto será agregada.\n\nPor favor, selecciona manualmente la ubicación en el mapa.',
          'Dirección no encontrada',
          undefined,
          { label: 'Seleccionar en mapa', onPress: () => { handleEnableMapSelection('destination'); dismissStatus(); } }
        );
        return;
      }

      console.log('[GEOCODING] Location found:', location);

      setDestinationLocation({
        latitude: location.latitude,
        longitude: location.longitude,
      });
    } catch (error: any) {
      console.error('Geocoding error:', error);
      // If backend fails, prompt user to select on map
      showStatus(
        'info',
        'No se pudo encontrar esa dirección. Intenta buscarla manualmente en el mapa.',
        'Dirección no encontrada',
        undefined,
        { label: 'Seleccionar en mapa', onPress: () => { handleEnableMapSelection('destination'); dismissStatus(); } }
      );
    }
  };

  const handleSearchPickup = async () => {
    if (!pickupAddress.trim()) {
      showToast('Por favor ingresa una dirección de recogida', 'error');
      return;
    }

    Keyboard.dismiss();
    setIsEditingPickup(false);

    try {
      // Keep the original user input
      const userInput = pickupAddress.trim();

      // Build search query with dynamic location context
      let searchQuery = userInput;
      if (!searchQuery.toLowerCase().includes('venezuela')) {
        searchQuery = `${searchQuery}, ${searchContext}`;
      }

      console.log('[PICKUP GEOCODING] User input:', userInput);
      console.log('[PICKUP GEOCODING] Search query:', searchQuery);

      const location = await geocodeAddress(searchQuery, currentLocation?.latitude, currentLocation?.longitude);

      if (!location || !location.latitude || !location.longitude) {
        showStatus(
          'info',
          'Esta dirección aún no está registrada en nuestro mapa. Pronto será agregada.\n\nPor favor, selecciona manualmente la ubicación en el mapa.',
          'Dirección no encontrada',
          undefined,
          { label: 'Seleccionar en mapa', onPress: () => { handleEnableMapSelection('pickup'); dismissStatus(); } }
        );
        return;
      }

      console.log('[PICKUP GEOCODING] Location found:', location);

      setPickupLocation({
        latitude: location.latitude,
        longitude: location.longitude,
      });

      // Keep the original user input in the text field (don't update with full address)
      // The full address is only used internally for accuracy
    } catch (error: any) {
      console.error('Pickup geocoding error:', error);

      // Check if it's a "not found" error or server error (500)
      const isNotFound =
        error.response?.status === 404 ||
        error.response?.status === 500 ||
        error.message?.includes('no encontr') ||
        error.message?.includes('not found') ||
        error.message?.includes('status code 500');

      if (isNotFound) {
        showStatus(
          'info',
          'Esta dirección aún no está registrada en nuestro mapa. Pronto será agregada.\n\nPor favor, selecciona manualmente la ubicación en el mapa.',
          'Dirección no encontrada',
          undefined,
          { label: 'Seleccionar en mapa', onPress: () => { handleEnableMapSelection('pickup'); dismissStatus(); } }
        );
      } else {
        logError('PassengerHomeScreen', error, { context: 'Geocoding pickup' });
        showToast('No se pudo buscar la dirección. Verifica tu conexión.', 'error');
      }
    }
  };

  // Map selection handlers
  const handleEnableMapSelection = (
    mode: 'pickup' | 'destination' | 'second_pickup' | 'second_destination'
  ) => {
    console.log('[MAP_SELECTION] ========================================');
    console.log('[MAP_SELECTION] Enabling map selection mode:', mode);
    console.log('[MAP_SELECTION] Previous mode:', mapSelectionMode);
    console.log('[MAP_SELECTION] ========================================');

    // Set mode FIRST before showing alert
    setMapSelectionMode(mode);
    setTempMarkerLocation(null);
    setIsPanelCollapsed(true);
    Keyboard.dismiss();

    console.log('[MAP_SELECTION] Mode set to:', mode);
    console.log('[MAP_SELECTION] Panel collapsed, ready for selection');
  };

  const handleMapPress = (event: any) => {
    // Normal map press - just collapse panel
    if (!isPanelCollapsed) {
      setIsPanelCollapsed(true);
      Keyboard.dismiss();
    }
  };

  const handleMapLongPress = async (event: any) => {
    console.log('[MAP_LONG_PRESS] ========================================');
    console.log('[MAP_LONG_PRESS] Event received!');
    console.log('[MAP_LONG_PRESS] Event object:', event);
    console.log('[MAP_LONG_PRESS] Has nativeEvent:', !!event?.nativeEvent);
    console.log('[MAP_LONG_PRESS] Has coordinate:', !!event?.nativeEvent?.coordinate);
    console.log('[MAP_LONG_PRESS] Current mode:', mapSelectionMode);
    console.log('[MAP_LONG_PRESS] Mode is none?:', mapSelectionMode === 'none');
    console.log('[MAP_LONG_PRESS] Mode is pickup?:', mapSelectionMode === 'pickup');
    console.log('[MAP_LONG_PRESS] Mode is destination?:', mapSelectionMode === 'destination');
    console.log('[MAP_LONG_PRESS] ========================================');

    if (!event || !event.nativeEvent) {
      console.error('[MAP_LONG_PRESS] Invalid event object');
      showToast('No se pudo capturar la ubicación. Intenta de nuevo.', 'error');
      return;
    }

    const { coordinate } = event.nativeEvent;

    if (!coordinate) {
      console.warn('[MAP_LONG_PRESS] No coordinate in event');
      showToast('No se pudo obtener las coordenadas. Intenta de nuevo.', 'error');
      return;
    }

    console.log('[MAP_LONG_PRESS] Coordinate received:', {
      lat: coordinate.latitude,
      lng: coordinate.longitude,
    });

    // Only handle location selection if in selection mode
    if (mapSelectionMode === 'none') {
      console.log('[MAP_LONG_PRESS] ⚠️ Not in selection mode, ignoring long press');
      console.log('[MAP_LONG_PRESS] Tip: Press the map icon button first to enable selection mode');
      return;
    }

    console.log('[MAP_LONG_PRESS] ✅ Selection mode active:', mapSelectionMode);
    console.log('[MAP_LONG_PRESS] ✅ Coordinate:', coordinate);

    // Show immediate visual feedback
    console.log('[MAP_LONG_PRESS] Setting temp marker...');
    setTempMarkerLocation(coordinate);
    console.log('[MAP_LONG_PRESS] Temp marker set!');

    // Helper: apply the selected location directly — no confirmation needed
    const applySelectedLocation = (loc: LocationCoords, address: string) => {
      const shortAddress = extractShortAddress(address);
      if (mapSelectionMode === 'pickup') {
        setPickupLocation(loc);
        setPickupAddress(shortAddress);
      } else if (mapSelectionMode === 'destination') {
        setDestinationLocation(loc);
        setDestinationAddress(shortAddress);
      } else if (mapSelectionMode === 'second_pickup') {
        setSecondPickupLocation(loc);
        setSecondPickupAddress(shortAddress);
        setSecondPickupLocationSource('custom');
      } else if (mapSelectionMode === 'second_destination') {
        setSecondDestinationLocation(loc);
        setSecondDestinationAddress(shortAddress);
        setSecondDestinationLocationSource('custom');
      }
    };

    try {
      const locationData = await reverseGeocode(coordinate.latitude, coordinate.longitude);
      const address = locationData.address || `${coordinate.latitude.toFixed(6)}, ${coordinate.longitude.toFixed(6)}`;
      console.log('[MAP_LONG_PRESS] Address:', address);
      applySelectedLocation(coordinate, address);
    } catch {
      const address = `${coordinate.latitude.toFixed(6)}, ${coordinate.longitude.toFixed(6)}`;
      applySelectedLocation(coordinate, address);
    }

    setMapSelectionMode('none');
    setTempMarkerLocation(null);
    setIsPanelCollapsed(false);
  };

  const handleCancelMapSelection = () => {
    setMapSelectionMode('none');
    setTempMarkerLocation(null);
    setIsPanelCollapsed(false);
  };

  const handleUseCurrentLocation = async () => {
    if (!currentLocation) {
      showToast('No se pudo obtener tu ubicación actual', 'error');
      return;
    }

    try {
      // Use current location for pickup
      setPickupLocation(currentLocation);
      setIsEditingPickup(false);

      // Get short address for current location
      const locationData = await reverseGeocode(
        currentLocation.latitude,
        currentLocation.longitude
      );

      if (locationData.address) {
        const shortAddress = extractShortAddress(locationData.address);
        setPickupAddress(shortAddress);
      } else {
        setPickupAddress('Ubicación actual');
      }

      // Recalculate route if destination is set
      if (destinationLocation) {
        await calculateRoute();
        calculateFareWithZone();
      }
    } catch (error) {
      console.error('Error using current location:', error);
      setPickupAddress('Ubicación actual');
    }
  };

  const handleCenterOnUserLocation = () => {
    if (!currentLocation) {
      showToast('No se pudo obtener tu ubicación actual', 'error');
      return;
    }

    if (mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        1000
      );
    }
  };

  const handleRecenterOnDriver = () => {
    if (!driverLocation || !mapRef.current) return;
    mapRef.current.animateToRegion(
      {
        latitude: driverLocation.latitude,
        longitude: driverLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      },
      500
    );
    setUserInteractedWithMap(false);
  };

  const handleRequestRide = async () => {
    if (!pickupLocation || !destinationLocation) {
      showToast('Por favor selecciona un destino', 'error');
      return;
    }

    if (!user) {
      showToast('Debes iniciar sesión para solicitar un viaje', 'error');
      return;
    }

    if (isRequestingRideRef.current) return;
    isRequestingRideRef.current = true;
    setIsRequestingRide(true);

    try {
      // Build ordered pickupPoints array: Pickup_1 → Pickup_2 (if exists) — Req. 6.5, 6.7
      const pickupPoints: { latitude: number; longitude: number; address: string }[] = [
        {
          latitude: pickupLocation.latitude,
          longitude: pickupLocation.longitude,
          address: pickupFullAddress || pickupAddress || 'Ubicación actual',
        },
      ];
      if (showSecondPickup && secondPickupLocation) {
        pickupPoints.push({
          latitude: secondPickupLocation.latitude,
          longitude: secondPickupLocation.longitude,
          address: secondPickupFullAddress || secondPickupAddress || 'Segundo punto de recogida',
        });
      }

      // Build ordered destinationPoints array: Destination_1 → Destination_2 (if exists) — Req. 6.5, 6.7
      const destinationPoints: { latitude: number; longitude: number; address: string }[] = [
        {
          latitude: destinationLocation.latitude,
          longitude: destinationLocation.longitude,
          address: destinationFullAddress || destinationAddress,
        },
      ];
      if (showSecondDestination && secondDestinationLocation) {
        destinationPoints.push({
          latitude: secondDestinationLocation.latitude,
          longitude: secondDestinationLocation.longitude,
          address: secondDestinationFullAddress || secondDestinationAddress || 'Segundo destino',
        });
      }

      // Send ride request with default cash payment
      // Payment method will be selected after driver accepts the ride
      const response = await rideAPI.requestRide({
        pickupLatitude: pickupLocation.latitude,
        pickupLongitude: pickupLocation.longitude,
        pickupAddress: pickupFullAddress || pickupAddress || 'Ubicación actual', // Use full address for precision
        destinationLatitude: destinationLocation.latitude,
        destinationLongitude: destinationLocation.longitude,
        destinationAddress: destinationFullAddress || destinationAddress, // Use full address for precision
        vehicleType: vehicleType,
        paymentMethodId: 'cash',
        pickupPoints, // Req. 6.5, 6.7
        destinationPoints, // Req. 6.5, 6.7
      });

      // Set active ride with pending status
      const rideId = response.data.data?.id || response.data.id;

      if (!rideId) {
        console.error('No ride ID in response:', response.data);
        throw new Error('No se recibió el ID del viaje');
      }

      // Sync estimated fare with backend's calculated value (uses full zone matrix engine)
      const estimates = response.data.data?.estimates;
      const backendFare = estimates?.fare ?? response.data.data?.estimatedFare ?? response.data.estimatedFare;
      const backendCurrency = estimates?.currency ?? response.data.data?.currency ?? response.data.currency;
      if (backendFare != null && Number(backendFare) > 0) {
        setEstimatedFare(Number(backendFare));
      }
      if (backendCurrency) {
        setFareCurrency(backendCurrency as any);
      }

      setActiveRide({
        id: rideId,
        status: 'pending',
      });

      // Sync the ref synchronously (not only via effect) to close the theoretical window
      // where a fast ride:accepted could arrive before the effect flushes the ref.
      activeRideRef.current = { id: rideId, status: 'pending' };

      // Show searching driver state
      setIsRequestingRide(false);
      setIsSearchingDriver(true);

      // Show notification banner for searching driver
      showStatus(
        'info',
        'Estamos notificando a conductores cercanos. Te avisaremos cuando un conductor acepte tu viaje.',
        'Buscando conductor...',
        undefined,
        undefined,
        8000
      );

      console.log('✅ Ride requested:', rideId);
    } catch (error: any) {
      console.error('Request ride error:', error);
      logError('PassengerHomeScreen', error, { context: 'Request ride' });
      setIsRequestingRide(false);
      setIsSearchingDriver(false);

      // Handle specific error cases with user-friendly messages
      if (error.response?.status === 404) {
        showToast(
          'Lo sentimos, no hay conductores disponibles en tu área en este momento.',
          'error'
        );
      } else if (error.response?.status === 401) {
        showToast('Tu sesión ha expirado. Por favor, inicia sesión nuevamente.', 'error');
      } else {
        // Log error to console only, don't show to user
        console.error('Error details:', {
          status: error.response?.status,
          message: error.response?.data?.error?.message,
          data: error.response?.data,
        });
        // Don't show technical errors to users
      }
    } finally {
      isRequestingRideRef.current = false;
    }
  };

  const handleCancelSearching = async () => {
    if (!activeRide || !activeRide.id) {
      console.warn('No active ride to cancel');
      // Reset states anyway
      setActiveRide(null);
      setIsSearchingDriver(false);
      setDriverLocation(null);
      setRouteCoordinates([]);
      setNearestRouteIndex(0);
      setDisplayDistance(null);
      setDisplayDuration(null);
      prevDriverLocationRef.current = null;
      setPickupLocation(null);
      setPickupAddress('');
      setPickupFullAddress('');
      setDestinationLocation(null);
      setDestinationAddress('');
      setDestinationFullAddress('');
      setEstimatedFare(null);
      setFareBreakdown(null);
      setIsCalculatingFare(false);
      setZoneInfo(null);
      setHasShownNearbyNotification(false);
      setMapSelectionMode('none');
      setIsEditingPickup(false);
      setIsEditingSecondPickup(false);
      setIsEditingSecondDestination(false);
      setShowSecondPickup(false);
      setSecondPickupLocation(null);
      setSecondPickupAddress('');
      setSecondPickupFullAddress('');
      setSecondPickupLocationSource(null);
      setShowSecondDestination(false);
      setSecondDestinationLocation(null);
      setSecondDestinationAddress('');
      setSecondDestinationFullAddress('');
      setSecondDestinationLocationSource(null);
      acceptedRideIdRef.current = null;

      // Auto-set pickup to current location so user can start a new request immediately
      if (currentLocation) {
        setPickupLocation(currentLocation);
        reverseGeocode(currentLocation.latitude, currentLocation.longitude)
          .then(loc => {
            if (loc?.address) {
              setPickupAddress(loc.address);
              setPickupFullAddress(loc.address);
            }
          })
          .catch(() => {});
      }

      return;
    }

    if (isCancelling) return;
    if (isCancellingRef.current) return;
    isCancellingRef.current = true;
    setIsCancelling(true);
    try {
      console.log('Cancelling ride:', activeRide.id);
      passengerInitiatedCancelRef.current = true;
      await rideAPI.cancelRide(activeRide.id, { reason: 'passenger_cancelled' });

      // Reset states
      setActiveRide(null);
      setIsSearchingDriver(false);
      // Close payment modals too — a late `ride:accepted` for this ride can arrive
      // during the cancel API await above and leave the modal orphaned on screen.
      setShowMobilePaymentModal(false);
      setShowPaymentModal(false);
      setDriverLocation(null);
      setRouteCoordinates([]);
      setNearestRouteIndex(0);
      setDisplayDistance(null);
      setDisplayDuration(null);
      prevDriverLocationRef.current = null;
      setPickupLocation(null);
      setPickupAddress('');
      setPickupFullAddress('');
      setDestinationLocation(null);
      setDestinationAddress('');
      setDestinationFullAddress('');
      setEstimatedFare(null);
      setFareBreakdown(null);
      setIsCalculatingFare(false);
      setZoneInfo(null);
      setHasShownNearbyNotification(false);
      setMapSelectionMode('none');
      setIsEditingPickup(false);
      setIsEditingSecondPickup(false);
      setIsEditingSecondDestination(false);
      setShowSecondPickup(false);
      setSecondPickupLocation(null);
      setSecondPickupAddress('');
      setSecondPickupFullAddress('');
      setSecondPickupLocationSource(null);
      setShowSecondDestination(false);
      setSecondDestinationLocation(null);
      setSecondDestinationAddress('');
      setSecondDestinationFullAddress('');
      setSecondDestinationLocationSource(null);
      acceptedRideIdRef.current = null;

      // Auto-set pickup to current location so user can start a new request immediately
      if (currentLocation) {
        setPickupLocation(currentLocation);
        reverseGeocode(currentLocation.latitude, currentLocation.longitude)
          .then(loc => {
            if (loc?.address) {
              setPickupAddress(loc.address);
              setPickupFullAddress(loc.address);
            }
          })
          .catch(() => {});
      }

      console.log('✅ Ride search cancelled');

    } catch (error: any) {
      console.error('Cancel search error:', error);

      // If ride not found (404), it might have been auto-cancelled
      if (error.response?.status === 404) {
        // Reset states
        setActiveRide(null);
        setIsSearchingDriver(false);
        setDriverLocation(null);
        setRouteCoordinates([]);
        setNearestRouteIndex(0);
        setDisplayDistance(null);
        setDisplayDuration(null);
        prevDriverLocationRef.current = null;
        setPickupLocation(null);
        setPickupAddress('');
        setPickupFullAddress('');
        setDestinationLocation(null);
        setDestinationAddress('');
        setDestinationFullAddress('');
        setEstimatedFare(null);
        setFareBreakdown(null);
        setIsCalculatingFare(false);
        setZoneInfo(null);
        setHasShownNearbyNotification(false);
        setMapSelectionMode('none');
        setIsEditingPickup(false);
        setIsEditingSecondPickup(false);
        setIsEditingSecondDestination(false);
        setShowSecondPickup(false);
        setSecondPickupLocation(null);
        setSecondPickupAddress('');
        setSecondPickupFullAddress('');
        setSecondPickupLocationSource(null);
        setShowSecondDestination(false);
        setSecondDestinationLocation(null);
        setSecondDestinationAddress('');
        setSecondDestinationFullAddress('');
        setSecondDestinationLocationSource(null);
        acceptedRideIdRef.current = null;

        // Auto-set pickup to current location so user can start a new request immediately
        if (currentLocation) {
          setPickupLocation(currentLocation);
          reverseGeocode(currentLocation.latitude, currentLocation.longitude)
            .then(loc => {
              if (loc?.address) {
                setPickupAddress(loc.address);
                setPickupFullAddress(loc.address);
              }
            })
            .catch(() => {});
        }

        showToast('La búsqueda ya ha sido cancelada.', 'info');
      } else {
        showToast('No se pudo cancelar la búsqueda. Por favor, intenta nuevamente.', 'error');
      }
    } finally {
      setIsCancelling(false);
      isCancellingRef.current = false;
    }
  };

  const handleCancelRidePress = () => {
    if (!activeRide) return;

    // Check if we can cancel using the policy
    if (!cancellationPolicy) {
      showToast('No se pudo obtener la política de cancelación', 'error');
      return;
    }

    if (!cancellationPolicy.canCancel) {
      showToast('No es posible cancelar el viaje en este momento', 'error');
      return;
    }

    setShowCancelModal(true);
  };

  const handleConfirmCancellation = async () => {
    if (!activeRide) return;
    if (!cancelReason.trim()) {
      showToast('Debes seleccionar un motivo para cancelar', 'warning');
      return;
    }
    if (isCancelling) return;
    if (isCancellingRef.current) return;
    isCancellingRef.current = true;
    passengerInitiatedCancelRef.current = true;

    // If there's a cancellation fee, warn if passenger has no payment methods registered
    if (cancellationPolicy && cancellationPolicy.fee > 0) {
      try {
        const payResponse = await passengerAPI.getPaymentInfo();
        const info = payResponse.data?.data;
        const hasPagoMovil = info?.pagoMovilPhone && info?.pagoMovilBank && info?.pagoMovilCedula;
        const hasBankTransfer = info?.bankTransferBank && info?.bankTransferAccount;

        if (!hasPagoMovil && !hasBankTransfer) {
          showStatus(
            'info',
            'No tienes método de pago registrado. Ve a tu perfil en la sección de métodos de pago y registra tu método de pago para recibir tu reembolso.',
            'Método de pago requerido'
          );
          // Do NOT block cancellation — just warn and continue
        }
      } catch {
        console.log('Could not verify payment methods, proceeding with cancellation');
      }
    }

    setIsCancelling(true);

    try {
      const response = await rideAPI.cancelRide(activeRide.id, { reason: cancelReason });

      console.log('✅ Ride cancelled:', response.data);

      // Limpiar estado inmediatamente (no depender solo del WebSocket)
      if (paymentTimeoutRef.current) clearTimeout(paymentTimeoutRef.current);
      setActiveRide(null);
      setDriverLocation(null);
      setIsSearchingDriver(false);
      setShowCancelModal(false);
      setIsCancelling(false);
      setPaymentCompleted(false);
      setPaymentMethod('cash');
      setFareCurrency('VES');
      setFinalFare(null);
      setShowRatingModal(false);
      setShowPaymentModal(false);
      setShowMobilePaymentModal(false);
      setShowSecondPickup(false);
      setSecondPickupLocation(null);
      setSecondPickupAddress('');
      setSecondPickupFullAddress('');
      setSecondPickupLocationSource(null);
      setShowSecondDestination(false);
      setSecondDestinationLocation(null);
      setSecondDestinationAddress('');
      setSecondDestinationFullAddress('');
      setSecondDestinationLocationSource(null);
      setCancelReason('');
      setRouteCoordinates([]);
      setNearestRouteIndex(0);
      setDisplayDistance(null);
      setDisplayDuration(null);
      setPickupLocation(null);
      setPickupAddress('');
      setPickupFullAddress('');
      setDestinationLocation(null);
      setDestinationAddress('');
      setDestinationFullAddress('');
      setEstimatedFare(null);
      setFareBreakdown(null);
      setIsCalculatingFare(false);
      setZoneInfo(null);
      setHasShownNearbyNotification(false);
      setMapSelectionMode('none');
      setIsEditingPickup(false);
      setIsEditingSecondPickup(false);
      setIsEditingSecondDestination(false);
      prevDriverLocationRef.current = null;
      acceptedRideIdRef.current = null;

      // Auto-set pickup to current location so user can start a new request immediately
      if (currentLocation) {
        setPickupLocation(currentLocation);
        reverseGeocode(currentLocation.latitude, currentLocation.longitude)
          .then(loc => {
            if (loc?.address) {
              setPickupAddress(loc.address);
              setPickupFullAddress(loc.address);
            }
          })
          .catch(() => {});
      }
    } catch (error: any) {
      console.error('Cancel ride error:', error);
      logError('PassengerHomeScreen', error, { context: 'Cancel ride' });
      setIsCancelling(false);
      passengerInitiatedCancelRef.current = false;

      // Show user-friendly error message
      const errorMessage = error.response?.data?.error?.message
        ? error.response.data.error.message
        : 'No se pudo cancelar el viaje. Por favor intenta nuevamente.';

      showToast(errorMessage, 'error');
    } finally {
      isCancellingRef.current = false;
    }
  };

  const handleCloseCancelModal = () => {
    setShowCancelModal(false);
    setCancelReason('');
  };

  const handleProcessPayment = async () => {
    if (!activeRide) return;
    if (isProcessingPaymentRef.current) return;
    isProcessingPaymentRef.current = true;

    // If cash, call backend to mark payment as completed, then show confirmation
    if (paymentMethod === 'cash') {
      setIsProcessingPayment(true);
      try {
        await paymentAPI.completePayment(activeRide.id, {
          method: 'cash',
          amount: finalFare || estimatedFare || 0,
        });
        console.log('✅ Cash payment completed on backend');
      } catch (error: any) {
        console.error('Cash payment completion error:', error);
        // Still show as completed locally — cash is paid physically at end of ride
      }
      setPaymentCompleted(true);
      setIsProcessingPayment(false);
      isProcessingPaymentRef.current = false;
      return;
    }

    // If Pago Móvil or Bank Transfer, open the MobilePaymentModal with the selected method
    if (paymentMethod === 'pago_movil' || paymentMethod === 'bank_transfer') {
      setIsProcessingPayment(true);
      setShowMobilePaymentModal(true);
      return;
    }

    // Process automatic payment for card or digital wallet
    setIsProcessingPayment(true);

    try {
      const response = await paymentAPI.processPayment(
        activeRide.id,
        paymentMethod // Using payment method type as ID for now
      );

      console.log('✅ Payment processed:', response.data);

      // Mark payment as completed
      setPaymentCompleted(true);
      setIsProcessingPayment(false);
    } catch (error: any) {
      console.error('Payment processing error:', error);
      logError('PassengerHomeScreen', error, { context: 'Process payment' });
      setIsProcessingPayment(false);

      // Show user-friendly error message
      const errorMessage = error.response?.data?.error?.message
        ? error.response.data.error.message
        : 'No se pudo procesar el pago. Por favor intenta nuevamente.';

      showStatus('error', errorMessage, 'No se pudo completar el pago', undefined, {
        label: 'Reintentar',
        onPress: handleProcessPayment,
      });
    } finally {
      isProcessingPaymentRef.current = false;
    }
  };

  const handleClosePaymentModal = () => {
    setShowPaymentModal(false);
    setPaymentCompleted(false);
    setIsProcessingPayment(false);
    isProcessingPaymentRef.current = false;

    // Show rating modal after payment is confirmed
    setShowRatingModal(true);
  };

  const handleMobilePaymentComplete = async (paymentData: {
    method: 'mobile_payment' | 'transfer' | 'cash';
    referenceNumber?: string;
    phoneNumber?: string;
    accountNumber?: string;
    bankName?: string;
    // P2C specific fields
    referencia?: string;
    fecha?: string;
    banco?: string;
    telefono?: string;
    cedula?: string;
    nombrePagador?: string;
    monto?: number;
  }) => {
    if (!activeRide) {
      showToast('No hay un viaje activo', 'error');
      return;
    }
    // Revisión 5: guard defensivo — no re-procesar si el pago ya se completó
    // (protege contra doble envío si el usuario reintenta tras un error).
    if (paymentCompletedRef.current) {
      console.log('[MOBILE_PAYMENT] complete SKIPPED — paymentCompletedRef=true');
      return;
    }
    console.log('[MOBILE_PAYMENT] complete →', {
      method: paymentData.method,
      rideId: activeRide.id,
      state: activeRide.status,
      hasRef: !!paymentData.referencia,
      phone: !!paymentData.telefono,
    });

    try {
      // Cerrar modal y mostrar loading
      setShowMobilePaymentModal(false);
      setIsRequestingRide(true); // Usar el estado de loading existente
      isProcessingPaymentRef.current = false;
      setIsProcessingPayment(false);

      if (paymentData.method === 'mobile_payment' && paymentData.referencia) {
        // P2C payment - already verified by the modal, just show success
        console.log('✅ P2C Payment already verified:', paymentData);

        // Ocultar loading
        setIsRequestingRide(false);

        // Mark payment as completed so ride completion doesn't show payment modal again
        setPaymentCompleted(true);
        paymentCompletedRef.current = true; // Ref síncrono: cierra la ventana de race con paymentCompletedRef (Rev. 5.1)
        acceptedRideIdRef.current = null; // Reset idempotency ref for next ride

        // Confirmation shown by MobilePaymentModal — no duplicate toast here
      } else if (paymentData.method === 'cash') {
        await retryWithBackoff(async () => {
          const response = await paymentAPI.completePayment(activeRide.id, {
            method: 'cash',
            amount: finalFare || estimatedFare || 0,
          });
          return response;
        }, 3, 1500);

        console.log('✅ Cash payment confirmed');

        setIsRequestingRide(false);

        setPaymentCompleted(true);
        paymentCompletedRef.current = true; // Ref síncrono: cierra la ventana de race con paymentCompletedRef (Rev. 5.1)
        acceptedRideIdRef.current = null; // Reset idempotency ref for next ride
      } else {
        await retryWithBackoff(async () => {
          const response = await paymentAPI.completePayment(activeRide.id, {
            method: paymentData.method,
            amount: finalFare || estimatedFare || 0,
            referenceNumber: paymentData.referenceNumber,
            phoneNumber: paymentData.phoneNumber,
            accountNumber: paymentData.accountNumber,
            bankName: paymentData.bankName,
          });
          return response;
        }, 3, 1500);

        console.log('✅ Payment processed successfully');

        setIsRequestingRide(false);

        setPaymentCompleted(true);
        paymentCompletedRef.current = true; // Ref síncrono: cierra la ventana de race con paymentCompletedRef (Rev. 5.1)
        acceptedRideIdRef.current = null; // Reset idempotency ref for next ride

        showToast(
          'Tu pago ha sido procesado exitosamente. El conductor ha sido notificado.',
          'success'
        );
      }
    } catch (error: any) {
      console.error('❌ Payment processing failed:', error);
      setIsRequestingRide(false);

      let errorMessage: string;
      if (isNetworkError(error)) {
        errorMessage = 'Error de conexión. Verifica tu internet e intenta de nuevo.';
      } else if (error?.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error?.message) {
        errorMessage = error.message;
      } else {
        errorMessage = 'No se pudo procesar el pago. Por favor intenta nuevamente.';
      }

      showStatus('error', errorMessage, 'Error al Procesar Pago', undefined, {
        label: 'Reintentar',
        onPress: () => setShowMobilePaymentModal(true),
      });
    }
  };

  const handleMobilePaymentCancel = () => {
    console.log('[MOBILE_PAYMENT] cancel → reset pasajero', { rideId: activeRide?.id, status: activeRide?.status });
    setShowMobilePaymentModal(false);
    isProcessingPaymentRef.current = false;
    setIsProcessingPayment(false);
    // Full state cleanup — same as handleConfirmCancellation
    if (paymentTimeoutRef.current) clearTimeout(paymentTimeoutRef.current);
    setActiveRide(null);
    setDriverLocation(null);
    setIsSearchingDriver(false);
    setPaymentCompleted(false);
    setPaymentMethod('cash');
    setFareCurrency('VES');
    setFinalFare(null);
    setShowRatingModal(false);
    setShowPaymentModal(false);
    setShowSecondPickup(false);
    setSecondPickupLocation(null);
    setSecondPickupAddress('');
    setSecondPickupFullAddress('');
    setSecondPickupLocationSource(null);
    setShowSecondDestination(false);
    setSecondDestinationLocation(null);
    setSecondDestinationAddress('');
    setSecondDestinationFullAddress('');
    setSecondDestinationLocationSource(null);
    setCancelReason('');
    setRouteCoordinates([]);
    setNearestRouteIndex(0);
    setDisplayDistance(null);
    setDisplayDuration(null);
    setPickupLocation(null);
    setPickupAddress('');
    setPickupFullAddress('');
    setDestinationLocation(null);
    setDestinationAddress('');
    setDestinationFullAddress('');
    setEstimatedFare(null);
    setFareBreakdown(null);
    setIsCalculatingFare(false);
    setZoneInfo(null);
    setHasShownNearbyNotification(false);
    setMapSelectionMode('none');
    setIsEditingPickup(false);
    setIsEditingSecondPickup(false);
    setIsEditingSecondDestination(false);
    prevDriverLocationRef.current = null;
    acceptedRideIdRef.current = null;
    // Auto-set pickup to current location so user can start a new request immediately
    if (currentLocation) {
      setPickupLocation(currentLocation);
      reverseGeocode(currentLocation.latitude, currentLocation.longitude)
        .then(loc => {
          if (loc?.address) {
            setPickupAddress(loc.address);
            setPickupFullAddress(loc.address);
          }
        })
        .catch(() => {});
    }
  };

  const handleBeforeMobilePaymentCancel = () => {
    console.log('[MOBILE_PAYMENT] before-cancel (sheet close, sin cancel)');
    passengerInitiatedCancelRef.current = true;
  };

  /**
   * Handle payment method change from cash to pago_movil during an active ride.
   * Called when the passenger completes the mobile payment in the change-payment modal.
   * Requirements: 3.3, 3.5
   */
  const handleChangePaymentComplete = async (paymentData: {
    method: 'mobile_payment' | 'cash';
    referencia?: string;
    fecha?: string;
    banco?: string;
    telefonoP?: string;
    identificacion?: string;
    pagador?: string;
  }) => {
    if (!activeRide) return;

    if (paymentData.method !== 'mobile_payment' || !paymentData.referencia) {
      setShowChangePaymentModal(false);
      return;
    }

    setIsChangingPayment(true);
    setShowChangePaymentModal(false);

    try {
      await rideAPI.changePaymentMethod(activeRide.id, {
        mode: 'pago_movil',
        pagoMovilReference: paymentData.referencia,
        pagoMovilAmount: estimatedFare || 0,
      });

      // Update local ride state (Req. 3.3)
      setActiveRide(prev => (prev ? { ...prev, paymentMode: 'pago_movil' } : prev));

      showToast(
        'Tu método de pago ha sido cambiado a Pago Móvil. El conductor ha sido notificado.',
        'success'
      );
    } catch (error: any) {
      // On failure, keep original method (Req. 3.5)
      const msg =
        error?.response?.data?.message ||
        'No se pudo cambiar el método de pago. Se mantiene el pago en efectivo.';
      showToast(msg, 'error');
    } finally {
      setIsChangingPayment(false);
    }
  };

  const handleChangePaymentCancel = () => {
    setShowChangePaymentModal(false);
  };

  const handleSubmitRating = async () => {
    if (isSubmittingRating) return; // Prevent double-click before state update
    if (isSubmittingRatingRef.current) return;
    if (!activeRide || driverRating === 0) {
      showToast('Por favor selecciona una valoración', 'error');
      return;
    }

    isSubmittingRatingRef.current = true;
    setIsSubmittingRating(true);

    try {
      await retryWithBackoff(async () => {
        await ratingAPI.rateDriver(activeRide!.id, driverRating, driverComment.trim() || undefined);
      }, 3, 1000, 30000);

      console.log('✅ Rating submitted successfully');

      // Close rating modal
      setShowRatingModal(false);

      // Show thank you alert
      showToast('Tu valoración ha sido enviada exitosamente.', 'success');

      handleCloseRatingModal();
    } catch (error: any) {
      console.error('Submit rating error:', error);
      logError('PassengerHomeScreen', error, { context: 'Submit rating' });

      const errorMessage = isNetworkError(error)
        ? 'Error de conexión. Verifica tu internet e intenta calificar de nuevo.'
        : error?.response?.data?.error?.message
          ? error.response.data.error.message
          : 'No se pudo enviar la valoración. Por favor intenta nuevamente.';

      showToast(errorMessage, 'error');
    } finally {
      setIsSubmittingRating(false);
      isSubmittingRatingRef.current = false;
    }
  };

  const handleSkipRating = () => {
    showStatus(
      'info',
      '¿Estás seguro que deseas omitir la valoración del conductor?',
      'Omitir Valoración',
      undefined,
      { label: 'Omitir', onPress: () => { handleCloseRatingModal(); dismissStatus(); } }
    );
  };

  const handleCloseRatingModal = () => {
    if (paymentTimeoutRef.current) clearTimeout(paymentTimeoutRef.current);
    if (rideAutoResetTimeoutRef.current) clearTimeout(rideAutoResetTimeoutRef.current);
    setShowRatingModal(false);
    setDriverRating(0);
    setDriverComment('');
    setFinalFare(null);
    setPaymentCompleted(false);
    setPaymentMethod('cash');
    setFareCurrency('VES');
    ratingShownForRideRef.current = null;
    acceptedRideIdRef.current = null;
    driverArrivedNotifiedRef.current = false;
    hasInteractedWithRatingRef.current = false;

    // Reset ride state completely - return to initial map view
    setActiveRide(null);
    activeRideRef.current = null; // Sync ref immediately to prevent duplicate socket events
    setDriverLocation(null);
    setPickupLocation(null);
    setPickupAddress('');
    setPickupFullAddress(''); // Clear full address
    setPickupLocationSource(null); // Clear custom place source
    setDestinationLocation(null);
    setDestinationAddress('');
    setDestinationFullAddress(''); // Clear full address
    setDestinationLocationSource(null); // Clear custom place source
    // Reset second pickup point
    setShowSecondPickup(false);
    setSecondPickupLocation(null);
    setSecondPickupAddress('');
    setSecondPickupFullAddress('');
    setSecondPickupLocationSource(null);
    // Reset second destination point
    setShowSecondDestination(false);
    setSecondDestinationLocation(null);
    setSecondDestinationAddress('');
    setSecondDestinationFullAddress('');
    setSecondDestinationLocationSource(null);
    setEstimatedFare(null);
    setFareBreakdown(null);
    setRouteCoordinates([]);
    setNearestRouteIndex(0);
    setDisplayDistance(null);
    setDisplayDuration(null);
    setIsSearchingDriver(false);
    setHasShownNearbyNotification(false);
    setZoneInfo(null);
    setIsCalculatingFare(false);
    setMapSelectionMode('none');
    setIsEditingPickup(false);
    setIsEditingSecondPickup(false);
    setIsEditingSecondDestination(false);

    // Center map on user's current location
    if (currentLocation && mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        1000
      );
    }

    // Auto-set pickup to current location so user can start a new request immediately
    if (currentLocation) {
      setPickupLocation(currentLocation);
      reverseGeocode(currentLocation.latitude, currentLocation.longitude)
        .then(loc => {
          if (loc?.address) {
            setPickupAddress(loc.address);
            setPickupFullAddress(loc.address);
          }
        })
        .catch(() => {});
    }
  };

  const showDriverMarker = !!(activeRide?.driver && driverLocation && activeRide.status !== 'completed' && activeRide.status !== 'cancelled');

  // Sincroniza el formulario de pago con el PaymentFormHost del layout (cubre la tab
  // bar y queda sobre los botones del mapa). Se publica en cada render para que el
  // host tenga siempre las props/métodos más frescos mientras el formulario está abierto.
  // OJO: va ANTES de los early-returns (isLoadingLocation / !currentLocation) para no
  // romper el orden de hooks entre renders.
  useEffect(() => {
    if (showMobilePaymentModal) {
      paymentForm.open({
        amount: finalFare || estimatedFare || 0,
        currency: fareCurrency,
        exchangeRate: fareBreakdown?.exchangeRate,
        rideId: activeRide?.id || '',
        passengerName: user?.name || '',
        platformMethod: selectedPlatformMethod,
        onPaymentComplete: handleMobilePaymentComplete,
        onCancel: handleMobilePaymentCancel,
        onBeforeCancel: handleBeforeMobilePaymentCancel,
      });
    } else {
      paymentForm.close();
    }
  });

  // Cierra el formulario si la pantalla se desmonta mientras estaba abierto
  useEffect(() => () => paymentForm.close(), []);

  if (isLoadingLocation) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2FB908" />
        <Text style={styles.loadingText}>Obteniendo ubicación...</Text>
      </View>
    );
  }

  if (!currentLocation) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>No se pudo obtener la ubicación</Text>
        <Text style={styles.errorSubtext}>Por favor verifica los permisos de ubicación</Text>
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <View style={styles.container}>
        {/* Map */}
        <ErrorBoundary
          fallback={
            <View style={styles.mapErrorContainer}>
              <Text style={styles.mapErrorText}>❌ Error loading map</Text>
              <Text style={styles.mapErrorSubtext}>Check Metro Bundler console for details</Text>
            </View>
          }
        >
          <MapView
            ref={mapRef}
            style={styles.map}
            initialCamera={{
              center: {
                latitude: Number(currentLocation.latitude),
                longitude: Number(currentLocation.longitude),
              },
              pitch: 30,
              heading: 0,
              zoom: 16,
            }}
            showsUserLocation={false}
            showsMyLocationButton={false}
            followsUserLocation={false}
            showsCompass={false}
            showsBuildings={true}
            onPress={handleMapPress}
            onLongPress={handleMapLongPress}
            scrollEnabled={true}
            zoomEnabled={true}
            rotateEnabled={true}
            pitchEnabled={true}
            toolbarEnabled={false}
            moveOnMarkerPress={false}
            onPanDrag={() => setUserInteractedWithMap(true)}
            onRegionChangeComplete={() => setUserInteractedWithMap(true)}
          >
            {showDriverMarker && driverLocation && typeof driverLocation.latitude === 'number' && (
              <MemoizedMarker
                coordinate={driverCoord!}
                title="Conductor"
                anchor={{ x: 0.5, y: 0.5 }}
                flat={false}
                rotation={0}
              >
                <DriverTaxiIcon />
              </MemoizedMarker>
            )}

            {/* Pickup marker — shown only during 'accepted' when far from passenger */}
            {pickupLocation && typeof pickupLocation.latitude === 'number' && activeRide?.status === 'accepted' && currentLocation && (
              Math.abs(pickupLocation.latitude - currentLocation.latitude) > 0.0005 ||
              Math.abs(pickupLocation.longitude - currentLocation.longitude) > 0.0005
            ) && (
              <MemoizedMarker
                coordinate={pickupCoord!}
                title="Punto de recogida"
                identifier="pickup"
                anchor={{ x: 0.5, y: 0.5 }}
              >
                <PickupIcon />
              </MemoizedMarker>
            )}

            {/* Ubicacion actual del pasajero — se oculta solo cuando inicia el viaje */}
            {currentLocation && typeof currentLocation.latitude === 'number' && activeRide?.status !== 'in_progress' && (
              <MemoizedMarker
                coordinate={currentCoord!}
                title="Tu ubicacion"
                identifier="passenger_location"
                anchor={{ x: 0.5, y: 0.5 }}
              >
                <PassengerIcon />
              </MemoizedMarker>
            )}

            {/* Destino */}
            {destinationLocation && typeof destinationLocation.latitude === 'number' && (
              <MemoizedMarker
                coordinate={destinationCoord!}
                title="Destino"
                identifier="destination"
                anchor={{ x: 0.5, y: 0.5 }}
              >
                <DropoffIcon />
              </MemoizedMarker>
            )}

            {/* Second Pickup Marker */}
            {showSecondPickup && secondPickupLocation && typeof secondPickupLocation.latitude === 'number' && (
              <MemoizedMarker
                coordinate={secondPickupCoord!}
                title="Segundo punto de recogida"
                identifier="pickup2"
                anchor={{ x: 0.5, y: 0.5 }}
              >
                <PickupIcon />
              </MemoizedMarker>
            )}

            {/* Second Destination Marker */}
            {showSecondDestination && secondDestinationLocation && typeof secondDestinationLocation.latitude === 'number' && (
              <MemoizedMarker
                coordinate={secondDestinationCoord!}
                title="Segundo destino"
                identifier="destination2"
                anchor={{ x: 0.5, y: 0.5 }}
              >
                <DropoffIcon />
              </MemoizedMarker>
            )}

            {/* Route line — shown before ride request, driver approaching, and during trip */}
            {(!activeRide || activeRide.status === 'pending' || activeRide.status === 'accepted' || activeRide.status === 'arrived' || activeRide.status === 'in_progress') && routeCoordinates.length > 1 && (
              <MemoizedPolyline
                key={`route-${routeCoordinates.length}-${nearestRouteIndex}`}
                coordinates={slicedRouteCoords}
                strokeColor={
                  !activeRide || activeRide.status === 'pending' || activeRide.status === 'accepted'
                    ? '#FF8C00'
                    : '#2FB908'
                }
                strokeWidth={isApproximateRoute ? 3 : 4}
                lineCap="round"
                lineJoin="round"
              />
            )}

            {/* Nearby Landmarks */}
            {nearbyLandmarks.map((landmark, index) => (
              <MemoizedMarker
                key={landmark.id || `landmark-${index}`}
                coordinate={{
                  latitude: landmark.latitude,
                  longitude: landmark.longitude,
                }}
                title={landmark.name}
                description={landmark.type === 'landmark' ? 'Punto de referencia' : 'Negocio local'}
                anchor={{ x: 0.5, y: 0.5 }}
              >
                <View style={{ alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 4 }}>
                  <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }} renderToHardwareTextureAndroid={Platform.OS === 'android'}>
                    <Ionicons name={landmark.type === 'landmark' ? 'location' : 'business'} size={20} color="#8B5CF6" />
                  </View>
                </View>
              </MemoizedMarker>
            ))}
          </MapView>
        </ErrorBoundary>

        {/* Center Location Button */}
        <CenterLocationButton
          onPress={handleCenterOnUserLocation}
          disabled={!currentLocation}
          style={[styles.centerLocationButton, { top: insets.top + 4 }]}
        />

        {/* Recenter on Driver Button */}
        {showDriverMarker && userInteractedWithMap && (
          <TouchableOpacity
            style={[styles.recenterDriverButton, { top: insets.top + 44 }]}
            onPress={handleRecenterOnDriver}
            activeOpacity={0.7}
          >
            <Ionicons name="navigate" size={20} color="#fff" />
          </TouchableOpacity>
        )}

        {/* ========== MEJORA 2: Indicador de Progreso Visual ========== */}
        {activeRide && activeRide.status === 'in_progress' && rideProgress > 0 && (
          <View style={[styles.progressContainer, { top: insets.top + 60 }]}>
            <View style={styles.progressHeader}>
              <Ionicons name="navigate-circle" size={20} color="#2FB908" />
              <Text style={styles.progressTitle}>Progreso del viaje</Text>
            </View>
            <View style={styles.progressBarContainer}>
              <View style={[styles.progressBarFill, { width: `${rideProgress}%` }]} />
            </View>
            <Text style={styles.progressText}>{rideProgress}% completado</Text>
          </View>
        )}

        {/* Map Selection Mode Banner */}
        {mapSelectionMode !== 'none' && (
          <View style={styles.mapSelectionBanner}>
            <View style={styles.mapSelectionBannerContent}>
              <View style={styles.mapSelectionIconContainer}>
                <Ionicons name="hand-left" size={24} color="#fff" />
              </View>
              <View style={styles.mapSelectionTextContainer}>
                <Text style={styles.mapSelectionBannerTitle}>Modo de Selección Activo</Text>
                <Text style={styles.mapSelectionBannerText}>
                  Mantén presionado en el mapa para marcar{' '}
                  {mapSelectionMode === 'pickup'
                    ? 'recogida'
                    : mapSelectionMode === 'second_pickup'
                      ? '2do punto de recogida'
                      : mapSelectionMode === 'second_destination'
                        ? '2do punto de destino'
                        : 'destino'}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.mapSelectionCancelButton}
              onPress={handleCancelMapSelection}
            >
              <Ionicons name="close" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        )}

        {/* Search and Request Panel with native keyboard handling */}
        <View style={[styles.panelContainer, isPanelCollapsed && styles.panelContainerCollapsed, showMobilePaymentModal && styles.panelContainerHidden]}>
          {/* Collapsible Handle - Always visible */}
          <TouchableOpacity
            style={styles.panelHeaderCollapsible}
            onPress={() => setIsPanelCollapsed(!isPanelCollapsed)}
            activeOpacity={0.7}
          >
            <View style={styles.panelHandle} />
          </TouchableOpacity>

          {/* Panel Content - Hidden when collapsed */}
          {!isPanelCollapsed && (
            <KeyboardAwareScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.panelContent}
              style={styles.panelScrollView}
              scrollEnabled={true}
              bounces={false}
              overScrollMode="never"
            >
              {/* Active Ride - Driver Info (or completed fallback) */}
              {activeRide && (activeRide.driver || activeRide.status === 'completed') && (paymentCompleted || activeRide.status !== 'accepted') && (
                <View style={styles.ridePanel}>
                  {/* Dynamic title based on status */}
                  <Text style={styles.rideTitle}>
                    {activeRide.status === 'accepted' ? 'Conductor en camino' : 
                     activeRide.status === 'arrived' ? 'El conductor ha llegado' : 
                     activeRide.status === 'in_progress' ? 'Viaje en curso' : 
                     activeRide.status === 'completed' ? 'Viaje Completado' : ''}
                  </Text>

                  {/* Status badge */}
                  <View style={styles.rideStatusRow}>
                    <View style={[styles.rideStatusBadge, activeRide.status === 'accepted' && styles.rideStatusAccepted, activeRide.status === 'arrived' && styles.rideStatusArrived, activeRide.status === 'in_progress' && styles.rideStatusInProgress]}>
                      <Text style={[styles.rideStatusText, activeRide.status === 'accepted' && styles.rideStatusTextAccepted, activeRide.status === 'arrived' && styles.rideStatusTextArrived, activeRide.status === 'in_progress' && styles.rideStatusTextInProgress]}>
                        {getRideStatusText(activeRide.status)}
                      </Text>
                    </View>
                  </View>

                  {/* Botón reapertura de pago — visible mientras viaje aceptado y no pagado */}
                  {activeRide.status === 'accepted' && !paymentCompleted && (
                    <TouchableOpacity
                      style={styles.reopenPaymentBtn}
                      activeOpacity={0.8}
                      onPress={() => {
                        console.log('[PASSENGER] Panel "Pagar ahora" tapped → opening payment modal');
                        openPaymentModalIfDue({ id: activeRide.id, status: 'accepted', payment: null }, estimatedFareRef.current || 0);
                      }}
                    >
                      <Ionicons name="wallet-outline" size={18} color="#fff" />
                      <Text style={styles.reopenPaymentBtnText}>Pagar Ahora</Text>
                    </TouchableOpacity>
                  )}

                  {/* Driver header row — only when driver info exists */}
                  {activeRide.driver && (
                    <View style={styles.rideDriverRow}>
                      <View style={styles.rideDriverAvatar}>
                        {resolveFileUrl(activeRide.driver.profilePhotoUrl) ? (
                          <Image source={{ uri: resolveFileUrl(activeRide.driver.profilePhotoUrl) }} style={styles.rideDriverAvatarImg} />
                        ) : (
                          <Text style={styles.rideDriverAvatarLetter}>{activeRide.driver.name.charAt(0).toUpperCase()}</Text>
                        )}
                      </View>
                      <View style={styles.rideDriverInfo}>
                        <Text style={styles.rideDriverName} numberOfLines={1}>{activeRide.driver.name}</Text>
                        <Text style={styles.rideDriverVehicle} numberOfLines={1}>
                          {activeRide.driver.vehicleModel || 'Vehículo'}
                          {activeRide.driver.vehicleColor ? ` · ${activeRide.driver.vehicleColor}` : ''}
                          {activeRide.driver.licensePlate ? ` · ${activeRide.driver.licensePlate}` : ''}
                        </Text>
                      </View>
                      {typeof activeRide.driver.rating === 'number' && activeRide.driver.rating > 0 && (
                        <View style={styles.rideDriverRatingBox}>
                          <Ionicons name="star" size={12} color="#F89C0A" />
                          <Text style={styles.rideDriverRating}>{activeRide.driver.rating.toFixed(1)}</Text>
                        </View>
                      )}
                    </View>
                  )}

                  {/* Trip info: fare + addresses */}
                  <View style={styles.rideTripInfo}>
                    {/* Fare row with dual display */}
                    <View style={styles.rideTripRow}>
                      <Ionicons name="cash-outline" size={14} color="#6b7280" />
                      <Text style={styles.rideTripLabel}>Tarifa</Text>
                      <Text style={styles.rideTripValue}>{formatCurrency(estimatedFare || 0, fareCurrency)}</Text>
                      {fareBreakdown?.exchangeRate && fareBreakdown.exchangeRate > 0 && (
                        <Text style={styles.rideTripDual}>
                          {fareCurrency === 'VES'
                            ? `≈ $ ${((estimatedFare || 0) / fareBreakdown.exchangeRate).toFixed(2)}`
                            : `≈ Bs. ${((estimatedFare || 0) * fareBreakdown.exchangeRate).toFixed(2)}`}
                        </Text>
                      )}
                    </View>
                    {/* Pickup row */}
                    <View style={styles.rideTripRow}>
                      <View style={styles.rideTripDot} />
                      <Text style={styles.rideTripLabel}>Recogida</Text>
                      <Text style={styles.rideTripValueSm} numberOfLines={1}>{pickupAddress || pickupFullAddress || activeRide?.pickupAddress || 'Ubicación actual'}</Text>
                    </View>
                    {/* Destination row */}
                    <View style={styles.rideTripRow}>
                      <View style={[styles.rideTripDot, { backgroundColor: '#ef4444' }]} />
                      <Text style={styles.rideTripLabel}>Destino</Text>
                      <Text style={styles.rideTripValueSm} numberOfLines={1}>{destinationAddress || destinationFullAddress || activeRide?.destinationAddress || 'No especificado'}</Text>
                    </View>
                  </View>

                  {/* ETA strip — usa OSRM (preciso) cuando está disponible, cae a socket ETA */}
                  {activeRide && (activeRide.status === 'accepted' || activeRide.status === 'in_progress') && (
                    <View style={styles.rideEtaStrip}>
                      <Ionicons name="time-outline" size={14} color="#2FB908" />
                      <Text style={styles.rideEtaText}>
                        {activeRide.status === 'accepted'
                          ? (displayDuration !== null && displayDistance !== null
                              ? `${Math.round(displayDuration)} min · ${displayDistance.toFixed(1)} km`
                              : activeRide.eta
                                ? `${Math.round(activeRide.eta.estimatedMinutes)} min · ${activeRide.eta.distanceKm.toFixed(1)} km`
                                : 'Calculando...')
                          : (displayDuration !== null && displayDistance !== null
                              ? `${Math.round(displayDuration)} min · ${displayDistance.toFixed(1)} km`
                              : 'Calculando...')
                        }
                      </Text>
                      <Text style={styles.rideEtaLabel}>
                        {activeRide.status === 'accepted' ? 'hasta la recogida' : 'hasta el destino'}
                      </Text>
                    </View>
                  )}

                  {/* Action buttons */}
                  <View style={styles.rideActionsRow}>
                    {activeRide.driver && activeRide.status !== 'in_progress' && activeRide.status !== 'completed' && (
                      <TouchableOpacity style={styles.rideBtnCall} onPress={handleContactDriver}>
                        <Ionicons name="call-outline" size={16} color="#fff" />
                        <Text style={styles.rideBtnCallText}>Llamar</Text>
                      </TouchableOpacity>
                    )}

                    {(activeRide.status === 'pending' || activeRide.status === 'accepted' || activeRide.status === 'arrived' || activeRide.status === 'in_progress') && (
                      <TouchableOpacity style={styles.rideBtnCancel} onPress={handleCancelRidePress}>
                        <Text style={styles.rideBtnCancelText}>Cancelar</Text>
                      </TouchableOpacity>
                    )}

                    {activeRide.status === 'completed' && (
                      <TouchableOpacity style={[styles.rideBtnCall, { backgroundColor: '#2FB908', flex: 1 }]} onPress={() => handleCloseRatingModal()}>
                        <Ionicons name="add-circle-outline" size={16} color="#fff" />
                        <Text style={styles.rideBtnCallText}>Solicitar nuevo viaje</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              )}


              {/* Searching for Driver - Professional Loading State */}
              {isSearchingDriver && (
                <View style={styles.searchingDriverContainer}>
                  {/* Animated pulsing ring + car icon */}
                  <View style={styles.searchingIconWrapper}>
                    <Animated.View style={[styles.searchingPulseRing, pulseRingStyle]} />
                    <Animated.View style={[styles.searchingPulseRingInner, pulseRingInnerStyle]} />
                    <View style={styles.searchingIconCircle}>
                      <Ionicons name="car-outline" size={40} color="#2FB908" />
                    </View>
                  </View>

                  {/* Animated loading bar */}
                  <View style={styles.searchingLoadingBar}>
                    <Animated.View style={[styles.searchingLoadingFill, loadingBarStyle]} />
                  </View>

                  <Text style={styles.searchingTitle}>Buscando conductores</Text>
                  <Text style={styles.searchingSubtitle}>
                    Localizando profesionales cercanos a tu ubicación
                  </Text>

                  {/* Search timer */}
                  {searchDuration > 0 && (
                    <View style={styles.searchingTimerRow}>
                      <Ionicons name="time-outline" size={14} color="#9CA3AF" />
                      <Text style={styles.searchingTimerText}>
                        {searchDuration < 60
                          ? `Buscando... ${searchDuration}s`
                          : `Tiempo agotado`}
                      </Text>
                    </View>
                  )}

                  {/* Trip details card */}
                  <View style={styles.searchingTripCard}>
                    <View style={styles.searchingTripRow}>
                      <View style={styles.searchingTripIconBg}>
                        <Ionicons name="location-outline" size={16} color="#2FB908" />
                      </View>
                      <View style={styles.searchingTripContent}>
                        <Text style={styles.searchingTripLabel}>Recogida</Text>
                        <Text style={styles.searchingTripText} numberOfLines={1}>
                          {pickupAddress || 'Ubicación actual'}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.searchingTripDivider} />
                    <View style={styles.searchingTripRow}>
                      <View style={[styles.searchingTripIconBg, { backgroundColor: '#FEF2F2' }]}>
                        <Ionicons name="flag-outline" size={16} color="#EF4444" />
                      </View>
                      <View style={styles.searchingTripContent}>
                        <Text style={styles.searchingTripLabel}>Destino</Text>
                        <Text style={styles.searchingTripText} numberOfLines={1}>
                          {destinationAddress || 'Destino'}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.searchingTripDivider} />
                    <View style={styles.searchingTripRow}>
                      <View style={[styles.searchingTripIconBg, { backgroundColor: '#EFF6FF' }]}>
                        <Ionicons name="cash-outline" size={16} color="#3B82F6" />
                      </View>
                      <View style={styles.searchingTripContent}>
                        <Text style={styles.searchingTripLabel}>Tarifa estimada</Text>
                        <Text style={[styles.searchingTripText, { fontWeight: '600' }]}>
                          {estimatedFare != null
                            ? formatCurrency(estimatedFare, fareCurrency)
                            : 'Calculando...'}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Cancel button */}
                  <TouchableOpacity
                    style={styles.searchingCancelButton}
                    onPress={handleCancelSearching}
                    disabled={isCancelling}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="close-outline" size={18} color="#EF4444" />
                    <Text style={styles.searchingCancelText}>Cancelar búsqueda</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Request Ride Form - Only show when no active ride */}
              {!activeRide && (
                <>
                  {/* Section Title */}
                  <Text style={styles.sectionTitle}>Selecciona tu tipo de vehículo</Text>

                  {/* Vehicle Type Selector */}
                  <View style={styles.vehicleSelector}>
                    <TouchableOpacity
                      style={[
                        styles.vehicleButton,
                        vehicleType === 'taxi' && styles.vehicleButtonActive,
                      ]}
                      onPress={() => setVehicleType('taxi')}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name="car"
                        size={20}
                        color={vehicleType === 'taxi' ? '#fff' : '#6B7280'}
                      />
                      <Text
                        style={[
                          styles.vehicleButtonText,
                          vehicleType === 'taxi' && styles.vehicleButtonTextActive,
                        ]}
                      >
                        Carro
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.vehicleButton,
                        vehicleType === 'moto_taxi' && styles.vehicleButtonActive,
                      ]}
                      onPress={() => setVehicleType('moto_taxi')}
                      activeOpacity={0.8}
                    >
                      {/* Moto SVG icon */}
                      <MotoIcon
                        color={vehicleType === 'moto_taxi' ? '#fff' : '#6B7280'}
                        size={20}
                      />
                      <Text
                        style={[
                          styles.vehicleButtonText,
                          vehicleType === 'moto_taxi' && styles.vehicleButtonTextActive,
                        ]}
                      >
                        Moto
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Moto Quantity Selector */}
                  {vehicleType === 'moto_taxi' && (
                    <>
                      <Text style={styles.sectionTitle}>¿Cuántas motos necesitas?</Text>
                      <View style={styles.motoQuantitySelector}>
                        <TouchableOpacity
                          style={[
                            styles.motoQuantityButton,
                            motoQuantity === 1 && styles.motoQuantityButtonActive,
                          ]}
                          onPress={() => setMotoQuantity(1)}
                          activeOpacity={0.8}
                        >
                          <MotoIcon color={motoQuantity === 1 ? '#fff' : '#6B7280'} size={18} />
                          <Text
                            style={[
                              styles.motoQuantityText,
                              motoQuantity === 1 && styles.motoQuantityTextActive,
                            ]}
                          >
                            1 moto
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[
                            styles.motoQuantityButton,
                            motoQuantity === 2 && styles.motoQuantityButtonActive,
                          ]}
                          onPress={() => setMotoQuantity(2)}
                          activeOpacity={0.8}
                        >
                          <View style={styles.motoQuantityIconRow}>
                            <MotoIcon color={motoQuantity === 2 ? '#fff' : '#6B7280'} size={16} />
                            <MotoIcon color={motoQuantity === 2 ? '#fff' : '#6B7280'} size={16} />
                          </View>
                          <Text
                            style={[
                              styles.motoQuantityText,
                              motoQuantity === 2 && styles.motoQuantityTextActive,
                            ]}
                          >
                            2 motos
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  )}

                  {/* Route Card — pickup + destination unified */}
                  <View style={styles.routeCard}>
                    {/* Pickup row */}
                    <View style={styles.routeRow}>
                      <TouchableOpacity
                        onPress={handleUseCurrentLocation}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="location" size={20} color="#2FB908" />
                      </TouchableOpacity>
                      <View style={styles.routeRowContent}>
                        {isEditingPickup ? (
                          <Suspense fallback={<View style={styles.routeAutocomplete} />}>
                              <AddressAutocomplete
                                value={pickupAddress}
                                onChangeText={setPickupAddress}
                                onSelectPlace={place => {
                                  justSelectedSuggestionRef.current = true;
                                  lastPickupSearchRef.current = place.name;
                                  setPickupLocation({
                                    latitude: place.latitude,
                                    longitude: place.longitude,
                                  });
                                  setPickupAddress(place.name);
                                  setPickupFullAddress(place.description || place.name);
                                  setPickupLocationSource(place.source ?? null);
                                  setShowSearchSuggestions(false);
                                  setSearchSuggestions([]);
                                  setIsEditingPickup(false);
                                }}
                                placeholder="Punto de recogida"
                                currentLocation={currentLocation ?? undefined}
                                bare
                                style={styles.routeAutocomplete}
                                hideSuggestions
                                onFocus={() => setActiveSuggestionField('pickup')}
                                onBlur={() => {
                                  setActiveSuggestionField(null);
                                  setShowSearchSuggestions(false);
                                  setSearchSuggestions([]);
                                }}
                              />
                          </Suspense>
                        ) : (
                          <TouchableOpacity
                            style={styles.routeTextButton}
                            onPress={() => setIsEditingPickup(true)}
                            activeOpacity={0.7}
                          >
                            <Text style={styles.routeLabel}>Punto de recogida</Text>
                            <Text style={styles.routeValue} numberOfLines={1}>
                              {pickupAddress || 'Ubicación actual'}
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                      <View style={styles.routeActions}>
                        <TouchableOpacity
                          style={styles.routeActionBtn}
                          onPress={
                            isEditingPickup ? handleSearchPickup : () => setIsEditingPickup(true)
                          }
                        >
                          <Ionicons
                            name={isEditingPickup ? 'search' : 'pencil'}
                            size={15}
                            color="#2FB908"
                          />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.routeActionBtn}
                          onPress={() => handleEnableMapSelection('pickup')}
                        >
                          <Ionicons name="map-outline" size={15} color="#2FB908" />
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Divider with connector line */}
                    <View style={styles.routeDivider}>
                      <View style={styles.routeConnectorLine} />
                    </View>

                    {/* Second Pickup Row — Oculto para v1.0.0 */}
                    {false && showSecondPickup && (
                      <>
                        <View style={styles.routeRow}>
                          <View style={styles.secondPickupIconContainer}>
                            <SecondPickupIcon size={26} />
                          </View>
                          <View style={styles.routeRowContent}>
                            {isEditingSecondPickup ? (
                              <Suspense fallback={<View style={styles.routeAutocomplete} />}>
                                <AddressAutocomplete
                                  value={secondPickupAddress}
                                  onChangeText={setSecondPickupAddress}
                                  onSelectPlace={place => {
                                    setSecondPickupLocation({
                                      latitude: place.latitude,
                                      longitude: place.longitude,
                                    });
                                    setSecondPickupAddress(place.name);
                                    setSecondPickupFullAddress(place.description || place.name);
                                    setSecondPickupLocationSource(place.source ?? null);
                                    setIsEditingSecondPickup(false);
                                  }}
                                  placeholder="2do punto de recogida"
                                  currentLocation={currentLocation ?? undefined}
                                  bare
                                  style={styles.routeAutocomplete}
                                  hideSuggestions
                                />
                              </Suspense>
                            ) : (
                              <TouchableOpacity
                                style={styles.routeTextButton}
                                onPress={() => setIsEditingSecondPickup(true)}
                                activeOpacity={0.7}
                              >
                                <Text style={styles.routeLabel}>2do punto de recogida</Text>
                                <Text style={styles.routeValue} numberOfLines={1}>
                                  {secondPickupAddress || 'Seleccionar ubicación'}
                                </Text>
                              </TouchableOpacity>
                            )}
                          </View>
                          <View style={styles.routeActions}>
                            <TouchableOpacity
                              style={styles.routeActionBtn}
                              onPress={
                                isEditingSecondPickup
                                  ? async () => {
                                      if (!secondPickupAddress.trim()) return;
                                      try {
                                        const loc = await geocodeAddress(
                                          secondPickupAddress + `, ${searchContext}`
                                        );
                                        if (loc) {
                                          setSecondPickupLocation({
                                            latitude: loc.latitude,
                                            longitude: loc.longitude,
                                          });
                                          setIsEditingSecondPickup(false);
                                        }
                                      } catch {
                                        /* ignore */
                                      }
                                    }
                                  : () => setIsEditingSecondPickup(true)
                              }
                            >
                              <Ionicons
                                name={isEditingSecondPickup ? 'search' : 'pencil'}
                                size={15}
                                color="#6366f1"
                              />
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.routeActionBtn}
                              onPress={() => handleEnableMapSelection('second_pickup')}
                            >
                              <Ionicons name="map-outline" size={15} color="#6366f1" />
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.routeActionBtn}
                              onPress={() => {
                                setShowSecondPickup(false);
                                setSecondPickupLocation(null);
                                setSecondPickupAddress('');
                                setSecondPickupFullAddress('');
                                setSecondPickupLocationSource(null);
                              }}
                            >
                              <Ionicons name="close" size={15} color="#EF4444" />
                            </TouchableOpacity>
                          </View>
                        </View>

                        {/* Divider */}
                        <View style={styles.routeDivider}>
                          <View style={styles.routeConnectorLine} />
                        </View>
                      </>
                    )}

                    {/* Destination row */}
                    <View style={styles.routeRow}>
                      <Ionicons name="location" size={20} color="#2FB908" />
                      <View style={styles.routeRowContent}>
                        <Suspense fallback={<View style={styles.routeAutocomplete} />}>
                          <AddressAutocomplete
                            value={destinationAddress}
                            onChangeText={setDestinationAddress}
                            onSelectPlace={place => {
                              justSelectedSuggestionRef.current = true;
                              lastDestinationSearchRef.current = place.name;
                              setDestinationLocation({
                                latitude: place.latitude,
                                longitude: place.longitude,
                              });
                              setDestinationAddress(place.name);
                              setDestinationFullAddress(place.description || place.name);
                              setDestinationLocationSource(place.source ?? null);
                              setShowSearchSuggestions(false);
                              setSearchSuggestions([]);
                            }}
                            placeholder="¿A dónde vas?"
                            currentLocation={currentLocation ?? undefined}
                            bare
                            style={styles.routeAutocomplete}
                            hideSuggestions
                            onFocus={() => setActiveSuggestionField('destination')}
                            onBlur={() => {
                              setActiveSuggestionField(null);
                              setShowSearchSuggestions(false);
                              setSearchSuggestions([]);
                            }}
                          />
                        </Suspense>
                      </View>
                      <View style={styles.routeActions}>
                        <TouchableOpacity
                          style={styles.routeActionBtn}
                          onPress={handleSearchDestination}
                        >
                          <Ionicons name="search" size={15} color="#2FB908" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.routeActionBtn}
                          onPress={() => handleEnableMapSelection('destination')}
                        >
                          <Ionicons name="map-outline" size={15} color="#2FB908" />
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Shared suggestions panel — below all route rows */}
                    {showSearchSuggestions && searchSuggestions.length > 0 && (
                      <View style={styles.sharedSuggestionsPanel}>
                        <ScrollView
                          keyboardShouldPersistTaps="always"
                          scrollEnabled={searchSuggestions.length > 0}
                          showsVerticalScrollIndicator={searchSuggestions.length > 0}
                          nestedScrollEnabled
                        >
                          {searchSuggestions.map((item, index) => (
                            <React.Fragment key={item.id}>
                              {index > 0 && <View style={styles.sharedSuggestionsSeparator} />}
                              <TouchableOpacity
                                style={styles.sharedSuggestionsItem}
                                onPress={() => {
                                  justSelectedSuggestionRef.current = true;
                                  if (activeSuggestionField === 'pickup') {
                                    lastPickupSearchRef.current = item.name;
                                    setPickupLocation({
                                      latitude: item.latitude,
                                      longitude: item.longitude,
                                    });
                                    setPickupAddress(item.name);
                                    setPickupFullAddress(item.description || item.name);
                                    setPickupLocationSource(item.source ?? null);
                                    setIsEditingPickup(false);
                                  } else {
                                    lastDestinationSearchRef.current = item.name;
                                    setDestinationLocation({
                                      latitude: item.latitude,
                                      longitude: item.longitude,
                                    });
                                    setDestinationAddress(item.name);
                                    setDestinationFullAddress(item.description || item.name);
                                    setDestinationLocationSource(item.source ?? null);
                                  }
                                  setShowSearchSuggestions(false);
                                  setSearchSuggestions([]);
                                  setActiveSuggestionField(null);
                                  Keyboard.dismiss();
                                }}
                                activeOpacity={0.7}
                              >
                                <Ionicons
                                  name="location-outline"
                                  size={16}
                                  color="#9CA3AF"
                                  style={styles.sharedSuggestionsIcon}
                                />
                                <View style={styles.sharedSuggestionsTextContainer}>
                                  <Text
                                    style={styles.sharedSuggestionsName}
                                    numberOfLines={1}
                                    ellipsizeMode="tail"
                                  >
                                    {item.name}
                                  </Text>
                                  {item.description ? (
                                    <Text
                                      style={styles.sharedSuggestionsDescription}
                                      numberOfLines={1}
                                      ellipsizeMode="tail"
                                    >
                                      {item.description}
                                    </Text>
                                  ) : null}
                                </View>
                              </TouchableOpacity>
                            </React.Fragment>
                          ))}
                        </ScrollView>
                      </View>
                    )}

                    {/* Second Destination Row — Oculto para v1.0.0 */}
                    {false && showSecondDestination && (
                      <>
                        {/* Divider */}
                        <View style={styles.routeDivider}>
                          <View style={styles.routeConnectorLine} />
                        </View>

                        <View style={styles.routeRow}>
                          <View style={styles.secondDestinationIconContainer}>
                            <SecondDropoffIcon size={26} />
                          </View>
                          <View style={styles.routeRowContent}>
                            {isEditingSecondDestination ? (
                              <Suspense fallback={<View style={styles.routeAutocomplete} />}>
                                <AddressAutocomplete
                                  value={secondDestinationAddress}
                                  onChangeText={setSecondDestinationAddress}
                                  onSelectPlace={place => {
                                    setSecondDestinationLocation({
                                      latitude: place.latitude,
                                      longitude: place.longitude,
                                    });
                                    setSecondDestinationAddress(place.name);
                                    setSecondDestinationFullAddress(place.description || place.name);
                                    setSecondDestinationLocationSource(place.source ?? null);
                                    setIsEditingSecondDestination(false);
                                  }}
                                  placeholder="2do punto de destino"
                                  currentLocation={currentLocation ?? undefined}
                                  bare
                                  style={styles.routeAutocomplete}
                                  hideSuggestions
                                />
                              </Suspense>
                            ) : (
                              <TouchableOpacity
                                style={styles.routeTextButton}
                                onPress={() => setIsEditingSecondDestination(true)}
                                activeOpacity={0.7}
                              >
                                <Text style={styles.routeLabel}>2do punto de destino</Text>
                                <Text style={styles.routeValue} numberOfLines={1}>
                                  {secondDestinationAddress || 'Seleccionar ubicación'}
                                </Text>
                              </TouchableOpacity>
                            )}
                          </View>
                          <View style={styles.routeActions}>
                            <TouchableOpacity
                              style={styles.routeActionBtn}
                              onPress={
                                isEditingSecondDestination
                                  ? async () => {
                                      if (!secondDestinationAddress.trim()) return;
                                      try {
                                        const loc = await geocodeAddress(
                                          secondDestinationAddress + `, ${searchContext}`
                                        );
                                        if (loc) {
                                          setSecondDestinationLocation({
                                            latitude: loc.latitude,
                                            longitude: loc.longitude,
                                          });
                                          setIsEditingSecondDestination(false);
                                        }
                                      } catch {
                                        /* ignore */
                                      }
                                    }
                                  : () => setIsEditingSecondDestination(true)
                              }
                            >
                              <Ionicons
                                name={isEditingSecondDestination ? 'search' : 'pencil'}
                                size={15}
                                color="#e11d48"
                              />
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.routeActionBtn}
                              onPress={() => handleEnableMapSelection('second_destination')}
                            >
                              <Ionicons name="map-outline" size={15} color="#e11d48" />
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.routeActionBtn}
                              onPress={() => {
                                setShowSecondDestination(false);
                                setSecondDestinationLocation(null);
                                setSecondDestinationAddress('');
                                setSecondDestinationFullAddress('');
                                setSecondDestinationLocationSource(null);
                              }}
                            >
                              <Ionicons name="close" size={15} color="#EF4444" />
                            </TouchableOpacity>
                          </View>
                        </View>
                      </>
                    )}
                  </View>

                  {/* Buttons for adding extra points — Oculto para v1.0.0 */}
                  {false && (
                  <View style={styles.addPointsContainer}>
                    {!showSecondPickup && (
                      <TouchableOpacity
                        style={styles.addPointButton}
                        onPress={() => setShowSecondPickup(true)}
                        activeOpacity={0.7}
                      >
                        <SecondPickupIcon size={26} color="#2FB908" />
                        <Text style={styles.addPointButtonText}>+ Punto de Recogida</Text>
                      </TouchableOpacity>
                    )}

                    {!showSecondDestination && (
                      <TouchableOpacity
                        style={styles.addPointButton}
                        onPress={() => setShowSecondDestination(true)}
                        activeOpacity={0.7}
                      >
                        <SecondDropoffIcon size={26} color="#2FB908" />
                        <Text style={styles.addPointButtonText}>+ Punto de Destino</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  )}

                  {/* Fare Estimate */}
                  {isCalculatingFare && (
                    <View style={styles.fareLoadingContainer}>
                      <ActivityIndicator size="small" color="#2FB908" />
                      <Text style={styles.fareLoadingText}>Calculando tarifa...</Text>
                    </View>
                  )}

                  {estimatedFare !== null && fareBreakdown && !isCalculatingFare && (
                    <View style={styles.fareContainer}>
                      {/* Zone Badge - shows fare source */}
                      <View style={styles.zoneBadge}>
                        <Ionicons
                          name={fareBreakdown.usedFallback ? 'pricetag' : 'grid'}
                          size={14}
                          color="#2FB908"
                        />
                        <Text style={styles.zoneBadgeText}>
                          {fareBreakdown.segmentBreakdown &&
                          fareBreakdown.segmentBreakdown.length > 1
                            ? 'Tarifa multipunto'
                            : fareBreakdown.fallbackType === 'zone_origin'
                              ? fareBreakdown.originZoneName || 'Tarifa de zona'
                              : fareBreakdown.fallbackType === 'zone_destination'
                                ? fareBreakdown.destinationZoneName || 'Tarifa de zona'
                                : fareBreakdown.fallbackType === 'policy_default'
                                  ? 'Tarifa base'
                                  : fareBreakdown.fareType === 'ZONA'
                                    ? fareBreakdown.originZoneName || 'Tarifa de zona'
                                    : 'Tarifa estimada'}
                          {fareBreakdown.timeSurcharge?.applied ? ' + Recargo' : ''}
                        </Text>
                      </View>

                      {/* Time Surcharge Indicator - only when zone name is shown and surcharge applies */}
                      {zoneInfo?.zoneName &&
                        zoneInfo.zoneName !== 'Desconocida' &&
                        fareBreakdown.timeSurcharge?.applied && (
                          <View style={styles.surchargeIndicator}>
                            <Ionicons name="time" size={12} color="#F89C0A" />
                            <Text style={styles.surchargeText}>
                              + Recargo de horario (
                              {fareBreakdown.timeSurcharge.type === 'percentage'
                                ? `${fareBreakdown.timeSurcharge.value}%`
                                : formatCurrency(fareBreakdown.timeSurcharge.value, fareCurrency)}
                              )
                            </Text>
                          </View>
                        )}

                      {/* Trip Info: Distance and Duration */}
                      {(fareBreakdown.distance || fareBreakdown.duration) && (
                        <View style={styles.tripInfoContainer}>
                          {fareBreakdown.distance && (
                            <View style={styles.tripInfoItem}>
                              <Ionicons name="navigate-outline" size={16} color="#6b7280" />
                              <Text style={styles.tripInfoText}>
                                {fareBreakdown.distance.toFixed(1)} km
                              </Text>
                            </View>
                          )}
                          {fareBreakdown.duration && (
                            <View style={styles.tripInfoItem}>
                              <Ionicons name="time-outline" size={16} color="#6b7280" />
                              <Text style={styles.tripInfoText}>
                                {Math.round(fareBreakdown.duration)} min
                              </Text>
                            </View>
                          )}
                        </View>
                      )}

                      <View style={styles.fareHeader}>
                        <Text style={styles.fareLabel}>Tarifa estimada:</Text>
                        <Text style={styles.fareAmount}>
                          {formatCurrency(estimatedFare, fareCurrency)}
                        </Text>
                      </View>

                      {/* Fare Breakdown */}
                      <View style={styles.fareBreakdown}>
                        {/* Multi-point segment breakdown */}
                        {fareBreakdown.segmentBreakdown &&
                        fareBreakdown.segmentBreakdown.length > 1 ? (
                          <>
                            {fareBreakdown.segmentBreakdown.map((seg, idx) => {
                              let label: string;
                              let showPrice = true;
                              if (seg.fallbackType === 'destination_segment') {
                                label = `${seg.from} → ${seg.to}`;
                                showPrice = false;
                              } else if (!seg.usedFallback) {
                                label = `${seg.from} → ${seg.to}`;
                              } else if (seg.fallbackType === 'zone_origin') {
                                label = `${seg.from}`;
                              } else if (seg.fallbackType === 'zone_destination') {
                                label = `${seg.to}`;
                              } else if (seg.fallbackType === 'policy_default') {
                                label = `Tarifa base`;
                              } else {
                                label = `${seg.from} → ${seg.to}`;
                              }
                              return (
                                <View key={idx} style={styles.fareBreakdownRow}>
                                  <Text style={styles.fareBreakdownLabel}>{label}:</Text>
                                  <Text style={styles.fareBreakdownValue}>
                                    {showPrice ? formatCurrency(seg.price, 'VES') : 'Cubierto'}
                                  </Text>
                                </View>
                              );
                            })}
                            <View
                              style={[
                                styles.fareBreakdownRow,
                                { borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingTop: 6 },
                              ]}
                            >
                              <Text style={[styles.fareBreakdownLabel, { fontWeight: '700' }]}>
                                Total:
                              </Text>
                              <Text style={[styles.fareBreakdownValue, { fontWeight: '700' }]}>
                                {formatCurrency(estimatedFare, fareCurrency)}
                              </Text>
                            </View>
                          </>
                        ) : (
                          /* Single destination fare source */
                          <View style={styles.fareBreakdownRow}>
                            <Text style={styles.fareBreakdownLabel}>
                              {fareBreakdown.fallbackType === 'zone_origin'
                                ? `${fareBreakdown.originZoneName || ''}:`
                                : fareBreakdown.fallbackType === 'zone_destination'
                                  ? `${fareBreakdown.destinationZoneName || ''}:`
                                  : fareBreakdown.fallbackType === 'policy_default'
                                    ? 'Tarifa base:'
                                    : fareBreakdown.fareType === 'ZONA'
                                      ? 'Tarifa de zona:'
                                      : 'Tarifa:'}
                            </Text>
                            <Text style={styles.fareBreakdownValue}>
                              {formatCurrency(fareBreakdown.baseFare, fareCurrency)}
                            </Text>
                          </View>
                        )}
                        {/* Time Surcharge Breakdown */}
                        {fareBreakdown.timeSurcharge?.applied && (
                          <View style={styles.fareBreakdownRow}>
                            <Text style={styles.fareBreakdownLabel}>
                              Recargo de horario (
                              {fareBreakdown.timeSurcharge.type === 'percentage'
                                ? `${fareBreakdown.timeSurcharge.value}%`
                                : 'fijo'}
                              ):
                            </Text>
                            <Text style={styles.fareBreakdownValue}>
                              {formatCurrency(fareBreakdown.timeSurcharge.amount, fareCurrency)}
                            </Text>
                          </View>
                        )}
                        {fareBreakdown.dualPrice && (
                          <View style={styles.fareBreakdownRow}>
                            <Text style={styles.fareBreakdownValue}>
                              {fareCurrency === 'USD'
                                ? `Bs. ${fareBreakdown.dualPrice.ves.toFixed(2)}`
                                : `$ ${fareBreakdown.dualPrice.usd.toFixed(2)}`}
                            </Text>
                          </View>
                        )}
                        {fareBreakdown.exchangeRate && (
                          <Text style={styles.fareExchangeRate}>
                            Tasa BCV: Bs. {fareBreakdown.exchangeRate.toFixed(2)} / USD
                          </Text>
                        )}
                      </View>
                    </View>
                  )}

                  {/* Request Ride Button */}
                  <TouchableOpacity
                    style={[
                      styles.requestButton,
                      destinationLocation &&
                        !isRequestingRide &&
                        !isSearchingDriver &&
                        styles.requestButtonEnabled,
                      (!destinationLocation || isRequestingRide || isSearchingDriver) &&
                        styles.requestButtonDisabled,
                    ]}
                    onPress={handleRequestRide}
                    disabled={!destinationLocation || isRequestingRide || isSearchingDriver}
                  >
                    {isRequestingRide ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.requestButtonText}>Solicitar Viaje</Text>
                    )}
                  </TouchableOpacity>
                </>
              )}
            </KeyboardAwareScrollView>
          )}
        </View>

        {/* Cancellation Confirmation Modal */}
        <Modal
          visible={showCancelModal}
          transparent={true}
          animationType="fade"
          onRequestClose={handleCloseCancelModal}
        >
          <View style={[styles.modalOverlay, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.cancelModalContent}>
              <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
              {/* Header */}
              <View style={styles.cancelModalHeader}>
                <Ionicons name="alert-circle-outline" size={32} color="#6b7280" />
                <Text style={styles.cancelModalTitle}>Confirmar cancelación</Text>
                {cancellationPolicy && (
                  <Text style={styles.cancelModalSubtitle}>
                    {cancellationPolicy.type === 'free'
                      ? 'La cancelación es gratuita en este momento'
                      : cancellationPolicy.type === 'standard'
                        ? 'Se aplicará la tarifa de cancelación configurada'
                        : 'Se aplicará una penalización'}
                  </Text>
                )}
              </View>

              {/* Fare breakdown card */}
              {cancellationPolicy && cancellationPolicy.fee > 0 && (
                <View style={styles.cancelFeeCard}>
                  <View style={styles.cancelFeeRow}>
                    <Text style={styles.cancelFeeLabel}>
                      {cancellationPolicy.type === 'penalty' ? 'Penalización' : 'Tarifa'}
                    </Text>
                    <Text style={styles.cancelFeeAmount}>
                      {formatCurrency(cancellationPolicy.fee, fareCurrency)}
                    </Text>
                  </View>
                  <View style={styles.cancelFeeDualRow}>
                    {fareCurrency === 'VES' ? (
                      <Text style={styles.cancelFeeDualText}>
                        ≈ {cancellationPolicy?.exchangeRate && cancellationPolicy.exchangeRate > 0
                          ? `$ ${(cancellationPolicy.fee / cancellationPolicy.exchangeRate).toFixed(2)} USD`
                          : '$ —.— USD'}
                      </Text>
                    ) : (
                      <Text style={styles.cancelFeeDualText}>
                        ≈ {cancellationPolicy?.exchangeRate && cancellationPolicy.exchangeRate > 0
                          ? `Bs. ${(cancellationPolicy.fee * cancellationPolicy.exchangeRate).toFixed(2)}`
                          : 'Bs. —.—'}
                      </Text>
                    )}
                  </View>
                  {cancellationPolicy.description && (
                    <View style={styles.cancelFeeDescRow}>
                      <Ionicons name="information-circle-outline" size={14} color="#6b7280" />
                      <Text style={styles.cancelFeeDescText}>{cancellationPolicy.description}</Text>
                    </View>
                  )}
                  {cancellationPolicy.type === 'penalty' && cancellationPolicy.refundAmount && (
                    <View style={styles.cancelFeeRefundRow}>
                      <Ionicons name="time-outline" size={14} color="#6b7280" />
                      <Text style={styles.cancelFeeRefundText}>
                        Reembolso de {formatCurrency(cancellationPolicy.refundAmount, fareCurrency)} en 24 horas
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* Policy info */}
              <View style={styles.cancelPolicySection}>
                <View style={styles.cancelPolicyRow}>
                  <Ionicons name="checkmark-circle-outline" size={18} color="#2FB908" />
                  <Text style={styles.cancelPolicyRowText}>Gratis durante los primeros 2 minutos</Text>
                </View>
                <View style={styles.cancelPolicyRow}>
                  <Ionicons name="time-outline" size={18} color="#6b7280" />
                  <Text style={styles.cancelPolicyRowText}>Con tarifa después de 2 minutos</Text>
                </View>
                <View style={styles.cancelPolicyRow}>
                  <Ionicons name="warning-outline" size={18} color="#E08809" />
                  <Text style={styles.cancelPolicyRowText}>50% si el conductor ya llegó al punto</Text>
                </View>
                <View style={styles.cancelPolicyRow}>
                  <Ionicons name="alert-circle-outline" size={18} color="#dc2626" />
                  <Text style={styles.cancelPolicyRowText}>70% si el viaje está en progreso</Text>
                </View>
              </View>

              {/* Cancel reason selection */}
              <View style={{ marginBottom: 16 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#1f2937', marginBottom: 10 }}>
                  Motivo de cancelación
                </Text>
                {PASSENGER_CANCEL_REASONS.map((reason) => (
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
              <View style={styles.cancelModalActions}>
                <TouchableOpacity style={styles.cancelBtnKeep} onPress={handleCloseCancelModal} disabled={isCancelling} activeOpacity={0.7}>
                  <Text style={styles.cancelBtnKeepText}>Mantener viaje</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.cancelBtnConfirm, (!cancelReason || isCancelling) && { opacity: 0.6 }]}
                  onPress={handleConfirmCancellation}
                  disabled={!cancelReason || isCancelling}
                  activeOpacity={0.8}
                >
                  {isCancelling ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.cancelBtnConfirmText}>Cancelar viaje</Text>}
                </TouchableOpacity>
              </View>
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Payment Modal */}
        <Modal
          visible={showPaymentModal}
          transparent={true}
          animationType="slide"
          onRequestClose={paymentCompleted ? handleClosePaymentModal : undefined}
        >
          <View style={[styles.modalOverlay, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.paymentModalContent}>
              {!paymentCompleted ? (
                <>
                  {/* Payment Header */}
                  <View style={styles.paymentHeader}>
                    <View style={styles.paymentHeaderIcon}>
                      <Ionicons name="checkmark-circle" size={48} color="#2FB908" />
                    </View>
                    <Text style={styles.paymentTitle}>Viaje Completado</Text>
                    <Text style={styles.paymentSubtitle}>¡Has llegado a tu destino!</Text>
                  </View>

                  {/* Final Fare Display */}
                  <View style={styles.finalFareContainer}>
                    <Text style={styles.finalFareLabel}>Tarifa Final</Text>
                    <Text style={styles.finalFareAmount}>
                      {formatCurrency(finalFare || estimatedFare || 0, fareCurrency)}
                    </Text>
                  </View>

                  {/* Fare Breakdown */}
                  {fareBreakdown && (
                    <View style={styles.paymentBreakdown}>
                      <Text style={styles.breakdownTitle}>Desglose de Tarifa</Text>
                      <View style={styles.breakdownRow}>
                        <Text style={styles.breakdownLabel}>Tarifa de zona:</Text>
                        <Text style={styles.breakdownValue}>
                          {formatCurrency(fareBreakdown.baseFare, fareCurrency)}
                        </Text>
                      </View>
                      {fareBreakdown.dualPrice && (
                        <View style={styles.breakdownRow}>
                          <Text style={[styles.breakdownValue, styles.fareBreakdownDual]}>
                            {fareCurrency === 'USD'
                              ? `Bs. ${fareBreakdown.dualPrice.ves.toFixed(2)}`
                              : `$ ${fareBreakdown.dualPrice.usd.toFixed(2)}`}
                          </Text>
                        </View>
                      )}
                      {fareBreakdown.exchangeRate && (
                        <Text style={styles.fareExchangeRate}>
                          Tasa BCV: Bs. {fareBreakdown.exchangeRate.toFixed(2)} / USD
                        </Text>
                      )}
                    </View>
                  )}

                  {/* Payment Method Selector */}
                  <View style={styles.paymentMethodSelectorPost}>
                    <Text style={styles.paymentMethodSelectorTitle}>Método de Pago</Text>
                    <TouchableOpacity
                      style={[
                        styles.paymentMethodOption,
                        paymentMethod === 'cash' && styles.paymentMethodOptionSelected,
                      ]}
                      onPress={() => {
                        setPaymentMethod('cash');
                      }}
                    >
                      <View
                        style={[
                          styles.paymentMethodIconCircle,
                          paymentMethod === 'cash' && styles.paymentMethodIconCircleSelected,
                        ]}
                      >
                        <Ionicons
                          name="cash"
                          size={28}
                          color={paymentMethod === 'cash' ? '#2FB908' : '#8E8E93'}
                        />
                      </View>
                      <Text
                        style={[
                          styles.paymentMethodOptionText,
                          paymentMethod === 'cash' && styles.paymentMethodOptionTextSelected,
                        ]}
                      >
                        Efectivo
                      </Text>
                      {paymentMethod === 'cash' && (
                        <View style={styles.paymentMethodCheckmark}>
                          <Ionicons name="checkmark-circle" size={24} color="#2FB908" />
                        </View>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.paymentMethodOption,
                        paymentMethod === 'pago_movil' && styles.paymentMethodOptionSelected,
                      ]}
                      onPress={() => setPaymentMethod('pago_movil')}
                    >
                      <View
                        style={[
                          styles.paymentMethodIconCircle,
                          paymentMethod === 'pago_movil' && styles.paymentMethodIconCircleSelected,
                        ]}
                      >
                        <Ionicons
                          name="phone-portrait"
                          size={28}
                          color={paymentMethod === 'pago_movil' ? '#2FB908' : '#8E8E93'}
                        />
                      </View>
                      <Text
                        style={[
                          styles.paymentMethodOptionText,
                          paymentMethod === 'pago_movil' && styles.paymentMethodOptionTextSelected,
                        ]}
                      >
                        Pago Móvil
                      </Text>
                      {paymentMethod === 'pago_movil' && (
                        <View style={styles.paymentMethodCheckmark}>
                          <Ionicons name="checkmark-circle" size={24} color="#2FB908" />
                        </View>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.paymentMethodOption,
                        paymentMethod === 'bank_transfer' && styles.paymentMethodOptionSelected,
                      ]}
                      onPress={() => setPaymentMethod('bank_transfer')}
                    >
                      <View
                        style={[
                          styles.paymentMethodIconCircle,
                          paymentMethod === 'bank_transfer' && styles.paymentMethodIconCircleSelected,
                        ]}
                      >
                        <Ionicons
                          name="swap-horizontal"
                          size={28}
                          color={paymentMethod === 'bank_transfer' ? '#2FB908' : '#8E8E93'}
                        />
                      </View>
                      <Text
                        style={[
                          styles.paymentMethodOptionText,
                          paymentMethod === 'bank_transfer' && styles.paymentMethodOptionTextSelected,
                        ]}
                      >
                        Transferencia
                      </Text>
                      {paymentMethod === 'bank_transfer' && (
                        <View style={styles.paymentMethodCheckmark}>
                          <Ionicons name="checkmark-circle" size={24} color="#2FB908" />
                        </View>
                      )}
                    </TouchableOpacity>
                  </View>

                  {/* Process Payment Button */}
                  <TouchableOpacity
                    style={[styles.processPaymentButton, paymentMethod !== 'cash' && { backgroundColor: '#2563eb' }]}
                    onPress={handleProcessPayment}
                    disabled={isProcessingPaymentRef.current}
                  >
                    {isProcessingPayment ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.processPaymentButtonText}>
                        {paymentMethod === 'cash' ? 'Confirmar Pago en Efectivo' : 'Pagar Ahora'}
                      </Text>
                    )}
                  </TouchableOpacity>

                  {paymentMethod === 'cash' && (
                    <Text style={styles.confirmationMessage}>
                      Paga en efectivo al conductor al subir al vehículo.
                    </Text>
                  )}
                </>
              ) : (
                <>
                  <View style={styles.paymentConfirmationContainer}>
                    <Ionicons name="checkmark-circle" size={80} color="#2FB908" />
                    <Text style={styles.confirmationTitle}>Pago {paymentMethod === 'cash' ? 'Confirmado' : 'Completado'}</Text>
                    <Text style={styles.confirmationMessage}>
                      {paymentMethod === 'cash'
                        ? 'El conductor iniciará el viaje al confirmar que recibió el efectivo.'
                        : 'Gracias por tu pago.'}
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={styles.continueButton}
                    onPress={handleClosePaymentModal}
                  >
                    <Text style={styles.continueButtonText}>Calificar Conductor</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </Modal>

        {/* Rating Modal */}
        <Modal
          visible={showRatingModal}
          transparent={true}
          animationType="fade"
          onRequestClose={handleSkipRating}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.ratingModalContent}>
              {/* Header */}
              <Text style={styles.ratingTitle}>Califica tu viaje</Text>
              <Text style={styles.ratingSubtitle} numberOfLines={1}>
                {activeRide?.driver?.name || 'el conductor'}
              </Text>

              {/* Stars */}
              <View style={styles.ratingStarsRow}>
                {[1, 2, 3, 4, 5].map(star => (
                  <TouchableOpacity key={star} onPress={() => { setDriverRating(star); hasInteractedWithRatingRef.current = true; }}>
                    <Ionicons
                      name={star <= driverRating ? 'star' : 'star-outline'}
                      size={36}
                      color={star <= driverRating ? '#F89C0A' : '#d1d5db'}
                    />
                  </TouchableOpacity>
                ))}
              </View>
              {driverRating > 0 && (
                <Text style={styles.ratingText}>
                  {driverRating === 1 && 'Muy malo'}
                  {driverRating === 2 && 'Malo'}
                  {driverRating === 3 && 'Regular'}
                  {driverRating === 4 && 'Bueno'}
                  {driverRating === 5 && 'Excelente'}
                </Text>
              )}

              {/* Comment */}
              <TextInput
                style={styles.ratingComment}
                placeholder="Comentario (opcional)"
                placeholderTextColor="#9ca3af"
                value={driverComment}
                onChangeText={(text) => { setDriverComment(text); hasInteractedWithRatingRef.current = true; }}
                multiline
                numberOfLines={3}
                maxLength={200}
                textAlignVertical="top"
              />

              {/* Buttons */}
              <View style={styles.ratingButtons}>
                <TouchableOpacity style={styles.ratingBtnSkip} onPress={handleSkipRating} disabled={isSubmittingRating}>
                  <Text style={styles.ratingBtnSkipText}>Omitir</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.ratingBtnSubmit, (driverRating === 0 || isSubmittingRating) && { opacity: 0.5 }]} onPress={handleSubmitRating} disabled={driverRating === 0 || isSubmittingRating}>
                  {isSubmittingRating ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.ratingBtnSubmitText}>Enviar</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Change Payment Method Modal — for switching from cash to pago_movil during ride (Req. 3.2) */}
        <Suspense fallback={
          <View style={styles.modalLoading}>
            <ActivityIndicator size="large" color="#2FB908" />
            <Text style={styles.modalLoadingText}>Cargando formulario de pago...</Text>
          </View>
        }>
          <MobilePaymentModal
            visible={showChangePaymentModal}
            amount={estimatedFare || 0}
            currency={fareCurrency}
            exchangeRate={fareBreakdown?.exchangeRate}
            rideId={activeRide?.id || ''}
            passengerName={user?.name || ""}
            platformMethod={selectedPlatformMethod}
            onPaymentComplete={handleChangePaymentComplete}
            onCancel={handleChangePaymentCancel}
          />
        </Suspense>

        {/* Shared Ride Invitation Modal (Req. 7.3, 7.4) */}
        <Suspense fallback={null}>
          <SharedRideInvitationModal
            visible={showInvitationModal}
            invitation={currentInvitation}
            onAccept={handleInvitationAccept}
            onReject={handleInvitationReject}
            onClose={handleInvitationClose}
          />
        </Suspense>

        {/* Contact Driver Modal */}
        <Modal
          visible={showContactModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowContactModal(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowContactModal(false)}
          >
            <TouchableOpacity activeOpacity={1} onPress={() => {}}>
              <View style={{
                backgroundColor: '#fff',
                borderRadius: 16,
                padding: 24,
                width: '100%',
                maxWidth: 320,
                alignSelf: 'center',
                alignItems: 'center',
              }}>
                <Text style={{ fontSize: 17, fontWeight: '700', color: '#1f2937', textAlign: 'center', marginBottom: 4 }}>
                  Contactar al Conductor
                </Text>
                <Text style={{ fontSize: 13, color: '#6b7280', textAlign: 'center', marginBottom: 24 }}>
                  {activeRide?.driver?.phone || 'No disponible'}
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
                  <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: '#269006', justifyContent: 'center', alignItems: 'center' }}>
                    <Ionicons name="call" size={20} color="#fff" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '600', color: '#1f2937' }}>Llamada Telefónica</Text>
                    <Text style={{ fontSize: 12, color: '#6b7280', marginTop: 1 }}>Marcar directamente</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleWhatsAppCall}
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
                  onPress={() => setShowContactModal(false)}
                  style={{ paddingVertical: 8, paddingHorizontal: 24 }}
                >
                  <Text style={{ fontSize: 14, color: '#9ca3af', fontWeight: '600' }}>Cancelar</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      </View>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  mapErrorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF5F5',
    padding: 20,
  },
  mapErrorText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FF0000',
    marginBottom: 8,
    textAlign: 'center',
  },
  mapErrorSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#505050',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#505050',
    textAlign: 'center',
  },
  errorSubtext: {
    fontSize: 14,
    color: '#A9A9A9',
    textAlign: 'center',
    marginTop: 8,
  },
  keyboardAvoidingView: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: '70%',
  },
  panelContainer: {
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
    maxHeight: '65%',
    overflow: 'visible',
  },
  panelContainerCollapsed: {
    maxHeight: 50,
  },
  panelContainerHidden: {
    display: 'none',
  },
  panelHeaderCollapsible: {
    alignItems: 'center',
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  panelScrollView: {
    maxHeight: '100%',
  },
  panelContent: {
    padding: 16,
  },
  panelHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#D1D5DB',
    borderRadius: 2,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 10,
    marginTop: 4,
  },
  panel: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  searchContainer: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    height: 50,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#2FB908',
    borderRadius: 24,
    paddingHorizontal: 20,
    fontSize: 16,
    color: '#505050',
  },
  searchButton: {
    marginLeft: 8,
    backgroundColor: '#2FB908',
    borderRadius: 24,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  paymentMethodSelector: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 8,
  },
  paymentMethodButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  paymentMethodButtonActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  paymentMethodButtonText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '600',
  },
  paymentMethodButtonTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  vehicleSelector: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 10,
  },
  vehicleButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  vehicleButtonActive: {
    backgroundColor: '#2FB908',
    borderColor: '#2FB908',
  },
  vehicleButtonText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '600',
  },
  vehicleButtonTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  motoQuantitySelector: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 10,
  },
  motoQuantityButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  motoQuantityButtonActive: {
    backgroundColor: '#2FB908',
    borderColor: '#2FB908',
  },
  motoQuantityIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  motoQuantityText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '600',
  },
  motoQuantityTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  locationInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
  },
  locationTextContainer: {
    flex: 1,
    marginLeft: 10,
  },
  locationText: {
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '500',
  },
  locationInput: {
    flex: 1,
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '500',
    marginLeft: 10,
    paddingVertical: 0,
  },
  locationIconButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#DCFCE7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapSelectionButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#DCFCE7',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  // ── Route Card (unified pickup + destination) ──────────────────────────────
  routeCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    marginBottom: 14,
    overflow: 'visible',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 56,
  },
  routeRowContent: {
    flex: 1,
    justifyContent: 'center',
  },
  routeTextButton: {
    flex: 1,
  },
  routeLabel: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '500',
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  routeValue: {
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '600',
  },
  routeAutocomplete: {
    flex: 1,
  },
  routeSuggestionsDropdown: {
    elevation: 10,
    zIndex: 100,
    left: -48,
    right: -80,
  },
  sharedSuggestionsPanel: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    marginTop: 4,
    marginHorizontal: 0,
    overflow: 'hidden',
    maxHeight: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 10,
    zIndex: 100,
  },
  sharedSuggestionsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 44,
  },
  sharedSuggestionsIcon: {
    marginRight: 10,
    flexShrink: 0,
  },
  sharedSuggestionsTextContainer: {
    flex: 1,
  },
  sharedSuggestionsName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  sharedSuggestionsDescription: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
    lineHeight: 15,
  },
  sharedSuggestionsSeparator: {
    height: 1,
    backgroundColor: '#D1D5DB',
    marginHorizontal: 12,
  },
  routeActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 8,
  },
  routeActionBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#F0FDF4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  routeDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 14,
    paddingRight: 14,
  },
  routeConnectorLine: {
    width: 2,
    height: 14,
    backgroundColor: '#D1D5DB',
    borderRadius: 1,
    marginLeft: 9,
  },
  approximateRouteBanner: {
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
    borderColor: '#F89C0A',
    zIndex: 100,
  },
  approximateRouteBannerText: {
    fontSize: 13,
    color: '#92400e',
    marginLeft: 8,
    fontWeight: '500',
    flex: 1,
  },
  mapSelectionBanner: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    backgroundColor: '#2FB908',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  mapSelectionBannerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  mapSelectionIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapSelectionTextContainer: {
    flex: 1,
  },
  mapSelectionBannerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 2,
  },
  mapSelectionBannerText: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.9)',
  },
  mapSelectionCancelButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  destinationInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#2FB908',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 4,
    marginBottom: 14,
  },
  destinationInput: {
    flex: 1,
    fontSize: 14,
    color: '#1F2937',
    paddingVertical: 8,
    marginLeft: 10,
  },
  autocompleteDestination: {
    flex: 1,
    marginLeft: 10,
  },
  autocompletePickup: {
    flex: 1,
    marginLeft: 10,
  },
  searchIconButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#DCFCE7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fareContainer: {
    backgroundColor: '#F5F5F5',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  fareLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  fareLoadingText: {
    fontSize: 14,
    color: '#6B7280',
  },
  zoneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 8,
    gap: 4,
  },
  zoneBadgeText: {
    fontSize: 13,
    color: '#2FB908',
    fontWeight: '600',
  },
  surchargeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 8,
    gap: 4,
  },
  surchargeText: {
    fontSize: 12,
    color: '#F89C0A',
    fontWeight: '600',
  },
  tripInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  tripInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tripInfoText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '600',
  },
  fareHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  fareLabel: {
    fontSize: 16,
    color: '#505050',
    fontWeight: '600',
  },
  fareAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2FB908',
  },
  fareBreakdown: {
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    paddingTop: 12,
  },
  fareBreakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  fareBreakdownLabel: {
    fontSize: 14,
    color: '#505050',
    flex: 1,
  },
  fareBreakdownValue: {
    fontSize: 14,
    color: '#505050',
    fontWeight: '600',
    marginLeft: 8,
  },
  fareBreakdownDual: {
    color: '#1d4ed8',
    fontWeight: '700',
  },
  fareExchangeRate: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 4,
    textAlign: 'right',
  },
  requestButton: {
    height: 44,
    backgroundColor: '#9CA3AF',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  requestButtonEnabled: {
    backgroundColor: '#269006',
    shadowColor: '#269006',
    shadowOpacity: 0.3,
  },
  requestButtonDisabled: {
    backgroundColor: '#D1D5DB',
    shadowOpacity: 0,
    elevation: 0,
  },
  requestButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  searchingDriverContainer: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  searchingIconWrapper: {
    width: 120,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  searchingPulseRing: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: '#2FB908',
  },
  searchingPulseRingInner: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 1.5,
    borderColor: '#4CCB3A',
  },
  searchingIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#F0FDF4',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#2FB908',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  searchingLoadingBar: {
    width: 160,
    height: 3,
    backgroundColor: '#E5E7EB',
    borderRadius: 1.5,
    overflow: 'hidden',
    marginBottom: 20,
  },
  searchingLoadingFill: {
    height: '100%',
    backgroundColor: '#2FB908',
    borderRadius: 1.5,
  },
  searchingTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  searchingSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 28,
    lineHeight: 20,
  },
  searchingTimerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 20,
  },
  searchingTimerText: {
    fontSize: 13,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  searchingTripCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 0,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 24,
  },
  searchingTripRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  searchingTripIconBg: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#F0FDF4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchingTripContent: {
    flex: 1,
  },
  searchingTripLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  searchingTripText: {
    fontSize: 14,
    color: '#374151',
  },
  searchingTripDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginHorizontal: 14,
  },
  searchingCancelButton: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FCA5A5',
    width: '100%',
    gap: 8,
  },
  searchingCancelText: {
    color: '#EF4444',
    fontSize: 15,
    fontWeight: '600',
  },
  cancelSearchButton: {
    marginTop: 16,
    backgroundColor: '#FF9500',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    shadowColor: '#FF9500',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  cancelSearchButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  driverMarkerContainer: {
    width: 56,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  driverMarker: {
    width: 44,
    height: 44,
    backgroundColor: '#2FB908',
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
    zIndex: 2,
  },
  driverMarkerPulse: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    zIndex: 1,
  },
  driverMarkerText: {
    fontSize: 20,
  },
  // Ride details panel — Compact & Professional
  ridePanel: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  paywallCard: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  paywallIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0fdf4',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  paywallTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 6,
  },
  paywallDesc: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 17,
    marginBottom: 12,
    paddingHorizontal: 8,
  },
  paywallFareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  paywallFareLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  paywallFareValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2FB908',
  },
  paywallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#2FB908',
    borderRadius: 10,
    height: 40,
    paddingHorizontal: 24,
  },
  paywallBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  reopenPaymentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#2FB908',
    borderRadius: 10,
    height: 40,
    paddingHorizontal: 24,
    marginTop: 12,
    marginBottom: 4,
  },
  reopenPaymentBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  rideTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 12,
  },
  rideDriverRatingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fffbeb',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 3,
  },
  rideDriverRating: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400e',
  },
  rideStatusRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 10,
  },
  rideTripInfo: {
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    gap: 6,
  },
  rideTripRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rideTripLabel: {
    fontSize: 12,
    color: '#9ca3af',
    width: 55,
  },
  rideTripValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1f2937',
  },
  rideTripValueSm: {
    fontSize: 12,
    color: '#4b5563',
    flex: 1,
  },
  rideTripDual: {
    fontSize: 11,
    color: '#9ca3af',
    marginLeft: 4,
  },
  rideTripDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2FB908',
  },
  rideDriverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  rideDriverAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  rideDriverAvatarImg: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  rideDriverAvatarLetter: {
    fontSize: 20,
    fontWeight: '700',
    color: '#6b7280',
  },
  rideDriverInfo: {
    flex: 1,
  },
  rideDriverName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  rideDriverMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: 8,
  },
  rideDriverVehicle: {
    fontSize: 12,
    color: '#9ca3af',
  },
  rideStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#dcfce7',
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  rideStatusAccepted: { backgroundColor: '#dbeafe' },
  rideStatusArrived: { backgroundColor: '#fed7aa' },
  rideStatusInProgress: { backgroundColor: '#d1fae5' },
  rideStatusText: { fontSize: 11, fontWeight: '600', color: '#269006' },
  rideStatusTextAccepted: { color: '#2563eb' },
  rideStatusTextArrived: { color: '#ea580c' },
  rideStatusTextInProgress: { color: '#2FB908' },
  rideEtaStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
    gap: 6,
  },
  rideEtaText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  rideEtaLabel: {
    fontSize: 12,
    color: '#9ca3af',
    marginLeft: 'auto',
  },
  rideActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  rideBtnCall: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2FB908',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  rideBtnCallText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  rideBtnDisabled: {
    backgroundColor: '#e5e7eb',
  },
  rideBtnTextDisabled: {
    color: '#9ca3af',
  },
  rideBtnCancel: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  rideBtnCancelText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '600',
  },
  rideBtnChange: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6366f1',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 4,
  },
  rideBtnChangeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  driverInfoFullContainer: {
    flex: 1,
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  driverHeaderSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    marginBottom: 20,
  },
  driverAvatarContainer: {
    marginRight: 16,
  },
  driverAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
    backgroundColor: '#2FB908',
  },
  driverAvatarPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#2FB908',
    justifyContent: 'center',
    alignItems: 'center',
  },
  driverAvatarImage: {
    width: '100%',
    height: '100%',
  },
  driverAvatarText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
  },
  driverInfoContent: {
    flex: 1,
  },
  driverNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  driverName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#dcfce7',
    marginLeft: 12,
    borderRadius: 12,
  },
  statusBadgeAccepted: {
    backgroundColor: '#dbeafe',
  },
  statusBadgeArrived: {
    backgroundColor: '#fed7aa',
  },
  statusBadgeInProgress: {
    backgroundColor: '#e9d5ff',
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#269006',
  },
  statusBadgeTextAccepted: {
    color: '#2563eb',
  },
  statusBadgeTextArrived: {
    color: '#ea580c',
  },
  statusBadgeTextInProgress: {
    color: '#9333ea',
  },
  driverRatingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  driverRatingText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6b7280',
  },
  vehicleDetailsSection: {
    marginBottom: 20,
  },
  vehicleDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
  },
  vehicleDetailIconBox: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginRight: 14,
    borderRadius: 10,
  },
  vehicleDetailContent: {
    flex: 1,
  },
  vehicleDetailLabel: {
    fontSize: 11,
    color: '#9ca3af',
    marginBottom: 4,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  vehicleDetailValue: {
    fontSize: 16,
    color: '#111827',
    fontWeight: '600',
  },
  vehiclePlateText: {
    fontSize: 18,
    color: '#111827',
    fontWeight: '700',
    letterSpacing: 2,
  },
  etaSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    padding: 16,
    marginBottom: 20,
    borderRadius: 12,
  },
  etaIconBox: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginRight: 14,
    borderRadius: 10,
  },
  etaContent: {
    flex: 1,
  },
  etaLabelText: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
    fontWeight: '500',
  },
  etaValueText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#269006',
  },
  actionButtonsSection: {
    flexDirection: 'row',
    gap: 12,
  },
  callButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2FB908',
    paddingVertical: 14,
    paddingHorizontal: 12,
    gap: 8,
    borderRadius: 10,
  },
  callButtonDisabled: {
    backgroundColor: '#E5E7EB',
    opacity: 0.6,
  },
  callButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  callButtonTextDisabled: {
    color: '#9CA3AF',
  },
  cancelButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 8,
    borderRadius: 10,
  },
  cancelButtonText: {
    color: '#EF4444',
    fontSize: 15,
    fontWeight: '600',
  },
  changePaymentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    gap: 8,
    marginTop: 8,
  },
  changePaymentButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#505050',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 16,
    color: '#505050',
    marginBottom: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  warningContainer: {
    backgroundColor: '#FFF3E0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FF9500',
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  warningIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    color: '#505050',
    lineHeight: 20,
  },
  conditionsContainer: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  conditionsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#505050',
    marginBottom: 8,
  },
  conditionItem: {
    fontSize: 13,
    color: '#505050',
    marginBottom: 4,
    lineHeight: 18,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButtonSecondary: {
    flex: 1,
    backgroundColor: '#E0E0E0',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalButtonSecondaryText: {
    color: '#505050',
    fontSize: 16,
    fontWeight: '600',
  },
  modalButtonPrimary: {
    flex: 1,
    backgroundColor: '#FF9500',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalButtonPrimaryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalButtonDisabled: {
    backgroundColor: '#E6C896',
  },
  // Cancel Modal Styles — Professional redesign
  cancelModalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 360,
    maxHeight: '90%',
  },
  cancelModalHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  cancelModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
    marginTop: 10,
    marginBottom: 6,
    textAlign: 'center',
  },
  cancelModalSubtitle: {
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 18,
  },
  cancelFeeCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  cancelFeeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  cancelFeeLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
  },
  cancelFeeAmount: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1f2937',
  },
  cancelFeeDualRow: {
    alignItems: 'flex-end',
    marginBottom: 8,
  },
  cancelFeeDualText: {
    fontSize: 13,
    color: '#9ca3af',
  },
  cancelFeeDescRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginBottom: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  cancelFeeDescText: {
    fontSize: 12,
    color: '#6b7280',
    flex: 1,
    lineHeight: 17,
  },
  cancelFeeRefundRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cancelFeeRefundText: {
    fontSize: 12,
    color: '#6b7280',
  },
  cancelPolicySection: {
    marginBottom: 20,
  },
  cancelPolicyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 10,
  },
  cancelPolicyRowText: {
    fontSize: 13,
    color: '#6b7280',
    flex: 1,
  },
  cancelModalActions: {
    gap: 10,
  },
  cancelBtnKeep: {
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelBtnKeepText: {
    color: '#4b5563',
    fontSize: 15,
    fontWeight: '600',
  },
  cancelBtnConfirm: {
    backgroundColor: '#4b5563',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelBtnConfirmText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  // Payment Modal Styles
  paymentModalContent: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  paymentHeader: {
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  paymentHeaderIcon: {
    marginBottom: 12,
  },
  paymentTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 6,
  },
  paymentSubtitle: {
    fontSize: 15,
    color: '#8E8E93',
  },
  finalFareContainer: {
    backgroundColor: '#F0FFF0',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#2FB908',
  },
  finalFareLabel: {
    fontSize: 16,
    color: '#505050',
    marginBottom: 8,
  },
  finalFareAmount: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#2FB908',
  },
  paymentBreakdown: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  breakdownTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#505050',
    marginBottom: 12,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  breakdownLabel: {
    fontSize: 14,
    color: '#505050',
    flex: 1,
  },
  breakdownValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#505050',
    marginLeft: 8,
  },
  paymentMethodContainer: {
    marginBottom: 20,
  },
  paymentMethodLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#505050',
    marginBottom: 12,
  },
  paymentMethodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#2FB908',
    borderRadius: 12,
    padding: 16,
  },
  paymentMethodIcon: {
    fontSize: 28,
    marginRight: 12,
  },
  paymentMethodText: {
    fontSize: 16,
    color: '#505050',
    fontWeight: '500',
  },
  paymentMethodSelectorPost: {
    marginBottom: 20,
  },
  paymentMethodSelectorTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 16,
  },
  paymentMethodOptions: {
    gap: 12,
  },
  paymentMethodOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderWidth: 2,
    borderColor: '#E0E0E0',
    borderRadius: 16,
    padding: 16,
  },
  paymentMethodOptionSelected: {
    backgroundColor: '#F0FFF4',
    borderColor: '#2FB908',
    shadowColor: '#2FB908',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  paymentMethodIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    borderWidth: 2,
    borderColor: '#E0E0E0',
  },
  paymentMethodIconCircleSelected: {
    borderColor: '#2FB908',
    backgroundColor: '#F0FFF4',
  },
  paymentMethodOptionText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#505050',
  },
  paymentMethodOptionTextContainer: {
    flex: 1,
  },
  paymentMethodOptionSubtext: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 2,
  },
  paymentMethodOptionTextSelected: {
    color: '#2FB908',
    fontWeight: '700',
  },
  paymentMethodCheckmark: {
    marginLeft: 8,
  },
  cashInstructionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF9F0',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FF9500',
    gap: 10,
  },
  cashInstructionsText: {
    flex: 1,
    fontSize: 14,
    color: '#505050',
    lineHeight: 20,
    fontWeight: '500',
  },
   processPaymentButton: {
    backgroundColor: '#2FB908',
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 8,
    shadowColor: '#2FB908',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  processPaymentButtonDisabled: {
    backgroundColor: '#A9A9A9',
    shadowOpacity: 0.1,
  },
  processPaymentButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  paymentConfirmationContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  successIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F0FFF0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 3,
    borderColor: '#2FB908',
  },
  successIcon: {
    fontSize: 48,
  },
  confirmationTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#2FB908',
    marginBottom: 12,
  },
  confirmationMessage: {
    fontSize: 16,
    color: '#505050',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  confirmationFareContainer: {
    backgroundColor: '#F0FFF0',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 20,
    width: '100%',
  },
  confirmationFareLabel: {
    fontSize: 14,
    color: '#505050',
    marginBottom: 8,
  },
  confirmationFareAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#2FB908',
  },
  confirmationFareDual: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
    marginTop: 4,
  },
  receiptNote: {
    fontSize: 13,
    color: '#A9A9A9',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 18,
  },
  continueButton: {
    backgroundColor: '#2FB908',
    borderRadius: 24,
    paddingVertical: 16,
    paddingHorizontal: 48,
    alignItems: 'center',
    width: '100%',
    shadowColor: '#2FB908',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  continueButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  // Rating Modal Styles
  // Rating Modal Styles — Compact & Professional
  ratingModalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
  },
  ratingTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 6,
  },
  ratingSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  ratingStarsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 6,
  },
  ratingText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#F89C0A',
    textAlign: 'center',
    marginBottom: 16,
  },
  ratingComment: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    padding: 10,
    fontSize: 13,
    color: '#374151',
    minHeight: 70,
    marginBottom: 16,
    width: '100%',
  },
  ratingButtons: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  ratingBtnSkip: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  ratingBtnSkipText: {
    color: '#6b7280',
    fontSize: 14,
    fontWeight: '600',
  },
  ratingBtnSubmit: {
    flex: 2,
    backgroundColor: '#2FB908',
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  ratingBtnSubmitText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  ratingModalContent_DEPRECATED: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  ratingHeader: {
    alignItems: 'center',
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },

  ratingDriverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FFF0',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#2FB908',
  },
  ratingDriverAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#2FB908',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  ratingDriverAvatarText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  ratingDriverName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#505050',
    marginBottom: 4,
  },
  ratingDriverVehicle: {
    fontSize: 14,
    color: '#505050',
  },
  starRatingContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  starRatingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#505050',
    marginBottom: 12,
  },
  starsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
  },
  starButton: {
    padding: 4,
  },
  starIcon: {
    fontSize: 40,
  },

  commentContainer: {
    marginBottom: 24,
  },
  commentLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#505050',
    marginBottom: 8,
  },
  commentInput: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#2FB908',
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    color: '#505050',
    minHeight: 100,
  },
  commentCounter: {
    fontSize: 12,
    color: '#A9A9A9',
    textAlign: 'right',
    marginTop: 4,
  },
  ratingModalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  skipRatingButton: {
    flex: 1,
    backgroundColor: '#E0E0E0',
    borderRadius: 24,
    paddingVertical: 14,
    alignItems: 'center',
  },
  skipRatingButtonText: {
    color: '#505050',
    fontSize: 16,
    fontWeight: '600',
  },
  submitRatingButton: {
    flex: 2,
    backgroundColor: '#2FB908',
    borderRadius: 24,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: '#2FB908',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitRatingButtonDisabled: {
    backgroundColor: '#A9A9A9',
  },
  submitRatingButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Contact Modal Styles — Compact
  contactModalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    width: '90%',
    maxWidth: 380,
  },
  contactHeaderName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 6,
  },
  contactPhoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 4,
  },
  contactPhoneText: {
    fontSize: 13,
    color: '#6b7280',
  },
  contactDivider: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginVertical: 14,
  },
  contactOptionsTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  contactOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  contactOptionInfo: {
    flex: 1,
  },
  contactOptionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  contactOptionDesc: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 1,
  },
  contactNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#f0fdf4',
    borderRadius: 8,
    padding: 10,
    gap: 6,
  },
  contactNoteText: {
    flex: 1,
    fontSize: 11,
    color: '#065f46',
    lineHeight: 16,
  },
  contactCancelBtn: {
    marginTop: 12,
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  contactCancelBtnText: {
    color: '#6b7280',
    fontSize: 14,
    fontWeight: '600',
  },
  centerLocationButton: {
    right: 16,
    left: undefined, // Anular la posición izquierda del componente base
  },
  recenterDriverButton: {
    position: 'absolute',
    right: 16,
    width: 34,
    height: 34,
    backgroundColor: '#2FB908',
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
    zIndex: 1000,
  },
  // Container for add point buttons — horizontal row layout
  addPointsContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    marginBottom: 12,
  },
  // Unified style for add point buttons — compact for single row
  addPointButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4', // green-50
    borderWidth: 1.5,
    borderColor: '#2FB908', // green-500 — matches system theme
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 10,
    gap: 6,
    flexShrink: 1,
  },
  addPointButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#269006', // green-600 — matches system theme
  },
  secondPickupIconContainer: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Keep second destination icon container for compatibility
  secondDestinationIconContainer: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // ========== MEJORAS DE NAVEGACIÓN: Estilos ==========
  // Mejora 2: Indicador de progreso visual
  progressContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  progressTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#2FB908',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },
  // Mejora 3: Marcadores de landmarks
  landmarkMarker: {
    width: 32,
    height: 32,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#8B5CF6',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  modalLoading: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalLoadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
  },
});
