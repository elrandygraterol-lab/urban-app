import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import ClusteredMapView from 'react-native-map-clustering';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { Colors, Typography, BorderRadius, Spacing, Shadows } from '@/constants/theme';
import type { Store } from '@/types/store';

interface StoreMapViewProps {
  stores: Store[];
  loading: boolean;
  onRefresh: () => void;
}

interface StorePreviewCardProps {
  store: Store;
  onPress: () => void;
  onClose: () => void;
}

// Store Preview Card Component
const StorePreviewCard: React.FC<StorePreviewCardProps> = ({ store, onPress, onClose }) => {
  return (
    <View style={styles.previewCard}>
      <TouchableOpacity style={styles.previewCardContent} onPress={onPress} activeOpacity={0.7}>
        {/* Store Logo */}
        {store.logo_url ? (
          <View style={styles.previewLogo}>
            <Text style={styles.previewLogoText}>{store.name.charAt(0).toUpperCase()}</Text>
          </View>
        ) : (
          <View style={styles.previewLogo}>
            <Ionicons name="storefront" size={24} color={Colors.primary} />
          </View>
        )}

        {/* Store Info */}
        <View style={styles.previewInfo}>
          <Text style={styles.previewName} numberOfLines={1}>
            {store.name}
          </Text>
          <Text style={styles.previewCategory} numberOfLines={1}>
            {store.category?.name || 'Sin categoría'}
          </Text>
          {store.distance !== undefined && (
            <View style={styles.previewDistance}>
              <Ionicons name="location" size={14} color={Colors.mediumGray} />
              <Text style={styles.previewDistanceText}>
                {store.distance < 1
                  ? `${Math.round(store.distance * 1000)}m`
                  : `${store.distance.toFixed(1)}km`}
              </Text>
            </View>
          )}
        </View>

        {/* Arrow Icon */}
        <Ionicons name="chevron-forward" size={20} color={Colors.mediumGray} />
      </TouchableOpacity>

      {/* Close Button */}
      <TouchableOpacity
        style={styles.previewCloseButton}
        onPress={onClose}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="close" size={20} color={Colors.darkGray} />
      </TouchableOpacity>
    </View>
  );
};

export const StoreMapView: React.FC<StoreMapViewProps> = ({ stores, loading, onRefresh }) => {
  const router = useRouter();
  const mapRef = useRef<MapView>(null);

  // State
  const [userLocation, setUserLocation] = useState<Location.LocationObject | null>(null);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [locationPermission, setLocationPermission] = useState<boolean>(false);
  const [isLoadingLocation, setIsLoadingLocation] = useState(true);

  // Request location permissions and get current location
  useEffect(() => {
    requestLocationPermission();
  }, []);

  const requestLocationPermission = async () => {
    try {
      setIsLoadingLocation(true);

      // Request foreground permissions
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert(
          'Permiso de ubicación',
          'Se necesita acceso a tu ubicación para mostrar tiendas cercanas en el mapa.',
          [{ text: 'OK' }]
        );
        setLocationPermission(false);
        setIsLoadingLocation(false);
        return;
      }

      setLocationPermission(true);

      // Get current location
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      setUserLocation(location);

      // Center map on user location
      if (mapRef.current && location) {
        mapRef.current.animateToRegion({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        });
      }

      setIsLoadingLocation(false);
    } catch (error) {
      console.error('[StoreMapView] Error getting location:', error);
      setIsLoadingLocation(false);
      Alert.alert(
        'Error',
        'No se pudo obtener tu ubicación. Verifica que los servicios de ubicación estén activados.'
      );
    }
  };

  // Handle marker press
  const handleMarkerPress = useCallback((store: Store) => {
    setSelectedStore(store);
  }, []);

  // Handle preview card press
  const handlePreviewPress = useCallback(() => {
    if (selectedStore) {
      router.push(`/stores/${selectedStore.store_id}` as any);
    }
  }, [selectedStore, router]);

  // Handle close preview
  const handleClosePreview = useCallback(() => {
    setSelectedStore(null);
  }, []);

  // Handle recenter button
  const handleRecenter = useCallback(() => {
    if (userLocation && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: userLocation.coords.latitude,
        longitude: userLocation.coords.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      });
    }
  }, [userLocation]);

  // Filter stores with valid coordinates
  const validStores = stores.filter(store => store.latitude !== null && store.longitude !== null);

  // Calculate initial region
  const getInitialRegion = () => {
    if (userLocation) {
      return {
        latitude: userLocation.coords.latitude,
        longitude: userLocation.coords.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };
    }

    // Default to a general location if no user location
    return {
      latitude: 19.4326, // Mexico City as default
      longitude: -99.1332,
      latitudeDelta: 0.1,
      longitudeDelta: 0.1,
    };
  };

  return (
    <View style={styles.container}>
      {/* Map */}
      <ClusteredMapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={getInitialRegion()}
        showsUserLocation={locationPermission}
        showsMyLocationButton={false}
        showsCompass={true}
        showsScale={true}
        loadingEnabled={true}
        loadingIndicatorColor={Colors.primary}
        clusterColor={Colors.primary}
        clusterTextColor={Colors.white}
        clusterFontFamily={Platform.OS === 'ios' ? 'System' : 'Roboto'}
        radius={50}
        maxZoom={20}
        minZoom={1}
        extent={512}
        nodeSize={64}
        onMarkerPress={event => {
          // Handle marker press - extract store info from marker
          const coordinate = event.nativeEvent.coordinate;
          if (coordinate) {
            // Find the store closest to the tapped coordinate
            const tappedStore = validStores.find(
              s => s.latitude === coordinate.latitude && s.longitude === coordinate.longitude
            );
            if (tappedStore) {
              handleMarkerPress(tappedStore);
            }
          }
        }}
      >
        {/* Store Markers */}
        {validStores.map(store => (
          <Marker
            key={store.store_id}
            coordinate={{
              latitude: store.latitude!,
              longitude: store.longitude!,
            }}
            title={store.name}
            description={store.category?.name}
            identifier={store.store_id.toString()}
            onPress={() => handleMarkerPress(store)}
          >
            <View style={styles.markerShadow}>
              <View style={styles.markerCircle} renderToHardwareTextureAndroid={Platform.OS === 'android'}>
                <Ionicons name="storefront" size={20} color={Colors.white} />
              </View>
            </View>
          </Marker>
        ))}
      </ClusteredMapView>

      {/* Loading Overlay */}
      {(loading || isLoadingLocation) && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>
            {isLoadingLocation ? 'Obteniendo ubicación...' : 'Cargando tiendas...'}
          </Text>
        </View>
      )}

      {/* Recenter Button */}
      {locationPermission && userLocation && (
        <TouchableOpacity
          style={styles.recenterButton}
          onPress={handleRecenter}
          activeOpacity={0.7}
        >
          <Ionicons name="locate" size={24} color={Colors.primary} />
        </TouchableOpacity>
      )}

      {/* Refresh Button */}
      <TouchableOpacity style={styles.refreshButton} onPress={onRefresh} activeOpacity={0.7}>
        <Ionicons name="refresh" size={24} color={Colors.primary} />
      </TouchableOpacity>

      {/* Store Preview Card */}
      {selectedStore && (
        <StorePreviewCard
          store={selectedStore}
          onPress={handlePreviewPress}
          onClose={handleClosePreview}
        />
      )}

      {/* No Stores Message */}
      {!loading && validStores.length === 0 && (
        <View style={styles.noStoresContainer}>
          <View style={styles.noStoresCard}>
            <Ionicons name="map-outline" size={48} color={Colors.mediumGray} />
            <Text style={styles.noStoresText}>No hay tiendas con ubicación disponible</Text>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  markerShadow: {
    alignItems: 'center',
    ...Shadows.md,
  },
  markerCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: Colors.white,
    overflow: 'hidden',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  loadingText: {
    ...Typography.body,
    color: Colors.mediumGray,
  },
  recenterButton: {
    position: 'absolute',
    bottom: 180,
    right: Spacing.lg,
    width: 48,
    height: 48,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.lg,
  },
  refreshButton: {
    position: 'absolute',
    bottom: 120,
    right: Spacing.lg,
    width: 48,
    height: 48,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.lg,
  },
  previewCard: {
    position: 'absolute',
    bottom: Spacing.lg,
    left: Spacing.lg,
    right: Spacing.lg,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    ...Shadows.lg,
  },
  previewCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  previewLogo: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.light,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewLogoText: {
    ...Typography.h2,
    color: Colors.primary,
  },
  previewInfo: {
    flex: 1,
    gap: 4,
  },
  previewName: {
    ...Typography.h3,
    fontSize: 16,
  },
  previewCategory: {
    ...Typography.bodySmall,
    color: Colors.mediumGray,
  },
  previewDistance: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  previewDistanceText: {
    ...Typography.caption,
    color: Colors.mediumGray,
  },
  previewCloseButton: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
  },
  noStoresContainer: {
    position: 'absolute',
    top: '40%',
    left: Spacing.lg,
    right: Spacing.lg,
    alignItems: 'center',
  },
  noStoresCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.md,
    ...Shadows.lg,
  },
  noStoresText: {
    ...Typography.body,
    color: Colors.mediumGray,
    textAlign: 'center',
  },
});
