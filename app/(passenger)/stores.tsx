import React from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function StoresScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Tiendas</Text>
        <Text style={styles.subtitle}>
          Descubre tiendas y servicios cercanos
        </Text>
      </View>

      <View style={styles.content}>
        <Ionicons name="storefront-outline" size={120} color="#A9A9A9" />
        <Text style={styles.developmentText}>En desarrollo</Text>
        <Text style={styles.developmentSubtext}>
          Próximamente podrás explorar tiendas y realizar compras
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#505050',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#A9A9A9',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  developmentText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#505050',
    marginTop: 24,
    textAlign: 'center',
  },
  developmentSubtext: {
    fontSize: 16,
    color: '#A9A9A9',
    marginTop: 12,
    textAlign: 'center',
    lineHeight: 24,
  },
});
