/**
 * UnifiedNotificationOverlay
 *
 * SINGLE global component that handles ALL in-app notifications.
 * Renders above every screen via React Native <Modal> + absolute positioning.
 *
 * Handles:
 *   - Ride request card (driver accept/reject with countdown)
 *   - Status banners (ride accepted, cancelled, completed, payment, etc.)
 *   - Toast notifications (slide-in from top, stacked)
 *
 * Design: Professional, glass-morphism, animated, follows app theme.
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  ScrollView,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useUnifiedNotifications,
  type NotificationType,
  type RideRequestData,
  type StatusNotification,
  type ToastItem,
} from '@/context/UnifiedNotificationContext';
import { rideAPI } from '@/services/api';
import { getSocket } from '@/services/socket';
import { Colors } from '@/constants/theme';
import { useExchangeRate } from '@/hooks/useExchangeRate';

// ─── Config per notification type ──────────────────────────────────────────────

interface NotificationConfig {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  bgColor: string;
  borderColor: string;
  accentColor: string;
}

const NOTIFICATION_CONFIG: Record<NotificationType, NotificationConfig> = {
  ride_request: {
    icon: 'car-sport',
    iconColor: '#22c55e',
    bgColor: '#f0fdf4',
    borderColor: '#bbf7d0',
    accentColor: '#16a34a',
  },
  ride_accepted: {
    icon: 'checkmark-circle',
    iconColor: '#22c55e',
    bgColor: '#f0fdf4',
    borderColor: '#bbf7d0',
    accentColor: '#16a34a',
  },
  ride_cancelled: {
    icon: 'close-circle',
    iconColor: '#ef4444',
    bgColor: '#fef2f2',
    borderColor: '#fecaca',
    accentColor: '#dc2626',
  },
  ride_started: {
    icon: 'play-circle',
    iconColor: '#3b82f6',
    bgColor: '#eff6ff',
    borderColor: '#bfdbfe',
    accentColor: '#2563eb',
  },
  ride_completed: {
    icon: 'flag',
    iconColor: '#22c55e',
    bgColor: '#f0fdf4',
    borderColor: '#bbf7d0',
    accentColor: '#16a34a',
  },
  driver_arrived: {
    icon: 'location',
    iconColor: '#f59e0b',
    bgColor: '#fffbeb',
    borderColor: '#fde68a',
    accentColor: '#d97706',
  },
  payment_completed: {
    icon: 'cash',
    iconColor: '#22c55e',
    bgColor: '#f0fdf4',
    borderColor: '#bbf7d0',
    accentColor: '#16a34a',
  },
  payment_failed: {
    icon: 'card',
    iconColor: '#ef4444',
    bgColor: '#fef2f2',
    borderColor: '#fecaca',
    accentColor: '#dc2626',
  },
  commission_credited: {
    icon: 'wallet',
    iconColor: '#8b5cf6',
    bgColor: '#f5f3ff',
    borderColor: '#ddd6fe',
    accentColor: '#7c3aed',
  },
  store_approved: {
    icon: 'storefront',
    iconColor: '#22c55e',
    bgColor: '#f0fdf4',
    borderColor: '#bbf7d0',
    accentColor: '#16a34a',
  },
  store_rejected: {
    icon: 'storefront',
    iconColor: '#ef4444',
    bgColor: '#fef2f2',
    borderColor: '#fecaca',
    accentColor: '#dc2626',
  },
  new_review: {
    icon: 'star',
    iconColor: '#f59e0b',
    bgColor: '#fffbeb',
    borderColor: '#fde68a',
    accentColor: '#d97706',
  },
  review_reply: {
    icon: 'chatbubble',
    iconColor: '#3b82f6',
    bgColor: '#eff6ff',
    borderColor: '#bfdbfe',
    accentColor: '#2563eb',
  },
  success: {
    icon: 'checkmark-circle',
    iconColor: '#22c55e',
    bgColor: '#f0fdf4',
    borderColor: '#bbf7d0',
    accentColor: '#16a34a',
  },
  warning: {
    icon: 'warning',
    iconColor: '#f59e0b',
    bgColor: '#fffbeb',
    borderColor: '#fde68a',
    accentColor: '#d97706',
  },
  error: {
    icon: 'alert-circle',
    iconColor: '#ef4444',
    bgColor: '#fef2f2',
    borderColor: '#fecaca',
    accentColor: '#dc2626',
  },
  info: {
    icon: 'information-circle',
    iconColor: '#3b82f6',
    bgColor: '#eff6ff',
    borderColor: '#bfdbfe',
    accentColor: '#2563eb',
  },
};

// ─── Ride Request Card (driver-side) ───────────────────────────────────────────

const STAR_FILLED = '★';
const STAR_EMPTY = '☆';

function renderStars(rating: number | undefined | null): string {
  const r = typeof rating === 'number' ? Math.round(rating) : 0;
  return STAR_FILLED.repeat(r) + STAR_EMPTY.repeat(Math.max(0, 5 - r));
}

function formatMinutes(minutes: number): string {
  if (!minutes) return '—';
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

const RideRequestCard: React.FC<{
  data: RideRequestData;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onExpire: () => void;
}> = ({ data, onAccept, onReject, onExpire }) => {
  const [secondsRemaining, setSecondsRemaining] = React.useState(
    Math.max(0, Math.ceil((new Date(data.expiresAt).getTime() - Date.now()) / 1000))
  );
  const progressAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const { convertToUsd, convertToBs } = useExchangeRate();

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 100, friction: 8 }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();

    const total = Math.max(1, Math.ceil((new Date(data.expiresAt).getTime() - Date.now()) / 1000));
    Animated.timing(progressAnim, {
      toValue: 0,
      duration: total * 1000,
      useNativeDriver: false,
    }).start();

    const interval = setInterval(() => {
      const remaining = Math.max(
        0,
        Math.ceil((new Date(data.expiresAt).getTime() - Date.now()) / 1000)
      );
      setSecondsRemaining(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        onExpire();
      }
    }, 500);
    return () => clearInterval(interval);
  }, [data.expiresAt, onExpire, opacityAnim, progressAnim, scaleAnim]);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const urgencyColor =
    secondsRemaining <= 5 ? '#ef4444' : secondsRemaining <= 15 ? '#f59e0b' : Colors.primary;

  return (
    <Animated.View
      style={[styles.rideCard, { transform: [{ scale: scaleAnim }], opacity: opacityAnim }]}
    >
      {/* Header */}
      <View style={styles.rideCardHeader}>
        <View style={[styles.rideIconCircle, { backgroundColor: '#f0fdf4' }]}>
          <Ionicons name="car-sport" size={26} color="#16a34a" />
        </View>
        <View style={styles.rideCardHeaderText}>
          <Text style={styles.rideCardTitle}>Solicitud de Viaje</Text>
          <View style={styles.timerRow}>
            <View style={styles.progressTrackCard}>
              <Animated.View
                style={[
                  styles.progressBarCard,
                  { width: progressWidth, backgroundColor: urgencyColor },
                ]}
              />
            </View>
            <Text
              style={[
                styles.countdownText,
                secondsRemaining <= 5 && { color: '#ef4444', fontWeight: '700' },
              ]}
            >
              {secondsRemaining}s
            </Text>
          </View>
        </View>
      </View>

      {/* Scrollable content */}
      <ScrollView
        style={styles.cardScroll}
        contentContainerStyle={styles.cardScrollContent}
        showsVerticalScrollIndicator={true}
        bounces={false}
      >
        {/* Passenger card with photo */}
        <View style={styles.passengerCard}>
          {data.passengerProfilePhoto ? (
            <Image source={{ uri: data.passengerProfilePhoto }} style={styles.passengerPhoto} />
          ) : (
            <View style={styles.passengerAvatar}>
              <Text style={styles.avatarText}>{(data.passengerName || 'P')[0].toUpperCase()}</Text>
            </View>
          )}
          <View style={styles.passengerInfo}>
            <Text style={styles.passengerName}>{data.passengerName || 'Pasajero'}</Text>
            <View style={styles.ratingRow}>
              <Text style={styles.starsText}>{renderStars(data.passengerRating || 0)}</Text>
              <Text style={styles.ratingValue}>
                {typeof data.passengerRating === 'number'
                  ? data.passengerRating.toFixed(1)
                  : 'Nuevo'}
              </Text>
            </View>
          </View>
        </View>

        {/* Route */}
        <View style={styles.sectionBlock}>
          <View style={styles.sectionHeader}>
            <Ionicons name="navigate" size={14} color="#6b7280" />
            <Text style={styles.sectionTitle}>Ruta</Text>
          </View>
          <View style={styles.routeItem}>
            <View style={styles.routeDotPickup} />
            <View style={styles.routeContent}>
              <Text style={styles.routeLabel}>Recogida</Text>
              <Text style={styles.routeAddress}>{data.pickupAddress}</Text>
            </View>
          </View>
          <View style={styles.routeLine} />
          <View style={styles.routeItem}>
            <View style={styles.routeDotDestination} />
            <View style={styles.routeContent}>
              <Text style={styles.routeLabel}>Destino</Text>
              <Text style={styles.routeAddress}>{data.destinationAddress}</Text>
            </View>
          </View>
        </View>

        {/* Trip details */}
        <View style={styles.sectionBlock}>
          <View style={styles.sectionHeader}>
            <Ionicons name="bar-chart" size={14} color="#6b7280" />
            <Text style={styles.sectionTitle}>Detalles</Text>
          </View>
          <View style={styles.detailGrid}>
            <View style={styles.detailGridCard}>
              <Text style={styles.detailGridValue}>
                {data.currency === 'USD'
                  ? `$ ${data.estimatedFare.toFixed(2)}`
                  : `Bs. ${data.estimatedFare.toFixed(2)}`}
              </Text>
              <Text style={styles.detailGridValueUsd}>
                {data.currency === 'USD'
                  ? `Bs. ${convertToBs(data.estimatedFare)}`
                  : `$ ${convertToUsd(data.estimatedFare)}`}
              </Text>
              <Text style={styles.detailGridLabel}>Tarifa est.</Text>
            </View>
            <View style={styles.detailGridCard}>
              <Text style={styles.detailGridValue}>
                {typeof data.distance === 'number' ? data.distance.toFixed(1) : '—'} km
              </Text>
              <Text style={styles.detailGridLabel}>Distancia</Text>
            </View>
            <View style={styles.detailGridCard}>
              <Text style={styles.detailGridValue}>
                {formatMinutes(data.estimatedDuration || 0)}
              </Text>
              <Text style={styles.detailGridLabel}>Duración est.</Text>
            </View>
            <View style={styles.detailGridCard}>
              <Text style={styles.detailGridValue}>🚕 {data.vehicleType || 'taxi'}</Text>
              <Text style={styles.detailGridLabel}>Vehículo</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Actions */}
      <View style={styles.rideCardActions}>
        <TouchableOpacity
          style={[styles.rideActionBtn, styles.rideRejectBtn]}
          onPress={() => onReject(data.id)}
          activeOpacity={0.8}
        >
          <Ionicons name="close" size={16} color="#dc2626" />
          <Text style={styles.rideRejectText}>Rechazar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.rideActionBtn, styles.rideAcceptBtn]}
          onPress={() => onAccept(data.id)}
          activeOpacity={0.8}
        >
          <Ionicons name="checkmark" size={16} color="#fff" />
          <Text style={styles.rideAcceptText}>Aceptar</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

// ─── Status Banner ─────────────────────────────────────────────────────────────

const StatusBanner: React.FC<{
  status: StatusNotification;
  onDismiss: () => void;
}> = ({ status, onDismiss }) => {
  const translateY = useRef(new Animated.Value(-120)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const config = NOTIFICATION_CONFIG[status.type] || NOTIFICATION_CONFIG.info;
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const animateOut = React.useCallback(() => {
    Animated.parallel([
      Animated.timing(translateY, { toValue: -120, duration: 300, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => onDismiss());
  }, [translateY, opacity, onDismiss]);

  useEffect(() => {
    // Slide-in animation
    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 90, friction: 10 }),
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();

    // Auto-dismiss
    dismissTimer.current = setTimeout(() => {
      animateOut();
    }, status.durationMs || 5000);

    return () => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
  }, [status.id, animateOut, opacity, status.durationMs, translateY]);

  return (
    <Animated.View
      style={[
        styles.statusContainer,
        {
          transform: [{ translateY }],
          opacity,
          borderLeftColor: config.accentColor,
          backgroundColor: config.bgColor,
        },
      ]}
    >
      <View style={styles.statusContent}>
        <View style={styles.statusHeaderRow}>
          <View style={[styles.statusIconCircle, { backgroundColor: config.accentColor + '20' }]}>
            <Ionicons name={config.icon} size={22} color={config.accentColor} />
          </View>
          <View style={styles.statusTitleContainer}>
            {status.title ? <Text style={styles.statusTitle} numberOfLines={1}>{status.title}</Text> : null}
          </View>
          <TouchableOpacity
            onPress={animateOut}
            style={styles.statusClose}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close" size={18} color="#9ca3af" />
          </TouchableOpacity>
        </View>
        <View style={styles.statusBodyRow}>
          <Text style={styles.statusMessage}>
            {status.message}
          </Text>
        </View>
        {status.action && (
          <TouchableOpacity
            style={[styles.statusActionBtn, { backgroundColor: config.accentColor }]}
            onPress={e => {
              e.stopPropagation();
              status.action?.onPress();
              onDismiss();
            }}
          >
            <Text style={styles.statusActionText}>{status.action.label}</Text>
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
};

// ─── Toast ─────────────────────────────────────────────────────────────────────

const ToastNotificationItem: React.FC<{
  toast: ToastItem;
  index: number;
  onDismiss: (id: string) => void;
}> = ({ toast, index, onDismiss }) => {
  const translateY = useRef(new Animated.Value(-80)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  const typeConfig = {
    success: { icon: 'checkmark-circle' as const, bg: '#16a34a', border: '#15803d' },
    warning: { icon: 'warning' as const, bg: '#d97706', border: '#b45309' },
    error: { icon: 'alert-circle' as const, bg: '#dc2626', border: '#b91c1c' },
    info: { icon: 'information-circle' as const, bg: '#2563eb', border: '#1d4ed8' },
  };
  const config = typeConfig[toast.type];

  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 80,
        friction: 10,
        delay: index * 60,
      }),
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();

    const t = setTimeout(() => {
      Animated.parallel([
        Animated.timing(translateY, { toValue: -80, duration: 250, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start(() => onDismiss(toast.id));
    }, toast.durationMs);

    return () => clearTimeout(t);
  }, [index, onDismiss, opacity, toast.durationMs, toast.id, translateY]);

  return (
    <Animated.View
      style={[
        styles.toastContainer,
        {
          transform: [{ translateY }],
          opacity,
          backgroundColor: config.bg,
          borderColor: config.border,
        },
      ]}
    >
      <View style={styles.toastContent}>
        <Ionicons name={config.icon} size={18} color="#fff" style={{ marginRight: 10 }} />
        <Text style={styles.toastMessage} numberOfLines={3}>
          {toast.message}
        </Text>
      </View>
      <TouchableOpacity
        onPress={() => onDismiss(toast.id)}
        style={styles.toastClose}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="close" size={16} color="rgba(255,255,255,0.8)" />
      </TouchableOpacity>
    </Animated.View>
  );
};

// ─── Main Overlay Component ────────────────────────────────────────────────────

export const UnifiedNotificationOverlay: React.FC = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    activeRideRequest,
    toastQueue,
    activeStatus,
    dismissRideRequest,
    dismissToast,
    dismissStatus,
    showToast,
  } = useUnifiedNotifications();

  const isVisible = !!activeRideRequest || toastQueue.length > 0 || !!activeStatus;

  // ── Ride Request handlers ─────────────────────────────────────────────────

  const handleAcceptRide = async (rideId: string) => {
    try {
      await rideAPI.acceptRide(rideId);
      dismissRideRequest();
      const socket = getSocket();
      if (socket) socket.emit('join_ride', { rideId });
      router.push({ pathname: '/(driver)/active-ride', params: { rideId } } as any);
    } catch (error: any) {
      dismissRideRequest();
      if (error?.response?.status === 409) {
        showToast('El viaje ya fue tomado por otro conductor', 'warning');
      } else {
        showToast('Error al aceptar el viaje. Intenta de nuevo.', 'error');
      }
    }
  };

  const handleRejectRide = async (rideId: string) => {
    try {
      await rideAPI.rejectRide(rideId);
    } catch {
      showToast('Error al rechazar el viaje', 'error');
    }
    dismissRideRequest();
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Modal
      visible={isVisible}
      transparent={true}
      animationType="none"
      statusBarTranslucent={true}
      presentationStyle="overFullScreen"
    >
      <View style={styles.overlay} pointerEvents="box-none">
        {/* Toast area — top of screen, stacked, below status bar */}
        {toastQueue.length > 0 && (
          <View style={[styles.toastArea, { paddingTop: insets.top }]} pointerEvents="box-none">
            {toastQueue.map((toast, idx) => (
              <ToastNotificationItem
                key={toast.id}
                toast={toast}
                index={idx}
                onDismiss={dismissToast}
              />
            ))}
          </View>
        )}

        {/* Status banner — top-center, below status bar */}
        {activeStatus && (
          <View style={[styles.statusArea, { paddingTop: insets.top }]} pointerEvents="box-none">
            <StatusBanner status={activeStatus} onDismiss={dismissStatus} />
          </View>
        )}

        {/* Ride request card — centered */}
        {activeRideRequest && (
          <View style={styles.rideCardArea}>
            <RideRequestCard
              data={activeRideRequest}
              onAccept={handleAcceptRide}
              onReject={handleRejectRide}
              onExpire={dismissRideRequest}
            />
          </View>
        )}
      </View>
    </Modal>
  );
};

export default UnifiedNotificationOverlay;

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },

  // ── Toast ─────────────────────────────────────────────────────────────────
  toastArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    paddingHorizontal: 12,
  },
  toastContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  toastContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  toastMessage: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  toastClose: {
    marginLeft: 10,
    padding: 4,
  },

  // ── Status Banner ─────────────────────────────────────────────────────────
  statusArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 90,
    paddingHorizontal: 12,
  },
  statusContainer: {
    borderRadius: 16,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
  },
  statusContent: {
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  statusHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  statusTitleContainer: {
    flex: 1,
  },
  statusBodyRow: {
    marginTop: 4,
    marginBottom: 4,
    marginLeft: 50, // align with title (icon width 40 + marginRight 10)
  },
  statusTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1f2937',
  },
  statusMessage: {
    fontSize: 14,
    color: '#4b5563',
    lineHeight: 20,
  },
  statusActionBtn: {
    alignSelf: 'flex-end',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginTop: 4,
  },
  statusActionText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  statusClose: {
    padding: 4,
    marginLeft: 4,
  },

  // ── Ride Request Card ─────────────────────────────────────────────────────
  rideCardArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  rideCard: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '88%',
    backgroundColor: '#fff',
    borderRadius: 24,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 20,
  },
  rideCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  rideIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rideCardHeaderText: {
    flex: 1,
  },
  rideCardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 6,
  },
  rideCardSubtitle: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressTrackCard: {
    flex: 1,
    height: 5,
    backgroundColor: '#e5e7eb',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarCard: {
    height: '100%',
    borderRadius: 3,
  },
  countdownText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
    minWidth: 32,
    textAlign: 'right',
  },
  progressTrack: {
    height: 5,
    backgroundColor: '#e5e7eb',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 20,
  },
  progressBar: {
    height: '100%',
    borderRadius: 3,
  },

  // ── Card Scroll ─────────────────────────────────────────────────────────
  cardScroll: {
    maxHeight: 340,
  },
  cardScrollContent: {
    paddingBottom: 8,
  },

  // ── Passenger ───────────────────────────────────────────────────────────
  passengerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
    gap: 12,
  },
  passengerPhoto: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#e5e7eb',
  },
  passengerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  passengerInfo: {
    flex: 1,
  },
  passengerName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 3,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  starsText: {
    fontSize: 15,
    color: '#F59E0B',
    letterSpacing: 1,
  },
  ratingValue: {
    fontSize: 12,
    color: '#6b7280',
  },

  // ── Route ───────────────────────────────────────────────────────────────
  sectionBlock: {
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  routeItem: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  routeDotPickup: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary,
    marginTop: 4,
  },
  routeDotDestination: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ef4444',
    marginTop: 4,
  },
  routeContent: {
    flex: 1,
  },
  routeLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 1,
  },
  routeAddress: {
    fontSize: 13,
    color: '#1f2937',
    lineHeight: 19,
  },
  routeLine: {
    width: 2,
    height: 14,
    backgroundColor: '#e5e7eb',
    marginLeft: 4,
    marginVertical: 3,
  },

  // ── Detail Grid ─────────────────────────────────────────────────────────
  detailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  detailGridCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
  },
  detailGridValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 1,
  },
  detailGridValueUsd: {
    fontSize: 12,
    color: '#16a34a',
    fontWeight: '600',
    marginBottom: 2,
  },
  detailGridLabel: {
    fontSize: 10,
    color: '#9ca3af',
    textAlign: 'center',
  },

  rideDetails: {
    marginBottom: 20,
    gap: 10,
  },
  rideDetailsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  detailLabel: {
    fontSize: 13,
    color: '#6b7280',
    marginRight: 4,
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 13,
    color: '#111827',
    fontWeight: '600',
    flex: 1,
  },
  rideCardActions: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 2,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  rideActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
  },
  rideRejectBtn: {
    backgroundColor: '#fef2f2',
    borderWidth: 2,
    borderColor: '#fecaca',
  },
  rideRejectText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#dc2626',
  },
  rideAcceptBtn: {
    backgroundColor: '#16a34a',
    shadowColor: '#16a34a',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  rideAcceptText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
});
