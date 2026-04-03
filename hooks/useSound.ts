/**
 * useSound Hook
 * Hook personalizado para reproducir sonidos en la aplicación
 * Compatible con Expo Go (mock) y Development/Production builds (real audio)
 */

import { useEffect, useRef } from 'react';
import Constants from 'expo-constants';

// Importación condicional de expo-av
let Audio: any = null;
try {
  Audio = require('expo-av').Audio;
} catch (error) {
  console.log('[SOUND] expo-av not available (Expo Go mode)');
}

export const useSound = () => {
  const soundRef = useRef<any>(null);
  const isExpoGo = Constants.appOwnership === 'expo';

  useEffect(() => {
    // Solo configurar audio si no estamos en Expo Go y Audio está disponible
    if (!isExpoGo && Audio) {
      const setupAudio = async () => {
        try {
          await Audio.setAudioModeAsync({
            playsInSilentModeIOS: true,
            staysActiveInBackground: false,
            shouldDuckAndroid: true,
          });
        } catch (error) {
          console.error('[SOUND] Error setting audio mode:', error);
        }
      };

      setupAudio();
    }

    // Cleanup al desmontar
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, [isExpoGo]);

  const playNotificationSound = async () => {
    // Si estamos en Expo Go o Audio no está disponible, solo loguear
    if (isExpoGo || !Audio) {
      console.log('[SOUND] 🔇 Mock mode - Sound would play in native build');
      console.log('[SOUND] ℹ️  Build with EAS to enable audio: npm run build:dev:android');
      return;
    }

    try {
      console.log('[SOUND] Playing notification sound...');

      // Si ya hay un sonido cargado, descargarlo primero
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }

      // Cargar y reproducir el sonido
      const { sound } = await Audio.Sound.createAsync(
        require('@/assets/sounds/avisar_usuarios.mp3'),
        { shouldPlay: true, volume: 1.0 }
      );

      soundRef.current = sound;

      // Descargar el sonido cuando termine de reproducirse
      sound.setOnPlaybackStatusUpdate((status: any) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync();
          soundRef.current = null;
        }
      });

      console.log('[SOUND] ✅ Notification sound played');
    } catch (error) {
      console.error('[SOUND] Error playing notification sound:', error);
    }
  };

  return { playNotificationSound };
};
