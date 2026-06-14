/**
 * SharedRideInvitationModal Tests
 *
 * Tests for the shared ride invitation reception modal component.
 * Validates Requirements: 7.3, 7.4
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import SharedRideInvitationModal, { SharedRideInvitation } from '../SharedRideInvitationModal';
import { sharedRidesAPI } from '@/services/api';
import { reverseGeocode } from '@/services/mapsService';
import { Alert } from 'react-native';
import * as Location from 'expo-location';

// Mock dependencies
jest.mock('expo-location');
jest.mock('react-native-maps', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: View,
    Marker: View,
    PROVIDER_GOOGLE: 'google',
  };
});
jest.mock('@/services/api', () => ({
  sharedRidesAPI: {
    accept: jest.fn(),
    reject: jest.fn(),
  },
}));
jest.mock('@/services/mapsService', () => {
  const fn = jest.fn();
  return {
    reverseGeocode: fn,
    default: {
      reverseGeocode: fn,
    },
  };
});
jest.mock('@/utils/currency', () => ({
  formatCurrency: jest.fn((amount: number) => `Bs. ${amount.toFixed(2)}`),
}));

const mockInvitation: SharedRideInvitation = {
  id: 'inv-123',
  inviterId: 'user-456',
  inviterName: 'Juan Pérez',
  inviterCode: 'USR-A3F7',
  pickupPoints: [{ latitude: 10.5, longitude: -66.9, address: 'Av. Principal, Caracas' }],
  destinationPoints: [{ latitude: 10.6, longitude: -66.8, address: 'Centro Comercial, Caracas' }],
  estimatedFare: 50.0,
  currency: 'VES',
  expiresAt: new Date(Date.now() + 60000).toISOString(), // 60 seconds from now
};

describe('SharedRideInvitationModal', () => {
  const mockOnAccept = jest.fn();
  const mockOnReject = jest.fn();
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert');
  });

  it('should render invitation details correctly', () => {
    const { getByText } = render(
      <SharedRideInvitationModal
        visible={true}
        invitation={mockInvitation}
        onAccept={mockOnAccept}
        onReject={mockOnReject}
        onClose={mockOnClose}
      />
    );

    // Check inviter name
    expect(getByText('Juan Pérez')).toBeTruthy();
    expect(getByText('USR-A3F7')).toBeTruthy();

    // Check fare
    expect(getByText('Bs. 50.00')).toBeTruthy();
    expect(getByText('Bs. 25.00')).toBeTruthy(); // Cost per passenger

    // Check route details
    expect(getByText('Av. Principal, Caracas')).toBeTruthy();
    expect(getByText('Centro Comercial, Caracas')).toBeTruthy();
  });

  it('should show countdown timer', () => {
    const { getByText } = render(
      <SharedRideInvitationModal
        visible={true}
        invitation={mockInvitation}
        onAccept={mockOnAccept}
        onReject={mockOnReject}
        onClose={mockOnClose}
      />
    );

    // Check countdown is displayed
    expect(getByText('segundos')).toBeTruthy();
  });

  it('should call onReject when reject button is pressed', async () => {
    (sharedRidesAPI.reject as jest.Mock).mockResolvedValue({});

    const { getByText } = render(
      <SharedRideInvitationModal
        visible={true}
        invitation={mockInvitation}
        onAccept={mockOnAccept}
        onReject={mockOnReject}
        onClose={mockOnClose}
      />
    );

    const rejectButton = getByText('Rechazar');
    fireEvent.press(rejectButton);

    await waitFor(() => {
      expect(sharedRidesAPI.reject).toHaveBeenCalledWith('inv-123');
      expect(mockOnReject).toHaveBeenCalledWith('inv-123');
    });
  });

  it('should show pickup selection screen when accept is pressed', () => {
    const { getByText } = render(
      <SharedRideInvitationModal
        visible={true}
        invitation={mockInvitation}
        onAccept={mockOnAccept}
        onReject={mockOnReject}
        onClose={mockOnClose}
      />
    );

    const acceptButton = getByText('Aceptar');
    fireEvent.press(acceptButton);

    // Should show pickup selection screen
    expect(getByText('Confirmar Punto de Recogida')).toBeTruthy();
  });

  it('should handle location permission denial', async () => {
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'denied',
    });

    const { getByText } = render(
      <SharedRideInvitationModal
        visible={true}
        invitation={mockInvitation}
        onAccept={mockOnAccept}
        onReject={mockOnReject}
        onClose={mockOnClose}
      />
    );

    // Press accept to go to pickup selection
    const acceptButton = getByText('Aceptar');
    fireEvent.press(acceptButton);

    await waitFor(() => {
      expect(getByText('Se requiere permiso de ubicación para continuar')).toBeTruthy();
    });
  });

  it('should call onAccept with pickup location when confirmed', async () => {
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'granted',
    });
    (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValue({
      coords: { latitude: 10.5, longitude: -66.9 },
    });
    (reverseGeocode as jest.Mock).mockResolvedValue({
      latitude: 10.5,
      longitude: -66.9,
      address: 'Mi ubicación actual',
    });
    (sharedRidesAPI.accept as jest.Mock).mockResolvedValue({});

    const { getByText } = render(
      <SharedRideInvitationModal
        visible={true}
        invitation={mockInvitation}
        onAccept={mockOnAccept}
        onReject={mockOnReject}
        onClose={mockOnClose}
      />
    );

    // Press accept to go to pickup selection
    const acceptButton = getByText('Aceptar');
    fireEvent.press(acceptButton);

    // Wait for location to load
    await waitFor(() => {
      expect(getByText('Mi ubicación actual')).toBeTruthy();
    });

    // Press confirm button
    const confirmButton = getByText('Confirmar y Aceptar');
    fireEvent.press(confirmButton);

    await waitFor(() => {
      expect(sharedRidesAPI.accept).toHaveBeenCalledWith('inv-123', {
        inviteePickupLat: 10.5,
        inviteePickupLng: -66.9,
        inviteePickupAddr: 'Mi ubicación actual',
      });
      expect(mockOnAccept).toHaveBeenCalledWith('inv-123', {
        latitude: 10.5,
        longitude: -66.9,
        address: 'Mi ubicación actual',
      });
    });
  });

  it('should close modal when close button is pressed', () => {
    const { getByLabelText } = render(
      <SharedRideInvitationModal
        visible={true}
        invitation={mockInvitation}
        onAccept={mockOnAccept}
        onReject={mockOnReject}
        onClose={mockOnClose}
      />
    );

    const closeButton = getByLabelText('Cerrar');
    fireEvent.press(closeButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should not render when invitation is null', () => {
    const { queryByText } = render(
      <SharedRideInvitationModal
        visible={true}
        invitation={null}
        onAccept={mockOnAccept}
        onReject={mockOnReject}
        onClose={mockOnClose}
      />
    );

    expect(queryByText('Invitación de Viaje')).toBeNull();
  });

  it('should handle API errors gracefully', async () => {
    (sharedRidesAPI.reject as jest.Mock).mockRejectedValue({
      response: {
        data: {
          error: {
            message: 'Error al rechazar la invitación',
          },
        },
      },
    });

    const { getByText } = render(
      <SharedRideInvitationModal
        visible={true}
        invitation={mockInvitation}
        onAccept={mockOnAccept}
        onReject={mockOnReject}
        onClose={mockOnClose}
      />
    );

    const rejectButton = getByText('Rechazar');
    fireEvent.press(rejectButton);

    await waitFor(() => {
      expect(getByText('Error al rechazar la invitación')).toBeTruthy();
    });
  });
});
