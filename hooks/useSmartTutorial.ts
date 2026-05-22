import { useEffect, useState, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

type ScreenKey =
  | 'passenger_home'
  | 'passenger_history'
  | 'passenger_stores'
  | 'passenger_profile'
  | 'driver_home';

export function useSmartTutorial(screenKey: ScreenKey) {
  const [hasSeen, setHasSeen] = useState<boolean | null>(null);
  const [isActive, setIsActive] = useState(false);
  const wasChecked = useRef(false);

  useEffect(() => {
    const check = async () => {
      try {
        const value = await AsyncStorage.getItem(`@tutorial_${screenKey}`);
        if (value === null) {
          setHasSeen(false);
          setIsActive(true);
        } else {
          setHasSeen(true);
          setIsActive(false);
        }
      } catch {
        setHasSeen(true);
        setIsActive(false);
      }
      wasChecked.current = true;
    };
    check();
  }, [screenKey]);

  const markAsSeen = useCallback(async () => {
    try {
      await AsyncStorage.setItem(`@tutorial_${screenKey}`, 'true');
      setHasSeen(true);
      setIsActive(false);
    } catch {}
  }, [screenKey]);

  const resetTutorial = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(`@tutorial_${screenKey}`);
      setHasSeen(false);
      setIsActive(true);
    } catch {}
  }, [screenKey]);

  return { hasSeen, isActive, markAsSeen, resetTutorial, wasChecked: wasChecked.current };
}
