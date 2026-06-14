import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing } from '@/constants/theme';
// import { useCopilot, walkthroughable, CopilotStep } from 'react-native-copilot';
import { useSmartTutorial } from '@/hooks/useSmartTutorial';
import { setActiveTutorialScreen } from '@/utils/tutorialState';

// const WalkthroughView = walkthroughable(View);

export default function StoresPlaceholderScreen() {
  // const { start: startTour } = useCopilot();
  const { isActive: needsTutorial } = useSmartTutorial('passenger_stores');

  useEffect(() => {
    if (needsTutorial) {
      setActiveTutorialScreen('passenger_stores');
      // setTimeout(() => { startTour(); }, 800);
    }
  }, [needsTutorial]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Tiendas</Text>
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
    paddingHorizontal: Spacing.lg,
    paddingTop: Platform.OS === 'ios' ? 60 : 50,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    ...Typography.h1,
    fontSize: 28,
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
