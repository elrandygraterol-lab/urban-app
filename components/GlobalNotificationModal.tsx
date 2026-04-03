/**
 * Global Notification Modal
 * Displays in-app notifications across all screens
 */

import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNotificationStore, NotificationType } from '@/store/notificationStore';

const { width } = Dimensions.get('window');

const getNotificationConfig = (type: NotificationType) => {
  switch (type) {
    case 'ride_request':
      return {
        icon: 'car' as const,
        iconColor: '#22c55e',
        backgroundColor: '#F0FFF4',
        borderColor: '#22c55e',
      };
    case 'ride_accepted':
      return {
        icon: 'checkmark-circle' as const,
        iconColor: '#22c55e',
        backgroundColor: '#F0FFF4',
        borderColor: '#22c55e',
      };
    case 'ride_cancelled':
      return {
        icon: 'close-circle' as const,
        iconColor: '#FF3B30',
        backgroundColor: '#FFF5F5',
        borderColor: '#FF3B30',
      };
    case 'payment_completed':
      return {
        icon: 'cash' as const,
        iconColor: '#22c55e',
        backgroundColor: '#F0FFF4',
        borderColor: '#22c55e',
      };
    case 'driver_arrived':
      return {
        icon: 'location' as const,
        iconColor: '#FF9500',
        backgroundColor: '#FFF9F0',
        borderColor: '#FF9500',
      };
    case 'ride_started':
      return {
        icon: 'play-circle' as const,
        iconColor: '#007AFF',
        backgroundColor: '#F0F9FF',
        borderColor: '#007AFF',
      };
    case 'ride_completed':
      return {
        icon: 'flag' as const,
        iconColor: '#22c55e',
        backgroundColor: '#F0FFF4',
        borderColor: '#22c55e',
      };
    case 'success':
      return {
        icon: 'checkmark-circle' as const,
        iconColor: '#22c55e',
        backgroundColor: '#F0FFF4',
        borderColor: '#22c55e',
      };
    case 'warning':
      return {
        icon: 'warning' as const,
        iconColor: '#FF9500',
        backgroundColor: '#FFF9F0',
        borderColor: '#FF9500',
      };
    case 'error':
      return {
        icon: 'alert-circle' as const,
        iconColor: '#FF3B30',
        backgroundColor: '#FFF5F5',
        borderColor: '#FF3B30',
      };
    case 'info':
    default:
      return {
        icon: 'information-circle' as const,
        iconColor: '#007AFF',
        backgroundColor: '#F0F9FF',
        borderColor: '#007AFF',
      };
  }
};

const GlobalNotificationModal: React.FC = () => {
  const { currentNotification, dismissCurrentNotification, markAsRead } = useNotificationStore();
  const slideAnim = React.useRef(new Animated.Value(-200)).current;

  useEffect(() => {
    if (currentNotification) {
      // Slide in
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 50,
        friction: 8,
      }).start();
    } else {
      // Slide out
      Animated.timing(slideAnim, {
        toValue: -200,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [currentNotification]);

  if (!currentNotification) {
    return null;
  }

  const config = getNotificationConfig(currentNotification.type);

  const handleDismiss = () => {
    markAsRead(currentNotification.id);
    dismissCurrentNotification();
  };

  const handleAction = () => {
    if (currentNotification.onAction) {
      currentNotification.onAction();
    }
    handleDismiss();
  };

  return (
    <Modal
      visible={true}
      transparent={true}
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleDismiss}
    >
      <View style={styles.container}>
        <Animated.View
          style={[
            styles.notificationCard,
            {
              backgroundColor: config.backgroundColor,
              borderColor: config.borderColor,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* Icon */}
          <View style={[styles.iconContainer, { backgroundColor: config.iconColor }]}>
            <Ionicons name={config.icon} size={28} color="#fff" />
          </View>

          {/* Content */}
          <View style={styles.contentContainer}>
            <Text style={styles.title} numberOfLines={1}>
              {currentNotification.title}
            </Text>
            <Text style={styles.message} numberOfLines={2}>
              {currentNotification.message}
            </Text>

            {/* Action Button */}
            {currentNotification.actionLabel && currentNotification.onAction && (
              <TouchableOpacity style={styles.actionButton} onPress={handleAction}>
                <Text style={[styles.actionButtonText, { color: config.iconColor }]}>
                  {currentNotification.actionLabel}
                </Text>
                <Ionicons name="arrow-forward" size={16} color={config.iconColor} />
              </TouchableOpacity>
            )}
          </View>

          {/* Close Button */}
          <TouchableOpacity style={styles.closeButton} onPress={handleDismiss}>
            <Ionicons name="close" size={22} color="#8E8E93" />
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: Platform.OS === 'ios' ? 50 : 40,
    paddingHorizontal: 16,
    zIndex: 9999,
  },
  notificationCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
    maxWidth: width - 32,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  contentContainer: {
    flex: 1,
    marginRight: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  message: {
    fontSize: 14,
    color: '#505050',
    lineHeight: 20,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 6,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  closeButton: {
    padding: 4,
  },
});

export { GlobalNotificationModal };
export default GlobalNotificationModal;
