import * as Speech from 'expo-speech';
import { useCallback, useRef } from 'react';

export function useTTS() {
  const speakingRef = useRef(false);

  const speak = useCallback((text: string) => {
    if (speakingRef.current) {
      console.log('[useTTS] Already speaking, skipping:', text);
      return;
    }
    speakingRef.current = true;
    try {
      Speech.stop();
      setTimeout(() => {
        Speech.speak(text, {
          language: 'es-ES',
          onDone: () => { speakingRef.current = false; },
          onError: () => { speakingRef.current = false; },
        });
      }, 100);
    } catch (err) {
      console.warn('[useTTS] speak error:', err);
      speakingRef.current = false;
    }
  }, []);

  const stop = useCallback(() => {
    try {
      Speech.stop();
      speakingRef.current = false;
    } catch (err) {
      console.warn('[useTTS] stop error:', err);
    }
  }, []);

  return { speak, stop };
}
