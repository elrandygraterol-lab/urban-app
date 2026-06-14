import * as Speech from 'expo-speech';
import { useCallback } from 'react';

export function useTTS() {
  const speak = useCallback((text: string) => {
    try {
      Speech.stop();
      Speech.speak(text, { language: 'es-ES' });
    } catch (err) {
      console.warn('[useTTS] speak error:', err);
    }
  }, []);

  const stop = useCallback(() => {
    try {
      Speech.stop();
    } catch (err) {
      console.warn('[useTTS] stop error:', err);
    }
  }, []);

  return { speak, stop };
}
