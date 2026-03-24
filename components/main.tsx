import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Platform, ScrollView, StyleSheet, TouchableOpacity, View, FlatList } from 'react-native';//FlatList para trabajar con listas largas que se renderizan obviamente se puede trabajar con ScrollView pero no es optimo.
import { useSafeAreaInsets } from 'react-native-safe-area-context';//componente para manejar las areas seguras de dispositivos(iconos de hora bateria y parte inferior)

import { ThemedText } from '@/components/themed-text';

export default function Main() {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState('home');

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar style="dark" />

      {/* Header con diseño minimalista */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <ThemedText style={styles.greeting}>¡Buenos días!</ThemedText>
            <ThemedText style={styles.userName}>Alexandra</ThemedText>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.notificationBtn}>
              <ThemedText style={styles.notificationIcon}>🔔</ThemedText>
              <View style={styles.notificationBadge} />
            </TouchableOpacity>
            <View style={styles.avatar}>
              <ThemedText style={styles.avatarText}>A</ThemedText>
            </View>
          </View>
        </View>

        {/* Barra de búsqueda principal */}
        <TouchableOpacity style={styles.searchBar}>
          <LinearGradient
            colors={['#0A3143', '#1C4B63']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.searchGradient}
          >
            <ThemedText style={styles.searchIcon}>🔍</ThemedText>
            <ThemedText style={styles.searchText}>¿A dónde vamos hoy?</ThemedText>
            <View style={styles.searchBadge}>
              <ThemedText style={styles.searchBadgeText}>Buscar</ThemedText>
            </View>
          </LinearGradient>
        </TouchableOpacity>

        {/* Tasa de cambio */}
        <TouchableOpacity style={styles.exchangeRate}>
          <ThemedText style={styles.exchangeRateText}>
            Tasa de cambio <ThemedText style={styles.exchangeRateValue}>Bs. 440,97</ThemedText>
          </ThemedText>
          <ThemedText style={styles.exchangeRateIcon}>›</ThemedText>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false} bounces={false}>
        {/* Sección "¿Qué necesitas hoy?" */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>¿Qué necesitas hoy?</ThemedText>

          <View style={styles.servicesGrid}>
            {/* Travel Card */}
            <TouchableOpacity style={styles.serviceCard}>
              <View style={[styles.serviceIconContainer, { backgroundColor: '#F2A71B20' }]}>
                <ThemedText style={styles.serviceIcon}>🚕</ThemedText>
              </View>
              <View style={styles.serviceInfo}>
                <View style={styles.serviceTitleRow}>
                  <ThemedText style={styles.serviceTitle}>Viajes</ThemedText>
                  <View style={styles.newBadge}>
                    <ThemedText style={styles.newBadgeText}>NUEVO</ThemedText>
                  </View>
                </View>
                <ThemedText style={styles.serviceDescription}>Viaja rápido y seguro</ThemedText>
              </View>
            </TouchableOpacity>

            {/* Deliveries Card */}
            <TouchableOpacity style={styles.serviceCard}>
              <View style={[styles.serviceIconContainer, { backgroundColor: '#0A314320' }]}>
                <ThemedText style={styles.serviceIcon}>📦</ThemedText>
              </View>
              <View style={styles.serviceInfo}>
                <ThemedText style={styles.serviceTitle}>Entregas</ThemedText>
                <ThemedText style={styles.serviceDescription}>Envía lo que quieras</ThemedText>
              </View>
            </TouchableOpacity>

            {/* Food Card */}
            <TouchableOpacity style={styles.serviceCard}>
              <View style={[styles.serviceIconContainer, { backgroundColor: '#F2A71B20' }]}>
                <ThemedText style={styles.serviceIcon}>🍔</ThemedText>
              </View>
              <View style={styles.serviceInfo}>
                <View style={styles.serviceTitleRow}>
                  <ThemedText style={styles.serviceTitle}>Comida</ThemedText>
                  <View style={styles.newBadge}>
                    <ThemedText style={styles.newBadgeText}>NUEVO</ThemedText>
                  </View>
                </View>
                <ThemedText style={styles.serviceDescription}>Pide fácil y rápido</ThemedText>
              </View>
            </TouchableOpacity>

            {/* Marketplace Card */}
            <TouchableOpacity style={styles.serviceCard}>
              <View style={[styles.serviceIconContainer, { backgroundColor: '#0A314320' }]}>
                <ThemedText style={styles.serviceIcon}>🛍️</ThemedText>
              </View>
              <View style={styles.serviceInfo}>
                <ThemedText style={styles.serviceTitle}>Marketplace</ThemedText>
                <ThemedText style={styles.serviceDescription}>Compra y vende todo</ThemedText>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Banner Promocional - Pickup */}
        <LinearGradient
          colors={['#0A3143', '#1C4B63']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.promoBanner}
        >
          <View style={styles.promoContent}>
            <View style={styles.promoLeft}>
              <View style={styles.promoTag}>
                <ThemedText style={styles.promoTagText}>🛒 Pickup</ThemedText>
              </View>
              <ThemedText style={styles.promoTitle}>¡Gana 2x Más!</ThemedText>
              <TouchableOpacity style={styles.promoButton}>
                <ThemedText style={styles.promoButtonText}>EXPLORAR MAPA</ThemedText>
                <ThemedText style={styles.promoButtonIcon}>→</ThemedText>
              </TouchableOpacity>
            </View>
            <View style={styles.promoRight}>
              <View style={styles.promoBenefits}>
                <View style={styles.benefitItem}>
                  <ThemedText style={styles.benefitValue}>10% OFF</ThemedText>
                </View>
                <View style={styles.benefitItem}>
                  <ThemedText style={styles.benefitIcon}>🟢</ThemedText>
                  <ThemedText style={styles.benefitText}>2x Puntos</ThemedText>
                </View>
                <View style={styles.benefitItem}>
                  <ThemedText style={styles.benefitIcon}>💰</ThemedText>
                  <ThemedText style={styles.benefitText}>$0 envío</ThemedText>
                </View>
              </View>
            </View>
          </View>
        </LinearGradient>

        {/* Sección Yummy */}
        <View style={styles.yummySection}>
          <View style={styles.yummyHeader}>
            <ThemedText style={styles.yummyTitle}>Obtén más de Yummy</ThemedText>
            <TouchableOpacity>
              <ThemedText style={styles.yummySeeAll}>Ver todo</ThemedText>
            </TouchableOpacity>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.yummyScroll}>
            {/* TuDoc Card */}
            <TouchableOpacity style={styles.yummyCard}>
              <LinearGradient colors={['#F2A71B', '#FFB800']} style={styles.yummyCardGradient}>
                <View style={styles.yummyCardContent}>
                  <View style={styles.yummyCardHeader}>
                    <ThemedText style={styles.yummyCardEmoji}>🩺</ThemedText>
                    <View style={styles.newBadgeSmall}>
                      <ThemedText style={styles.newBadgeSmallText}>NUEVO</ThemedText>
                    </View>
                  </View>
                  <ThemedText style={styles.yummyCardTitle}>TuDoc</ThemedText>
                  <ThemedText style={styles.yummyCardDescription}>
                    Atención médica virtual
                  </ThemedText>
                </View>
              </LinearGradient>
            </TouchableOpacity>

            {/* Specialists Card */}
            <TouchableOpacity style={styles.yummyCard}>
              <LinearGradient colors={['#0A3143', '#1C4B63']} style={styles.yummyCardGradient}>
                <View style={styles.yummyCardContent}>
                  <View style={styles.yummyCardHeader}>
                    <ThemedText style={styles.yummyCardEmoji}>👨‍⚕️</ThemedText>
                  </View>
                  <ThemedText style={styles.yummyCardTitle}>Yummy Specialists</ThemedText>
                  <ThemedText style={styles.yummyCardDescription}>Especialistas médicos</ThemedText>
                </View>
              </LinearGradient>
            </TouchableOpacity>

            {/* Virtual Care Card */}
            <TouchableOpacity style={styles.yummyCard}>
              <View style={[styles.yummyCardGradient, { backgroundColor: '#2E6B84' }]}>
                <View style={styles.yummyCardContent}>
                  <View style={styles.yummyCardHeader}>
                    <ThemedText style={styles.yummyCardEmoji}>💊</ThemedText>
                  </View>
                  <ThemedText style={styles.yummyCardTitle}>Cuidado virtual</ThemedText>
                  <ThemedText style={styles.yummyCardDescription}>24/7 a tu alcance</ThemedText>
                </View>
              </View>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* Lo último */}
        <View style={styles.latestSection}>
          <ThemedText style={styles.latestTitle}>Lo último ✨✨✨</ThemedText>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.latestScroll}>
            {[1, 2, 3].map(item => (
              <TouchableOpacity key={item} style={styles.latestCard}>
                <View style={styles.latestCardImage}>
                  <ThemedText style={styles.latestCardEmoji}>🍕</ThemedText>
                </View>
                <View style={styles.latestCardInfo}>
                  <ThemedText style={styles.latestCardTitle}>Oferta especial</ThemedText>
                  <ThemedText style={styles.latestCardDesc}>50% de descuento</ThemedText>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Espacio para el footer */}
        <View style={styles.footerSpacer} />
      </ScrollView>

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={[styles.navItem, activeTab === 'home' && styles.navItemActive]}
          onPress={() => setActiveTab('home')}
        >
          <ThemedText style={[styles.navIcon, activeTab === 'home' && styles.navIconActive]}>
            🏠
          </ThemedText>
          <ThemedText style={[styles.navText, activeTab === 'home' && styles.navTextActive]}>
            Inicio
          </ThemedText>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navItem, activeTab === 'history' && styles.navItemActive]}
          onPress={() => setActiveTab('history')}
        >
          <ThemedText style={[styles.navIcon, activeTab === 'history' && styles.navIconActive]}>
            📋
          </ThemedText>
          <ThemedText style={[styles.navText, activeTab === 'history' && styles.navTextActive]}>
            Historial
          </ThemedText>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navItem, activeTab === 'scheduled' && styles.navItemActive]}
          onPress={() => setActiveTab('scheduled')}
        >
          <ThemedText style={[styles.navIcon, activeTab === 'scheduled' && styles.navIconActive]}>
            📅
          </ThemedText>
          <ThemedText style={[styles.navText, activeTab === 'scheduled' && styles.navTextActive]}>
            Agendados
          </ThemedText>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navItem, activeTab === 'more' && styles.navItemActive]}
          onPress={() => setActiveTab('more')}
        >
          <ThemedText style={[styles.navIcon, activeTab === 'more' && styles.navIconActive]}>
            ⋯
          </ThemedText>
          <ThemedText style={[styles.navText, activeTab === 'more' && styles.navTextActive]}>
            Más
          </ThemedText>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: 20,
    paddingBottom: 10,
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  greeting: {
    fontSize: 14,
    color: '#666',
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0A3143',
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
  },
  notificationBtn: {
    position: 'relative',
    padding: 5,
  },
  notificationIcon: {
    fontSize: 22,
  },
  notificationBadge: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F2A71B',
  },
  avatar: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    backgroundColor: '#0A3143',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  searchBar: {
    marginBottom: 15,
    borderRadius: 15,
    overflow: 'hidden',
  },
  searchGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    gap: 10,
  },
  searchIcon: {
    fontSize: 18,
    color: '#FFFFFF',
  },
  searchText: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
    opacity: 0.9,
  },
  searchBadge: {
    backgroundColor: '#F2A71B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  searchBadgeText: {
    color: '#0A3143',
    fontSize: 12,
    fontWeight: '600',
  },
  exchangeRate: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  exchangeRateText: {
    fontSize: 14,
    color: '#666',
  },
  exchangeRateValue: {
    color: '#F2A71B',
    fontWeight: '600',
  },
  exchangeRateIcon: {
    fontSize: 18,
    color: '#999',
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0A3143',
    marginBottom: 15,
  },
  servicesGrid: {
    gap: 10,
  },
  serviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 15,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    marginBottom: 5,
  },
  serviceIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  serviceIcon: {
    fontSize: 24,
  },
  serviceInfo: {
    flex: 1,
  },
  serviceTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  serviceTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0A3143',
  },
  newBadge: {
    backgroundColor: '#F2A71B',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  newBadgeText: {
    color: '#0A3143',
    fontSize: 10,
    fontWeight: 'bold',
  },
  serviceDescription: {
    fontSize: 13,
    color: '#999',
    marginTop: 2,
  },
  promoBanner: {
    marginHorizontal: 20,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 20,
  },
  promoContent: {
    padding: 20,
    flexDirection: 'row',
  },
  promoLeft: {
    flex: 1,
  },
  promoTag: {
    backgroundColor: '#F2A71B',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 10,
  },
  promoTagText: {
    color: '#0A3143',
    fontSize: 12,
    fontWeight: '600',
  },
  promoTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 15,
  },
  promoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  promoButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  promoButtonIcon: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  promoRight: {
    flex: 1,
    justifyContent: 'center',
  },
  promoBenefits: {
    gap: 10,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    alignSelf: 'flex-end',
    gap: 5,
  },
  benefitValue: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  benefitIcon: {
    fontSize: 14,
  },
  benefitText: {
    color: '#FFFFFF',
    fontSize: 12,
  },
  yummySection: {
    marginBottom: 20,
  },
  yummyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  yummyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0A3143',
  },
  yummySeeAll: {
    fontSize: 14,
    color: '#F2A71B',
    fontWeight: '500',
  },
  yummyScroll: {
    paddingLeft: 20,
  },
  yummyCard: {
    width: 160,
    height: 180,
    marginRight: 15,
    borderRadius: 20,
    overflow: 'hidden',
  },
  yummyCardGradient: {
    flex: 1,
  },
  yummyCardContent: {
    flex: 1,
    padding: 15,
    justifyContent: 'space-between',
  },
  yummyCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  yummyCardEmoji: {
    fontSize: 30,
  },
  newBadgeSmall: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  newBadgeSmallText: {
    color: '#0A3143',
    fontSize: 8,
    fontWeight: 'bold',
  },
  yummyCardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  yummyCardDescription: {
    fontSize: 11,
    color: '#FFFFFF',
    opacity: 0.9,
  },
  latestSection: {
    marginBottom: 20,
  },
  latestTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0A3143',
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  latestScroll: {
    paddingLeft: 20,
  },
  latestCard: {
    width: 140,
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    marginRight: 15,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    overflow: 'hidden',
  },
  latestCardImage: {
    height: 100,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  latestCardEmoji: {
    fontSize: 40,
  },
  latestCardInfo: {
    padding: 12,
  },
  latestCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0A3143',
    marginBottom: 2,
  },
  latestCardDesc: {
    fontSize: 12,
    color: '#999',
  },
  footerSpacer: {
    height: 80,
  },
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 30 : 10,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 8,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    opacity: 0.5,
  },
  navItemActive: {
    opacity: 1,
  },
  navIcon: {
    fontSize: 22,
    marginBottom: 4,
  },
  navIconActive: {
    color: '#F2A71B',
  },
  navText: {
    fontSize: 11,
    color: '#666',
  },
  navTextActive: {
    color: '#F2A71B',
    fontWeight: '500',
  },
});
