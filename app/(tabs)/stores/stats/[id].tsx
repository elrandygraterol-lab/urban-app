import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { getStats } from '@/services/storeApi';
import { getStoreById } from '@/services/storeApi';
import { Colors, Typography, BorderRadius, Spacing, Shadows } from '@/constants/theme';
import type { StoreStatistics, Store } from '@/types/store';
import { LineChart } from '@/components/stores/LineChart';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type Period = '7d' | '30d';

/**
 * Store Statistics Screen
 * 
 * Displays analytics for store owners
 * Requirements: 14.1, 14.2, 14.6, 14.7, 14.8, 14.9
 */
export default function StoreStatsScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuthStore();

  const [store, setStore] = useState<Store | null>(null);
  const [stats, setStats] = useState<StoreStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>('7d');

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id, period]);

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch store details to verify ownership
      const storeResponse = await getStoreById(Number(id));
      const storeData = storeResponse.data;
      setStore(storeData);

      // Verify user has "owner" role and owns the store
      // Requirements: 14.9
      if (!user || user.role !== 'owner') {
        setError('Solo los propietarios pueden ver estadísticas');
        setLoading(false);
        return;
      }

      if (String(storeData.owner_id) !== user.id) {
        setError('No tienes permiso para ver las estadísticas de esta tienda');
        setLoading(false);
        return;
      }

      // Fetch statistics
      const statsResponse = await getStats(Number(id), { period });
      setStats(statsResponse.data);
    } catch (err: any) {
      console.error('[StoreStats] Error loading data:', err);
      
      if (err.response?.status === 403) {
        setError('No tienes permiso para ver las estadísticas de esta tienda');
      } else {
        setError(err.response?.data?.error?.message || 'Error al cargar estadísticas');
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePeriodChange = (newPeriod: Period) => {
    setPeriod(newPeriod);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Cargando estadísticas...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={64} color={Colors.error} />
        <Text style={styles.errorTitle}>Error</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Volver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!stats) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="stats-chart-outline" size={64} color={Colors.lightGray} />
        <Text style={styles.errorTitle}>Sin datos</Text>
        <Text style={styles.errorText}>No hay estadísticas disponibles</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Estadísticas</Text>
        {store && <Text style={styles.storeName}>{store.name}</Text>}
      </View>

      {/* Period Selector */}
      {/* Requirements: 14.6 */}
      <View style={styles.periodSelector}>
        <TouchableOpacity
          style={[styles.periodButton, period === '7d' && styles.periodButtonActive]}
          onPress={() => handlePeriodChange('7d')}
        >
          <Text style={[styles.periodButtonText, period === '7d' && styles.periodButtonTextActive]}>
            7 días
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.periodButton, period === '30d' && styles.periodButtonActive]}
          onPress={() => handlePeriodChange('30d')}
        >
          <Text
            style={[styles.periodButtonText, period === '30d' && styles.periodButtonTextActive]}
          >
            30 días
          </Text>
        </TouchableOpacity>
      </View>

      {/* Metric Cards */}
      {/* Requirements: 14.1, 14.2 */}
      <View style={styles.metricsGrid}>
        <View style={styles.metricCard}>
          <View style={[styles.metricIconContainer, { backgroundColor: '#E3F2FD' }]}>
            <Ionicons name="eye-outline" size={24} color="#2196F3" />
          </View>
          <Text style={styles.metricValue}>{stats.total_views}</Text>
          <Text style={styles.metricLabel}>Vistas totales</Text>
        </View>

        <View style={styles.metricCard}>
          <View style={[styles.metricIconContainer, { backgroundColor: '#E8F5E9' }]}>
            <Ionicons name="call-outline" size={24} color="#4CAF50" />
          </View>
          <Text style={styles.metricValue}>{stats.total_calls}</Text>
          <Text style={styles.metricLabel}>Llamadas</Text>
        </View>

        <View style={styles.metricCard}>
          <View style={[styles.metricIconContainer, { backgroundColor: '#FFF3E0' }]}>
            <Ionicons name="navigate-outline" size={24} color="#FF9800" />
          </View>
          <Text style={styles.metricValue}>{stats.total_directions}</Text>
          <Text style={styles.metricLabel}>Direcciones</Text>
        </View>

        <View style={styles.metricCard}>
          <View style={[styles.metricIconContainer, { backgroundColor: '#F3E5F5' }]}>
            <Ionicons name="calendar-outline" size={24} color="#9C27B0" />
          </View>
          <Text style={styles.metricValue}>{stats.days_since_registration}</Text>
          <Text style={styles.metricLabel}>Días registrado</Text>
        </View>
      </View>

      {/* Line Chart */}
      {/* Requirements: 14.7 */}
      {stats.daily_views && stats.daily_views.length > 0 ? (
        <View style={styles.chartSection}>
          <Text style={styles.chartTitle}>Vistas diarias</Text>
          <LineChart data={stats.daily_views} width={SCREEN_WIDTH - 48} height={220} />
        </View>
      ) : (
        <View style={styles.emptyStateContainer}>
          <Ionicons name="bar-chart-outline" size={48} color={Colors.lightGray} />
          <Text style={styles.emptyStateText}>Sin datos disponibles</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingBottom: Spacing.xl,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  loadingText: {
    ...Typography.body,
    color: Colors.mediumGray,
  },
  errorContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  errorTitle: {
    ...Typography.h3,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  errorText: {
    ...Typography.body,
    color: Colors.mediumGray,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  backButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
  },
  backButtonText: {
    ...Typography.button,
    color: Colors.white,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  title: {
    ...Typography.h2,
    marginBottom: 4,
  },
  storeName: {
    ...Typography.body,
    color: Colors.mediumGray,
  },
  periodSelector: {
    flexDirection: 'row',
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.full,
    padding: 4,
    ...Shadows.sm,
  },
  periodButton: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    borderRadius: BorderRadius.full,
  },
  periodButtonActive: {
    backgroundColor: Colors.primary,
  },
  periodButtonText: {
    ...Typography.bodySmall,
    fontWeight: '600',
    color: Colors.mediumGray,
  },
  periodButtonTextActive: {
    color: Colors.white,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  metricCard: {
    flex: 1,
    minWidth: (SCREEN_WIDTH - 48 - 16) / 2,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    alignItems: 'center',
    ...Shadows.sm,
  },
  metricIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  metricValue: {
    ...Typography.h2,
    fontSize: 28,
    marginBottom: 4,
  },
  metricLabel: {
    ...Typography.bodySmall,
    color: Colors.mediumGray,
    textAlign: 'center',
  },
  chartSection: {
    marginTop: Spacing.lg,
    marginHorizontal: Spacing.lg,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    ...Shadows.sm,
  },
  chartTitle: {
    ...Typography.h3,
    marginBottom: Spacing.lg,
  },
  emptyStateContainer: {
    marginTop: Spacing.lg,
    marginHorizontal: Spacing.lg,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    padding: Spacing.xl,
    alignItems: 'center',
    ...Shadows.sm,
  },
  emptyStateText: {
    ...Typography.body,
    color: Colors.mediumGray,
    marginTop: Spacing.md,
  },
});
