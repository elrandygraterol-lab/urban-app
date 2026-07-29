import React from 'react';
import { View, Text, TouchableOpacity, Modal, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';

interface ProminentLocationDisclosureProps {
  visible: boolean;
  onAccept: () => void;
}

export default function ProminentLocationDisclosure({
  visible,
  onAccept,
}: ProminentLocationDisclosureProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => {}}>
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 20,
        }}
      >
        <View
          style={{
            backgroundColor: '#fff',
            borderRadius: 20,
            padding: 24,
            width: '100%',
            maxWidth: 340,
            alignItems: 'center',
          }}
        >
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              backgroundColor: '#f0fdf4',
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: 16,
            }}
          >
            <Ionicons name="location-outline" size={32} color={Colors.primary} />
          </View>

          <Text
            style={{
              fontSize: 20,
              fontWeight: '700',
              color: Colors.darkGray,
              textAlign: 'center',
              marginBottom: 16,
            }}
          >
            UrbanTaxi SJ necesita acceso a tu ubicación
          </Text>

          <Text
            style={{
              fontSize: 14,
              color: Colors.mediumGray,
              textAlign: 'center',
              lineHeight: 20,
              marginBottom: 16,
            }}
          >
            Incluso cuando la aplicación esté en segundo plano, para:
          </Text>

          <View style={{ width: '100%', marginBottom: 16 }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                marginBottom: 10,
              }}
            >
              <Ionicons
                name="checkmark-circle"
                size={18}
                color={Colors.primary}
                style={{ marginRight: 8, marginTop: 2 }}
              />
              <Text style={{ fontSize: 14, color: Colors.darkGray, flex: 1 }}>
                Compartir tu posición en tiempo real con el conductor o pasajero durante el viaje
              </Text>
            </View>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                marginBottom: 10,
              }}
            >
              <Ionicons
                name="checkmark-circle"
                size={18}
                color={Colors.primary}
                style={{ marginRight: 8, marginTop: 2 }}
              />
              <Text style={{ fontSize: 14, color: Colors.darkGray, flex: 1 }}>
                Encontrar conductores cercanos y calcular tarifas precisas
              </Text>
            </View>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
              }}
            >
              <Ionicons
                name="checkmark-circle"
                size={18}
                color={Colors.primary}
                style={{ marginRight: 8, marginTop: 2 }}
              />
              <Text style={{ fontSize: 14, color: Colors.darkGray, flex: 1 }}>
                Garantizar un servicio seguro, preciso y con seguimiento en tiempo real
              </Text>
            </View>
          </View>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#f9fafb',
              padding: 12,
              borderRadius: 10,
              marginBottom: 20,
              width: '100%',
            }}
          >
            <Ionicons
              name="shield-checkmark-outline"
              size={18}
              color={Colors.mediumGray}
              style={{ marginRight: 8 }}
            />
            <Text style={{ fontSize: 12, color: Colors.mediumGray, flex: 1 }}>
              Tus datos de ubicación no se comparten con terceros y solo se usan mientras el
              servicio está activo.
            </Text>
          </View>

          <View style={{ flexDirection: 'row', gap: 10, width: '100%' }}>
            <TouchableOpacity
              onPress={() => Linking.openSettings()}
              style={{
                flex: 1,
                paddingVertical: 12,
                borderRadius: 10,
                alignItems: 'center',
                backgroundColor: '#f3f4f6',
              }}
            >
              <Text
                style={{ fontSize: 13, fontWeight: '500', color: Colors.mediumGray }}
              >
                Configuración
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onAccept}
              style={{
                flex: 1,
                paddingVertical: 12,
                borderRadius: 10,
                alignItems: 'center',
                backgroundColor: Colors.primary,
              }}
            >
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>
                Aceptar
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
