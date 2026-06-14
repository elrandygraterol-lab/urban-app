/**
 * TransactionHistory - Component for displaying driver transaction history
 * Shows list of transactions with amount, date/time, and ride details
 * Implements infinite scroll with pagination
 * Requirements: 5.2, 5.3, 5.4, 5.5
 */

import React, { useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors as colors } from '@/constants/theme';
import { WalletTransactionDto } from '@/services/walletService';

interface TransactionHistoryProps {
  transactions: WalletTransactionDto[];
  totalTransactions: number;
  loading: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  currency: string;
}

/**
 * Format a date string to a localized date/time string
 */
function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString('es-VE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/**
 * Format amount with currency symbol
 */
function formatAmount(amount: number, currency: string): string {
  const symbol = currency === 'USD' ? '$' : 'Bs.';
  return `${symbol} ${amount.toFixed(2)}`;
}

/**
 * Get transaction type label in Spanish
 */
function getTransactionTypeLabel(type: WalletTransactionDto['type']): string {
  switch (type) {
    case 'EARNING':
      return 'Ganancia';
    case 'ADJUSTMENT':
      return 'Ajuste';
    case 'REFUND':
      return 'Reembolso';
    default:
      return type;
  }
}

/**
 * Get icon name for transaction type
 */
function getTransactionIcon(type: WalletTransactionDto['type']): keyof typeof Ionicons.glyphMap {
  switch (type) {
    case 'EARNING':
      return 'car';
    case 'ADJUSTMENT':
      return 'swap-horizontal';
    case 'REFUND':
      return 'return-down-back';
    default:
      return 'cash';
  }
}

/**
 * Individual transaction item component
 */
const TransactionItem = React.memo(
  ({ transaction, currency }: { transaction: WalletTransactionDto; currency: string }) => {
    const isEarning = transaction.type === 'EARNING';
    const amountColor = isEarning ? colors.primary : colors.warning;

    return (
      <View style={styles.transactionItem}>
        {/* Icon */}
        <View
          style={[styles.iconContainer, { backgroundColor: isEarning ? '#dcfce7' : '#fef3c7' }]}
        >
          <Ionicons name={getTransactionIcon(transaction.type)} size={20} color={amountColor} />
        </View>

        {/* Transaction Details */}
        <View style={styles.transactionDetails}>
          <View style={styles.transactionHeader}>
            <Text style={styles.transactionType}>{getTransactionTypeLabel(transaction.type)}</Text>
            <Text style={[styles.transactionAmount, { color: amountColor }]}>
              +{formatAmount(transaction.amount, currency)}
            </Text>
          </View>

          {/* Date/Time */}
          <Text style={styles.transactionDate}>{formatDateTime(transaction.createdAt)}</Text>

          {/* Ride Details */}
          {transaction.rideDetails && (
            <View style={styles.rideDetails}>
              <View style={styles.rideDetailRow}>
                <Ionicons name="location" size={12} color={colors.lightGray} />
                <Text style={styles.rideDetailText} numberOfLines={1}>
                  {transaction.rideDetails.pickup}
                </Text>
              </View>
              <View style={styles.rideDetailRow}>
                <Ionicons name="flag" size={12} color={colors.lightGray} />
                <Text style={styles.rideDetailText} numberOfLines={1}>
                  {transaction.rideDetails.destination}
                </Text>
              </View>
            </View>
          )}

          {/* Description if available */}
          {transaction.description && (
            <Text style={styles.transactionDescription}>{transaction.description}</Text>
          )}
        </View>
      </View>
    );
  }
);

TransactionItem.displayName = 'TransactionItem';

/**
 * Footer component for the FlatList - shows loading indicator or load more button
 */
const ListFooter = ({
  loadingMore,
  hasMore,
  onLoadMore,
}: {
  loadingMore: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
}) => {
  if (loadingMore) {
    return (
      <View style={styles.footerContainer}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={styles.footerText}>Cargando más...</Text>
      </View>
    );
  }

  if (hasMore) {
    return (
      <TouchableOpacity style={styles.loadMoreButton} onPress={onLoadMore} activeOpacity={0.7}>
        <Text style={styles.loadMoreText}>Cargar más transacciones</Text>
        <Ionicons name="chevron-down" size={16} color={colors.primary} />
      </TouchableOpacity>
    );
  }

  return null;
};

/**
 * Empty state component
 */
const EmptyState = () => (
  <View style={styles.emptyContainer}>
    <Ionicons name="wallet-outline" size={48} color={colors.lightGray} />
    <Text style={styles.emptyTitle}>No hay transacciones</Text>
    <Text style={styles.emptySubtitle}>Tus ganancias aparecerán aquí cuando completes viajes</Text>
  </View>
);

/**
 * TransactionHistory component
 * Displays a paginated list of wallet transactions ordered from most recent to oldest
 */
export default function TransactionHistory({
  transactions,
  totalTransactions,
  loading,
  loadingMore,
  onLoadMore,
  currency,
}: TransactionHistoryProps) {
  const hasMore = transactions.length < totalTransactions;

  const renderItem = useCallback(
    ({ item }: { item: WalletTransactionDto }) => (
      <TransactionItem transaction={item} currency={currency} />
    ),
    [currency]
  );

  const keyExtractor = useCallback((item: WalletTransactionDto) => item.id, []);

  const renderFooter = useCallback(
    () => <ListFooter loadingMore={loadingMore} hasMore={hasMore} onLoadMore={onLoadMore} />,
    [loadingMore, hasMore, onLoadMore]
  );

  const renderEmpty = useCallback(() => {
    if (loading) return null;
    return <EmptyState />;
  }, [loading]);

  return (
    <View style={styles.container}>
      {/* Section Header */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Historial de Transacciones</Text>
        {totalTransactions > 0 && (
          <Text style={styles.transactionCount}>{totalTransactions} total</Text>
        )}
      </View>

      {/* Transaction List */}
      <FlatList
        data={transactions}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={renderFooter}
        scrollEnabled={false}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        contentContainerStyle={transactions.length === 0 ? styles.emptyListContent : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.darkGray,
  },
  transactionCount: {
    fontSize: 12,
    color: colors.lightGray,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    gap: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  transactionDetails: {
    flex: 1,
  },
  transactionHeader: {
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
  rideDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rideDetailText: {
    fontSize: 12,
    color: colors.mediumGray,
    flex: 1,
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
  },
  footerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  footerText: {
    fontSize: 13,
    color: colors.lightGray,
  },
  loadMoreButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 6,
  },
  loadMoreText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.darkGray,
  },
  emptySubtitle: {
    fontSize: 13,
    color: colors.lightGray,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  emptyListContent: {
    flexGrow: 1,
  },
});
