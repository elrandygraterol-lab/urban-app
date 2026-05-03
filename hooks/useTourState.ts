import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const useTourState = (tourKey: string) => {
  const [hasSeenTour, setHasSeenTour] = useState<boolean | null>(null);

  useEffect(() => {
    const checkTourState = async () => {
      try {
        const value = await AsyncStorage.getItem(`@tour_${tourKey}`);
        if (value !== null) {
          setHasSeenTour(true);
        } else {
          setHasSeenTour(false);
        }
      } catch (error) {
        console.error('Error checking tour state:', error);
        setHasSeenTour(true); // Fallback to true to avoid annoying users if storage fails
      }
    };

    checkTourState();
  }, [tourKey]);

  const markTourAsSeen = async () => {
    try {
      await AsyncStorage.setItem(`@tour_${tourKey}`, 'true');
      setHasSeenTour(true);
    } catch (error) {
      console.error('Error saving tour state:', error);
    }
  };

  // Useful for debugging
  const resetTour = async () => {
    try {
      await AsyncStorage.removeItem(`@tour_${tourKey}`);
      setHasSeenTour(false);
    } catch (error) {
      console.error('Error resetting tour state:', error);
    }
  };

  return { hasSeenTour, markTourAsSeen, resetTour };
};
