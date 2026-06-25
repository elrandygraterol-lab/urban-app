import type * as Location from 'expo-location';

let _Location: typeof Location | null = null;

export async function getLocation(): Promise<typeof Location> {
  if (!_Location) {
    _Location = await import('expo-location');
  }
  return _Location;
}
