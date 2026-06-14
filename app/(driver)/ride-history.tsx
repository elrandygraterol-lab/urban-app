import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { rideAPI } from '../../services/api';
import { Ride } from '../../src/types';
import { Colors, Spacing } from '../../constants/theme';
import { formatCurrency, Currency } from '../../utils/currency';

const PAGE_SIZE = 15;

interface RideHistoryItem extends Ride {
  passenger?: { name: string; rating?: number };
  currency?: Currency;
  fare?: number;
  distance?: number;
  duration?: number;
}

export default function DriverRideHistoryScreen() {
  const insets = useSafeAreaInsets();
  const [rides, setRides] = useState<RideHistoryItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRides, setTotalRides] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedRide, setSelectedRide] = useState<RideHistoryItem | null>(null);

  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);

  const getFilterParams = useCallback(() => {
    const params: Record<string, string> = {};
    if (startDate) params.startDate = startDate.toISOString();
    if (endDate) params.endDate = endDate.toISOString();
    return params;
  }, [startDate, endDate]);

  const loadRides = useCallback(async (pageNum: number, append = false) => {
    try {
      const filterParams = getFilterParams();
      const response = await rideAPI.getRideHistory({
        ...filterParams,
        page: pageNum.toString(),
        limit: PAGE_SIZE.toString(),
      } as any);

      const payload = response.data?.data ?? response.data;
      let ridesData: RideHistoryItem[] = [];
      let total = 0;
      let pages = 1;

      if (payload?.rides && Array.isArray(payload.rides)) {
        ridesData = payload.rides;
        total = payload.total ?? ridesData.length;
        pages = payload.totalPages ?? 1;
      } else if (Array.isArray(payload)) {
        ridesData = payload;
        total = ridesData.length;
      }

      if (append) {
        setRides(prev => [...prev, ...ridesData]);
      } else {
        setRides(ridesData);
      }
      setTotalRides(total);
      setTotalPages(pages);
      setPage(pageNum);
    } catch (error) {
      if (!append) setRides([]);
    }
  }, [getFilterParams]);

  useEffect(() => {
    setLoading(true);
    loadRides(1).finally(() => setLoading(false));
  }, [loadRides]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadRides(1);
    setRefreshing(false);
  }, [loadRides]);

  const onEndReached = useCallback(async () => {
    if (loadingMore || page >= totalPages) return;
    setLoadingMore(true);
    await loadRides(page + 1, true);
    setLoadingMore(false);
  }, [loadingMore, page, totalPages, loadRides]);

  const applyFilters = useCallback(() => {
    setShowFilters(false);
    setLoading(true);
    loadRides(1).finally(() => setLoading(false));
  }, [loadRides]);

  const clearFilters = useCallback(() => {
    setStartDate(null);
    setEndDate(null);
    setShowFilters(false);
    setLoading(true);
    loadRides(1).finally(() => setLoading(false));
  }, [loadRides]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'completed': return { label: 'Completado', color: '#16a34a', bg: '#f0fdf4' };
      case 'cancelled': return { label: 'Cancelado', color: '#dc2626', bg: '#fef2f2' };
      case 'in_progress': return { label: 'En progreso', color: '#2563eb', bg: '#eff6ff' };
      case 'accepted': return { label: 'Aceptado', color: '#d97706', bg: '#fffbeb' };
      case 'arrived': return { label: 'Llegó', color: '#7c3aed', bg: '#f5f3ff' };
      default: return { label: 'Pendiente', color: '#6b7280', bg: '#f9fafb' };
    }
  };

  const renderRideCard = ({ item: ride }: { item: RideHistoryItem }) => {
    const statusConfig = getStatusConfig(ride.status);
    const fare = ride.fare ?? ride.finalFare ?? ride.estimatedFare ?? 0;
    const rideCurrency = (ride.currency || 'VES') as Currency;
    const dateStr = ride.completedAt || ride.startedAt || ride.requestedAt;

    return (
      <TouchableOpacity
        style={styles.rideCard}
        onPress={() => setSelectedRide(ride)}
        activeOpacity={0.7}
      >
        <View style={styles.rideCardTop}>
          <View style={styles.rideCardLeft}>
            <View style={[styles.vehicleIcon, { backgroundColor: statusConfig.bg }]}>
              <Ionicons
                name={ride.vehicleType === 'taxi' ? 'car' : 'bicycle'}
                size={20}
                color={statusConfig.color}
              />
            </View>
            <View>
              <Text style={styles.rideDate}>
                {dateStr ? formatDate(dateStr) : '—'}
              </Text>
              <Text style={styles.rideTime}>
                {dateStr ? formatTime(dateStr) : ''}
              </Text>
            </View>
          </View>
          <View style={styles.rideCardRight}>
            <Text style={styles.rideFareAmount}>
              {formatCurrency(fare, rideCurrency)}
            </Text>
            <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
              <View style={[styles.statusDot, { backgroundColor: statusConfig.color }]} />
              <Text style={[styles.statusText, { color: statusConfig.color }]}>
                {statusConfig.label}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.rideLocations}>
          <View style={styles.locationRow}>
            <View style={styles.locationDot} />
            <Text style={styles.locationText} numberOfLines={1}>
              {ride.pickup?.address || '—'}
            </Text>
          </View>
          <View style={styles.locationLine} />
          <View style={styles.locationRow}>
            <Ionicons name="location" size={13} color="#f97316" />
            <Text style={styles.locationText} numberOfLines={1}>
              {ride.destination?.address || '—'}
            </Text>
          </View>
        </View>

        <View style={styles.rideCardFooter}>
          <View style={styles.footerStats}>
            {ride.distance != null && (
              <View style={styles.footerStat}>
                <Ionicons name="navigate-outline" size={13} color="#9ca3af" />
                <Text style={styles.footerStatText}>{ride.distance.toFixed(1)} km</Text>
              </View>
            )}
            {ride.duration != null && (
              <View style={styles.footerStat}>
                <Ionicons name="time-outline" size={13} color="#9ca3af" />
                <Text style={styles.footerStatText}>{ride.duration} min</Text>
              </View>
            )}
          </View>
          {ride.passenger && (
            <View style={styles.passengerBadge}>
              <Ionicons name="person-outline" size={13} color="#6b7280" />
              <Text style={styles.passengerName} numberOfLines={1}>
                {ride.passenger.name}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderDetailsModal = () => {
    if (!selectedRide) return null;
    const statusConfig = getStatusConfig(selectedRide.status);
    const fare = selectedRide.fare ?? selectedRide.finalFare ?? selectedRide.estimatedFare ?? 0;
    const rideCurrency = (selectedRide.currency || 'VES') as Currency;

    return (
      <Modal
        visible={!!selectedRide}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedRide(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: Spacing.lg + insets.bottom }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Detalles del Viaje</Text>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setSelectedRide(null)}
              >
                <Ionicons name="close" size={22} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <View style={[styles.detailStatusBar, { backgroundColor: statusConfig.bg }]}>
              <View style={[styles.detailStatusDot, { backgroundColor: statusConfig.color }]} />
              <Text style={[styles.detailStatusText, { color: statusConfig.color }]}>
                {statusConfig.label}
              </Text>
              <Text style={styles.detailStatusVehicle}>
                {selectedRide.vehicleType === 'taxi' ? 'Taxi' : 'Moto-Taxi'}
              </Text>
            </View>

            <FlatList
              data={[
                { icon: 'calendar-outline' as const, label: 'Fecha y Hora', value: `${formatDate(selectedRide.completedAt || selectedRide.requestedAt)} — ${formatTime(selectedRide.completedAt || selectedRide.requestedAt)}` },
                { icon: 'location-outline' as const, label: 'Origen', value: selectedRide.pickup?.address || '—' },
                { icon: 'flag-outline' as const, label: 'Destino', value: selectedRide.destination?.address || '—' },
                ...(selectedRide.passenger ? [{ icon: 'person-outline' as const, label: 'Pasajero', value: selectedRide.passenger.name }] : []),
                ...(selectedRide.distance != null ? [{ icon: 'navigate-outline' as const, label: 'Distancia', value: `${selectedRide.distance.toFixed(2)} km` }] : []),
                ...(selectedRide.duration != null ? [{ icon: 'time-outline' as const, label: 'Duración', value: `${selectedRide.duration} minutos` }] : []),
              ]}
              keyExtractor={(_, i) => i.toString()}
              renderItem={({ item }) => (
                <View style={styles.detailRow}>
                  <View style={styles.detailIconBox}>
                    <Ionicons name={item.icon} size={18} color={Colors.primary} />
                  </View>
                  <View style={styles.detailTextCol}>
                    <Text style={styles.detailLabel}>{item.label}</Text>
                    <Text style={styles.detailValue}>{item.value}</Text>
                  </View>
                </View>
              )}
              showsVerticalScrollIndicator={false}
              style={{ maxHeight: 320 }}
            />

            <View style={styles.detailFareCard}>
              <Text style={styles.detailFareLabel}>Tarifa</Text>
              <Text style={styles.detailFareValue}>{formatCurrency(fare, rideCurrency)}</Text>
            </View>
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
        <View style={[styles.modalContent, { paddingBottom: Spacing.lg + insets.bottom }]}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Filtrar por Fecha</Text>
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setShowFilters(false)}
            >
              <Ionicons name="close" size={22} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <View style={styles.filterSection}>
            <Text style={styles.filterLabel}>Fecha de Inicio</Text>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowStartDatePicker(true)}
            >
              <Ionicons name="calendar-outline" size={20} color={Colors.primary} />
              <Text style={[styles.dateButtonText, startDate && { color: '#1f2937' }]}>
                {startDate ? formatDate(startDate.toISOString()) : 'Seleccionar fecha'}
              </Text>
              {startDate && (
                <TouchableOpacity
                  onPress={() => setStartDate(null)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close-circle" size={18} color="#9ca3af" />
                </TouchableOpacity>
              )}
            </TouchableOpacity>
            {showStartDatePicker && (
              <DateTimePicker
                value={startDate || new Date()}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                maximumDate={endDate || new Date()}
                onChange={(_, selectedDate) => {
                  setShowStartDatePicker(Platform.OS === 'ios');
                  if (selectedDate) setStartDate(selectedDate);
                }}
              />
            )}
          </View>

          <View style={styles.filterSection}>
            <Text style={styles.filterLabel}>Fecha de Fin</Text>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowEndDatePicker(true)}
            >
              <Ionicons name="calendar-outline" size={20} color={Colors.primary} />
              <Text style={[styles.dateButtonText, endDate && { color: '#1f2937' }]}>
                {endDate ? formatDate(endDate.toISOString()) : 'Seleccionar fecha'}
              </Text>
              {endDate && (
                <TouchableOpacity
                  onPress={() => setEndDate(null)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close-circle" size={18} color="#9ca3af" />
                </TouchableOpacity>
              )}
            </TouchableOpacity>
            {showEndDatePicker && (
              <DateTimePicker
                value={endDate || new Date()}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                minimumDate={startDate || undefined}
                onChange={(_, selectedDate) => {
                  setShowEndDatePicker(Platform.OS === 'ios');
                  if (selectedDate) setEndDate(selectedDate);
                }}
              />
            )}
          </View>

          <View style={styles.filterButtons}>
            <TouchableOpacity
              style={[styles.filterBtn, styles.filterBtnOutline]}
              onPress={clearFilters}
            >
              <Text style={styles.filterBtnOutlineText}>Limpiar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterBtn, styles.filterBtnPrimary]}
              onPress={applyFilters}
            >
              <Text style={styles.filterBtnPrimaryText}>Aplicar filtros</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={Colors.primary} />
        <Text style={styles.footerLoaderText}>Cargando más viajes...</Text>
      </View>
    );
  };

  const renderEmpty = () => {
    if (loading) return null;
    return (
      <View style={styles.emptyState}>
        <View style={styles.emptyIconBox}>
          <Ionicons name="car-sport-outline" size={48} color={Colors.primary} />
        </View>
        <Text style={styles.emptyStateTitle}>
          {startDate || endDate ? 'Sin resultados' : 'Sin viajes aún'}
        </Text>
        <Text style={styles.emptyStateSubtext}>
          {startDate || endDate
            ? 'No se encontraron viajes en el rango de fechas seleccionado'
            : 'Tus viajes completados aparecerán aquí'}
        </Text>
      </View>
    );
  };

  if (loading && rides.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Cargando historial...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerTop}>
          <Text style={styles.title}>Historial</Text>
          <TouchableOpacity
            style={[styles.filterBtn, (startDate || endDate) && styles.filterBtnActive]}
            onPress={() => setShowFilters(true)}
          >
            <Ionicons
              name="options-outline"
              size={20}
              color={startDate || endDate ? '#fff' : '#374151'}
            />
          </TouchableOpacity>
        </View>
        <View style={styles.headerMeta}>
          <View style={styles.rideCountBadge}>
            <Text style={styles.rideCountText}>
              {totalRides} {totalRides === 1 ? 'viaje' : 'viajes'}
            </Text>
          </View>
          {(startDate || endDate) && (
            <TouchableOpacity style={styles.activeFilters} onPress={clearFilters}>
              <Ionicons name="funnel" size={12} color={Colors.primary} />
              <Text style={styles.activeFiltersText} numberOfLines={1}>
                {startDate && endDate
                  ? `${formatDate(startDate.toISOString())} — ${formatDate(endDate.toISOString())}`
                  : startDate
                    ? `Desde ${formatDate(startDate.toISOString())}`
                    : `Hasta ${formatDate(endDate!.toISOString())}`}
              </Text>
              <Ionicons name="close-circle" size={14} color={Colors.primary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <FlatList
        data={rides}
        renderItem={renderRideCard}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
        onEndReached={onEndReached}
        onEndReachedThreshold={0.4}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmpty}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      />

      {renderFiltersModal()}
      {renderDetailsModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    gap: 12,
  },
  loadingText: {
    fontSize: 15,
    color: '#6b7280',
  },

  // Header
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: -0.5,
  },
  headerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    gap: 8,
  },
  rideCountBadge: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  rideCountText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
  },
  filterBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterBtnActive: {
    backgroundColor: Colors.primary,
  },
  activeFilters: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#ecfdf5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#a7f3d0',
    gap: 6,
    flex: 1,
    maxWidth: '75%',
  },
  activeFiltersText: {
    fontSize: 12,
    color: Colors.primary,
    flex: 1,
    fontWeight: '500',
  },

  // List
  listContent: {
    padding: 16,
    paddingBottom: 32,
    flexGrow: 1,
  },

  // Ride Card
  rideCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  rideCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  rideCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  vehicleIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rideDate: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  rideTime: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 1,
  },
  rideCardRight: {
    alignItems: 'flex-end',
  },
  rideFareAmount: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.primary,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 4,
    gap: 5,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },

  // Ride Locations
  rideLocations: {
    marginBottom: 12,
    paddingLeft: 4,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
    marginRight: 10,
  },
  locationLine: {
    width: 1.5,
    height: 14,
    backgroundColor: '#d1d5db',
    marginLeft: 3,
    marginVertical: 3,
  },
  locationText: {
    fontSize: 13,
    color: '#6b7280',
    flex: 1,
  },

  // Ride Card Footer
  rideCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  footerStats: {
    flexDirection: 'row',
    gap: 14,
  },
  footerStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  footerStatText: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '500',
  },
  passengerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  passengerName: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
    maxWidth: 100,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyIconBox: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#ecfdf5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyStateTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 20,
  },

  // Footer Loader
  footerLoader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  footerLoaderText: {
    fontSize: 13,
    color: '#9ca3af',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '85%',
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#e5e7eb',
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Detail Modal
  detailStatusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 16,
    gap: 8,
  },
  detailStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  detailStatusText: {
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  detailStatusVehicle: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '500',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
    gap: 12,
  },
  detailIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#f0fdf4',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  detailTextCol: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 15,
    color: '#111827',
    fontWeight: '500',
    lineHeight: 20,
  },
  detailFareCard: {
    backgroundColor: '#f0fdf4',
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  detailFareLabel: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '600',
  },
  detailFareValue: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.primary,
  },

  // Filters
  filterSection: {
    marginBottom: 18,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    backgroundColor: '#fff',
    gap: 10,
  },
  dateButtonText: {
    fontSize: 15,
    color: '#9ca3af',
    flex: 1,
  },
  filterButtons: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 12,
  },
  filterBtn: {
    flex: 1,
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterBtnPrimary: {
    backgroundColor: Colors.primary,
  },
  filterBtnOutline: {
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
  },
  filterBtnPrimaryText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  filterBtnOutlineText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6b7280',
  },
});
