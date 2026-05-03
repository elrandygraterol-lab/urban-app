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
 * Get the authenticated driver's wallet with recent transactions
 */
export async function getMyWallet(): Promise<WalletWithTransactionsDto> {
  const response = await api.get<WalletWithTransactionsDto>('/api/wallet/my-wallet');
  return response.data;
}

/**
 * Get paginated transaction history for the authenticated driver
 */
export async function getTransactions(
  limit: number = 20,
  offset: number = 0,
  params?: Omit<GetTransactionsParams, 'limit' | 'offset'>
): Promise<WalletWithTransactionsDto> {
  const response = await api.get<WalletWithTransactionsDto>('/api/wallet/transactions', {
    params: {
      limit,
      offset,
      ...params,
    },
  });
  return response.data;
}

export const walletService = {
  getMyWallet,
  getTransactions,
};

export default walletService;
