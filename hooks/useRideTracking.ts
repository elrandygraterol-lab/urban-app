import { useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { rideAPI } from '@/services/api';

export function useRideTracking(rideId: string | null, rideStatus: string) {
  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const isActive = rideStatus === 'accepted' || rideStatus === 'arrived' || rideStatus === 'in_progress';

  useEffect(() => {
    if (!rideId || !isActive) {
      subscriptionRef.current?.remove();
      subscriptionRef.current = null;
      setIsTracking(false);
      return;
    }

    let cancelled = false;

    (async () => {
      // Solicitar permiso de ubicación en segundo plano (necesario para tracking con Waze)
      const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
      if (fgStatus !== 'granted') {
        setPermissionDenied(true);
        return;
      }

      // Solicitar permiso de background para tracking continuo
      try {
        const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
        if (bgStatus === 'granted') {
          console.log('[RIDE_TRACKING] Background location permission granted');
        }
      } catch {
        console.log('[RIDE_TRACKING] Background location permission not available (requires native build)');
      }

      if (cancelled) return;

      setPermissionDenied(false);

      subscriptionRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 5000,
          distanceInterval: 10,
          foregroundService: {
            notificationTitle: 'UrbanTaxi SJ',
            notificationBody: 'Compartiendo tu ubicación con el pasajero',
            notificationColor: '#22c55e',
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

      if (!cancelled) {
        setIsTracking(true);
      }
    })();

    return () => {
      cancelled = true;
      subscriptionRef.current?.remove();
      subscriptionRef.current = null;
      setIsTracking(false);
    };
  }, [rideId, rideStatus]);

  return { isTracking, permissionDenied };
}
