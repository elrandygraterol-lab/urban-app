import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { RideRequestData } from '@/context/NotificationContext';
import { computeSecondsRemaining } from '@/utils/notificationUtils';
import { formatCurrency, Currency } from '@/utils/currency';
import { Colors } from '@/constants/theme';

interface RideRequestModalProps {
  data: RideRequestData;
  onAccept: (rideId: string) => void;
  onReject: (rideId: string) => void;
  onExpire: () => void;
}

const STAR_FILLED = '★';
const STAR_EMPTY = '☆';

function renderStars(rating: number): string {
  const full = Math.round(rating);
  return STAR_FILLED.repeat(full) + STAR_EMPTY.repeat(Math.max(0, 5 - full));
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

export default function RideRequestModal({
  data,
  onAccept,
  onReject,
  onExpire,
}: RideRequestModalProps) {
  const totalSeconds = useRef(computeSecondsRemaining(data.expiresAt));
  const [secondsRemaining, setSecondsRemaining] = useState(
    computeSecondsRemaining(data.expiresAt)
  );
  const progressAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const total = totalSeconds.current;

    Animated.timing(progressAnim, {
      toValue: 0,
      duration: total * 1000,
      useNativeDriver: false,
    }).start();

    const interval = setInterval(() => {
      const remaining = computeSecondsRemaining(data.expiresAt);
      setSecondsRemaining(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        onExpire();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [data.expiresAt]);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.container}>
      {/* ── Header ──────────────────────────────────────────────── */}
      <View style={styles.header}>
        <Text style={styles.title}>🚗 Nueva Solicitud de Viaje</Text>
        {/* Timer */}
        <View style={styles.timerRow}>
          <View style={styles.progressTrack}>
            <Animated.View
              style={[
                styles.progressBar,
                {
                  width: progressWidth,
                  backgroundColor:
                    secondsRemaining <= 5 ? Colors.error : Colors.primary,
                },
              ]}
            />
          </View>
          <Text
            style={[
              styles.countdown,
              secondsRemaining <= 5 && { color: Colors.error, fontWeight: '700' },
            ]}
          >
            {secondsRemaining}s
          </Text>
        </View>
      </View>

      {/* ── Scrollable Content ───────────────────────────────────── */}
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
        bounces={false}
      >
        {/* ── Passenger Card ──────────────────────────────────── */}
        <View style={styles.passengerCard}>
          {data.passengerProfilePhoto ? (
            <Image
              source={{ uri: data.passengerProfilePhoto }}
              style={styles.passengerPhoto}
            />
          ) : (
            <View style={styles.passengerAvatar}>
              <Text style={styles.avatarText}>
                {(data.passengerName || 'P')[0].toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.passengerInfo}>
            <Text style={styles.passengerName}>{data.passengerName || 'Pasajero'}</Text>
            <View style={styles.ratingRow}>
              <Text style={styles.stars}>
                {renderStars(data.passengerRating || 0)}
              </Text>
              <Text style={styles.ratingText}>
                {data.passengerRating ? data.passengerRating.toFixed(1) : 'Nuevo'}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Route Section ───────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📍 Ruta</Text>

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

        {/* ── Trip Details Section ─────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📊 Detalles del Viaje</Text>

          <View style={styles.detailGrid}>
            <View style={styles.detailCard}>
              <Text style={styles.detailCardValue}>
                Bs. {data.estimatedFare.toFixed(2)}
              </Text>
              <Text style={styles.detailCardLabel}>Tarifa estimada</Text>
            </View>

            <View style={styles.detailCard}>
              <Text style={styles.detailCardValue}>
                {data.distance.toFixed(1)} km
              </Text>
              <Text style={styles.detailCardLabel}>Distancia</Text>
            </View>

            <View style={styles.detailCard}>
              <Text style={styles.detailCardValue}>
                {data.estimatedDuration ? formatMinutes(data.estimatedDuration) : '—'}
              </Text>
              <Text style={styles.detailCardLabel}>Duración est.</Text>
            </View>

            <View style={styles.detailCard}>
              <Text style={styles.detailCardValue}>
                {data.vehicleType === 'taxi' ? '🚕' : '🚗'} {data.vehicleType || 'taxi'}
              </Text>
              <Text style={styles.detailCardLabel}>Vehículo</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* ── Action Buttons ──────────────────────────────────────── */}
      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[styles.button, styles.rejectButton]}
          onPress={() => onReject(data.id)}
          activeOpacity={0.8}
        >
          <Text style={styles.rejectButtonText}>Rechazar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.acceptButton]}
          onPress={() => onAccept(data.id)}
          activeOpacity={0.8}
        >
          <Text style={styles.acceptButtonText}>Aceptar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    marginHorizontal: 16,
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 12,
  },

  // ── Header ──────────────────────────────────────────────────
  header: {
    padding: 20,
    paddingBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.darkGray,
    textAlign: 'center',
    marginBottom: 12,
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  progressTrack: {
    flex: 1,
    height: 6,
    backgroundColor: Colors.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 3,
  },
  countdown: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.mediumGray,
    minWidth: 36,
    textAlign: 'right',
  },

  // ── Scroll ──────────────────────────────────────────────────
  scrollArea: {
    maxHeight: 320,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },

  // ── Passenger Card ──────────────────────────────────────────
  passengerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    gap: 14,
  },
  passengerPhoto: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.border,
  },
  passengerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: Colors.white,
    fontSize: 20,
    fontWeight: '700',
  },
  passengerInfo: {
    flex: 1,
  },
  passengerName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.darkGray,
    marginBottom: 4,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stars: {
    fontSize: 16,
    color: '#F59E0B',
    letterSpacing: 1,
  },
  ratingText: {
    fontSize: 13,
    color: Colors.mediumGray,
  },

  // ── Route Section ───────────────────────────────────────────
  section: {
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.mediumGray,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  routeItem: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  routeDotPickup: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.primary,
    marginTop: 3,
  },
  routeDotDestination: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.error,
    marginTop: 3,
  },
  routeContent: {
    flex: 1,
  },
  routeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.mediumGray,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  routeAddress: {
    fontSize: 14,
    color: Colors.darkGray,
    lineHeight: 21,
  },
  routeLine: {
    width: 2,
    height: 20,
    backgroundColor: Colors.border,
    marginLeft: 5,
    marginVertical: 4,
  },

  // ── Detail Grid ─────────────────────────────────────────────
  detailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  detailCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  detailCardValue: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.darkGray,
    marginBottom: 2,
  },
  detailCardLabel: {
    fontSize: 11,
    color: Colors.mediumGray,
    textAlign: 'center',
  },

  // ── Buttons ─────────────────────────────────────────────────
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  acceptButton: {
    backgroundColor: Colors.primary,
  },
  acceptButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  rejectButton: {
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.error,
  },
  rejectButtonText: {
    color: Colors.error,
    fontSize: 16,
    fontWeight: '700',
  },
});
