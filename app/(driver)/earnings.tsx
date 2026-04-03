import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { api } from '@/services/api';
import { Colors as colors } from '@/constants/theme';

interface EarningsData {
  today: number;
  week: number;
  month: number;
  ridesCompleted: number;
  rides: Array<{
    id: string;
    date: string;
    pickupAddress: string;
    destinationAddress: string;
    fare: number;
  }>;
}

export default function DriverEarningsScreen() {
  const [earnings, setEarnings] = useState<EarningsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEarnings();
  }, []);

  const fetchEarnings = async () => {
    try {
      setLoading(true);
      const [todayRes, weekRes, monthRes] = await Promise.all([
        api.get('/api/drivers/earnings/today'),
        api.get('/api/drivers/earnings/week'),
        api.get('/api/drivers/earnings/month'),
      ]);

      setEarnings({
        today: todayRes.data.total,
        week: weekRes.data.total,
        month: monthRes.data.total,
        ridesCompleted: todayRes.data.ridesCompleted,
        rides: todayRes.data.rides || [],
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to load earnings');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View
        style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#fff' }}>
      <View style={{ padding: 16 }}>
        <Text
          style={{ fontSize: 24, fontWeight: 'bold', color: colors.darkGray, marginBottom: 16 }}
        >
          Earnings
        </Text>

        {/* Summary Cards */}
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 24 }}>
          <View
            style={{
              flex: 1,
              backgroundColor: '#F5F5F5',
              borderRadius: 12,
              padding: 16,
              alignItems: 'center',
            }}
          >
            <Text style={{ fontSize: 12, color: colors.lightGray, marginBottom: 4 }}>Today</Text>
            <Text style={{ fontSize: 20, fontWeight: 'bold', color: colors.primary }}>
              ${earnings?.today.toFixed(2)}
            </Text>
          </View>

          <View
            style={{
              flex: 1,
              backgroundColor: '#F5F5F5',
              borderRadius: 12,
              padding: 16,
              alignItems: 'center',
            }}
          >
            <Text style={{ fontSize: 12, color: colors.lightGray, marginBottom: 4 }}>
              This Week
            </Text>
            <Text style={{ fontSize: 20, fontWeight: 'bold', color: colors.primary }}>
              ${earnings?.week.toFixed(2)}
            </Text>
          </View>

          <View
            style={{
              flex: 1,
              backgroundColor: '#F5F5F5',
              borderRadius: 12,
              padding: 16,
              alignItems: 'center',
            }}
          >
            <Text style={{ fontSize: 12, color: colors.lightGray, marginBottom: 4 }}>
              This Month
            </Text>
            <Text style={{ fontSize: 20, fontWeight: 'bold', color: colors.primary }}>
              ${earnings?.month.toFixed(2)}
            </Text>
          </View>
        </View>

        {/* Rides Completed */}
        <View style={{ marginBottom: 24 }}>
          <Text
            style={{ fontSize: 16, fontWeight: '600', color: colors.darkGray, marginBottom: 8 }}
          >
            Rides Completed Today: {earnings?.ridesCompleted}
          </Text>
        </View>

        {/* Recent Rides */}
        <Text style={{ fontSize: 16, fontWeight: '600', color: colors.darkGray, marginBottom: 12 }}>
          Today's Rides
        </Text>

        {earnings?.rides && earnings.rides.length > 0 ? (
          earnings.rides.map(ride => (
            <View
              key={ride.id}
              style={{
                marginBottom: 12,
                padding: 12,
                backgroundColor: '#F5F5F5',
                borderRadius: 8,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, color: colors.lightGray, marginBottom: 4 }}>
                    {new Date(ride.date).toLocaleTimeString()}
                  </Text>
                  <Text style={{ fontSize: 13, color: colors.darkGray, marginBottom: 2 }}>
                    From: {ride.pickupAddress}
                  </Text>
                  <Text style={{ fontSize: 13, color: colors.darkGray }}>
                    To: {ride.destinationAddress}
                  </Text>
                </View>
                <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.primary }}>
                  ${ride.fare.toFixed(2)}
                </Text>
              </View>
            </View>
          ))
        ) : (
          <Text style={{ color: colors.lightGray, textAlign: 'center', paddingVertical: 20 }}>
            No rides completed today
          </Text>
        )}
      </View>
    </ScrollView>
  );
}
