import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { api } from '@/services/api';
import { Colors as colors } from '@/constants/theme';

interface Ride {
  id: string;
  date: string;
  pickupAddress: string;
  destinationAddress: string;
  fare: number;
  distance: number;
  duration: number;
}

export default function RideHistoryScreen() {
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRideHistory();
  }, []);

  const fetchRideHistory = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/rides/history?role=driver');
      setRides(response.data);
    } catch (error) {
      Alert.alert('Error', 'Failed to load ride history');
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
          Ride History
        </Text>

        {rides.length === 0 ? (
          <Text style={{ color: colors.lightGray, textAlign: 'center', paddingVertical: 40 }}>
            No completed rides yet
          </Text>
        ) : (
          rides.map(ride => (
            <View
              key={ride.id}
              style={{
                marginBottom: 12,
                padding: 16,
                backgroundColor: '#F5F5F5',
                borderRadius: 12,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: 12,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, color: colors.lightGray, marginBottom: 4 }}>
                    {new Date(ride.date).toLocaleDateString()} at{' '}
                    {new Date(ride.date).toLocaleTimeString()}
                  </Text>
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: '600',
                      color: colors.darkGray,
                      marginBottom: 4,
                    }}
                  >
                    From: {ride.pickupAddress}
                  </Text>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.darkGray }}>
                    To: {ride.destinationAddress}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text
                    style={{
                      fontSize: 18,
                      fontWeight: 'bold',
                      color: colors.primary,
                      marginBottom: 4,
                    }}
                  >
                    ${ride.fare.toFixed(2)}
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.lightGray }}>
                    {ride.distance.toFixed(1)} km
                  </Text>
                </View>
              </View>

              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  paddingTop: 12,
                  borderTopWidth: 1,
                  borderTopColor: '#E0E0E0',
                }}
              >
                <Text style={{ fontSize: 12, color: colors.lightGray }}>
                  Duration: {Math.round(ride.duration / 60)} min
                </Text>
                <Text style={{ fontSize: 12, color: colors.lightGray }}>
                  Avg Speed: {(ride.distance / (ride.duration / 3600)).toFixed(1)} km/h
                </Text>
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}
