/**
 * MapView Component
 * 
 * Componente principal para mostrar mapas con Google Maps SDK
 * Soporta:
 * - Marcadores de pickup/dropoff
 * - Rutas con polilíneas
 * - Actualizaciones de ubicación en tiempo real
 * - Interacciones del mapa (pan, zoom, rotate)
 */

import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { useTranslation } from 'react-i18next';
import logger from '../utils/logger';

interface Location {
  latitude: number;
  longitude: number;
  address?: string;
}

interface MapViewProps {
  pickupLocation?: Location;
  dropoffLocation?: Location;
  driverLocation?: Location;
  routeCoordinates?: Array<[number, number]>;
  onMapReady?: () => void;
  onLocationChange?: (location: Location) => void;
  isOfflineMode?: boolean;
  style?: any;
  zoomLevel?: number;
  showUserLocation?: boolean;
}

export const MapView: React.FC<MapViewProps> = ({
  pickupLocation,
  dropoffLocation,
  driverLocation,
  routeCoordinates,
  onMapReady,
  onLocationChange,
  isOfflineMode = false,
  style,
  zoomLevel = 15,
  showUserLocation = true,
}) => {
  const { t } = useTranslation();
  const mapRef = useRef<MapView>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mapError, setMapError] = useState<string | null>(null);

  // Calcular centro del mapa basado en ubicaciones disponibles
  const getMapCenter = (): [number, number] => {
    if (pickupLocation) {
      return [pickupLocation.longitude, pickupLocation.latitude];
    }
    if (driverLocation) {
      return [driverLocation.longitude, driverLocation.latitude];
    }
    // Centro por defecto (Nueva York)
    return [-74.0060, 40.7128];
  };

  // Calcular bounds para mostrar todas las ubicaciones
  const calculateBounds = () => {
    const locations = [pickupLocation, dropoffLocation, driverLocation].filter(
      (loc) => loc !== undefined
    ) as Location[];

    if (locations.length === 0) return null;

    const lats = locations.map((loc) => loc.latitude);
    const lngs = locations.map((loc) => loc.longitude);

    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: maxLat - minLat + 0.05,
      longitudeDelta: maxLng - minLng + 0.05,
    };
  };

  // Manejar carga del mapa
  const handleMapReady = async () => {
    try {
      setIsLoading(false);
      setMapError(null);

      if (onMapReady) {
        onMapReady();
      }

      logger.info('Mapa cargado exitosamente');
    } catch (error) {
      logger.error('Error cargando mapa', { error });
      setMapError(t('errors.mapLoadFailed'));
    }
  };

  // Manejar errores del mapa
  const handleMapError = (error: any) => {
    logger.error('Error en mapa', { error });
    setMapError(t('errors.mapError'));
  };

  // Actualizar cámara cuando cambian las ubicaciones
  useEffect(() => {
    if (!mapRef.current) return;

    const bounds = calculateBounds();

    try {
      if (bounds) {
        // Mostrar todas las ubicaciones
        mapRef.current.fitToCoordinates(
          [
            { latitude: bounds.latitude - bounds.latitudeDelta / 2, longitude: bounds.longitude - bounds.longitudeDelta / 2 },
            { latitude: bounds.latitude + bounds.latitudeDelta / 2, longitude: bounds.longitude + bounds.longitudeDelta / 2 },
          ],
          {
            edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
            animated: true,
          }
        );
      }
    } catch (error) {
      logger.error('Error actualizando cámara', { error });
    }
  }, [pickupLocation, dropoffLocation, driverLocation, zoomLevel]);

  // Convertir coordenadas para la ruta
  const getRouteCoordinates = () => {
    if (!routeCoordinates || routeCoordinates.length === 0) {
      return [];
    }

    return routeCoordinates.map((coord) => ({
      latitude: coord[1],
      longitude: coord[0],
    }));
  };

  const routeCoords = getRouteCoordinates();

  return (
    <View style={[styles.container, style]}>
      {isLoading && (
        <View style={styles.loadingContainer} testID="loading-indicator">
          <ActivityIndicator size="large" color="#22c55e" />
        </View>
      )}

      {mapError && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{mapError}</Text>
        </View>
      )}

      <MapView
        ref={mapRef}
        style={styles.map}
        testID="map"
        initialRegion={{
          latitude: getMapCenter()[1],
          longitude: getMapCenter()[0],
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        onMapReady={handleMapReady}
        showsUserLocation={showUserLocation}
        onUserLocationChange={(event) => {
          if (onLocationChange && event.nativeEvent.coordinate) {
            onLocationChange({
              latitude: event.nativeEvent.coordinate.latitude,
              longitude: event.nativeEvent.coordinate.longitude,
            });
          }
        }}
      >
        {/* Marcador de pickup */}
        {pickupLocation && (
          <Marker
            coordinate={{
              latitude: pickupLocation.latitude,
              longitude: pickupLocation.longitude,
            }}
            title={t('map.pickup')}
            testID="pickup-marker"
          >
            <View style={styles.markerPickup} />
          </Marker>
        )}

        {/* Marcador de dropoff */}
        {dropoffLocation && (
          <Marker
            coordinate={{
              latitude: dropoffLocation.latitude,
              longitude: dropoffLocation.longitude,
            }}
            title={t('map.dropoff')}
            testID="dropoff-marker"
          >
            <View style={styles.markerDropoff} />
          </Marker>
        )}

        {/* Marcador del conductor */}
        {driverLocation && (
          <Marker
            coordinate={{
              latitude: driverLocation.latitude,
              longitude: driverLocation.longitude,
            }}
            title={t('map.driver')}
            testID="driver-marker"
          >
            <View style={styles.markerDriver} />
          </Marker>
        )}

        {/* Ruta */}
        {routeCoords.length > 0 && (
          <Polyline
            coordinates={routeCoords}
            strokeColor="#22c55e"
            strokeWidth={4}
            testID="route-line"
          />
        )}
      </MapView>

      {/* Indicador de modo offline */}
      {isOfflineMode && (
        <View style={styles.offlineBadge} testID="offline-badge">
          <Text style={styles.offlineBadgeText}>{t('map.offlineMode')}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    zIndex: 10,
  },
  errorContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 0, 0, 0.1)',
    zIndex: 10,
  },
  errorText: {
    color: '#FF0000',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  markerPickup: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#22c55e', // Verde
    borderWidth: 3,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  markerDropoff: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FF9500', // Naranja
    borderWidth: 3,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  markerDriver: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0066CC', // Azul
    borderWidth: 3,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  offlineBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: '#FF9500',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    zIndex: 5,
  },
  offlineBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
});

export default MapView;
