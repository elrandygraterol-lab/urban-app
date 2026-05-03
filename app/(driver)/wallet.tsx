/**
 * WalletScreen - Driver Wallet Screen
 * Displays the driver's current balance and transaction history
 * Requirements: 1.1, 1.2, 1.3, 1.4, 5.2, 5.3, 5.4, 5.5
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { Colors as colors } from '@/constants/theme';
import walletService, {
  WalletResponseDto,
  WalletTransactionDto,
} from '@/services/walletService';
import TransactionHistory from './components/TransactionHistory';

const PAGE_SIZE = 20;

export default function WalletScreen() {
  const [wallet, setWallet] = useState<WalletResponseDto | null>(null);
  const [transactions, setTransactions] = useState<WalletTransactionDto[]>([]);
  const [totalTransactions, setTotalTransactions] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [offset, setOffset] = useState(0);

  const loadWalletData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const data = await walletService.getMyWallet();
      setWallet(data.wallet);
      setTransactions(data.transactions);
      setTotalTransactions(data.totalTransactions);
      setOffset(data.transactions.length);
    } catch (error: any) {
      const message =
        error?.response?.data?.message ||
        error?.message ||
        'No se pudo cargar la información de la billetera';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadMoreTransactions = useCallback(async () => {
    if (loadingMore || transactions.length >= totalTransactions) return;

    try {
      setLoadingMore(true);
      const data = await walletService.getTransactions(PAGE_SIZE, offset);
      setTransactions(prev => [...prev, ...data.transactions]);
      setOffset(prev => prev + data.transactions.length);
      setTotalTransactions(data.totalTransactions);
    } catch (error: any) {
      const message =
        error?.response?.data?.message ||
        error?.message ||
        'No se pudo cargar más transacciones';
      Alert.alert('Error', message);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, transactions.length, totalTransactions, offset]);

  useEffect(() => {
    loadWalletData();
  }, [loadWalletData]);

  const handleRefresh = useCallback(() => {
    loadWalletData(true);
  }, [loadWalletData]);

  const formatBalance = (balance: number, currency: string): string => {
    const symbol = currency === 'USD' ? '$' : 'Bs.';
    return `${symbol} ${balance.toFixed(2)}`;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Cargando billetera...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          colors={[colors.primary]}
          tintColor={colors.primary}
        />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mi Billetera</Text>
      </View>

      {/* Balance Card */}
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Ganancias Acumuladas</Text>
        {wallet ? (
          <>
            <Text style={styles.balanceAmount}>
              {formatBalance(wallet.balance, wallet.currency)}
            </Text>
            {wallet.balance === 0 && (
              <Text style={styles.noEarningsText}>Sin ganancias aún</Text>
            )}
          </>
        ) : (
          <Text style={styles.balanceAmount}>Bs. 0.00</Text>
        )}
        <Text style={styles.currencyLabel}>
          {wallet?.currency === 'USD' ? 'Dólares (USD)' : 'Bolívares (VES)'}
        </Text>
      </View>

      {/* Transaction History */}
      <View style={styles.historySection}>
        <TransactionHistory
          transactions={transactions}
          totalTransactions={totalTransactions}
          loading={loading}
          loadingMore={loadingMore}
          onLoadMore={loadMoreTransactions}
          currency={wallet?.currency || 'VES'}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  contentContainer: {
    paddingBottom: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: colors.lightGray,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.darkGray,
  },
  balanceCard: {
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 24,
    backgroundColor: colors.primary,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  balanceLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.85)',
    marginBottom: 8,
    fontWeight: '500',
  },
  balanceAmount: {
    fontSize: 36,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  noEarningsText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.75)',
    marginTop: 6,
    fontStyle: 'italic',
  },
  currencyLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 8,
  },
  historySection: {
    paddingHorizontal: 20,
  },
});
