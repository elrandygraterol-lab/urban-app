import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, Modal, Alert } from 'react-native';
import { api } from '@/services/api';
import { Colors as colors } from '@/constants/theme';

interface RatingModalProps {
  visible: boolean;
  rideId: string;
  passengerName: string;
  isDriver?: boolean;
  onClose: () => void;
  onSubmit?: () => void;
}

export default function RatingModal({
  visible,
  rideId,
  passengerName,
  isDriver = false,
  onClose,
  onSubmit,
}: RatingModalProps) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) {
      Alert.alert('Error', 'Please select a rating');
      return;
    }

    try {
      setLoading(true);
      const endpoint = isDriver ? '/api/ratings/passenger' : '/api/ratings/driver';
      await api.post(endpoint, {
        rideId,
        rating,
        comment: comment || undefined,
      });

      Alert.alert('Success', 'Rating submitted!');
      setRating(0);
      setComment('');
      onClose();
      onSubmit?.();
    } catch (error) {
      Alert.alert('Error', 'Failed to submit rating');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 16,
        }}
      >
        <View
          style={{
            backgroundColor: '#fff',
            borderRadius: 16,
            padding: 24,
            width: '100%',
            maxWidth: 400,
          }}
        >
          <Text
            style={{ fontSize: 18, fontWeight: 'bold', color: colors.darkGray, marginBottom: 8 }}
          >
            Rate {passengerName}
          </Text>
          <Text style={{ fontSize: 14, color: colors.lightGray, marginBottom: 24 }}>
            How was your experience?
          </Text>

          {/* Star Rating */}
          <View
            style={{ flexDirection: 'row', justifyContent: 'center', gap: 12, marginBottom: 24 }}
          >
            {[1, 2, 3, 4, 5].map(star => (
              <TouchableOpacity key={star} onPress={() => setRating(star)}>
                <Text style={{ fontSize: 32 }}>{star <= rating ? '⭐' : '☆'}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Comment */}
          <TextInput
            placeholder="Add a comment (optional)"
            value={comment}
            onChangeText={setComment}
            multiline
            numberOfLines={3}
            style={{
              borderWidth: 1,
              borderColor: '#E0E0E0',
              borderRadius: 8,
              padding: 12,
              marginBottom: 24,
              color: colors.darkGray,
            }}
            placeholderTextColor={colors.lightGray}
          />

          {/* Buttons */}
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity
              onPress={onClose}
              disabled={loading}
              style={{
                flex: 1,
                paddingVertical: 12,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: colors.primary,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: colors.primary, fontWeight: '600' }}>Skip</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={loading}
              style={{
                flex: 1,
                paddingVertical: 12,
                borderRadius: 8,
                backgroundColor: colors.primary,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '600' }}>
                {loading ? 'Submitting...' : 'Submit'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
