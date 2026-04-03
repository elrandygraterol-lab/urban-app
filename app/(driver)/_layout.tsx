import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import GlobalNotificationModal from '@/components/GlobalNotificationModal';
import React from 'react';

export default function DriverLayout() {
  return (
    <>
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
          name="ride-history"
          options={{
            title: 'Historial',
            tabBarIcon: ({ color, size }) => <Ionicons name="time" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="earnings"
          options={{
            title: 'Ganancias',
            tabBarIcon: ({ color, size }) => <Ionicons name="wallet" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Perfil',
            tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />,
          }}
        />

        {/* Hidden screens - not shown in tab bar */}
        <Tabs.Screen
          name="register"
          options={{
            href: null, // Hide from tab bar
          }}
        />
        <Tabs.Screen
          name="documents-upload"
          options={{
            href: null, // Hide from tab bar
          }}
        />
        <Tabs.Screen
          name="documents"
          options={{
            href: null, // Hide from tab bar
          }}
        />
        <Tabs.Screen
          name="verification-status"
          options={{
            href: null, // Hide from tab bar
          }}
        />
        <Tabs.Screen
          name="active-ride"
          options={{
            href: null, // Hide from tab bar
          }}
        />
      </Tabs>

      {/* Global notification modal for in-app notifications */}
      <GlobalNotificationModal />
    </>
  );
}
