/**
 * StoreFilterSheet Usage Example
 * 
 * This example demonstrates how to use the StoreFilterSheet component
 * in your store listing screens.
 */

import React, { useState } from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import { StoreFilterSheet } from './StoreFilterSheet';
import { StoreFilters, StoreCategory } from '@/types/store';

export function StoreFilterSheetExample() {
  const [filterSheetVisible, setFilterSheetVisible] = useState(false);
  const [filters, setFilters] = useState<StoreFilters>({
    categories: [],
    distanceRange: undefined,
    ratingRange: undefined,
    openNow: false,
  });

  // Mock categories - in real app, fetch from API
  const categories: StoreCategory[] = [
    {
      category_id: 1,
      name: 'Restaurante',
      description: 'Restaurantes',
      is_active: true,
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
    },
    {
      category_id: 2,
      name: 'Tienda de Ropa',
      description: 'Tiendas de ropa',
      is_active: true,
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
    },
    {
      category_id: 3,
      name: 'Farmacia',
      description: 'Farmacias',
      is_active: true,
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
    },
  ];

  const handleApplyFilters = (newFilters: StoreFilters) => {
    setFilters(newFilters);
    // Here you would typically:
    // 1. Update your store list query with the new filters
    // 2. Refetch the store data
    console.log('Applied filters:', newFilters);
  };

  const handleClearFilters = () => {
    const clearedFilters: StoreFilters = {
      categories: [],
      distanceRange: undefined,
      ratingRange: undefined,
      openNow: false,
    };
    setFilters(clearedFilters);
    // Here you would typically:
    // 1. Reset your store list query
    // 2. Refetch all stores without filters
    console.log('Cleared all filters');
  };

  return (
    <View>
      {/* Button to open filter sheet */}
      <TouchableOpacity onPress={() => setFilterSheetVisible(true)}>
        <Text>Open Filters</Text>
      </TouchableOpacity>

      {/* Filter Sheet */}
      <StoreFilterSheet
        visible={filterSheetVisible}
        currentFilters={filters}
        categories={categories}
        onApply={handleApplyFilters}
        onClear={handleClearFilters}
        onClose={() => setFilterSheetVisible(false)}
      />
    </View>
  );
}

/**
 * Integration with Store List Screen
 * 
 * Example of how to integrate the filter sheet with a store list:
 */

/*
import { useStores } from '@/hooks/useStores';

function StoreListScreen() {
  const [filterSheetVisible, setFilterSheetVisible] = useState(false);
  const [filters, setFilters] = useState<StoreFilters>({
    categories: [],
    distanceRange: undefined,
    ratingRange: undefined,
    openNow: false,
  });

  // Fetch stores with filters
  const { data: stores, refetch } = useStores({
    category_id: filters.categories.length > 0 ? filters.categories[0] : undefined,
    radius: filters.distanceRange,
    min_rating: filters.ratingRange,
    open_now: filters.openNow,
  });

  const handleApplyFilters = (newFilters: StoreFilters) => {
    setFilters(newFilters);
    refetch(); // Refetch stores with new filters
  };

  const handleClearFilters = () => {
    setFilters({
      categories: [],
      distanceRange: undefined,
      ratingRange: undefined,
      openNow: false,
    });
    refetch(); // Refetch all stores
  };

  return (
    <View>
      <TouchableOpacity onPress={() => setFilterSheetVisible(true)}>
        <Ionicons name="filter" size={24} />
      </TouchableOpacity>

      <FlatList
        data={stores}
        renderItem={({ item }) => <StoreCard store={item} />}
      />

      <StoreFilterSheet
        visible={filterSheetVisible}
        currentFilters={filters}
        categories={categories}
        onApply={handleApplyFilters}
        onClear={handleClearFilters}
        onClose={() => setFilterSheetVisible(false)}
      />
    </View>
  );
}
*/
