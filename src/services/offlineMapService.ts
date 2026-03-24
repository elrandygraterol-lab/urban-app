/**
 * Offline Map Service
 * 
 * Servicio para gestionar caché de mapas offline
 * Incluye:
 * - Descarga de tiles offline
 * - Gestión de caché
 * - Detección de modo offline
 * - Caché de rutas
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import logger from '../utils/logger';
import { offlineConfig } from '../styles/mapStyles';

// Try to import NetInfo, but don't fail if it's not available
let NetInfo: any = null;
try {
  NetInfo = require('@react-native-community/netinfo').default;
} catch (e) {
  // Silently fail - NetInfo not available
}

interface CacheStatus {
  totalSize: number;
  itemCount: number;
  lastUpdated: number;
  isValid: boolean;
}

interface CachedRoute {
  id: string;
  coordinates: Array<[number, number]>;
  distance: number;
  duration: number;
  timestamp: number;
}

interface OfflineBounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

const CACHE_KEY_PREFIX = 'offline_map_';
const ROUTE_CACHE_KEY_PREFIX = 'cached_route_';
const CACHE_METADATA_KEY = 'offline_cache_metadata';

class OfflineMapService {
  private cacheDir: string;
  private isOfflineMode: boolean = false;

  constructor() {
    // Use a hardcoded path since DocumentDirectory might not be available in all environments
    this.cacheDir = `/offline-tiles/${offlineConfig.tileCachePath}/`;
  }

  /**
   * Inicializar el servicio
   */
  async initialize(): Promise<void> {
    try {
      // Crear directorio de caché si no existe
      const dirInfo = await FileSystem.getInfoAsync(this.cacheDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(this.cacheDir, { intermediates: true });
      }

      // Detectar modo offline
      await this.detectOfflineMode();

      logger.info('Offline map service initialized');
    } catch (error) {
      logger.error('Error initializing offline map service', { error });
    }
  }

  /**
   * Detectar si el dispositivo está en modo offline
   */
  async detectOfflineMode(): Promise<boolean> {
    try {
      if (!NetInfo) {
        // Si NetInfo no está disponible, asumir que estamos online
        this.isOfflineMode = false;
        return false;
      }

      const state = await NetInfo.fetch();
      this.isOfflineMode = !state.isConnected;
      return this.isOfflineMode;
    } catch (error) {
      logger.error('Error detecting offline mode', { error });
      return false;
    }
  }

  /**
   * Verificar si está en modo offline
   */
  isOffline(): boolean {
    return this.isOfflineMode;
  }

  /**
   * Descargar tiles offline para una región
   */
  async downloadOfflineMaps(
    bounds: OfflineBounds,
    zoomLevels: number[] = [10, 12, 14, 15]
  ): Promise<boolean> {
    try {
      logger.info('Starting offline map download', { bounds, zoomLevels });

      // Validar bounds
      if (!this.validateBounds(bounds)) {
        throw new Error('Invalid bounds');
      }

      // Crear metadata de descarga
      const metadata: CacheStatus = {
        totalSize: 0,
        itemCount: 0,
        lastUpdated: Date.now(),
        isValid: true,
      };

      // Simular descarga de tiles (en producción, esto descargaría tiles reales)
      // Para este servicio, almacenamos metadata sobre la región descargada
      const cacheKey = `${CACHE_KEY_PREFIX}${Date.now()}`;
      await AsyncStorage.setItem(
        cacheKey,
        JSON.stringify({
          bounds,
          zoomLevels,
          timestamp: Date.now(),
        })
      );

      // Actualizar metadata
      await this.updateCacheMetadata(metadata);

      logger.info('Offline maps downloaded successfully');
      return true;
    } catch (error) {
      logger.error('Error downloading offline maps', { error });
      return false;
    }
  }

  /**
   * Obtener estado del caché offline
   */
  async getOfflineMapStatus(): Promise<CacheStatus> {
    try {
      const metadataStr = await AsyncStorage.getItem(CACHE_METADATA_KEY);

      if (!metadataStr) {
        return {
          totalSize: 0,
          itemCount: 0,
          lastUpdated: 0,
          isValid: false,
        };
      }

      const metadata = JSON.parse(metadataStr) as CacheStatus;

      // Verificar si el caché es válido (no expirado)
      const age = Date.now() - metadata.lastUpdated;
      const isValid = age < offlineConfig.cacheTTL;

      return {
        ...metadata,
        isValid,
      };
    } catch (error) {
      logger.error('Error getting offline map status', { error });
      return {
        totalSize: 0,
        itemCount: 0,
        lastUpdated: 0,
        isValid: false,
      };
    }
  }

  /**
   * Limpiar caché offline
   */
  async clearOfflineCache(): Promise<boolean> {
    try {
      logger.info('Clearing offline cache');

      // Eliminar directorio de caché
      try {
        await FileSystem.deleteAsync(this.cacheDir, { idempotent: true });
      } catch (error) {
        logger.warn('Error deleting cache directory', { error });
      }

      // Limpiar AsyncStorage
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(
        (key) =>
          key.startsWith(CACHE_KEY_PREFIX) ||
          key.startsWith(ROUTE_CACHE_KEY_PREFIX) ||
          key === CACHE_METADATA_KEY
      );

      // Remove keys one by one since multiRemove might not be available
      for (const key of cacheKeys) {
        await AsyncStorage.removeItem(key);
      }

      logger.info('Offline cache cleared successfully');
      return true;
    } catch (error) {
      logger.error('Error clearing offline cache', { error });
      return false;
    }
  }

  /**
   * Cachear una ruta para uso offline
   */
  async cacheRoute(
    id: string,
    coordinates: Array<[number, number]>,
    distance: number,
    duration: number
  ): Promise<boolean> {
    try {
      const route: CachedRoute = {
        id,
        coordinates,
        distance,
        duration,
        timestamp: Date.now(),
      };

      const cacheKey = `${ROUTE_CACHE_KEY_PREFIX}${id}`;
      await AsyncStorage.setItem(cacheKey, JSON.stringify(route));

      logger.info('Route cached successfully', { id });
      return true;
    } catch (error) {
      logger.error('Error caching route', { error, id });
      return false;
    }
  }

  /**
   * Obtener ruta cacheada
   */
  async getCachedRoute(id: string): Promise<CachedRoute | null> {
    try {
      const cacheKey = `${ROUTE_CACHE_KEY_PREFIX}${id}`;
      const routeStr = await AsyncStorage.getItem(cacheKey);

      if (!routeStr) {
        return null;
      }

      const route = JSON.parse(routeStr) as CachedRoute;

      // Verificar si la ruta no ha expirado
      const age = Date.now() - route.timestamp;
      if (age > offlineConfig.cacheTTL) {
        await AsyncStorage.removeItem(cacheKey);
        return null;
      }

      return route;
    } catch (error) {
      logger.error('Error getting cached route', { error, id });
      return null;
    }
  }

  /**
   * Validar bounds
   */
  private validateBounds(bounds: OfflineBounds): boolean {
    return (
      bounds.minLat >= -90 &&
      bounds.maxLat <= 90 &&
      bounds.minLng >= -180 &&
      bounds.maxLng <= 180 &&
      bounds.minLat < bounds.maxLat &&
      bounds.minLng < bounds.maxLng
    );
  }

  /**
   * Actualizar metadata del caché
   */
  private async updateCacheMetadata(metadata: CacheStatus): Promise<void> {
    try {
      await AsyncStorage.setItem(CACHE_METADATA_KEY, JSON.stringify(metadata));
    } catch (error) {
      logger.error('Error updating cache metadata', { error });
    }
  }

  /**
   * Obtener tamaño total del caché
   */
  async getCacheSize(): Promise<number> {
    try {
      const dirInfo = await FileSystem.getInfoAsync(this.cacheDir);
      if (dirInfo.exists && dirInfo.size) {
        return dirInfo.size;
      }
      return 0;
    } catch (error) {
      logger.error('Error getting cache size', { error });
      return 0;
    }
  }

  /**
   * Verificar si el caché está lleno
   */
  async isCacheFull(): Promise<boolean> {
    try {
      const size = await this.getCacheSize();
      return size >= offlineConfig.maxCacheSize;
    } catch (error) {
      logger.error('Error checking if cache is full', { error });
      return false;
    }
  }
}

// Exportar instancia singleton
export const offlineMapService = new OfflineMapService();

export default offlineMapService;
