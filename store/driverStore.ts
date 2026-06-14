import { create } from 'zustand';
import { Currency } from '@/utils/currency';

interface Transaction {
  id: string;
  amount: number;
  currency: Currency;
  type: 'credit' | 'debit';
  description: string;
  date: string;
  rideId?: string;
}

interface DriverState {
  isAvailable: boolean;
  isUpdatingAvailability: boolean;
  // Wallet State
  balanceVES: number;
  balanceUSD: number;
  transactions: Transaction[];
  // Actions
  setIsAvailable: (isAvailable: boolean) => void;
  setIsUpdatingAvailability: (isUpdating: boolean) => void;
  toggleAvailability: () => Promise<{ success: boolean; newAvailability: boolean; error?: string }>;
  // Wallet Actions
  addEarning: (amount: number, currency: Currency, rideId?: string, description?: string) => void;
  fetchWalletData: () => Promise<void>;
}

export const useDriverStore = create<DriverState>((set, get) => ({
  isAvailable: false,
  isUpdatingAvailability: false,
  // Initial Wallet State
  balanceVES: 0,
  balanceUSD: 0,
  transactions: [],
  
  setIsAvailable: (isAvailable: boolean) => {
    console.log('[DRIVER STORE] Setting availability:', isAvailable);
    set({ isAvailable });
  },
  
  setIsUpdatingAvailability: (isUpdating: boolean) => {
    set({ isUpdatingAvailability: isUpdating });
  },

  addEarning: (amount: number, currency: Currency, rideId?: string, description?: string) => {
    const { balanceVES, balanceUSD, transactions } = get();
    
    const newTransaction: Transaction = {
      id: Math.random().toString(36).substr(2, 9),
      amount,
      currency,
      type: 'credit',
      description: description || `Viaje completado ${rideId ? `#${rideId.slice(-4)}` : ''}`,
      date: new Date().toISOString(),
      rideId,
    };

    if (currency === 'VES') {
      set({ 
        balanceVES: balanceVES + amount,
        transactions: [newTransaction, ...transactions]
      });
    } else {
      set({ 
        balanceUSD: balanceUSD + amount,
        transactions: [newTransaction, ...transactions]
      });
    }
  },

  fetchWalletData: async () => {
    // In a real app, this would fetch from the API
    // For now, we'll simulate it or just keep the local state
    console.log('[DRIVER STORE] Fetching wallet data...');
  },
  
  toggleAvailability: async (): Promise<{ success: boolean; newAvailability: boolean; error?: string }> => {
    const { isAvailable, isUpdatingAvailability } = get();
    
    if (isUpdatingAvailability) {
      console.log('[DRIVER STORE] Already updating, skipping...');
      return { success: false, newAvailability: isAvailable, error: 'already_updating' };
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
      
      return { success: true, newAvailability };
    } catch (error) {
      console.error('[DRIVER STORE] Error updating availability:', error);
      return { success: false, newAvailability: isAvailable, error: 'update_failed' };
    } finally {
      set({ isUpdatingAvailability: false });
    }
  },
}));
