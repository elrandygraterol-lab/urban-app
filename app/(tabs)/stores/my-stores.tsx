import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { useStoreStore } from '@/store/storeStore';
import { StoreCard } from '@/components/stores/StoreCard';
import { Colors, Typography, BorderRadius, Spacing, Shadows } from '@/constants/theme';
import type { Store } from '@/types/store';
import { useUnifiedNotifications } from '@/context/UnifiedNotificationContext';

type TabType = 'my-stores' | 'explore';

export default function MyStoresScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { showToast, showStatus } = useUnifiedNotifications();
  const { myStores, loading, error, fetchMyStores } = useStoreStore();

  // Local state
  const [activeTab, setActiveTab] = useState<TabType>('my-stores');
  const [refreshing, setRefreshing] = useState(false);

  // Verify user role on mount
  useEffect(() => {
    // Check if user has owner role
    // Note: The backend User model has a role field that should be 'owner' for store owners
    // For now, we'll check if the user can fetch their stores
    // The backend will return 403 if user doesn't have owner role

    if (user) {
      fetchMyStores();
    }
  }, [user, fetchMyStores]);

  // Handle pull to refresh
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchMyStores(true);
    } finally {
      setRefreshing(false);
    }
  }, [fetchMyStores]);

  // Handle store card press
  const handleStorePress = useCallback(
    (store: Store) => {
      router.push(`/(tabs)/stores/${store.store_id}` as any);
    },
    [router]
  );

  // Handle add new store
  const handleAddStore = () => {
    router.push('/(tabs)/stores/form' as any);
  };

  // Handle edit store
  const handleEditStore = useCallback(
    (store: Store) => {
      router.push({
        pathname: '/(tabs)/stores/form' as any,
        params: { storeId: store.store_id.toString() },
      });
    },
    [router]
  );

  // Handle toggle store active status
  const handleToggleActive = useCallback(
    async (store: Store) => {
      // This will be implemented in task 22
      showStatus(
        'info',
        `¿Deseas ${store.status === 'activa' ? 'desactivar' : 'activar'} esta tienda?`,
        'Cambiar estado',
        undefined,
        {
          label: 'Confirmar',
          onPress: () => {
            showToast('Esta función se implementará próximamente', 'info');
          },
        }
      );
    },
    [showStatus, showToast]
  );

  // Handle view stats
  const handleViewStats = useCallback(
    (store: Store) => {
      router.push(`/(tabs)/stores/stats/${store.store_id}` as any);
    },
    [router]
  );

  // Render quick actions for each store
  const renderQuickActions = useCallback(
    (store: Store) => {
      const canToggle = store.status === 'activa' || store.status === 'inactiva';

      return (
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleEditStore(store)}
            activeOpacity={0.7}
          >
            <Ionicons name="create-outline" size={20} color={Colors.primary} />
            <Text style={styles.actionButtonText}>Editar</Text>
          </TouchableOpacity>

          {canToggle && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleToggleActive(store)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={store.status === 'activa' ? 'pause-outline' : 'play-outline'}
                size={20}
                color={Colors.primary}
              />
              <Text style={styles.actionButtonText}>
                {store.status === 'activa' ? 'Desactivar' : 'Activar'}
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleViewStats(store)}
            activeOpacity={0.7}
          >
            <Ionicons name="stats-chart-outline" size={20} color={Colors.primary} />
            <Text style={styles.actionButtonText}>Estadísticas</Text>
          </TouchableOpacity>
        </View>
      );
    },
    [handleEditStore, handleToggleActive, handleViewStats]
  );

  // Render store item with quick actions
  const renderStoreItem = useCallback(
    ({ item }: { item: Store }) => (
      <View style={styles.storeItemContainer}>
        <StoreCard store={item} onPress={() => handleStorePress(item)} showDistance={false} />
        {renderQuickActions(item)}
      </View>
    ),
    [handleStorePress, renderQuickActions]
  );

  // Get item layout for FlatList optimization
  const getItemLayout = useCallback(
    (data: any, index: number) => ({
      length: 180, // Approximate height of store item + quick actions
      offset: 180 * index,
      index,
    }),
    []
  );

  // Key extractor for FlatList optimization
  const keyExtractor = useCallback((item: Store) => item.store_id.toString(), []);

  // Render empty state
  const renderEmptyState = () => {
    if (loading) {
      return null;
    }

    return (
      <View style={styles.emptyState}>
        <Ionicons name="storefront-outline" size={80} color={Colors.lightGray} />
        <Text style={styles.emptyStateTitle}>No tienes tiendas registradas</Text>
        <Text style={styles.emptyStateSubtitle}>
          Agrega tu primera tienda para comenzar a promocionar tu negocio
        </Text>
        <TouchableOpacity
          style={styles.addFirstStoreButton}
          onPress={handleAddStore}
          activeOpacity={0.7}
        >
          <Ionicons name="add-circle-outline" size={24} color={Colors.white} />
          <Text style={styles.addFirstStoreButtonText}>Agregar mi primera tienda</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // Render tabs
  const renderTabs = () => (
    <View style={styles.tabsContainer}>
      <TouchableOpacity
        style={[styles.tab, activeTab === 'my-stores' && styles.tabActive]}
        onPress={() => setActiveTab('my-stores')}
        activeOpacity={0.7}
      >
        <Text style={[styles.tabText, activeTab === 'my-stores' && styles.tabTextActive]}>
          Mis Tiendas
        </Text>
        {activeTab === 'my-stores' && <View style={styles.tabIndicator} />}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.tab, activeTab === 'explore' && styles.tabActive]}
        onPress={() => {
          setActiveTab('explore');
          // Navigate to explore stores screen
          router.push('/(passenger)/stores' as any);
        }}
        activeOpacity={0.7}
      >
        <Text style={[styles.tabText, activeTab === 'explore' && styles.tabTextActive]}>
          Explorar
        </Text>
        {activeTab === 'explore' && <View style={styles.tabIndicator} />}
      </TouchableOpacity>
    </View>
  );

  // Check if user is not an owner (403 error)
  if (error && error.includes('owner')) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Mis Tiendas</Text>
        </View>
        <View style={styles.errorStateContainer}>
          <Ionicons name="lock-closed-outline" size={80} color={Colors.lightGray} />
          <Text style={styles.errorStateTitle}>Acceso restringido</Text>
          <Text style={styles.errorStateSubtitle}>
            Solo los usuarios con rol de propietario pueden acceder a esta sección
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mis Tiendas</Text>
        <Text style={styles.headerSubtitle}>Administra tus negocios</Text>
      </View>

      {/* Tabs */}
      {renderTabs()}

      {/* Store List */}
      <FlatList
        data={myStores}
        keyExtractor={keyExtractor}
        renderItem={renderStoreItem}
        getItemLayout={getItemLayout}
        contentContainerStyle={[
          styles.listContent,
          myStores.length === 0 && styles.listContentEmpty,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
        ListEmptyComponent={renderEmptyState}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={50}
        initialNumToRender={10}
        windowSize={10}
      />

      {/* Loading Overlay */}
      {loading && myStores.length === 0 && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Cargando tus tiendas...</Text>
        </View>
      )}

      {/* Floating Action Button (FAB) */}
      {myStores.length > 0 && (
        <TouchableOpacity style={styles.fab} onPress={handleAddStore} activeOpacity={0.8}>
          <Ionicons name="add" size={28} color={Colors.white} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    ...Typography.h1,
    fontSize: 28,
    marginBottom: 4,
  },
  headerSubtitle: {
    ...Typography.bodySmall,
    color: Colors.mediumGray,
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  tabActive: {
    // Active tab styling handled by indicator
  },
  tabText: {
    ...Typography.body,
    color: Colors.mediumGray,
    fontWeight: '500',
  },
  tabTextActive: {
    color: Colors.primary,
    fontWeight: '600',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: Colors.primary,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xl + 60, // Extra padding for FAB
  },
  listContentEmpty: {
    flexGrow: 1,
  },
  storeItemContainer: {
    marginBottom: Spacing.md,
  },
  quickActions: {
    flexDirection: 'row',
    marginTop: Spacing.sm,
    gap: Spacing.sm,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.light,
    borderRadius: BorderRadius.sm,
    gap: 4,
  },
  actionButtonText: {
    ...Typography.caption,
    color: Colors.primary,
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  emptyStateTitle: {
    ...Typography.h3,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  emptyStateSubtitle: {
    ...Typography.body,
    color: Colors.mediumGray,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  addFirstStoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
    gap: Spacing.sm,
    ...Shadows.md,
  },
  addFirstStoreButtonText: {
    ...Typography.button,
    color: Colors.white,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  loadingText: {
    ...Typography.body,
    color: Colors.mediumGray,
  },
  errorStateContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  errorStateTitle: {
    ...Typography.h3,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  errorStateSubtitle: {
    ...Typography.body,
    color: Colors.mediumGray,
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    bottom: Spacing.xl,
    right: Spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.lg,
  },
});
