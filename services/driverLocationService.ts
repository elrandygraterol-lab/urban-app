import * as Location from 'expo-location';
import { getSocket } from '@/services/socket';
import { rideAPI } from '@/services/api';

export interface DriverLocationFix {
  latitude: number;
  longitude: number;
  heading: number | null;
  accuracy: number | null;
  speed: number | null;
  timestamp: number;
}

type LocationSubscriber = (fix: DriverLocationFix) => void;

type StreamType = 'none' | 'idle' | 'ride';

const RIDE_MAX_ACCURACY = 30;
const IDLE_MAX_ACCURACY = 50;

const RIDE_MIN_MOVE_METERS = 8;
const RIDE_MAX_INTERVAL_MS = 10_000;
const IDLE_MIN_MOVE_METERS = 10;
const IDLE_MAX_INTERVAL_MS = 15_000;

const BUFFER_MAX = 10;

function haversineDistance(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number }
): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const sa =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(sa));
}

function bearingBetween(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number }
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;
  const φ1 = toRad(a.latitude);
  const φ2 = toRad(b.latitude);
  const Δλ = toRad(b.longitude - a.longitude);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

class DriverLocationService {
  private watcher: Location.LocationSubscription | null = null;
  private streamType: StreamType = 'none';
  private rideId: string | null = null;
  private idleRequested = false;

  private subscribers = new Set<LocationSubscriber>();
  private lastPosition: DriverLocationFix | null = null;
  private lastEmitted: { latitude: number; longitude: number; ts: number } | null = null;
  private watcherGen = 0;

  private buffer: Array<{
    rideId: string | null;
    latitude: number;
    longitude: number;
    heading: number | null;
    accuracy: number | null;
  }> = [];

  private socketAttached: any = null;

  getLastPosition(): DriverLocationFix | null {
    return this.lastPosition;
  }

  isActive(): boolean {
    return this.watcher !== null;
  }

  subscribe(cb: LocationSubscriber): () => void {
    this.subscribers.add(cb);
    if (this.lastPosition) {
      cb(this.lastPosition);
    }
    return () => {
      this.subscribers.delete(cb);
    };
  }

  setIdleStream(active: boolean): void {
    this.idleRequested = active;
    this.reconcile();
  }

  setRideStream(rideId: string | null): void {
    this.rideId = rideId;
    this.reconcile();
  }

  private effectiveMode(): StreamType {
    if (this.rideId) return 'ride';
    if (this.idleRequested) return 'idle';
    return 'none';
  }

  private reconcile(): void {
    const mode = this.effectiveMode();
    const previous = this.streamType;

    if (mode !== previous) {
      this.stopWatcher();
      if (mode !== 'none') {
        this.startWatcher();
      }
    }
  }

  private stopWatcher(): void {
    if (this.watcher) {
      this.watcher.remove();
      this.watcher = null;
    }
    this.streamType = 'none';
    this.lastEmitted = null;
    this.buffer = [];
  }

  private startWatcher(): void {
    const mode = this.effectiveMode();
    const isRide = mode === 'ride';
    const gen = ++this.watcherGen;

    const options: any = {
      accuracy: isRide ? Location.Accuracy.BestForNavigation : Location.Accuracy.High,
      timeInterval: isRide ? 5000 : 10_000,
      distanceInterval: isRide ? 10 : 25,
      pausesUpdatesAutomatically: false,
    };

    if (isRide) {
      options.activityType = Location.ActivityType.AutomotiveNavigation;
      options.foregroundService = {
        notificationTitle: 'UrbanTaxi SJ',
        notificationBody: 'Compartiendo tu ubicación con el pasajero',
        notificationColor: '#2FB908',
      };
    }

    Location.watchPositionAsync(options, location => {
      if (this.streamType === 'none' || gen !== this.watcherGen) return;
      this.handleFix(location.coords, location.timestamp, this.streamType);
    }).then(sub => {
      if (gen !== this.watcherGen) {
        sub.remove();
        return;
      }
      this.watcher = sub;
      this.streamType = mode;
    });
  }

  private handleFix(
    coords: Location.LocationObjectCoords,
    coordsTimestamp: number,
    mode: StreamType
  ): void {
    const now = coordsTimestamp ?? Date.now();
    const accuracy = coords.accuracy ?? null;
    const maxAccuracy = mode === 'ride' ? RIDE_MAX_ACCURACY : IDLE_MAX_ACCURACY;

    if (accuracy !== null && accuracy > maxAccuracy) return;

    const next: DriverLocationFix = {
      latitude: coords.latitude,
      longitude: coords.longitude,
      heading: coords.heading ?? null,
      accuracy,
      speed: coords.speed ?? null,
      timestamp: now,
    };

    this.notify(next);

    if (!this.passesGate(next, mode)) return;

    const heading = next.heading ?? this.computeMovementHeading(next);
    this.lastEmitted = { latitude: next.latitude, longitude: next.longitude, ts: now };

    if (mode === 'ride' && this.rideId) {
      this.persistRideLocation(this.rideId, next);
      this.forwardSocket(this.rideId, next, heading);
    } else if (mode === 'idle') {
      this.forwardSocket(null, next, heading);
    }
  }

  private passesGate(fix: DriverLocationFix, mode: StreamType): boolean {
    if (this.lastEmitted === null) return true;

    const now = Date.now();
    if (now - fix.timestamp > 60_000) return false;

    const moved = haversineDistance(this.lastEmitted, fix);
    const minMove = mode === 'ride' ? RIDE_MIN_MOVE_METERS : IDLE_MIN_MOVE_METERS;
    const maxInterval = mode === 'ride' ? RIDE_MAX_INTERVAL_MS : IDLE_MAX_INTERVAL_MS;

    return moved >= minMove || now - this.lastEmitted.ts >= maxInterval;
  }

  private computeMovementHeading(fix: DriverLocationFix): number | null {
    if (!this.lastPosition) return null;
    const moved =
      this.lastPosition.latitude !== fix.latitude || this.lastPosition.longitude !== fix.longitude;
    if (!moved) return fix.heading ?? null;
    return bearingBetween(this.lastPosition, fix);
  }

  private persistRideLocation(rideId: string, fix: DriverLocationFix): void {
    rideAPI
      .updateLocation(rideId, fix.latitude, fix.longitude, fix.accuracy ?? undefined)
      .catch(() => {});
  }

  private forwardSocket(
    rideId: string | null,
    fix: DriverLocationFix,
    heading: number | null
  ): void {
    const socket = getSocket();
    if (!socket) return;

    if (socket.connected) {
      this.attachSocket(socket);
      this.flushBuffer(socket);
      socket.emit('driver:location_update', {
        rideId,
        latitude: fix.latitude,
        longitude: fix.longitude,
        heading: heading ?? fix.heading,
        accuracy: fix.accuracy,
        speed: fix.speed,
        timestamp: new Date(fix.timestamp).toISOString(),
      });
      return;
    }

    if (this.buffer.length >= BUFFER_MAX) {
      this.buffer.shift();
    }
    this.buffer.push({
      rideId,
      latitude: fix.latitude,
      longitude: fix.longitude,
      heading: heading ?? fix.heading,
      accuracy: fix.accuracy,
    });
  }

  private attachSocket(socket: any): void {
    if (this.socketAttached === socket) return;
    this.socketAttached = socket;
    socket.off('connect', this.handleConnect);
    socket.on('connect', this.handleConnect);
  }

  private handleConnect = (): void => {
    this.flushBuffer(getSocket());
  };

  private flushBuffer(socket: any): void {
    if (!socket || !socket.connected || this.buffer.length === 0) return;
    const buffered = this.buffer.splice(0, this.buffer.length);
    buffered.forEach(loc => {
      socket.emit('driver:location_update', {
        rideId: loc.rideId,
        latitude: loc.latitude,
        longitude: loc.longitude,
        heading: loc.heading,
        accuracy: loc.accuracy,
        timestamp: new Date().toISOString(),
      });
    });
  }

  private notify(fix: DriverLocationFix): void {
    this.lastPosition = fix;
    this.subscribers.forEach(cb => cb(fix));
  }
}

export const driverLocationService = new DriverLocationService();
