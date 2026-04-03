import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
  Keyboard,
  Image,
  Modal,
  Linking,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import MapView, { Marker, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { rideAPI, paymentAPI, ratingAPI } from '@/services/api';
import mapsService from '@/services/mapsService';
import {
  connectSocket,
  disconnectSocket,
  joinRide,
  leaveRide,
  onRideAccepted,
  onRideStatusChanged,
  onDriverLocationUpdate,
  onETAUpdate,
  onDriverArrived,
  onRideCancelled,
  onRideCompleted,
  removeAllListeners,
} from '@/services/socket';
import { logInfo, logError, logWarning } from '@/utils/errorLogger';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useSocketReconnect } from '@/hooks/useSocketReconnect';
import { useSound } from '@/hooks/useSound';
import { useCancellationPolicy } from '@/hooks/useCancellationPolicy';
import MobilePaymentModal from '@/components/MobilePaymentModal';
import { formatCurrency, Currency } from '@/utils/currency';

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

  // Map selection mode states
  const [mapSelectionMode, setMapSelectionMode] = useState<'none' | 'pickup' | 'destination'>(
    'none'
  );
  const [tempMarkerLocation, setTempMarkerLocation] = useState<LocationCoords | null>(null);

  // UI states
  const [isLoadingLocation, setIsLoadingLocation] = useState(true);
  const [isRequestingRide, setIsRequestingRide] = useState(false);
  const [isSearchingDriver, setIsSearchingDriver] = useState(false);
  const [vehicleType, setVehicleType] = useState<'taxi' | 'moto_taxi'>('taxi');
  const [motoQuantity, setMotoQuantity] = useState<1 | 2>(1);
  const [estimatedFare, setEstimatedFare] = useState<number | null>(null);
  const [fareCurrency, setFareCurrency] = useState<Currency>('VES');
  const [fareBreakdown, setFareBreakdown] = useState<{
    baseFare: number;
    perKmRate: number;
    perMinuteRate: number;
    distance: number;
    duration: number;
  } | null>(null);
  const [primaryFareConfig, setPrimaryFareConfig] = useState<{
    baseFare: number;
    perKmRate: number;
    perMinuteRate: number;
    surgeMultiplier: number;
  } | null>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<RouteCoordinates[]>([]);
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);

  // Active ride tracking states
  const [activeRide, setActiveRide] = useState<ActiveRide | null>(null);
  const [driverLocation, setDriverLocation] = useState<LocationCoords | null>(null);
  const [driverHeading, setDriverHeading] = useState<number>(0); // Driver's heading/direction
  const [isSocketConnected, setIsSocketConnected] = useState(false);

  // Cancellation modal states
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancellationFeeWarning, setCancellationFeeWarning] = useState<string | null>(null);
  
  // Animation values for cancel modal
  const modalScale = useSharedValue(0);
  const modalOpacity = useSharedValue(0);
  const modalTranslateY = useSharedValue(50);
  const buttonScale = useSharedValue(1);
  
  // Safe area insets for modal
  const insets = useSafeAreaInsets();
  
  // Use cancellation policy hook - only fetch when ride is in a cancellable state AND user is authenticated
  const canFetchPolicy = !!token && !!activeRide && ['pending', 'accepted', 'arrived'].includes(activeRide.status);
  const { policy: cancellationPolicy, loading: loadingPolicy } = useCancellationPolicy(
    activeRide?.id || null,
    { enabled: canFetchPolicy }
  );

  // Payment modal states
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showMobilePaymentModal, setShowMobilePaymentModal] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentCompleted, setPaymentCompleted] = useState(false);
  const [finalFare, setFinalFare] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'digital_wallet'>('cash');

  // Rating modal states
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [driverRating, setDriverRating] = useState(0);
  const [driverComment, setDriverComment] = useState('');
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);

  // Contact modal states
  const [showContactModal, setShowContactModal] = useState(false);

  // Notification tracking - to avoid showing "driver nearby" notification multiple times
  const [hasShownNearbyNotification, setHasShownNearbyNotification] = useState(false);

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
          Alert.alert(
            'Permiso Denegado',
            'Se necesita acceso a la ubicación para usar esta función.'
          );
          setIsLoadingLocation(false);
          return;
        }

        logInfo('PassengerHomeScreen', 'Getting current location...');

        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });

        logInfo('PassengerHomeScreen', 'Location obtained', {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });

        const coords = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        };

        setCurrentLocation(coords);
        setPickupLocation(coords);

        // Get address for current location using our backend (Nominatim via backend)
        try {
          const locationData = await mapsService.reverseGeocode(coords.latitude, coords.longitude);
          if (locationData.address) {
            setPickupAddress(locationData.address);
            logInfo('PassengerHomeScreen', 'Address resolved via backend', {
              address: locationData.address,
            });
          } else {
            // Fallback to coordinates if no address returned
            setPickupAddress(`${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}`);
          }
        } catch (geocodeError) {
          // Fallback to coordinates if geocoding fails
          setPickupAddress(`${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}`);
          logInfo('PassengerHomeScreen', 'Using coordinates as address (geocoding failed)');
        }

        setIsLoadingLocation(false);
        logInfo('PassengerHomeScreen', 'Location setup complete');
      } catch (error) {
        logError('PassengerHomeScreen', error, { context: 'Getting location' });
        console.error('Location error:', error);
        
        // Use fallback location for development/testing
        const fallbackCoords = {
          latitude: 9.899159, // San Juan de Los Morros, Venezuela
          longitude: -67.3496342,
        };
        
        setCurrentLocation(fallbackCoords);
        setPickupLocation(fallbackCoords);
        setPickupAddress('Ubicación de prueba - San Juan de Los Morros');
        setIsLoadingLocation(false);
        
        logWarning('PassengerHomeScreen', 'Using fallback location due to error');
      }
    })();
  }, [user]);

  // Load primary fare config when vehicle type changes
  useEffect(() => {
    loadPrimaryFareConfig();
  }, [vehicleType]);

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
      Alert.alert(
        '🚗 ¡Tu Conductor Viene en Camino!',
        `${data.driver?.name || 'Tu conductor'} ha aceptado tu viaje y se dirige hacia ti.\n\n` +
        `🚙 Vehículo: ${vehicleText}\n` +
        `${ratingText ? `${ratingText}\n` : ''}` +
        `\nPuedes ver su ubicación en el mapa.`,
        [
          { 
            text: 'Ver en Mapa', 
            onPress: () => {
              // Focus map on driver location if available
              if (data.driver?.currentLocation && mapRef.current) {
                mapRef.current.animateToRegion(
                  {
                    latitude: data.driver.currentLocation.latitude,
                    longitude: data.driver.currentLocation.longitude,
                    latitudeDelta: 0.02,
                    longitudeDelta: 0.02,
                  },
                  1000
                );
              }
            }
          },
          { text: 'Entendido', style: 'cancel' }
        ]
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
        Alert.alert(
          '📍 ¡Tu Conductor ha Llegado!',
          'Tu conductor está esperándote en el punto de recogida. Por favor dirígete al vehículo.',
          [
            {
              text: 'Ver Ubicación',
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
            },
            { text: 'OK', style: 'cancel' }
          ]
        );
      } else if (data.status === 'in_progress') {
        playNotificationSound();
        Alert.alert(
          '🚀 ¡Viaje en Progreso!',
          '¡Buen viaje! Tu conductor te llevará a tu destino de forma segura.',
          [{ text: 'Entendido' }]
        );
      }
      // Note: 'completed' status is handled by the dedicated handleRideCompleted event listener
    };

    // Listen for driver location updates
    const handleDriverLocationUpdate = (data: any) => {
      console.log('📍 Driver location update:', data);

      setDriverLocation({
        latitude: data.latitude,
        longitude: data.longitude,
      });
      
      // Update driver heading if available
      if (data.heading !== undefined && data.heading !== null) {
        setDriverHeading(data.heading);
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
        
        Alert.alert(
          '🚗 ¡Tu Conductor Está Cerca!',
          `Tu conductor llegará en aproximadamente ${Math.ceil(estimatedMinutes)} minuto${estimatedMinutes > 1 ? 's' : ''}.\n\n` +
          `Prepárate para abordar el vehículo.`,
          [{ text: 'Entendido' }]
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
      Alert.alert(
        '📍 ¡Tu Conductor Está Aquí!',
        `${data.driverName} te está esperando en el punto de recogida.\n\n` +
        `Por favor dirígete al vehículo. Si no lo ves, puedes llamarlo desde el panel.`,
        [
          {
            text: 'Ver en Mapa',
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
          },
          { text: 'Ya Voy', style: 'cancel' },
        ]
      );
    };

    // Listen for ride cancelled event
    const handleRideCancelled = (data: any) => {
      console.log('❌ Ride cancelled:', data);

      // Play notification sound
      playNotificationSound();

      // Show native alert based on who cancelled
      if (data.cancelledBy === 'system') {
        Alert.alert(
          '😔 No Hay Conductores Disponibles',
          data.cancellationReason ||
            'Lo sentimos, no encontramos conductores disponibles en este momento.\n\n' +
            'Por favor intenta nuevamente en unos minutos.',
          [{ text: 'Entendido' }]
        );

        // Reset ride state
        setActiveRide(null);
        setDriverLocation(null);
        setIsSearchingDriver(false);
      } else if (data.cancelledBy === 'driver') {
        Alert.alert(
          '⚠️ Conductor Canceló el Viaje',
          `El conductor ha cancelado tu viaje.\n\n` +
          `Motivo: ${data.cancellationReason || 'No especificado'}\n\n` +
          `Estamos buscando otro conductor disponible para ti.`,
          [{ text: 'Buscar Otro Conductor' }]
        );
      } else if (data.cancelledBy === 'passenger') {
        // Show cancellation fee if applicable
        const feeMessage =
          data.cancellationFee > 0
            ? `\n\n💰 Tarifa de cancelación aplicada: ${formatCurrency(data.cancellationFee, fareCurrency)}`
            : '';

        Alert.alert(
          '✓ Viaje Cancelado',
          `Tu viaje ha sido cancelado exitosamente.${feeMessage}`,
          [{ text: 'Entendido' }]
        );

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
      Alert.alert(
        '🎉 Viaje Completado',
        `Tu viaje ha finalizado exitosamente.\n\nTarifa Final: ${formatCurrency(data.finalFare, fareCurrency)}\n\nPor favor califica tu experiencia.`,
        [
          {
            text: 'Calificar',
            onPress: () => {
              console.log('[PASSENGER] Opening rating modal');
              setShowRatingModal(true);
            },
          },
        ],
        { cancelable: false }
      );
    };

    // Register event listeners
    console.log('[PASSENGER] Registering socket event listeners...');
    onRideAccepted(handleRideAccepted);
    onRideStatusChanged(handleRideStatusChanged);
    onDriverLocationUpdate(handleDriverLocationUpdate);
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
  }, [activeRide?.id]); // Only re-run when ride ID changes (new ride created)

  const calculateRoute = useCallback(async () => {
    if (!pickupLocation || !destinationLocation) return;

    try {
      logInfo('PassengerHomeScreen', 'Calculating route with OSRM...', {
        pickup: pickupLocation,
        destination: destinationLocation,
      });

      // Get route from OSRM via backend
      const routeData = await mapsService.getRoute(pickupLocation, destinationLocation);

      // Convert OSRM polyline format [longitude, latitude] to React Native Maps format {latitude, longitude}
      const convertedRoute: RouteCoordinates[] = routeData.polyline.map(
        (coord: [number, number]) => ({
          latitude: coord[1],
          longitude: coord[0],
        })
      );

      setRouteCoordinates(convertedRoute);

      logInfo('PassengerHomeScreen', 'Route calculated successfully', {
        pointsCount: convertedRoute.length,
        distance: routeData.distance,
        duration: routeData.duration,
      });

      // Fit map to show the route
      if (mapRef.current && convertedRoute.length > 0) {
        mapRef.current.fitToCoordinates(convertedRoute, {
          edgePadding: { top: 100, right: 50, bottom: 300, left: 50 },
          animated: true,
        });
      }
    } catch (error) {
      logError('PassengerHomeScreen', error, { context: 'Calculating route with OSRM' });

      // Fallback to straight line if OSRM fails
      logWarning('PassengerHomeScreen', 'Falling back to straight line route');
      const fallbackRoute = [pickupLocation, destinationLocation];
      setRouteCoordinates(fallbackRoute);

      if (mapRef.current) {
        mapRef.current.fitToCoordinates(fallbackRoute, {
          edgePadding: { top: 100, right: 50, bottom: 300, left: 50 },
          animated: true,
        });
      }
    }
  }, [pickupLocation, destinationLocation]);

  const loadPrimaryFareConfig = async () => {
    try {
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_API_URL}/api/rides/fare/primary/${vehicleType}`
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        // If no primary fare is configured (404), use fallback silently
        if (response.status === 404 || errorData.error?.message?.includes('No hay tarifa principal')) {
          logInfo('PassengerHomeScreen', `No primary fare configured for ${vehicleType}, using fallback values`);
          setPrimaryFareConfig({
            baseFare: vehicleType === 'taxi' ? 5 : 3,
            perKmRate: vehicleType === 'taxi' ? 2 : 1.5,
            perMinuteRate: vehicleType === 'taxi' ? 0.5 : 0.3,
            surgeMultiplier: 1.0,
          });
          setFareCurrency('VES'); // Default to VES for fallback
          return;
        }
        
        throw new Error(`Failed to load fare config: ${response.status}`);
      }

      const result = await response.json();
      if (result.success && result.data) {
        logInfo('PassengerHomeScreen', `Primary fare loaded successfully for ${vehicleType}`);
        setPrimaryFareConfig({
          baseFare: result.data.baseFare,
          perKmRate: result.data.perKmRate,
          perMinuteRate: result.data.perMinuteRate,
          surgeMultiplier: result.data.surgeMultiplier || 1.0,
        });
        // Set currency from fare config
        setFareCurrency(result.data.currency || 'VES');
      }
    } catch (error) {
      logError('PassengerHomeScreen', 'Error loading primary fare config', error);
      // Use fallback values if API fails
      setPrimaryFareConfig({
        baseFare: vehicleType === 'taxi' ? 5 : 3,
        perKmRate: vehicleType === 'taxi' ? 2 : 1.5,
        perMinuteRate: vehicleType === 'taxi' ? 0.5 : 0.3,
        surgeMultiplier: 1.0,
      });
      setFareCurrency('VES'); // Default to VES for fallback
    }
  };

  const calculateFare = useCallback(() => {
    if (!pickupLocation || !destinationLocation || !primaryFareConfig) return;

    // Calculate distance (Haversine formula)
    const R = 6371; // Earth's radius in km
    const dLat = toRad(destinationLocation.latitude - pickupLocation.latitude);
    const dLon = toRad(destinationLocation.longitude - pickupLocation.longitude);
    const lat1 = toRad(pickupLocation.latitude);
    const lat2 = toRad(destinationLocation.latitude);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    // Estimate duration (rough estimate: 3 min per km)
    const estimatedDuration = distance * 3;

    // Use primary fare config from backend
    const { baseFare, perKmRate, perMinuteRate, surgeMultiplier } = primaryFareConfig;

    // Calculate fare using backend configuration
    const subtotal = baseFare + (distance * perKmRate) + (estimatedDuration * perMinuteRate);
    const fare = subtotal * surgeMultiplier;
    
    setEstimatedFare(Math.round(fare * 100) / 100);

    // Store breakdown for display
    setFareBreakdown({
      baseFare,
      perKmRate,
      perMinuteRate,
      distance: Math.round(distance * 100) / 100,
      duration: Math.round(estimatedDuration * 100) / 100,
    });
  }, [pickupLocation, destinationLocation, primaryFareConfig]);

  // Calculate route and fare when destination changes
  useEffect(() => {
    if (pickupLocation && destinationLocation) {
      calculateRoute();
      calculateFare();
    }
  }, [pickupLocation, destinationLocation, calculateRoute, calculateFare]);

  const toRad = (value: number) => (value * Math.PI) / 180;

  /**
   * Handle contact driver - show modal to choose contact method
   */
  const handleContactDriver = () => {
    if (!activeRide?.driver?.phone) {
      Alert.alert('Error', 'Número de teléfono no disponible');
      return;
    }
    setShowContactModal(true);
  };

  /**
   * Handle phone call
   */
  const handlePhoneCall = () => {
    if (!activeRide?.driver?.phone) {
      Alert.alert('Error', 'Número de teléfono no disponible');
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
      Alert.alert('Error', 'Número de teléfono no disponible');
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
    Linking.openURL(whatsappUrl)
      .catch((err) => {
        console.error('Error opening WhatsApp:', err);
        Alert.alert(
          'Error', 
          'No se pudo abrir WhatsApp. Asegúrate de tener WhatsApp instalado.'
        );
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
      Alert.alert('Error', 'Por favor ingresa una dirección de destino');
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

      const location = await mapsService.geocodeAddress(searchQuery);

      if (!location || !location.latitude || !location.longitude) {
        Alert.alert(
          'Dirección no encontrada',
          'No se pudo encontrar la dirección. Intenta ser más específico (ej: incluye calle o sector).'
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

      // Check if it's a "not found" error
      const isNotFound =
        error.response?.status === 404 ||
        error.message?.includes('no encontr') ||
        error.message?.includes('not found');

      if (isNotFound) {
        Alert.alert(
          'Dirección no encontrada',
          'No se pudo encontrar esa dirección específica. Intenta:\n\n' +
            '• Usar direcciones generales (ej: "Calle Principal", "Plaza Bolívar")\n' +
            '• Usar sectores o zonas (ej: "Centro", "Las Delicias")\n' +
            '• Evitar nombres de negocios específicos\n' +
            '• Usar puntos de referencia conocidos'
        );
      } else {
        logError('PassengerHomeScreen', error, { context: 'Geocoding destination' });
        Alert.alert('Error', 'No se pudo buscar la dirección. Verifica tu conexión.');
      }
    }
  };

  const handleSearchPickup = async () => {
    if (!pickupAddress.trim()) {
      Alert.alert('Error', 'Por favor ingresa una dirección de recogida');
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

      const location = await mapsService.geocodeAddress(searchQuery);

      if (!location || !location.latitude || !location.longitude) {
        Alert.alert('Error', 'No se encontró la dirección. Intenta con otra.');
        return;
      }

      console.log('[PICKUP GEOCODING] Location found:', location);

      setPickupLocation({
        latitude: location.latitude,
        longitude: location.longitude,
      });

      // Keep the original user input in the text field (don't update with full address)
      // The full address is only used internally for accuracy
    } catch (error) {
      console.error('Pickup geocoding error:', error);
      logError('PassengerHomeScreen', error, { context: 'Geocoding pickup' });
      Alert.alert('Error', 'No se pudo buscar la dirección. Verifica tu conexión.');
    }
  };

  // Map selection handlers
  const handleEnableMapSelection = (mode: 'pickup' | 'destination') => {
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
    console.log('[MAP_PRESS] Normal press, collapsing panel');
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
      Alert.alert('Error', 'No se pudo capturar la ubicación. Intenta de nuevo.');
      return;
    }

    const { coordinate } = event.nativeEvent;

    if (!coordinate) {
      console.warn('[MAP_LONG_PRESS] No coordinate in event');
      Alert.alert('Error', 'No se pudo obtener las coordenadas. Intenta de nuevo.');
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
      const locationData = await mapsService.reverseGeocode(
        coordinate.latitude,
        coordinate.longitude
      );

      console.log('[MAP_LONG_PRESS] Reverse geocode result:', locationData);

      const address =
        locationData.address ||
        `${coordinate.latitude.toFixed(6)}, ${coordinate.longitude.toFixed(6)}`;

      console.log('[MAP_LONG_PRESS] Address to show:', address);

      // Confirm selection with user
      Alert.alert('Confirmar Ubicación', `¿Usar esta ubicación?\n\n${address}`, [
        {
          text: 'Cancelar',
          style: 'cancel',
          onPress: () => {
            console.log('[MAP_LONG_PRESS] User cancelled selection');
            setTempMarkerLocation(null);
          },
        },
        {
          text: 'Confirmar',
          onPress: () => {
            console.log('[MAP_LONG_PRESS] User confirmed selection');
            const shortAddress = extractShortAddress(address);
            if (mapSelectionMode === 'pickup') {
              setPickupLocation(coordinate);
              setPickupAddress(shortAddress);
            } else if (mapSelectionMode === 'destination') {
              setDestinationLocation(coordinate);
              setDestinationAddress(shortAddress);
            }

            // Reset selection mode
            setMapSelectionMode('none');
            setTempMarkerLocation(null);
            setIsPanelCollapsed(false);
          },
        },
      ]);
    } catch (error) {
      console.error('[MAP_LONG_PRESS] Reverse geocoding error:', error);

      // Fallback to coordinates if reverse geocoding fails
      const address = `${coordinate.latitude.toFixed(6)}, ${coordinate.longitude.toFixed(6)}`;

      Alert.alert(
        'Confirmar Ubicación',
        `No se pudo obtener la dirección exacta.\n¿Usar estas coordenadas?\n\n${address}`,
        [
          {
            text: 'Cancelar',
            style: 'cancel',
            onPress: () => {
              setTempMarkerLocation(null);
            },
          },
          {
            text: 'Confirmar',
            onPress: () => {
              const shortAddress = extractShortAddress(address);
              if (mapSelectionMode === 'pickup') {
                setPickupLocation(coordinate);
                setPickupAddress(shortAddress);
              } else if (mapSelectionMode === 'destination') {
                setDestinationLocation(coordinate);
                setDestinationAddress(shortAddress);
              }

              // Reset selection mode
              setMapSelectionMode('none');
              setTempMarkerLocation(null);
              setIsPanelCollapsed(false);
            },
          },
        ]
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
      Alert.alert('Error', 'No se pudo obtener tu ubicación actual');
      return;
    }

    try {
      // Use current location for pickup
      setPickupLocation(currentLocation);
      setIsEditingPickup(false);

      // Get short address for current location
      const locationData = await mapsService.reverseGeocode(
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
        calculateFare();
      }
    } catch (error) {
      console.error('Error using current location:', error);
      setPickupAddress('Ubicación actual');
    }
  };

  const handleRequestRide = async () => {
    if (!pickupLocation || !destinationLocation) {
      Alert.alert('Error', 'Por favor selecciona un destino');
      return;
    }

    if (!user) {
      Alert.alert('Error', 'Debes iniciar sesión para solicitar un viaje');
      return;
    }

    setIsRequestingRide(true);

    try {
      // For now, use cash as default payment method
      const response = await rideAPI.requestRide({
        pickupLatitude: pickupLocation.latitude,
        pickupLongitude: pickupLocation.longitude,
        pickupAddress: pickupAddress || 'Ubicación actual',
        destinationLatitude: destinationLocation.latitude,
        destinationLongitude: destinationLocation.longitude,
        destinationAddress: destinationAddress,
        vehicleType: vehicleType,
        paymentMethodId: 'cash', // Default to cash
      });

      // Set active ride with pending status
      const rideId = response.data.data?.id || response.data.id;

      if (!rideId) {
        console.error('No ride ID in response:', response.data);
        throw new Error('No se recibió el ID del viaje');
      }

      setActiveRide({
        id: rideId,
        status: 'pending',
      });

      // Show searching driver state
      setIsRequestingRide(false);
      setIsSearchingDriver(true);

      // Show native alert for searching driver
      Alert.alert(
        'Buscando conductor...',
        'Estamos notificando a conductores cercanos',
        [
          {
            text: 'Cancelar Búsqueda',
            onPress: handleCancelSearching,
            style: 'cancel',
          },
        ]
      );

      console.log('✅ Ride requested:', rideId);
    } catch (error: any) {
      console.error('Request ride error:', error);
      logError('PassengerHomeScreen', error, { context: 'Request ride' });
      setIsRequestingRide(false);
      setIsSearchingDriver(false);

      // Handle specific error cases with user-friendly messages
      if (error.response?.status === 404) {
        Alert.alert(
          'No hay conductores disponibles',
          'Lo sentimos, no hay conductores disponibles en tu área en este momento. Por favor, intenta nuevamente en unos minutos.',
          [{ text: 'OK' }]
        );
      } else if (error.response?.status === 401) {
        Alert.alert(
          'Sesión expirada',
          'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.',
          [{ text: 'OK' }]
        );
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
      Alert.alert(
        'Búsqueda Cancelada',
        'Has cancelado la búsqueda de conductor',
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      console.log('Cancelling ride:', activeRide.id);
      await rideAPI.cancelRide(activeRide.id, { reason: 'passenger_cancelled' });

      // Reset states
      setActiveRide(null);
      setIsSearchingDriver(false);

      // Show cancellation confirmation
      Alert.alert(
        'Búsqueda Cancelada',
        'Has cancelado la búsqueda de conductor',
        [{ text: 'OK' }]
      );
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
        Alert.alert('Búsqueda Finalizada', 'La búsqueda ya ha sido cancelada.');
      } else {
        Alert.alert('Error', 'No se pudo cancelar la búsqueda. Por favor, intenta nuevamente.');
      }
    }
  };

  const handleCancelRidePress = () => {
    if (!activeRide) return;

    // Check if we can cancel using the policy
    if (!cancellationPolicy) {
      Alert.alert('Error', 'No se pudo obtener la política de cancelación');
      return;
    }

    if (!cancellationPolicy.canCancel) {
      Alert.alert(
        'No se puede cancelar',
        'No es posible cancelar el viaje en este momento'
      );
      return;
    }

    setShowCancelModal(true);
    
    // Trigger animations with staggered timing for smooth entrance
    modalOpacity.value = withTiming(1, {
      duration: 250,
      easing: Easing.out(Easing.ease),
    });
    modalScale.value = withSpring(1, {
      damping: 15,
      stiffness: 150,
    });
    modalTranslateY.value = withSpring(0, {
      damping: 20,
      stiffness: 100,
    });
  };


  const handleConfirmCancellation = async () => {
    if (!activeRide) return;

    setIsCancelling(true);

    try {
      const response = await rideAPI.cancelRide(activeRide.id, { reason: 'passenger_cancelled' });

      console.log('✅ Ride cancelled:', response.data);

      // Close modal
      setShowCancelModal(false);
      setIsCancelling(false);

      // The ride:cancelled event will handle the rest via WebSocket
    } catch (error: any) {
      console.error('Cancel ride error:', error);
      logError('PassengerHomeScreen', error, { context: 'Cancel ride' });
      setIsCancelling(false);

      // Show user-friendly error message
      const errorMessage = error.response?.data?.error?.message
        ? error.response.data.error.message
        : 'No se pudo cancelar el viaje. Por favor intenta nuevamente.';

      Alert.alert('No se pudo cancelar', errorMessage);
    }
  };

  const handleCloseCancelModal = () => {
    // Animate out with smooth exit
    modalScale.value = withTiming(0.9, {
      duration: 200,
      easing: Easing.in(Easing.ease),
    });
    modalOpacity.value = withTiming(0, {
      duration: 200,
      easing: Easing.in(Easing.ease),
    });
    modalTranslateY.value = withTiming(50, {
      duration: 200,
      easing: Easing.in(Easing.ease),
    });
    
    // Close modal after animation
    setTimeout(() => {
      setShowCancelModal(false);
      setCancellationFeeWarning(null);
      // Reset animation values
      modalScale.value = 0;
      modalTranslateY.value = 50;
    }, 200);
  };

  const handleProcessPayment = async () => {
    if (!activeRide) return;

    // If payment method is cash, just show confirmation
    if (paymentMethod === 'cash') {
      setPaymentCompleted(true);
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

      Alert.alert('No se pudo completar el pago', errorMessage, [
        {
          text: 'Reintentar',
          onPress: handleProcessPayment,
        },
        {
          text: 'Cancelar',
          style: 'cancel',
        },
      ]);
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
  }) => {
    if (!activeRide) {
      Alert.alert('Error', 'No hay un viaje activo');
      return;
    }

    try {
      // Cerrar modal y mostrar loading
      setShowMobilePaymentModal(false);
      setIsRequestingRide(true); // Usar el estado de loading existente

      // Llamar al backend para procesar el pago
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
      Alert.alert(
        'Pago Confirmado',
        'Tu pago ha sido procesado exitosamente. El conductor ha sido notificado.',
        [{ text: 'OK' }]
      );
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
      
      Alert.alert(
        'Error al Procesar Pago',
        errorMessage,
        [
          {
            text: 'Reintentar',
            onPress: () => setShowMobilePaymentModal(true),
          },
          {
            text: 'Cancelar',
            style: 'cancel',
          },
        ]
      );
    }
  };

  const handleMobilePaymentCancel = () => {
    setShowMobilePaymentModal(false);
    Alert.alert(
      'Pago Pendiente',
      'Debes completar el pago para que el conductor inicie el viaje.',
      [{ text: 'OK' }]
    );
  };

  const handleSubmitRating = async () => {
    if (!activeRide || driverRating === 0) {
      Alert.alert('Error', 'Por favor selecciona una valoración');
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
      Alert.alert(
        '¡Gracias!',
        'Tu valoración ha sido enviada exitosamente.',
        [{ text: 'OK' }]
      );

      handleCloseRatingModal();
    } catch (error: any) {
      console.error('Submit rating error:', error);
      logError('PassengerHomeScreen', error, { context: 'Submit rating' });
      setIsSubmittingRating(false);

      // Show user-friendly error message
      const errorMessage = error.response?.data?.error?.message
        ? error.response.data.error.message
        : 'No se pudo enviar la valoración. Por favor intenta nuevamente.';

      Alert.alert('No se pudo enviar', errorMessage);
    }
  };

  const handleSkipRating = () => {
    Alert.alert(
      'Omitir Valoración',
      '¿Estás seguro que deseas omitir la valoración del conductor?',
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Omitir',
          onPress: handleCloseRatingModal,
          style: 'destructive',
        },
      ]
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
    setDestinationLocation(null);
    setDestinationAddress('');
    setEstimatedFare(null);
    setFareBreakdown(null);
    setRouteCoordinates([]);
    setIsSearchingDriver(false);
    setHasShownNearbyNotification(false);

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
            showsUserLocation
            showsMyLocationButton
            onPress={handleMapPress}
            onLongPress={handleMapLongPress}
            scrollEnabled={true}
            zoomEnabled={true}
            rotateEnabled={true}
            pitchEnabled={true}
            showsBuildings={true}
            showsTraffic={false}
            loadingEnabled={true}
            loadingIndicatorColor="#22c55e"
            onMapReady={() => {
              logInfo('PassengerHomeScreen', 'MapView ready');
              console.log('[MAP] ========================================');
              console.log('[MAP] MapView is ready');
              console.log('[MAP] onLongPress handler:', !!handleMapLongPress);
              console.log('[MAP] ========================================');
            }}
          >
            {/* Pickup Marker */}
            {pickupLocation && !activeRide && (
              <Marker
                coordinate={pickupLocation}
                title="Punto de recogida"
                description={pickupAddress}
                pinColor="#FF8C00"
              />
            )}

            {/* Destination Marker */}
            {destinationLocation && (
              <Marker
                coordinate={destinationLocation}
                title="Destino"
                description={destinationAddress}
                pinColor="#22c55e"
              />
            )}

            {/* Temporary Marker during map selection */}
            {tempMarkerLocation && mapSelectionMode !== 'none' && (
              <Marker
                coordinate={tempMarkerLocation}
                title={mapSelectionMode === 'pickup' ? 'Punto de recogida' : 'Destino'}
                pinColor={mapSelectionMode === 'pickup' ? '#FF8C00' : '#22c55e'}
                opacity={0.7}
              />
            )}

            {/* Driver Marker - 3D Gray Car (changes to Orange when transporting passenger) */}
            {driverLocation && activeRide && (
              <Marker
                coordinate={driverLocation}
                title={activeRide.driver?.name || 'Conductor'}
                description={`${activeRide.driver?.vehicleInfo?.model || activeRide.driver?.vehicleModel || 'Vehículo'} - ${activeRide.driver?.vehicleInfo?.licensePlate || activeRide.driver?.licensePlate || 'N/A'}`}
                anchor={{ x: 0.5, y: 0.5 }}
                flat={true}
                rotation={driverHeading || 0}
              >
                <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                  {/* 3D Car Icon - Gray when going to pickup, Orange when transporting */}
                  <View
                    style={{
                      width: 50,
                      height: 50,
                      backgroundColor: activeRide.status === 'in_progress' ? '#FF8C00' : '#6B7280',
                      borderRadius: 25,
                      justifyContent: 'center',
                      alignItems: 'center',
                      borderWidth: 3,
                      borderColor: '#fff',
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 3 },
                      shadowOpacity: 0.4,
                      shadowRadius: 5,
                      elevation: 8,
                    }}
                  >
                    <Ionicons name="car" size={28} color="#fff" />
                  </View>
                  {/* Pulse effect - color matches car */}
                  <View
                    style={{
                      position: 'absolute',
                      width: 70,
                      height: 70,
                      borderRadius: 35,
                      backgroundColor: activeRide.status === 'in_progress' 
                        ? 'rgba(255, 140, 0, 0.2)' 
                        : 'rgba(107, 114, 128, 0.2)',
                      borderWidth: 2,
                      borderColor: activeRide.status === 'in_progress'
                        ? 'rgba(255, 140, 0, 0.3)'
                        : 'rgba(107, 114, 128, 0.3)',
                    }}
                  />
                </View>
              </Marker>
            )}

            {/* Route Polyline */}
            {routeCoordinates.length > 0 && (
              <Polyline coordinates={routeCoordinates} strokeColor="#22c55e" strokeWidth={3} />
            )}
          </MapView>
        </ErrorBoundary>

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
                  {mapSelectionMode === 'pickup' ? 'recogida' : 'destino'}
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
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.panelContent}
              style={styles.panelScrollView}
              keyboardOpeningTime={0}
            >
              {/* Active Ride - Driver Info Full Screen */}
              {activeRide && activeRide.driver && (
                <View style={styles.driverInfoFullContainer}>
                  {/* Driver Header Section */}
                  <View style={styles.driverHeaderSection}>
                    <View style={styles.driverAvatarContainer}>
                      <View style={styles.driverAvatar}>
                        {activeRide.driver.profilePhotoUrl ? (
                          <Image
                            source={{ uri: activeRide.driver.profilePhotoUrl }}
                            style={styles.driverAvatarImage}
                          />
                        ) : (
                          <View style={styles.driverAvatarPlaceholder}>
                            <Text style={styles.driverAvatarText}>
                              {activeRide.driver.name.charAt(0).toUpperCase()}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                    
                    <View style={styles.driverInfoContent}>
                      <View style={styles.driverNameRow}>
                        <Text style={styles.driverName}>{activeRide.driver.name}</Text>
                        <View style={[
                          styles.statusBadge,
                          activeRide.status === 'accepted' && styles.statusBadgeAccepted,
                          activeRide.status === 'arrived' && styles.statusBadgeArrived,
                          activeRide.status === 'in_progress' && styles.statusBadgeInProgress,
                        ]}>
                          <Text style={[
                            styles.statusBadgeText,
                            activeRide.status === 'accepted' && styles.statusBadgeTextAccepted,
                            activeRide.status === 'arrived' && styles.statusBadgeTextArrived,
                            activeRide.status === 'in_progress' && styles.statusBadgeTextInProgress,
                          ]}>
                            {getRideStatusText(activeRide.status)}
                          </Text>
                        </View>
                      </View>
                      
                      <View style={styles.driverRatingContainer}>
                        <Ionicons name="star" size={16} color="#FFD700" />
                        <Text style={styles.driverRatingText}>
                          {activeRide.driver.rating ? activeRide.driver.rating.toFixed(1) : '0.0'}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Vehicle Details Section */}
                  <View style={styles.vehicleDetailsSection}>
                    <View style={styles.vehicleDetailItem}>
                      <View style={styles.vehicleDetailIconBox}>
                        <Ionicons name="car-sport-outline" size={22} color="#6B7280" />
                      </View>
                      <View style={styles.vehicleDetailContent}>
                        <Text style={styles.vehicleDetailLabel}>Vehículo</Text>
                        <Text style={styles.vehicleDetailValue}>
                          {activeRide.driver.vehicleInfo?.model || 
                           activeRide.driver.vehicleModel || 
                           'No disponible'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.vehicleDetailItem}>
                      <View style={styles.vehicleDetailIconBox}>
                        <Ionicons name="color-palette-outline" size={22} color="#6B7280" />
                      </View>
                      <View style={styles.vehicleDetailContent}>
                        <Text style={styles.vehicleDetailLabel}>Color</Text>
                        <Text style={styles.vehicleDetailValue}>
                          {activeRide.driver.vehicleInfo?.color || 
                           activeRide.driver.vehicleColor || 
                           'No especificado'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.vehicleDetailItem}>
                      <View style={styles.vehicleDetailIconBox}>
                        <Ionicons name="document-text-outline" size={22} color="#6B7280" />
                      </View>
                      <View style={styles.vehicleDetailContent}>
                        <Text style={styles.vehicleDetailLabel}>Placa</Text>
                        <Text style={styles.vehiclePlateText}>
                          {activeRide.driver.vehicleInfo?.licensePlate || 
                           activeRide.driver.licensePlate || 
                           'N/A'}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* ETA Section */}
                  {activeRide.eta && (
                    <View style={styles.etaSection}>
                      <View style={styles.etaIconBox}>
                        <Ionicons name="time-outline" size={24} color="#22c55e" />
                      </View>
                      <View style={styles.etaContent}>
                        <Text style={styles.etaLabelText}>
                          {activeRide.status === 'accepted'
                            ? 'Llegada estimada'
                            : activeRide.status === 'in_progress'
                            ? 'Tiempo al destino'
                            : 'Tiempo estimado'}
                        </Text>
                        <Text style={styles.etaValueText}>
                          {Math.round(activeRide.eta.estimatedMinutes)} min · {activeRide.eta.distanceKm.toFixed(1)} km
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* Action Buttons Section */}
                  <View style={styles.actionButtonsSection}>
                    {/* Call button - disabled when ride is in progress (passenger is already in the taxi) */}
                    <TouchableOpacity
                      style={[
                        styles.callButton,
                        activeRide.status === 'in_progress' && styles.callButtonDisabled
                      ]}
                      onPress={handleContactDriver}
                      disabled={activeRide.status === 'in_progress'}
                    >
                      <Ionicons 
                        name="call-outline" 
                        size={20} 
                        color={activeRide.status === 'in_progress' ? '#9CA3AF' : '#fff'} 
                      />
                      <Text style={[
                        styles.callButtonText,
                        activeRide.status === 'in_progress' && styles.callButtonTextDisabled
                      ]}>
                        {activeRide.status === 'in_progress' ? 'En el taxi' : 'Llamar'}
                      </Text>
                    </TouchableOpacity>

                    {(activeRide.status === 'pending' ||
                      activeRide.status === 'accepted' ||
                      activeRide.status === 'arrived') && (
                      <TouchableOpacity
                        style={styles.cancelButton}
                        onPress={handleCancelRidePress}
                      >
                        <Ionicons name="close-circle-outline" size={20} color="#EF4444" />
                        <Text style={styles.cancelButtonText}>Cancelar</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              )}

              {/* Request Ride Form - Only show when no active ride */}
              {!activeRide && (
                <>
                  {/* Section Title */}
                  <Text style={styles.sectionTitle}>Selecciona tu tipo de vehículo</Text>

                  {/* Vehicle Type Selector - Compact Design */}
                  <View style={styles.vehicleSelector}>
                    <TouchableOpacity
                      style={[
                        styles.vehicleButton,
                        vehicleType === 'taxi' && styles.vehicleButtonActive,
                      ]}
                      onPress={() => setVehicleType('taxi')}
                    >
                      <Ionicons
                        name="car"
                        size={24}
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
                    >
                      <Ionicons
                        name="bicycle"
                        size={24}
                        color={vehicleType === 'moto_taxi' ? '#fff' : '#6B7280'}
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

                  {/* Moto Quantity Selector - Only show when moto_taxi is selected */}
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
                        >
                          <Ionicons
                            name="bicycle"
                            size={20}
                            color={motoQuantity === 1 ? '#fff' : '#6B7280'}
                          />
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
                        >
                          <View style={styles.motoQuantityIconRow}>
                            <Ionicons
                              name="bicycle"
                              size={18}
                              color={motoQuantity === 2 ? '#fff' : '#6B7280'}
                            />
                            <Ionicons
                              name="bicycle"
                              size={18}
                              color={motoQuantity === 2 ? '#fff' : '#6B7280'}
                              style={{ marginLeft: -4 }}
                            />
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

                  {/* Pickup Location - Now editable */}
                  <Text style={styles.sectionTitle}>Punto de recogida</Text>
                  <View style={styles.locationInputContainer}>
                    <TouchableOpacity onPress={handleUseCurrentLocation}>
                      <Ionicons name="location" size={20} color="#22c55e" />
                    </TouchableOpacity>
                    {isEditingPickup ? (
                      <TextInput
                        style={styles.locationInput}
                        value={pickupAddress}
                        onChangeText={setPickupAddress}
                        onSubmitEditing={handleSearchPickup}
                        onBlur={() => {
                          if (!pickupAddress.trim()) {
                            setIsEditingPickup(false);
                          }
                        }}
                        placeholder="Escribe la dirección de recogida"
                        placeholderTextColor="#A9A9A9"
                        autoFocus
                        returnKeyType="search"
                      />
                    ) : (
                      <TouchableOpacity
                        style={styles.locationTextContainer}
                        onPress={() => setIsEditingPickup(true)}
                      >
                        <Text style={styles.locationText} numberOfLines={1}>
                          {pickupAddress || 'Ubicación actual'}
                        </Text>
                      </TouchableOpacity>
                    )}
                    {isEditingPickup ? (
                      <TouchableOpacity
                        style={styles.locationIconButton}
                        onPress={handleSearchPickup}
                      >
                        <Ionicons name="search" size={18} color="#22c55e" />
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={styles.locationIconButton}
                        onPress={() => setIsEditingPickup(true)}
                      >
                        <Ionicons name="pencil" size={16} color="#22c55e" />
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={styles.mapSelectionButton}
                      onPress={() => handleEnableMapSelection('pickup')}
                    >
                      <Ionicons name="map" size={18} color="#22c55e" />
                    </TouchableOpacity>
                  </View>

                  {/* Destination Search */}
                  <Text style={styles.sectionTitle}>¿A dónde vas?</Text>
                  <View style={styles.destinationInputContainer}>
                    <Ionicons name="location-outline" size={20} color="#22c55e" />
                    <TextInput
                      style={styles.destinationInput}
                      placeholder="¿A dónde vas?"
                      placeholderTextColor="#A9A9A9"
                      value={destinationAddress}
                      onChangeText={setDestinationAddress}
                      onSubmitEditing={handleSearchDestination}
                      returnKeyType="search"
                    />
                    <TouchableOpacity
                      style={styles.searchIconButton}
                      onPress={handleSearchDestination}
                    >
                      <Ionicons name="search" size={18} color="#22c55e" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.mapSelectionButton}
                      onPress={() => handleEnableMapSelection('destination')}
                    >
                      <Ionicons name="map" size={18} color="#22c55e" />
                    </TouchableOpacity>
                  </View>

                  {/* Fare Estimate */}
                  {estimatedFare !== null && fareBreakdown && (
                    <View style={styles.fareContainer}>
                      <View style={styles.fareHeader}>
                        <Text style={styles.fareLabel}>Tarifa estimada:</Text>
                        <Text style={styles.fareAmount}>{formatCurrency(estimatedFare, fareCurrency)}</Text>
                      </View>

                      {/* Fare Breakdown */}
                      <View style={styles.fareBreakdown}>
                        <View style={styles.fareBreakdownRow}>
                          <Text style={styles.fareBreakdownLabel}>Tarifa base:</Text>
                          <Text style={styles.fareBreakdownValue}>
                            {formatCurrency(fareBreakdown.baseFare, fareCurrency)}
                          </Text>
                        </View>
                        <View style={styles.fareBreakdownRow}>
                          <Text style={styles.fareBreakdownLabel}>
                            Por km ({formatCurrency(fareBreakdown.perKmRate, fareCurrency, false)}/km × {fareBreakdown.distance.toFixed(2)} km):
                          </Text>
                          <Text style={styles.fareBreakdownValue}>
                            {formatCurrency(fareBreakdown.perKmRate * fareBreakdown.distance, fareCurrency)}
                          </Text>
                        </View>
                        <View style={styles.fareBreakdownRow}>
                          <Text style={styles.fareBreakdownLabel}>
                            Por minuto ({formatCurrency(fareBreakdown.perMinuteRate, fareCurrency, false)}/min × {fareBreakdown.duration.toFixed(0)} min):
                          </Text>
                          <Text style={styles.fareBreakdownValue}>
                            {formatCurrency(fareBreakdown.perMinuteRate * fareBreakdown.duration, fareCurrency)}
                          </Text>
                        </View>
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
          animationType="none"
          onRequestClose={handleCloseCancelModal}
        >
          <Animated.View 
            style={[
              styles.modalOverlay,
              {
                opacity: modalOpacity,
                paddingTop: Math.max(insets.top, 20),
                paddingBottom: Math.max(insets.bottom, 20),
              }
            ]}
          >
            <Animated.View 
              style={[
                styles.cancelModalContent,
                {
                  transform: [
                    { scale: modalScale },
                    { translateY: modalTranslateY }
                  ],
                }
              ]}
            >
              {/* Header with Icon */}
              <View style={styles.cancelModalHeader}>
                <View style={styles.cancelIconContainer}>
                  <Ionicons name="close-circle" size={56} color="#EF4444" />
                </View>
                <Text style={styles.cancelModalTitle}>¿Cancelar Viaje?</Text>
                <Text style={styles.cancelModalSubtitle}>
                  {cancellationPolicy?.warnings[0] || 'Esta acción no se puede deshacer'}
                </Text>
              </View>

              {/* Cancellation Fee Warning */}
              {cancellationPolicy && cancellationPolicy.fee > 0 && (
                <View style={styles.cancelWarningCard}>
                  <View style={styles.cancelWarningHeader}>
                    <Ionicons name="alert-circle" size={24} color="#ea580c" />
                    <Text style={styles.cancelWarningTitle}>
                      {cancellationPolicy.type === 'penalty'
                        ? 'Penalización por Cancelación'
                        : 'Tarifa de Cancelación'}
                    </Text>
                  </View>
                  <Text style={styles.cancelWarningText}>
                    {cancellationPolicy.type === 'penalty'
                      ? `Se cobrará ${formatCurrency(cancellationPolicy.fee * 2, fareCurrency)}. ` +
                        `Recibirás un reembolso de ${formatCurrency(cancellationPolicy.refundAmount!, fareCurrency)} en 24 horas.`
                      : `Se cobrará una tarifa de ${formatCurrency(cancellationPolicy.fee, fareCurrency)}`}
                  </Text>
                </View>
              )}

              {/* Cancellation Policy */}
              <View style={styles.cancelPolicyCard}>
                <Text style={styles.cancelPolicyTitle}>Política de Cancelación</Text>
                <View style={styles.cancelPolicyItem}>
                  <Ionicons
                    name="checkmark-circle"
                    size={20}
                    color={cancellationPolicy?.type === 'free' ? '#22c55e' : '#9ca3af'}
                  />
                  <Text style={styles.cancelPolicyText}>
                    Gratis en los primeros 2 minutos
                    {cancellationPolicy?.gracePeriodRemaining &&
                      cancellationPolicy.gracePeriodRemaining > 0 &&
                      ` (${cancellationPolicy.gracePeriodRemaining}s restantes)`}
                  </Text>
                </View>
                <View style={styles.cancelPolicyItem}>
                  <Ionicons
                    name="information-circle"
                    size={20}
                    color={cancellationPolicy?.type === 'standard' ? '#ea580c' : '#9ca3af'}
                  />
                  <Text style={styles.cancelPolicyText}>
                    {formatCurrency(5, fareCurrency)} si el conductor aceptó
                  </Text>
                </View>
                <View style={styles.cancelPolicyItem}>
                  <Ionicons
                    name="warning"
                    size={20}
                    color={cancellationPolicy?.type === 'penalty' ? '#EF4444' : '#9ca3af'}
                  />
                  <Text style={styles.cancelPolicyText}>
                    50% del viaje si el conductor llegó (reembolso en 24h)
                  </Text>
                </View>
              </View>

              {/* Action Buttons */}
              <View style={[styles.cancelModalButtons, { paddingBottom: Math.max(insets.bottom, 16) }]}>
                <TouchableOpacity
                  style={styles.cancelKeepButton}
                  onPress={handleCloseCancelModal}
                  disabled={isCancelling}
                  activeOpacity={0.7}
                >
                  <Text style={styles.cancelKeepButtonText}>Mantener Viaje</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.cancelConfirmButton, isCancelling && styles.cancelButtonDisabled]}
                  onPress={handleConfirmCancellation}
                  disabled={isCancelling}
                  activeOpacity={0.8}
                >
                  {isCancelling ? (
                    <View style={styles.loadingContainer}>
                      <ActivityIndicator color="#fff" size="small" />
                      <Text style={[styles.cancelConfirmButtonText, { marginLeft: 8 }]}>
                        Cancelando...
                      </Text>
                    </View>
                  ) : (
                    <>
                      <Ionicons name="close-circle-outline" size={20} color="#fff" />
                      <Text style={styles.cancelConfirmButtonText}>Cancelar Viaje</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </Animated.View>
          </Animated.View>
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
                        <Text style={styles.breakdownLabel}>Tarifa base:</Text>
                        <Text style={styles.breakdownValue}>
                          {formatCurrency(fareBreakdown.baseFare, fareCurrency)}
                        </Text>
                      </View>
                      <View style={styles.breakdownRow}>
                        <Text style={styles.breakdownLabel}>
                          Por km ({fareBreakdown.distance.toFixed(2)} km):
                        </Text>
                        <Text style={styles.breakdownValue}>
                          {formatCurrency(fareBreakdown.perKmRate * fareBreakdown.distance, fareCurrency)}
                        </Text>
                      </View>
                      <View style={styles.breakdownRow}>
                        <Text style={styles.breakdownLabel}>
                          Por minuto ({fareBreakdown.duration.toFixed(0)} min):
                        </Text>
                        <Text style={styles.breakdownValue}>
                          {formatCurrency(fareBreakdown.perMinuteRate * fareBreakdown.duration, fareCurrency)}
                        </Text>
                      </View>
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
                        onPress={() => setPaymentMethod('cash')}
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

                      {/* Card Option */}
                      <TouchableOpacity
                        style={[
                          styles.paymentMethodOption,
                          paymentMethod === 'card' && styles.paymentMethodOptionSelected,
                        ]}
                        onPress={() => setPaymentMethod('card')}
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
                        onPress={() => setPaymentMethod('digital_wallet')}
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
                          {paymentMethod === 'cash' ? 'Confirmar Pago' : 'Procesar Pago'}
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
          rideId={activeRide?.id || ''}
          onPaymentComplete={handleMobilePaymentComplete}
          onCancel={handleMobilePaymentCancel}
        />

        {/* Contact Driver Modal */}
        <Modal
          visible={showContactModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowContactModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.contactModalContent}>
              <Text style={styles.contactModalTitle}>Contactar conductor</Text>
              <Text style={styles.contactModalSubtitle}>
                ¿Cómo deseas contactar a {activeRide?.driver?.name || 'el conductor'}?
              </Text>

              <View style={styles.contactOptionsContainer}>
                <TouchableOpacity
                  style={styles.contactOptionButton}
                  onPress={handlePhoneCall}
                >
                  <View style={styles.contactOptionIconContainer}>
                    <Ionicons name="call" size={28} color="#22c55e" />
                  </View>
                  <Text style={styles.contactOptionTitle}>Llamada telefónica</Text>
                  <Text style={styles.contactOptionDescription}>
                    Llamar directamente al número
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.contactOptionButton}
                  onPress={handleWhatsAppCall}
                >
                  <View style={styles.contactOptionIconContainer}>
                    <Ionicons name="logo-whatsapp" size={28} color="#25D366" />
                  </View>
                  <Text style={styles.contactOptionTitle}>WhatsApp</Text>
                  <Text style={styles.contactOptionDescription}>
                    Abrir chat de WhatsApp
                  </Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.contactModalCancelButton}
                onPress={() => setShowContactModal(false)}
              >
                <Text style={styles.contactModalCancelText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
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
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  vehicleButtonActive: {
    backgroundColor: '#22c55e',
    borderColor: '#22c55e',
  },
  vehicleButtonText: {
    fontSize: 15,
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
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
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
  requestButton: {
    height: 50,
    backgroundColor: '#9CA3AF',
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  requestButtonEnabled: {
    backgroundColor: '#22c55e',
    shadowColor: '#22c55e',
    shadowOpacity: 0.3,
  },
  requestButtonDisabled: {
    backgroundColor: '#D1D5DB',
    shadowOpacity: 0,
    elevation: 0,
  },
  requestButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 0.3,
  },
  searchingContainer: {
    marginTop: 16,
    padding: 20,
    backgroundColor: '#F0FFF0',
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#22c55e',
  },
  searchingText: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#22c55e',
  },
  searchingSubtext: {
    marginTop: 4,
    fontSize: 14,
    color: '#505050',
    textAlign: 'center',
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
  // Redesigned Cancel Modal Styles
  cancelModalContent: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 28,
    width: '100%',
    maxWidth: 420,
  },
  cancelModalHeader: {
    alignItems: 'center',
    marginBottom: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  cancelIconContainer: {
    marginBottom: 16,
  },
  cancelModalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  cancelModalSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  cancelWarningCard: {
    backgroundColor: '#fff7ed',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  cancelWarningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  cancelWarningTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ea580c',
  },
  cancelWarningText: {
    fontSize: 14,
    color: '#111827',
    lineHeight: 20,
    fontWeight: '500',
  },
  cancelPolicyCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 18,
    marginBottom: 24,
  },
  cancelPolicyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },
  cancelPolicyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  cancelPolicyText: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
    lineHeight: 20,
    fontWeight: '500',
  },
  cancelModalButtons: {
    gap: 12,
  },
  cancelKeepButton: {
    backgroundColor: '#22c55e',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelKeepButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  cancelConfirmButton: {
    backgroundColor: '#EF4444',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  cancelConfirmButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  cancelButtonDisabled: {
    opacity: 0.5,
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
  // Contact Modal Styles
  contactModalContent: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 28,
    width: '90%',
    maxWidth: 400,
  },
  contactModalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  contactModalSubtitle: {
    fontSize: 15,
    color: '#6b7280',
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 22,
  },
  contactOptionsContainer: {
    gap: 12,
    marginBottom: 20,
  },
  contactOptionButton: {
    backgroundColor: '#f9fafb',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  contactOptionIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  contactOptionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  contactOptionDescription: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  contactModalCancelButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  contactModalCancelText: {
    color: '#6b7280',
    fontSize: 16,
    fontWeight: '600',
  },
});
