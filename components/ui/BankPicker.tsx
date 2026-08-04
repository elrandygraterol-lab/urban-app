import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, FlatList, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/theme';
import { BANCOS_VENEZUELA, getBankName } from '@/constants/banks';

interface BankPickerProps {
  value?: string;
  onChange: (code: string) => void;
  placeholder?: string;
  style?: ViewStyle;
}

export const BankPicker: React.FC<BankPickerProps> = ({
  value = '',
  onChange,
  placeholder = 'Seleccionar banco',
  style,
}) => {
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);
  const isCode = /^\d{4}$/.test(value);

  return (
    <>
      <TouchableOpacity style={[styles.selector, style]} onPress={() => setVisible(true)}>
        <Text style={[styles.selectorText, !value && styles.selectorPlaceholder]} numberOfLines={1}>
          {value ? getBankName(value) : placeholder}
        </Text>
        {value && isCode ? <Text style={styles.selectorCode}>{value}</Text> : null}
        <Ionicons name="chevron-down" size={16} color="#9ca3af" />
      </TouchableOpacity>

      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={() => setVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setVisible(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={[styles.modal, { paddingBottom: insets.bottom + 16 }]}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Seleccionar Banco</Text>
              <TouchableOpacity onPress={() => setVisible(false)}>
                <Ionicons name="close" size={24} color="#374151" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={BANCOS_VENEZUELA}
              keyExtractor={b => b.code}
              style={{ maxHeight: 400 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.item, value === item.code && styles.itemActive]}
                  onPress={() => {
                    onChange(item.code);
                    setVisible(false);
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[styles.itemName, value === item.code && { color: Colors.primary }]}
                    >
                      {item.name}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.itemCode,
                      value === item.code && { color: Colors.primary, fontWeight: '700' },
                    ]}
                  >
                    {item.code}
                  </Text>
                  {value === item.code && (
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color={Colors.primary}
                      style={{ marginLeft: 8 }}
                    />
                  )}
                </TouchableOpacity>
              )}
              ItemSeparatorComponent={() => (
                <View style={{ height: 1, backgroundColor: '#f3f4f6' }} />
              )}
            />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  selector: {
    height: 48,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fafafa',
    gap: 8,
  },
  selectorText: { flex: 1, fontSize: 15, color: '#1f2937' },
  selectorPlaceholder: { color: '#9ca3af' },
  selectorCode: { fontSize: 12, color: '#9ca3af', fontWeight: '600' },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 20,
    maxHeight: '60%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#111' },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  itemActive: { backgroundColor: '#f0fdf4' },
  itemName: { fontSize: 15, color: '#111', fontWeight: '500' },
  itemCode: { fontSize: 13, color: '#9ca3af', fontWeight: '500' },
});
