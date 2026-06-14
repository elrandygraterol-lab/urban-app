import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { ToastData } from '@/context/NotificationContext';

interface ToastNotificationProps {
  toast: ToastData;
  onDismiss: (id: string) => void;
}

const TYPE_COLORS: Record<ToastData['type'], string> = {
  success: '#22c55e',
  info: '#3b82f6',
  warning: '#f97316',
  error: '#ef4444',
};

export const ToastNotification: React.FC<ToastNotificationProps> = ({ toast, onDismiss }) => {
  const translateY = useRef(new Animated.Value(-100)).current;

  useEffect(() => {
    // Slide in from top
    Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: true,
      tension: 80,
      friction: 10,
    }).start();

    // Auto-dismiss
    const t = setTimeout(() => onDismiss(toast.id), toast.durationMs);
    return () => clearTimeout(t);
  }, [onDismiss, toast.durationMs, toast.id, translateY]);

  const backgroundColor = TYPE_COLORS[toast.type];

  return (
    <Animated.View style={[styles.container, { backgroundColor, transform: [{ translateY }] }]}>
      <Text style={styles.message} numberOfLines={3}>
        {toast.message}
      </Text>
      <TouchableOpacity
        onPress={() => onDismiss(toast.id)}
        style={styles.closeButton}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={styles.closeText}>✕</Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  message: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
  closeButton: {
    marginLeft: 12,
  },
  closeText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default ToastNotification;
