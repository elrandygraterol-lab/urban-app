import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  ScrollView,
  Alert,
} from 'react-native';
import { rideAPI, paymentAPI } from '@/services/api';

interface PaymentScreenProps {
  visible: boolean;
  rideId: string;
  onClose: () => void;
}

interface RideDetails {
  id: string;
  pickupAddress: string;
  destinationAddress: string;
  actualDurationMinutes: number;
  actualDistanceKm: number;
  finalFare: number;
  fareBreakdown: {
    baseFare: number;
    perKmRate: number;
    perMinuteRate: number;
    distance: number;
    duration: number;
  };
  paymentMethodId: string;
  driver: {
    name: string;
  };
}

export default function PaymentScreen({ visible, rideId, onClose }: PaymentScreenProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentCompleted, setPaymentCompleted] = useState(false);
  const [rideDetails, setRideDetails] = useState<RideDetails | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible && rideId) {
      loadRideDetails();
    }
  }, [visible, rideId]);

  const loadRideDetails = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await rideAPI.getRide(rideId);
      const ride = response.data.ride;

      setRideDetails({
        id: ride.id,
        pickupAddress: ride.pickupAddress,
        destinationAddress: ride.destinationAddress,
        actualDurationMinutes: ride.actualDurationMinutes || 0,
        actualDistanceKm: ride.actualDistanceKm || 0,
        finalFare: ride.finalFare || 0,
        fareBreakdown: {
          baseFare: ride.fareBreakdown?.baseFare || 0,
          perKmRate: ride.fareBreakdown?.perKmRate || 0,
          perMinuteRate: ride.fareBreakdown?.perMinuteRate || 0,
          distance: ride.actualDistanceKm || 0,
          duration: ride.actualDurationMinutes || 0,
        },
        paymentMethodId: ride.paymentMethodId || 'cash',
        driver: {
          name: ride.driver?.name || 'Conductor',
        },
      });

      // Si el método de pago NO es efectivo, procesar automáticamente
      if (ride.paymentMethodId && ride.paymentMethodId !== 'cash') {
        await processPaymentAutomatically(ride.paymentMethodId);
      }

      setIsLoading(false);
    } catch (error: any) {
      console.error('Error loading ride details:', error);
      setError('No se pudieron cargar los detalles del viaje');
      setIsLoading(false);
    }
  };

  const processPaymentAutomatically = async (paymentMethodId: string) => {
    setIsProcessingPayment(true);

    try {
      await paymentAPI.processPayment(rideId, paymentMethodId);
      setPaymentCompleted(true);
      setIsProcessingPayment(false);
    } catch (error: any) {
      console.error('Error processing payment:', error);
      setIsProcessingPayment(false);
      setError(
        error.response?.data?.error?.message ||
          'Error al procesar el pago. Por favor intenta nuevamente.'
      );
    }
  };

  const handleRetryPayment = async () => {
    if (!rideDetails) return;

    setError(null);
    await processPaymentAutomatically(rideDetails.paymentMethodId);
  };

  const handleClose = () => {
    // Reset state
    setIsLoading(true);
    setIsProcessingPayment(false);
    setPaymentCompleted(false);
    setRideDetails(null);
    setError(null);

    onClose();
  };

  const getPaymentMethodLabel = (methodId: string): string => {
    if (methodId === 'cash') return 'Efectivo';
    if (methodId.includes('card')) return 'Tarjeta';
    if (methodId.includes('wallet')) return 'Billetera Digital';
    return 'Método de Pago';
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={handleClose}>
      <View style={styles.container}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#22c55e" />
            <Text style={styles.loadingText}>Cargando detalles del viaje...</Text>
          </View>
        ) : (
          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.headerIcon}>✅</Text>
              <Text style={styles.headerTitle}>Viaje Completado</Text>
              <Text style={styles.headerSubtitle}>¡Gracias por viajar con UrbanTaxi!</Text>
            </View>

            {/* Ride Summary */}
            {rideDetails && (
              <>
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Resumen del Viaje</Text>

                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>🟢 Origen:</Text>
                    <Text style={styles.summaryValue}>{rideDetails.pickupAddress}</Text>
                  </View>

                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>🔴 Destino:</Text>
                    <Text style={styles.summaryValue}>{rideDetails.destinationAddress}</Text>
                  </View>

                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>⏱️ Duración:</Text>
                    <Text style={styles.summaryValue}>
                      {rideDetails.actualDurationMinutes} minutos
                    </Text>
                  </View>

                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>📍 Distancia:</Text>
                    <Text style={styles.summaryValue}>
                      {rideDetails.actualDistanceKm.toFixed(2)} km
                    </Text>
                  </View>

                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>🚗 Conductor:</Text>
                    <Text style={styles.summaryValue}>{rideDetails.driver.name}</Text>
                  </View>
                </View>

                {/* Fare Breakdown */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Desglose de Tarifa</Text>

                  <View style={styles.fareRow}>
                    <Text style={styles.fareLabel}>Tarifa base:</Text>
                    <Text style={styles.fareValue}>
                      Bs. {rideDetails.fareBreakdown.baseFare.toFixed(2)}
                    </Text>
                  </View>

                  <View style={styles.fareRow}>
                    <Text style={styles.fareLabel}>
                      Por km (Bs. {rideDetails.fareBreakdown.perKmRate.toFixed(2)} ×{' '}
                      {rideDetails.fareBreakdown.distance.toFixed(2)} km):
                    </Text>
                    <Text style={styles.fareValue}>
                      Bs.{' '}
                      {(
                        rideDetails.fareBreakdown.perKmRate * rideDetails.fareBreakdown.distance
                      ).toFixed(2)}
                    </Text>
                  </View>

                  <View style={styles.fareRow}>
                    <Text style={styles.fareLabel}>
                      Por minuto (Bs. {rideDetails.fareBreakdown.perMinuteRate.toFixed(2)} ×{' '}
                      {rideDetails.fareBreakdown.duration} min):
                    </Text>
                    <Text style={styles.fareValue}>
                      Bs.{' '}
                      {(
                        rideDetails.fareBreakdown.perMinuteRate * rideDetails.fareBreakdown.duration
                      ).toFixed(2)}
                    </Text>
                  </View>

                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Total:</Text>
                    <Text style={styles.totalValue}>Bs. {rideDetails.finalFare.toFixed(2)}</Text>
                  </View>
                </View>

                {/* Payment Method */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Método de Pago</Text>

                  <View style={styles.paymentMethodCard}>
                    <Text style={styles.paymentMethodIcon}>💳</Text>
                    <Text style={styles.paymentMethodText}>
                      {getPaymentMethodLabel(rideDetails.paymentMethodId)}
                    </Text>
                  </View>

                  {/* Cash Payment Message */}
                  {rideDetails.paymentMethodId === 'cash' && (
                    <View style={styles.cashMessageContainer}>
                      <Text style={styles.cashMessageIcon}>💵</Text>
                      <Text style={styles.cashMessageText}>Paga al conductor en efectivo</Text>
                    </View>
                  )}

                  {/* Card/Wallet Payment Processing */}
                  {rideDetails.paymentMethodId !== 'cash' && (
                    <>
                      {isProcessingPayment && (
                        <View style={styles.processingContainer}>
                          <ActivityIndicator size="small" color="#22c55e" />
                          <Text style={styles.processingText}>Procesando pago...</Text>
                        </View>
                      )}

                      {paymentCompleted && !error && (
                        <View style={styles.successContainer}>
                          <Text style={styles.successIcon}>✅</Text>
                          <Text style={styles.successText}>Pago procesado exitosamente</Text>
                        </View>
                      )}

                      {error && (
                        <View style={styles.errorContainer}>
                          <Text style={styles.errorIcon}>❌</Text>
                          <Text style={styles.errorText}>{error}</Text>
                          <TouchableOpacity style={styles.retryButton} onPress={handleRetryPayment}>
                            <Text style={styles.retryButtonText}>Reintentar Pago</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </>
                  )}
                </View>
              </>
            )}
          </ScrollView>
        )}

        {/* Continue Button */}
        {!isLoading && (
          <View style={styles.footer}>
            <TouchableOpacity style={styles.continueButton} onPress={handleClose}>
              <Text style={styles.continueButtonText}>Continuar</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#505050',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    marginBottom: 24,
  },
  headerIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#505050',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#A9A9A9',
  },
  section: {
    marginBottom: 24,
    backgroundColor: '#F5F5F5',
    borderRadius: 16,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#505050',
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  summaryLabel: {
    fontSize: 14,
    color: '#505050',
    fontWeight: '600',
    width: 100,
  },
  summaryValue: {
    flex: 1,
    fontSize: 14,
    color: '#505050',
  },
  fareRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  fareLabel: {
    flex: 1,
    fontSize: 14,
    color: '#505050',
  },
  fareValue: {
    fontSize: 14,
    color: '#505050',
    fontWeight: '600',
    marginLeft: 8,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 2,
    borderTopColor: '#22c55e',
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#505050',
  },
  totalValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#22c55e',
  },
  paymentMethodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#22c55e',
  },
  paymentMethodIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  paymentMethodText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#505050',
  },
  cashMessageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    padding: 16,
    borderRadius: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#FF9500',
  },
  cashMessageIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  cashMessageText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#505050',
  },
  processingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FFF0',
    padding: 16,
    borderRadius: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#22c55e',
  },
  processingText: {
    marginLeft: 12,
    fontSize: 16,
    color: '#22c55e',
    fontWeight: '600',
  },
  successContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FFF0',
    padding: 16,
    borderRadius: 12,
    marginTop: 12,
    borderWidth: 2,
    borderColor: '#22c55e',
  },
  successIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  successText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#22c55e',
  },
  errorContainer: {
    backgroundColor: '#FFE5E5',
    padding: 16,
    borderRadius: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#FF0000',
  },
  errorIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#505050',
    marginBottom: 12,
    lineHeight: 20,
  },
  retryButton: {
    backgroundColor: '#FF9500',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  continueButton: {
    backgroundColor: '#22c55e',
    borderRadius: 24,
    paddingVertical: 16,
    alignItems: 'center',
  },
  continueButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
