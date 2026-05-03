/**
 * useMapbox Hook
 *
 * Hook personalizado para utilidades de Mapbox
 * Incluye:
 * - Geocodificación
 * - Búsqueda de lugares
 * - Cálculo de rutas
 * - Gestión de ubicación
 */

import { useState, useCallback } from 'react';
import axios from 'axios';
import logger from '../utils/logger';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';

interface Location {
  latitude: number;
  longitude: number;
  address?: string;
}

interface RouteInfo {
  distance: number; // km
  duration: number; // minutos
  polyline: Array<[number, number]>;
  steps?: any[];
}

interface Place {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  type: string;
  description?: string;
  fullAddress?: string;
  source?: 'custom' | 'nominatim';
}

export const useMapbox = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Geocodificar una dirección
   */
  const geocodeAddress = useCallback(async (address: string): Promise<Location | null> => {
    try {
      setLoading(true);
      setError(null);

      const response = await axios.post(`${API_BASE_URL}/maps/geocode`, {
        address,
      });

      if (response.data.success) {
        return response.data.data;
      }

      throw new Error('Geocodificación fallida');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error geocodificando';
      setError(errorMessage);
      logger.error('Error geocodificando dirección', { address, error: err });
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Reverse geocodificar (coordenadas -> dirección)
   */
  const reverseGeocode = useCallback(
    async (latitude: number, longitude: number): Promise<Location | null> => {
      try {
        setLoading(true);
        setError(null);

        const response = await axios.post(`${API_BASE_URL}/maps/reverse-geocode`, {
          latitude,
          longitude,
        });

        if (response.data.success) {
          return response.data.data;
        }

        throw new Error('Reverse geocodificación fallida');
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Error en reverse geocodificación';
        setError(errorMessage);
        logger.error('Error en reverse geocodificación', { latitude, longitude, error: err });
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  /**
   * Buscar lugares usando el endpoint híbrido del backend.
   * Combina custom places con resultados de Nominatim.
   * Hace fallback al endpoint legacy si el híbrido no está disponible.
   */
  const searchPlaces = useCallback(
    async (query: string, latitude?: number, longitude?: number): Promise<Place[]> => {
      try {
        setLoading(true);
        setError(null);

        // Intentar primero el endpoint híbrido /api/search/places
        try {
          const params = new URLSearchParams({ q: query });
          const hybridResponse = await axios.get(`${API_BASE_URL}/search/places?${params}`, {
            timeout: 10000,
          });

          if (hybridResponse.data && Array.isArray(hybridResponse.data.results)) {
            return hybridResponse.data.results.map((r: any) => ({
              id: r.id,
              name: r.name,
              latitude: r.latitude,
              longitude: r.longitude,
              type: r.category || r.source,
              description: r.displayName !== r.name ? r.displayName : undefined,
              fullAddress: r.displayName,
              source: r.source,
            }));
          }
        } catch (hybridErr) {
          // Fallback al endpoint legacy
          logger.warn('Hybrid search unavailable, falling back to legacy endpoint', { error: hybridErr });
        }

        // Fallback: endpoint legacy /maps/search-places
        const params = new URLSearchParams({
          query,
          ...(latitude && { latitude: latitude.toString() }),
          ...(longitude && { longitude: longitude.toString() }),
        });

        const response = await axios.get(`${API_BASE_URL}/maps/search-places?${params}`);

        if (response.data.success) {
          return response.data.data || [];
        }

        throw new Error('Búsqueda de lugares fallida');
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Error buscando lugares';
        setError(errorMessage);
        logger.error('Error buscando lugares', { query, error: err });
        return [];
      } finally {
        setLoading(false);
      }
    },
    []
  );

  /**
   * Obtener ruta entre dos puntos
   */
  const getRoute = useCallback(
    async (pickupLocation: Location, dropoffLocation: Location): Promise<RouteInfo | null> => {
      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams({
          pickupLat: pickupLocation.latitude.toString(),
          pickupLng: pickupLocation.longitude.toString(),
          dropoffLat: dropoffLocation.latitude.toString(),
          dropoffLng: dropoffLocation.longitude.toString(),
        });

        const response = await axios.get(`${API_BASE_URL}/maps/route?${params}`);

        if (response.data.success) {
          return response.data.data;
        }

        throw new Error('Cálculo de ruta fallido');
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Error calculando ruta';
        setError(errorMessage);
        logger.error('Error calculando ruta', { error: err });
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  /**
   * Obtener estimación de viaje
   */
  const getEstimate = useCallback(
    async (
      pickupLocation: Location,
      dropoffLocation: Location,
      farePerKm: number = 1.5,
      baseFare: number = 2.0
    ) => {
      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams({
          pickupLat: pickupLocation.latitude.toString(),
          pickupLng: pickupLocation.longitude.toString(),
          dropoffLat: dropoffLocation.latitude.toString(),
          dropoffLng: dropoffLocation.longitude.toString(),
          farePerKm: farePerKm.toString(),
          baseFare: baseFare.toString(),
        });

        const response = await axios.get(`${API_BASE_URL}/maps/estimate?${params}`);

        if (response.data.success) {
          return response.data.data;
        }

        throw new Error('Estimación fallida');
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Error obteniendo estimación';
        setError(errorMessage);
        logger.error('Error obteniendo estimación', { error: err });
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  /**
   * Validar ubicación
   */
  const validateLocation = useCallback(
    async (latitude: number, longitude: number): Promise<boolean> => {
      try {
        setLoading(true);
        setError(null);

        const response = await axios.post(`${API_BASE_URL}/maps/validate-location`, {
          latitude,
          longitude,
        });

        if (response.data.success) {
          return response.data.data.isValid;
        }

        return false;
      } catch (err) {
        logger.error('Error validando ubicación', { error: err });
        return false;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  /**
   * Obtener estado de servicios de mapas
   */
  const getServicesStatus = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await axios.get(`${API_BASE_URL}/maps/status`);

      if (response.data.success) {
        return response.data.data;
      }

      throw new Error('Error obteniendo estado');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error obteniendo estado';
      setError(errorMessage);
      logger.error('Error obteniendo estado de servicios', { error: err });
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    geocodeAddress,
    reverseGeocode,
    searchPlaces,
    getRoute,
    getEstimate,
    validateLocation,
    getServicesStatus,
  };
};

export default useMapbox;
