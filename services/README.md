# API Service Documentation

## Overview

The API service provides a centralized interface for making HTTP requests to the backend API. It includes automatic JWT token management, error handling, and TypeScript type safety.

## Configuration

### Environment Variables

- `EXPO_PUBLIC_API_URL`: Backend API base URL (default: `http://localhost:3000`)

### Timeouts

- **Default timeout**: 10 seconds (for most operations)
- **Cancellation timeout**: 15 seconds (for ride cancellation operations)

## Authentication

The API service automatically:
- Adds JWT tokens to all requests via interceptor
- Handles 401 (Unauthorized) responses by clearing stored tokens
- Stores tokens securely using `expo-secure-store`

## Ride Cancellation API

### `getCancellationPolicy(rideId: string)`

Retrieves the cancellation policy for a ride without actually cancelling it.

**Parameters:**
- `rideId` (string): The ID of the ride

**Returns:**
```typescript
{
  success: boolean;
  data: {
    canCancel: boolean;
    policy: {
      type: 'free' | 'standard' | 'penalty' | 'not_allowed';
      fee: number;
      refundAmount?: number;
      timeElapsed: number;
      gracePeriodRemaining?: number;
    };
    warnings: string[];
  };
}
```

**Example:**
```typescript
import { rideAPI } from '@/services/api';

try {
  const response = await rideAPI.getCancellationPolicy('ride-123');
  
  if (response.data.canCancel) {
    console.log('Policy type:', response.data.policy.type);
    console.log('Fee:', response.data.policy.fee);
    console.log('Warnings:', response.data.warnings);
  } else {
    console.log('Cannot cancel this ride');
  }
} catch (error) {
  console.error('Error:', error.message);
}
```

**Error Handling:**
- `404`: Ride not found
- `403`: Not authorized to view this ride
- `ECONNABORTED`: Request timeout

---

### `cancelRideWithPolicy(rideId: string, data?: CancelRideRequest)`

Cancels a ride with automatic policy enforcement.

**Parameters:**
- `rideId` (string): The ID of the ride to cancel
- `data` (optional): Cancellation data
  - `reason` (string, optional): Reason for cancellation

**Returns:**
```typescript
{
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
      type: 'free' | 'standard' | 'penalty' | 'not_allowed';
      fee: number;
      refundAmount?: number;
      refundScheduledFor?: string;
    };
    message: string;
  };
}
```

**Example:**
```typescript
import { rideAPI } from '@/services/api';

try {
  const response = await rideAPI.cancelRideWithPolicy('ride-123', {
    reason: 'Change of plans'
  });
  
  console.log('Message:', response.data.message);
  console.log('Fee charged:', response.data.policy.fee);
  
  if (response.data.policy.refundAmount) {
    console.log('Refund amount:', response.data.policy.refundAmount);
    console.log('Refund scheduled for:', response.data.policy.refundScheduledFor);
  }
} catch (error) {
  console.error('Error:', error.message);
}
```

**Error Handling:**
- `400`: Cannot cancel ride in current status
- `403`: Not authorized to cancel this ride
- `404`: Ride not found
- `ECONNABORTED`: Cancellation timeout

---

## Cancellation Policy Types

### `free`
- **When**: Cancellation within first 2 minutes
- **Fee**: Bs. 0.00
- **Refund**: None

### `standard`
- **When**: Cancellation after 2 minutes, driver accepted
- **Fee**: Bs. 5.00
- **Refund**: None

### `penalty`
- **When**: Cancellation after driver arrived
- **Fee**: 50% of estimated fare
- **Refund**: 50% of estimated fare (processed in 24 hours)

### `not_allowed`
- **When**: Ride in progress or completed
- **Fee**: N/A
- **Refund**: N/A

---

## Usage Example: Complete Cancellation Flow

```typescript
import { useState } from 'react';
import { Alert } from 'react-native';
import { rideAPI } from '@/services/api';

function CancelRideButton({ rideId }: { rideId: string }) {
  const [loading, setLoading] = useState(false);

  const handleCancel = async () => {
    setLoading(true);
    
    try {
      // Step 1: Get cancellation policy
      const policyResponse = await rideAPI.getCancellationPolicy(rideId);
      
      if (!policyResponse.data.canCancel) {
        Alert.alert('Error', 'Cannot cancel this ride');
        return;
      }
      
      // Step 2: Show confirmation with policy details
      const { policy, warnings } = policyResponse.data;
      const warningMessage = warnings.join('\n');
      
      Alert.alert(
        'Cancel Ride?',
        warningMessage,
        [
          { text: 'Keep Ride', style: 'cancel' },
          {
            text: 'Cancel Ride',
            style: 'destructive',
            onPress: async () => {
              try {
                // Step 3: Cancel the ride
                const cancelResponse = await rideAPI.cancelRideWithPolicy(rideId, {
                  reason: 'User cancelled'
                });
                
                // Step 4: Show result
                Alert.alert('Success', cancelResponse.data.message);
              } catch (error) {
                Alert.alert('Error', error.message);
              }
            }
          }
        ]
      );
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button 
      title="Cancel Ride" 
      onPress={handleCancel} 
      disabled={loading}
    />
  );
}
```

---

## TypeScript Types

All API types are defined in `@/types/api.ts`:

```typescript
import type {
  GetCancellationPolicyResponse,
  CancelRideRequest,
  CancelRideResponse,
  CancellationPolicy,
  CancellationPolicyType,
} from '@/types/api';
```

---

## Error Handling Best Practices

1. **Always use try-catch blocks** when calling API methods
2. **Check error types** using `axios.isAxiosError(error)`
3. **Display user-friendly messages** instead of raw error objects
4. **Handle timeout errors** separately for better UX
5. **Log errors** for debugging purposes

```typescript
try {
  const response = await rideAPI.cancelRideWithPolicy(rideId);
  // Handle success
} catch (error) {
  if (axios.isAxiosError(error)) {
    // Axios error - network or HTTP error
    console.error('API Error:', error.response?.data);
    Alert.alert('Error', error.message);
  } else {
    // Other error
    console.error('Unexpected error:', error);
    Alert.alert('Error', 'An unexpected error occurred');
  }
}
```

---

## Testing

### Unit Tests

```typescript
import { rideAPI } from '@/services/api';
import MockAdapter from 'axios-mock-adapter';
import api from '@/services/api';

describe('rideAPI.getCancellationPolicy', () => {
  let mock: MockAdapter;

  beforeEach(() => {
    mock = new MockAdapter(api);
  });

  afterEach(() => {
    mock.restore();
  });

  it('should return cancellation policy', async () => {
    const mockResponse = {
      success: true,
      data: {
        canCancel: true,
        policy: {
          type: 'free',
          fee: 0,
          timeElapsed: 60,
          gracePeriodRemaining: 60
        },
        warnings: ['Quedan 60 segundos de cancelación gratis']
      }
    };

    mock.onGet('/api/rides/ride-123/cancellation-policy').reply(200, mockResponse);

    const response = await rideAPI.getCancellationPolicy('ride-123');
    
    expect(response.success).toBe(true);
    expect(response.data.policy.type).toBe('free');
  });

  it('should handle 404 error', async () => {
    mock.onGet('/api/rides/ride-123/cancellation-policy').reply(404);

    await expect(
      rideAPI.getCancellationPolicy('ride-123')
    ).rejects.toThrow('Ride not found');
  });
});
```

---

## Migration Guide

### From Old `cancelRide` to New `cancelRideWithPolicy`

**Before:**
```typescript
await rideAPI.cancelRide(rideId, 'User cancelled');
```

**After:**
```typescript
// Get policy first
const policy = await rideAPI.getCancellationPolicy(rideId);

// Show confirmation with policy details
// ...

// Cancel with policy
await rideAPI.cancelRideWithPolicy(rideId, {
  reason: 'User cancelled'
});
```

---

## Related Documentation

- [Backend API Documentation](../../../backend/docs/api/cancellation.md)
- [Cancellation Policy Design](../../../.kiro/specs/ride-cancellation-policies/design.md)
- [TypeScript Types](../types/api.ts)
