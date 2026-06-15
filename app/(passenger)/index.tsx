import React, { useState, useEffect, useRef, useCallback } from 'react';
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
} from 'react-native';
import { useUnifiedNotifications } from '@/context/UnifiedNotificationContext';
import Svg, { Path, G } from 'react-native-svg';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, withRepeat, withSequence, Easing } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import MapView, { Marker, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import {
  DriverTaxiIcon,
  PassengerIcon,
  DropoffIcon,
  SecondPickupIcon,
  SecondDropoffIcon,
} from '@/src/components/map/markers';
import { computeBearing } from '@/src/utils/mapNav';
import { useAuthStore } from '@/store/authStore';
import { rideAPI, paymentAPI, ratingAPI } from '@/services/api';
import { reverseGeocode, getRoute, geocodeAddress } from '@/services/mapsService';
import {
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
  onPassengerLocationUpdate,
  removeAllListeners,
} from '@/services/socket';
import { logInfo, logError, logWarning } from '@/utils/errorLogger';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useSocketReconnect } from '@/hooks/useSocketReconnect';
import { useSound } from '@/hooks/useSound';
import { useCancellationPolicy } from '@/hooks/useCancellationPolicy';
import MobilePaymentModal from '@/components/MobilePaymentModal';
import { formatCurrency, Currency } from '@/utils/currency';
// import { useSmartTutorial } from '@/hooks/useSmartTutorial';
// import { setActiveTutorialScreen } from '@/utils/tutorialState';
// import { useCopilot, walkthroughable, CopilotStep } from 'react-native-copilot';
import AddressAutocomplete from '@/components/AddressAutocomplete';
import CenterLocationButton from '@/components/CenterLocationButton';
import { resolveFileUrl } from '@/services/fileUrl';
import SharedRideInvitationModal, {
  SharedRideInvitation,
} from '@/components/SharedRideInvitationModal';

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
  const { user, token } = useAuthStore();
  const { playNotificationSound } = useSound();
  const mapRef = useRef<MapView>(null);

  // Enable automatic socket reconnection on app state changes
  useSocketReconnect();
  const { showToast, showStatus } = useUnifiedNotifications();

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

  // UI states
  const [isLoadingLocation, setIsLoadingLocation] = useState(true);
  const [isRequestingRide, setIsRequestingRide] = useState(false);
  const [isSearchingDriver, setIsSearchingDriver] = useState(false);
  const [userInteractedWithMap, setUserInteractedWithMap] = useState(false);
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
  const [isApproximateRoute, setIsApproximateRoute] = useState(false);
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);

  // Active ride tracking states
  const [activeRide, setActiveRide] = useState<ActiveRide | null>(null);
  const [driverLocation, setDriverLocation] = useState<LocationCoords | null>(null);
  const [driverHeading, setDriverHeading] = useState<number>(0); // Driver's heading/direction
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const prevDriverLocationRef = useRef<LocationCoords | null>(null);

  // Shared ride passenger location tracking (Req. 4.10)
  const [, setPassenger1Location] = useState<LocationCoords | null>(null);
  const [, setPassenger2Location] = useState<LocationCoords | null>(null);

  // Cancellation modal states
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [, setCancellationFeeWarning] = useState<string | null>(null);

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
  const restoreAttemptedRef = useRef(false);
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
                restoreAttemptedRef.current = true;
                return ride;
              });
              // Restaurar direcciones
              if (ride.pickupAddress) setPickupAddress(ride.pickupAddress);
              if (ride.destinationAddress) setDestinationAddress(ride.destinationAddress);
              setIsSearchingDriver(ride.status === 'pending');
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
        restoreActiveRide();
      }
    });

    return () => {
      isMounted = false;
      subscription.remove();
    };
  }, [token]);


  /** Handle search timeout - auto-cancel after 60 seconds */
  const handleSearchTimeout = useCallback(async () => {
    if (!activeRide || !activeRide.id) {
      setIsSearchingDriver(false);
      setSearchDuration(0);
      return;
    }
    try {
      await rideAPI.cancelRide(activeRide.id, { reason: 'search_timeout' });
      showToast(
        'No encontramos conductores disponibles en tu zona en este momento. Por favor intenta nuevamente.',
        'info'
      );
      setActiveRide(null);
      setIsSearchingDriver(false);
      setDriverLocation(null);
    } catch {
      showToast('No se pudo cancelar la búsqueda automáticamente.', 'error');
    } finally {
      setSearchDuration(0);
    }
  }, [activeRide, rideAPI, showToast]);

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
    !!token && !!activeRide && ['pending', 'accepted', 'arrived'].includes(activeRide.status);
  const { policy: cancellationPolicy } = useCancellationPolicy(activeRide?.id || null, {
    enabled: canFetchPolicy,
  });

  // Payment modal states
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showMobilePaymentModal, setShowMobilePaymentModal] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentCompleted, setPaymentCompleted] = useState(false);
  const [finalFare, setFinalFare] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<
    'cash' | 'card' | 'digital_wallet' | 'pago_movil' | 'bank_transfer'
  >('cash');
  const [selectedPlatformMethod, setSelectedPlatformMethod] = useState<any>(null);
  const [platformPaymentMethods, setPlatformPaymentMethods] = useState<any[]>([]);

  // Change payment method during active ride (Req. 3)
  const [showChangePaymentModal, setShowChangePaymentModal] = useState(false);
  const [isChangingPayment, setIsChangingPayment] = useState(false);

  // Rating modal states
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [driverRating, setDriverRating] = useState(0);
  const [driverComment, setDriverComment] = useState('');
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);

  // Contact modal states
  const [showContactModal, setShowContactModal] = useState(false);

  // Shared ride invitation states (Req. 7.3, 7.4)
  const [showInvitationModal, setShowInvitationModal] = useState(false);
  const [currentInvitation, setCurrentInvitation] = useState<SharedRideInvitation | null>(null);

  // Notification tracking - to avoid showing "driver nearby" notification multiple times
  const [hasShownNearbyNotification, setHasShownNearbyNotification] = useState(false);

  // ========== MEJORAS DE NAVEGACIÓN ==========
  // Mejora 1: Actualización dinámica de ruta
  const [isDynamicRouteEnabled] = useState(true);
  const [lastRouteUpdate, setLastRouteUpdate] = useState<number>(Date.now());

  // Mejora 2: Indicador de progreso visual
  const [rideProgress, setRideProgress] = useState<number>(0); // 0-100%
  const [initialDistanceToDestination, setInitialDistanceToDestination] = useState<number>(0);

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
        const { status } = await Location.requestForegroundPermissionsAsync();

        logInfo('PassengerHomeScreen', 'Location permission status', { status });

        if (status !== 'granted') {
          logWarning('PassengerHomeScreen', 'Location permission denied');
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

        // Step 1: Last known position (instant — avoids GPS cold-start delay)
        let lastKnownApplied = false;
        try {
          const lastKnown = await Location.getLastKnownPositionAsync({
            maxAge: 3 * 60 * 1000, // prefer positions up to 3 min old
            requiredAccuracy: 150, // within 150 meters
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
          const fresh = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
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
              const staleKnown = await Location.getLastKnownPositionAsync();
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
                label: 'Reintentar',
                onPress: () => {
                  setIsLoadingLocation(true);
                  Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
                    .then(loc =>
                      applyLocation({
                        latitude: loc.coords.latitude,
                        longitude: loc.coords.longitude,
                      })
                    )
                    .catch(() => setIsLoadingLocation(false));
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

    const subscription = AppState.addEventListener('change', nextState => {
      if (nextState === 'active' && !currentLocation) {
        logInfo('PassengerHomeScreen', 'App active, retrying location...');
        setIsLoadingLocation(true);
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
          .then(async loc => {
            const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
            setCurrentLocation(coords);
            setPickupLocation(coords);
            setIsLoadingLocation(false);
            try {
              const addr = await reverseGeocode(coords.latitude, coords.longitude);
              setPickupAddress(
                addr.address || `${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}`
              );
            } catch {
              setPickupAddress(`${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}`);
            }
            logInfo('PassengerHomeScreen', 'Location retry succeeded', coords);
          })
          .catch(() => setIsLoadingLocation(false));
      }
    });
    return () => subscription.remove();
  }, [user, currentLocation]);

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

    // Cleanup on unmount
    return () => {
      mounted = false;
      removeAllListeners();
      // Don't disconnect socket here - keep it alive for the session
    };
  }, [user, token]); // Depend on both user AND token

  // Fetch platform payment methods (admin-configured Pago Móvil options)
  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const res = await paymentAPI.getPlatformPaymentMethods();
        const methods = res.data?.data || [];
        setPlatformPaymentMethods(methods);
      } catch (err) {
        console.log('[PASSENGER] Could not load platform payment methods:', err);
      }
    })();
  }, [token]);

  // Setup ride event listeners when active ride changes
  useEffect(() => {
    if (!activeRide) {
      return;
    }

    console.log('[PASSENGER] Setting up ride event listeners for ride:', activeRide.id);

    // Reset notification flags when a new ride starts
    setHasShownNearbyNotification(false);

    // Join ride room
    joinRide(activeRide.id);

    // Listen for ride accepted event
    const handleRideAccepted = (data: any) => {
      console.log('🚗 Ride accepted:', data);

      // Play notification sound
      playNotificationSound();

      setActiveRide(prev => ({
        ...prev!,
        status: 'accepted',
        driver: data.driver,
      }));

      setIsSearchingDriver(false);

      // Update driver location on map
      if (data.driver?.currentLocation) {
        setDriverLocation(data.driver.currentLocation);
      }

      // Show mobile payment modal for payment
      setFinalFare(estimatedFare || 0);
      setShowMobilePaymentModal(true);

      // Build vehicle info text with safe access
      const vehicleInfo = data.driver?.vehicleInfo;
      const vehicleText = vehicleInfo
        ? `${vehicleInfo.model || 'Información no disponible'} - ${vehicleInfo.licensePlate || 'N/A'}`
        : 'Información del vehículo no disponible';
      const ratingText = data.driver?.rating ? `⭐ ${data.driver.rating.toFixed(1)}` : '';

      // Show single comprehensive driver info alert
      showStatus(
        'info',
        `${data.driver?.name || 'Tu conductor'} ha aceptado tu viaje y se dirige hacia ti.\n\n` +
          `🚙 Vehículo: ${vehicleText}\n` +
          `${ratingText ? `${ratingText}\n` : ''}` +
          `\nRealiza el pago para confirmar el viaje.`,
        '🚗 ¡Tu Conductor Viene en Camino!',
        undefined,
        undefined
      );
    };

    // Listen for ride status changes
    const handleRideStatusChanged = (data: any) => {
      console.log('📍 Ride status changed:', data);

      setActiveRide(prev => ({
        ...prev!,
        status: data.status,
      }));

      // Show native alerts for important status changes
      if (data.status === 'arrived') {
        playNotificationSound();
        showStatus(
          'info',
          'Tu conductor está esperándote en el punto de recogida. Por favor dirígete al vehículo.',
          '📍 ¡Tu Conductor ha Llegado!',
          undefined,
          {
            label: 'Ver Ubicación',
            onPress: () => {
              // Focus map on pickup location
              if (pickupLocation && mapRef.current) {
                mapRef.current.animateToRegion(
                  {
                    latitude: pickupLocation.latitude,
                    longitude: pickupLocation.longitude,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                  },
                  1000
                );
              }
            },
          }
        );
      } else if (data.status === 'in_progress') {
        playNotificationSound();
        showToast('¡Buen viaje! Tu conductor te llevará a tu destino de forma segura.', 'success');
      }
      // Note: 'completed' status is handled by the dedicated handleRideCompleted event listener
    };

    // Listen for driver location updates
    const handleDriverLocationUpdate = (data: any) => {
      console.log('📍 Driver location update:', data);

      const newDriverLocation = {
        latitude: data.latitude,
        longitude: data.longitude,
      };

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

      // ========== MEJORA 1: Actualización Dinámica de Ruta ==========
      // Recalcular ruta si el conductor se desvía significativamente y el viaje está en progreso
      if (
        isDynamicRouteEnabled &&
        activeRide?.status === 'in_progress' &&
        destinationLocation &&
        Date.now() - lastRouteUpdate > 30000 // Actualizar cada 30 segundos como máximo
      ) {
        updateDynamicRoute(newDriverLocation, destinationLocation);
      }

      // ========== MEJORA 2: Calcular Progreso del Viaje ==========
      if (
        activeRide?.status === 'in_progress' &&
        destinationLocation &&
        initialDistanceToDestination > 0
      ) {
        calculateRideProgress(newDriverLocation, destinationLocation);
      }
    };

    // Listen for passenger location updates in shared rides (Req. 4.10)
    const handlePassengerLocationUpdate = (data: any) => {
      console.log('📍 Passenger location update:', data);

      // Only process if this is a shared ride
      if (!activeRide?.isShared) {
        return;
      }

      // Update the appropriate passenger location based on passengerNumber
      if (data.passengerNumber === 1) {
        setPassenger1Location({
          latitude: data.latitude,
          longitude: data.longitude,
        });
      } else if (data.passengerNumber === 2) {
        setPassenger2Location({
          latitude: data.latitude,
          longitude: data.longitude,
        });
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
        !hasShownNearbyNotification &&
        activeRide?.status === 'accepted' &&
        estimatedMinutes <= 2 &&
        estimatedMinutes > 0
      ) {
        setHasShownNearbyNotification(true);
        playNotificationSound();

        showStatus(
          'info',
          `Tu conductor llegará en aproximadamente ${Math.ceil(estimatedMinutes)} minuto${estimatedMinutes > 1 ? 's' : ''}.\n\n` +
            `Prepárate para abordar el vehículo.`,
          '🚗 ¡Tu Conductor Está Cerca!'
        );
      }
    };

    // Listen for driver arrived event (direct notification)
    const handleDriverArrived = (data: any) => {
      console.log('🚗 Driver arrived (direct event):', data);

      // Update ride status
      setActiveRide(prev => ({
        ...prev!,
        status: 'arrived',
      }));

      // Play notification sound
      playNotificationSound();

      // Show native alert with enhanced message
      showStatus(
        'info',
        `${data.driverName} te está esperando en el punto de recogida.\n\n` +
          `Por favor dirígete al vehículo. Si no lo ves, puedes llamarlo desde el panel.`,
        '📍 ¡Tu Conductor Está Aquí!',
        undefined,
        {
          label: 'Ver en Mapa',
          onPress: () => {
            // Focus map on pickup location if available
            if (pickupLocation && mapRef.current) {
              mapRef.current.animateToRegion(
                {
                  latitude: pickupLocation.latitude,
                  longitude: pickupLocation.longitude,
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01,
                },
                1000
              );
            }
          },
        }
      );
    };

    // Listen for ride cancelled event
    const handleRideCancelled = (data: any) => {
      // CRITICAL: Only handle cancellation for the CURRENT active ride
      // Otherwise, an auto-cancelled previous ride will wipe the active ride's state
      if (data.rideId !== activeRide?.id) {
        console.log(
          '❌ Cancellation for different ride, ignoring. Cancelled:',
          data.rideId,
          'Active:',
          activeRide?.id
        );
        return;
      }

      console.log('❌ Ride cancelled:', data);

      // Play notification sound
      playNotificationSound();

      // Show native alert based on who cancelled
      if (data.cancelledBy === 'system') {
        showStatus(
          'ride_cancelled',
          data.cancellationReason ||
            'Lo sentimos, no encontramos conductores disponibles en este momento.\n\n' +
              'Por favor intenta nuevamente en unos minutos.',
          '😔 No Hay Conductores Disponibles'
        );

        // Reset ride state
        setActiveRide(null);
        setDriverLocation(null);
        setIsSearchingDriver(false);
      } else if (data.cancelledBy === 'driver') {
        showStatus(
          'ride_cancelled',
          `El conductor ha cancelado tu viaje.\n\n` +
            `Motivo: ${data.cancellationReason || 'No especificado'}\n\n` +
            `Estamos buscando otro conductor disponible para ti.`,
          '⚠️ Conductor Canceló el Viaje'
        );
      } else if (data.cancelledBy === 'passenger') {
        // Show cancellation fee if applicable
        const feeMessage =
          data.cancellationFee > 0
            ? `\n\n💰 Tarifa de cancelación aplicada: ${formatCurrency(data.cancellationFee, fareCurrency)}`
            : '';

        showToast(`Tu viaje ha sido cancelado exitosamente.${feeMessage}`, 'info');

        // Reset ride state
        setActiveRide(null);
        setDriverLocation(null);
        setIsSearchingDriver(false);
      }
    };

    // Listen for ride completed event
    const handleRideCompleted = (data: any) => {
      console.log('[PASSENGER] ========================================');
      console.log('[PASSENGER] ✅ RIDE COMPLETED EVENT RECEIVED');
      console.log('[PASSENGER]    Ride ID:', data.rideId);
      console.log('[PASSENGER]    Current Active Ride ID:', activeRide.id);
      console.log('[PASSENGER]    Final Fare:', data.finalFare);
      console.log('[PASSENGER] ========================================');

      // Store final fare
      setFinalFare(data.finalFare);

      // Play notification sound
      playNotificationSound();

      // Show completion alert and then rating modal
      showStatus(
        'success',
        `Tu viaje ha finalizado exitosamente.\n\nTarifa Final: ${formatCurrency(data.finalFare, fareCurrency)}\n\nPor favor califica tu experiencia.`,
        '🎉 Viaje Completado',
        undefined,
        {
          label: 'Calificar',
          onPress: () => {
            console.log('[PASSENGER] Opening rating modal');
            setShowRatingModal(true);
          },
        }
      );
    };

    // Register event listeners
    console.log('[PASSENGER] Registering socket event listeners...');
    onRideAccepted(handleRideAccepted);
    onRideStatusChanged(handleRideStatusChanged);
    onDriverLocationUpdate(handleDriverLocationUpdate);
    onPassengerLocationUpdate(handlePassengerLocationUpdate);
    onETAUpdate(handleETAUpdate);
    onDriverArrived(handleDriverArrived);
    onRideCancelled(handleRideCancelled);
    onRideCompleted(handleRideCompleted);
    console.log('[PASSENGER] ✅ All socket event listeners registered');

    // Cleanup listeners when ride ends or component unmounts
    return () => {
      console.log('[PASSENGER] Cleaning up ride event listeners for ride:', activeRide.id);
      if (activeRide) {
        leaveRide(activeRide.id);
      }
      // Remove all socket listeners to prevent duplicates
      removeAllListeners();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRide?.id]); // Only re-run when ride ID changes (new ride created)

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
      if (currentInvitation?.id === data.invitationId) {
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
  }, [isSocketConnected, currentInvitation?.id, playNotificationSound, showToast]);

  // Track and send passenger location during active shared ride (Req. 4.10)
  useEffect(() => {
    if (!activeRide?.isShared || !activeRide.id) {
      return;
    }

    // Only track location during active ride states
    if (!['accepted', 'arrived', 'in_progress'].includes(activeRide.status)) {
      return;
    }

    let locationSubscription: Location.LocationSubscription | null = null;

    const startLocationTracking = async () => {
      try {
        // Request location permissions
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          console.warn('[PASSENGER] Location permission not granted for tracking');
          return;
        }

        // Start watching location
        locationSubscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 3000, // Update every 3 seconds (same as driver)
            distanceInterval: 5, // Or when moved 5 meters (same as driver)
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

      console.log(
        '[RIDE_IMPROVEMENTS] Initial distance to destination:',
        initialDistance.toFixed(2),
        'km'
      );

      // Mejora 3: Buscar puntos de interés cercanos
      fetchNearbyLandmarks(driverLocation);
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

    try {
      logInfo('PassengerHomeScreen', 'Calculating route with OSRM...', {
        pickup: pickupLocation,
        destination: destinationLocation,
        secondPickup: secondPickupLocation,
        secondDestination: secondDestinationLocation,
      });

      // Build ordered waypoints: Current location → Pickup → Destination
      const waypoints: LocationCoords[] = [];
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
        allRouteCoords = routeData.polyline.map((coord: [number, number]) => ({
          latitude: coord[1],
          longitude: coord[0],
        }));
      } else {
        // Multi-segment route: fetch each consecutive segment and concatenate
        for (let i = 0; i < waypoints.length - 1; i++) {
          try {
            const segmentData = await getRoute(waypoints[i], waypoints[i + 1]);
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
            // Fallback: straight line for this segment
            allRouteCoords = [...allRouteCoords, waypoints[i], waypoints[i + 1]];
          }
        }
      }

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
  }, [pickupLocation, destinationLocation, secondPickupLocation, secondDestinationLocation]);

  // ========== MEJORA 1: Actualización Dinámica de Ruta ==========
  const updateDynamicRoute = useCallback(
    async (driverLoc: LocationCoords, destination: LocationCoords) => {
      try {
        console.log('[DYNAMIC_ROUTE] Updating route from driver to destination');

        const routeData = await getRoute(driverLoc, destination);
        const newRouteCoords: RouteCoordinates[] = routeData.polyline.map(
          (coord: [number, number]) => ({
            latitude: coord[1],
            longitude: coord[0],
          })
        );

        setRouteCoordinates(newRouteCoords);
        setLastRouteUpdate(Date.now());

        console.log('[DYNAMIC_ROUTE] Route updated successfully', {
          pointsCount: newRouteCoords.length,
        });
      } catch (error) {
        console.error('[DYNAMIC_ROUTE] Failed to update route:', error);
        // Keep existing route on error
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

      // Calcular progreso: (distancia inicial - distancia actual) / distancia inicial * 100
      if (initialDistanceToDestination > 0) {
        const progress = Math.min(
          100,
          Math.max(
            0,
            ((initialDistanceToDestination - currentDistance) / initialDistanceToDestination) * 100
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
    [initialDistanceToDestination]
  );

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
      const response = await fetch(`${apiUrl}/api/fares/estimate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      });

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

  // Calculate route and fare when destination changes
  useEffect(() => {
    if (pickupLocation && destinationLocation) {
      calculateRoute();
      calculateFareWithZone();
    }
  }, [
    pickupLocation,
    destinationLocation,
    secondPickupLocation,
    secondDestinationLocation,
    calculateRoute,
    calculateFareWithZone,
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
      // Keep the original user input
      const userInput = destinationAddress.trim();

      // Build search query with context (behind the scenes)
      let searchQuery = userInput;

      // Add San Juan de los Morros context if not specified
      const hasCityContext =
        searchQuery.toLowerCase().includes('san juan') ||
        searchQuery.toLowerCase().includes('venezuela') ||
        searchQuery.toLowerCase().includes('guárico') ||
        searchQuery.toLowerCase().includes('guarico');

      if (!hasCityContext) {
        // Si no menciona ciudad, agregar San Juan de los Morros (solo para la búsqueda)
        searchQuery = `${searchQuery}, San Juan de los Morros, Guárico, Venezuela`;
      } else if (!searchQuery.toLowerCase().includes('venezuela')) {
        // Si menciona ciudad pero no país, agregar Venezuela (solo para la búsqueda)
        searchQuery = `${searchQuery}, Venezuela`;
      }

      console.log('[GEOCODING] User input:', userInput);
      console.log('[GEOCODING] Search query:', searchQuery);

      const location = await geocodeAddress(searchQuery);

      if (!location || !location.latitude || !location.longitude) {
        showStatus(
          'info',
          'Esta dirección aún no está registrada en nuestro mapa. Pronto será agregada.\n\nPor favor, selecciona manualmente la ubicación en el mapa.',
          'Dirección no encontrada',
          undefined,
          { label: 'Seleccionar en mapa', onPress: () => handleEnableMapSelection('destination') }
        );
        return;
      }

      console.log('[GEOCODING] Location found:', location);

      setDestinationLocation({
        latitude: location.latitude,
        longitude: location.longitude,
      });

      // Keep the original user input in the text field (don't update with full address)
      // The full address is only used internally for accuracy
    } catch (error: any) {
      console.error('Geocoding error:', error);

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
          { label: 'Seleccionar en mapa', onPress: () => handleEnableMapSelection('destination') }
        );
      } else {
        logError('PassengerHomeScreen', error, { context: 'Geocoding destination' });
        showToast('No se pudo buscar la dirección. Verifica tu conexión.', 'error');
      }
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

      // Build search query with context (behind the scenes)
      let searchQuery = userInput;

      // Add San Juan de los Morros context if not specified
      const hasCityContext =
        searchQuery.toLowerCase().includes('san juan') ||
        searchQuery.toLowerCase().includes('venezuela') ||
        searchQuery.toLowerCase().includes('guárico') ||
        searchQuery.toLowerCase().includes('guarico');

      if (!hasCityContext) {
        // Si no menciona ciudad, agregar San Juan de los Morros (solo para la búsqueda)
        searchQuery = `${searchQuery}, San Juan de los Morros, Guárico, Venezuela`;
      } else if (!searchQuery.toLowerCase().includes('venezuela')) {
        // Si menciona ciudad pero no país, agregar Venezuela (solo para la búsqueda)
        searchQuery = `${searchQuery}, Venezuela`;
      }

      console.log('[PICKUP GEOCODING] User input:', userInput);
      console.log('[PICKUP GEOCODING] Search query:', searchQuery);

      const location = await geocodeAddress(searchQuery);

      if (!location || !location.latitude || !location.longitude) {
        showStatus(
          'info',
          'Esta dirección aún no está registrada en nuestro mapa. Pronto será agregada.\n\nPor favor, selecciona manualmente la ubicación en el mapa.',
          'Dirección no encontrada',
          undefined,
          { label: 'Seleccionar en mapa', onPress: () => handleEnableMapSelection('pickup') }
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
          { label: 'Seleccionar en mapa', onPress: () => handleEnableMapSelection('pickup') }
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

    try {
      // Reverse geocode the selected coordinates
      console.log('[MAP_LONG_PRESS] Starting reverse geocode...');
      const locationData = await reverseGeocode(coordinate.latitude, coordinate.longitude);

      console.log('[MAP_LONG_PRESS] Reverse geocode result:', locationData);

      const address =
        locationData.address ||
        `${coordinate.latitude.toFixed(6)}, ${coordinate.longitude.toFixed(6)}`;

      console.log('[MAP_LONG_PRESS] Address to show:', address);

      // Confirm selection with user
      showStatus('info', `¿Usar esta ubicación?\n\n${address}`, 'Confirmar Ubicación', undefined, {
        label: 'Confirmar',
        onPress: () => {
          console.log('[MAP_LONG_PRESS] User confirmed selection');
          const shortAddress = extractShortAddress(address);
           if (mapSelectionMode === 'pickup') {
             setPickupLocation(coordinate);
             setPickupAddress(shortAddress);
           } else if (mapSelectionMode === 'destination') {
             setDestinationLocation(coordinate);
             setDestinationAddress(shortAddress);
           } else if (mapSelectionMode === 'second_pickup') {
             setSecondPickupLocation(coordinate);
             setSecondPickupAddress(shortAddress);
             setSecondPickupLocationSource('custom');
           } else if (mapSelectionMode === 'second_destination') {
            setSecondDestinationLocation(coordinate);
            setSecondDestinationAddress(shortAddress);
            setSecondDestinationLocationSource('custom');
          }

          // Reset selection mode
          setMapSelectionMode('none');
          setTempMarkerLocation(null);
          setIsPanelCollapsed(false);
        },
      });
    } catch (error) {
      console.error('[MAP_LONG_PRESS] Reverse geocoding error:', error);

      // Fallback to coordinates if reverse geocoding fails
      const address = `${coordinate.latitude.toFixed(6)}, ${coordinate.longitude.toFixed(6)}`;

      showStatus(
        'info',
        `No se pudo obtener la dirección exacta.\n¿Usar estas coordenadas?\n\n${address}`,
        'Confirmar Ubicación',
        undefined,
        {
          label: 'Confirmar',
          onPress: () => {
            const shortAddress = extractShortAddress(address);
            if (mapSelectionMode === 'pickup') {
              setPickupLocation(coordinate);
              setPickupAddress(shortAddress);
            } else if (mapSelectionMode === 'destination') {
              setDestinationLocation(coordinate);
              setDestinationAddress(shortAddress);
            } else if (mapSelectionMode === 'second_pickup') {
              setSecondPickupLocation(coordinate);
              setSecondPickupAddress(shortAddress);
              setSecondPickupLocationSource('custom');
            } else if (mapSelectionMode === 'second_destination') {
              setSecondDestinationLocation(coordinate);
              setSecondDestinationAddress(shortAddress);
              setSecondDestinationLocationSource('custom');
            }

            // Reset selection mode
            setMapSelectionMode('none');
            setTempMarkerLocation(null);
            setIsPanelCollapsed(false);
          },
        }
      );
    }
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

      // For now, use cash as default payment method
      const response = await rideAPI.requestRide({
        pickupLatitude: pickupLocation.latitude,
        pickupLongitude: pickupLocation.longitude,
        pickupAddress: pickupFullAddress || pickupAddress || 'Ubicación actual', // Use full address for precision
        destinationLatitude: destinationLocation.latitude,
        destinationLongitude: destinationLocation.longitude,
        destinationAddress: destinationFullAddress || destinationAddress, // Use full address for precision
        vehicleType: vehicleType,
        paymentMethodId: 'cash', // Default to cash
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
      const backendFare = response.data.data?.estimatedFare ?? response.data.estimatedFare;
      const backendCurrency = response.data.data?.currency ?? response.data.currency;
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

      // Show searching driver state
      setIsRequestingRide(false);
      setIsSearchingDriver(true);

      // Show native alert for searching driver
      showStatus(
        'info',
        'Estamos notificando a conductores cercanos',
        'Buscando conductor...',
        undefined,
        { label: 'Cancelar Búsqueda', onPress: handleCancelSearching }
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
    }
  };

  const handleCancelSearching = async () => {
    if (!activeRide || !activeRide.id) {
      console.warn('No active ride to cancel');
      // Reset states anyway
      setActiveRide(null);
      setIsSearchingDriver(false);
      setDriverLocation(null);

      // Show cancellation alert
      showToast('Has cancelado la búsqueda de conductor', 'info');
      return;
    }

    try {
      console.log('Cancelling ride:', activeRide.id);
      await rideAPI.cancelRide(activeRide.id, { reason: 'passenger_cancelled' });

      // Reset states
      setActiveRide(null);
      setIsSearchingDriver(false);

      // Show cancellation confirmation
      showToast('Has cancelado la búsqueda de conductor', 'info');
      setDriverLocation(null);

      console.log('✅ Ride search cancelled');

  

    } catch (error: any) {
      console.error('Cancel search error:', error);

      // If ride not found (404), it might have been auto-cancelled
      if (error.response?.status === 404) {
        // Just reset the states
        setActiveRide(null);
        setIsSearchingDriver(false);
        setDriverLocation(null);
        showToast('La búsqueda ya ha sido cancelada.', 'info');
      } else {
        showToast('No se pudo cancelar la búsqueda. Por favor, intenta nuevamente.', 'error');
      }
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

    setIsCancelling(true);

    try {
      const response = await rideAPI.cancelRide(activeRide.id, { reason: 'passenger_cancelled' });

      console.log('✅ Ride cancelled:', response.data);

      // Limpiar estado inmediatamente (no depender solo del WebSocket)
      setActiveRide(null);
      setDriverLocation(null);
      setIsSearchingDriver(false);
      setShowCancelModal(false);
      setIsCancelling(false);
    } catch (error: any) {
      console.error('Cancel ride error:', error);
      logError('PassengerHomeScreen', error, { context: 'Cancel ride' });
      setIsCancelling(false);

      // Show user-friendly error message
      const errorMessage = error.response?.data?.error?.message
        ? error.response.data.error.message
        : 'No se pudo cancelar el viaje. Por favor intenta nuevamente.';

      showToast(errorMessage, 'error');
    }
  };

  const handleCloseCancelModal = () => {
    setShowCancelModal(false);
    setCancellationFeeWarning(null);
  };

  const handleProcessPayment = async () => {
    if (!activeRide) return;

    // If cash, just show confirmation
    if (paymentMethod === 'cash') {
      setPaymentCompleted(true);
      return;
    }

    // If Pago Móvil or Bank Transfer, open the MobilePaymentModal with the selected method
    if (paymentMethod === 'pago_movil' || paymentMethod === 'bank_transfer') {
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
    }
  };

  const handleClosePaymentModal = () => {
    setShowPaymentModal(false);
    setPaymentCompleted(false);
    setIsProcessingPayment(false);

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

    try {
      // Cerrar modal y mostrar loading
      setShowMobilePaymentModal(false);
      setIsRequestingRide(true); // Usar el estado de loading existente

      if (paymentData.method === 'mobile_payment' && paymentData.referencia) {
        // P2C payment - already verified by the modal, just show success
        console.log('✅ P2C Payment already verified:', paymentData);

        // Ocultar loading
        setIsRequestingRide(false);

        // Mostrar confirmación de éxito
        showToast(
          'Tu Pago Móvil ha sido verificado exitosamente. El conductor ha sido notificado.',
          'success'
        );
      } else {
        // Legacy payment methods (transfer, cash)
        const response = await paymentAPI.completePayment(activeRide.id, {
          method: paymentData.method,
          amount: finalFare || estimatedFare || 0,
          referenceNumber: paymentData.referenceNumber,
          phoneNumber: paymentData.phoneNumber,
          accountNumber: paymentData.accountNumber,
          bankName: paymentData.bankName,
        });

        console.log('✅ Payment processed successfully:', response);

        // Ocultar loading
        setIsRequestingRide(false);

        // Mostrar confirmación de éxito
        showToast(
          'Tu pago ha sido procesado exitosamente. El conductor ha sido notificado.',
          'success'
        );
      }
    } catch (error: any) {
      console.error('❌ Payment processing failed:', error);

      // Ocultar loading
      setIsRequestingRide(false);

      // Extraer mensaje de error más específico
      let errorMessage = 'No se pudo procesar el pago. Por favor intenta nuevamente.';

      if (error?.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error?.message) {
        errorMessage = error.message;
      }

      showStatus('error', errorMessage, 'Error al Procesar Pago', undefined, {
        label: 'Reintentar',
        onPress: () => setShowMobilePaymentModal(true),
      });
    }
  };

  const handleMobilePaymentCancel = () => {
    setShowMobilePaymentModal(false);
    showToast('Debes completar el pago para que el conductor inicie el viaje.', 'info');
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
    if (!activeRide || driverRating === 0) {
      showToast('Por favor selecciona una valoración', 'error');
      return;
    }

    setIsSubmittingRating(true);

    try {
      await ratingAPI.rateDriver(activeRide.id, driverRating, driverComment.trim() || undefined);

      console.log('✅ Rating submitted successfully');

      // Close rating modal
      setShowRatingModal(false);
      setIsSubmittingRating(false);

      // Show thank you alert
      showToast('Tu valoración ha sido enviada exitosamente.', 'success');

      handleCloseRatingModal();
    } catch (error: any) {
      console.error('Submit rating error:', error);
      logError('PassengerHomeScreen', error, { context: 'Submit rating' });
      setIsSubmittingRating(false);

      // Show user-friendly error message
      const errorMessage = error.response?.data?.error?.message
        ? error.response.data.error.message
        : 'No se pudo enviar la valoración. Por favor intenta nuevamente.';

      showToast(errorMessage, 'error');
    }
  };

  const handleSkipRating = () => {
    showStatus(
      'info',
      '¿Estás seguro que deseas omitir la valoración del conductor?',
      'Omitir Valoración',
      undefined,
      { label: 'Omitir', onPress: handleCloseRatingModal }
    );
  };

  const handleCloseRatingModal = () => {
    setShowRatingModal(false);
    setDriverRating(0);
    setDriverComment('');
    setFinalFare(null);

    // Reset ride state completely - return to initial map view
    setActiveRide(null);
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
    setIsSearchingDriver(false);
    setHasShownNearbyNotification(false);
    setZoneInfo(null);
    setIsCalculatingFare(false);

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
  };

  const showDriverMarker = !!(activeRide?.driver && driverLocation);

  if (isLoadingLocation) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#22c55e" />
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
            initialRegion={{
              latitude: currentLocation.latitude,
              longitude: currentLocation.longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            }}
            showsUserLocation={false}
            showsMyLocationButton={false}
            followsUserLocation={false}
            showsCompass={false}
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
            {showDriverMarker && driverLocation && (
              <Marker
                coordinate={{
                  latitude: driverLocation.latitude,
                  longitude: driverLocation.longitude,
                }}
                title="Conductor"
                anchor={{ x: 0.5, y: 0.5 }}
                flat={false}
                rotation={driverHeading || 0}
              >
                <DriverTaxiIcon />
              </Marker>
            )}

            {/* Ubicacion actual del pasajero */}
            {currentLocation && (
              <Marker
                coordinate={currentLocation}
                title="Tu ubicacion"
                identifier="passenger_location"
                anchor={{ x: 0.5, y: 0.5 }}
              >
                <PassengerIcon size={44} />
              </Marker>
            )}

            {/* Destino */}
            {destinationLocation && (
              <Marker
                coordinate={destinationLocation}
                title="Destino"
                identifier="destination"
                anchor={{ x: 0.5, y: 0.5 }}
              >
                <DropoffIcon />
              </Marker>
            )}

            {/* Second Pickup Marker */}
            {showSecondPickup && secondPickupLocation && (
              <Marker
                coordinate={secondPickupLocation}
                title="Segundo punto de recogida"
                identifier="pickup2"
                anchor={{ x: 0.5, y: 0.5 }}
              >
                <SecondPickupIcon />
              </Marker>
            )}

            {/* Second Destination Marker */}
            {showSecondDestination && secondDestinationLocation && (
              <Marker
                coordinate={secondDestinationLocation}
                title="Segundo destino"
                identifier="destination2"
                anchor={{ x: 0.5, y: 0.5 }}
              >
                <SecondDropoffIcon />
              </Marker>
            )}

            {/* Driver route line */}
            {routeCoordinates.length > 1 && (
              <Polyline coordinates={routeCoordinates} strokeColor="#22C55E" strokeWidth={3} />
            )}

            {/* Nearby Landmarks */}
            {nearbyLandmarks.map((landmark, index) => (
              <Marker
                key={landmark.id || `landmark-${index}`}
                coordinate={{
                  latitude: landmark.latitude,
                  longitude: landmark.longitude,
                }}
                title={landmark.name}
                description={landmark.type === 'landmark' ? 'Punto de referencia' : 'Negocio local'}
                anchor={{ x: 0.5, y: 0.5 }}
              >
                <View
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 15,
                    backgroundColor: '#fff',
                    justifyContent: 'center',
                    alignItems: 'center',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.2,
                    shadowRadius: 4,
                    elevation: 4,
                  }}
                >
                  <Ionicons
                    name={landmark.type === 'landmark' ? 'location' : 'business'}
                    size={20}
                    color="#8B5CF6"
                  />
                </View>
              </Marker>
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
              <Ionicons name="navigate-circle" size={20} color="#22c55e" />
              <Text style={styles.progressTitle}>Progreso del viaje</Text>
            </View>
            <View style={styles.progressBarContainer}>
              <View style={[styles.progressBarFill, { width: `${rideProgress}%` }]} />
            </View>
            <Text style={styles.progressText}>{rideProgress}% completado</Text>
          </View>
        )}

        {/* Approximate Route Banner */}
        {isApproximateRoute && (
          <View style={styles.approximateRouteBanner}>
            <Ionicons name="information-circle" size={16} color="#fff" style={{ marginRight: 6 }} />
            <Text style={styles.approximateRouteBannerText}>Ruta estimada</Text>
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

        {/* Search and Request Panel with Keyboard Aware ScrollView */}
        <View style={[styles.panelContainer, isPanelCollapsed && styles.panelContainerCollapsed]}>
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
              enableOnAndroid={true}
              enableAutomaticScroll={true}
              extraScrollHeight={100}
              keyboardShouldPersistTaps="always"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.panelContent}
              style={styles.panelScrollView}
              keyboardOpeningTime={0}
              resetScrollToCoords={{ x: 0, y: 0 }}
              scrollEnabled={true}
            >
              {/* Active Ride - Driver Info */}
              {activeRide && activeRide.driver && (
                <View style={styles.ridePanel}>
                  {/* Dynamic title based on status */}
                  <Text style={styles.rideTitle}>
                    {activeRide.status === 'accepted' ? 'Conductor en camino' : 
                     activeRide.status === 'arrived' ? 'El conductor ha llegado' : 
                     activeRide.status === 'in_progress' ? 'Viaje en curso' : ''}
                  </Text>

                  {/* Status badge */}
                  <View style={styles.rideStatusRow}>
                    <View style={[styles.rideStatusBadge, activeRide.status === 'accepted' && styles.rideStatusAccepted, activeRide.status === 'arrived' && styles.rideStatusArrived, activeRide.status === 'in_progress' && styles.rideStatusInProgress]}>
                      <Text style={[styles.rideStatusText, activeRide.status === 'accepted' && styles.rideStatusTextAccepted, activeRide.status === 'arrived' && styles.rideStatusTextArrived, activeRide.status === 'in_progress' && styles.rideStatusTextInProgress]}>
                        {getRideStatusText(activeRide.status)}
                      </Text>
                    </View>
                  </View>

                  {/* Driver header row */}
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
                        <Ionicons name="star" size={12} color="#f59e0b" />
                        <Text style={styles.rideDriverRating}>{activeRide.driver.rating.toFixed(1)}</Text>
                      </View>
                    )}
                  </View>

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
                      <Text style={styles.rideTripValueSm} numberOfLines={1}>{pickupAddress || 'No especificada'}</Text>
                    </View>
                    {/* Destination row */}
                    <View style={styles.rideTripRow}>
                      <View style={[styles.rideTripDot, { backgroundColor: '#ef4444' }]} />
                      <Text style={styles.rideTripLabel}>Destino</Text>
                      <Text style={styles.rideTripValueSm} numberOfLines={1}>{destinationAddress || 'No especificado'}</Text>
                    </View>
                  </View>

                  {/* ETA strip */}
                  {activeRide.eta && (
                    <View style={styles.rideEtaStrip}>
                      <Ionicons name="time-outline" size={14} color="#22c55e" />
                      <Text style={styles.rideEtaText}>
                        {Math.round(activeRide.eta.estimatedMinutes)} min · {activeRide.eta.distanceKm.toFixed(1)} km
                      </Text>
                      <Text style={styles.rideEtaLabel}>
                        {activeRide.status === 'accepted' ? 'hasta la recogida' : activeRide.status === 'in_progress' ? 'hasta el destino' : ''}
                      </Text>
                    </View>
                  )}

                  {/* Action buttons */}
                  <View style={styles.rideActionsRow}>
                    <TouchableOpacity style={[styles.rideBtnCall, activeRide.status === 'in_progress' && styles.rideBtnDisabled]} onPress={handleContactDriver} disabled={activeRide.status === 'in_progress'}>
                      <Ionicons name="call-outline" size={16} color={activeRide.status === 'in_progress' ? '#9ca3af' : '#fff'} />
                      <Text style={[styles.rideBtnCallText, activeRide.status === 'in_progress' && styles.rideBtnTextDisabled]}>
                        {activeRide.status === 'in_progress' ? 'En viaje' : 'Llamar'}
                      </Text>
                    </TouchableOpacity>

                    {(activeRide.status === 'pending' || activeRide.status === 'accepted' || activeRide.status === 'arrived') && (
                      <TouchableOpacity style={styles.rideBtnCancel} onPress={handleCancelRidePress}>
                        <Text style={styles.rideBtnCancelText}>Cancelar</Text>
                      </TouchableOpacity>
                    )}

                    {activeRide.status === 'in_progress' && (!activeRide.paymentMode || activeRide.paymentMode === 'cash') && (
                      <TouchableOpacity style={styles.rideBtnChange} onPress={() => setShowChangePaymentModal(true)}>
                        <Ionicons name="phone-portrait-outline" size={14} color="#fff" />
                        <Text style={styles.rideBtnChangeText}>Pago Móvil</Text>
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
                      <Ionicons name="car-outline" size={40} color="#22c55e" />
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
                        <Ionicons name="location-outline" size={16} color="#22c55e" />
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
                        <Ionicons name="location" size={20} color="#22c55e" />
                      </TouchableOpacity>
                      <View style={styles.routeRowContent}>
                        {isEditingPickup ? (
                          <AddressAutocomplete
                            value={pickupAddress}
                            onChangeText={setPickupAddress}
                            onSelectPlace={place => {
                              setPickupLocation({
                                latitude: place.latitude,
                                longitude: place.longitude,
                              });
                              setPickupAddress(place.name); // Show short name in input
                              setPickupFullAddress(place.description || place.name); // Save full address internally
                              setPickupLocationSource(place.source ?? null);
                              setIsEditingPickup(false);
                            }}
                            placeholder="Punto de recogida"
                            currentLocation={currentLocation ?? undefined}
                            bare
                            style={styles.routeAutocomplete}
                            suggestionsStyle={styles.routeSuggestionsDropdown}
                          />
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
                            color="#22c55e"
                          />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.routeActionBtn}
                          onPress={() => handleEnableMapSelection('pickup')}
                        >
                          <Ionicons name="map-outline" size={15} color="#22c55e" />
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
                            <SecondPickupIcon size={14} />
                          </View>
                          <View style={styles.routeRowContent}>
                            {isEditingSecondPickup ? (
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
                                suggestionsStyle={styles.routeSuggestionsDropdown}
                              />
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
                                          secondPickupAddress +
                                            ', San Juan de los Morros, Guárico, Venezuela'
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
                      <Ionicons name="location" size={20} color="#22c55e" />
                      <View style={styles.routeRowContent}>
                        <AddressAutocomplete
                          value={destinationAddress}
                          onChangeText={setDestinationAddress}
                          onSelectPlace={place => {
                            setDestinationLocation({
                              latitude: place.latitude,
                              longitude: place.longitude,
                            });
                            setDestinationAddress(place.name); // Show short name in input
                            setDestinationFullAddress(place.description || place.name); // Save full address internally
                            setDestinationLocationSource(place.source ?? null);
                          }}
                          placeholder="¿A dónde vas?"
                          currentLocation={currentLocation ?? undefined}
                          bare
                          style={styles.routeAutocomplete}
                          suggestionsStyle={styles.routeSuggestionsDropdown}
                        />
                      </View>
                      <View style={styles.routeActions}>
                        <TouchableOpacity
                          style={styles.routeActionBtn}
                          onPress={handleSearchDestination}
                        >
                          <Ionicons name="search" size={15} color="#22c55e" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.routeActionBtn}
                          onPress={() => handleEnableMapSelection('destination')}
                        >
                          <Ionicons name="map-outline" size={15} color="#22c55e" />
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Second Destination Row — Oculto para v1.0.0 */}
                    {false && showSecondDestination && (
                      <>
                        {/* Divider */}
                        <View style={styles.routeDivider}>
                          <View style={styles.routeConnectorLine} />
                        </View>

                        <View style={styles.routeRow}>
                          <View style={styles.secondDestinationIconContainer}>
                            <SecondDropoffIcon size={14} />
                          </View>
                          <View style={styles.routeRowContent}>
                            {isEditingSecondDestination ? (
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
                                suggestionsStyle={styles.routeSuggestionsDropdown}
                              />
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
                                          secondDestinationAddress +
                                            ', San Juan de los Morros, Guárico, Venezuela'
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
                        <SecondPickupIcon size={14} color="#22c55e" />
                        <Text style={styles.addPointButtonText}>+ Punto de Recogida</Text>
                      </TouchableOpacity>
                    )}

                    {!showSecondDestination && (
                      <TouchableOpacity
                        style={styles.addPointButton}
                        onPress={() => setShowSecondDestination(true)}
                        activeOpacity={0.7}
                      >
                        <SecondDropoffIcon size={14} color="#22c55e" />
                        <Text style={styles.addPointButtonText}>+ Punto de Destino</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  )}

                  {/* Fare Estimate */}
                  {isCalculatingFare && (
                    <View style={styles.fareLoadingContainer}>
                      <ActivityIndicator size="small" color="#22c55e" />
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
                          color="#22c55e"
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
                            <Ionicons name="time" size={12} color="#f59e0b" />
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
          <View style={styles.modalOverlay}>
            <View style={styles.cancelModalContent}>
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
                        : 'Se aplicará una penalización del 50%'}
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
                  <Ionicons name="checkmark-circle-outline" size={18} color="#22c55e" />
                  <Text style={styles.cancelPolicyRowText}>Gratis durante los primeros 2 minutos</Text>
                </View>
                <View style={styles.cancelPolicyRow}>
                  <Ionicons name="time-outline" size={18} color="#6b7280" />
                  <Text style={styles.cancelPolicyRowText}>Con tarifa si el conductor ya aceptó</Text>
                </View>
                <View style={styles.cancelPolicyRow}>
                  <Ionicons name="warning-outline" size={18} color="#6b7280" />
                  <Text style={styles.cancelPolicyRowText}>50% si el conductor ya llegó al punto</Text>
                </View>
              </View>

              {/* Action buttons */}
              <View style={styles.cancelModalActions}>
                <TouchableOpacity style={styles.cancelBtnKeep} onPress={handleCloseCancelModal} disabled={isCancelling} activeOpacity={0.7}>
                  <Text style={styles.cancelBtnKeepText}>Mantener viaje</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.cancelBtnConfirm, isCancelling && { opacity: 0.6 }]} onPress={handleConfirmCancellation} disabled={isCancelling} activeOpacity={0.8}>
                  {isCancelling ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.cancelBtnConfirmText}>Cancelar viaje</Text>}
                </TouchableOpacity>
              </View>
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
          <View style={styles.modalOverlay}>
            <View style={styles.paymentModalContent}>
              {!paymentCompleted ? (
                <>
                  {/* Payment Header */}
                  <View style={styles.paymentHeader}>
                    <View style={styles.paymentHeaderIcon}>
                      <Ionicons name="checkmark-circle" size={48} color="#22c55e" />
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
                  <View style={styles.paymentMethodSelector}>
                    <Text style={styles.paymentMethodSelectorTitle}>Método de Pago</Text>

                    <View style={styles.paymentMethodOptions}>
                      {/* Cash Option */}
                      <TouchableOpacity
                        style={[
                          styles.paymentMethodOption,
                          paymentMethod === 'cash' && styles.paymentMethodOptionSelected,
                        ]}
                        onPress={() => {
                          setPaymentMethod('cash');
                          setSelectedPlatformMethod(null);
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
                            color={paymentMethod === 'cash' ? '#22c55e' : '#8E8E93'}
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
                            <Ionicons name="checkmark-circle" size={24} color="#22c55e" />
                          </View>
                        )}
                      </TouchableOpacity>

                      {/* Platform Payment Method Options - from admin config */}
                      {platformPaymentMethods.map((pm: any) => {
                        const isSelected = selectedPlatformMethod?.id === pm.id;
                        const isPagoMovil = pm.type === 'pago_movil';
                        const methodType = isPagoMovil ? 'pago_movil' : 'bank_transfer';
                        return (
                          <TouchableOpacity
                            key={pm.id}
                            style={[
                              styles.paymentMethodOption,
                              isSelected && styles.paymentMethodOptionSelected,
                            ]}
                            onPress={() => {
                              setPaymentMethod(methodType);
                              setSelectedPlatformMethod(pm);
                            }}
                          >
                            <View
                              style={[
                                styles.paymentMethodIconCircle,
                                isSelected && styles.paymentMethodIconCircleSelected,
                              ]}
                            >
                              <Ionicons
                                name={isPagoMovil ? 'phone-portrait' : 'business'}
                                size={28}
                                color={isSelected ? '#22c55e' : '#8E8E93'}
                              />
                            </View>
                            <View style={styles.paymentMethodOptionTextContainer}>
                              <Text
                                style={[
                                  styles.paymentMethodOptionText,
                                  isSelected && styles.paymentMethodOptionTextSelected,
                                ]}
                              >
                                {isPagoMovil ? 'Pago Móvil' : 'Transferencia'}
                              </Text>
                              <Text style={styles.paymentMethodOptionSubtext}>
                                {isPagoMovil ? pm.mobileBank : pm.transferBank}
                              </Text>
                            </View>
                            {isSelected && (
                              <View style={styles.paymentMethodCheckmark}>
                                <Ionicons name="checkmark-circle" size={24} color="#22c55e" />
                              </View>
                            )}
                          </TouchableOpacity>
                        );
                      })}

                      {/* Card Option */}
                      <TouchableOpacity
                        style={[
                          styles.paymentMethodOption,
                          paymentMethod === 'card' && styles.paymentMethodOptionSelected,
                        ]}
                        onPress={() => {
                          setPaymentMethod('card');
                          setSelectedPlatformMethod(null);
                        }}
                      >
                        <View
                          style={[
                            styles.paymentMethodIconCircle,
                            paymentMethod === 'card' && styles.paymentMethodIconCircleSelected,
                          ]}
                        >
                          <Ionicons
                            name="card"
                            size={28}
                            color={paymentMethod === 'card' ? '#22c55e' : '#8E8E93'}
                          />
                        </View>
                        <Text
                          style={[
                            styles.paymentMethodOptionText,
                            paymentMethod === 'card' && styles.paymentMethodOptionTextSelected,
                          ]}
                        >
                          Tarjeta
                        </Text>
                        {paymentMethod === 'card' && (
                          <View style={styles.paymentMethodCheckmark}>
                            <Ionicons name="checkmark-circle" size={24} color="#22c55e" />
                          </View>
                        )}
                      </TouchableOpacity>

                      {/* Digital Wallet Option */}
                      <TouchableOpacity
                        style={[
                          styles.paymentMethodOption,
                          paymentMethod === 'digital_wallet' && styles.paymentMethodOptionSelected,
                        ]}
                        onPress={() => {
                          setPaymentMethod('digital_wallet');
                          setSelectedPlatformMethod(null);
                        }}
                      >
                        <View
                          style={[
                            styles.paymentMethodIconCircle,
                            paymentMethod === 'digital_wallet' &&
                              styles.paymentMethodIconCircleSelected,
                          ]}
                        >
                          <Ionicons
                            name="wallet"
                            size={28}
                            color={paymentMethod === 'digital_wallet' ? '#22c55e' : '#8E8E93'}
                          />
                        </View>
                        <Text
                          style={[
                            styles.paymentMethodOptionText,
                            paymentMethod === 'digital_wallet' &&
                              styles.paymentMethodOptionTextSelected,
                          ]}
                        >
                          Billetera
                        </Text>
                        {paymentMethod === 'digital_wallet' && (
                          <View style={styles.paymentMethodCheckmark}>
                            <Ionicons name="checkmark-circle" size={24} color="#22c55e" />
                          </View>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Cash Payment Instructions */}
                  {paymentMethod === 'cash' && (
                    <View style={styles.cashInstructionsContainer}>
                      <Ionicons name="information-circle" size={20} color="#FF9500" />
                      <Text style={styles.cashInstructionsText}>
                        Por favor, paga al conductor en efectivo
                      </Text>
                    </View>
                  )}

                  {/* Process Payment Button */}
                  <TouchableOpacity
                    style={[
                      styles.processPaymentButton,
                      isProcessingPayment && styles.processPaymentButtonDisabled,
                    ]}
                    onPress={handleProcessPayment}
                    disabled={isProcessingPayment}
                  >
                    {isProcessingPayment ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <>
                        <Ionicons name="checkmark-done" size={22} color="#fff" />
                        <Text style={styles.processPaymentButtonText}>
                          {paymentMethod === 'cash'
                            ? 'Confirmar Pago'
                            : paymentMethod === 'pago_movil'
                              ? 'Pagar con Pago Móvil'
                              : paymentMethod === 'bank_transfer'
                                ? 'Pagar con Transferencia'
                                : 'Procesar Pago'}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  {/* Payment Confirmation */}
                  <View style={styles.paymentConfirmationContainer}>
                    <View style={styles.successIconContainer}>
                      <Text style={styles.successIcon}>✅</Text>
                    </View>

                    <Text style={styles.confirmationTitle}>¡Pago Confirmado!</Text>

                    <Text style={styles.confirmationMessage}>
                      {paymentMethod === 'cash'
                        ? 'Gracias por tu pago en efectivo.'
                        : 'Tu pago ha sido procesado exitosamente.'}
                    </Text>

                    <View style={styles.confirmationFareContainer}>
                      <Text style={styles.confirmationFareLabel}>Total Pagado</Text>
                      <Text style={styles.confirmationFareAmount}>
                        {formatCurrency(finalFare || estimatedFare || 0, fareCurrency)}
                      </Text>
                    </View>

                    <Text style={styles.receiptNote}>
                      Se ha enviado un recibo a tu correo electrónico
                    </Text>

                    {/* Continue Button */}
                    <TouchableOpacity
                      style={styles.continueButton}
                      onPress={handleClosePaymentModal}
                    >
                      <Text style={styles.continueButtonText}>Continuar</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          </View>
        </Modal>

        {/* Rating Modal */}
        <Modal
          visible={showRatingModal}
          transparent={true}
          animationType="slide"
          onRequestClose={handleSkipRating}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.ratingModalContent}>
              {/* Rating Header */}
              <View style={styles.ratingHeader}>
                <Text style={styles.ratingTitle}>¿Cómo fue tu viaje?</Text>
                <Text style={styles.ratingSubtitle}>
                  Valora tu experiencia con {activeRide?.driver?.name || 'el conductor'}
                </Text>
              </View>

              {/* Driver Info */}
              {activeRide?.driver && (
                <View style={styles.ratingDriverInfo}>
                  <View style={styles.ratingDriverAvatar}>
                    <Text style={styles.ratingDriverAvatarText}>
                      {activeRide.driver.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View>
                    <Text style={styles.ratingDriverName}>{activeRide.driver.name}</Text>
                    <Text style={styles.ratingDriverVehicle}>
                      {activeRide.driver.vehicleInfo?.model || 'N/A'} -{' '}
                      {activeRide.driver.vehicleInfo?.licensePlate || 'N/A'}
                    </Text>
                  </View>
                </View>
              )}

              {/* Star Rating Component */}
              <View style={styles.starRatingContainer}>
                <Text style={styles.starRatingLabel}>Tu valoración</Text>
                <View style={styles.starsRow}>
                  {[1, 2, 3, 4, 5].map(star => (
                    <TouchableOpacity
                      key={star}
                      onPress={() => setDriverRating(star)}
                      style={styles.starButton}
                    >
                      <Text style={styles.starIcon}>{star <= driverRating ? '⭐' : '☆'}</Text>
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
              </View>

              {/* Comment Input */}
              <View style={styles.commentContainer}>
                <Text style={styles.commentLabel}>Comentario (opcional)</Text>
                <TextInput
                  style={styles.commentInput}
                  placeholder="Cuéntanos más sobre tu experiencia..."
                  placeholderTextColor="#A9A9A9"
                  value={driverComment}
                  onChangeText={setDriverComment}
                  multiline
                  numberOfLines={4}
                  maxLength={500}
                  textAlignVertical="top"
                />
                <Text style={styles.commentCounter}>{driverComment.length}/500</Text>
              </View>

              {/* Rating Modal Buttons */}
              <View style={styles.ratingModalButtons}>
                <TouchableOpacity
                  style={styles.skipRatingButton}
                  onPress={handleSkipRating}
                  disabled={isSubmittingRating}
                >
                  <Text style={styles.skipRatingButtonText}>Omitir</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.submitRatingButton,
                    (driverRating === 0 || isSubmittingRating) && styles.submitRatingButtonDisabled,
                  ]}
                  onPress={handleSubmitRating}
                  disabled={driverRating === 0 || isSubmittingRating}
                >
                  {isSubmittingRating ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.submitRatingButtonText}>Enviar Valoración</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Mobile Payment Modal */}
        <MobilePaymentModal
          visible={showMobilePaymentModal}
          amount={finalFare || estimatedFare || 0}
          currency={fareCurrency}
          exchangeRate={fareBreakdown?.exchangeRate}
          rideId={activeRide?.id || ''}
          passengerName={user?.name || ""}
          platformMethod={selectedPlatformMethod}
          onPaymentComplete={handleMobilePaymentComplete}
          onCancel={handleMobilePaymentCancel}
        />

        {/* Change Payment Method Modal — for switching from cash to pago_movil during ride (Req. 3.2) */}
        <MobilePaymentModal
          visible={showChangePaymentModal}
          amount={estimatedFare || 0}
          currency={fareCurrency}
          exchangeRate={fareBreakdown?.exchangeRate}
          rideId={activeRide?.id || ''}
          onPaymentComplete={handleChangePaymentComplete}
          onCancel={handleChangePaymentCancel}
        />

        {/* Shared Ride Invitation Modal (Req. 7.3, 7.4) */}
        <SharedRideInvitationModal
          visible={showInvitationModal}
          invitation={currentInvitation}
          onAccept={handleInvitationAccept}
          onReject={handleInvitationReject}
          onClose={handleInvitationClose}
        />

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
              <TouchableOpacity
                style={styles.contactModalContent}
                activeOpacity={1}
                onPress={() => {}}
              >
                {/* Header sin foto */}
                <Text style={styles.contactHeaderName}>
                  Contactar a {activeRide?.driver?.name || 'el conductor'}
                </Text>
                <View style={styles.contactPhoneRow}>
                  <Ionicons name="call-outline" size={14} color="#6b7280" />
                  <Text style={styles.contactPhoneText}>
                    {activeRide?.driver?.phone || 'No disponible'}
                  </Text>
                </View>

                <View style={styles.contactDivider} />
                <Text style={styles.contactOptionsTitle}>Selecciona el método de contacto</Text>

                <TouchableOpacity style={styles.contactOptionRow} onPress={handlePhoneCall}>
                  <Ionicons name="call" size={20} color="#22c55e" style={{ marginRight: 12 }} />
                  <View style={styles.contactOptionInfo}>
                    <Text style={styles.contactOptionLabel}>Llamada telefónica</Text>
                    <Text style={styles.contactOptionDesc}>Llamar directamente</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#d1d5db" />
                </TouchableOpacity>

                <TouchableOpacity style={styles.contactOptionRow} onPress={handleWhatsAppCall}>
                  <Ionicons name="logo-whatsapp" size={20} color="#25D366" style={{ marginRight: 12 }} />
                  <View style={styles.contactOptionInfo}>
                    <Text style={styles.contactOptionLabel}>WhatsApp</Text>
                    <Text style={styles.contactOptionDesc}>Abrir conversación</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#d1d5db" />
                </TouchableOpacity>

                <View style={styles.contactNote}>
                  <Ionicons name="information-circle-outline" size={14} color="#22c55e" />
                  <Text style={styles.contactNoteText}>
                    Solo si es necesario para coordinar el viaje.
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.contactCancelBtn}
                  onPress={() => setShowContactModal(false)}
                >
                  <Text style={styles.contactCancelBtnText}>Cancelar</Text>
                </TouchableOpacity>
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
  },
  panelContainerCollapsed: {
    maxHeight: 50,
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
    paddingBottom: 32,
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
    borderColor: '#22c55e',
    borderRadius: 24,
    paddingHorizontal: 20,
    fontSize: 16,
    color: '#505050',
  },
  searchButton: {
    marginLeft: 8,
    backgroundColor: '#22c55e',
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
    backgroundColor: '#22c55e',
    borderColor: '#22c55e',
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
    backgroundColor: '#22c55e',
    borderColor: '#22c55e',
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
    // Expandir el dropdown para cubrir el ancho completo del routeCard
    // compensando: ícono izquierdo (20px) + padding izquierdo (14px) = 34px
    // y botones derecha (60px) + gap (6px) + padding derecho (14px) = 80px
    left: -34,
    right: -80,
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
    borderColor: '#f59e0b',
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
    backgroundColor: '#22c55e',
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
    borderColor: '#22c55e',
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
    color: '#22c55e',
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
    color: '#f59e0b',
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
    color: '#22c55e',
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
    backgroundColor: '#16a34a',
    shadowColor: '#16a34a',
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
    borderColor: '#22c55e',
  },
  searchingPulseRingInner: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 1.5,
    borderColor: '#4ade80',
  },
  searchingIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#F0FDF4',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#22c55e',
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
    backgroundColor: '#22c55e',
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
    backgroundColor: '#22c55e',
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
    backgroundColor: '#22c55e',
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
  rideStatusText: { fontSize: 11, fontWeight: '600', color: '#16a34a' },
  rideStatusTextAccepted: { color: '#2563eb' },
  rideStatusTextArrived: { color: '#ea580c' },
  rideStatusTextInProgress: { color: '#059669' },
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
    backgroundColor: '#22c55e',
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
    backgroundColor: '#22c55e',
  },
  driverAvatarPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#22c55e',
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
    color: '#16a34a',
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
    color: '#16a34a',
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
    backgroundColor: '#22c55e',
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
    borderColor: '#22c55e',
  },
  finalFareLabel: {
    fontSize: 16,
    color: '#505050',
    marginBottom: 8,
  },
  finalFareAmount: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#22c55e',
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
    borderColor: '#22c55e',
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
  paymentMethodSelector: {
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
    borderColor: '#22c55e',
    shadowColor: '#22c55e',
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
    borderColor: '#22c55e',
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
    color: '#22c55e',
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
    backgroundColor: '#22c55e',
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: '#22c55e',
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
    borderColor: '#22c55e',
  },
  successIcon: {
    fontSize: 48,
  },
  confirmationTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#22c55e',
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
    color: '#22c55e',
  },
  receiptNote: {
    fontSize: 13,
    color: '#A9A9A9',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 18,
  },
  continueButton: {
    backgroundColor: '#22c55e',
    borderRadius: 24,
    paddingVertical: 16,
    paddingHorizontal: 48,
    alignItems: 'center',
    width: '100%',
    shadowColor: '#22c55e',
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
  ratingModalContent: {
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
  ratingTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#22c55e',
    marginBottom: 8,
  },
  ratingSubtitle: {
    fontSize: 16,
    color: '#505050',
    textAlign: 'center',
  },
  ratingDriverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FFF0',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#22c55e',
  },
  ratingDriverAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#22c55e',
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
  ratingText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#22c55e',
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
    borderColor: '#22c55e',
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
    backgroundColor: '#22c55e',
    borderRadius: 24,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: '#22c55e',
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
    backgroundColor: '#22c55e',
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
    borderColor: '#22c55e', // green-500 — matches system theme
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 10,
    gap: 6,
    flexShrink: 1,
  },
  addPointButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#16a34a', // green-600 — matches system theme
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
    backgroundColor: '#22c55e',
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
});
