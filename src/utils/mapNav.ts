export const toRad = (deg: number) => (deg * Math.PI) / 180;
export const toDeg = (rad: number) => (rad * 180) / Math.PI;

export const computeBearing = (
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number }
) => {
  const φ1 = toRad(from.latitude);
  const φ2 = toRad(to.latitude);
  const Δλ = toRad(to.longitude - from.longitude);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.cos(φ2) * Math.cos(Δλ) + Math.sin(φ1) * Math.sin(φ2);
  const θ = Math.atan2(y, x);
  const brng = (toDeg(θ) + 360) % 360;
  return brng;
};

export const computeNearestRouteIndex = (
  coords: Array<{ latitude: number; longitude: number }>,
  point: { latitude: number; longitude: number }
) => {
  let idx = 0;
  let minD = Number.POSITIVE_INFINITY;
  for (let i = 0; i < coords.length; i++) {
    const dLat = coords[i].latitude - point.latitude;
    const dLng = coords[i].longitude - point.longitude;
    const d = dLat * dLat + dLng * dLng;
    if (d < minD) {
      minD = d;
      idx = i;
    }
  }
  return idx;
};

export const bearingAlongRoute = (
  coords: Array<{ latitude: number; longitude: number }>,
  point: { latitude: number; longitude: number }
) => {
  if (coords.length < 2) return 0;
  let nearest = computeNearestRouteIndex(coords, point);

  // If at the last point, use the segment before it for bearing
  if (nearest >= coords.length - 1) {
    nearest = Math.max(0, coords.length - 2);
  }

  const nextIdx = Math.min(nearest + 1, coords.length - 1);
  const from = coords[nearest];
  const to = coords[nextIdx];
  return computeBearing(from, to);
};

export const animateNavigationCamera = (
  mapRef: React.RefObject<any>,
  center: { latitude: number; longitude: number },
  heading: number,
  options?: { duration?: number; zoom?: number; pitch?: number }
) => {
  const duration = options?.duration ?? 500;
  const zoom = options?.zoom ?? 17;
  // pitch=0 keeps markers visually upright (no perspective distortion)
  const pitch = options?.pitch ?? 0;
  if (mapRef.current) {
    mapRef.current.animateCamera(
      {
        center,
        zoom,
        heading,
        pitch,
      },
      { duration }
    );
  }
};

/**
 * Distancia haversine entre dos coordenadas, en metros.
 */
export const haversineDistance = (
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number }
): number => {
  const R = 6371000;
  const φ1 = toRad(a.latitude);
  const φ2 = toRad(b.latitude);
  const Δφ = toRad(b.latitude - a.latitude);
  const Δλ = toRad(b.longitude - a.longitude);
  const sinΔφ = Math.sin(Δφ / 2);
  const sinΔλ = Math.sin(Δλ / 2);
  const h = sinΔφ * sinΔφ + Math.cos(φ1) * Math.cos(φ2) * sinΔλ * sinΔλ;
  return 2 * R * Math.asin(Math.sqrt(h));
};

/**
 * Índice del Step más cercano a la posición actual del conductor.
 * Requiere que los steps tengan campo `location`.
 * Si no tienen location, retorna 0.
 */
export const computeNearestStepIndex = (
  steps: Array<{ location?: { latitude: number; longitude: number } }>,
  point: { latitude: number; longitude: number }
): number => {
  if (steps.length === 0) return 0;
  let idx = 0;
  let minD = Number.POSITIVE_INFINITY;
  let found = false;
  for (let i = 0; i < steps.length; i++) {
    const loc = steps[i].location;
    if (!loc) continue;
    const d = haversineDistance(loc, point);
    if (d < minD) {
      minD = d;
      idx = i;
      found = true;
    }
  }
  return found ? idx : 0;
};
