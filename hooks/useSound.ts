/**
 * useSound Hook
 * Hook personalizado para reproducir sonidos en la aplicación
 */

import { useEffect, useCallback } from 'react';
import { useAudioPlayer } from 'expo-audio';

const notificationSound = require('@/assets/sounds/avisar_usuarios.mp3');

export const useSound = () => {
  const player = useAudioPlayer(notificationSound);

  useEffect(() => {
    return () => {
      try {
        player.remove();
      } catch {
        // ignore cleanup errors
      }
    };
  }, []);

  const playNotificationSound = useCallback(async () => {
    try {
      if (player.playing) return;
      player.seekTo(0);
      player.play();
    } catch (error) {
      console.error('[SOUND] Error playing notification sound:', error);
    }
  }, [player]);

  return { playNotificationSound };
};
