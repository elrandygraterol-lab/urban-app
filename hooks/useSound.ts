/**
 * useSound Hook
 * Hook personalizado para reproducir sonidos en la aplicación
 * Usa expo-audio (reemplaza expo-av deprecado en SDK 54)
 */

import { useEffect, useCallback } from 'react';
import { useAudioPlayer } from 'expo-audio';

const notificationSound = require('@/assets/sounds/avisar_usuarios.mp3');

export const useSound = () => {
  const player = useAudioPlayer(notificationSound);

  useEffect(() => {
    return () => {
      // Cleanup: release the player on unmount
      try {
        player.remove();
      } catch {
        // ignore cleanup errors
      }
    };
  }, []);

  const playNotificationSound = useCallback(async () => {
    try {
      // Seek to start in case it was played before
      player.seekTo(0);
      player.play();
      console.log('[SOUND] ✅ Notification sound played');
    } catch (error) {
      console.error('[SOUND] Error playing notification sound:', error);
    }
  }, [player]);

  return { playNotificationSound };
};
