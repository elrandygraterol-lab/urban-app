import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
// import { walkthroughable, CopilotStep } from 'react-native-copilot';
import { TouchableOpacity } from 'react-native';

// const WalkthroughTouchableOpacity = walkthroughable(TouchableOpacity);

export default function DriverLayout() {
  return (
    <>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: '#2FB908',
          tabBarInactiveTintColor: '#A9A9A9',
          headerShown: false,
          lazy: true,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Inicio',
            tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
            tabBarButton: (props: any) => <TouchableOpacity {...props} />,
          }}
        />
        <Tabs.Screen
          name="ride-history"
          options={{
            title: 'Historial',
            tabBarIcon: ({ color, size }) => <Ionicons name="time" size={size} color={color} />,
            tabBarButton: (props: any) => <TouchableOpacity {...props} />,
          }}
        />
        <Tabs.Screen
          name="earnings"
          options={{
            title: 'Ganancias',
            tabBarIcon: ({ color, size }) => <Ionicons name="wallet" size={size} color={color} />,
            tabBarButton: (props: any) => <TouchableOpacity {...props} />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Perfil',
            tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />,
            tabBarButton: (props: any) => <TouchableOpacity {...props} />,
          }}
        />

        {/* Hidden screens */}
        <Tabs.Screen name="wallet" options={{ href: null }} />
        <Tabs.Screen name="register" options={{ href: null }} />
        <Tabs.Screen name="documents-upload" options={{ href: null }} />
        <Tabs.Screen name="documents" options={{ href: null }} />
        <Tabs.Screen name="verification-status" options={{ href: null }} />
        <Tabs.Screen name="active-ride" options={{ href: null }} />
        <Tabs.Screen name="payment-methods" options={{ href: null }} />
        <Tabs.Screen name="manage-ride" options={{ href: null }} />
      </Tabs>
    </>
  );
}
