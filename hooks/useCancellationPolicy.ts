import { useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { rideAPI } from '@/services/api';

const TOKEN_KEY = 'auth_token';

interface CancellationPolicy {
  canCancel: boolean;
  type: 'free' | 'standard' | 'penalty' | 'not_allowed';
  fee: number;
  refundAmount?: number;
  timeElapsed: number;
  gracePeriodRemaining?: number;
  warnings: string[];
}

interface UseCancellationPolicyOptions {
  enabled?: boolean; // Allow disabling the hook
}

export function useCancellationPolicy(
  rideId: string | null,
  options: UseCancellationPolicyOptions = {}
) {
  const { enabled = true } = options;
  const [policy, setPolicy] = useState<CancellationPolicy | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Don't fetch if disabled or no rideId
    if (!enabled || !rideId) {
      setPolicy(null);
      setError(null);
      setLoading(false);
      return;
    }

    let isMounted = true;

    const fetchPolicy = async () => {
      if (!isMounted) return;
      
      // Double-check that we have a token before making the request
      try {
        const token = await SecureStore.getItemAsync(TOKEN_KEY);
        if (!token) {
          console.log('[CANCELLATION_POLICY] No auth token found, skipping fetch');
          if (isMounted) {
            setPolicy(null);
            setError(null);
            setLoading(false);
          }
          return;
        }
      } catch (tokenError) {
        console.error('[CANCELLATION_POLICY] Error checking token:', tokenError);
        if (isMounted) {
          setPolicy(null);
          setError(null);
          setLoading(false);
        }
        return;
      }
      
      setLoading(true);
      setError(null);

      try {
        const response = await rideAPI.getCancellationPolicy(rideId);
        
        if (!isMounted) return;

        // Transform the API response to match our hook's interface
        // rideAPI.getCancellationPolicy already returns GetCancellationPolicyResponse
        // which has structure: { success: true, data: { canCancel, policy, warnings } }
        const apiData = response.data;
        const transformedPolicy: CancellationPolicy = {
          canCancel: apiData.canCancel,
          type: apiData.policy.type,
          fee: apiData.policy.fee,
          refundAmount: apiData.policy.refundAmount,
          timeElapsed: apiData.policy.timeElapsed,
          gracePeriodRemaining: apiData.policy.gracePeriodRemaining,
          warnings: apiData.warnings,
        };
        
        setPolicy(transformedPolicy);
      } catch (err: any) {
        if (!isMounted) return;

        // Log detailed error information for debugging
        const errorDetails = {
          status: err.response?.status,
          statusText: err.response?.statusText,
          errorCode: err.response?.data?.error?.code,
          errorMessage: err.response?.data?.error?.message,
          message: err.message,
          code: err.code,
          rideId,
        };
        console.log('[CANCELLATION_POLICY] Error details:', errorDetails);

        // Handle different error types
        if (!err.response) {
          // No response means network error or request didn't reach server
          console.log('[CANCELLATION_POLICY] No response from server (network error or request failed)');
          setPolicy(null);
        } else if (err.response.status === 404) {
          // 404: Ride not found or not in valid state - silent handling
          console.log('[CANCELLATION_POLICY] Ride not found (404), skipping policy fetch');
          setPolicy(null);
        } else if (err.response.status === 401 || err.response.status === 403) {
          // 401/403: Authentication/authorization errors - silent handling
          console.log('[CANCELLATION_POLICY] Auth error (401/403), skipping policy fetch');
          setPolicy(null);
        } else if (err.response.status === 400) {
          // 400: Bad request - likely ride in invalid state
          console.log('[CANCELLATION_POLICY] Bad request (400), ride may be in invalid state');
          setPolicy(null);
        } else {
          // Other errors: only log in development
          if (__DEV__) {
            console.error('[CANCELLATION_POLICY] Unexpected error:', err);
          }
          setPolicy(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchPolicy();

    // Actualizar cada 10 segundos para mantener el tiempo actualizado
    // Only if enabled
    const interval = setInterval(() => {
      if (enabled && isMounted) {
        fetchPolicy();
      }
    }, 10000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [rideId, enabled]);

  return { policy, loading, error };
}