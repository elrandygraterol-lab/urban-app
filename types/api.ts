/**
 * API Type Definitions
 * 
 * This file contains TypeScript type definitions for API requests and responses
 */

// ============================================================================
// Cancellation Policy Types
// ============================================================================

export type CancellationPolicyType = 'free' | 'standard' | 'penalty' | 'not_allowed';

export interface CancellationPolicy {
  type: CancellationPolicyType;
  fee: number;
  refundAmount?: number;
  timeElapsed: number;
  gracePeriodRemaining?: number;
}

export interface GetCancellationPolicyResponse {
  success: boolean;
  data: {
    canCancel: boolean;
    policy: CancellationPolicy;
    warnings: string[];
  };
}

export interface CancelRideRequest {
  reason?: string;
}

export interface CancelRideResponse {
  success: boolean;
  data: {
    ride: {
      id: string;
      status: 'cancelled';
      cancelledAt: string;
      cancelledBy: 'passenger';
      cancellationFee: number;
      cancellationReason?: string;
    };
    policy: {
      type: CancellationPolicyType;
      fee: number;
      refundAmount?: number;
      refundScheduledFor?: string;
    };
    message: string;
  };
}

// ============================================================================
// Error Response Types
// ============================================================================

export interface APIError {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

// ============================================================================
// Ride Types
// ============================================================================

export type RideStatus = 
  | 'pending' 
  | 'accepted' 
  | 'arrived' 
  | 'in_progress' 
  | 'completed' 
  | 'cancelled';

export type VehicleType = 'taxi' | 'moto_taxi';

export interface Ride {
  id: string;
  passengerId: string;
  driverId?: string;
  status: RideStatus;
  pickupLatitude: number;
  pickupLongitude: number;
  pickupAddress: string;
  destinationLatitude: number;
  destinationLongitude: number;
  destinationAddress: string;
  vehicleType: VehicleType;
  estimatedFare: number;
  actualFare?: number;
  cancellationFee?: number;
  cancelledBy?: 'passenger' | 'driver';
  cancellationReason?: string;
  cancelledAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Auth Types
// ============================================================================

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  data: {
    token: string;
    user: User;
  };
}

export interface User {
  id: string;
  email: string;
  name: string;
  phone: string;
  role: 'passenger' | 'driver';
  profilePhotoUrl?: string;
  createdAt: string;
}

// ============================================================================
// Payment Types
// ============================================================================

export type PaymentMethodType = 'cash' | 'card' | 'digital_wallet';

export interface PaymentMethod {
  id: string;
  methodType: PaymentMethodType;
  isDefault: boolean;
  cardLast4?: string;
  walletProvider?: string;
}

export interface CompletePaymentRequest {
  method: 'mobile_payment' | 'transfer' | 'cash';
  amount: number;
  referenceNumber?: string;
  phoneNumber?: string;
  accountNumber?: string;
  bankName?: string;
}

// ============================================================================
// Rating Types
// ============================================================================

export interface RateRequest {
  rideId: string;
  rating: number;
  comment?: string;
}

export interface RatingResponse {
  success: boolean;
  data: {
    rating: {
      id: string;
      rating: number;
      comment?: string;
      createdAt: string;
    };
  };
}
