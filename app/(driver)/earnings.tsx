/**
 * EarningsScreen - Driver Earnings Screen
 * Displays the driver's current wallet balance and transaction history
 * Uses the digital wallet API instead of legacy earnings endpoints
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 8.2
 */

import React, { useState, useEffect, useCallback, useMemo, Component, ErrorInfo, ReactNode } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  AppState,
  StyleSheet,
} from 'react-native';
import { Colors as colors } from '@/constants/theme';
import walletService, {
  WalletResponseDto,
  WalletTransactionDto,
  ExchangeRateResponse,
  getExchangeRate,
} from '@/services/walletService';
import { formatCurrency, Currency } from '@/utils/currency';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const PAGE_SIZE = 20;

export default function DriverEarningsScreen() {
  return (
    <EarningsErrorBoundary>
      <DriverEarningsScreenContent />
    </EarningsErrorBoundary>
  );
}

function DriverEarningsScreenContent() {
  const [wallet, setWallet] = useState<WalletResponseDto | null>(null);
  const [transactions, setTransactions] = useState<WalletTransactionDto[]>([]);
  const [totalTransactions, setTotalTransactions] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [exchangeRate, setExchangeRate] = useState<ExchangeRateResponse | null>(null);

  const getDateParams = useCallback((filter: string) => {
    const now = new Date();
    switch (filter) {
      case 'today': {
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        return { startDate: start.toISOString() };
      }
      case 'week': {
        const start = new Date(now);
        start.setDate(start.getDate() - start.getDay());
        start.setHours(0, 0, 0, 0);
        return { startDate: start.toISOString() };
      }
      case 'month': {
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        return { startDate: start.toISOString() };
      }
      default:
        return {};
    }
  }, []);

  /**
   * Load initial wallet data and first page of transactions in parallel
   */
  const loadInitialData = useCallback(async (isRefresh = false, filter?: string) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const activeFilter = filter || dateFilter;
      const dateParams = getDateParams(activeFilter);

      const [walletData, txData, rate] = await Promise.all([
        walletService.getMyWallet(),
        walletService.getTransactions(PAGE_SIZE, 0, dateParams),
        getExchangeRate().catch(() => null),
      ]);

      setWallet(walletData);
      setTransactions(txData.transactions);
      setTotalTransactions(txData.totalTransactions);
      setOffset(txData.transactions.length);
      setHasMore(txData.transactions.length < txData.totalTransactions);
      setExchangeRate(rate);
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
  }, [dateFilter, getDateParams]);

  /**
   * Load more transactions when user scrolls to the end
   */
  const loadMoreTransactions = useCallback(async () => {
    if (loadingMore || !hasMore) return;

    try {
      setLoadingMore(true);
      const dateParams = getDateParams(dateFilter);
      const data = await walletService.getTransactions(PAGE_SIZE, offset, dateParams);
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
  }, [loadingMore, hasMore, offset, dateFilter, getDateParams]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        loadInitialData(true);
      }
    });
    return () => subscription.remove();
  }, [loadInitialData]);

  const handleRefresh = useCallback(() => {
    loadInitialData(true);
  }, [loadInitialData]);

  const handleDateFilter = useCallback((filter: 'all' | 'today' | 'week' | 'month') => {
    setDateFilter(filter);
    loadInitialData(false, filter);
  }, [loadInitialData]);

  const isEmpty = (!wallet || wallet.balance === 0) && transactions.length === 0;
  const currency = wallet?.currency ?? 'VES';

  const todayEarnings = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return transactions
      .filter(tx => tx.type === 'EARNING' && new Date(tx.createdAt) >= today)
      .reduce((sum, tx) => sum + tx.amount, 0);
  }, [transactions]);

  const avgPerRide = useMemo(() => {
    return totalTransactions > 0 && wallet
      ? wallet.balance / totalTransactions
      : 0;
  }, [totalTransactions, wallet]);

  const bcvRate = exchangeRate?.bcv ?? 0;
  const otherCurrency: Currency = currency === 'USD' ? 'VES' : 'USD';
  const balanceOtherCurrency = !wallet ? 0
    : currency === 'USD'
      ? wallet.balance * bcvRate
      : bcvRate > 0 ? wallet.balance / bcvRate : 0;
  const todayEarningsOther = currency === 'USD'
    ? todayEarnings * bcvRate
    : bcvRate > 0 ? todayEarnings / bcvRate : 0;
  const avgPerRideOther = currency === 'USD'
    ? avgPerRide * bcvRate
    : bcvRate > 0 ? avgPerRide / bcvRate : 0;

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

  const filterChips = [
    { key: 'all', label: 'Todo' },
    { key: 'today', label: 'Hoy' },
    { key: 'week', label: 'Semana' },
    { key: 'month', label: 'Mes' },
  ] as const;

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
          <LinearGradient
            colors={[colors.primary, colors.primaryDark]}
            style={styles.balanceCard}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={styles.balanceLabel}>Balance Actual</Text>
            <View style={styles.dualAmountRow}>
              <View style={styles.dualAmountItem}>
                <Text style={styles.dualAmountValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
                  {formatCurrency(wallet?.balance ?? 0, currency)}
                </Text>
                <Text style={styles.dualAmountCurrency}>
                  {currency === 'USD' ? 'USD' : 'VES'}
                </Text>
              </View>
              {bcvRate > 0 && (
                <View style={styles.dualAmountItem}>
                  <View style={styles.dualAmountDivider} />
                  <Text style={styles.dualAmountValueSecondary} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
                    {formatCurrency(balanceOtherCurrency, otherCurrency)}
                  </Text>
                  <Text style={styles.dualAmountCurrencySecondary}>
                    {otherCurrency === 'USD' ? 'USD' : 'VES'}
                  </Text>
                </View>
              )}
            </View>
            {isEmpty && (
              <Text style={styles.noEarningsText}>Sin ganancias aún</Text>
            )}
            <Text style={styles.currencyLabel}>
              Tasa BCV: {bcvRate > 0 ? `Bs. ${bcvRate.toFixed(2)}` : 'No disponible'}
            </Text>
            <View style={styles.balanceIconOverlay}>
              <Ionicons name="wallet-outline" size={80} color="rgba(255,255,255,0.1)" />
            </View>
          </LinearGradient>

          {/* Summary Cards */}
          <View style={styles.summaryGrid}>
            <View style={styles.summaryCard}>
              <Ionicons name="cash-outline" size={20} color={colors.primary} />
              <View style={styles.dualSummaryRow}>
                <Text style={styles.summaryValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                  {formatCurrency(todayEarnings, currency)}
                </Text>
                {bcvRate > 0 && (
                  <Text style={styles.summaryValueSecondary}>
                    {formatCurrency(todayEarningsOther, otherCurrency)}
                  </Text>
                )}
              </View>
              <Text style={styles.summaryLabel}>Ganado Hoy</Text>
            </View>
            <View style={styles.summaryCard}>
              <Ionicons name="car-outline" size={20} color={colors.primary} />
              <Text style={styles.summaryValue}>{totalTransactions}</Text>
              <Text style={styles.summaryValueSecondary}>viajes</Text>
              <Text style={styles.summaryLabel}>Total Viajes</Text>
            </View>
            <View style={styles.summaryCard}>
              <Ionicons name="trending-up-outline" size={20} color={colors.primary} />
              <View style={styles.dualSummaryRow}>
                <Text style={styles.summaryValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                  {totalTransactions > 0 ? formatCurrency(avgPerRide, currency) : formatCurrency(0, currency)}
                </Text>
                {bcvRate > 0 && (
                  <Text style={styles.summaryValueSecondary}>
                    {formatCurrency(avgPerRideOther, otherCurrency)}
                  </Text>
                )}
              </View>
              <Text style={styles.summaryLabel}>Promedio por Viaje</Text>
            </View>
            <View style={styles.summaryCard}>
              <Ionicons name="checkmark-circle-outline" size={20} color={colors.primary} />
              <Text style={[styles.summaryValue, { fontSize: 22 }]}>
                {typeof totalTransactions !== 'undefined' ? `${Math.round((transactions.filter(tx => tx.type === 'EARNING').length / Math.max(totalTransactions, 1)) * 100)}%` : '0%'}
              </Text>
              <Text style={styles.summaryValueSecondary}>tasa de éxito</Text>
              <Text style={styles.summaryLabel}>Tasa Éxito</Text>
            </View>
          </View>

          {/* Date Filter */}
          <View style={styles.filterRow}>
            {filterChips.map(chip => (
              <TouchableOpacity
                key={chip.key}
                style={[styles.filterChip, dateFilter === chip.key && styles.filterChipActive]}
                onPress={() => handleDateFilter(chip.key)}
              >
                <Text style={[styles.filterChipText, dateFilter === chip.key && styles.filterChipTextActive]}>
                  {chip.label}
                </Text>
              </TouchableOpacity>
            ))}
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
        <TransactionItem
          transaction={item}
          currency={currency}
          exchangeRate={bcvRate}
          otherCurrency={otherCurrency}
        />
      )}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      ListEmptyComponent={
        isEmpty && dateFilter === 'all' ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="cash-outline" size={50} color={colors.lightGray} />
            <Text style={styles.emptyText}>Sin ganancias aún</Text>
            <Text style={styles.emptySubtext}>
              Tus ganancias aparecerán aquí cuando completes viajes
            </Text>
          </View>
        ) : isEmpty ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="filter-outline" size={50} color={colors.lightGray} />
            <Text style={styles.emptyText}>Sin resultados</Text>
            <Text style={styles.emptySubtext}>
              No hay transacciones en este periodo para el filtro seleccionado
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
 * Wraps the earnings screen with an error boundary to prevent
 * unhandled rendering errors from crashing the global app.
 */
class EarningsErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('EarningsScreen error:', error.message, errorInfo.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Error al mostrar ganancias</Text>
          <TouchableOpacity style={styles.retryButton} onPress={this.handleRetry}>
            <Text style={styles.retryButtonText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

/**
 * Individual transaction item
 */
function TransactionItem({
  transaction,
  currency,
  exchangeRate,
  otherCurrency,
}: {
  transaction: WalletTransactionDto;
  currency: 'VES' | 'USD';
  exchangeRate: number;
  otherCurrency: Currency;
}) {
  const isEarning = transaction.type === 'EARNING';
  const amountColor = isEarning ? colors.primary : colors.warning;

  const typeLabel =
    transaction.type === 'EARNING'
      ? 'Ganancia'
      : transaction.type === 'ADJUSTMENT'
        ? 'Ajuste'
        : 'Reembolso';

  let dateStr = '';
  try {
    dateStr = transaction.createdAt
      ? new Date(transaction.createdAt).toLocaleString('es-VE', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        })
      : '';
  } catch {
    dateStr = '';
  }

  const txCurrency = (transaction.currency || currency) as Currency;
  const hasDual = exchangeRate > 0;
  const otherAmount = hasDual
    ? txCurrency === 'USD'
      ? transaction.amount * exchangeRate
      : transaction.amount / exchangeRate
    : 0;
  const wasConverted = !!(transaction.originalCurrency && transaction.originalCurrency !== txCurrency);
  const conversionLabel = wasConverted
    ? `${transaction.originalCurrency} → ${txCurrency}`
    : null;

  return (
    <View style={styles.transactionItem}>
      <View style={styles.transactionDetails}>
        <View style={styles.transactionRow}>
          <View style={styles.transactionTypeContainer}>
            <Ionicons
              name={isEarning ? 'arrow-up-circle' : 'arrow-down-circle'}
              size={20}
              color={amountColor}
              style={styles.transactionIcon}
            />
            <View>
              <Text style={styles.transactionType}>{typeLabel}</Text>
              {conversionLabel && (
                <Text style={{ fontSize: 9, color: '#92400e', fontWeight: '600', marginTop: 1 }}>
                  {conversionLabel}
                </Text>
              )}
            </View>
          </View>
          <View style={{ alignItems: 'flex-end', maxWidth: '55%' }}>
            <Text style={[styles.transactionAmount, { color: amountColor }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
              {isEarning ? '+' : '-'}{formatCurrency(transaction.amount, txCurrency)}
            </Text>
            <Text style={[styles.transactionCurrencyLabel]}>
              {txCurrency}
            </Text>
            {hasDual && (
              <>
                <View style={{ height: 3 }} />
                <Text style={[styles.transactionAmountSecondary, { color: amountColor }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                  {formatCurrency(otherAmount, otherCurrency)}
                </Text>
                <Text style={[styles.transactionCurrencyLabelSecondary]}>
                  {otherCurrency}
                </Text>
              </>
            )}
          </View>
        </View>
        <Text style={styles.transactionDate}>{dateStr}</Text>
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
  balanceAmountSecondary: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 4,
  },
  dualAmountRow: {
    alignItems: 'center',
    marginBottom: 4,
  },
  dualAmountItem: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  dualAmountDivider: {
    width: 40,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.25)',
    marginVertical: 4,
    alignSelf: 'center',
  },
  dualAmountValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  dualAmountValueSecondary: {
    fontSize: 22,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.85)',
    letterSpacing: 0.5,
  },
  dualAmountCurrency: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  dualAmountCurrencySecondary: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.5)',
    marginTop: 1,
    textTransform: 'uppercase',
    letterSpacing: 1,
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
  balanceIconOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: 20,
    marginBottom: 16,
    gap: 10,
  },
  summaryCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.darkGray,
    marginTop: 4,
    textAlign: 'center',
  },
  summaryValueSecondary: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.mediumGray,
    textAlign: 'center',
  },
  dualSummaryRow: {
    alignItems: 'center',
    marginTop: 4,
    gap: 2,
  },
  summaryLabel: {
    fontSize: 11,
    color: colors.lightGray,
    fontWeight: '500',
    marginTop: 2,
  },
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginHorizontal: 20,
    marginBottom: 16,
    gap: 6,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.mediumGray,
    letterSpacing: 0.3,
  },
  filterChipTextActive: {
    color: '#FFFFFF',
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
    paddingVertical: 14,
  },
  transactionDetails: {
    flex: 1,
  },
  transactionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 2,
  },
  transactionTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginRight: 8,
  },
  transactionIcon: {
    marginRight: 4,
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
  transactionAmountSecondary: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.mediumGray,
  },
  transactionCurrencyLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 1,
  },
  transactionCurrencyLabelSecondary: {
    fontSize: 9,
    fontWeight: '700',
    color: '#b0b7c3',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 1,
  },
  transactionDate: {
    fontSize: 12,
    color: colors.lightGray,
    marginBottom: 4,
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
