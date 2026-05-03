/**
 * EarningsScreen - Driver Earnings Screen
 * Displays the driver's current wallet balance and transaction history
 * Uses the digital wallet API instead of legacy earnings endpoints
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 8.2
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Colors as colors } from '@/constants/theme';
import walletService, {
  WalletResponseDto,
  WalletTransactionDto,
} from '@/services/walletService';
import { formatCurrency } from '@/utils/currency';

const PAGE_SIZE = 20;

export default function DriverEarningsScreen() {
  const [wallet, setWallet] = useState<WalletResponseDto | null>(null);
  const [transactions, setTransactions] = useState<WalletTransactionDto[]>([]);
  const [totalTransactions, setTotalTransactions] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  /**
   * Load initial wallet data and first page of transactions in parallel
   */
  const loadInitialData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const [walletData, txData] = await Promise.all([
        walletService.getMyWallet(),
        walletService.getTransactions(PAGE_SIZE, 0),
      ]);

      setWallet(walletData.wallet);
      setTransactions(txData.transactions);
      setTotalTransactions(txData.totalTransactions);
      setOffset(txData.transactions.length);
      setHasMore(txData.transactions.length < txData.totalTransactions);
    } catch (err: any) {
      const message =
        err?.response?.data?.message ||
        err?.message ||
        'No se pudo cargar la información de ganancias';
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  /**
   * Load more transactions when user scrolls to the end
   */
  const loadMoreTransactions = useCallback(async () => {
    if (loadingMore || !hasMore) return;

    try {
      setLoadingMore(true);
      const data = await walletService.getTransactions(PAGE_SIZE, offset);
      setTransactions(prev => [...prev, ...data.transactions]);
      const newOffset = offset + data.transactions.length;
      setOffset(newOffset);
      setTotalTransactions(data.totalTransactions);
      setHasMore(newOffset < data.totalTransactions);
    } catch (err: any) {
      // Non-fatal: just stop loading more, user can scroll again
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, offset]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  const handleRefresh = useCallback(() => {
    loadInitialData(true);
  }, [loadInitialData]);

  // Initial loading state
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Cargando ganancias...</Text>
      </View>
    );
  }

  // Error state
  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => loadInitialData()}>
          <Text style={styles.retryButtonText}>Reintentar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isEmpty = (!wallet || wallet.balance === 0) && transactions.length === 0;
  const currency = wallet?.currency ?? 'VES';

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      data={transactions}
      keyExtractor={item => item.id}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          colors={[colors.primary]}
          tintColor={colors.primary}
        />
      }
      onEndReached={hasMore ? loadMoreTransactions : undefined}
      onEndReachedThreshold={0.3}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={
        <>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Ganancias</Text>
          </View>

          {/* Balance Card */}
          <View style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>Balance Actual</Text>
            <Text style={styles.balanceAmount}>
              {formatCurrency(wallet?.balance ?? 0, currency)}
            </Text>
            {isEmpty && (
              <Text style={styles.noEarningsText}>Sin ganancias aún</Text>
            )}
            <Text style={styles.currencyLabel}>
              {currency === 'USD' ? 'Dólares (USD)' : 'Bolívares (VES)'}
            </Text>
          </View>

          {/* Transaction History Header */}
          {transactions.length > 0 && (
            <View style={styles.historyHeader}>
              <Text style={styles.historyTitle}>Historial de Transacciones</Text>
              {totalTransactions > 0 && (
                <Text style={styles.historyCount}>{totalTransactions} total</Text>
              )}
            </View>
          )}
        </>
      }
      renderItem={({ item }) => (
        <TransactionItem transaction={item} currency={currency} />
      )}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      ListEmptyComponent={
        isEmpty ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Sin ganancias aún</Text>
            <Text style={styles.emptySubtext}>
              Tus ganancias aparecerán aquí cuando completes viajes
            </Text>
          </View>
        ) : null
      }
      ListFooterComponent={
        loadingMore ? (
          <View style={styles.footerLoader}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.footerLoaderText}>Cargando más...</Text>
          </View>
        ) : null
      }
    />
  );
}

/**
 * Individual transaction item
 */
function TransactionItem({
  transaction,
  currency,
}: {
  transaction: WalletTransactionDto;
  currency: 'VES' | 'USD';
}) {
  const isEarning = transaction.type === 'EARNING';
  const amountColor = isEarning ? colors.primary : colors.warning;

  const typeLabel =
    transaction.type === 'EARNING'
      ? 'Ganancia'
      : transaction.type === 'ADJUSTMENT'
        ? 'Ajuste'
        : 'Reembolso';

  const dateStr = new Date(transaction.createdAt).toLocaleString('es-VE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  return (
    <View style={styles.transactionItem}>
      <View style={styles.transactionDetails}>
        <View style={styles.transactionRow}>
          <Text style={styles.transactionType}>{typeLabel}</Text>
          <Text style={[styles.transactionAmount, { color: amountColor }]}>
            +{formatCurrency(transaction.amount, currency)}
          </Text>
        </View>
        <Text style={styles.transactionDate}>{dateStr}</Text>
        {transaction.rideDetails && (
          <View style={styles.rideDetails}>
            <Text style={styles.rideDetailText} numberOfLines={1}>
              📍 {transaction.rideDetails.pickup}
            </Text>
            <Text style={styles.rideDetailText} numberOfLines={1}>
              🏁 {transaction.rideDetails.destination}
            </Text>
          </View>
        )}
        {transaction.description ? (
          <Text style={styles.transactionDescription}>{transaction.description}</Text>
        ) : null}
      </View>
    </View>
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 32,
    gap: 16,
  },
  errorText: {
    fontSize: 14,
    color: colors.error ?? '#EF4444',
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
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
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.darkGray,
  },
  historyCount: {
    fontSize: 12,
    color: colors.lightGray,
  },
  transactionItem: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  transactionDetails: {
    flex: 1,
  },
  transactionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  transactionType: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.darkGray,
  },
  transactionAmount: {
    fontSize: 15,
    fontWeight: '700',
  },
  transactionDate: {
    fontSize: 12,
    color: colors.lightGray,
    marginBottom: 4,
  },
  rideDetails: {
    gap: 2,
    marginTop: 4,
  },
  rideDetailText: {
    fontSize: 12,
    color: colors.mediumGray,
  },
  transactionDescription: {
    fontSize: 12,
    color: colors.mediumGray,
    marginTop: 4,
    fontStyle: 'italic',
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: 20,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 32,
    gap: 8,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.darkGray,
  },
  emptySubtext: {
    fontSize: 13,
    color: colors.lightGray,
    textAlign: 'center',
  },
  footerLoader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  footerLoaderText: {
    fontSize: 13,
    color: colors.lightGray,
  },
});
