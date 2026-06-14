import React from 'react';
import { View, Text, StyleSheet, Platform, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing } from '@/constants/theme';

export default function StoreDetailPlaceholderScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.darkGray} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tienda</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons name="storefront-outline" size={80} color={Colors.lightGray} />
          <Ionicons
            name="construct-outline"
            size={40}
            color={Colors.primary}
            style={styles.constructIcon}
          />
        </View>
        <Text style={styles.title}>Estamos construyendo esta sección</Text>
        <Text style={styles.subtitle}>
          Pronto estará lista para su uso. De momento, la función principal es de taxis.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Platform.OS === 'ios' ? 60 : 50,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.md,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    ...Typography.h1,
    fontSize: 22,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  iconContainer: {
    position: 'relative',
    marginBottom: Spacing.lg,
  },
  constructIcon: {
    position: 'absolute',
    bottom: -8,
    right: -12,
  },
  title: {
    ...Typography.h2,
    textAlign: 'center',
    marginBottom: Spacing.md,
    color: Colors.darkGray,
  },
  subtitle: {
    ...Typography.body,
    textAlign: 'center',
    color: Colors.mediumGray,
    lineHeight: 22,
  },
});
