/**
 * Notifications Screen
 * Displays store-related and ride-related notifications
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { notificationAPI } from '@/services/api';
import { useNotificationStore } from '@/store/notificationStore';
import type { StoreNotification } from '@/types/notification';
import { Colors } from '@/constants/theme';

export default function NotificationsScreen() {
  const router = useRouter();
  const { setUnreadCount, decrementUnreadCount } = useNotificationStore();
  const [notifications, setNotifications] = useState<StoreNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const fetchNotifications = useCallback(
    async (pageNum: number = 1, append: boolean = false) => {
      try {
        if (pageNum === 1) {
          setLoading(true);
        }

        const response = await notificationAPI.getNotifications({ page: pageNum, limit: 20 });
        const { notifications: newNotifications, pagination } = response.data;

        if (append) {
          setNotifications(prev => [...prev, ...newNotifications]);
        } else {
          setNotifications(newNotifications);
        }

        setHasMore(pagination.page < pagination.totalPages);
        setPage(pageNum);

        // Update unread count in store
        const unreadCount = newNotifications.filter((n: StoreNotification) => !n.readStatus).length;
        setUnreadCount(unreadCount);
      } catch (error) {
        console.error('Error fetching notifications:', error);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [setUnreadCount]
  );

  useEffect(() => {
    fetchNotifications();
    // Requirement 6.3: mark all as read and reset badge when screen mounts
    notificationAPI.markAllRead().catch(() => {});
    Notifications.setBadgeCountAsync(0).catch(() => {});
  }, [fetchNotifications]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchNotifications(1, false);
  }, [fetchNotifications]);

  const handleLoadMore = useCallback(() => {
    if (!loading && hasMore) {
      fetchNotifications(page + 1, true);
    }
  }, [loading, hasMore, page, fetchNotifications]);

  const handleNotificationPress = async (notification: StoreNotification) => {
    try {
      // Mark as read
      if (!notification.readStatus) {
        await notificationAPI.markAsRead(notification.id);
        setNotifications(prev =>
          prev.map(n => (n.id === notification.id ? { ...n, readStatus: true } : n))
        );
        // Decrement unread count in store
        decrementUnreadCount();
      }

      // Navigate based on notification type
      const { type, data } = notification;

      switch (type) {
        case 'STORE_APPROVED':
        case 'STORE_REJECTED':
          if (data.storeId) {
            router.push(`/(tabs)/stores/${data.storeId}` as any);
          } else {
            router.push('/(tabs)/stores/my-stores' as any);
          }
          break;

        case 'NEW_REVIEW':
          if (data.storeId) {
            router.push(`/(tabs)/stores/${data.storeId}` as any);
          }
          break;

        case 'ride_accepted':
        case 'driver_arrived':
        case 'ride_started':
        case 'ride_completed':
          if (data.rideId) {
            router.push(`/(passenger)/ride/${data.rideId}` as any);
          }
          break;

        case 'payment_completed':
          router.push('/(driver)/earnings' as any);
          break;

        case 'ride_cancelled':
          router.push('/(driver)/index' as any);
          break;

        default:
          console.log('Unknown notification type:', type);
      }
    } catch (error) {
      console.error('Error handling notification press:', error);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'STORE_APPROVED':
        return { name: 'checkmark-circle' as const, color: Colors.success };
      case 'STORE_REJECTED':
        return { name: 'close-circle' as const, color: Colors.error };
      case 'NEW_REVIEW':
        return { name: 'star' as const, color: Colors.warning };
      case 'ride_accepted':
        return { name: 'car' as const, color: Colors.success };
      case 'payment_completed':
        return { name: 'cash' as const, color: Colors.success };
      case 'ride_cancelled':
        return { name: 'close-circle' as const, color: Colors.error };
      default:
        return { name: 'notifications' as const, color: Colors.primary };
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Ahora';
    if (diffMins < 60) return `Hace ${diffMins}m`;
    if (diffHours < 24) return `Hace ${diffHours}h`;
    if (diffDays < 7) return `Hace ${diffDays}d`;
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  };

  const renderNotification = ({ item }: { item: StoreNotification }) => {
    const icon = getNotificationIcon(item.type);

    return (
      <TouchableOpacity
        style={[styles.notificationItem, !item.readStatus && styles.unreadNotification]}
        onPress={() => handleNotificationPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.iconContainer}>
          <Ionicons name={icon.name} size={24} color={icon.color} />
        </View>

        <View style={styles.contentContainer}>
          <Text style={styles.title} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.message} numberOfLines={2}>
            {item.message}
          </Text>
          <Text style={styles.timestamp}>{formatTimestamp(item.createdAt)}</Text>
        </View>

        {!item.readStatus && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="notifications-off-outline" size={64} color={Colors.lightGray} />
      <Text style={styles.emptyText}>No hay notificaciones</Text>
      <Text style={styles.emptySubtext}>
        Aquí aparecerán las notificaciones sobre tus tiendas y viajes
      </Text>
    </View>
  );

  const renderFooter = () => {
    if (!loading || page === 1) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={Colors.primary} />
      </View>
    );
  };

  const unreadCount = notifications.filter(n => !n.readStatus).length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Notificaciones</Text>
        {unreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unreadCount}</Text>
          </View>
        )}
      </View>

      {loading && page === 1 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={notifications}
          renderItem={renderNotification}
          keyExtractor={item => item.id}
          contentContainerStyle={notifications.length === 0 ? styles.emptyList : styles.list}
          ListEmptyComponent={renderEmpty}
          ListFooterComponent={renderFooter}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={Colors.primary}
            />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
  },
  badge: {
    backgroundColor: Colors.error,
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    paddingVertical: 8,
  },
  emptyList: {
    flexGrow: 1,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 8,
    marginVertical: 4,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  unreadNotification: {
    backgroundColor: '#f0f8ff',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  contentContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  message: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  timestamp: {
    fontSize: 12,
    color: '#999',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
    marginLeft: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  footerLoader: {
    paddingVertical: 16,
    alignItems: 'center',
  },
});
