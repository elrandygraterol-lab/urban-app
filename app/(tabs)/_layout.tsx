import { Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { NotificationTabIcon } from '@/components/NotificationTabIcon';
import { Colors } from '@/constants/theme';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.primary,
        headerShown: false,
        tabBarButton: HapticTab,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explore',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="paperplane.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Notifications',
          tabBarIcon: ({ color, focused }) => (
            <NotificationTabIcon color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="stores/[id]"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="stores/my-stores"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="stores/form"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="stores/stats/[id]"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
