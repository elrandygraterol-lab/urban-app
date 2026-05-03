import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Alert,
  FlatList,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { useStoreStore } from '@/store/storeStore';
import { useReviewStore } from '@/store/reviewStore';
import { useAuthStore } from '@/store/authStore';
import { trackEvent } from '@/services/storeApi';
import { StoreImageGallery } from '@/components/stores/StoreImageGallery';
import RatingDialog from '@/components/stores/RatingDialog';
import { Colors, Typography, BorderRadius, Spacing, Shadows } from '@/constants/theme';
import type { Store, StoreReview, BusinessHours, DayHours } from '@/types/store';

export default function StoreDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const storeId = parseInt(id || '0', 10);

  const { selectedStore, loading: storeLoading, fetchStoreById } = useStoreStore();
  const {
    reviews,
    loading: reviewsLoading,
    fetchReviews,
    createReview,
    updateReview,
    deleteReview,
  } = useReviewStore();
  const { user } = useAuthStore();

  const [showRatingDialog, setShowRatingDialog] = useState(false);
  const [userReview, setUserReview] = useState<StoreReview | undefined>(undefined);
  const [isOpen, setIsOpen] = useState<boolean | null>(null);

  // Fetch store details and reviews on mount
  useEffect(() => {
    if (storeId) {
      fetchStoreById(storeId, true);
      fetchReviews(storeId);
      
      // Track view event
      trackEvent(storeId, { event_type: 'view' }).catch(err => 
        console.error('Failed to track view event:', err)
      );
    }
  }, [storeId]);

  // Calculate if store is currently open
  useEffect(() => {
    if (selectedStore?.business_hours) {
      const isCurrentlyOpen = calculateIsOpen(selectedStore.business_hours);
      setIsOpen(isCurrentlyOpen);
    }
  }, [selectedStore]);

  // Find user's review
  useEffect(() => {
    if (user && reviews.length > 0) {
      const myReview = reviews.find(r => r.user_id === parseInt(user.id, 10));
      setUserReview(myReview);
    } else {
      setUserReview(undefined);
    }
  }, [reviews, user]);

  // Calculate if store is open based on business hours
  const calculateIsOpen = (businessHours: BusinessHours): boolean => {
    const now = new Date();
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const currentDay = dayNames[now.getDay()] as keyof BusinessHours;
    const dayHours = businessHours[currentDay];

    if (!dayHours || dayHours.closed) {
      return false;
    }

    if (!dayHours.open || !dayHours.close) {
      return false;
    }

    const currentTime = now.getHours() * 60 + now.getMinutes();
    const [openHour, openMin] = dayHours.open.split(':').map(Number);
    const [closeHour, closeMin] = dayHours.close.split(':').map(Number);
    const openTime = openHour * 60 + openMin;
    const closeTime = closeHour * 60 + closeMin;

    return currentTime >= openTime && currentTime <= closeTime;
  };

  // Handle call button
  const handleCall = useCallback(async () => {
    if (!selectedStore?.phone) return;

    try {
      await trackEvent(storeId, { event_type: 'call' });
      const phoneUrl = `tel:${selectedStore.phone}`;
      const canOpen = await Linking.canOpenURL(phoneUrl);
      
      if (canOpen) {
        await Linking.openURL(phoneUrl);
      } else {
        Alert.alert('Error', 'No se puede abrir el marcador telefónico');
      }
    } catch (error) {
      console.error('Error opening phone dialer:', error);
      Alert.alert('Error', 'No se pudo realizar la llamada');
    }
  }, [selectedStore, storeId]);

  // Handle directions button
  const handleDirections = useCallback(async () => {
    if (!selectedStore?.latitude || !selectedStore?.longitude) {
      Alert.alert('Error', 'Ubicación no disponible');
      return;
    }

    try {
      await trackEvent(storeId, { event_type: 'directions' });
      
      const scheme = Platform.select({
        ios: 'maps:',
        android: 'geo:',
      });
      const url = Platform.select({
        ios: `${scheme}?q=${selectedStore.latitude},${selectedStore.longitude}&ll=${selectedStore.latitude},${selectedStore.longitude}`,
        android: `${scheme}${selectedStore.latitude},${selectedStore.longitude}?q=${selectedStore.latitude},${selectedStore.longitude}(${selectedStore.name})`,
      });

      if (url) {
        const canOpen = await Linking.canOpenURL(url);
        if (canOpen) {
          await Linking.openURL(url);
        } else {
          // Fallback to Google Maps web
          const webUrl = `https://www.google.com/maps/search/?api=1&query=${selectedStore.latitude},${selectedStore.longitude}`;
          await Linking.openURL(webUrl);
        }
      }
    } catch (error) {
      console.error('Error opening maps:', error);
      Alert.alert('Error', 'No se pudo abrir el mapa');
    }
  }, [selectedStore, storeId]);

  // Handle rate button
  const handleRate = useCallback(() => {
    setShowRatingDialog(true);
  }, []);

  // Handle review submission
  const handleReviewSubmit = async (rating: number, comment?: string) => {
    try {
      if (userReview) {
        // Update existing review
        await updateReview(userReview.review_id, { rating, comment });
        Alert.alert('Éxito', 'Tu calificación ha sido actualizada');
      } else {
        // Create new review
        await createReview(storeId, { rating, comment });
        Alert.alert('Éxito', 'Tu calificación ha sido enviada');
      }
      
      setShowRatingDialog(false);
      
      // Refresh store details to get updated rating and review count
      // This ensures the store's average_rating and review_count are updated
      await fetchStoreById(storeId, true);
      
      // Refresh reviews list to show the new/updated review
      await fetchReviews(storeId);
    } catch (error) {
      console.error('Error submitting review:', error);
      // Error is already handled in the store
    }
  };

  // Handle review deletion
  const handleDeleteReview = useCallback(async (reviewId: number) => {
    Alert.alert(
      'Eliminar Calificación',
      '¿Estás seguro de que deseas eliminar tu calificación?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteReview(reviewId);
              Alert.alert('Éxito', 'Tu calificación ha sido eliminada');
              
              // Refresh store details to get updated rating and review count
              await fetchStoreById(storeId, true);
              
              // Refresh reviews list (review is already removed from local state by reviewStore)
              await fetchReviews(storeId);
            } catch (error) {
              console.error('Error deleting review:', error);
            }
          },
        },
      ]
    );
  }, [storeId]);

  // Render rating stars
  const renderRatingStars = (rating: number, size: number = 16) => {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    const stars = [];

    for (let i = 0; i < 5; i++) {
      if (i < fullStars) {
        stars.push(<Ionicons key={i} name="star" size={size} color={Colors.warning} />);
      } else if (i === fullStars && hasHalfStar) {
        stars.push(<Ionicons key={i} name="star-half" size={size} color={Colors.warning} />);
      } else {
        stars.push(<Ionicons key={i} name="star-outline" size={size} color={Colors.lightGray} />);
      }
    }

    return <View style={styles.starsRow}>{stars}</View>;
  };

  // Render business hours
  const renderBusinessHours = () => {
    if (!selectedStore?.business_hours) return null;

    const dayNames: { key: keyof BusinessHours; label: string }[] = [
      { key: 'monday', label: 'Lunes' },
      { key: 'tuesday', label: 'Martes' },
      { key: 'wednesday', label: 'Miércoles' },
      { key: 'thursday', label: 'Jueves' },
      { key: 'friday', label: 'Viernes' },
      { key: 'saturday', label: 'Sábado' },
      { key: 'sunday', label: 'Domingo' },
    ];

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Horario</Text>
        
        {/* Current Status Badge */}
        {isOpen !== null && (
          <View style={[styles.statusBadge, isOpen ? styles.openBadge : styles.closedBadge]}>
            <Ionicons 
              name={isOpen ? 'time' : 'time-outline'} 
              size={16} 
              color={isOpen ? Colors.success : Colors.error} 
            />
            <Text style={[styles.statusText, isOpen ? styles.openText : styles.closedText]}>
              {isOpen ? 'Abierto ahora' : 'Cerrado'}
            </Text>
          </View>
        )}

        {/* Hours for each day */}
        <View style={styles.hoursContainer}>
          {dayNames.map(({ key, label }) => {
            const dayHours = selectedStore.business_hours![key];
            return (
              <View key={key} style={styles.hourRow}>
                <Text style={styles.dayLabel}>{label}</Text>
                <Text style={styles.hourText}>
                  {dayHours.closed
                    ? 'Cerrado'
                    : `${dayHours.open} - ${dayHours.close}`}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  // Render review item
  const renderReviewItem = ({ item }: { item: StoreReview }) => {
    const isMyReview = item.review_id === userReview?.review_id;
    const reviewDate = new Date(item.created_at).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    return (
      <View style={styles.reviewItem}>
        <View style={styles.reviewHeader}>
          <View style={styles.reviewUserInfo}>
            <View style={styles.reviewAvatar}>
              <Ionicons name="person" size={20} color={Colors.white} />
            </View>
            <View style={styles.reviewUserDetails}>
              <Text style={styles.reviewUserName}>{item.user_name || 'Usuario'}</Text>
              <Text style={styles.reviewDate}>{reviewDate}</Text>
            </View>
          </View>
          
          {isMyReview && (
            <View style={styles.reviewActions}>
              <TouchableOpacity
                onPress={() => setShowRatingDialog(true)}
                style={styles.reviewActionButton}
              >
                <Ionicons name="create-outline" size={20} color={Colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleDeleteReview(item.review_id)}
                style={styles.reviewActionButton}
              >
                <Ionicons name="trash-outline" size={20} color={Colors.error} />
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.reviewRating}>
          {renderRatingStars(item.rating, 14)}
        </View>

        {item.comment && (
          <Text style={styles.reviewComment}>{item.comment}</Text>
        )}
      </View>
    );
  };

  // Loading state
  if (storeLoading && !selectedStore) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Cargando tienda...</Text>
      </View>
    );
  }

  // Error state
  if (!selectedStore) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={64} color={Colors.error} />
        <Text style={styles.errorText}>No se pudo cargar la tienda</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => fetchStoreById(storeId, true)}>
          <Text style={styles.retryButtonText}>Reintentar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Store Header */}
        <View style={styles.header}>
          {/* Back Button */}
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={Colors.darkGray} />
          </TouchableOpacity>

          {/* Logo and Basic Info */}
          <View style={styles.headerContent}>
            <Image
              source={{ uri: selectedStore.logo_url || 'https://via.placeholder.com/100' }}
              style={styles.logo}
              contentFit="cover"
              transition={200}
              placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
            />
            
            <View style={styles.headerInfo}>
              <Text style={styles.storeName}>{selectedStore.name}</Text>
              
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryText}>{selectedStore.category?.name || 'Sin categoría'}</Text>
              </View>

              <View style={styles.ratingContainer}>
                {renderRatingStars(selectedStore.average_rating, 18)}
                <Text style={styles.ratingText}>
                  {selectedStore.average_rating.toFixed(1)} ({selectedStore.review_count} reseñas)
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Image Gallery */}
        {selectedStore.images && selectedStore.images.length > 0 && (
          <View style={styles.section}>
            <StoreImageGallery images={selectedStore.images} />
          </View>
        )}

        {/* Description */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Descripción</Text>
          <Text style={styles.description}>{selectedStore.description}</Text>
        </View>

        {/* Contact Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Información de Contacto</Text>
          
          {/* Address */}
          <View style={styles.infoRow}>
            <Ionicons name="location" size={20} color={Colors.primary} />
            <Text style={styles.infoText}>{selectedStore.address}</Text>
          </View>

          {/* Phone */}
          <View style={styles.infoRow}>
            <Ionicons name="call" size={20} color={Colors.primary} />
            <Text style={styles.infoText}>{selectedStore.phone}</Text>
          </View>

          {/* Email */}
          {selectedStore.email && (
            <View style={styles.infoRow}>
              <Ionicons name="mail" size={20} color={Colors.primary} />
              <Text style={styles.infoText}>{selectedStore.email}</Text>
            </View>
          )}

          {/* Website */}
          {selectedStore.website && (
            <View style={styles.infoRow}>
              <Ionicons name="globe" size={20} color={Colors.primary} />
              <Text style={styles.infoText}>{selectedStore.website}</Text>
            </View>
          )}
        </View>

        {/* Map */}
        {selectedStore.latitude && selectedStore.longitude && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Ubicación</Text>
            <View style={styles.mapContainer}>
              <MapView
                style={styles.map}
                provider={PROVIDER_GOOGLE}
                initialRegion={{
                  latitude: selectedStore.latitude,
                  longitude: selectedStore.longitude,
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01,
                }}
                scrollEnabled={false}
                zoomEnabled={false}
                pitchEnabled={false}
                rotateEnabled={false}
              >
                <Marker
                  coordinate={{
                    latitude: selectedStore.latitude,
                    longitude: selectedStore.longitude,
                  }}
                  title={selectedStore.name}
                  description={selectedStore.address}
                />
              </MapView>
            </View>
          </View>
        )}

        {/* Business Hours */}
        {renderBusinessHours()}

        {/* Action Buttons */}
        <View style={styles.section}>
          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.actionButton} onPress={handleCall}>
              <Ionicons name="call" size={24} color={Colors.white} />
              <Text style={styles.actionButtonText}>Llamar</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={handleDirections}>
              <Ionicons name="navigate" size={24} color={Colors.white} />
              <Text style={styles.actionButtonText}>Cómo llegar</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={handleRate}>
              <Ionicons name="star" size={24} color={Colors.white} />
              <Text style={styles.actionButtonText}>Calificar</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Reviews Section */}
        <View style={styles.section}>
          <View style={styles.reviewsHeader}>
            <Text style={styles.sectionTitle}>Reseñas</Text>
            {!userReview && (
              <TouchableOpacity onPress={handleRate}>
                <Text style={styles.writeReviewButton}>Escribir reseña</Text>
              </TouchableOpacity>
            )}
          </View>

          {reviewsLoading && reviews.length === 0 ? (
            <ActivityIndicator size="small" color={Colors.primary} style={styles.reviewsLoader} />
          ) : reviews.length === 0 ? (
            <View style={styles.emptyReviews}>
              <Ionicons name="chatbubbles-outline" size={48} color={Colors.lightGray} />
              <Text style={styles.emptyReviewsText}>No hay reseñas aún</Text>
              <Text style={styles.emptyReviewsSubtext}>Sé el primero en calificar esta tienda</Text>
            </View>
          ) : (
            <FlatList
              data={reviews}
              renderItem={renderReviewItem}
              keyExtractor={(item) => item.review_id.toString()}
              scrollEnabled={false}
              ItemSeparatorComponent={() => <View style={styles.reviewSeparator} />}
            />
          )}
        </View>
      </ScrollView>

      {/* Rating Dialog */}
      <RatingDialog
        visible={showRatingDialog}
        storeId={storeId}
        existingReview={userReview}
        onSubmit={handleReviewSubmit}
        onCancel={() => setShowRatingDialog(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  loadingText: {
    ...Typography.body,
    color: Colors.mediumGray,
    marginTop: Spacing.md,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
    padding: Spacing.xl,
  },
  errorText: {
    ...Typography.h3,
    color: Colors.error,
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  retryButtonText: {
    ...Typography.button,
    color: Colors.white,
  },
  header: {
    backgroundColor: Colors.white,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: Spacing.lg,
    ...Shadows.sm,
  },
  backButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 20,
    left: Spacing.md,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.sm,
  },
  headerContent: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  logo: {
    width: 100,
    height: 100,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.lightGray,
  },
  headerInfo: {
    flex: 1,
    marginLeft: Spacing.md,
    justifyContent: 'center',
  },
  storeName: {
    ...Typography.h2,
    marginBottom: Spacing.xs,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.primary + '20',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.sm,
  },
  categoryText: {
    ...Typography.caption,
    color: Colors.primary,
    fontWeight: '600',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  starsRow: {
    flexDirection: 'row',
    marginRight: Spacing.xs,
  },
  ratingText: {
    ...Typography.bodySmall,
    color: Colors.mediumGray,
    marginLeft: Spacing.xs,
  },
  section: {
    backgroundColor: Colors.white,
    padding: Spacing.lg,
    marginTop: Spacing.sm,
  },
  sectionTitle: {
    ...Typography.h3,
    marginBottom: Spacing.md,
  },
  description: {
    ...Typography.body,
    color: Colors.darkGray,
    lineHeight: 24,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  infoText: {
    ...Typography.body,
    color: Colors.darkGray,
    marginLeft: Spacing.md,
    flex: 1,
  },
  mapContainer: {
    height: 200,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    ...Shadows.sm,
  },
  map: {
    flex: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  openBadge: {
    backgroundColor: Colors.success + '20',
  },
  closedBadge: {
    backgroundColor: Colors.error + '20',
  },
  statusText: {
    ...Typography.bodySmall,
    fontWeight: '600',
    marginLeft: Spacing.xs,
  },
  openText: {
    color: Colors.success,
  },
  closedText: {
    color: Colors.error,
  },
  hoursContainer: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  hourRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray + '40',
  },
  dayLabel: {
    ...Typography.body,
    color: Colors.darkGray,
    fontWeight: '500',
  },
  hourText: {
    ...Typography.body,
    color: Colors.mediumGray,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  actionButton: {
    flex: 1,
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
  },
  actionButtonText: {
    ...Typography.button,
    color: Colors.white,
    marginTop: 4,
    fontSize: 12,
  },
  reviewsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  writeReviewButton: {
    ...Typography.bodySmall,
    color: Colors.primary,
    fontWeight: '600',
  },
  reviewsLoader: {
    marginVertical: Spacing.lg,
  },
  emptyReviews: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  emptyReviewsText: {
    ...Typography.h3,
    color: Colors.mediumGray,
    marginTop: Spacing.md,
  },
  emptyReviewsSubtext: {
    ...Typography.bodySmall,
    color: Colors.lightGray,
    marginTop: Spacing.xs,
  },
  reviewItem: {
    paddingVertical: Spacing.md,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  reviewUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  reviewAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reviewUserDetails: {
    marginLeft: Spacing.md,
    flex: 1,
  },
  reviewUserName: {
    ...Typography.bodySmall,
    fontWeight: '600',
    color: Colors.darkGray,
  },
  reviewDate: {
    ...Typography.caption,
    color: Colors.mediumGray,
    marginTop: 2,
  },
  reviewActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  reviewActionButton: {
    padding: Spacing.xs,
  },
  reviewRating: {
    marginBottom: Spacing.sm,
  },
  reviewComment: {
    ...Typography.body,
    color: Colors.darkGray,
    lineHeight: 22,
  },
  reviewSeparator: {
    height: 1,
    backgroundColor: Colors.lightGray + '40',
    marginVertical: Spacing.sm,
  },
});
