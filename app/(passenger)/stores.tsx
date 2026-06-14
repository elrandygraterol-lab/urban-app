import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing } from '@/constants/theme';
import { useSmartTutorial } from '@/hooks/useSmartTutorial';
import { setActiveTutorialScreen } from '@/utils/tutorialState';

export default function StoresPlaceholderScreen() {
  const insets = useSafeAreaInsets();
  const { isActive: needsTutorial } = useSmartTutorial('passenger_stores');

  useEffect(() => {
    if (needsTutorial) {
      setActiveTutorialScreen('passenger_stores');
    }
  }, [needsTutorial]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Tiendas</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.iconWrapper}>
          <View style={styles.iconCircle}>
            <Ionicons name="storefront-outline" size={44} color="#16a34a" />
          </View>
          <View style={styles.badgeCircle}>
            <Ionicons name="time-outline" size={22} color="#fff" />
          </View>
        </View>

        <View style={styles.comingSoonCard}>
          <View style={styles.comingSoonBadge}>
            <Text style={styles.comingSoonBadgeText}>PRÓXIMAMENTE</Text>
          </View>

          <Text style={styles.title}>Tiendas en UrbanTaxi</Text>
          <Text style={styles.subtitle}>
            Estamos trabajando para que puedas solicitar productos de tiendas locales
            directamente desde la aplicación.
          </Text>

          <View style={styles.featureList}>
            <View style={styles.featureItem}>
              <Ionicons name="checkmark-circle" size={16} color="#16a34a" />
              <Text style={styles.featureText}>Compra en tiendas cercanas</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="checkmark-circle" size={16} color="#16a34a" />
              <Text style={styles.featureText}>Entrega a domicilio</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="checkmark-circle" size={16} color="#16a34a" />
              <Text style={styles.featureText}>Pago desde la app</Text>
            </View>
          </View>
        </View>

        <Text style={styles.footerText}>Disponible próximamente</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0f172a',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  iconWrapper: {
    position: 'relative',
    marginBottom: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#f0fdf4',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#bbf7d0',
  },
  badgeCircle: {
    position: 'absolute',
    bottom: 0,
    right: -4,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#16a34a',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#f8fafc',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  comingSoonCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  comingSoonBadge: {
    backgroundColor: '#fef9c3',
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#fde68a',
    marginBottom: 16,
  },
  comingSoonBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#a16207',
    letterSpacing: 1.5,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  featureList: {
    width: '100%',
    gap: 10,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f8fafc',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  featureText: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '500',
  },
  footerText: {
    marginTop: 20,
    fontSize: 13,
    color: '#94a3b8',
    fontWeight: '500',
    letterSpacing: 0.5,
  },
});
