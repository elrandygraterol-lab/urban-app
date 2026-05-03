import * as Speech from 'expo-speech';

export function useTTS() {
  const speak = (text: string) => {
    try {
      Speech.stop();
      Speech.speak(text, { language: 'es-ES' });
    } catch (err) {
      console.warn('[useTTS] speak error:', err);
    }
  };

  const stop = () => {
    try {
      Speech.stop();
    } catch (err) {
      console.warn('[useTTS] stop error:', err);
    }
  };

  return { speak, stop };
}
