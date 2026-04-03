import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { rideAPI } from '../../services/api';
import { Ride } from '../../src/types';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../constants/theme';
import { formatCurrency, Currency } from '../../utils/currency';

interface RideHistoryItem extends Ride {
  driver?: {
    name: string;
    vehicleModel: string;
    licensePlate: string;
    rating: number;
  };
  currency?: Currency;
}

export default function PassengerHistoryScreen() {
  const [rides, setRides] = useState<RideHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedRide, setSelectedRide] = useState<RideHistoryItem | null>(null);

  // Filtros de fecha
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);

  const loadRideHistory = useCallback(
    async (filters?: { startDate?: string; endDate?: string }) => {
      try {
        console.log('🔄 [HISTORY] Cargando historial de viajes...');
        console.log('🔍 [HISTORY] Filtros aplicados:', filters);

        setLoading(true);
        const response = await rideAPI.getRideHistory(filters);

        console.log('📦 [HISTORY] Respuesta completa del API:', JSON.stringify(response, null, 2));
        console.log('📊 [HISTORY] response.data:', response.data);
        console.log('📊 [HISTORY] response.data.rides:', response.data?.rides);
        console.log('📊 [HISTORY] Tipo de response.data:', typeof response.data);
        console.log('📊 [HISTORY] Es array response.data?:', Array.isArray(response.data));
        console.log(
          '📊 [HISTORY] Es array response.data.rides?:',
          Array.isArray(response.data?.rides)
        );

        // Validación defensiva: asegurar que siempre tengamos un array
        let ridesData: RideHistoryItem[] = [];

        if (response.data?.rides && Array.isArray(response.data.rides)) {
          ridesData = response.data.rides;
          console.log(
            '✅ [HISTORY] Usando response.data.rides (array con',
            ridesData.length,
            'elementos)'
          );
        } else if (Array.isArray(response.data)) {
          ridesData = response.data;
          console.log(
            '✅ [HISTORY] Usando response.data directamente (array con',
            ridesData.length,
            'elementos)'
          );
        } else {
          console.warn('⚠️ [HISTORY] Respuesta inesperada del API, usando array vacío');
          console.warn('⚠️ [HISTORY] Estructura recibida:', response.data);
          ridesData = [];
        }

        console.log('✅ [HISTORY] Historial cargado exitosamente:', ridesData.length, 'viajes');
        console.log('📋 [HISTORY] Viajes:', JSON.stringify(ridesData, null, 2));

        setRides(ridesData);
      } catch (error) {
        console.error('❌ [HISTORY] Error cargando historial:', error);
        console.error('❌ [HISTORY] Detalles del error:', JSON.stringify(error, null, 2));

        if (error instanceof Error) {
          console.error('❌ [HISTORY] Mensaje de error:', error.message);
          console.error('❌ [HISTORY] Stack trace:', error.stack);
        }

        // En caso de error, asegurar que rides sea un array vacío
        setRides([]);
      } finally {
        setLoading(false);
        console.log('🏁 [HISTORY] Carga finalizada');
      }
    },
    []
  );

  const getFilters = useCallback(() => {
    const filters: { startDate?: string; endDate?: string } = {};
    if (startDate) {
      filters.startDate = startDate.toISOString();
    }
    if (endDate) {
      filters.endDate = endDate.toISOString();
    }
    return filters;
  }, [startDate, endDate]);

  useEffect(() => {
    loadRideHistory();
  }, [loadRideHistory]);

  const onRefresh = useCallback(async () => {
    console.log('🔄 [HISTORY] Refrescando historial...');
    setRefreshing(true);
    const filters = getFilters();
    await loadRideHistory(filters);
    setRefreshing(false);
    console.log('✅ [HISTORY] Refresco completado');
  }, [getFilters, loadRideHistory]);

  const applyFilters = useCallback(() => {
    console.log('🔍 [HISTORY] Aplicando filtros...');
    const filters = getFilters();
    console.log('📅 [HISTORY] Filtros:', filters);
    loadRideHistory(filters);
    setShowFilters(false);
  }, [getFilters, loadRideHistory]);

  const clearFilters = useCallback(() => {
    console.log('🧹 [HISTORY] Limpiando filtros...');
    setStartDate(null);
    setEndDate(null);
    loadRideHistory();
    setShowFilters(false);
  }, [loadRideHistory]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const formatCurrencyAmount = (amount: number, currency?: Currency) => {
    return formatCurrency(amount, currency || 'VES');
  };

  const getVehicleTypeLabel = (type: string) => {
    return type === 'taxi' ? 'Taxi' : 'Moto-Taxi';
  };

  const renderRideCard = (ride: RideHistoryItem) => (
    <TouchableOpacity
      key={ride.id}
      style={styles.rideCard}
      onPress={() => setSelectedRide(ride)}
      activeOpacity={0.7}
    >
      <View style={styles.rideHeader}>
        <View style={styles.rideHeaderLeft}>
          <View style={styles.iconContainer}>
            <Ionicons
              name={ride.vehicleType === 'taxi' ? 'car' : 'bicycle'}
              size={22}
              color={Colors.primary}
            />
          </View>
          <View style={styles.rideHeaderInfo}>
            <Text style={styles.rideDate}>{formatDate(ride.completedAt || ride.requestedAt)}</Text>
            <Text style={styles.rideTime}>{formatTime(ride.completedAt || ride.requestedAt)}</Text>
          </View>
        </View>
        <View style={styles.rideFare}>
          <Text style={styles.rideFareAmount}>
            {formatCurrencyAmount(ride.finalFare || ride.estimatedFare || 0, ride.currency)}
          </Text>
          <Text style={styles.rideVehicleType}>{getVehicleTypeLabel(ride.vehicleType)}</Text>
        </View>
      </View>

      <View style={styles.rideLocations}>
        <View style={styles.locationRow}>
          <View style={styles.locationDot} />
          <Text style={styles.locationText} numberOfLines={1}>
            {ride.pickup.address}
          </Text>
        </View>
        <View style={styles.locationLine} />
        <View style={styles.locationRow}>
          <Ionicons name="location" size={14} color={Colors.orange} />
          <Text style={styles.locationText} numberOfLines={1}>
            {ride.destination.address}
          </Text>
        </View>
      </View>

      {ride.driver && (
        <View style={styles.driverInfo}>
          <Ionicons name="person-circle-outline" size={18} color="#9ca3af" />
          <Text style={styles.driverName}>{ride.driver.name}</Text>
          <View style={styles.driverRating}>
            <Ionicons name="star" size={12} color="#f59e0b" />
            <Text style={styles.driverRatingText}>{ride.driver.rating.toFixed(1)}</Text>
          </View>
        </View>
      )}
    </TouchableOpacity>
  );

  const renderRideDetailsModal = () => {
    if (!selectedRide) return null;

    return (
      <Modal
        visible={!!selectedRide}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedRide(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Detalles del Viaje</Text>
              <TouchableOpacity onPress={() => setSelectedRide(null)}>
                <Ionicons name="close" size={28} color={Colors.darkGray} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Fecha y hora */}
              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Fecha y Hora</Text>
                <Text style={styles.detailValue}>
                  {formatDate(selectedRide.completedAt || selectedRide.requestedAt)} a las{' '}
                  {formatTime(selectedRide.completedAt || selectedRide.requestedAt)}
                </Text>
              </View>

              {/* Origen */}
              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Origen</Text>
                <View style={styles.detailLocationRow}>
                  <View style={styles.locationDot} />
                  <Text style={styles.detailValue}>{selectedRide.pickup.address}</Text>
                </View>
              </View>

              {/* Destino */}
              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Destino</Text>
                <View style={styles.detailLocationRow}>
                  <Ionicons name="location" size={16} color={Colors.orange} />
                  <Text style={styles.detailValue}>{selectedRide.destination.address}</Text>
                </View>
              </View>

              {/* Tarifa */}
              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Tarifa</Text>
                <Text style={styles.detailValueLarge}>
                  {formatCurrencyAmount(selectedRide.finalFare || selectedRide.estimatedFare || 0, selectedRide.currency)}
                </Text>
              </View>

              {/* Conductor */}
              {selectedRide.driver && (
                <>
                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>Conductor</Text>
                    <Text style={styles.detailValue}>{selectedRide.driver.name}</Text>
                  </View>

                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>Vehículo</Text>
                    <Text style={styles.detailValue}>{selectedRide.driver.vehicleModel}</Text>
                  </View>

                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>Placa</Text>
                    <Text style={styles.detailValue}>{selectedRide.driver.licensePlate}</Text>
                  </View>

                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>Calificación del Conductor</Text>
                    <View style={styles.detailRating}>
                      <Ionicons name="star" size={20} color={Colors.orange} />
                      <Text style={styles.detailRatingText}>
                        {selectedRide.driver.rating.toFixed(1)}
                      </Text>
                    </View>
                  </View>
                </>
              )}

              {/* Distancia y duración */}
              {selectedRide.actualDistance && (
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Distancia</Text>
                  <Text style={styles.detailValue}>
                    {selectedRide.actualDistance.toFixed(2)} km
                  </Text>
                </View>
              )}

              {selectedRide.actualDuration && (
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Duración</Text>
                  <Text style={styles.detailValue}>{selectedRide.actualDuration} minutos</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  const renderFiltersModal = () => (
    <Modal
      visible={showFilters}
      transparent
      animationType="slide"
      onRequestClose={() => setShowFilters(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Filtrar por Fecha</Text>
            <TouchableOpacity onPress={() => setShowFilters(false)}>
              <Ionicons name="close" size={28} color={Colors.darkGray} />
            </TouchableOpacity>
          </View>

          <View style={styles.filterSection}>
            <Text style={styles.filterLabel}>Fecha de Inicio</Text>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowStartDatePicker(true)}
            >
              <Ionicons name="calendar-outline" size={20} color={Colors.primary} />
              <Text style={styles.dateButtonText}>
                {startDate ? formatDate(startDate.toISOString()) : 'Seleccionar fecha'}
              </Text>
            </TouchableOpacity>
            {showStartDatePicker && (
              <DateTimePicker
                value={startDate || new Date()}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(event, selectedDate) => {
                  setShowStartDatePicker(Platform.OS === 'ios');
                  if (selectedDate) {
                    setStartDate(selectedDate);
                  }
                }}
              />
            )}
          </View>

          <View style={styles.filterSection}>
            <Text style={styles.filterLabel}>Fecha de Fin</Text>
            <TouchableOpacity style={styles.dateButton} onPress={() => setShowEndDatePicker(true)}>
              <Ionicons name="calendar-outline" size={20} color={Colors.primary} />
              <Text style={styles.dateButtonText}>
                {endDate ? formatDate(endDate.toISOString()) : 'Seleccionar fecha'}
              </Text>
            </TouchableOpacity>
            {showEndDatePicker && (
              <DateTimePicker
                value={endDate || new Date()}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(event, selectedDate) => {
                  setShowEndDatePicker(Platform.OS === 'ios');
                  if (selectedDate) {
                    setEndDate(selectedDate);
                  }
                }}
              />
            )}
          </View>

          <View style={styles.filterButtons}>
            <TouchableOpacity
              style={[styles.filterButton, styles.filterButtonSecondary]}
              onPress={clearFilters}
            >
              <Text style={styles.filterButtonTextSecondary}>Limpiar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterButton, styles.filterButtonPrimary]}
              onPress={applyFilters}
            >
              <Text style={styles.filterButtonTextPrimary}>Aplicar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  if (loading) {
    console.log('⏳ [HISTORY] Mostrando pantalla de carga...');
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Cargando historial...</Text>
      </View>
    );
  }

  // Validación adicional: asegurar que rides sea un array
  const safeRides = Array.isArray(rides) ? rides : [];
  console.log('🔒 [HISTORY] Renderizando con', safeRides.length, 'viajes');

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.title}>Historial de Viajes</Text>
            <Text style={styles.subtitle}>
              {safeRides.length}{' '}
              {safeRides.length === 1 ? 'viaje completado' : 'viajes completados'}
            </Text>
          </View>
          <TouchableOpacity style={styles.filterIconButton} onPress={() => setShowFilters(true)}>
            <Ionicons
              name="filter"
              size={24}
              color={startDate || endDate ? Colors.primary : Colors.darkGray}
            />
          </TouchableOpacity>
        </View>

        {(startDate || endDate) && (
          <View style={styles.activeFilters}>
            <Ionicons name="funnel" size={16} color={Colors.primary} />
            <Text style={styles.activeFiltersText}>
              {startDate && endDate
                ? `${formatDate(startDate.toISOString())} - ${formatDate(endDate.toISOString())}`
                : startDate
                  ? `Desde ${formatDate(startDate.toISOString())}`
                  : endDate
                    ? `Hasta ${formatDate(endDate.toISOString())}`
                    : ''}
            </Text>
            <TouchableOpacity onPress={clearFilters}>
              <Ionicons name="close-circle" size={20} color={Colors.primary} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {safeRides.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.emptyStateContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.primary}
            />
          }
        >
          <Ionicons name="car-outline" size={80} color={Colors.lightGray} />
          <Text style={styles.emptyStateText}>No hay viajes en tu historial</Text>
          <Text style={styles.emptyStateSubtext}>
            {startDate || endDate
              ? 'No se encontraron viajes en el rango de fechas seleccionado'
              : 'Tus viajes completados aparecerán aquí'}
          </Text>
        </ScrollView>
      ) : (
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.primary}
            />
          }
        >
          <View style={styles.ridesList}>{safeRides.map(renderRideCard)}</View>
        </ScrollView>
      )}

      {renderFiltersModal()}
      {renderRideDetailsModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f9ff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f9ff',
  },
  loadingText: {
    marginTop: Spacing.md,
    fontSize: 16,
    color: '#6b7280',
  },
  header: {
    padding: Spacing.lg,
    paddingTop: 60,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#9ca3af',
  },
  filterIconButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#f0fdf4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeFilters: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.md,
    padding: 12,
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#86efac',
  },
  activeFiltersText: {
    fontSize: 13,
    color: Colors.primary,
    marginLeft: 8,
    flex: 1,
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  ridesList: {
    padding: Spacing.lg,
  },
  rideCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  rideHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  rideHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#f0fdf4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rideHeaderInfo: {
    marginLeft: Spacing.md,
  },
  rideDate: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  rideTime: {
    fontSize: 13,
    color: '#9ca3af',
    marginTop: 2,
  },
  rideFare: {
    alignItems: 'flex-end',
  },
  rideFareAmount: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.primary,
  },
  rideVehicleType: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 2,
  },
  rideLocations: {
    marginBottom: Spacing.md,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary,
    marginRight: 12,
  },
  locationLine: {
    width: 2,
    height: 16,
    backgroundColor: '#e5e7eb',
    marginLeft: 4,
    marginVertical: 4,
  },
  locationText: {
    fontSize: 14,
    color: '#6b7280',
    flex: 1,
  },
  driverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  driverName: {
    fontSize: 14,
    color: '#6b7280',
    marginLeft: 8,
    flex: 1,
  },
  driverRating: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  driverRatingText: {
    fontSize: 13,
    color: '#92400e',
    marginLeft: 4,
    fontWeight: '600',
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginTop: Spacing.lg,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 8,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: Spacing.lg,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
  },
  detailSection: {
    marginBottom: Spacing.lg,
  },
  detailLabel: {
    fontSize: 13,
    color: '#9ca3af',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '600',
  },
  detailValue: {
    fontSize: 16,
    color: '#1f2937',
  },
  detailValueLarge: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.primary,
  },
  detailLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailRating: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailRatingText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
    marginLeft: 8,
  },
  filterSection: {
    marginBottom: Spacing.lg,
  },
  filterLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 10,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    backgroundColor: Colors.white,
  },
  dateButtonText: {
    fontSize: 16,
    color: '#6b7280',
    marginLeft: 12,
  },
  filterButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.lg,
    gap: 12,
  },
  filterButton: {
    flex: 1,
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterButtonPrimary: {
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  filterButtonSecondary: {
    backgroundColor: Colors.white,
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  filterButtonTextPrimary: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
  },
  filterButtonTextSecondary: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
  },
});
