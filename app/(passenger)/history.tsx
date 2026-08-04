import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useFocusEffect } from 'expo-router';
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
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import { rideAPI } from '../../services/api';
import { Ride } from '../../src/types';
import { Colors, Spacing } from '../../constants/theme';
import { formatCurrency, Currency } from '../../utils/currency';
import { useSmartTutorial } from '@/hooks/useSmartTutorial';
import { setActiveTutorialScreen } from '@/utils/tutorialState';

interface RideHistoryItem extends Ride {
  driver?: {
    id: string;
    name: string;
    phone: string;
    vehicleModel: string;
    licensePlate: string;
    averageRating: number;
  };
  currency?: Currency;
  distance?: number;
  duration?: number;
  rating?: {
    rating: number;
    comment?: string;
  } | null;
  conductorRating?: {
    rating: number;
    comment?: string;
  } | null;
  cancellation?: {
    reason: string;
    cancelledBy: string;
    fee: number;
  } | null;
}

const PAGE_SIZE = 15;

export default function PassengerHistoryScreen() {
  const insets = useSafeAreaInsets();
  const { isActive: needsTutorial } = useSmartTutorial('passenger_history');

  const [rides, setRides] = useState<RideHistoryItem[]>([]);
  const scrollRef = useRef<ScrollView>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedRide, setSelectedRide] = useState<RideHistoryItem | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);

  // Filtros de fecha
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);

  useEffect(() => {
    if (needsTutorial) {
      setActiveTutorialScreen('passenger_history');
    }
  }, [needsTutorial]);

  const loadRideHistory = useCallback(
    async (filters?: { startDate?: string; endDate?: string }, page: number = 1) => {
      try {
        if (page === 1) setLoading(true);
        else setLoadingMore(true);

        const params: any = {
          page: String(page),
          limit: String(PAGE_SIZE),
        };
        if (filters?.startDate) params.startDate = filters.startDate;
        if (filters?.endDate) params.endDate = filters.endDate;

        const response = await rideAPI.getRideHistory(params);

        let ridesData: RideHistoryItem[] = [];
        const rawRides = response.data?.data?.rides ?? response.data?.rides;
        if (rawRides && Array.isArray(rawRides)) {
          ridesData = rawRides;
        } else if (Array.isArray(response.data)) {
          ridesData = response.data;
        }

        const pagination = response.data?.data?.pagination ?? response.data?.pagination;
        if (pagination) {
          setTotalPages(pagination.totalPages ?? 1);
          setTotalCount(pagination.totalCount ?? ridesData.length);
        }

        if (page === 1) {
          setRides(ridesData);
        } else {
          setRides(prev => {
            const existingIds = new Set(prev.map(r => r.id));
            const newRides = ridesData.filter(r => !existingIds.has(r.id));
            return [...prev, ...newRides];
          });
        }

        setCurrentPage(page);
      } catch (error) {
        console.error('Error loading history:', error);
        if (page === 1) setRides([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    []
  );

  const getFilters = useCallback(() => {
    const filters: { startDate?: string; endDate?: string } = {};
    if (startDate) filters.startDate = startDate.toISOString();
    if (endDate) {
      // If same day as startDate, set endDate to end of that day
      if (startDate && endDate.toDateString() === startDate.toDateString()) {
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);
        filters.endDate = endOfDay.toISOString();
      } else {
        filters.endDate = endDate.toISOString();
      }
    }
    return filters;
  }, [startDate, endDate]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadRideHistory(undefined, 1).finally(() => {
        setLoading(false);
        setTimeout(() => scrollRef.current?.scrollTo({ y: 0, animated: false }), 100);
      });
    }, [loadRideHistory])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadRideHistory(getFilters(), 1);
  }, [getFilters, loadRideHistory]);

  const applyFilters = useCallback(() => {
    const filters = getFilters();
    loadRideHistory(filters, 1);
    setShowFilters(false);
  }, [getFilters, loadRideHistory]);

  const clearFilters = useCallback(() => {
    setStartDate(null);
    setEndDate(null);
    loadRideHistory(undefined, 1);
    setShowFilters(false);
  }, [loadRideHistory]);

  const loadNextPage = useCallback(() => {
    if (currentPage < totalPages && !loadingMore) {
      loadRideHistory(getFilters(), currentPage + 1);
    }
  }, [currentPage, totalPages, loadingMore, getFilters, loadRideHistory]);

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

  const renderRatingStars = (rating: number) => {
    return (
      <View style={styles.ratingStars}>
        {[1, 2, 3, 4, 5].map(star => (
          <Ionicons
            key={star}
            name={star <= rating ? 'star' : 'star-outline'}
            size={11}
            color={star <= rating ? '#F89C0A' : '#d1d5db'}
          />
        ))}
      </View>
    );
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
              size={20}
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

      {ride.isDelegated && ride.beneficiaryName && (
        <View style={styles.delegatedBadge}>
          <Ionicons name="gift-outline" size={14} color={Colors.orange} />
          <Text style={styles.delegatedBadgeText}>Viaje para {ride.beneficiaryName}</Text>
        </View>
      )}

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

      <View style={styles.cardFooter}>
        {ride.driver && (
          <View style={styles.driverInfo}>
            <Ionicons name="person-circle-outline" size={16} color="#9ca3af" />
            <Text style={styles.driverName}>{ride.driver.name}</Text>
          </View>
        )}
        <View style={styles.cardFooterRight}>
          {ride.driver && (
            <View style={styles.driverRating}>
              <Ionicons name="star" size={11} color="#F89C0A" />
              <Text style={styles.driverRatingText}>{(ride.driver.averageRating ?? 0).toFixed(1)}</Text>
            </View>
          )}
          {ride.conductorRating && (
            <View style={styles.conductorRatingBadge}>
              <Text style={styles.conductorRatingBadgeText}>
                C: {ride.conductorRating.rating.toFixed(1)}
              </Text>
            </View>
          )}
          {ride.rating ? (
            <View style={styles.myRating}>
              {renderRatingStars(ride.rating.rating)}
            </View>
          ) : null}
          {ride.status === 'cancelled' && (
            <View style={styles.cancelledBadge}>
              <Text style={styles.cancelledBadgeText}>Cancelado</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderRideDetailsModal = () => {
    if (!selectedRide) return null;

    const isCancelled = selectedRide.status === 'cancelled';

    return (
      <Modal
        visible={!!selectedRide}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setSelectedRide(null)}
      >
        <View style={styles.modalOverlay}>
          <SafeAreaView edges={['top', 'bottom']} style={styles.modalSafeContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <View style={[styles.statusDot, { backgroundColor: isCancelled ? '#ef4444' : Colors.primary }]} />
                <Text style={styles.modalTitle}>
                  {isCancelled ? 'Viaje Cancelado' : 'Detalles del Viaje'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedRide(null)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={22} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.detailScroll}>

              {selectedRide.isDelegated && selectedRide.beneficiaryName && (
                <View style={styles.detailCard}>
                  <View style={styles.detailCardHeader}>
                    <Ionicons name="gift" size={16} color={Colors.orange} />
                    <Text style={styles.detailCardTitle}>Viaje Delegado</Text>
                  </View>
                  <Text style={styles.detailCardText}>
                    Solicitado para {selectedRide.beneficiaryName}
                  </Text>
                  {selectedRide.beneficiaryPhone && (
                    <Text style={styles.detailCardSub}>Tel: {selectedRide.beneficiaryPhone}</Text>
                  )}
                </View>
              )}

              <View style={styles.detailCard}>
                <View style={styles.detailRow}>
                  <Ionicons name="calendar-outline" size={15} color="#6b7280" />
                  <Text style={styles.detailRowLabel}>Fecha</Text>
                  <Text style={styles.detailRowValue}>
                    {formatDate(selectedRide.completedAt || selectedRide.requestedAt)} {formatTime(selectedRide.completedAt || selectedRide.requestedAt)}
                  </Text>
                </View>
              </View>

              <View style={styles.detailCard}>
                <View style={styles.detailRow}>
                  <View style={styles.detailDotPickup} />
                  <Text style={styles.detailRowLabel}>Origen</Text>
                </View>
                <Text style={styles.detailAddress}>{selectedRide.pickup.address}</Text>
                <View style={styles.detailDivider} />
                <View style={styles.detailRow}>
                  <Ionicons name="location" size={15} color={Colors.orange} />
                  <Text style={styles.detailRowLabel}>Destino</Text>
                </View>
                <Text style={styles.detailAddress}>{selectedRide.destination.address}</Text>
              </View>

              <View style={styles.detailCard}>
                <View style={styles.detailRow}>
                  <Ionicons name="cash-outline" size={15} color={Colors.primary} />
                  <Text style={styles.detailRowLabel}>Tarifa</Text>
                </View>
                <Text style={styles.detailFare}>
                  {formatCurrencyAmount(
                    selectedRide.finalFare || selectedRide.estimatedFare || 0,
                    selectedRide.currency
                  )}
                </Text>
                <View style={styles.detailStats}>
                  {(selectedRide.distance ?? selectedRide.actualDistance) != null && (
                    <View style={styles.detailStat}>
                      <Ionicons name="map-outline" size={13} color="#9ca3af" />
                      <Text style={styles.detailStatText}>{(selectedRide.distance ?? selectedRide.actualDistance ?? 0).toFixed(1)} km</Text>
                    </View>
                  )}
                  {(selectedRide.duration ?? selectedRide.actualDuration) != null && (
                    <View style={styles.detailStat}>
                      <Ionicons name="time-outline" size={13} color="#9ca3af" />
                      <Text style={styles.detailStatText}>{selectedRide.duration ?? selectedRide.actualDuration} min</Text>
                    </View>
                  )}
                </View>
              </View>

              {selectedRide.driver && (
                <View style={styles.detailCard}>
                  <View style={styles.detailRow}>
                    <Ionicons name="person-outline" size={15} color="#6b7280" />
                    <Text style={styles.detailRowLabel}>Conductor</Text>
                  </View>
                  <Text style={styles.detailDriverName}>{selectedRide.driver.name}</Text>
                  <View style={styles.detailDriverInfo}>
                    <Text style={styles.detailDriverDetail}>{selectedRide.driver.vehicleModel}</Text>
                    <Text style={styles.detailDriverDot}>  ·  </Text>
                    <Text style={styles.detailDriverDetail}>{selectedRide.driver.licensePlate}</Text>
                  </View>
                  <View style={styles.detailDriverRating}>
                    <Ionicons name="star" size={14} color="#F89C0A" />
                    <Text style={styles.detailDriverRatingText}>
                      {(selectedRide.driver.averageRating ?? 0).toFixed(1)} promedio
                    </Text>
                  </View>
                </View>
              )}

              {selectedRide.rating && (
                <View style={styles.detailCard}>
                  <View style={styles.detailRow}>
                    <Ionicons name="star" size={15} color="#F89C0A" />
                    <Text style={styles.detailRowLabel}>Tu Calificación</Text>
                  </View>
                  <View style={styles.detailMyRating}>
                    {[1, 2, 3, 4, 5].map(star => (
                      <Ionicons
                        key={star}
                        name={star <= selectedRide.rating!.rating ? 'star' : 'star-outline'}
                        size={22}
                        color={star <= selectedRide.rating!.rating ? '#F89C0A' : '#d1d5db'}
                      />
                    ))}
                  </View>
                  {selectedRide.rating.comment ? (
                    <Text style={styles.detailRatingComment}>"{selectedRide.rating.comment}"</Text>
                  ) : null}
                </View>
              )}

              {selectedRide.conductorRating && (
                <View style={styles.detailCard}>
                  <View style={styles.detailRow}>
                    <Ionicons name="person" size={15} color="#3b82f6" />
                    <Text style={styles.detailRowLabel}>Calificación del Conductor</Text>
                  </View>
                  <View style={styles.detailConductorRatingStars}>
                    {[1, 2, 3, 4, 5].map(star => (
                      <Ionicons
                        key={star}
                        name={star <= selectedRide.conductorRating!.rating ? 'star' : 'star-outline'}
                        size={22}
                        color={star <= selectedRide.conductorRating!.rating ? '#F89C0A' : '#d1d5db'}
                      />
                    ))}
                  </View>
                  {selectedRide.conductorRating.comment ? (
                    <Text style={styles.detailRatingComment}>"{selectedRide.conductorRating.comment}"</Text>
                  ) : null}
                </View>
              )}

              {isCancelled && (selectedRide as any).cancellation && (
                <View style={styles.detailCard}>
                  <View style={styles.detailRow}>
                    <Ionicons name="close-circle-outline" size={15} color="#ef4444" />
                    <Text style={styles.detailRowLabel}>Cancelación</Text>
                  </View>
                  <Text style={styles.detailCancelled}>
                    {(selectedRide as any).cancellation.cancelledBy === 'passenger' ? 'Cancelado por ti' :
                     (selectedRide as any).cancellation.cancelledBy === 'driver' ? 'Cancelado por el conductor' :
                     'Cancelado por el sistema'}
                  </Text>
                  {(selectedRide as any).cancellation.reason && (
                    <Text style={styles.detailCancelledReason}>{(selectedRide as any).cancellation.reason}</Text>
                  )}
                  {(selectedRide as any).cancellation.fee > 0 && (
                    <Text style={styles.detailCancelledFee}>
                      Tarifa de cancelación: {formatCurrencyAmount((selectedRide as any).cancellation.fee, selectedRide.currency)}
                    </Text>
                  )}
                </View>
              )}
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>
    );
  };

  const renderFiltersModal = () => (
    <Modal
      visible={showFilters}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={() => setShowFilters(false)}
    >
      <View style={styles.modalOverlay}>
        <SafeAreaView edges={['top', 'bottom']} style={styles.modalSafeContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Filtrar por Fecha</Text>
            <TouchableOpacity onPress={() => setShowFilters(false)}>
              <Ionicons name="close" size={24} color={Colors.darkGray} />
            </TouchableOpacity>
          </View>

          <View style={styles.filterSection}>
            <Text style={styles.filterLabel}>Fecha de Inicio</Text>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowStartDatePicker(true)}
            >
              <Ionicons name="calendar-outline" size={18} color={Colors.primary} />
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
                  if (selectedDate) setStartDate(selectedDate);
                }}
              />
            )}
          </View>

          <View style={styles.filterSection}>
            <Text style={styles.filterLabel}>Fecha de Fin</Text>
            <TouchableOpacity style={styles.dateButton} onPress={() => setShowEndDatePicker(true)}>
              <Ionicons name="calendar-outline" size={18} color={Colors.primary} />
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
                  if (selectedDate) setEndDate(selectedDate);
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
        </SafeAreaView>
      </View>
    </Modal>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Cargando historial...</Text>
      </View>
    );
  }

  const safeRides = Array.isArray(rides) ? rides : [];
  const hasMore = currentPage < totalPages;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) + 12 }]}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.title}>Historial de Viajes</Text>
            <Text style={styles.subtitle}>
              {totalCount} {totalCount === 1 ? 'viaje' : 'viajes'}
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
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
          }
        >
          <Ionicons name="car-outline" size={80} color={Colors.lightGray} />
          <Text style={styles.emptyStateText}>No hay viajes en tu historial</Text>
          <Text style={styles.emptyStateSubtext}>
            {startDate || endDate
              ? 'No se encontraron viajes en el rango seleccionado'
              : 'Tus viajes completados aparecerán aquí'}
          </Text>
        </ScrollView>
      ) : (
        <ScrollView
          ref={scrollRef}
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
          }
        >
          <View style={styles.ridesList}>{safeRides.map((ride, idx) => (
            <React.Fragment key={ride.id || idx}>
              {renderRideCard(ride)}
            </React.Fragment>
          ))}</View>

          {hasMore && (
            <TouchableOpacity
              style={styles.loadMoreBtn}
              onPress={loadNextPage}
              disabled={loadingMore}
              activeOpacity={0.7}
            >
              {loadingMore ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : (
                <View style={styles.loadMoreContent}>
                  <Ionicons name="chevron-down" size={16} color={Colors.primary} />
                  <Text style={styles.loadMoreText}>Cargar más viajes</Text>
                  <Text style={styles.loadMoreSubtext}>
                    Página {currentPage} de {totalPages}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          )}

          <View style={{ height: Math.max(insets.bottom, 20) }} />
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
    paddingTop: 56,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6b7280',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
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
    fontSize: 22,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 13,
    color: '#9ca3af',
  },
  filterIconButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#f0fdf4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeFilters: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    padding: 10,
    backgroundColor: '#f0fdf4',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#9EF08A',
  },
  activeFiltersText: {
    fontSize: 12,
    color: Colors.primary,
    marginLeft: 8,
    flex: 1,
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  ridesList: {
    padding: 12,
    paddingBottom: 0,
  },
  rideCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  rideHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  rideHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#f0fdf4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rideHeaderInfo: {
    marginLeft: 10,
  },
  rideDate: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  rideTime: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 1,
  },
  rideFare: {
    alignItems: 'flex-end',
  },
  rideFareAmount: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.primary,
  },
  rideVehicleType: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 1,
  },
  delegatedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff7ed',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  delegatedBadgeText: {
    fontSize: 12,
    color: Colors.orange,
    marginLeft: 6,
    fontWeight: '600',
  },
  rideLocations: {
    marginBottom: 10,
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
    width: 2,
    height: 14,
    backgroundColor: '#e5e7eb',
    marginLeft: 3,
    marginVertical: 3,
  },
  locationText: {
    fontSize: 13,
    color: '#6b7280',
    flex: 1,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  cardFooterRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  driverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  driverName: {
    fontSize: 13,
    color: '#6b7280',
    marginLeft: 5,
  },
  ratingStars: {
    flexDirection: 'row',
    gap: 1,
  },
  myRating: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  driverRating: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  driverRatingText: {
    fontSize: 11,
    color: '#92400e',
    marginLeft: 2,
    fontWeight: '600',
  },
  conductorRatingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dbeafe',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  conductorRatingBadgeText: {
    fontSize: 11,
    color: '#1e40af',
    fontWeight: '600',
  },
  cancelledBadge: {
    backgroundColor: '#fef2f2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  cancelledBadgeText: {
    fontSize: 11,
    color: '#dc2626',
    fontWeight: '600',
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginTop: 16,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    fontSize: 13,
    color: '#9ca3af',
    marginTop: 6,
    textAlign: 'center',
  },
  loadMoreBtn: {
    alignItems: 'center',
    paddingVertical: 16,
    marginHorizontal: 12,
    marginTop: 4,
  },
  loadMoreContent: {
    alignItems: 'center',
    gap: 2,
  },
  loadMoreText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  loadMoreSubtext: {
    fontSize: 11,
    color: '#9ca3af',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    paddingTop: 20,
    maxHeight: '88%',
  },
  modalSafeContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    paddingTop: 20,
    maxHeight: '88%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailScroll: {
    maxHeight: '100%',
  },
  detailCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  detailCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 6,
  },
  detailCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.orange,
  },
  detailCardText: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 2,
  },
  detailCardSub: {
    fontSize: 12,
    color: '#9ca3af',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 6,
  },
  detailRowLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  detailRowValue: {
    fontSize: 14,
    color: '#1f2937',
    marginLeft: 'auto',
  },
  detailAddress: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
    marginBottom: 2,
    marginLeft: 21,
  },
  detailDivider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 10,
    marginLeft: 21,
  },
  detailDotPickup: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
  },
  detailFare: {
    fontSize: 26,
    fontWeight: '700',
    color: Colors.primary,
    marginLeft: 21,
    marginBottom: 8,
  },
  detailStats: {
    flexDirection: 'row',
    gap: 16,
    marginLeft: 21,
  },
  detailStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailStatText: {
    fontSize: 13,
    color: '#6b7280',
  },
  detailDriverName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginLeft: 21,
    marginBottom: 4,
  },
  detailDriverInfo: {
    flexDirection: 'row',
    marginLeft: 21,
    marginBottom: 6,
  },
  detailDriverDetail: {
    fontSize: 13,
    color: '#6b7280',
  },
  detailDriverDot: {
    fontSize: 13,
    color: '#d1d5db',
  },
  detailDriverRating: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 21,
    gap: 4,
  },
  detailDriverRatingText: {
    fontSize: 13,
    color: '#6b7280',
  },
  detailMyRating: {
    flexDirection: 'row',
    gap: 4,
    marginLeft: 21,
    marginBottom: 6,
  },
  detailConductorRatingStars: {
    flexDirection: 'row',
    gap: 4,
    marginLeft: 21,
    marginBottom: 6,
  },
  detailRatingComment: {
    fontSize: 13,
    color: '#6b7280',
    fontStyle: 'italic',
    marginLeft: 21,
  },
  detailCancelled: {
    fontSize: 14,
    fontWeight: '600',
    color: '#dc2626',
    marginLeft: 21,
    marginBottom: 4,
  },
  detailCancelledReason: {
    fontSize: 13,
    color: '#6b7280',
    marginLeft: 21,
    marginBottom: 2,
  },
  detailCancelledFee: {
    fontSize: 13,
    fontWeight: '600',
    color: '#dc2626',
    marginLeft: 21,
  },
  filterSection: {
    marginBottom: 14,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    backgroundColor: Colors.white,
  },
  dateButtonText: {
    fontSize: 14,
    color: '#6b7280',
    marginLeft: 10,
  },
  filterButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
    gap: 10,
  },
  filterButton: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterButtonPrimary: {
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  filterButtonSecondary: {
    backgroundColor: Colors.white,
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  filterButtonTextPrimary: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.white,
  },
  filterButtonTextSecondary: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
});
