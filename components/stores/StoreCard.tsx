import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Store } from '@/types/store';
import { Colors, Typography, BorderRadius, Spacing, Shadows } from '@/constants/theme';
import { getOptimizedImageUrl, getDefaultBlurhash } from '@/utils/imageUtils';

interface StoreCardProps {
  store: Store;
  onPress: () => void;
  showDistance?: boolean;
}

export const StoreCard = React.memo(function StoreCard({
  store,
  onPress,
  showDistance = true,
}: StoreCardProps) {
  // Render status badge for owner's stores
  const renderStatusBadge = () => {
    if (!store.status) return null;

    const statusConfig = {
      activa: { label: 'Activa', color: '#16a34a', bgColor: '#dcfce7' }, // Green
      'pendiente de aprobación': { label: 'Pendiente', color: '#ca8a04', bgColor: '#fef3c7' }, // Yellow
      rechazada: { label: 'Rechazada', color: '#dc2626', bgColor: '#fee2e2' }, // Red
      inactiva: { label: 'Inactiva', color: '#6b7280', bgColor: '#f3f4f6' }, // Gray
    };

    const config = statusConfig[store.status];
    if (!config) return null;

    // For rejected stores, show rejection reason as tooltip (if available)
    const showRejectionReason = store.status === 'rechazada' && store.rejection_reason;

    return (
      <View style={styles.statusBadgeContainer}>
        <View style={[styles.statusBadge, { backgroundColor: config.bgColor }]}>
          <Text style={[styles.statusText, { color: config.color }]}>{config.label}</Text>
          {showRejectionReason && (
            <Ionicons
              name="information-circle"
              size={12}
              color={config.color}
              style={{ marginLeft: 2 }}
            />
          )}
        </View>
        {showRejectionReason && (
          <Text style={styles.rejectionReasonTooltip} numberOfLines={2}>
            {store.rejection_reason}
          </Text>
        )}
      </View>
    );
  };

  // Render rating stars
  const renderRatingStars = () => {
    const rating = store.average_rating || 0;
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    const stars = [];

    for (let i = 0; i < 5; i++) {
      if (i < fullStars) {
        stars.push(<Ionicons key={i} name="star" size={14} color={Colors.warning} />);
      } else if (i === fullStars && hasHalfStar) {
        stars.push(<Ionicons key={i} name="star-half" size={14} color={Colors.warning} />);
      } else {
        stars.push(<Ionicons key={i} name="star-outline" size={14} color={Colors.lightGray} />);
      }
    }

    return (
      <View style={styles.ratingContainer}>
        <View style={styles.starsRow}>{stars}</View>
        <Text style={styles.ratingText}>
          {rating.toFixed(1)} ({store.review_count || 0})
        </Text>
      </View>
    );
  };

  // Render distance badge
  const renderDistanceBadge = () => {
    if (!showDistance || !store.distance) return null;

    return (
      <View style={styles.distanceBadge}>
        <Ionicons name="location" size={12} color={Colors.primary} />
        <Text style={styles.distanceText}>
          {store.distance < 1
            ? `${(store.distance * 1000).toFixed(0)}m`
            : `${store.distance.toFixed(1)}km`}
        </Text>
      </View>
    );
  };

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      {/* Logo Image */}
      <View style={styles.logoContainer}>
        <Image
          source={{
            uri: getOptimizedImageUrl(store.logo_url || 'https://via.placeholder.com/80', 'list'),
          }}
          style={styles.logo}
          contentFit="cover"
          transition={200}
          placeholder={{ blurhash: getDefaultBlurhash() }}
          cachePolicy="memory-disk"
          priority="normal"
        />
        {renderDistanceBadge()}
      </View>

      {/* Store Info */}
      <View style={styles.infoContainer}>
        <View style={styles.headerRow}>
          <Text style={styles.storeName} numberOfLines={1}>
            {store.name}
          </Text>
          {renderStatusBadge()}
        </View>

        <Text style={styles.category} numberOfLines={1}>
          {store.category?.name || 'Sin categoría'}
        </Text>

        {renderRatingStars()}
      </View>

      {/* Chevron Icon */}
      <Ionicons name="chevron-forward" size={20} color={Colors.lightGray} style={styles.chevron} />
    </TouchableOpacity>
  );
});
const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    ...Shadows.sm,
  },
  logoContainer: {
    position: 'relative',
    marginRight: Spacing.md,
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.lightGray,
  },
  distanceBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
    ...Shadows.sm,
  },
  distanceText: {
    ...Typography.caption,
    color: Colors.primary,
    fontWeight: '600',
    marginLeft: 2,
  },
  infoContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  storeName: {
    ...Typography.h3,
    fontSize: 18,
    flex: 1,
    marginRight: Spacing.sm,
  },
  statusBadgeContainer: {
    position: 'relative',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusText: {
    ...Typography.caption,
    fontWeight: '600',
    fontSize: 11,
  },
  rejectionReasonTooltip: {
    position: 'absolute',
    top: 24,
    right: 0,
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#dc2626',
    borderRadius: BorderRadius.sm,
    padding: 6,
    maxWidth: 200,
    ...Typography.caption,
    color: '#dc2626',
    fontSize: 10,
    zIndex: 10,
  },
  category: {
    ...Typography.bodySmall,
    color: Colors.mediumGray,
    marginBottom: 6,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  starsRow: {
    flexDirection: 'row',
    marginRight: 6,
  },
  ratingText: {
    ...Typography.caption,
    color: Colors.mediumGray,
    fontWeight: '500',
  },
  chevron: {
    marginLeft: Spacing.sm,
  },
});
