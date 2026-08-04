import { useEffect, useRef, useState, useCallback } from 'react';
import * as Location from 'expo-location';
import { rideAPI } from '@/services/api';

export function useRideTracking(rideId: string | null, rideStatus: string) {
  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [showBackgroundDisclosure, setShowBackgroundDisclosure] = useState(false);
  const pendingRideIdRef = useRef<string | null>(null);
  const cancelledRef = useRef(false);

  const isActive = rideStatus === 'accepted' || rideStatus === 'arrived' || rideStatus === 'in_progress';

  // Cleanup on deactivation
  useEffect(() => {
    if (!rideId || !isActive) {
      subscriptionRef.current?.remove();
      subscriptionRef.current = null;
      setIsTracking(false);
      setShowBackgroundDisclosure(false);
      setPermissionDenied(false);
      pendingRideIdRef.current = null;
    }
  }, [rideId, isActive]);

  // Step 1: Request foreground permission when ride becomes active
  useEffect(() => {
    if (!rideId || !isActive) return;

    let cancelled = false;
    cancelledRef.current = false;

    (async () => {
      const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
      if (cancelled) return;

      if (fgStatus !== 'granted') {
        setPermissionDenied(true);
        return;
      }

      // Check if background permission is already granted
      const { status: bgStatus } = await Location.getBackgroundPermissionsAsync();
      if (cancelled) return;

      if (bgStatus === 'granted') {
        startTracking(rideId);
      } else {
        pendingRideIdRef.current = rideId;
        setShowBackgroundDisclosure(true);
      }
    })();

    return () => {
      cancelled = true;
      cancelledRef.current = true;
    };
  }, [rideId, isActive]);

  // Step 2: After user accepts disclosure, request background permission and start tracking
  const confirmBackgroundDisclosure = useCallback(async () => {
    const rideId = pendingRideIdRef.current;
    if (!rideId) return;
    setShowBackgroundDisclosure(false);

    try {
      const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
      if (cancelledRef.current) return;

      if (bgStatus === 'granted') {
        console.log('[RIDE_TRACKING] Background location permission granted');
      } else {
        setPermissionDenied(true);
        return;
      }
    } catch {
      console.log('[RIDE_TRACKING] Background location permission not available (requires native build)');
    }

    startTracking(rideId);
  }, []);

  const cancelBackgroundDisclosure = useCallback(() => {
    setShowBackgroundDisclosure(false);
    setPermissionDenied(true);
    pendingRideIdRef.current = null;
  }, []);

  async function startTracking(rideId: string) {
    if (cancelledRef.current) return;
    setPermissionDenied(false);

    try {
      subscriptionRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 5000,
          distanceInterval: 10,
          foregroundService: {
            notificationTitle: 'UrbanTaxi SJ',
            notificationBody: 'Compartiendo tu ubicación con el pasajero',
            notificationColor: '#2FB908',
          },
        } as any,
        (location) => {
          rideAPI
            .updateLocation(
              rideId,
              location.coords.latitude,
              location.coords.longitude,
              location.coords.accuracy ?? undefined
            )
            .catch(() => {});
        }
      );

      if (!cancelledRef.current) {
        setIsTracking(true);
      }
    } catch (error) {
      console.error('[RIDE_TRACKING] Error starting tracking:', error);
      setPermissionDenied(true);
    }
  }

  return {
    isTracking,
    permissionDenied,
    showBackgroundDisclosure,
    confirmBackgroundDisclosure,
    cancelBackgroundDisclosure,
  };
}
