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
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setPermissionDenied(true);
        return;
      }

      if (cancelled) return;

      setPermissionDenied(false);

      subscriptionRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 10_000,
          distanceInterval: 20,
        },
        (location) => {
          rideAPI
            .updateLocation(
              rideId,
              location.coords.latitude,
              location.coords.longitude,
              location.coords.accuracy ?? undefined
            )
            .catch(() => {
              // Silently ignore network errors — don't interrupt the ride
            });
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
