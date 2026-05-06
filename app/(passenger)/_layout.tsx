import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import GlobalNotificationModal from '@/components/GlobalNotificationModal';
import { View } from 'react-native';

export default function PassengerLayout() {
  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: '#22c55e',
          tabBarInactiveTintColor: '#A9A9A9',
          headerShown: false,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Inicio',
            tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="history"
          options={{
            title: 'Historial',
            tabBarIcon: ({ color, size }) => <Ionicons name="time" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="stores"
          options={{
            title: 'Tiendas',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="storefront" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Perfil',
            tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />,
          }}
        />
        {/* Hide delegated-ride-tracking from tab bar - it's accessed via navigation */}
        <Tabs.Screen
          name="delegated-ride-tracking"
          options={{
            href: null, // Hide from tab bar
            title: 'Seguimiento de Viaje',
          }}
        />
      </Tabs>

      {/* Global Notification Modal */}
      <GlobalNotificationModal />
    </View>
  );
}

