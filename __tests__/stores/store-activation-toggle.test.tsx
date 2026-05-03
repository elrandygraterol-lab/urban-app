/**
 * Store Activation Toggle Tests
 * 
 * Tests for Task 22: Implement store activation toggle
 * Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import StoreDetailsScreen from '@/app/(tabs)/stores/[id]';
import { useStoreStore } from '@/store/storeStore';
import { useAuthStore } from '@/store/authStore';
import * as storeApi from '@/services/storeApi';

// Mock dependencies
jest.mock('@/store/storeStore');
jest.mock('@/store/authStore');
jest.mock('@/services/storeApi');
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: '1' }),
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
}));

// Mock Alert
jest.spyOn(Alert, 'alert');

describe('Store Activation Toggle', () => {
  const mockStore = {
    store_id: 1,
    owner_id: 123,
    name: 'Test Store',
    address: 'Test Address',
    phone: '1234567890',
    category_id: 1,
    category: { category_id: 1, name: 'Restaurant', description: '', is_active: true, created_at: '', updated_at: '' },
    description: 'Test Description',
    status: 'activa' as const,
    average_rating: 4.5,
    review_count: 10,
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
  };

  const mockUser = {
    id: '123',
    email: 'owner@test.com',
    name: 'Test Owner',
    phone: '1234567890',
    role: 'owner' as const,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mock implementations
    (useStoreStore as unknown as jest.Mock).mockReturnValue({
      selectedStore: mockStore,
      loading: false,
      error: null,
      fetchStoreById: jest.fn(),
    });

    (useAuthStore as unknown as jest.Mock).mockReturnValue({
      user: mockUser,
    });
  });

  describe('Requirement 13.1: Display toggle for owners', () => {
    it('should display activation toggle for store owners', () => {
      const { getByText } = render(<StoreDetailsScreen />);
      
      expect(getByText('Activación de tienda')).toBeTruthy();
    });

    it('should not display toggle for non-owners', () => {
      (useAuthStore as unknown as jest.Mock).mockReturnValue({
        user: { ...mockUser, id: '999' }, // Different user ID
      });

      const { queryByText } = render(<StoreDetailsScreen />);
      
      expect(queryByText('Activación de tienda')).toBeNull();
    });
  });

  describe('Requirement 13.2: Toggle enabled for ACTIVE status', () => {
    it('should enable toggle when store status is ACTIVE', () => {
      const { getByRole } = render(<StoreDetailsScreen />);
      
      const toggle = getByRole('switch');
      expect(toggle.props.disabled).toBe(false);
      expect(toggle.props.value).toBe(true);
    });
  });

  describe('Requirement 13.3: Disable toggle to INACTIVE', () => {
    it('should call API to change status to INACTIVE when toggle is disabled', async () => {
      const mockUpdateStatus = jest.fn().mockResolvedValue({ data: { message: 'Success', store: { ...mockStore, status: 'inactiva' } } });
      (storeApi.updateStoreStatus as jest.Mock) = mockUpdateStatus;

      const mockFetchStoreById = jest.fn();
      (useStoreStore as unknown as jest.Mock).mockReturnValue({
        selectedStore: mockStore,
        loading: false,
        error: null,
        fetchStoreById: mockFetchStoreById,
      });

      const { getByRole } = render(<StoreDetailsScreen />);
      const toggle = getByRole('switch');

      fireEvent(toggle, 'onValueChange', false);

      await waitFor(() => {
        expect(mockUpdateStatus).toHaveBeenCalledWith(1, 'inactiva');
      });
    });
  });

  describe('Requirement 13.4: Enable toggle to ACTIVE', () => {
    it('should call API to change status to ACTIVE when toggle is enabled', async () => {
      const inactiveStore = { ...mockStore, status: 'inactiva' as const };
      const mockUpdateStatus = jest.fn().mockResolvedValue({ data: { message: 'Success', store: { ...inactiveStore, status: 'activa' } } });
      (storeApi.updateStoreStatus as jest.Mock) = mockUpdateStatus;

      const mockFetchStoreById = jest.fn();
      (useStoreStore as unknown as jest.Mock).mockReturnValue({
        selectedStore: inactiveStore,
        loading: false,
        error: null,
        fetchStoreById: mockFetchStoreById,
      });

      const { getByRole } = render(<StoreDetailsScreen />);
      const toggle = getByRole('switch');

      fireEvent(toggle, 'onValueChange', true);

      await waitFor(() => {
        expect(mockUpdateStatus).toHaveBeenCalledWith(1, 'activa');
      });
    });
  });

  describe('Requirement 13.5: Update local store data', () => {
    it('should refresh store data after successful status change', async () => {
      const mockUpdateStatus = jest.fn().mockResolvedValue({ data: { message: 'Success', store: { ...mockStore, status: 'inactiva' } } });
      (storeApi.updateStoreStatus as jest.Mock) = mockUpdateStatus;

      const mockFetchStoreById = jest.fn();
      (useStoreStore as unknown as jest.Mock).mockReturnValue({
        selectedStore: mockStore,
        loading: false,
        error: null,
        fetchStoreById: mockFetchStoreById,
      });

      const { getByRole } = render(<StoreDetailsScreen />);
      const toggle = getByRole('switch');

      fireEvent(toggle, 'onValueChange', false);

      await waitFor(() => {
        expect(mockFetchStoreById).toHaveBeenCalledWith(1, true);
      });
    });

    it('should show success feedback message', async () => {
      const mockUpdateStatus = jest.fn().mockResolvedValue({ data: { message: 'Success', store: { ...mockStore, status: 'inactiva' } } });
      (storeApi.updateStoreStatus as jest.Mock) = mockUpdateStatus;

      const { getByRole } = render(<StoreDetailsScreen />);
      const toggle = getByRole('switch');

      fireEvent(toggle, 'onValueChange', false);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Éxito',
          expect.stringContaining('desactivada')
        );
      });
    });
  });

  describe('Requirement 13.6: Disable toggle for PENDING status', () => {
    it('should disable toggle when store status is PENDING', () => {
      const pendingStore = { ...mockStore, status: 'pendiente de aprobación' as const };
      (useStoreStore as unknown as jest.Mock).mockReturnValue({
        selectedStore: pendingStore,
        loading: false,
        error: null,
        fetchStoreById: jest.fn(),
      });

      const { getByRole, getByText } = render(<StoreDetailsScreen />);
      const toggle = getByRole('switch');

      expect(toggle.props.disabled).toBe(true);
      expect(getByText(/pendiente de aprobación/)).toBeTruthy();
    });
  });

  describe('Requirement 13.6: Disable toggle for REJECTED status', () => {
    it('should disable toggle when store status is REJECTED', () => {
      const rejectedStore = { ...mockStore, status: 'rechazada' as const };
      (useStoreStore as unknown as jest.Mock).mockReturnValue({
        selectedStore: rejectedStore,
        loading: false,
        error: null,
        fetchStoreById: jest.fn(),
      });

      const { getByRole, getByText } = render(<StoreDetailsScreen />);
      const toggle = getByRole('switch');

      expect(toggle.props.disabled).toBe(true);
      expect(getByText(/rechazada/)).toBeTruthy();
    });
  });

  describe('Requirement 13.7: Visual status indicators', () => {
    it('should display current status with visual indicators', () => {
      const { getByText } = render(<StoreDetailsScreen />);
      
      expect(getByText(/Estado actual:/)).toBeTruthy();
      expect(getByText('activa')).toBeTruthy();
    });

    it('should show different visual indicators for different statuses', () => {
      const statuses = ['activa', 'inactiva', 'pendiente de aprobación', 'rechazada'] as const;
      
      statuses.forEach(status => {
        const storeWithStatus = { ...mockStore, status };
        (useStoreStore as unknown as jest.Mock).mockReturnValue({
          selectedStore: storeWithStatus,
          loading: false,
          error: null,
          fetchStoreById: jest.fn(),
        });

        const { getByText } = render(<StoreDetailsScreen />);
        expect(getByText(status)).toBeTruthy();
      });
    });
  });

  describe('Requirement 13.8: Backend verification', () => {
    it('should handle 403 error when user is not owner', async () => {
      const mockUpdateStatus = jest.fn().mockRejectedValue({
        response: {
          data: {
            error: {
              message: "You don't have permission to update this store"
            }
          }
        }
      });
      (storeApi.updateStoreStatus as jest.Mock) = mockUpdateStatus;

      const { getByRole } = render(<StoreDetailsScreen />);
      const toggle = getByRole('switch');

      fireEvent(toggle, 'onValueChange', false);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Error',
          expect.stringContaining('permission')
        );
      });
    });

    it('should handle network errors gracefully', async () => {
      const mockUpdateStatus = jest.fn().mockRejectedValue(new Error('Network error'));
      (storeApi.updateStoreStatus as jest.Mock) = mockUpdateStatus;

      const { getByRole } = render(<StoreDetailsScreen />);
      const toggle = getByRole('switch');

      fireEvent(toggle, 'onValueChange', false);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Error',
          expect.any(String)
        );
      });
    });
  });

  describe('Edge cases', () => {
    it('should not allow multiple simultaneous toggle operations', async () => {
      const mockUpdateStatus = jest.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 1000))
      );
      (storeApi.updateStoreStatus as jest.Mock) = mockUpdateStatus;

      const { getByRole } = render(<StoreDetailsScreen />);
      const toggle = getByRole('switch');

      // Trigger multiple times quickly
      fireEvent(toggle, 'onValueChange', false);
      fireEvent(toggle, 'onValueChange', true);
      fireEvent(toggle, 'onValueChange', false);

      await waitFor(() => {
        // Should only be called once
        expect(mockUpdateStatus).toHaveBeenCalledTimes(1);
      });
    });
  });
});
