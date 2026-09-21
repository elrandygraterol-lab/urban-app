import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Polyline, Region } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import * as Location from 'expo-location';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { Colors } from '@/constants/theme';
import api from '@/services/api';
import { paymentAPI } from '@/services/api/payment';
import { getRoute } from '@/services/mapsService';
import { DriverTaxiIcon, DropoffIcon, PickupIcon } from '@/src/components/map/markers';
import { useDriverStore } from '@/store/driverStore';
import { formatCurrency, Currency } from '@/utils/currency';
import CenterLocationButton from '@/components/CenterLocationButton';
import AddressAutocomplete from '@/components/AddressAutocomplete';
import MobilePaymentModal from '@/components/MobilePaymentModal';
import { useUnifiedNotifications } from '@/context/UnifiedNotificationContext';

export default function ManageRideScreen() {
  const router = useRouter();
  const mapRef = useRef<MapView>(null);
  const { setIsAvailable } = useDriverStore();
  const { showToast } = useUnifiedNotifications();
  const panelAnim = useRef(new Animated.Value(0)).current;

  const [pickup, setPickup] = useState<{
    latitude: number;
    longitude: number;
    address: string;
  } | null>(null);
  const [destination, setDestination] = useState<{
    latitude: number;
    longitude: number;
    address: string;
  } | null>(null);
  const [mapRegion, setMapRegion] = useState<Region | null>(null);
  const [isPanelExpanded, setIsPanelExpanded] = useState(false);

  // Route
  const [routeCoordinates, setRouteCoordinates] = useState<
    { latitude: number; longitude: number }[]
  >([]);
  const [routeDistance, setRouteDistance] = useState<number | null>(null);
  const [routeDuration, setRouteDuration] = useState<number | null>(null);
  const [, setLoadingRoute] = useState(false);

  // Fare estimate
  const [estimatedFare, setEstimatedFare] = useState<number | null>(null);
  const [fareCurrency, setFareCurrency] = useState<Currency>('VES');
  const [exchangeRate, setExchangeRate] = useState<number>(0);
  const [, setLoadingFare] = useState(false);

  // Payment
  const [paymentMode, setPaymentMode] = useState<'cash' | 'pago_movil'>('cash');
  const [beneficiaryName, setBeneficiaryName] = useState('');

  // Submit
  const [submitting, setSubmitting] = useState(false);
  const [destSearchText, setDestSearchText] = useState('');

  // Pago Móvil: reutiliza el formulario de pago principal (verificación contra el banco)
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [platformMethod, setPlatformMethod] = useState<any>(null);

  // Animate panel
  useEffect(() => {
    Animated.spring(panelAnim, {
      toValue: isPanelExpanded ? 1 : 0,
      useNativeDriver: false,
      tension: 50,
      friction: 9,
    }).start();
  }, [isPanelExpanded, panelAnim]);

  // Initialize pickup from GPS + get exchange rate
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      setPickup({ ...coords, address: 'Mi ubicación actual' });
      setMapRegion({ ...coords, latitudeDelta: 0.02, longitudeDelta: 0.02 });

      try {
        const res = await api.post('/api/maps/reverse-geocode', {
          latitude: coords.latitude,
          longitude: coords.longitude,
        });
        const data = res.data?.data;
        if (data?.displayName) {
          setPickup(prev => (prev ? { ...prev, address: data.displayName } : null));
        }
      } catch {
        console.error('[MANAGE_RIDE] Reverse geocode failed on init');
      }

      try {
        const rateRes = await api.get('/api/fares/exchange-rate');
        const bcv = rateRes.data?.data?.bcv || rateRes.data?.bcv;
        if (bcv) setExchangeRate(Number(bcv));
      } catch {
        console.error('[MANAGE_RIDE] Exchange rate fetch failed');
      }

      try {
        const res = await paymentAPI.getPlatformPaymentMethods();
        const methods = res.data?.data || [];
        if (methods?.length > 0) setPlatformMethod(methods[0]);
      } catch {
        console.error('[MANAGE_RIDE] Platform payment methods fetch failed');
      }
    })();
  }, []);

  // Reset ephemeral form state every time the screen gains focus (tab is a persistent navigator)
  useFocusEffect(
    useCallback(() => {
      setDestination(null);
      setRouteCoordinates([]);
      setRouteDistance(null);
      setRouteDuration(null);
      setEstimatedFare(null);
      setPaymentMode('cash');
      setBeneficiaryName('');
      setDestSearchText('');
      setShowPaymentModal(false);
      setIsPanelExpanded(false);
      setLoadingRoute(false);
      setLoadingFare(false);
    }, [])
  );

  // Fetch route + fare when destination changes
  useEffect(() => {
    if (!pickup || !destination) return;

    setLoadingRoute(true);
    setLoadingFare(true);

    getRoute(pickup, destination)
      .then(data => {
        if (data.coordinates?.length > 0) {
          const dest = { latitude: destination.latitude, longitude: destination.longitude };
          setRouteCoordinates([...data.coordinates, dest]);
          setRouteDistance(data.distance);
          setRouteDuration(data.duration);
          if (mapRef.current) {
            mapRef.current.fitToCoordinates([pickup, destination], {
              edgePadding: { top: 80, right: 50, bottom: 350, left: 50 },
              animated: true,
            });
          }
        }
      })
      .catch(() => {
        console.error('[MANAGE_RIDE] Route fetch failed');
      })
      .finally(() => setLoadingRoute(false));

    // Fare estimate using zone fare matrix engine (same as passenger)
    const distKm = haversineDistance(
      pickup.latitude,
      pickup.longitude,
      destination.latitude,
      destination.longitude
    );
    const durationHours = (distKm * 3) / 60;

    api
      .post('/api/fares/estimate', {
        pickupLat: pickup.latitude,
        pickupLng: pickup.longitude,
        destinationLat: destination.latitude,
        destinationLng: destination.longitude,
        distanceKm: distKm,
        durationHours,
      })
      .then(res => {
        const data = res.data?.data || res.data;
        if (data?.totalPrice) {
          setEstimatedFare(Number(data.totalPrice));
          setFareCurrency((data.currency || 'VES') as Currency);
        }
      })
      .catch(() => {
        console.error('[MANAGE_RIDE] Fare estimate failed');
      })
      .finally(() => setLoadingFare(false));
  }, [destination, pickup]);

  const handleMapPress = (e: any) => {
    const coord = e.nativeEvent.coordinate;
    if (!coord) return;

    setDestination({
      latitude: coord.latitude,
      longitude: coord.longitude,
      address: `${coord.latitude.toFixed(5)}, ${coord.longitude.toFixed(5)}`,
    });

    api
      .post('/api/maps/reverse-geocode', {
        latitude: coord.latitude,
        longitude: coord.longitude,
      })
      .then(res => {
        const data = res.data?.data;
        if (data?.displayName) {
          setDestination(prev => (prev ? { ...prev, address: data.displayName } : null));
        }
      })
      .catch(() => {
        console.error('[MANAGE_RIDE] Reverse geocode on map press failed');
      });
  };

  const createManualRide = async (paymentData: {
    method: 'mobile_payment' | 'cash';
    referencia?: string;
    banco?: string;
    telefonoP?: string;
    identificacion?: string;
  }) => {
    if (!pickup || !destination) return;
    setSubmitting(true);
    try {
      const isPagoMovil = paymentData.method === 'mobile_payment';

      const body: any = {
        vehicleType: 'taxi',
        pickupLatitude: pickup.latitude,
        pickupLongitude: pickup.longitude,
        pickupAddress: pickup.address,
        destinationLatitude: destination.latitude,
        destinationLongitude: destination.longitude,
        destinationAddress: destination.address,
        paymentMode: isPagoMovil ? 'pago_movil' : 'cash',
      };
      if (isPagoMovil) {
        let vesAmount = estimatedFare || 0;
        if (fareCurrency === 'USD' && exchangeRate > 0) {
          vesAmount = estimatedFare! * exchangeRate;
        }
        body.pagoMovilRef = paymentData.referencia;
        body.pagoMovilPhone = paymentData.telefonoP;
        body.pagoMovilBank = paymentData.banco;
        body.pagoMovilCedula = paymentData.identificacion;
        body.pagoMovilAmount = Math.round(vesAmount * 100) / 100;
      }
      if (beneficiaryName.trim()) {
        body.beneficiaryName = beneficiaryName.trim();
      }

      const res = await api.post('/api/rides/manual', body);
      const rideData = res.data?.data;
      if (rideData?.rideId) {
        setIsAvailable(false);
        setDestSearchText('');
        setDestination(null);
        setRouteCoordinates([]);
        setEstimatedFare(null);
        setBeneficiaryName('');
        setPaymentMode('cash');
        router.push(`/(driver)/active-ride?rideId=${rideData.rideId}&source=manual` as any);
      }
    } catch (err: any) {
      setIsAvailable(true);
      const msg = err?.response?.data?.message || err?.message || 'Error al crear el viaje';
      showToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    if (!pickup || !destination) return;

    if (paymentMode === 'pago_movil') {
      if (!estimatedFare || estimatedFare <= 0) {
        showToast('No se pudo calcular la tarifa. Verifica que el destino sea válido.', 'error');
        return;
      }
      setShowPaymentModal(true);
      return;
    }

    await createManualRide({ method: 'cash' });
  };

  const canSubmit = !!pickup && !!destination && !submitting;

  // Recenter map on driver's pickup location
  const handleRecenter = () => {
    if (pickup && mapRef.current) {
      mapRef.current.animateToRegion(
        {
          ...pickup,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        },
        500
      );
    }
  };

  const hasDual = exchangeRate > 0 && estimatedFare != null;
  const secondaryFare = hasDual
    ? fareCurrency === 'USD'
      ? estimatedFare! * exchangeRate
      : estimatedFare! / exchangeRate
    : null;
  const secondaryCurrency: Currency = fareCurrency === 'USD' ? 'VES' : 'USD';

  const vesPaymentAmount =
    estimatedFare != null
      ? fareCurrency === 'USD' && exchangeRate > 0
        ? Math.round(estimatedFare * exchangeRate * 100) / 100
        : Number(estimatedFare)
      : 0;

  const panelMaxHeight = panelAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [140, 420],
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#111" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Gestionar Viaje</Text>
          <View style={{ width: 36 }} />
        </View>

        {/* Map */}
        <View style={styles.mapContainer}>
          {mapRegion && (
            <MapView
              ref={mapRef}
              style={styles.map}
              initialRegion={mapRegion}
              onPress={handleMapPress}
              onPoiClick={(e: any) => handleMapPress(e)}
              showsUserLocation={false}
              showsMyLocationButton={false}
              showsPointsOfInterest={true}
              scrollEnabled={true}
              zoomEnabled={true}
              rotateEnabled={true}
              pitchEnabled={true}
              toolbarEnabled={false}
              moveOnMarkerPress={false}
            >
              {pickup && (
                <Marker
                  coordinate={pickup}
                  title="Mi ubicación"
                  anchor={{ x: 0.5, y: 0.5 }}
                  flat={false}
                  rotation={0}
                >
                  <DriverTaxiIcon />
                </Marker>
              )}
              {destination && (
                <Marker coordinate={destination} title="Destino" anchor={{ x: 0.5, y: 0.5 }}>
                  <DropoffIcon />
                </Marker>
              )}
              {routeCoordinates.length > 0 && (
                <Polyline
                  coordinates={routeCoordinates}
                  strokeColor="#FF8C00"
                  strokeWidth={4}
                  lineCap="round"
                />
              )}
            </MapView>
          )}

          {/* Recenter Button */}
          <CenterLocationButton onPress={handleRecenter} disabled={!pickup} />

          {/* Route info + Map hint */}
          {routeDistance != null && (
            <View style={styles.routeInfoOverlay}>
              <Ionicons name="navigate-outline" size={16} color="#fff" />
              <Text style={styles.routeInfoText}>
                {routeDistance.toFixed(1)} km · ~{Math.round(routeDuration || 0)} min
              </Text>
            </View>
          )}

          {!destination && (
            <View style={styles.mapHint}>
              <Ionicons name="hand-left-outline" size={14} color="#fff" />
              <Text style={styles.mapHintText}>Toca el mapa para marcar el destino</Text>
            </View>
          )}
        </View>

        {/* Collapsible Bottom Panel */}
        <Animated.View style={[styles.panel, { maxHeight: panelMaxHeight }]}>
          {/* Handle bar + collapsed summary */}
          <TouchableOpacity
            style={styles.panelHandle}
            onPress={() => setIsPanelExpanded(!isPanelExpanded)}
            activeOpacity={0.7}
          >
            <View style={styles.handleBar} />
            <View style={styles.panelHandleRow}>
              <View style={styles.panelHandleLeft}>
                {destination ? (
                  <>
                    <Ionicons name="flag" size={14} color="#ef4444" />
                    <Text style={styles.panelHandleAddress} numberOfLines={1}>
                      {destination.address}
                    </Text>
                  </>
                ) : (
                  <Text style={styles.panelHandlePlaceholder}>
                    Selecciona un destino en el mapa
                  </Text>
                )}
              </View>
              <View style={styles.panelHandleRight}>
                <Ionicons
                  name={isPanelExpanded ? 'chevron-down' : 'chevron-up'}
                  size={22}
                  color="#9ca3af"
                />
              </View>
            </View>
          </TouchableOpacity>

          {/* Expanded content */}
          {isPanelExpanded && (
            <KeyboardAwareScrollView
              enableOnAndroid={true}
              enableAutomaticScroll={true}
              extraScrollHeight={120}
              keyboardShouldPersistTaps="always"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.panelContent}
              style={styles.panelScroll}
              keyboardOpeningTime={0}
            >
              {/* Destination search */}
              <Text style={styles.sectionLabel}>Buscar destino</Text>
              <AddressAutocomplete
                value={destSearchText}
                onChangeText={setDestSearchText}
                onSelectPlace={place => {
                  setDestination({
                    latitude: place.latitude,
                    longitude: place.longitude,
                    address: place.description || place.name,
                  });
                  setDestSearchText(place.name);
                }}
                placeholder="Buscar dirección..."
                currentLocation={pickup ?? undefined}
                bare
              />

              {/* Fare detail (shown only when route is calculated) */}
              {estimatedFare != null && (
                <View style={styles.fareCard}>
                  <View style={styles.fareCardRow}>
                    <View style={styles.fareCardItem}>
                      <Text style={styles.fareCardLabel}>Tarifa estimada</Text>
                      <Text style={styles.fareCardValue}>
                        {formatCurrency(estimatedFare, fareCurrency)}
                      </Text>
                    </View>
                    {hasDual && secondaryFare != null && (
                      <View style={styles.fareCardItem}>
                        <Text style={styles.fareCardLabel}>Equivalente</Text>
                        <Text style={[styles.fareCardValue, { color: '#6b7280' }]}>
                          {formatCurrency(secondaryFare, secondaryCurrency)}
                        </Text>
                      </View>
                    )}
                  </View>
                  {routeDistance != null && (
                    <Text style={styles.fareCardDetail}>
                      {routeDistance.toFixed(1)} km · ~{Math.round(routeDuration || 0)} min
                    </Text>
                  )}
                </View>
              )}

              {/* Payment method */}
              <Text style={[styles.sectionLabel, { marginTop: 16 }]}>Método de pago</Text>
              <View style={styles.paymentRow}>
                <TouchableOpacity
                  style={[
                    styles.paymentOption,
                    paymentMode === 'cash' && styles.paymentOptionActive,
                  ]}
                  onPress={() => setPaymentMode('cash')}
                >
                  <Ionicons
                    name="cash-outline"
                    size={20}
                    color={paymentMode === 'cash' ? '#fff' : Colors.primary}
                  />
                  <Text
                    style={[
                      styles.paymentOptionText,
                      paymentMode === 'cash' && styles.paymentOptionTextActive,
                    ]}
                  >
                    Efectivo
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.paymentOption,
                    paymentMode === 'pago_movil' && styles.paymentOptionActive,
                  ]}
                  onPress={() => setPaymentMode('pago_movil')}
                >
                  <Ionicons
                    name="phone-portrait-outline"
                    size={20}
                    color={paymentMode === 'pago_movil' ? '#fff' : Colors.primary}
                  />
                  <Text
                    style={[
                      styles.paymentOptionText,
                      paymentMode === 'pago_movil' && styles.paymentOptionTextActive,
                    ]}
                  >
                    Pago Móvil
                  </Text>
                </TouchableOpacity>
              </View>

              {paymentMode === 'pago_movil' && (
                <View style={styles.pagoMovilFields}>
                  {estimatedFare != null && (
                    <View style={styles.vesAmountInfo}>
                      <Ionicons name="card-outline" size={16} color="#92400e" />
                      <Text style={styles.vesAmountText}>
                        {`Monto a pagar: ${formatCurrency(
                          vesPaymentAmount,
                          'VES'
                        )}. El pasajero paga a la cuenta de la plataforma y la operación se valida con el banco al confirmar.`}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              <Text style={[styles.sectionLabel, { marginTop: 16 }]}>Pasajero (opcional)</Text>
              <TextInput
                style={styles.input}
                placeholder="Nombre del pasajero"
                placeholderTextColor="#9ca3af"
                value={beneficiaryName}
                onChangeText={setBeneficiaryName}
              />

              <TouchableOpacity
                style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
                onPress={handleSubmit}
                disabled={!canSubmit}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="car-sport" size={20} color="#fff" />
                    <Text style={styles.submitBtnText}>Iniciar Viaje Manual</Text>
                  </>
                )}
              </TouchableOpacity>
            </KeyboardAwareScrollView>
          )}
        </Animated.View>
      </View>

      {/* Formulario de pago principal reutilizado en el viaje manual */}
      <MobilePaymentModal
        visible={showPaymentModal}
        amount={vesPaymentAmount}
        currency="VES"
        platformMethod={platformMethod}
        onPaymentComplete={paymentData => {
          setShowPaymentModal(false);
          createManualRide(paymentData);
        }}
        onCancel={() => setShowPaymentModal(false)}
      />
    </SafeAreaView>
  );
}

/**
 * Haversine distance between two coordinates in km.
 */
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111' },
  mapContainer: { flex: 1, position: 'relative' },
  map: { flex: 1 },
  routeInfoOverlay: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6,
  },
  routeInfoText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  mapHint: {
    position: 'absolute',
    top: 12,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    gap: 6,
  },
  mapHintText: { color: '#fff', fontSize: 12, fontWeight: '600' },

  // Panel
  panel: {
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
  },
  panelHandle: {
    paddingTop: 10,
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#d1d5db',
    alignSelf: 'center',
    marginBottom: 10,
  },
  panelHandleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  panelHandleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  panelHandleAddress: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111',
    flex: 1,
  },
  panelHandlePlaceholder: {
    fontSize: 14,
    color: '#9ca3af',
  },
  panelHandleRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  panelScroll: {
    maxHeight: 320,
  },
  panelContent: {
    padding: 16,
    paddingTop: 0,
    paddingBottom: 32,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  searchRow: { flexDirection: 'row', gap: 8 },
  searchInput: {
    flex: 1,
    height: 44,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#111',
    backgroundColor: '#f9fafb',
  },
  searchBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Fare card
  fareCard: {
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  fareCardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  fareCardItem: {
    alignItems: 'center',
  },
  fareCardLabel: {
    fontSize: 11,
    color: '#6b7280',
    fontWeight: '600',
    marginBottom: 2,
  },
  fareCardValue: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.primary,
  },
  fareCardDetail: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 8,
  },

  paymentRow: { flexDirection: 'row', gap: 10 },
  paymentOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  paymentOptionActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  paymentOptionText: { fontSize: 14, fontWeight: '600', color: Colors.primary },
  paymentOptionTextActive: { color: '#fff' },
  pagoMovilFields: { marginTop: 12, gap: 10 },
  input: {
    height: 44,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#111',
    backgroundColor: '#f9fafb',
  },
  vesAmountInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fef3c7',
    padding: 10,
    borderRadius: 8,
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  vesAmountText: { fontSize: 12, color: '#92400e', fontWeight: '600', flex: 1 },
  submitBtn: {
    marginTop: 20,
    height: 52,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitBtnDisabled: { backgroundColor: '#d1d5db', shadowOpacity: 0, elevation: 0 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
