import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StoreCategory } from '@/types/store';
import { Colors, Typography, BorderRadius, Spacing, Shadows } from '@/constants/theme';

interface CategoryPickerProps {
  selectedCategory?: number | null;
  onSelect: (categoryId: number | null) => void;
  categories: StoreCategory[];
  style?: ViewStyle;
}

export const CategoryPicker: React.FC<CategoryPickerProps> = ({
  selectedCategory,
  onSelect,
  categories,
  style,
}) => {
  // Filter only active categories
  const activeCategories = categories.filter((cat) => cat.is_active);

  // Add "All" option at the beginning
  const allOption = {
    category_id: 0,
    name: 'Todas',
    description: 'Ver todas las categorías',
    is_active: true,
    created_at: '',
    updated_at: '',
  };

  const categoriesWithAll = [allOption, ...activeCategories];

  const renderCategoryItem = ({ item }: { item: StoreCategory }) => {
    const isSelected = selectedCategory === item.category_id || 
                      (selectedCategory === null && item.category_id === 0);

    return (
      <TouchableOpacity
        style={[
          styles.categoryItem,
          isSelected && styles.categoryItemSelected,
        ]}
        onPress={() => onSelect(item.category_id === 0 ? null : item.category_id)}
        activeOpacity={0.7}
      >
        {/* Icon */}
        <View
          style={[
            styles.iconContainer,
            isSelected && styles.iconContainerSelected,
          ]}
        >
          <Ionicons
            name={getCategoryIcon(item.name)}
            size={24}
            color={isSelected ? Colors.white : Colors.primary}
          />
        </View>

        {/* Category Name */}
        <Text
          style={[
            styles.categoryName,
            isSelected && styles.categoryNameSelected,
          ]}
          numberOfLines={2}
        >
          {item.name}
        </Text>

        {/* Selected Indicator */}
        {isSelected && (
          <View style={styles.selectedIndicator}>
            <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, style]}>
      <FlatList
        data={categoriesWithAll}
        renderItem={renderCategoryItem}
        keyExtractor={(item) => item.category_id.toString()}
        numColumns={3}
        columnWrapperStyle={styles.row}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
};

// Helper function to get icon name based on category
const getCategoryIcon = (categoryName: string): any => {
  const iconMap: Record<string, any> = {
    'Todas': 'grid-outline',
    'Restaurante': 'restaurant-outline',
    'Tienda de Ropa': 'shirt-outline',
    'Farmacia': 'medical-outline',
    'Supermercado': 'cart-outline',
    'Ferretería': 'hammer-outline',
    'Panadería': 'cafe-outline',
    'Otros': 'ellipsis-horizontal-circle-outline',
  };

  return iconMap[categoryName] || 'storefront-outline';
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  listContent: {
    paddingBottom: Spacing.sm,
  },
  row: {
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  categoryItem: {
    flex: 1,
    aspectRatio: 1,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    borderColor: Colors.border,
    padding: Spacing.sm,
    marginHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
  },
  categoryItemSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.light,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.light,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  iconContainerSelected: {
    backgroundColor: Colors.primary,
  },
  categoryName: {
    ...Typography.caption,
    fontSize: 11,
    fontWeight: '600',
    color: Colors.darkGray,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
  categoryNameSelected: {
    color: Colors.primary,
    fontWeight: '700',
  },
  selectedIndicator: {
    position: 'absolute',
    top: 4,
    right: 4,
  },
});
