import React, { createContext, useState, useContext } from 'react';

export interface RideRequestData {
  id: string;
  passengerName: string;
  pickupAddress: string;
  destinationAddress: string;
  estimatedFare: number;
  distance: number;
  expiresAt: string; // ISO 8601
}

export interface ToastData {
  id: string;
  message: string;
  type: 'success' | 'info' | 'warning' | 'error';
  durationMs: number; // mínimo 4000ms
}

export interface NotificationContextValue {
  activeRideRequest: RideRequestData | null;
  toastQueue: ToastData[];
  showRideRequest: (data: RideRequestData) => void;
  dismissRideRequest: () => void;
  showToast: (message: string, type: ToastData['type'], durationMs?: number) => void;
  dismissToast: (id: string) => void;
}

export const NotificationContext = createContext<NotificationContextValue | null>(null);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeRideRequest, setActiveRideRequest] = useState<RideRequestData | null>(null);
  const [toastQueue, setToastQueue] = useState<ToastData[]>([]);

  const showRideRequest = (data: RideRequestData) => {
    // Deduplicación: ignorar si ya hay un modal activo con el mismo id
    if (activeRideRequest?.id === data.id) return;
    setActiveRideRequest(data);
  };

  const dismissRideRequest = () => {
    setActiveRideRequest(null);
  };

  const showToast = (message: string, type: ToastData['type'], durationMs: number = 4000) => {
    const id = Date.now().toString();
    const toast: ToastData = { id, message, type, durationMs };
    setToastQueue((prev) => [...prev, toast]);
  };

  const dismissToast = (id: string) => {
    setToastQueue((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <NotificationContext.Provider
      value={{ activeRideRequest, toastQueue, showRideRequest, dismissRideRequest, showToast, dismissToast }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotificationContext = (): NotificationContextValue => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error(
      'useNotificationContext must be used within a NotificationProvider.'
    );
  }
  return context;
};
