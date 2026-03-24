import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Switch } from 'react-native';
import { useAuthStore } from '@/store/authStore';
import { api } from '@/services/api';
import { Colors as colors } from '@/constants/theme';
import { useRouter } from 'expo-router';

interface DriverProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  vehicleType: string;
  licensePlate: string;
  vehicleModel: string;
  averageRating: number;
  totalRides: number;
  verificationStatus: string;
}

export default function DriverProfileScreen() {
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [language, setLanguage] = useState('en');

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/users/drivers/${user?.id}`);
      setProfile(response.data);
    } catch (error) {
      Alert.alert('Error', 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', onPress: () => {} },
      {
        text: 'Logout',
        onPress: async () => {
          logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  const handleDeleteAccount = async () => {
    Alert.alert('Delete Account', 'This action cannot be undone. Are you sure?', [
      { text: 'Cancel', onPress: () => {} },
      {
        text: 'Delete',
        onPress: async () => {
          try {
            await api.delete('/api/users/me');
            logout();
            router.replace('/(auth)/login');
          } catch (error) {
            Alert.alert('Error', 'Failed to delete account');
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#fff' }}>
      <View style={{ padding: 16 }}>
        <Text style={{ fontSize: 24, fontWeight: 'bold', color: colors.darkGray, marginBottom: 24 }}>
          Profile
        </Text>

        {/* Personal Info */}
        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 16, fontWeight: '600', color: colors.darkGray, marginBottom: 12 }}>
            Personal Information
          </Text>
          <View style={{ backgroundColor: '#F5F5F5', borderRadius: 12, padding: 16 }}>
            <View style={{ marginBottom: 12 }}>
              <Text style={{ fontSize: 12, color: colors.lightGray, marginBottom: 4 }}>Name</Text>
              <Text style={{ fontSize: 14, color: colors.darkGray }}>{profile?.name}</Text>
            </View>
            <View style={{ marginBottom: 12 }}>
              <Text style={{ fontSize: 12, color: colors.lightGray, marginBottom: 4 }}>Email</Text>
              <Text style={{ fontSize: 14, color: colors.darkGray }}>{profile?.email}</Text>
            </View>
            <View>
              <Text style={{ fontSize: 12, color: colors.lightGray, marginBottom: 4 }}>Phone</Text>
              <Text style={{ fontSize: 14, color: colors.darkGray }}>{profile?.phone}</Text>
            </View>
          </View>
        </View>

        {/* Vehicle Info */}
        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 16, fontWeight: '600', color: colors.darkGray, marginBottom: 12 }}>
            Vehicle Information
          </Text>
          <View style={{ backgroundColor: '#F5F5F5', borderRadius: 12, padding: 16 }}>
            <View style={{ marginBottom: 12 }}>
              <Text style={{ fontSize: 12, color: colors.lightGray, marginBottom: 4 }}>Type</Text>
              <Text style={{ fontSize: 14, color: colors.darkGray, textTransform: 'capitalize' }}>
                {profile?.vehicleType}
              </Text>
            </View>
            <View style={{ marginBottom: 12 }}>
              <Text style={{ fontSize: 12, color: colors.lightGray, marginBottom: 4 }}>Model</Text>
              <Text style={{ fontSize: 14, color: colors.darkGray }}>{profile?.vehicleModel}</Text>
            </View>
            <View>
              <Text style={{ fontSize: 12, color: colors.lightGray, marginBottom: 4 }}>License Plate</Text>
              <Text style={{ fontSize: 14, color: colors.darkGray }}>{profile?.licensePlate}</Text>
            </View>
          </View>
        </View>

        {/* Rating & Stats */}
        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 16, fontWeight: '600', color: colors.darkGray, marginBottom: 12 }}>
            Statistics
          </Text>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1, backgroundColor: '#F5F5F5', borderRadius: 12, padding: 16, alignItems: 'center' }}>
              <Text style={{ fontSize: 12, color: colors.lightGray, marginBottom: 4 }}>Rating</Text>
              <Text style={{ fontSize: 20, fontWeight: 'bold', color: colors.primary }}>
                {profile?.averageRating.toFixed(1)} ⭐
              </Text>
            </View>
            <View style={{ flex: 1, backgroundColor: '#F5F5F5', borderRadius: 12, padding: 16, alignItems: 'center' }}>
              <Text style={{ fontSize: 12, color: colors.lightGray, marginBottom: 4 }}>Rides</Text>
              <Text style={{ fontSize: 20, fontWeight: 'bold', color: colors.primary }}>
                {profile?.totalRides}
              </Text>
            </View>
          </View>
        </View>

        {/* Verification Status */}
        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 16, fontWeight: '600', color: colors.darkGray, marginBottom: 12 }}>
            Verification Status
          </Text>
          <View
            style={{
              backgroundColor:
                profile?.verificationStatus === 'verified'
                  ? '#D4EDDA'
                  : profile?.verificationStatus === 'rejected'
                  ? '#F8D7DA'
                  : '#E2E3E5',
              borderRadius: 12,
              padding: 16,
              alignItems: 'center',
            }}
          >
            <Text
              style={{
                fontSize: 14,
                fontWeight: '600',
                color:
                  profile?.verificationStatus === 'verified'
                    ? '#155724'
                    : profile?.verificationStatus === 'rejected'
                    ? '#721C24'
                    : '#383D41',
              }}
            >
              {profile?.verificationStatus.charAt(0).toUpperCase() + profile?.verificationStatus.slice(1)}
            </Text>
          </View>
        </View>

        {/* Settings */}
        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 16, fontWeight: '600', color: colors.darkGray, marginBottom: 12 }}>
            Settings
          </Text>

          <TouchableOpacity
            onPress={() => setNotificationsEnabled(!notificationsEnabled)}
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: '#F5F5F5',
              borderRadius: 12,
              padding: 16,
              marginBottom: 8,
            }}
          >
            <Text style={{ fontSize: 14, color: colors.darkGray }}>Push Notifications</Text>
            <Switch
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
              trackColor={{ false: '#ccc', true: colors.primary }}
              thumbColor={notificationsEnabled ? colors.primary : '#f4f3f4'}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: '#F5F5F5',
              borderRadius: 12,
              padding: 16,
            }}
          >
            <Text style={{ fontSize: 14, color: colors.darkGray }}>Language</Text>
            <Text style={{ fontSize: 14, color: colors.primary, fontWeight: '600' }}>
              {language === 'en' ? 'English' : 'Español'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Documents */}
        <TouchableOpacity
          onPress={() => router.push('/(driver)/documents')}
          style={{
            backgroundColor: colors.primary,
            borderRadius: 12,
            padding: 16,
            alignItems: 'center',
            marginBottom: 12,
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>View Documents</Text>
        </TouchableOpacity>

        {/* Logout */}
        <TouchableOpacity
          onPress={handleLogout}
          style={{
            backgroundColor: colors.orange,
            borderRadius: 12,
            padding: 16,
            alignItems: 'center',
            marginBottom: 12,
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>Logout</Text>
        </TouchableOpacity>

        {/* Delete Account */}
        <TouchableOpacity
          onPress={handleDeleteAccount}
          style={{
            backgroundColor: '#DC3545',
            borderRadius: 12,
            padding: 16,
            alignItems: 'center',
            marginBottom: 24,
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>Delete Account</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
