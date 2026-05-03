# StoreFilterSheet Component

A bottom sheet modal component for filtering stores in the store management system.

## Features

- **Multi-select Category Filtering**: Select multiple categories with visual feedback
- **Distance Range Slider**: Filter stores by maximum distance (1-50km)
- **Rating Range Slider**: Filter stores by minimum rating (1-5 stars)
- **Open Now Toggle**: Filter to show only currently open stores
- **Active Filter Badge**: Displays count of active filters in the header
- **Clear All Filters**: Quick reset button to clear all filters
- **Responsive Design**: Follows the app's design system and theme

## Props

```typescript
interface StoreFilterSheetProps {
  visible: boolean;              // Controls modal visibility
  currentFilters: StoreFilters;  // Current filter state
  categories: StoreCategory[];   // Available categories to filter by
  onApply: (filters: StoreFilters) => void;  // Called when filters are applied
  onClear: () => void;           // Called when filters are cleared
  onClose: () => void;           // Called when modal is closed
}
```

## Usage

```tsx
import { StoreFilterSheet } from '@/components/stores';
import { StoreFilters } from '@/types/store';

function StoreListScreen() {
  const [filterSheetVisible, setFilterSheetVisible] = useState(false);
  const [filters, setFilters] = useState<StoreFilters>({
    categories: [],
    distanceRange: undefined,
    ratingRange: undefined,
    openNow: false,
  });

  const handleApplyFilters = (newFilters: StoreFilters) => {
    setFilters(newFilters);
    // Refetch stores with new filters
  };

  const handleClearFilters = () => {
    setFilters({
      categories: [],
      distanceRange: undefined,
      ratingRange: undefined,
      openNow: false,
    });
    // Refetch all stores
  };

  return (
    <>
      <TouchableOpacity onPress={() => setFilterSheetVisible(true)}>
        <Ionicons name="filter" size={24} />
      </TouchableOpacity>

      <StoreFilterSheet
        visible={filterSheetVisible}
        currentFilters={filters}
        categories={categories}
        onApply={handleApplyFilters}
        onClear={handleClearFilters}
        onClose={() => setFilterSheetVisible(false)}
      />
    </>
  );
}
```

## Requirements Satisfied

This component satisfies the following requirements from the Store Management System specification:

- **16.3**: Provides a filter sheet that opens as a bottom sheet modal
- **16.4**: Allows filtering by categories (multiple selection), distance range, rating range, and open now
- **16.5**: Includes "open now" toggle for filtering stores by business hours
- **16.6**: Displays active filter count badge in the header
- **16.7**: Provides "Limpiar todo" button to reset all filters

## Implementation Details

### Custom Slider Component

Since `@react-native-community/slider` is not installed, the component includes a custom slider implementation that:
- Supports touch interaction for value selection
- Displays visual feedback with active/inactive track colors
- Shows a draggable thumb indicator
- Supports configurable min/max values and step increments

### Filter Count Calculation

The active filter count is calculated based on:
1. Categories selected (counts as 1 if any categories are selected)
2. Distance range set (counts as 1 if less than default 50km)
3. Rating range set (counts as 1 if greater than default 1 star)
4. Open now toggle (counts as 1 if enabled)

### Styling

The component follows the app's design system:
- Uses theme colors from `@/constants/theme`
- Applies consistent spacing, border radius, and shadows
- Matches the styling patterns from StoreCard and CategoryPicker
- Responsive layout that works on different screen sizes

## Testing

Unit tests are included in `__tests__/StoreFilterSheet.test.tsx` covering:
- Component exports and structure
- Filter count calculation logic
- Category toggle functionality
- Filter range validation
- Active category filtering

Run tests with:
```bash
npm test -- StoreFilterSheet.test.tsx
```

## Files

- `StoreFilterSheet.tsx` - Main component implementation
- `StoreFilterSheet.example.tsx` - Usage examples
- `StoreFilterSheet.README.md` - This documentation
- `__tests__/StoreFilterSheet.test.tsx` - Unit tests
