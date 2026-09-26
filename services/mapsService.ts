/**
 * Maps Service (Mobile App)
 * Cliente para consumir los endpoints de mapas del backend
 *
 * Usa Google Maps SDK + OSRM Autohospedado
 * - Visualización: Google Maps SDK (GRATIS, ilimitado)
 * - Rutas: OSRM Autohospedado ($5-20/mes)
 */

import axios from 'axios';
import config from '../src/config/api';
import { searchFallbackPlaces, FallbackPlace } from './fallbackPlaces';

console.log('[MAPS SERVICE] Initializing with baseURL:', config.apiUrl);

const api = axios.create({
  baseURL: config.apiUrl,
  timeout: 15000,
});

export interface Location {
  latitude: number;
  longitude: number;
  address?: string;
}

export interface TripEstimate {
  distance: number; // km
  duration: number; // minutos
  estimatedCost?: number;
  polyline?: Array<[number, number]>;
}

export interface NearbyDriver {
  driverId: string;
  distance: number; // km
  duration: number; // minutos
  location: Location;
}

/**
 * Obtener estimación de viaje
 */
export async function getEstimate(
  pickupLocation: Location,
  dropoffLocation: Location,
  farePerKm: number = 1.5,
  baseFare: number = 2.0
): Promise<TripEstimate> {
  try {
    const response = await api.get('/maps/estimate', {
      params: {
        pickupLat: pickupLocation.latitude,
        pickupLng: pickupLocation.longitude,
        dropoffLat: dropoffLocation.latitude,
        dropoffLng: dropoffLocation.longitude,
        farePerKm,
        baseFare,
      },
      // El backend enruta contra OSRM self-hosted: amplio el timeout para no
      // abortar antes de que el servidor termine (OSRM puede tardar bajo carga).
      timeout: 30000,
    });

    return response.data.data;
  } catch (error) {
    console.error('Error obteniendo estimación de viaje:', error);
    throw error;
  }
}

/**
 * Geocodificar una dirección
 * Opcionalmente envía lat/lng para scoping regional del viewbox de Nominatim
 */
export async function geocodeAddress(
  address: string,
  latitude?: number,
  longitude?: number
): Promise<Location> {
  try {
    const body: any = { address };
    if (latitude !== undefined) body.latitude = latitude;
    if (longitude !== undefined) body.longitude = longitude;
    const response = await api.post('/maps/geocode', body);
    return response.data.data;
  } catch (error) {
    console.error('Error geocodificando dirección:', error);
    throw error;
  }
}

/**
 * Reverse geocodificar (coordenadas -> dirección)
 */
export async function reverseGeocode(latitude: number, longitude: number): Promise<Location> {
  try {
    const response = await api.post('/maps/reverse-geocode', {
      latitude,
      longitude,
    });

    return response.data.data;
  } catch (error) {
    console.error('Error en reverse geocodificación:', error);
    throw error;
  }
}

/**
 * Validar una ubicación
 */
export async function validateLocation(latitude: number, longitude: number): Promise<boolean> {
  try {
    const response = await api.post('/maps/validate-location', {
      latitude,
      longitude,
    });

    return response.data.data.isValid;
  } catch (error) {
    console.error('Error validando ubicación:', error);
    return false;
  }
}

/**
 * Resultado de búsqueda híbrida del backend
 */
export interface HybridSearchResult {
  id: string;
  name: string;
  displayName: string;
  latitude: number;
  longitude: number;
  category?: string;
  source: 'custom' | 'nominatim';
  relevanceScore: number;
}

/**
 * Mapea un HybridSearchResult al formato Place usado por la app
 */
function mapHybridResultToPlace(result: HybridSearchResult): any {
  return {
    id: result.id,
    name: result.name,
    description: result.displayName !== result.name ? result.displayName : '',
    latitude: result.latitude,
    longitude: result.longitude,
    type: result.category || result.source,
    fullAddress: result.displayName,
    source: result.source,
  };
}

/**
 * Buscar lugares por texto usando el endpoint híbrido del backend.
 * Combina lugares personalizados (custom places) con resultados de Nominatim.
 * Solo retorna resultados dentro de Guárico, Venezuela.
 * Si no hay resultados, retorna array vacío (el componente mostrará "no encontrado").
 */
export async function searchPlaces(
  query: string,
  latitude?: number,
  longitude?: number
): Promise<any[]> {
  console.log('[mapsService] searchPlaces called:', {
    query,
    latitude,
    longitude,
    hasLocation: !!(latitude && longitude),
  });

  try {
    const params: any = { q: query };
    if (latitude !== undefined) params.lat = latitude;
    if (longitude !== undefined) params.lon = longitude;

    const hybridResponse = await api.get('/search/places', { params, timeout: 10000 });

    if (hybridResponse.data && Array.isArray(hybridResponse.data.results)) {
      const results = hybridResponse.data.results as HybridSearchResult[];
      console.log('[mapsService] hybridSearch response:', results.length, 'results');
      if (results.length === 0) return [];
      return results.map(mapHybridResultToPlace);
    }
  } catch (hybridError) {
    console.warn('[mapsService] Hybrid search unavailable, falling back to legacy endpoint:', hybridError);
  }

  // Fallback: legacy endpoint
  try {
    const params: any = { query };
    if (latitude) params.latitude = latitude;
    if (longitude) params.longitude = longitude;
    const response = await api.get('/maps/search-places', { params });
    const results = response.data.data || [];
    console.log('[mapsService] searchPlaces (legacy) response:', results.length, 'results');
    if (results.length > 0) return results;
  } catch (error) {
    console.warn('[mapsService] Legacy search also unavailable:', error);
  }

  // Final fallback: client-side local place list
  console.warn('[mapsService] Both API endpoints failed, using client-side fallback');
  const fallbackResults = searchFallbackPlaces(query);
  console.log('[mapsService] Fallback results:', fallbackResults.length);
  return fallbackResults.map((p: FallbackPlace) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    latitude: p.latitude,
    longitude: p.longitude,
    type: p.type,
    fullAddress: p.fullAddress,
    source: p.source as 'custom',
  }));
}

/**
 * Encontrar conductores cercanos
 */
export async function findNearbyDrivers(
  passengerLocation: Location,
  drivers: Array<{
    driverId: string;
    location: Location;
  }>,
  maxDistance: number = 5
): Promise<NearbyDriver[]> {
  try {
    const response = await api.post('/maps/nearby-drivers', {
      passengerLocation,
      drivers,
      maxDistance,
    });

    return response.data.data;
  } catch (error) {
    console.error('Error encontrando conductores cercanos:', error);
    throw error;
  }
}

/**
 * Obtener ruta con instrucciones
 */
export async function getRoute(pickupLocation: Location, dropoffLocation: Location): Promise<any> {
  try {
    const url = '/maps/route';
    const params = {
      pickupLat: pickupLocation.latitude,
      pickupLng: pickupLocation.longitude,
      dropoffLat: dropoffLocation.latitude,
      dropoffLng: dropoffLocation.longitude,
    };

    console.log('[MAPS SERVICE] getRoute - Full URL:', `${api.defaults.baseURL}${url}`);
    console.log('[MAPS SERVICE] getRoute - Params:', params);

    const response = await api.get(url, { params, timeout: 30000 });

    console.log('[MAPS SERVICE] getRoute - Success:', response.data);
    return response.data.data;
  } catch (error) {
    console.error('[MAPS SERVICE] Error obteniendo ruta:', error);
    if (axios.isAxiosError(error)) {
      console.error('[MAPS SERVICE] Error details:', {
        message: error.message,
        code: error.code,
        config: {
          baseURL: error.config?.baseURL,
          url: error.config?.url,
          method: error.config?.method,
        },
        response: error.response?.data,
      });
    }
    throw error;
  }
}

/**
 * Obtener estado de los servicios de mapas
 */
export async function getMapsStatus(): Promise<any> {
  try {
    const response = await api.get('/maps/status');
    return response.data.data;
  } catch (error) {
    console.error('Error obteniendo estado de mapas:', error);
    throw error;
  }
}

/**
 * Obtener ubicación aproximada por IP pública (respaldado por Redis 7d TTL).
 * Útil como fallback cuando el GPS no está disponible o es denegado.
 */
export async function getIpLocation(): Promise<{
  city: string;
  region: string;
  regionName: string;
  country: string;
  latitude: number;
  longitude: number;
} | null> {
  try {
    const response = await api.get('/maps/ip-location', { timeout: 8000 });
    if (response.data?.success && response.data?.data) {
      return response.data.data;
    }
    return null;
  } catch (error) {
    console.warn('Error obteniendo IP geolocation:', error);
    return null;
  }
}

export default {
  getEstimate,
  geocodeAddress,
  reverseGeocode,
  validateLocation,
  searchPlaces,
  findNearbyDrivers,
  getRoute,
  getMapsStatus,
  getIpLocation,
};
