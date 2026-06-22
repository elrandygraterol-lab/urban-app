/**
 * Unified Notification Context
 *
 * Centralized notification system for ALL in-app notifications.
 * Replaces scattered native Alert.alert() calls and dual notification systems.
 *
 * Provides:
 *   - Ride request modal (driver accepts/rejects incoming rides)
 *   - Toast notifications (slide-in from top, auto-dismiss)
 *   - Status banners (ride accepted, cancelled, completed, payment, etc.)
 *
 * Usage from any component:
 *   const { showToast, showStatus, showRideRequest } = useUnifiedNotifications();
 *   showToast('Pago recibido', 'success');
 *   showStatus('ride_accepted', 'Tu viaje ha sido aceptado', '¡Juan P. aceptó!');
 */

import React, { createContext, useState, useContext, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type NotificationType =
  | 'ride_request'
  | 'ride_accepted'
  | 'ride_cancelled'
  | 'ride_started'
  | 'ride_completed'
  | 'driver_arrived'
  | 'payment_completed'
  | 'payment_failed'
  | 'commission_credited'
  | 'store_approved'
  | 'store_rejected'
  | 'new_review'
  | 'review_reply'
  | 'success'
  | 'warning'
  | 'error'
  | 'info';

export interface RideRequestData {
  id: string;
  passengerName: string;
  passengerRating: number;
  passengerProfilePhoto?: string;
  pickupAddress: string;
  destinationAddress: string;
  estimatedFare: number;
  currency?: string;
  distance: number;
  pickupDistance?: number;
  estimatedDuration: number;
  vehicleType: string;
  expiresAt: string; // ISO 8601
}

export interface ToastItem {
  id: string;
  message: string;
  type: 'success' | 'warning' | 'error' | 'info';
  durationMs: number;
}

export interface StatusNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  action?: {
    label: string;
    onPress: () => void;
  };
  durationMs?: number; // default: 5000
}

export interface ActionSheetOption {
  label: string;
  icon?: keyof typeof import('@expo/vector-icons').Ionicons.glyphMap;
  onPress: () => void;
  destructive?: boolean;
}

export interface ActionSheetState {
  id: string;
  title: string;
  message?: string;
  options: ActionSheetOption[];
}

export interface UnifiedNotificationState {
  /** Active ride request (driver-side) — shows accept/reject modal */
  activeRideRequest: RideRequestData | null;

  /** Toast queue (lightweight, top-of-screen) */
  toastQueue: ToastItem[];

  /** Active status banner (centered card with icon, title, message, optional action) */
  activeStatus: StatusNotification | null;

  /** Active action sheet (bottom sheet with multiple options) */
  activeActionSheet: ActionSheetState | null;
}

export interface UnifiedNotificationActions {
  showRideRequest: (data: RideRequestData) => void;
  dismissRideRequest: () => void;

  showToast: (message: string, type?: ToastItem['type'], durationMs?: number) => void;
  dismissToast: (id: string) => void;

  showStatus: (
    type: NotificationType,
    message: string,
    title?: string,
    data?: Record<string, unknown>,
    action?: StatusNotification['action'],
    durationMs?: number
  ) => void;
  dismissStatus: () => void;

  showActionSheet: (title: string, options: ActionSheetOption[], message?: string) => void;
  dismissActionSheet: () => void;

  /** Convenience: shows a quick success toast */
  showSuccess: (message: string, durationMs?: number) => void;
  /** Convenience: shows a quick error toast */
  showError: (message: string, durationMs?: number) => void;
  /** Convenience: shows a quick warning toast */
  showWarning: (message: string, durationMs?: number) => void;
  /** Convenience: shows a quick info toast */
  showInfo: (message: string, durationMs?: number) => void;
}

export type UnifiedNotificationContextValue = UnifiedNotificationState & UnifiedNotificationActions;

// ─── Context ───────────────────────────────────────────────────────────────────

export const UnifiedNotificationContext =
  createContext<UnifiedNotificationContextValue | null>(null);

// ─── Provider ──────────────────────────────────────────────────────────────────

export const UnifiedNotificationProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [activeRideRequest, setActiveRideRequest] = useState<RideRequestData | null>(null);
  const [toastQueue, setToastQueue] = useState<ToastItem[]>([]);
  const [activeStatus, setActiveStatus] = useState<StatusNotification | null>(null);
  const [activeActionSheet, setActiveActionSheet] = useState<ActionSheetState | null>(null);

  // ── Ride Request ──────────────────────────────────────────────────────────

  const showRideRequest = useCallback((data: RideRequestData) => {
    setActiveRideRequest((prev) => {
      if (prev?.id === data.id) return prev; // Deduplication
      return data;
    });
  }, []);

  const dismissRideRequest = useCallback(() => {
    setActiveRideRequest(null);
  }, []);

  // ── Toast ─────────────────────────────────────────────────────────────────

  const showToast = useCallback(
    (message: string, type: ToastItem['type'] = 'info', durationMs: number = 4000) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const toast: ToastItem = { id, message, type, durationMs };
      setToastQueue((prev) => [...prev, toast]);
    },
    []
  );

  const dismissToast = useCallback((id: string) => {
    setToastQueue((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // ── Status (banner) ───────────────────────────────────────────────────────

  const showStatus = useCallback(
    (
      type: NotificationType,
      message: string,
      title: string = '',
      data?: Record<string, unknown>,
      action?: StatusNotification['action'],
      durationMs: number = 5000
    ) => {
      const id = `status-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const status: StatusNotification = {
        id,
        type,
        title: title || getDefaultTitle(type),
        message,
        data,
        action,
        durationMs,
      };
      setActiveStatus(status);
    },
    []
  );

  const dismissStatus = useCallback(() => {
    setActiveStatus(null);
  }, []);

  // ── Action Sheet ──────────────────────────────────────────────────────────

  const showActionSheet = useCallback(
    (title: string, options: ActionSheetOption[], message?: string) => {
      const id = `as-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      setActiveActionSheet({ id, title, message, options });
    },
    []
  );

  const dismissActionSheet = useCallback(() => {
    setActiveActionSheet(null);
  }, []);

  // ── Convenience ───────────────────────────────────────────────────────────

  const showSuccess = useCallback((message: string, durationMs?: number) => {
    showToast(message, 'success', durationMs);
  }, [showToast]);

  const showError = useCallback((message: string, durationMs?: number) => {
    showToast(message, 'error', durationMs);
  }, [showToast]);

  const showWarning = useCallback((message: string, durationMs?: number) => {
    showToast(message, 'warning', durationMs);
  }, [showToast]);

  const showInfo = useCallback((message: string, durationMs?: number) => {
    showToast(message, 'info', durationMs);
  }, [showToast]);

  // ── Provider value ────────────────────────────────────────────────────────

  const value: UnifiedNotificationContextValue = {
    activeRideRequest,
    toastQueue,
    activeStatus,
    activeActionSheet,
    showRideRequest,
    dismissRideRequest,
    showToast,
    dismissToast,
    showStatus,
    dismissStatus,
    showActionSheet,
    dismissActionSheet,
    showSuccess,
    showError,
    showWarning,
    showInfo,
  };

  return (
    <UnifiedNotificationContext.Provider value={value}>
      {children}
    </UnifiedNotificationContext.Provider>
  );
};

// ─── Hook ──────────────────────────────────────────────────────────────────────

export const useUnifiedNotifications = (): UnifiedNotificationContextValue => {
  const ctx = useContext(UnifiedNotificationContext);
  if (!ctx) {
    throw new Error(
      'useUnifiedNotifications must be used within <UnifiedNotificationProvider>. ' +
        'Wrap your root layout with it.'
    );
  }
  return ctx;
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function getDefaultTitle(type: NotificationType): string {
  switch (type) {
    case 'ride_accepted':     return 'Viaje Aceptado';
    case 'ride_cancelled':    return 'Viaje Cancelado';
    case 'ride_started':      return 'Viaje Iniciado';
    case 'ride_completed':    return 'Viaje Completado';
    case 'driver_arrived':    return 'Conductor Ha Llegado';
    case 'payment_completed': return 'Pago Completado';
    case 'payment_failed':    return 'Pago Fallido';
    case 'commission_credited': return 'Comision Acreditada';
    case 'store_approved':    return 'Tienda Aprobada';
    case 'store_rejected':    return 'Tienda Rechazada';
    case 'new_review':        return 'Nueva Resena';
    case 'review_reply':      return 'Respuesta a Resena';
    case 'success':           return 'Exito';
    case 'warning':           return '⚠️ Atención';
    case 'error':             return '❌ Error';
    case 'info':              return 'ℹ️ Información';
    case 'ride_request':      return '🚗 Nueva Solicitud';
    default:                  return '';
  }
}
