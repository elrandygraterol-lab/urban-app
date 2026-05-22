import AsyncStorage from '@react-native-async-storage/async-storage';

type ScreenKey =
  | 'passenger_home'
  | 'passenger_history'
  | 'passenger_stores'
  | 'passenger_profile'
  | 'driver_home';

let _activeScreen: ScreenKey | null = null;

export function setActiveTutorialScreen(screen: ScreenKey | null) {
  _activeScreen = screen;
}

export function getActiveTutorialScreen(): ScreenKey | null {
  return _activeScreen;
}

export async function markTutorialAsSeen(screen: ScreenKey) {
  try {
    await AsyncStorage.setItem(`@tutorial_${screen}`, 'true');
  } catch {}
}

export async function handleTourEnd() {
  if (_activeScreen) {
    await markTutorialAsSeen(_activeScreen);
    _activeScreen = null;
  }
}
