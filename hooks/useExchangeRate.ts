/**
 * useExchangeRate Hook
 * Fetches and caches the BCV exchange rate (USD ↔ VES)
 * Used for dual-currency display across the app
 */
import { useState, useEffect, useCallback } from 'react';
import api from '@/services/api';

interface ExchangeRate {
  bcv: number;
  updatedAt: string;
}

let cachedRate: ExchangeRate | null = null;
let fetchPromise: Promise<ExchangeRate | null> | null = null;

export function useExchangeRate(): {
  rate: ExchangeRate | null;
  loading: boolean;
  convertToUsd: (bsAmount: number) => string;
  convertToBs: (usdAmount: number) => string;
} {
  const [rate, setRate] = useState<ExchangeRate | null>(cachedRate);
  const [loading, setLoading] = useState(!cachedRate);

  useEffect(() => {
    if (cachedRate) {
      setRate(cachedRate);
      setLoading(false);
      return;
    }

    if (!fetchPromise) {
      fetchPromise = (async () => {
        try {
          const response = await api.get('/api/fares/exchange-rate');
          const data = response.data?.data || response.data;
          if (data?.bcv && data.bcv > 0) {
            cachedRate = { bcv: data.bcv, updatedAt: data.updatedAt || '' };
            return cachedRate;
          }
          return null;
        } catch {
          console.warn('[ExchangeRate] Failed to fetch BCV rate');
          return null;
        } finally {
          fetchPromise = null;
        }
      })();
    }

    fetchPromise.then((result) => {
      if (result) {
        setRate(result);
      }
      setLoading(false);
    });
  }, []);

  const convertToUsd = useCallback(
    (bsAmount: number): string => {
      if (!rate || rate.bcv <= 0) return '—';
      return (bsAmount / rate.bcv).toFixed(2);
    },
    [rate]
  );

  const convertToBs = useCallback(
    (usdAmount: number): string => {
      if (!rate || rate.bcv <= 0) return '—';
      return (usdAmount * rate.bcv).toFixed(2);
    },
    [rate]
  );

  return { rate, loading, convertToUsd, convertToBs };
}
