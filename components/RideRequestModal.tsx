import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { RideRequestData } from '@/context/NotificationContext';
import { computeSecondsRemaining } from '@/utils/notificationUtils';
import { Colors } from '@/constants/theme';

interface RideRequestModalProps {
  data: RideRequestData;
  onAccept: (rideId: string) => void;
  onReject: (rideId: string) => void;
  onExpire: () => void;
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

    // Animate progress bar from 1.0 → 0.0 over the total duration
    Animated.timing(progressAnim, {
      toValue: 0,
      duration: total * 1000,
      useNativeDriver: false,
    }).start();

    const interval = setInterval(() => {
      const remaining = computeSecondsRemaining(data.expiresAt);
      setSecondsRemaining(remaining);
      if (remaining === 0) {
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
      <Text style={styles.title}>🚗 Nueva Solicitud de Viaje</Text>

      {/* Timer progress bar */}
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
      <Text style={styles.countdown}>{secondsRemaining}s</Text>

      {/* Ride details */}
      <View style={styles.detailsContainer}>
        <DetailRow label="Pasajero" value={data.passengerName} />
        <DetailRow label="Recogida" value={data.pickupAddress} />
        <DetailRow label="Destino" value={data.destinationAddress} />
        <DetailRow label="Tarifa estimada" value={`Bs. ${data.estimatedFare.toFixed(2)}`} />
        <DetailRow label="Distancia" value={`${data.distance.toFixed(1)} km`} />
      </View>

      {/* Action buttons */}
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

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}:</Text>
      <Text style={styles.detailValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.darkGray,
    marginBottom: 12,
    textAlign: 'center',
  },
  progressTrack: {
    height: 6,
    backgroundColor: Colors.border,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressBar: {
    height: '100%',
    borderRadius: 3,
  },
  countdown: {
    fontSize: 12,
    color: Colors.mediumGray,
    textAlign: 'right',
    marginBottom: 16,
  },
  detailsContainer: {
    marginBottom: 20,
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.mediumGray,
    minWidth: 110,
  },
  detailValue: {
    fontSize: 14,
    color: Colors.darkGray,
    flex: 1,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
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
