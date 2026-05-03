import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useStoreStore } from '@/store/storeStore';
import { StoreCard } from '@/components/stores/StoreCard';
import { StoreFilterSheet } from '@/components/stores/StoreFilterSheet';
import { StoreMapView } from '@/components/stores/StoreMapView';
import { Colors, Typography, BorderRadius, Spacing, Shadows } from '@/constants/theme';
import type { Store, StoreFilters } from '@/types/store';

type SortOption = 'distance' | 'name' | 'rating' | 'newest';

export default function StoresListScreen() {
  const router = useRouter();
  const {
    stores,
    categories,
    filters,
    loading,
    error,
    currentPage,
    totalPages,
    fetchStores,
    fetchCategories,
    setFilters,
    clearFilters,
  } = useStoreStore();

  // Local state
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedSort, setSelectedSort] = useState<SortOption>('distance');
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [showMapView, setShowMapView] = useState(false);

  // Refs
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initialize: fetch categories and stores
  useEffect(() => {
    fetchCategories();
    fetchStores({ sort: selectedSort });
  }, []);

  // Debounce search input (300ms)
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  // Fetch stores when debounced search or filters change
  useEffect(() => {
    const params = {
      search: debouncedSearch || undefined,
      sort: selectedSort,
      category_id: filters.categories.length > 0 ? filters.categories[0] : undefined,
      min_rating: filters.ratingRange,
      open_now: filters.openNow,
      radius: filters.distanceRange,
      page: 1,
      limit: 20,
    };

    fetchStores(params, true);
  }, [debouncedSearch, selectedSort, filters]);

  // Calculate active filter count
  const getActiveFilterCount = (): number => {
    let count = 0;
    if (filters.categories.length > 0) count++;
    if (filters.distanceRange && filters.distanceRange < 50) count++;
    if (filters.ratingRange && filters.ratingRange > 1) count++;
    if (filters.openNow) count++;
    return count;
  };

  const activeFilterCount = getActiveFilterCount();

  // Handle pull to refresh
  const handleRefresh = useCallback(() => {
    const params = {
      search: debouncedSearch || undefined,
      sort: selectedSort,
      category_id: filters.categories.length > 0 ? filters.categories[0] : undefined,
      min_rating: filters.ratingRange,
      open_now: filters.openNow,
      radius: filters.distanceRange,
      page: 1,
      limit: 20,
    };
    fetchStores(params, true);
  }, [debouncedSearch, selectedSort, filters]);

  // Handle infinite scroll pagination
  const handleLoadMore = useCallback(async () => {
    if (isLoadingMore || loading || currentPage >= totalPages) {
      return;
    }

    setIsLoadingMore(true);
    try {
      const params = {
        search: debouncedSearch || undefined,
        sort: selectedSort,
        category_id: filters.categories.length > 0 ? filters.categories[0] : undefined,
        min_rating: filters.ratingRange,
        open_now: filters.openNow,
        radius: filters.distanceRange,
        page: currentPage + 1,
        limit: 20,
      };
      await fetchStores(params, false);
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, loading, currentPage, totalPages, debouncedSearch, selectedSort, filters]);

  // Handle store card press
  const handleStorePress = useCallback((store: Store) => {
    router.push(`/(passenger)/stores/${store.store_id}`);
  }, [router]);

  // Render store item (memoized)
  const renderStoreItem = useCallback(({ item }: { item: Store }) => (
    <StoreCard
      store={item}
      onPress={() => handleStorePress(item)}
      showDistance={true}
    />
  ), [handleStorePress]);

  // Get item layout for FlatList optimization
  const getItemLayout = useCallback((data: any, index: number) => ({
    length: 120, // Approximate height of StoreCard
    offset: 120 * index,
    index,
  }), []);

  // Key extractor for FlatList optimization
  const keyExtractor = useCallback((item: Store) => item.store_id.toString(), []);

  // Handle filter apply
  const handleApplyFilters = (newFilters: StoreFilters) => {
    setFilters(newFilters);
  };

  // Handle clear filters
  const handleClearFilters = () => {
    clearFilters();
    setSearchQuery('');
    setDebouncedSearch('');
  };

  // Handle sort change
  const handleSortChange = (sort: SortOption) => {
    setSelectedSort(sort);
  };

  // Render category filter chips
  const renderCategoryChips = () => {
    const activeCategories = (categories ?? []).filter((cat) => cat.is_active);

    return (
      <View style={styles.categoryChipsContainer}>
        <FlatList
          horizontal
          data={activeCategories}
          keyExtractor={(item) => item.category_id.toString()}
          renderItem={({ item }) => {
            const isSelected = filters.categories.includes(item.category_id);
            return (
              <TouchableOpacity
                style={[
                  styles.categoryChip,
                  isSelected && styles.categoryChipSelected,
                ]}
                onPress={() => {
                  const newCategories = isSelected
                    ? filters.categories.filter((id) => id !== item.category_id)
                    : [...filters.categories, item.category_id];
                  setFilters({ ...filters, categories: newCategories });
                }}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.categoryChipText,
                    isSelected && styles.categoryChipTextSelected,
                  ]}
                >
                  {item.name}
                </Text>
              </TouchableOpacity>
            );
          }}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryChipsContent}
        />
      </View>
    );
  };

  // Render sort dropdown
  const renderSortDropdown = () => {
    const sortOptions: { value: SortOption; label: string; icon: string }[] = [
      { value: 'distance', label: 'Distancia', icon: 'location' },
      { value: 'name', label: 'Nombre', icon: 'text' },
      { value: 'rating', label: 'Calificación', icon: 'star' },
      { value: 'newest', label: 'Más recientes', icon: 'time' },
    ];

    return (
      <View style={styles.sortContainer}>
        {sortOptions.map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.sortOption,
              selectedSort === option.value && styles.sortOptionSelected,
            ]}
            onPress={() => handleSortChange(option.value)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={option.icon as any}
              size={16}
              color={selectedSort === option.value ? Colors.primary : Colors.mediumGray}
            />
            <Text
              style={[
                styles.sortOptionText,
                selectedSort === option.value && styles.sortOptionTextSelected,
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  // Render empty state
  const renderEmptyState = () => {
    if (loading && stores.length === 0) {
      return null;
    }

    return (
      <View style={styles.emptyState}>
        <Ionicons name="storefront-outline" size={80} color={Colors.lightGray} />
        <Text style={styles.emptyStateTitle}>No se encontraron tiendas</Text>
        <Text style={styles.emptyStateSubtitle}>
          {searchQuery || activeFilterCount > 0
            ? 'Intenta ajustar tus filtros o búsqueda'
            : 'No hay tiendas disponibles en este momento'}
        </Text>
        {(searchQuery || activeFilterCount > 0) && (
          <TouchableOpacity
            style={styles.clearFiltersButton}
            onPress={handleClearFilters}
            activeOpacity={0.7}
          >
            <Text style={styles.clearFiltersButtonText}>Limpiar filtros</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // Render loading indicator
  const renderFooter = () => {
    if (!isLoadingMore) return null;

    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={Colors.primary} />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Tiendas</Text>
        <Text style={styles.headerSubtitle}>Descubre tiendas y servicios cercanos</Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search" size={20} color={Colors.mediumGray} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar tiendas..."
            placeholderTextColor={Colors.placeholder}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                setSearchQuery('');
                setDebouncedSearch('');
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close-circle" size={20} color={Colors.mediumGray} />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter Button */}
        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setShowFilterSheet(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="options" size={20} color={Colors.white} />
          {activeFilterCount > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Map View Toggle */}
        <TouchableOpacity
          style={styles.mapToggleButton}
          onPress={() => setShowMapView(!showMapView)}
          activeOpacity={0.7}
        >
          <Ionicons
            name={showMapView ? 'list' : 'map'}
            size={20}
            color={Colors.white}
          />
        </TouchableOpacity>
      </View>

      {/* Conditional Rendering: Map View or List View */}
      {showMapView ? (
        <StoreMapView
          stores={stores}
          loading={loading}
          onRefresh={handleRefresh}
        />
      ) : (
        <>
          {/* Category Filter Chips */}
          {renderCategoryChips()}

          {/* Sort Dropdown */}
          {renderSortDropdown()}

          {/* Store List */}
          <FlatList
            data={stores}
            keyExtractor={keyExtractor}
            renderItem={renderStoreItem}
            getItemLayout={getItemLayout}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={loading && !isLoadingMore}
                onRefresh={handleRefresh}
                tintColor={Colors.primary}
                colors={[Colors.primary]}
              />
            }
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.5}
            ListEmptyComponent={renderEmptyState}
            ListFooterComponent={renderFooter}
            showsVerticalScrollIndicator={false}
            removeClippedSubviews={true}
            maxToRenderPerBatch={10}
            updateCellsBatchingPeriod={50}
            initialNumToRender={10}
            windowSize={10}
          />

          {/* Loading Overlay */}
          {loading && stores.length === 0 && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.loadingText}>Cargando tiendas...</Text>
            </View>
          )}

          {/* Error Message */}
          {error && (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={20} color={Colors.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
        </>
      )}

      {/* Filter Sheet */}
      <StoreFilterSheet
        visible={showFilterSheet}
        currentFilters={filters}
        categories={categories}
        onApply={handleApplyFilters}
        onClear={handleClearFilters}
        onClose={() => setShowFilterSheet(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    ...Typography.h1,
    fontSize: 28,
    marginBottom: 4,
  },
  headerSubtitle: {
    ...Typography.bodySmall,
    color: Colors.mediumGray,
  },
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
    backgroundColor: Colors.white,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    height: 48,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    ...Typography.input,
    height: '100%',
  },
  filterButton: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    ...Shadows.sm,
  },
  filterBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: Colors.error,
    borderRadius: BorderRadius.full,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadgeText: {
    ...Typography.caption,
    color: Colors.white,
    fontWeight: '700',
    fontSize: 10,
  },
  mapToggleButton: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
  },
  categoryChipsContainer: {
    backgroundColor: Colors.white,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  categoryChipsContent: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  categoryChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.background,
    borderWidth: 2,
    borderColor: Colors.border,
  },
  categoryChipSelected: {
    backgroundColor: Colors.light,
    borderColor: Colors.primary,
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
  sortContainer: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.background,
    gap: 4,
  },
  sortOptionSelected: {
    backgroundColor: Colors.light,
  },
  sortOptionText: {
    ...Typography.bodySmall,
    color: Colors.mediumGray,
    fontWeight: '500',
  },
  sortOptionTextSelected: {
    color: Colors.primary,
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxl,
    paddingHorizontal: Spacing.xl,
  },
  emptyStateTitle: {
    ...Typography.h3,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  emptyStateSubtitle: {
    ...Typography.body,
    color: Colors.mediumGray,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  clearFiltersButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary,
    ...Shadows.sm,
  },
  clearFiltersButtonText: {
    ...Typography.button,
    color: Colors.white,
  },
  footerLoader: {
    paddingVertical: Spacing.lg,
    alignItems: 'center',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  loadingText: {
    ...Typography.body,
    color: Colors.mediumGray,
  },
  errorContainer: {
    position: 'absolute',
    bottom: Spacing.lg,
    left: Spacing.lg,
    right: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.error,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    gap: Spacing.sm,
    ...Shadows.lg,
  },
  errorText: {
    ...Typography.bodySmall,
    color: Colors.white,
    flex: 1,
  },
});
