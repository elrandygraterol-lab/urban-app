// User types
export type UserRole = 'passenger' | 'driver' | 'admin';
export type VehicleType = 'taxi' | 'moto-taxi';

export interface User {
  id: string;
  email: string;
  name: string;
  phone: string;
  role: UserRole;
  profilePhotoUrl?: string;
  status: 'active' | 'suspended' | 'deleted';
  language: string;
  createdAt: string;
  updatedAt: string;
}

export interface PassengerProfile {
  id: string;
  userId: string;
  averageRating: number;
  totalRides: number;
  loyaltyPoints: number;
}

export interface DriverProfile {
  id: string;
  userId: string;
  vehicleType: VehicleType;
  licensePlate: string;
  vehicleModel: string;
  vehicleColor?: string;
  vehicleYear?: number;
  verificationStatus: 'pending' | 'verified' | 'rejected';
  rejectionReason?: string;
  isAvailable: boolean;
  currentLatitude?: number;
  currentLongitude?: number;
  averageRating: number;
  totalRides: number;
}

// Ride types
export type RideStatus = 
  | 'pending' 
  | 'accepted' 
  | 'arrived' 
  | 'in_progress' 
  | 'completed' 
  | 'cancelled';

export interface Location {
  latitude: number;
  longitude: number;
  address: string;
}

export interface Ride {
  id: string;
  passengerId: string;
  driverId?: string;
  status: RideStatus;
  vehicleType: VehicleType;
  pickup: Location;
  destination: Location;
  estimatedDistance?: number;
  estimatedDuration?: number;
  estimatedFare?: number;
  actualDistance?: number;
  actualDuration?: number;
  finalFare?: number;
  cancellationReason?: string;
  cancelledBy?: 'passenger' | 'driver' | 'system';
  cancellationFee?: number;
  scheduledPickupTime?: string;
  requestedAt: string;
  acceptedAt?: string;
  arrivedAt?: string;
  startedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
}

// Payment types
export type PaymentMethodType = 'cash' | 'card' | 'digital_wallet';
export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded';

export interface PaymentMethod {
  id: string;
  userId: string;
  methodType: PaymentMethodType;
  isDefault: boolean;
  cardLastFour?: string;
  cardBrand?: string;
  walletProvider?: string;
}

export interface Payment {
  id: string;
  rideId: string;
  paymentMethodId: string;
  amount: number;
  platformCommission: number;
  driverEarnings: number;
  status: PaymentStatus;
  transactionId?: string;
  processedAt?: string;
}

// Rating types
export interface Rating {
  id: string;
  rideId: string;
  raterId: string;
  ratedId: string;
  rating: number;
  comment?: string;
  createdAt: string;
}

// API Response types
export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: any;
    field?: string;
    timestamp: string;
    requestId: string;
  };
}

// Auth types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  refreshToken: string;
  user: User;
}

export interface RegisterPassengerRequest {
  email: string;
  password: string;
  name: string;
  phone: string;
}

export interface RegisterDriverRequest extends RegisterPassengerRequest {
  vehicleType: VehicleType;
  licensePlate: string;
  vehicleModel: string;
}
