import { Stack } from 'expo-router';

export default function DriverLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="register" />
      <Stack.Screen name="documents-upload" />
      <Stack.Screen name="documents" />
      <Stack.Screen name="verification-status" />
      <Stack.Screen name="earnings" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="active-ride" />
      <Stack.Screen name="ride-history" />
    </Stack>
  );
}
