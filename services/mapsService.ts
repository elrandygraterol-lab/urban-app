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
    });

    return response.data.data;
  } catch (error) {
    console.error('Error obteniendo estimación de viaje:', error);
    throw error;
  }
}

/**
 * Geocodificar una dirección
 */
export async function geocodeAddress(address: string): Promise<Location> {
  try {
    const response = await api.post('/maps/geocode', { address });
    return response.data.data;
  } catch (error) {
    console.error('Error geocodificando dirección:', error);
    throw error;
  }
}

/**
 * Reverse geocodificar (coordenadas -> dirección)
 */
export async function reverseGeocode(
  latitude: number,
  longitude: number
): Promise<Location> {
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
export async function validateLocation(
  latitude: number,
  longitude: number
): Promise<boolean> {
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
 * Buscar lugares por texto
 */
export async function searchPlaces(
  query: string,
  latitude?: number,
  longitude?: number
): Promise<any[]> {
  try {
    const params: any = { query };
    if (latitude) params.latitude = latitude;
    if (longitude) params.longitude = longitude;

    const response = await api.get('/maps/search-places', { params });
    return response.data.data;
  } catch (error) {
    console.error('Error buscando lugares:', error);
    throw error;
  }
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
export async function getRoute(
  pickupLocation: Location,
  dropoffLocation: Location
): Promise<any> {
  try {
    const response = await api.get('/maps/route', {
      params: {
        pickupLat: pickupLocation.latitude,
        pickupLng: pickupLocation.longitude,
        dropoffLat: dropoffLocation.latitude,
        dropoffLng: dropoffLocation.longitude,
      },
    });

    return response.data.data;
  } catch (error) {
    console.error('Error obteniendo ruta:', error);
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

export default {
  getEstimate,
  geocodeAddress,
  reverseGeocode,
  validateLocation,
  searchPlaces,
  findNearbyDrivers,
  getRoute,
  getMapsStatus,
};
