import React, { useState, useEffect, useRef } from 'react';
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
} from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
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
  onRideCancelled,
  removeAllListeners,
} from '@/services/socket';
import { logInfo, logError, logWarning } from '@/utils/errorLogger';
import { ErrorBoundary } from '@/components/ErrorBoundary';

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
  const mapRef = useRef<MapView>(null);

  logInfo('PassengerHomeScreen', 'Component mounted', { 
    userId: user?.id, 
    hasToken: !!token,
    platform: Platform.OS 
  });

  // Location states
  const [currentLocation, setCurrentLocation] = useState<LocationCoords | null>(null);
  const [pickupLocation, setPickupLocation] = useState<LocationCoords | null>(null);
  const [destinationLocation, setDestinationLocation] = useState<LocationCoords | null>(null);

  // Address states
  const [destinationAddress, setDestinationAddress] = useState('');
  const [pickupAddress, setPickupAddress] = useState('');

  // UI states
  const [isLoadingLocation, setIsLoadingLocation] = useState(true);
  const [isRequestingRide, setIsRequestingRide] = useState(false);
  const [isSearchingDriver, setIsSearchingDriver] = useState(false);
  const [vehicleType, setVehicleType] = useState<'taxi' | 'moto-taxi'>('taxi');
  const [estimatedFare, setEstimatedFare] = useState<number | null>(null);
  const [fareBreakdown, setFareBreakdown] = useState<{
    baseFare: number;
    perKmRate: number;
    distance: number;
  } | null>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<RouteCoordinates[]>([]);

  // Active ride tracking states
  const [activeRide, setActiveRide] = useState<ActiveRide | null>(null);
  const [driverLocation, setDriverLocation] = useState<LocationCoords | null>(null);
  const [isSocketConnected, setIsSocketConnected] = useState(false);

  // Cancellation modal states
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancellationFeeWarning, setCancellationFeeWarning] = useState<string | null>(null);

  // Payment modal states
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentCompleted, setPaymentCompleted] = useState(false);
  const [finalFare, setFinalFare] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'digital_wallet'>('cash');

  // Rating modal states
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [driverRating, setDriverRating] = useState(0);
  const [driverComment, setDriverComment] = useState('');
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);

  // Request location permissions and get current location
  useEffect(() => {
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

        // Get address for current location
        const addresses = await Location.reverseGeocodeAsync(coords);
        if (addresses.length > 0) {
          const addr = addresses[0];
          const addressStr = `${addr.street || ''} ${addr.name || ''}, ${addr.city || ''}`;
          setPickupAddress(addressStr);
          logInfo('PassengerHomeScreen', 'Address resolved', { address: addressStr });
        }

        setIsLoadingLocation(false);
        logInfo('PassengerHomeScreen', 'Location setup complete');
      } catch (error) {
        logError('PassengerHomeScreen', error, { context: 'Getting location' });
        Alert.alert('Error', 'No se pudo obtener la ubicación actual');
        setIsLoadingLocation(false);
      }
    })();
  }, []);

  // Calculate route and fare when destination changes
  useEffect(() => {
    if (pickupLocation && destinationLocation) {
      calculateRoute();
      calculateFare();
    }
  }, [pickupLocation, destinationLocation]);

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

    // Join ride room
    joinRide(activeRide.id);

    // Listen for ride accepted event
    const handleRideAccepted = (data: any) => {
      console.log('🚗 Ride accepted:', data);
      
      setActiveRide((prev) => ({
        ...prev!,
        status: 'accepted',
        driver: data.driver,
      }));

      setIsSearchingDriver(false);

      // Update driver location on map
      if (data.driver.currentLocation) {
        setDriverLocation(data.driver.currentLocation);
      }

      Alert.alert(
        '¡Conductor Asignado!',
        `${data.driver.name} ha aceptado tu viaje.\n\nVehículo: ${data.driver.vehicleInfo.model}\nPlaca: ${data.driver.vehicleInfo.licensePlate}\nRating: ${data.driver.rating.toFixed(1)} ⭐`,
        [{ text: 'OK' }]
      );
    };

    // Listen for ride status changes
    const handleRideStatusChanged = (data: any) => {
      console.log('📍 Ride status changed:', data);
      
      setActiveRide((prev) => ({
        ...prev!,
        status: data.status,
      }));

      // Show alerts for important status changes
      if (data.status === 'arrived') {
        Alert.alert(
          'Conductor ha Llegado',
          'Tu conductor ha llegado al punto de recogida.',
          [{ text: 'OK' }]
        );
      } else if (data.status === 'in_progress') {
        Alert.alert(
          'Viaje Iniciado',
          'Tu viaje ha comenzado. ¡Disfruta el trayecto!',
          [{ text: 'OK' }]
        );
      } else if (data.status === 'completed') {
        // Store final fare from the ride data
        if (data.finalFare) {
          setFinalFare(data.finalFare);
        }
        
        // Show payment modal instead of alert
        setShowPaymentModal(true);
      }
    };

    // Listen for driver location updates
    const handleDriverLocationUpdate = (data: any) => {
      console.log('📍 Driver location update:', data);
      
      setDriverLocation({
        latitude: data.latitude,
        longitude: data.longitude,
      });
    };

    // Listen for ETA updates
    const handleETAUpdate = (data: any) => {
      console.log('⏱️ ETA update:', data);
      
      setActiveRide((prev) => ({
        ...prev!,
        eta: {
          estimatedMinutes: data.eta.estimatedMinutes,
          distanceKm: data.eta.distanceKm,
        },
      }));
    };

    // Listen for ride cancelled event
    const handleRideCancelled = (data: any) => {
      console.log('❌ Ride cancelled:', data);
      
      // Show alert based on who cancelled
      if (data.cancelledBy === 'driver') {
        Alert.alert(
          'Viaje Cancelado',
          `El conductor ha cancelado el viaje. Razón: ${data.cancellationReason}\n\nEstamos buscando otro conductor para ti.`,
          [{ text: 'OK' }]
        );
      } else if (data.cancelledBy === 'passenger') {
        // Show cancellation fee if applicable
        const feeMessage = data.cancellationFee > 0 
          ? `\n\nTarifa de cancelación: Bs. ${data.cancellationFee.toFixed(2)}`
          : '';
        
        Alert.alert(
          'Viaje Cancelado',
          `Tu viaje ha sido cancelado.${feeMessage}`,
          [
            {
              text: 'OK',
              onPress: () => {
                // Reset ride state
                setActiveRide(null);
                setDriverLocation(null);
                setIsSearchingDriver(false);
              },
            },
          ]
        );
      }
    };

    // Register event listeners
    onRideAccepted(handleRideAccepted);
    onRideStatusChanged(handleRideStatusChanged);
    onDriverLocationUpdate(handleDriverLocationUpdate);
    onETAUpdate(handleETAUpdate);
    onRideCancelled(handleRideCancelled);

    // Cleanup listeners when ride ends
    return () => {
      if (activeRide) {
        leaveRide(activeRide.id);
      }
    };
  }, [activeRide?.id]);

  const calculateRoute = async () => {
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
  };

  const calculateFare = () => {
    if (!pickupLocation || !destinationLocation) return;

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

    // Simple fare calculation (base + per km)
    const baseFare = vehicleType === 'taxi' ? 5 : 3;
    const perKmRate = vehicleType === 'taxi' ? 2 : 1.5;
    const estimatedTime = distance * 3; // Rough estimate: 3 min per km

    const fare = baseFare + distance * perKmRate;
    setEstimatedFare(Math.round(fare * 100) / 100);
    
    // Store breakdown for display
    setFareBreakdown({
      baseFare,
      perKmRate,
      distance: Math.round(distance * 100) / 100,
    });
  };

  const toRad = (value: number) => (value * Math.PI) / 180;

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
      // Geocode the address
      const results = await Location.geocodeAsync(destinationAddress);
      
      if (results.length === 0) {
        Alert.alert('Error', 'No se encontró la dirección. Intenta con otra.');
        return;
      }

      const location = results[0];
      setDestinationLocation({
        latitude: location.latitude,
        longitude: location.longitude,
      });
    } catch (error) {
      console.error('Geocoding error:', error);
      Alert.alert('Error', 'No se pudo buscar la dirección');
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
      setActiveRide({
        id: response.data.ride.id,
        status: 'pending',
      });

      // Show searching driver state
      setIsRequestingRide(false);
      setIsSearchingDriver(true);

      console.log('✅ Ride requested:', response.data.ride.id);
    } catch (error: any) {
      console.error('Request ride error:', error);
      setIsRequestingRide(false);
      setIsSearchingDriver(false);
      Alert.alert(
        'Error',
        error.response?.data?.error?.message || 'No se pudo solicitar el viaje'
      );
    }
  };

  const handleCancelRidePress = () => {
    if (!activeRide) return;

    // Determine cancellation fee warning based on ride status
    let feeWarning = null;
    
    if (activeRide.status === 'arrived') {
      // Driver has arrived - 50% of estimated fare
      if (estimatedFare) {
        const fee = estimatedFare * 0.5;
        feeWarning = `Se aplicará una tarifa de cancelación de Bs. ${fee.toFixed(2)} (50% de la tarifa estimada) porque el conductor ya llegó al punto de recogida.`;
      }
    } else if (activeRide.status === 'accepted') {
      // Driver accepted but hasn't arrived - standard cancellation fee
      feeWarning = 'Se puede aplicar una tarifa de cancelación porque el conductor ya aceptó tu viaje.';
    }

    setCancellationFeeWarning(feeWarning);
    setShowCancelModal(true);
  };

  const handleConfirmCancellation = async () => {
    if (!activeRide) return;

    setIsCancelling(true);

    try {
      const response = await rideAPI.cancelRide(
        activeRide.id,
        'passenger_cancelled'
      );

      console.log('✅ Ride cancelled:', response.data);

      // Close modal
      setShowCancelModal(false);
      setIsCancelling(false);

      // The ride:cancelled event will handle the rest via WebSocket
    } catch (error: any) {
      console.error('Cancel ride error:', error);
      setIsCancelling(false);
      Alert.alert(
        'Error',
        error.response?.data?.error?.message || 'No se pudo cancelar el viaje'
      );
    }
  };

  const handleCloseCancelModal = () => {
    setShowCancelModal(false);
    setCancellationFeeWarning(null);
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
      setIsProcessingPayment(false);
      
      Alert.alert(
        'Error en el Pago',
        error.response?.data?.error?.message || 'No se pudo procesar el pago. Por favor intenta nuevamente.',
        [
          {
            text: 'Reintentar',
            onPress: handleProcessPayment,
          },
          {
            text: 'Cancelar',
            style: 'cancel',
          },
        ]
      );
    }
  };

  const handleClosePaymentModal = () => {
    setShowPaymentModal(false);
    setPaymentCompleted(false);
    setIsProcessingPayment(false);
    
    // Show rating modal after payment is confirmed
    setShowRatingModal(true);
  };

  const handleSubmitRating = async () => {
    if (!activeRide || driverRating === 0) {
      Alert.alert('Error', 'Por favor selecciona una valoración');
      return;
    }

    setIsSubmittingRating(true);

    try {
      await ratingAPI.rateDriver(
        activeRide.id,
        driverRating,
        driverComment.trim() || undefined
      );

      console.log('✅ Rating submitted successfully');

      // Close rating modal
      setShowRatingModal(false);
      setIsSubmittingRating(false);

      // Show thank you alert
      Alert.alert(
        '¡Gracias!',
        'Tu valoración ha sido enviada exitosamente.',
        [
          {
            text: 'OK',
            onPress: handleCloseRatingModal,
          },
        ]
      );
    } catch (error: any) {
      console.error('Submit rating error:', error);
      setIsSubmittingRating(false);
      Alert.alert(
        'Error',
        error.response?.data?.error?.message || 'No se pudo enviar la valoración'
      );
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
    
    // Reset ride state
    setActiveRide(null);
    setDriverLocation(null);
    setDestinationLocation(null);
    setDestinationAddress('');
    setEstimatedFare(null);
    setFareBreakdown(null);
    setRouteCoordinates([]);
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
        <Text style={styles.errorSubtext}>
          Por favor verifica los permisos de ubicación
        </Text>
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <View style={styles.container}>
        {/* Map */}
        <ErrorBoundary fallback={
          <View style={styles.mapErrorContainer}>
            <Text style={styles.mapErrorText}>❌ Error loading map</Text>
            <Text style={styles.mapErrorSubtext}>Check Metro Bundler console for details</Text>
          </View>
        }>
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
            onMapReady={() => {
              logInfo('PassengerHomeScreen', 'MapView ready');
            }}
            onError={(error) => {
              logError('PassengerHomeScreen', error, { context: 'MapView error' });
            }}
          >
        {/* Pickup Marker */}
        {pickupLocation && !activeRide && (
          <Marker
            coordinate={pickupLocation}
            title="Punto de recogida"
            description={pickupAddress}
            pinColor="#22c55e"
          />
        )}

        {/* Destination Marker */}
        {destinationLocation && (
          <Marker
            coordinate={destinationLocation}
            title="Destino"
            description={destinationAddress}
            pinColor="#FF9500"
          />
        )}

        {/* Driver Marker */}
        {driverLocation && activeRide && (
          <Marker
            coordinate={driverLocation}
            title={activeRide.driver?.name || 'Conductor'}
            description={`${activeRide.driver?.vehicleInfo.model || ''} - ${activeRide.driver?.vehicleInfo.licensePlate || ''}`}
          >
            <View style={styles.driverMarker}>
              <Text style={styles.driverMarkerText}>🚗</Text>
            </View>
          </Marker>
        )}

        {/* Route Polyline */}
        {routeCoordinates.length > 0 && (
          <Polyline
            coordinates={routeCoordinates}
            strokeColor="#22c55e"
            strokeWidth={3}
          />
        )}
      </MapView>
      </ErrorBoundary>

      {/* Search and Request Panel */}
      <View style={styles.panel}>
        {/* Active Ride - Driver Info Card */}
        {activeRide && activeRide.driver && (
          <View style={styles.driverInfoCard}>
            <View style={styles.driverInfoHeader}>
              <View style={styles.driverAvatar}>
                <Text style={styles.driverAvatarText}>
                  {activeRide.driver.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.driverDetails}>
                <Text style={styles.driverName}>{activeRide.driver.name}</Text>
                <Text style={styles.driverRating}>
                  ⭐ {activeRide.driver.rating.toFixed(1)}
                </Text>
              </View>
              <View style={styles.rideStatusBadge}>
                <Text style={styles.rideStatusText}>
                  {getRideStatusText(activeRide.status)}
                </Text>
              </View>
            </View>

            <View style={styles.vehicleInfo}>
              <Text style={styles.vehicleInfoText}>
                🚗 {activeRide.driver.vehicleInfo.model} - {activeRide.driver.vehicleInfo.color}
              </Text>
              <Text style={styles.vehicleInfoText}>
                🔢 {activeRide.driver.vehicleInfo.licensePlate}
              </Text>
            </View>

            {/* ETA Display */}
            {activeRide.eta && (
              <View style={styles.etaContainer}>
                <Text style={styles.etaLabel}>
                  {activeRide.status === 'accepted' ? 'Llegada estimada:' : 'Tiempo estimado:'}
                </Text>
                <Text style={styles.etaValue}>
                  {Math.round(activeRide.eta.estimatedMinutes)} min
                </Text>
                <Text style={styles.etaDistance}>
                  ({activeRide.eta.distanceKm.toFixed(1)} km)
                </Text>
              </View>
            )}

            {/* Contact Driver Button */}
            <TouchableOpacity
              style={styles.contactButton}
              onPress={() => Alert.alert('Contactar', `Llamar a ${activeRide.driver?.name}`)}
            >
              <Text style={styles.contactButtonText}>📞 Contactar Conductor</Text>
            </TouchableOpacity>

            {/* Cancel Ride Button - Only show if ride can be cancelled */}
            {(activeRide.status === 'pending' || 
              activeRide.status === 'accepted' || 
              activeRide.status === 'arrived') && (
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={handleCancelRidePress}
              >
                <Text style={styles.cancelButtonText}>Cancelar Viaje</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Searching Driver State */}
        {isSearchingDriver && !activeRide?.driver && (
          <View style={styles.searchingContainer}>
            <ActivityIndicator size="large" color="#22c55e" />
            <Text style={styles.searchingText}>Buscando conductor...</Text>
            <Text style={styles.searchingSubtext}>
              Estamos notificando a conductores cercanos
            </Text>
          </View>
        )}

        {/* Request Ride Form - Only show when no active ride */}
        {!activeRide && (
          <>
            {/* Destination Search */}
            <View style={styles.searchContainer}>
              <TextInput
                style={styles.searchInput}
                placeholder="¿A dónde vas?"
                placeholderTextColor="#A9A9A9"
                value={destinationAddress}
                onChangeText={setDestinationAddress}
                onSubmitEditing={handleSearchDestination}
                returnKeyType="search"
              />
              <TouchableOpacity
                style={styles.searchButton}
                onPress={handleSearchDestination}
              >
                <Text style={styles.searchButtonText}>Buscar</Text>
              </TouchableOpacity>
            </View>

            {/* Vehicle Type Selector */}
            <View style={styles.vehicleSelector}>
              <TouchableOpacity
                style={[
                  styles.vehicleButton,
                  vehicleType === 'taxi' && styles.vehicleButtonActive,
                ]}
                onPress={() => setVehicleType('taxi')}
              >
                <Text
                  style={[
                    styles.vehicleButtonText,
                    vehicleType === 'taxi' && styles.vehicleButtonTextActive,
                  ]}
                >
                  🚕 Taxi
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.vehicleButton,
                  vehicleType === 'moto-taxi' && styles.vehicleButtonActive,
                ]}
                onPress={() => setVehicleType('moto-taxi')}
              >
                <Text
                  style={[
                    styles.vehicleButtonText,
                    vehicleType === 'moto-taxi' && styles.vehicleButtonTextActive,
                  ]}
                >
                  🏍️ Moto-Taxi
                </Text>
              </TouchableOpacity>
            </View>

            {/* Fare Estimate */}
            {estimatedFare !== null && fareBreakdown && (
              <View style={styles.fareContainer}>
                <View style={styles.fareHeader}>
                  <Text style={styles.fareLabel}>Tarifa estimada:</Text>
                  <Text style={styles.fareAmount}>Bs. {estimatedFare.toFixed(2)}</Text>
                </View>
                
                {/* Fare Breakdown */}
                <View style={styles.fareBreakdown}>
                  <View style={styles.fareBreakdownRow}>
                    <Text style={styles.fareBreakdownLabel}>Tarifa base:</Text>
                    <Text style={styles.fareBreakdownValue}>
                      Bs. {fareBreakdown.baseFare.toFixed(2)}
                    </Text>
                  </View>
                  <View style={styles.fareBreakdownRow}>
                    <Text style={styles.fareBreakdownLabel}>
                      Por km (Bs. {fareBreakdown.perKmRate.toFixed(2)} × {fareBreakdown.distance.toFixed(2)} km):
                    </Text>
                    <Text style={styles.fareBreakdownValue}>
                      Bs. {(fareBreakdown.perKmRate * fareBreakdown.distance).toFixed(2)}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Request Ride Button */}
            <TouchableOpacity
              style={[
                styles.requestButton,
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
      </View>

      {/* Cancellation Confirmation Modal */}
      <Modal
        visible={showCancelModal}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCloseCancelModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>¿Cancelar Viaje?</Text>
            
            <Text style={styles.modalMessage}>
              ¿Estás seguro que deseas cancelar este viaje?
            </Text>

            {/* Cancellation Fee Warning */}
            {cancellationFeeWarning && (
              <View style={styles.warningContainer}>
                <Text style={styles.warningIcon}>⚠️</Text>
                <Text style={styles.warningText}>{cancellationFeeWarning}</Text>
              </View>
            )}

            {/* Cancellation Conditions */}
            <View style={styles.conditionsContainer}>
              <Text style={styles.conditionsTitle}>Condiciones de cancelación:</Text>
              <Text style={styles.conditionItem}>• Cancelaciones dentro de los primeros 2 minutos son gratuitas</Text>
              <Text style={styles.conditionItem}>• Se aplica tarifa si el conductor ya aceptó</Text>
              <Text style={styles.conditionItem}>• Tarifa mayor si el conductor ya llegó (50% del viaje)</Text>
            </View>

            {/* Modal Buttons */}
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalButtonSecondary}
                onPress={handleCloseCancelModal}
                disabled={isCancelling}
              >
                <Text style={styles.modalButtonSecondaryText}>Volver</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButtonPrimary, isCancelling && styles.modalButtonDisabled]}
                onPress={handleConfirmCancellation}
                disabled={isCancelling}
              >
                {isCancelling ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.modalButtonPrimaryText}>Confirmar Cancelación</Text>
                )}
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
                  <Text style={styles.paymentTitle}>Viaje Completado</Text>
                  <Text style={styles.paymentSubtitle}>¡Has llegado a tu destino!</Text>
                </View>

                {/* Final Fare Display */}
                <View style={styles.finalFareContainer}>
                  <Text style={styles.finalFareLabel}>Tarifa Final</Text>
                  <Text style={styles.finalFareAmount}>
                    Bs. {(finalFare || estimatedFare || 0).toFixed(2)}
                  </Text>
                </View>

                {/* Fare Breakdown */}
                {fareBreakdown && (
                  <View style={styles.paymentBreakdown}>
                    <Text style={styles.breakdownTitle}>Desglose de Tarifa</Text>
                    <View style={styles.breakdownRow}>
                      <Text style={styles.breakdownLabel}>Tarifa base:</Text>
                      <Text style={styles.breakdownValue}>
                        Bs. {fareBreakdown.baseFare.toFixed(2)}
                      </Text>
                    </View>
                    <View style={styles.breakdownRow}>
                      <Text style={styles.breakdownLabel}>
                        Por distancia ({fareBreakdown.distance.toFixed(2)} km):
                      </Text>
                      <Text style={styles.breakdownValue}>
                        Bs. {(fareBreakdown.perKmRate * fareBreakdown.distance).toFixed(2)}
                      </Text>
                    </View>
                  </View>
                )}

                {/* Payment Method Display */}
                <View style={styles.paymentMethodContainer}>
                  <Text style={styles.paymentMethodLabel}>Método de Pago</Text>
                  <View style={styles.paymentMethodCard}>
                    <Text style={styles.paymentMethodIcon}>
                      {paymentMethod === 'cash' ? '💵' : paymentMethod === 'card' ? '💳' : '📱'}
                    </Text>
                    <Text style={styles.paymentMethodText}>
                      {paymentMethod === 'cash' 
                        ? 'Efectivo' 
                        : paymentMethod === 'card' 
                        ? 'Tarjeta de Crédito/Débito' 
                        : 'Billetera Digital'}
                    </Text>
                  </View>
                </View>

                {/* Cash Payment Instructions */}
                {paymentMethod === 'cash' && (
                  <View style={styles.cashInstructionsContainer}>
                    <Text style={styles.cashInstructionsIcon}>ℹ️</Text>
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
                    <Text style={styles.processPaymentButtonText}>
                      {paymentMethod === 'cash' ? 'Confirmar Pago' : 'Procesar Pago'}
                    </Text>
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
                      Bs. {(finalFare || estimatedFare || 0).toFixed(2)}
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
                    {activeRide.driver.vehicleInfo.model} - {activeRide.driver.vehicleInfo.licensePlate}
                  </Text>
                </View>
              </View>
            )}

            {/* Star Rating Component */}
            <View style={styles.starRatingContainer}>
              <Text style={styles.starRatingLabel}>Tu valoración</Text>
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <TouchableOpacity
                    key={star}
                    onPress={() => setDriverRating(star)}
                    style={styles.starButton}
                  >
                    <Text style={styles.starIcon}>
                      {star <= driverRating ? '⭐' : '☆'}
                    </Text>
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
              <Text style={styles.commentCounter}>
                {driverComment.length}/500
              </Text>
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
  panel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
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
    gap: 12,
  },
  vehicleButton: {
    flex: 1,
    height: 50,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#E0E0E0',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  vehicleButtonActive: {
    backgroundColor: '#86efac',
    borderColor: '#22c55e',
  },
  vehicleButtonText: {
    fontSize: 16,
    color: '#505050',
    fontWeight: '500',
  },
  vehicleButtonTextActive: {
    color: '#22c55e',
    fontWeight: '700',
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
    height: 56,
    backgroundColor: '#22c55e',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  requestButtonDisabled: {
    backgroundColor: '#A9A9A9',
  },
  requestButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
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
  driverMarker: {
    width: 40,
    height: 40,
    backgroundColor: '#22c55e',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  driverMarkerText: {
    fontSize: 20,
  },
  driverInfoCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#22c55e',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  driverInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  driverAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#22c55e',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  driverAvatarText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  driverDetails: {
    flex: 1,
  },
  driverName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#505050',
    marginBottom: 4,
  },
  driverRating: {
    fontSize: 14,
    color: '#505050',
  },
  rideStatusBadge: {
    backgroundColor: '#86efac',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  rideStatusText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#22c55e',
  },
  vehicleInfo: {
    backgroundColor: '#F5F5F5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  vehicleInfoText: {
    fontSize: 14,
    color: '#505050',
    marginBottom: 4,
  },
  etaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0FFF0',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  etaLabel: {
    fontSize: 14,
    color: '#505050',
    marginRight: 8,
  },
  etaValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#22c55e',
    marginRight: 4,
  },
  etaDistance: {
    fontSize: 12,
    color: '#A9A9A9',
  },
  contactButton: {
    backgroundColor: '#22c55e',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  contactButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    backgroundColor: '#FF9500',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
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
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  paymentTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#22c55e',
    marginBottom: 8,
  },
  paymentSubtitle: {
    fontSize: 16,
    color: '#505050',
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
  cashInstructionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FF9500',
  },
  cashInstructionsIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  cashInstructionsText: {
    flex: 1,
    fontSize: 14,
    color: '#505050',
    lineHeight: 20,
  },
  processPaymentButton: {
    backgroundColor: '#22c55e',
    borderRadius: 24,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  processPaymentButtonDisabled: {
    backgroundColor: '#A9A9A9',
  },
  processPaymentButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
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
});
