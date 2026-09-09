import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Platform, SafeAreaView } from 'react-native';

interface ActionSheetOption {
  text: string;
  onPress: () => void;
  style?: 'default' | 'destructive' | 'cancel';
}

interface ActionSheetProps {
  visible: boolean;
  options: ActionSheetOption[];
  onClose: () => void;
  title?: string;
}

export const ActionSheet: React.FC<ActionSheetProps> = ({
  visible,
  options,
  onClose,
  title,
}) => {
  if (!visible) return null;

  const handlePress = (option: ActionSheetOption) => {
    option.onPress();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.overlay} onTouchStart={onClose}>
        <SafeAreaView style={styles.container}>
          {title && (
            <View style={styles.titleContainer}>
              <Text style={styles.title}>{title}</Text>
            </View>
          )}
          {options.map((option, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.button,
                option.style === 'destructive' && styles.buttonDestructive,
                option.style === 'cancel' && styles.buttonCancel,
              ]}
              onPress={() => handlePress(option)}
            >
              <Text
                style={[
                  styles.buttonText,
                  option.style === 'destructive' && styles.buttonTextDestructive,
                  option.style === 'cancel' && styles.buttonTextCancel,
                ]}
              >
                {option.text}
              </Text>
            </TouchableOpacity>
          ))}
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
  },
  titleContainer: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  button: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    alignItems: 'center',
  },
  buttonCancel: {
    marginTop: 8,
    borderBottomWidth: 0,
    backgroundColor: '#f9fafb',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  buttonDestructive: {
    backgroundColor: '#fef2f2',
  },
  buttonText: {
    fontSize: 17,
    fontWeight: '500',
    color: '#111827',
  },
  buttonTextCancel: {
    fontWeight: '600',
    color: '#2563eb',
  },
  buttonTextDestructive: {
    color: '#dc2626',
  },
});

export default ActionSheet;