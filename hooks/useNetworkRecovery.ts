import { useEffect, useRef } from 'react';
import { addNetworkListener, getNetworkStatus } from './useNetworkStatus';

/**
 * Hook that fires a callback when internet connectivity is restored
 * after being offline. Useful for refreshing ride state, retrying
 * failed API calls, and recovering from network interruptions.
 */
export function useNetworkRecovery(onRecover: () => void | Promise<void>) {
  const wasOfflineRef = useRef(false);
  const lastRecoveryTimeRef = useRef(0);
  const onRecoverRef = useRef(onRecover);
  onRecoverRef.current = onRecover;

  useEffect(() => {
    const initialStatus = getNetworkStatus();
    wasOfflineRef.current = !initialStatus.isConnected || initialStatus.isInternetReachable === false;

    const cleanup = addNetworkListener((status) => {
      const isCurrentlyOffline = !status.isConnected || status.isInternetReachable === false;

      if (wasOfflineRef.current && !isCurrentlyOffline) {
        // Internet just came back — throttle recoveries to at most once every 5 seconds
        const now = Date.now();
        if (now - lastRecoveryTimeRef.current > 5000) {
          lastRecoveryTimeRef.current = now;
          console.log('[NETWORK_RECOVERY] Connection restored — triggering recovery');
          onRecoverRef.current();
        }
      }

      wasOfflineRef.current = isCurrentlyOffline;
    });

    return cleanup;
  }, []);
}

/**
 * Retry helper — calls fn with exponential backoff up to maxRetries times.
 * Returns true if succeeded, false if all attempts failed.
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 1000
): Promise<T> {
  let lastError: any;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        const delay = Math.pow(2, attempt - 1) * baseDelayMs;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries - 1) {
        console.log(`[RETRY] Attempt ${attempt + 1} failed, retrying in ${Math.pow(2, attempt) * baseDelayMs}ms...`);
      }
    }
  }
  throw lastError;
}

/**
 * Check if an error is a network-related error (timeout, no connection, etc.)
 */
export function isNetworkError(error: any): boolean {
  if (!error) return false;
  const message = error?.message || '';
  const code = error?.code || '';
  return (
    message.includes('Network') ||
    message.includes('network') ||
    message.includes('timeout') ||
    message.includes('Timeout') ||
    message.includes('ECONNREFUSED') ||
    message.includes('ECONNABORTED') ||
    message.includes('ETIMEDOUT') ||
    message.includes('ENOTFOUND') ||
    message.includes('No connection') ||
    message.includes('no connection') ||
    message.includes('internet') ||
    message.includes('Internet') ||
    code === 'ECONNABORTED' ||
    code === 'ECONNREFUSED' ||
    code === 'ETIMEDOUT' ||
    code === 'ERR_NETWORK'
  );
}
