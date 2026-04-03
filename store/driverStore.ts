import { create } from 'zustand';

interface DriverState {
  isAvailable: boolean;
  isUpdatingAvailability: boolean;
  setIsAvailable: (isAvailable: boolean) => void;
  setIsUpdatingAvailability: (isUpdating: boolean) => void;
  toggleAvailability: () => Promise<void>;
}

export const useDriverStore = create<DriverState>((set, get) => ({
  isAvailable: false,
  isUpdatingAvailability: false,
  
  setIsAvailable: (isAvailable: boolean) => {
    console.log('[DRIVER STORE] Setting availability:', isAvailable);
    set({ isAvailable });
  },
  
  setIsUpdatingAvailability: (isUpdating: boolean) => {
    set({ isUpdatingAvailability: isUpdating });
  },
  
  toggleAvailability: async () => {
    const { isAvailable, isUpdatingAvailability } = get();
    
    if (isUpdatingAvailability) {
      console.log('[DRIVER STORE] Already updating, skipping...');
      return;
    }
    
    set({ isUpdatingAvailability: true });
    const newAvailability = !isAvailable;
    
    try {
      // Get location if going online
      let latitude: number | undefined;
      let longitude: number | undefined;
      
      if (newAvailability) {
        try {
          const Location = await import('expo-location');
          const { status } = await Location.requestForegroundPermissionsAsync();
          
          if (status === 'granted') {
            const currentLocation = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.High,
            });
            latitude = currentLocation.coords.latitude;
            longitude = currentLocation.coords.longitude;
            console.log('[DRIVER STORE] Location obtained:', { latitude, longitude });
          }
        } catch (locationError) {
          console.log('[DRIVER STORE] Could not get location:', locationError);
        }
      }
      
      // Update availability in backend
      const { driverAPI } = await import('@/services/api');
      await driverAPI.updateAvailability(newAvailability, latitude, longitude);
      
      // Update local state
      set({ isAvailable: newAvailability });
      
      console.log('[DRIVER STORE] Availability updated successfully:', newAvailability);
      
      // Show alert
      const { Alert } = await import('react-native');
      Alert.alert(
        newAvailability ? 'En Línea' : 'Fuera de Línea',
        newAvailability
          ? 'Ahora estás disponible para recibir solicitudes de viaje'
          : 'Ya no recibirás solicitudes de viaje'
      );
    } catch (error) {
      console.error('[DRIVER STORE] Error updating availability:', error);
      const { Alert } = await import('react-native');
      Alert.alert('Error', 'No se pudo actualizar la disponibilidad');
    } finally {
      set({ isUpdatingAvailability: false });
    }
  },
}));
