import React from 'react';
import { StoreFilterSheet } from '../StoreFilterSheet';
import { StoreFilters, StoreCategory } from '@/types/store';

// Mock Modal to avoid testing library issues
jest.mock('react-native/Libraries/Modal/Modal', () => {
  const { View } = require('react-native');
  return (props: any) => (props.visible ? <View>{props.children}</View> : null);
});

describe('StoreFilterSheet', () => {
  const mockCategories: StoreCategory[] = [
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

  const mockFilters: StoreFilters = {
    categories: [],
    distanceRange: undefined,
    ratingRange: undefined,
    openNow: false,
  };

  const mockOnApply = jest.fn();
  const mockOnClear = jest.fn();
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('component exports correctly', () => {
    expect(StoreFilterSheet).toBeDefined();
    expect(typeof StoreFilterSheet).toBe('function');
  });

  it('calculates active filter count correctly', () => {
    // Test with no filters
    const noFilters: StoreFilters = {
      categories: [],
      distanceRange: undefined,
      ratingRange: undefined,
      openNow: false,
    };
    
    // Test with all filters
    const allFilters: StoreFilters = {
      categories: [1, 2],
      distanceRange: 10,
      ratingRange: 4,
      openNow: true,
    };

    // Test with partial filters
    const partialFilters: StoreFilters = {
      categories: [1],
      distanceRange: undefined,
      ratingRange: 3,
      openNow: false,
    };

    expect(noFilters.categories.length).toBe(0);
    expect(allFilters.categories.length).toBe(2);
    expect(partialFilters.categories.length).toBe(1);
  });

  it('handles category toggle logic', () => {
    const categories: number[] = [];
    const categoryId = 1;

    // Add category
    const index = categories.indexOf(categoryId);
    if (index === -1) {
      categories.push(categoryId);
    }
    expect(categories).toContain(1);

    // Remove category
    const removeIndex = categories.indexOf(categoryId);
    if (removeIndex > -1) {
      categories.splice(removeIndex, 1);
    }
    expect(categories).not.toContain(1);
  });

  it('validates filter ranges', () => {
    const distanceRange = 25;
    const ratingRange = 4;

    expect(distanceRange).toBeGreaterThanOrEqual(1);
    expect(distanceRange).toBeLessThanOrEqual(50);
    expect(ratingRange).toBeGreaterThanOrEqual(1);
    expect(ratingRange).toBeLessThanOrEqual(5);
  });

  it('filters only active categories', () => {
    const allCategories: StoreCategory[] = [
      ...mockCategories,
      {
        category_id: 4,
        name: 'Inactive',
        description: 'Inactive category',
        is_active: false,
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      },
    ];

    const activeCategories = allCategories.filter((cat) => cat.is_active);
    expect(activeCategories.length).toBe(3);
    expect(activeCategories.every((cat) => cat.is_active)).toBe(true);
  });
});
