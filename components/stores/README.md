# Store Components

This directory contains reusable components for the Store Management System.

## StoreCard

A reusable card component for displaying store information in lists.

### Props

- `store: Store` - The store object to display
- `onPress: () => void` - Callback function when the card is pressed
- `showDistance?: boolean` - Whether to show the distance badge (default: true)

### Features

- **Logo Display**: Shows store logo using Expo Image with loading states and error handling
- **Store Information**: Displays name, category, and rating
- **Status Badges**: Shows status for owner's stores (Activa, Pendiente, Rechazada, Inactiva)
- **Rating Stars**: Visual star rating with count
- **Distance Badge**: Shows distance from user's location (in meters or kilometers)
- **Responsive Design**: Follows the existing design system

### Usage

```tsx
import { StoreCard } from '@/components/stores';

<StoreCard
  store={store}
  onPress={() => navigation.navigate('StoreDetails', { id: store.store_id })}
  showDistance={true}
/>
```

### Design System

The component uses the existing design system from `@/constants/theme`:
- Colors
- Typography
- BorderRadius
- Spacing
- Shadows

### Requirements Satisfied

- **Requirement 7.3**: Display for each store: logo, name, category, rating, distance
- **Requirement 10.8**: Display store status badges

### Image Handling

- Uses Expo Image for optimized image loading
- Includes blurhash placeholder for smooth loading
- Handles missing images with placeholder
- Proper error states

### Status Badge Colors

- **Activa**: Green background (#dcfce7) with green text
- **Pendiente**: Yellow background (#fef3c7) with amber text
- **Rechazada**: Red background (#fee2e2) with red text
- **Inactiva**: Gray background (#f3f4f6) with gray text
