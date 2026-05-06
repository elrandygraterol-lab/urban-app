/**
 * Tests for DelegatedRideModal component
 * 
 * Validates Requirements: 9.4, 9.5, 9.11
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import DelegatedRideModal from '../DelegatedRideModal';
import { delegatedRidesAPI } from '@/services/api';

// Mock dependencies
jest.mock('@/services/api', () => ({
  delegatedRidesAPI: {
    create: jest.fn(),
  },
}));

jest.mock('@/utils/errorLogger', () => ({
  logInfo: jest.fn(),
  logError: jest.fn(),
}));

jest.mock('react-native/Libraries/Alert/Alert', () => ({
  alert: jest.fn(),
}));

describe('DelegatedRideModal', () => {
  const mockPickupPoint = {
    latitude: 10.5,
    longitude: -66.9,
    address: 'Pickup Address',
  };

  const mockDestinationPoint = {
    latitude: 10.6,
    longitude: -66.8,
    address: 'Destination Address',
  };

  const defaultProps = {
    visible: true,
    pickupPoint: mockPickupPoint,
    destinationPoint: mockDestinationPoint,
    estimatedFare: 50.0,
    currency: 'VES' as const,
    onSelectPickup: jest.fn(),
    onSelectDestination: jest.fn(),
    onSuccess: jest.fn(),
    onClose: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render the modal when visible', () => {
    const { getByText } = render(<DelegatedRideModal {...defaultProps} />);
    
    expect(getByText('Pedir Viaje Para Otro')).toBeTruthy();
    expect(getByText('Datos del Beneficiario')).toBeTruthy();
  });

  it('should show pickup and destination addresses', () => {
    const { getByText } = render(<DelegatedRideModal {...defaultProps} />);
    
    expect(getByText('Pickup Address')).toBeTruthy();
    expect(getByText('Destination Address')).toBeTruthy();
  });

  it('should show estimated fare when both points are set', () => {
    const { getByText } = render(<DelegatedRideModal {...defaultProps} />);
    
    expect(getByText('Tarifa Estimada')).toBeTruthy();
    expect(getByText(/50\.00/)).toBeTruthy();
  });

  it('should validate phone number format in real-time', () => {
    const { getByPlaceholderText, getByText } = render(
      <DelegatedRideModal {...defaultProps} />
    );
    
    const phoneInput = getByPlaceholderText('+58 414 1234567');
    
    // Invalid phone
    fireEvent.changeText(phoneInput, '123');
    
    waitFor(() => {
      expect(getByText(/Formato inválido/)).toBeTruthy();
    });
  });

  it('should successfully create delegated ride with cash payment', async () => {
    const mockResponse = {
      data: {
        rideId: 'ride-123',
        message: 'Delegated ride created successfully',
      },
    };
    
    (delegatedRidesAPI.create as jest.Mock).mockResolvedValue(mockResponse);
    
    const { getByPlaceholderText, getByText } = render(
      <DelegatedRideModal {...defaultProps} />
    );
    
    // Fill in beneficiary details
    const nameInput = getByPlaceholderText('Ej: Juan Pérez');
    const phoneInput = getByPlaceholderText('+58 414 1234567');
    
    fireEvent.changeText(nameInput, 'Juan Pérez');
    fireEvent.changeText(phoneInput, '+58 414 1234567');
    
    // Confirm the ride
    const confirmButton = getByText('Confirmar Viaje');
    fireEvent.press(confirmButton);
    
    await waitFor(() => {
      expect(delegatedRidesAPI.create).toHaveBeenCalledWith({
        beneficiaryName: 'Juan Pérez',
        beneficiaryPhone: '+58 414 1234567',
        pickupPoint: mockPickupPoint,
        destinationPoint: mockDestinationPoint,
        paymentConfig: {
          mode: 'cash',
          cashAmount: undefined,
          pagoMovilAmount: undefined,
          pagoMovilReference: undefined,
        },
      });
    });
    
    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        '✅ Viaje Solicitado',
        expect.stringContaining('Juan Pérez'),
        expect.any(Array)
      );
    });
  });

  it('should handle API error gracefully', async () => {
    const mockError = {
      response: {
        status: 422,
        data: {
          error: {
            message: 'El número de teléfono del beneficiario es inválido',
          },
        },
      },
    };
    
    (delegatedRidesAPI.create as jest.Mock).mockRejectedValue(mockError);
    
    const { getByPlaceholderText, getByText } = render(
      <DelegatedRideModal {...defaultProps} />
    );
    
    // Fill in beneficiary details
    const nameInput = getByPlaceholderText('Ej: Juan Pérez');
    const phoneInput = getByPlaceholderText('+58 414 1234567');
    
    fireEvent.changeText(nameInput, 'Juan Pérez');
    fireEvent.changeText(phoneInput, '+58 414 1234567');
    
    // Confirm the ride
    const confirmButton = getByText('Confirmar Viaje');
    fireEvent.press(confirmButton);
    
    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Error',
        'El número de teléfono del beneficiario es inválido',
        expect.any(Array)
      );
    });
  });

  it('should disable confirm button when form is invalid', () => {
    const { getByText } = render(<DelegatedRideModal {...defaultProps} />);
    
    const confirmButton = getByText('Confirmar Viaje');
    
    // Button should be disabled when beneficiary details are empty
    expect(confirmButton.props.accessibilityState.disabled).toBe(true);
  });

  it('should reset form when modal closes', () => {
    const { rerender, getByPlaceholderText } = render(
      <DelegatedRideModal {...defaultProps} />
    );
    
    // Fill in some data
    const nameInput = getByPlaceholderText('Ej: Juan Pérez');
    fireEvent.changeText(nameInput, 'Test Name');
    
    // Close modal
    rerender(<DelegatedRideModal {...defaultProps} visible={false} />);
    
    // Reopen modal
    rerender(<DelegatedRideModal {...defaultProps} visible={true} />);
    
    // Form should be reset
    const nameInputAfter = getByPlaceholderText('Ej: Juan Pérez');
    expect(nameInputAfter.props.value).toBe('');
  });
});
