/**
 * RideTypeSelector
 *
 * Component that allows a passenger to select the type of ride they want to request.
 * Shows 3 options:
 *  1. "Viaje Individual" - Standard ride with 1 pickup and 1 destination
 *  2. "Viaje Compartido" - Shared ride with another registered passenger
 *  3. "Pedir Viaje Para Otro" - Delegated ride for a non-registered beneficiary
 *
 * When the user selects an option:
 *  - "Viaje Individual": Calls onSelectIndividual() to show standard ride request screen
 *  - "Viaje Compartido": Calls onSelectShared() to open SharedRideModal
 *  - "Pedir Viaje Para Otro": Calls onSelectDelegated() to open DelegatedRideModal
 *
 * Requisitos: 4.1, 9.1
 */

import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/theme';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RideTypeSelectorProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Called when user selects "Viaje Individual" */
  onSelectIndividual: () => void;
  /** Called when user selects "Viaje Compartido" */
  onSelectShared: () => void;
  /** Called when user selects "Pedir Viaje Para Otro" */
  onSelectDelegated: () => void;
  /** Called when the user dismisses the modal */
  onClose: () => void;
}

interface RideTypeOption {
  id: 'individual' | 'shared' | 'delegated';
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  backgroundColor: string;
  borderColor: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const RIDE_TYPE_OPTIONS: RideTypeOption[] = [
  {
    id: 'individual',
    title: 'Viaje Individual',
    description: 'Solicita un viaje solo para ti con 1 punto de recogida y 1 destino',
    icon: 'person',
    iconColor: Colors.primary,
    backgroundColor: '#f0fdf4',
    borderColor: '#d1fae5',
  },
  {
    id: 'shared',
    title: 'Viaje Compartido',
    description: 'Comparte el viaje con otro pasajero registrado y divide el costo',
    icon: 'people',
    iconColor: '#3b82f6',
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
  },
  {
    id: 'delegated',
    title: 'Pedir Viaje Para Otro',
    description: 'Solicita un viaje para una persona que no está registrada en la app',
    icon: 'gift',
    iconColor: '#8b5cf6',
    backgroundColor: '#f5f3ff',
    borderColor: '#ddd6fe',
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function RideTypeSelector({
  visible,
  onSelectIndividual,
  onSelectShared,
  onSelectDelegated,
  onClose,
}: RideTypeSelectorProps) {
  const insets = useSafeAreaInsets();

  const handleSelectOption = (optionId: 'individual' | 'shared' | 'delegated') => {
    switch (optionId) {
      case 'individual':
        onSelectIndividual();
        break;
      case 'shared':
        onSelectShared();
        break;
      case 'delegated':
        onSelectDelegated();
        break;
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 24) }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Ionicons name="car-outline" size={24} color={Colors.primary} />
              <Text style={styles.title}>Tipo de Viaje</Text>
            </View>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Cerrar"
            >
              <Ionicons name="close" size={24} color={Colors.darkGray} />
            </TouchableOpacity>
          </View>

          <Text style={styles.subtitle}>Selecciona el tipo de viaje que deseas solicitar</Text>

          {/* Options list */}
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {RIDE_TYPE_OPTIONS.map(option => (
              <TouchableOpacity
                key={option.id}
                style={[
                  styles.optionCard,
                  {
                    backgroundColor: option.backgroundColor,
                    borderColor: option.borderColor,
                  },
                ]}
                onPress={() => handleSelectOption(option.id)}
                accessibilityRole="button"
                accessibilityLabel={`Seleccionar ${option.title}`}
                accessibilityHint={option.description}
              >
                <View style={styles.optionIconContainer}>
                  <Ionicons name={option.icon} size={32} color={option.iconColor} />
                </View>
                <View style={styles.optionContent}>
                  <Text style={styles.optionTitle}>{option.title}</Text>
                  <Text style={styles.optionDescription}>{option.description}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={Colors.mediumGray} />
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Info message */}
          <View style={styles.infoCard}>
            <Ionicons name="information-circle-outline" size={20} color={Colors.primary} />
            <Text style={styles.infoText}>
              Puedes cambiar el tipo de viaje en cualquier momento antes de confirmar la solicitud.
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
    paddingTop: 24,
    paddingHorizontal: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.darkGray,
  },
  closeButton: {
    padding: 4,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.mediumGray,
    lineHeight: 18,
    marginBottom: 20,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    gap: 16,
    paddingBottom: 16,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    gap: 16,
  },
  optionIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionContent: {
    flex: 1,
    gap: 4,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.darkGray,
  },
  optionDescription: {
    fontSize: 13,
    color: Colors.mediumGray,
    lineHeight: 18,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    marginTop: 16,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#1e40af',
    lineHeight: 18,
  },
});
