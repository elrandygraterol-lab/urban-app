/**
 * Wallet Service - API calls for driver wallet functionality
 * Handles communication with the backend wallet endpoints
 */

import api from './api';

export interface WalletResponseDto {
  id: string;
  driverId: string;
  balance: number;
  currency: 'VES' | 'USD';
  createdAt: string;
  updatedAt: string;
}

export interface WalletTransactionDto {
  id: string;
  amount: number;
  type: 'EARNING' | 'ADJUSTMENT' | 'REFUND';
  description: string | null;
  rideId: string;
  paymentId: string;
  createdAt: string;
  currency: string;
  originalAmount?: number;
  originalCurrency?: string;
  rideDetails?: {
    pickup: string;
    destination: string;
    completedAt: string;
  };
}

export interface WalletWithTransactionsDto {
  wallet: WalletResponseDto;
  transactions: WalletTransactionDto[];
  totalTransactions: number;
}

export interface GetTransactionsParams {
  limit?: number;
  offset?: number;
  startDate?: string;
  endDate?: string;
}

/**
 * Get the authenticated driver's wallet
 */
export async function getMyWallet(): Promise<WalletResponseDto> {
  const response = await api.get<any>('/api/wallet/my-wallet');
  return response.data.data;
}

/**
 * Get paginated transaction history for the authenticated driver
 */
export async function getTransactions(
  limit: number = 20,
  offset: number = 0,
  params?: Omit<GetTransactionsParams, 'limit' | 'offset'>
): Promise<WalletWithTransactionsDto> {
  const response = await api.get<any>('/api/wallet/transactions', {
    params: {
      limit,
      offset,
      ...params,
    },
  });
  return response.data.data;
}

export interface ExchangeRateResponse {
  bcv: number | null;
  updatedAt: string;
  fetchedDate: string;
}

/**
 * Get the current BCV exchange rate (VES per USD)
 */
export async function getExchangeRate(): Promise<ExchangeRateResponse> {
  const response = await api.get<any>('/api/fares/exchange-rate');
  return response.data.data;
}

export interface CommissionRateResponse {
  id: string;
  rate: number;
  isActive: boolean;
  effectiveFrom: string;
  createdAt: string;
  createdByUser?: {
    name: string;
    email: string;
  };
  notes?: string;
}

/**
 * Get the current commission rate for drivers
 */
export async function getCommissionRate(): Promise<CommissionRateResponse> {
  const response = await api.get<any>('/api/driver/commissions/rate');
  return response.data.data;
}

export const walletService = {
  getMyWallet,
  getTransactions,
  getExchangeRate,
  getCommissionRate,
};

export default walletService;
