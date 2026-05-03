import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Platform,
  Switch,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useStoreStore } from '@/store/storeStore';
import { useAuthStore } from '@/store/authStore';
import { Colors, Typography, BorderRadius, Spacing, Shadows } from '@/constants/theme';
import { updateStoreStatus } from '@/services/storeApi';
import type { StoreStatus } from '@/types/store';

/**
 * Store Details Screen
 * 
 * This screen displays complete store information
 * Accessible from both owner's "Mis Tiendas" and general store discovery
 */
export default function StoreDetailsScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { selectedStore, loading, error, fetchStoreById } = useStoreStore();
  const { user } = useAuthStore();
  
  // Local state for toggle and delete
  const [isToggling, setIsToggling] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (id) {
      fetchStoreById(Number(id));
    }
  }, [id]);
  
  // Check if current user is the owner of this store
  const isOwner = user && selectedStore && user.id === String(selectedStore.owner_id);
  
  // Determine if toggle should be enabled
  const canToggle = isOwner && 
    (selectedStore?.status === 'activa' || selectedStore?.status === 'inactiva');
  
  // Get toggle value (true for active, false for inactive)
  const isActive = selectedStore?.status === 'activa';
  
  /**
   * Handle activation toggle
   * Requirements: 13.3, 13.4, 13.5, 13.8
   */
  const handleToggleActivation = async (value: boolean) => {
    if (!selectedStore || !canToggle || isToggling) return;
    
    setIsToggling(true);
    
    try {
      const newStatus: StoreStatus = value ? 'activa' : 'inactiva';
      
      // Call API to update status
      const response = await updateStoreStatus(selectedStore.store_id, newStatus);
      
      // Update local store data in Zustand store
      await fetchStoreById(selectedStore.store_id, true);
      
      // Show feedback message
      Alert.alert(
        'Éxito',
        value 
          ? 'Tu tienda ha sido activada y ahora es visible para otros usuarios'
          : 'Tu tienda ha sido desactivada y ya no es visible para otros usuarios'
      );
    } catch (error: any) {
      console.error('[StoreDetails] Error toggling activation:', error);
      
      // Show error message
      Alert.alert(
        'Error',
        error.response?.data?.error?.message || 'No se pudo cambiar el estado de la tienda'
      );
    } finally {
      setIsToggling(false);
    }
  };

  /**
   * Handle store deletion
   * Requirements: 17.1, 17.2, 17.3, 17.4, 17.9
   */
  const handleDeleteStore = () => {
    if (!selectedStore || !isOwner || isDeleting) return;
    
    // Show confirmation dialog with warning
    // Requirements: 17.2, 17.3
    Alert.alert(
      'Eliminar tienda',
      '¿Estás seguro de que deseas eliminar esta tienda? Esta acción es permanente y no se puede deshacer.',
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);
            
            try {
              // Call DELETE /api/stores/:id
              // Requirements: 17.9
              await useStoreStore.getState().deleteStore(selectedStore.store_id);
              
              // Show success message
              Alert.alert(
                'Éxito',
                'Tu tienda ha sido eliminada correctamente',
                [
                  {
                    text: 'OK',
                    onPress: () => {
                      // Navigate back to my stores
                      router.replace('/(tabs)/stores/my-stores');
                    },
                  },
                ]
              );
            } catch (error: any) {
              console.error('[StoreDetails] Error deleting store:', error);
              
              // Show error message
              Alert.alert(
                'Error',
                error.response?.data?.error?.message || 'No se pudo eliminar la tienda'
              );
              
              setIsDeleting(false);
            }
          },
        },
      ]
    );
  };

  if (loading && !selectedStore) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Cargando detalles...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={64} color={Colors.error} />
        <Text style={styles.errorTitle}>Error al cargar</Text>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!selectedStore) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="storefront-outline" size={64} color={Colors.lightGray} />
        <Text style={styles.errorTitle}>Tienda no encontrada</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.storeName}>{selectedStore.name}</Text>
        <Text style={styles.category}>{selectedStore.category?.name}</Text>
      </View>

      {/* Activation Toggle Section (Owner Only) */}
      {/* Requirements: 13.1, 13.2, 13.6, 13.7, 13.8 */}
      {isOwner && (
        <View style={styles.section}>
          <View style={styles.toggleHeader}>
            <View style={styles.toggleInfo}>
              <Text style={styles.sectionTitle}>Activación de tienda</Text>
              <Text style={styles.toggleDescription}>
                {canToggle 
                  ? 'Activa o desactiva tu tienda para controlar su visibilidad'
                  : 'El estado de tu tienda no permite cambiar la activación'}
              </Text>
            </View>
            <Switch
              value={isActive}
              onValueChange={handleToggleActivation}
              disabled={!canToggle || isToggling}
              trackColor={{ 
                false: Colors.lightGray, 
                true: Colors.primary 
              }}
              thumbColor={Platform.OS === 'ios' ? Colors.white : (isActive ? Colors.white : Colors.mediumGray)}
              ios_backgroundColor={Colors.lightGray}
            />
          </View>
          
          {/* Status indicator with visual feedback */}
          <View style={[
            styles.statusIndicator,
            selectedStore.status === 'activa' && styles.statusActive,
            selectedStore.status === 'inactiva' && styles.statusInactive,
            selectedStore.status === 'pendiente de aprobación' && styles.statusPending,
            selectedStore.status === 'rechazada' && styles.statusRejected,
          ]}>
            <View style={[
              styles.statusDot,
              selectedStore.status === 'activa' && styles.statusDotActive,
              selectedStore.status === 'inactiva' && styles.statusDotInactive,
              selectedStore.status === 'pendiente de aprobación' && styles.statusDotPending,
              selectedStore.status === 'rechazada' && styles.statusDotRejected,
            ]} />
            <Text style={styles.statusIndicatorText}>
              Estado actual: <Text style={styles.statusIndicatorValue}>{selectedStore.status}</Text>
            </Text>
          </View>
          
          {/* Help text for disabled states */}
          {!canToggle && (
            <View style={styles.helpTextContainer}>
              <Ionicons name="information-circle-outline" size={16} color={Colors.mediumGray} />
              <Text style={styles.helpText}>
                {selectedStore.status === 'pendiente de aprobación' 
                  ? 'Tu tienda está pendiente de aprobación por un administrador'
                  : selectedStore.status === 'rechazada'
                  ? 'Tu tienda fue rechazada. Edítala para volver a enviarla a revisión'
                  : 'No se puede cambiar el estado de la tienda'}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Basic Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Información</Text>
        <View style={styles.infoRow}>
          <Ionicons name="location" size={20} color={Colors.primary} />
          <Text style={styles.infoText}>{selectedStore.address}</Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="call" size={20} color={Colors.primary} />
          <Text style={styles.infoText}>{selectedStore.phone}</Text>
        </View>
        {selectedStore.email && (
          <View style={styles.infoRow}>
            <Ionicons name="mail" size={20} color={Colors.primary} />
            <Text style={styles.infoText}>{selectedStore.email}</Text>
          </View>
        )}
      </View>

      {/* Description */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Descripción</Text>
        <Text style={styles.description}>{selectedStore.description}</Text>
      </View>

      {/* Status Badge (for non-owners or as additional info) */}
      {!isOwner && selectedStore.status && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Estado</Text>
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>{selectedStore.status}</Text>
          </View>
        </View>
      )}

      {/* Delete Store Section (Owner Only) */}
      {/* Requirements: 17.1, 17.4 */}
      {isOwner && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Configuración</Text>
          <TouchableOpacity
            style={[styles.deleteButton, isDeleting && styles.deleteButtonDisabled]}
            onPress={handleDeleteStore}
            disabled={isDeleting}
          >
            <Ionicons 
              name="trash-outline" 
              size={20} 
              color={isDeleting ? Colors.mediumGray : Colors.error} 
            />
            <Text style={[styles.deleteButtonText, isDeleting && styles.deleteButtonTextDisabled]}>
              {isDeleting ? 'Eliminando...' : 'Eliminar tienda'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Note: Full implementation will be done in Task 16 */}
      <View style={styles.noteContainer}>
        <Ionicons name="information-circle-outline" size={20} color={Colors.mediumGray} />
        <Text style={styles.noteText}>
          La vista completa de detalles se implementará en la Tarea 16
        </Text>
      </View>
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
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: Spacing.lg,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  storeName: {
    ...Typography.h1,
    fontSize: 28,
    marginBottom: 4,
  },
  category: {
    ...Typography.body,
    color: Colors.mediumGray,
  },
  section: {
    backgroundColor: Colors.white,
    marginTop: Spacing.md,
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginHorizontal: Spacing.lg,
    ...Shadows.sm,
  },
  sectionTitle: {
    ...Typography.h3,
    marginBottom: Spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  infoText: {
    ...Typography.body,
    flex: 1,
  },
  description: {
    ...Typography.body,
    color: Colors.darkGray,
    lineHeight: 24,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.light,
    borderRadius: BorderRadius.full,
  },
  statusText: {
    ...Typography.bodySmall,
    color: Colors.primary,
    fontWeight: '600',
  },
  noteContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.lg,
    marginHorizontal: Spacing.lg,
    padding: Spacing.md,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  noteText: {
    ...Typography.bodySmall,
    color: Colors.mediumGray,
    flex: 1,
  },
  // Toggle Section Styles
  toggleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  toggleInfo: {
    flex: 1,
    marginRight: Spacing.md,
  },
  toggleDescription: {
    ...Typography.bodySmall,
    color: Colors.mediumGray,
    marginTop: 4,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.background,
    marginTop: Spacing.sm,
  },
  statusActive: {
    backgroundColor: '#E8F5E9',
  },
  statusInactive: {
    backgroundColor: '#FFF3E0',
  },
  statusPending: {
    backgroundColor: '#E3F2FD',
  },
  statusRejected: {
    backgroundColor: '#FFEBEE',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: Spacing.sm,
  },
  statusDotActive: {
    backgroundColor: '#4CAF50',
  },
  statusDotInactive: {
    backgroundColor: '#FF9800',
  },
  statusDotPending: {
    backgroundColor: '#2196F3',
  },
  statusDotRejected: {
    backgroundColor: '#F44336',
  },
  statusIndicatorText: {
    ...Typography.bodySmall,
    color: Colors.darkGray,
  },
  statusIndicatorValue: {
    fontWeight: '600',
    color: Colors.text,
  },
  helpTextContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: Spacing.md,
    padding: Spacing.sm,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.sm,
    gap: Spacing.xs,
  },
  helpText: {
    ...Typography.bodySmall,
    color: Colors.mediumGray,
    flex: 1,
    lineHeight: 18,
  },
  // Delete Button Styles
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.error,
    gap: Spacing.sm,
  },
  deleteButtonDisabled: {
    borderColor: Colors.lightGray,
    opacity: 0.6,
  },
  deleteButtonText: {
    ...Typography.body,
    color: Colors.error,
    fontWeight: '600',
  },
  deleteButtonTextDisabled: {
    color: Colors.mediumGray,
  },
});
