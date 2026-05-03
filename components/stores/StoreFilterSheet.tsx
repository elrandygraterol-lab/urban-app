import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Switch,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StoreFilters, StoreCategory } from '@/types/store';
import { Colors, Typography, BorderRadius, Spacing, Shadows } from '@/constants/theme';

interface StoreFilterSheetProps {
  visible: boolean;
  currentFilters: StoreFilters;
  categories: StoreCategory[];
  onApply: (filters: StoreFilters) => void;
  onClear: () => void;
  onClose: () => void;
}

export const StoreFilterSheet: React.FC<StoreFilterSheetProps> = ({
  visible,
  currentFilters,
  categories,
  onApply,
  onClear,
  onClose,
}) => {
  const [localFilters, setLocalFilters] = useState<StoreFilters>(currentFilters);

  // Update local filters when currentFilters prop changes
  useEffect(() => {
    setLocalFilters(currentFilters);
  }, [currentFilters, visible]);

  // Calculate active filter count
  const getActiveFilterCount = (): number => {
    let count = 0;
    if (localFilters.categories.length > 0) count++;
    if (localFilters.distanceRange && localFilters.distanceRange < 50) count++;
    if (localFilters.ratingRange && localFilters.ratingRange > 1) count++;
    if (localFilters.openNow) count++;
    return count;
  };

  const activeCount = getActiveFilterCount();

  // Toggle category selection
  const toggleCategory = (categoryId: number) => {
    const categories = [...localFilters.categories];
    const index = categories.indexOf(categoryId);
    
    if (index > -1) {
      categories.splice(index, 1);
    } else {
      categories.push(categoryId);
    }
    
    setLocalFilters({ ...localFilters, categories });
  };

  // Handle apply filters
  const handleApply = () => {
    onApply(localFilters);
    onClose();
  };

  // Handle clear all filters
  const handleClear = () => {
    const clearedFilters: StoreFilters = {
      categories: [],
      distanceRange: undefined,
      ratingRange: undefined,
      openNow: false,
    };
    setLocalFilters(clearedFilters);
    onClear();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>Filtros</Text>
            {activeCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{activeCount}</Text>
              </View>
            )}
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={28} color={Colors.darkGray} />
          </TouchableOpacity>
        </View>

        {/* Content */}
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Categories Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Categorías</Text>
            <View style={styles.categoryGrid}>
              {categories
                .filter((cat) => cat.is_active)
                .map((category) => {
                  const isSelected = localFilters.categories.includes(category.category_id);
                  return (
                    <TouchableOpacity
                      key={category.category_id}
                      style={[
                        styles.categoryChip,
                        isSelected && styles.categoryChipSelected,
                      ]}
                      onPress={() => toggleCategory(category.category_id)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.categoryChipText,
                          isSelected && styles.categoryChipTextSelected,
                        ]}
                        numberOfLines={1}
                      >
                        {category.name}
                      </Text>
                      {isSelected && (
                        <Ionicons name="checkmark-circle" size={16} color={Colors.primary} />
                      )}
                    </TouchableOpacity>
                  );
                })}
            </View>
          </View>

          {/* Distance Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Distancia máxima</Text>
              <Text style={styles.sectionValue}>
                {localFilters.distanceRange || 50} km
              </Text>
            </View>
            <CustomSlider
              value={localFilters.distanceRange || 50}
              minimumValue={1}
              maximumValue={50}
              step={1}
              onValueChange={(value) =>
                setLocalFilters({ ...localFilters, distanceRange: value })
              }
            />
          </View>

          {/* Rating Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Calificación mínima</Text>
              <View style={styles.ratingValue}>
                {[...Array(5)].map((_, index) => (
                  <Ionicons
                    key={index}
                    name={index < (localFilters.ratingRange || 1) ? 'star' : 'star-outline'}
                    size={16}
                    color={Colors.warning}
                  />
                ))}
              </View>
            </View>
            <CustomSlider
              value={localFilters.ratingRange || 1}
              minimumValue={1}
              maximumValue={5}
              step={1}
              onValueChange={(value) =>
                setLocalFilters({ ...localFilters, ratingRange: value })
              }
            />
          </View>

          {/* Open Now Section */}
          <View style={styles.section}>
            <View style={styles.toggleRow}>
              <View style={styles.toggleLeft}>
                <Ionicons name="time-outline" size={24} color={Colors.primary} />
                <View style={styles.toggleTextContainer}>
                  <Text style={styles.toggleTitle}>Abiertas ahora</Text>
                  <Text style={styles.toggleSubtitle}>
                    Mostrar solo tiendas abiertas
                  </Text>
                </View>
              </View>
              <Switch
                value={localFilters.openNow || false}
                onValueChange={(value) =>
                  setLocalFilters({ ...localFilters, openNow: value })
                }
                trackColor={{ false: Colors.lightGray, true: Colors.primaryLight }}
                thumbColor={localFilters.openNow ? Colors.primary : Colors.white}
              />
            </View>
          </View>
        </ScrollView>

        {/* Footer Buttons */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.clearButton}
            onPress={handleClear}
            activeOpacity={0.7}
          >
            <Text style={styles.clearButtonText}>Limpiar todo</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.applyButton}
            onPress={handleApply}
            activeOpacity={0.7}
          >
            <Text style={styles.applyButtonText}>Aplicar filtros</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

// Custom Slider Component
interface CustomSliderProps {
  value: number;
  minimumValue: number;
  maximumValue: number;
  step: number;
  onValueChange: (value: number) => void;
}

const CustomSlider: React.FC<CustomSliderProps> = ({
  value,
  minimumValue,
  maximumValue,
  step,
  onValueChange,
}) => {
  const [sliderWidth, setSliderWidth] = useState(0);

  const percentage = ((value - minimumValue) / (maximumValue - minimumValue)) * 100;

  const handlePress = (event: any) => {
    const { locationX } = event.nativeEvent;
    const newValue = Math.round(
      (locationX / sliderWidth) * (maximumValue - minimumValue) + minimumValue
    );
    const steppedValue = Math.round(newValue / step) * step;
    const clampedValue = Math.max(minimumValue, Math.min(maximumValue, steppedValue));
    onValueChange(clampedValue);
  };

  return (
    <View
      style={styles.sliderContainer}
      onLayout={(event) => setSliderWidth(event.nativeEvent.layout.width)}
    >
      <TouchableOpacity
        style={styles.sliderTrack}
        onPress={handlePress}
        activeOpacity={1}
      >
        <View style={styles.sliderTrackInactive} />
        <View style={[styles.sliderTrackActive, { width: `${percentage}%` }]} />
        <View style={[styles.sliderThumb, { left: `${percentage}%` }]} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    ...Typography.h2,
    fontSize: 22,
  },
  badge: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Spacing.sm,
  },
  badgeText: {
    ...Typography.caption,
    color: Colors.white,
    fontWeight: '700',
    fontSize: 12,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  section: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    ...Typography.h3,
    fontSize: 16,
  },
  sectionValue: {
    ...Typography.body,
    color: Colors.primary,
    fontWeight: '600',
  },
  ratingValue: {
    flexDirection: 'row',
    gap: 2,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.full,
    borderWidth: 2,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.xs,
    ...Shadows.sm,
  },
  categoryChipSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.light,
  },
  categoryChipText: {
    ...Typography.bodySmall,
    color: Colors.darkGray,
    fontWeight: '500',
  },
  categoryChipTextSelected: {
    color: Colors.primary,
    fontWeight: '600',
  },
  sliderContainer: {
    height: 40,
    justifyContent: 'center',
  },
  sliderTrack: {
    height: 4,
    position: 'relative',
  },
  sliderTrackInactive: {
    position: 'absolute',
    width: '100%',
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
  },
  sliderTrackActive: {
    position: 'absolute',
    height: 4,
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },
  sliderThumb: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    marginLeft: -12,
    marginTop: -10,
    ...Shadows.md,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    ...Shadows.sm,
  },
  toggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  toggleTextContainer: {
    marginLeft: Spacing.md,
    flex: 1,
  },
  toggleTitle: {
    ...Typography.body,
    fontWeight: '600',
    marginBottom: 2,
  },
  toggleSubtitle: {
    ...Typography.caption,
    color: Colors.mediumGray,
  },
  footer: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    ...Shadows.md,
  },
  clearButton: {
    flex: 1,
    height: 56,
    borderRadius: BorderRadius.full,
    borderWidth: 2,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearButtonText: {
    ...Typography.button,
    color: Colors.primary,
  },
  applyButton: {
    flex: 1,
    height: 56,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyButtonText: {
    ...Typography.button,
    color: Colors.white,
  },
});
