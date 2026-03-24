import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors as COLORS } from '@/constants/theme';

export default function VerificationStatusScreen() {
  const router = useRouter();
  const [status, setStatus] = useState<'pending' | 'verified' | 'rejected'>('pending');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate loading verification status
    const timer = setTimeout(() => {
      setStatus('pending');
      setIsLoading(false);
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  const getStatusContent = () => {
    switch (status) {
      case 'pending':
        return {
          icon: '⏳',
          title: 'Verificación Pendiente',
          description: 'Tu solicitud ha sido recibida. Nuestro equipo revisará tus documentos en las próximas 24-48 horas.',
          color: COLORS.orange,
        };
      case 'verified':
        return {
          icon: '✓',
          title: 'Cuenta Verificada',
          description: '¡Felicidades! Tu cuenta ha sido verificada. Ahora puedes comenzar a aceptar viajes.',
          color: COLORS.primary,
        };
      case 'rejected':
        return {
          icon: '✕',
          title: 'Verificación Rechazada',
          description: 'Lamentablemente, tu solicitud fue rechazada. Por favor, revisa tus documentos e intenta nuevamente.',
          color: '#FF6B6B',
        };
    }
  };

  const content = getStatusContent();

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.content}>
        <View style={[styles.iconContainer, { backgroundColor: `${content.color}20` }]}>
          <Text style={styles.icon}>{content.icon}</Text>
        </View>

        <Text style={styles.title}>{content.title}</Text>
        <Text style={styles.description}>{content.description}</Text>

        {status === 'pending' && (
          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>¿Qué sucede ahora?</Text>
            <View style={styles.infoList}>
              <View style={styles.infoItem}>
                <Text style={styles.infoBullet}>1.</Text>
                <Text style={styles.infoText}>Revisamos tus documentos</Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoBullet}>2.</Text>
                <Text style={styles.infoText}>Verificamos tu identidad</Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoBullet}>3.</Text>
                <Text style={styles.infoText}>Te notificamos el resultado</Text>
              </View>
            </View>
          </View>
        )}

        {status === 'verified' && (
          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>Próximos Pasos</Text>
            <Text style={styles.infoText}>
              Completa tu perfil y configura tu disponibilidad para comenzar a recibir solicitudes de viaje.
            </Text>
          </View>
        )}

        {status === 'rejected' && (
          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>Razón del Rechazo</Text>
            <Text style={styles.infoText}>
              Algunos de tus documentos no cumplen con los requisitos. Por favor, sube nuevas versiones.
            </Text>
          </View>
        )}
      </View>

      <View style={styles.buttonContainer}>
        {status === 'pending' && (
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.push('/(driver)/')}
          >
            <Text style={styles.primaryButtonText}>Volver al Inicio</Text>
          </TouchableOpacity>
        )}

        {status === 'verified' && (
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.push('/(driver)/')}
          >
            <Text style={styles.primaryButtonText}>Ir al Dashboard</Text>
          </TouchableOpacity>
        )}

        {status === 'rejected' && (
          <>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => router.push('/(driver)/documents-upload')}
            >
              <Text style={styles.primaryButtonText}>Subir Nuevos Documentos</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => router.push('/(driver)/')}
            >
              <Text style={styles.secondaryButtonText}>Volver</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingTop: 40,
  },
  content: {
    alignItems: 'center',
    marginBottom: 40,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  icon: {
    fontSize: 48,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.darkGray,
    marginBottom: 12,
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    color: COLORS.lightGray,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  infoBox: {
    backgroundColor: '#f9f9f9',
    borderRadius: 16,
    padding: 16,
    width: '100%',
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.darkGray,
    marginBottom: 12,
  },
  infoList: {
    gap: 12,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  infoBullet: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
    width: 24,
  },
  infoText: {
    fontSize: 13,
    color: COLORS.lightGray,
    flex: 1,
    lineHeight: 18,
  },
  buttonContainer: {
    marginBottom: 40,
    gap: 12,
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 24,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 24,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: '600',
  },
});
