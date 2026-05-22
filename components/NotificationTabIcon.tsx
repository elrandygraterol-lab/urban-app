/**
 * Notification Tab Icon with Badge
 * Displays notification icon with unread count badge
 */

import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { notificationAPI } from '@/services/api';
import { useNotificationStore } from '@/store/notificationStore';
import { Colors } from '@/constants/theme';

interface NotificationTabIconProps {
  color: string;
  focused: boolean;
}

export function NotificationTabIcon({ color, focused }: NotificationTabIconProps) {
  const { unreadCount, setUnreadCount } = useNotificationStore();

  useEffect(() => {
    fetchUnreadCount();

    // Poll for updates every 30 seconds
    const interval = setInterval(fetchUnreadCount, 30000);

    return () => clearInterval(interval);
  }, []);

  const fetchUnreadCount = async () => {
    try {
      const response = await notificationAPI.getNotifications({ page: 1, limit: 50 });
      const notifications = response.data.notifications;
      const count = notifications.filter((n: any) => !n.readStatus).length;
      setUnreadCount(count);
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  };

  return (
    <View style={styles.container}>
      <IconSymbol size={28} name="bell.fill" color={color} />
      {unreadCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 28,
    height: 28,
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: Colors.error,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#fff',
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
});
