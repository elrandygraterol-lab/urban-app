/**
 * Offline Map Service Tests
 * 
 * Tests for offline map downloading, caching, and offline mode detection
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { offlineMapService } from '../offlineMapService';

// Mock logger
jest.mock('../../utils/logger', () => ({
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage');
const mockedAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

// Mock FileSystem
jest.mock('expo-file-system');
const mockedFileSystem = FileSystem as jest.Mocked<typeof FileSystem>;

describe('Offline Map Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedAsyncStorage.getAllKeys.mockResolvedValue([]);
    mockedFileSystem.getInfoAsync.mockResolvedValue({
      exists: true,
      isDirectory: true,
      modificationTime: Date.now(),
      uri: '',
    } as any);
  });

  describe('initialize', () => {
    it('should initialize the service successfully', async () => {
      mockedFileSystem.getInfoAsync.mockResolvedValueOnce({
        exists: true,
        isDirectory: true,
        size: 0,
        modificationTime: Date.now(),
        uri: '',
      });

      await offlineMapService.initialize();

      expect(mockedFileSystem.getInfoAsync).toHaveBeenCalled();
    });

    it('should create cache directory if it does not exist', async () => {
      mockedFileSystem.getInfoAsync.mockResolvedValueOnce({
        exists: false,
        isDirectory: false,
        modificationTime: Date.now(),
        uri: '',
      } as any);

      mockedFileSystem.makeDirectoryAsync.mockResolvedValueOnce(undefined);

      await offlineMapService.initialize();

      expect(mockedFileSystem.makeDirectoryAsync).toHaveBeenCalled();
    });
  });

  describe('downloadOfflineMaps', () => {
    it('should download offline maps successfully', async () => {
      mockedAsyncStorage.setItem.mockResolvedValue(undefined);

      const bounds = {
        minLat: 40.7,
        maxLat: 40.8,
        minLng: -74.1,
        maxLng: -74.0,
      };

      const result = await offlineMapService.downloadOfflineMaps(bounds, [10, 12, 14]);

      expect(result).toBe(true);
      expect(mockedAsyncStorage.setItem).toHaveBeenCalled();
    });

    it('should reject invalid bounds', async () => {
      const invalidBounds = {
        minLat: 100, // Invalid latitude
        maxLat: 40.8,
        minLng: -74.1,
        maxLng: -74.0,
      };

      const result = await offlineMapService.downloadOfflineMaps(invalidBounds);

      expect(result).toBe(false);
    });

    it('should reject bounds where min > max', async () => {
      const invalidBounds = {
        minLat: 40.8,
        maxLat: 40.7, // min > max
        minLng: -74.1,
        maxLng: -74.0,
      };

      const result = await offlineMapService.downloadOfflineMaps(invalidBounds);

      expect(result).toBe(false);
    });

    it('should use default zoom levels if not provided', async () => {
      mockedAsyncStorage.setItem.mockResolvedValue(undefined);

      const bounds = {
        minLat: 40.7,
        maxLat: 40.8,
        minLng: -74.1,
        maxLng: -74.0,
      };

      const result = await offlineMapService.downloadOfflineMaps(bounds);

      expect(result).toBe(true);
    });

    it('should handle download errors gracefully', async () => {
      mockedAsyncStorage.setItem.mockRejectedValueOnce(new Error('Storage error'));

      const bounds = {
        minLat: 40.7,
        maxLat: 40.8,
        minLng: -74.1,
        maxLng: -74.0,
      };

      const result = await offlineMapService.downloadOfflineMaps(bounds);

      expect(result).toBe(false);
    });
  });

  describe('getOfflineMapStatus', () => {
    it('should return cache status when metadata exists', async () => {
      const metadata = {
        totalSize: 100000,
        itemCount: 50,
        lastUpdated: Date.now(),
        isValid: true,
      };

      mockedAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(metadata));

      const status = await offlineMapService.getOfflineMapStatus();

      expect(status.totalSize).toBe(100000);
      expect(status.itemCount).toBe(50);
      expect(status.isValid).toBe(true);
    });

    it('should return empty status when no metadata exists', async () => {
      mockedAsyncStorage.getItem.mockResolvedValueOnce(null);

      const status = await offlineMapService.getOfflineMapStatus();

      expect(status.totalSize).toBe(0);
      expect(status.itemCount).toBe(0);
      expect(status.isValid).toBe(false);
    });

    it('should mark cache as invalid if expired', async () => {
      const oldTimestamp = Date.now() - 8 * 24 * 60 * 60 * 1000; // 8 days ago
      const metadata = {
        totalSize: 100000,
        itemCount: 50,
        lastUpdated: oldTimestamp,
        isValid: true,
      };

      mockedAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(metadata));

      const status = await offlineMapService.getOfflineMapStatus();

      expect(status.isValid).toBe(false);
    });

    it('should handle metadata parsing errors', async () => {
      mockedAsyncStorage.getItem.mockResolvedValueOnce('invalid json');

      const status = await offlineMapService.getOfflineMapStatus();

      expect(status.isValid).toBe(false);
    });
  });

  describe('clearOfflineCache', () => {
    it('should clear offline cache successfully', async () => {
      mockedFileSystem.deleteAsync.mockResolvedValueOnce(undefined);
      mockedAsyncStorage.getAllKeys.mockResolvedValueOnce([
        'offline_map_123',
        'cached_route_456',
        'offline_cache_metadata',
      ]);

      const result = await offlineMapService.clearOfflineCache();

      expect(result).toBe(true);
      expect(mockedFileSystem.deleteAsync).toHaveBeenCalled();
    });

    it('should handle cache directory deletion errors gracefully', async () => {
      mockedFileSystem.deleteAsync.mockRejectedValueOnce(new Error('Delete error'));
      mockedAsyncStorage.getAllKeys.mockResolvedValueOnce([]);

      const result = await offlineMapService.clearOfflineCache();

      expect(result).toBe(true); // Should still succeed
    });

    it('should remove cache-related keys from AsyncStorage', async () => {
      mockedFileSystem.deleteAsync.mockResolvedValueOnce(undefined);
      mockedAsyncStorage.getAllKeys.mockResolvedValueOnce([
        'offline_map_123',
        'cached_route_456',
        'offline_cache_metadata',
        'other_key',
      ]);

      await offlineMapService.clearOfflineCache();

      expect(mockedAsyncStorage.getAllKeys).toHaveBeenCalled();
    });
  });

  describe('cacheRoute', () => {
    it('should cache a route successfully', async () => {
      mockedAsyncStorage.setItem.mockResolvedValueOnce(undefined);

      const coordinates: Array<[number, number]> = [
        [-74.006, 40.7128],
        [-73.9855, 40.758],
      ];

      const result = await offlineMapService.cacheRoute(
        'route-123',
        coordinates,
        5.2,
        12
      );

      expect(result).toBe(true);
      expect(mockedAsyncStorage.setItem).toHaveBeenCalled();
    });

    it('should handle caching errors', async () => {
      mockedAsyncStorage.setItem.mockRejectedValueOnce(new Error('Storage error'));

      const coordinates: Array<[number, number]> = [
        [-74.006, 40.7128],
        [-73.9855, 40.758],
      ];

      const result = await offlineMapService.cacheRoute(
        'route-123',
        coordinates,
        5.2,
        12
      );

      expect(result).toBe(false);
    });

    it('should store route with correct structure', async () => {
      mockedAsyncStorage.setItem.mockResolvedValueOnce(undefined);

      const coordinates: Array<[number, number]> = [
        [-74.006, 40.7128],
        [-73.9855, 40.758],
      ];

      await offlineMapService.cacheRoute('route-123', coordinates, 5.2, 12);

      const callArgs = mockedAsyncStorage.setItem.mock.calls[0];
      const storedData = JSON.parse(callArgs[1]);

      expect(storedData.id).toBe('route-123');
      expect(storedData.coordinates).toEqual(coordinates);
      expect(storedData.distance).toBe(5.2);
      expect(storedData.duration).toBe(12);
      expect(storedData.timestamp).toBeDefined();
    });
  });

  describe('getCachedRoute', () => {
    it('should retrieve cached route successfully', async () => {
      const cachedRoute = {
        id: 'route-123',
        coordinates: [[-74.006, 40.7128]],
        distance: 5.2,
        duration: 12,
        timestamp: Date.now(),
      };

      mockedAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(cachedRoute));

      const result = await offlineMapService.getCachedRoute('route-123');

      expect(result).toEqual(cachedRoute);
    });

    it('should return null if route not found', async () => {
      mockedAsyncStorage.getItem.mockResolvedValueOnce(null);

      const result = await offlineMapService.getCachedRoute('nonexistent');

      expect(result).toBeNull();
    });

    it('should return null if cached route is expired', async () => {
      const oldTimestamp = Date.now() - 8 * 24 * 60 * 60 * 1000; // 8 days ago
      const cachedRoute = {
        id: 'route-123',
        coordinates: [[-74.006, 40.7128]],
        distance: 5.2,
        duration: 12,
        timestamp: oldTimestamp,
      };

      mockedAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(cachedRoute));
      mockedAsyncStorage.removeItem.mockResolvedValueOnce(undefined);

      const result = await offlineMapService.getCachedRoute('route-123');

      expect(result).toBeNull();
      expect(mockedAsyncStorage.removeItem).toHaveBeenCalled();
    });

    it('should handle parsing errors', async () => {
      mockedAsyncStorage.getItem.mockResolvedValueOnce('invalid json');

      const result = await offlineMapService.getCachedRoute('route-123');

      expect(result).toBeNull();
    });
  });

  describe('isOffline', () => {
    it('should return offline status', () => {
      const isOffline = offlineMapService.isOffline();
      expect(typeof isOffline).toBe('boolean');
    });
  });

  describe('getCacheSize', () => {
    it('should return cache size', async () => {
      mockedFileSystem.getInfoAsync.mockResolvedValueOnce({
        exists: true,
        isDirectory: true,
        size: 50000,
        modificationTime: Date.now(),
        uri: '',
      } as any);

      const size = await offlineMapService.getCacheSize();

      expect(size).toBe(50000);
    });

    it('should return 0 if cache directory does not exist', async () => {
      mockedFileSystem.getInfoAsync.mockResolvedValueOnce({
        exists: false,
        isDirectory: false,
        modificationTime: Date.now(),
        uri: '',
      } as any);

      const size = await offlineMapService.getCacheSize();

      expect(size).toBe(0);
    });

    it('should handle errors gracefully', async () => {
      mockedFileSystem.getInfoAsync.mockRejectedValueOnce(new Error('FS error'));

      const size = await offlineMapService.getCacheSize();

      expect(size).toBe(0);
    });
  });

  describe('isCacheFull', () => {
    it('should return true if cache is full', async () => {
      const maxSize = 500 * 1024 * 1024; // 500MB
      mockedFileSystem.getInfoAsync.mockResolvedValueOnce({
        exists: true,
        isDirectory: true,
        size: maxSize + 1,
        modificationTime: Date.now(),
        uri: '',
      } as any);

      const isFull = await offlineMapService.isCacheFull();

      expect(isFull).toBe(true);
    });

    it('should return false if cache is not full', async () => {
      mockedFileSystem.getInfoAsync.mockResolvedValueOnce({
        exists: true,
        isDirectory: true,
        size: 100000,
        modificationTime: Date.now(),
        uri: '',
      } as any);

      const isFull = await offlineMapService.isCacheFull();

      expect(isFull).toBe(false);
    });

    it('should handle errors gracefully', async () => {
      mockedFileSystem.getInfoAsync.mockRejectedValueOnce(new Error('FS error'));

      const isFull = await offlineMapService.isCacheFull();

      expect(isFull).toBe(false);
    });
  });

  describe('detectOfflineMode', () => {
    it('should detect offline mode', async () => {
      const result = await offlineMapService.detectOfflineMode();
      expect(typeof result).toBe('boolean');
    });
  });
});
