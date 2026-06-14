import React from 'react';
import { render } from '@testing-library/react-native';
import { StoreCard } from '../StoreCard';
import { Store } from '@/types/store';

describe('StoreCard', () => {
  const mockStore: Store = {
    store_id: 1,
    owner_id: 1,
    name: 'Test Store',
    address: '123 Test St',
    phone: '1234567890',
    category_id: 1,
    category: {
      category_id: 1,
      name: 'Restaurante',
      description: 'Test category',
      is_active: true,
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
    },
    description: 'Test description',
    status: 'activa',
    average_rating: 4.5,
    review_count: 10,
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
    distance: 1.5,
  };

  const mockOnPress = jest.fn();

  it('renders store name correctly', () => {
    const { getByText } = render(<StoreCard store={mockStore} onPress={mockOnPress} />);
    expect(getByText('Test Store')).toBeTruthy();
  });

  it('renders category name correctly', () => {
    const { getByText } = render(<StoreCard store={mockStore} onPress={mockOnPress} />);
    expect(getByText('Restaurante')).toBeTruthy();
  });

  it('renders rating correctly', () => {
    const { getByText } = render(<StoreCard store={mockStore} onPress={mockOnPress} />);
    expect(getByText('4.5 (10)')).toBeTruthy();
  });

  it('renders distance when showDistance is true', () => {
    const { getByText } = render(
      <StoreCard store={mockStore} onPress={mockOnPress} showDistance={true} />
    );
    expect(getByText('1.5km')).toBeTruthy();
  });

  it('does not render distance when showDistance is false', () => {
    const { queryByText } = render(
      <StoreCard store={mockStore} onPress={mockOnPress} showDistance={false} />
    );
    expect(queryByText('1.5km')).toBeNull();
  });

  it('renders status badge for active store', () => {
    const { getByText } = render(<StoreCard store={mockStore} onPress={mockOnPress} />);
    expect(getByText('Activa')).toBeTruthy();
  });

  it('renders status badge for pending store', () => {
    const pendingStore = { ...mockStore, status: 'pendiente de aprobación' as const };
    const { getByText } = render(<StoreCard store={pendingStore} onPress={mockOnPress} />);
    expect(getByText('Pendiente')).toBeTruthy();
  });

  it('renders status badge for rejected store', () => {
    const rejectedStore = { ...mockStore, status: 'rechazada' as const };
    const { getByText } = render(<StoreCard store={rejectedStore} onPress={mockOnPress} />);
    expect(getByText('Rechazada')).toBeTruthy();
  });

  it('renders status badge for inactive store', () => {
    const inactiveStore = { ...mockStore, status: 'inactiva' as const };
    const { getByText } = render(<StoreCard store={inactiveStore} onPress={mockOnPress} />);
    expect(getByText('Inactiva')).toBeTruthy();
  });

  it('handles missing category gracefully', () => {
    const storeWithoutCategory = { ...mockStore, category: undefined };
    const { getByText } = render(<StoreCard store={storeWithoutCategory} onPress={mockOnPress} />);
    expect(getByText('Sin categoría')).toBeTruthy();
  });

  it('formats distance in meters when less than 1km', () => {
    const nearbyStore = { ...mockStore, distance: 0.5 };
    const { getByText } = render(
      <StoreCard store={nearbyStore} onPress={mockOnPress} showDistance={true} />
    );
    expect(getByText('500m')).toBeTruthy();
  });

  it('calls onPress when card is pressed', () => {
    const { getByText } = render(<StoreCard store={mockStore} onPress={mockOnPress} />);
    const card = getByText('Test Store').parent?.parent?.parent;
    if (card) {
      card.props.onPress();
      expect(mockOnPress).toHaveBeenCalledTimes(1);
    }
  });
});
