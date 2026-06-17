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
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = Math.atan2(y, x);
  const brng = (toDeg(θ) + 360) % 360;
  return brng;
};

export const computeNearestRouteIndex = (
  coords: { latitude: number; longitude: number }[],
  point: { latitude: number; longitude: number }
) => {
  let idx = 0;
  let minD = Number.POSITIVE_INFINITY;
  const cosLat = Math.cos(toRad(point.latitude));
  for (let i = 0; i < coords.length; i++) {
    const dLat = coords[i].latitude - point.latitude;
    const dLng = (coords[i].longitude - point.longitude) * cosLat;
    const d = dLat * dLat + dLng * dLng;
    if (d < minD) {
      minD = d;
      idx = i;
    }
  }
  return idx;
};

export const bearingAlongRoute = (
  coords: { latitude: number; longitude: number }[],
  point: { latitude: number; longitude: number }
) => {
  if (coords.length < 2) return 0;
  let nearest = computeNearestRouteIndex(coords, point);

  // If at the last point, use the segment before it for bearing
  if (nearest >= coords.length - 1) {
    nearest = Math.max(0, coords.length - 2);
  }

  // Determine correct segment: driver may be between nearest-1→nearest or nearest→nearest+1
  // Use dot-product projection to decide which side of nearest point the driver is on
  let fromIdx = nearest;
  let toIdx = Math.min(nearest + 1, coords.length - 1);

  if (nearest > 0) {
    const prev = coords[nearest - 1];
    const curr = coords[nearest];
    const cosLat = Math.cos(toRad(point.latitude));
    // Vector from prev→curr (route segment)
    const segDx = (curr.longitude - prev.longitude) * cosLat;
    const segDy = curr.latitude - prev.latitude;
    // Vector from prev→driver
    const drvDx = (point.longitude - prev.longitude) * cosLat;
    const drvDy = point.latitude - prev.latitude;
    const segLenSq = segDx * segDx + segDy * segDy;
    if (segLenSq > 0) {
      // Project driver position onto the segment
      const t = (drvDx * segDx + drvDy * segDy) / segLenSq;
      if (t > 0 && t < 1) {
        // Driver is between prev and curr — use prev→curr as the bearing segment
        fromIdx = nearest - 1;
        toIdx = nearest;
      }
    }
  }

  const from = coords[fromIdx];
  const to = coords[toIdx];
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
 * Índice del siguiente Step que el conductor debe tomar.
 * Busca solo hacia adelante desde `startFromIndex` para no señalar pasos ya pasados.
 * Requiere que los steps tengan campo `location`.
 * Si no tienen location, retorna `startFromIndex`.
 */
export const computeNearestStepIndex = (
  steps: { location?: { latitude: number; longitude: number } }[],
  point: { latitude: number; longitude: number },
  startFromIndex: number = 0
): number => {
  if (steps.length === 0) return 0;
  // Clamp start index
  const start = Math.max(0, Math.min(startFromIndex, steps.length - 1));
  let idx = start;
  let minD = Number.POSITIVE_INFINITY;
  let found = false;
  for (let i = start; i < steps.length; i++) {
    const loc = steps[i].location;
    if (!loc) continue;
    const d = haversineDistance(loc, point);
    if (d < minD) {
      minD = d;
      idx = i;
      found = true;
    }
  }
  // If no forward step found, fall back to last valid step index
  return found ? idx : start;
};
