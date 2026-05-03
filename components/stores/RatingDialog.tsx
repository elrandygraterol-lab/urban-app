import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, Modal, Alert } from 'react-native';
import { Colors as colors } from '@/constants/theme';
import type { StoreReview } from '@/types/store';

interface RatingDialogProps {
  visible: boolean;
  storeId: number;
  existingReview?: StoreReview;
  onSubmit: (rating: number, comment?: string) => Promise<void>;
  onCancel: () => void;
}

export default function RatingDialog({
  visible,
  storeId,
  existingReview,
  onSubmit,
  onCancel,
}: RatingDialogProps) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);

  const MAX_COMMENT_LENGTH = 500;

  // Initialize with existing review data if editing
  useEffect(() => {
    if (existingReview) {
      setRating(existingReview.rating);
      setComment(existingReview.comment || '');
    } else {
      setRating(0);
      setComment('');
    }
  }, [existingReview, visible]);

  const handleSubmit = async () => {
    // Validate rating
    if (rating === 0) {
      Alert.alert('Error', 'Por favor selecciona una calificación');
      return;
    }

    // Validate comment length
    if (comment.length > MAX_COMMENT_LENGTH) {
      Alert.alert('Error', `El comentario no puede exceder ${MAX_COMMENT_LENGTH} caracteres`);
      return;
    }

    try {
      setLoading(true);
      await onSubmit(rating, comment || undefined);
      
      // Reset form
      setRating(0);
      setComment('');
    } catch (error) {
      Alert.alert('Error', 'No se pudo enviar la calificación');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    // Reset form
    setRating(0);
    setComment('');
    onCancel();
  };

  const remainingChars = MAX_COMMENT_LENGTH - comment.length;
  const isCommentTooLong = comment.length > MAX_COMMENT_LENGTH;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleCancel}>
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
          {/* Title */}
          <Text
            style={{ 
              fontSize: 18, 
              fontWeight: 'bold', 
              color: colors.darkGray, 
              marginBottom: 8 
            }}
          >
            {existingReview ? 'Editar Calificación' : 'Calificar Tienda'}
          </Text>
          <Text style={{ fontSize: 14, color: colors.lightGray, marginBottom: 24 }}>
            {existingReview 
              ? 'Actualiza tu calificación y comentario' 
              : '¿Cómo fue tu experiencia?'}
          </Text>

          {/* Star Rating */}
          <View
            style={{ 
              flexDirection: 'row', 
              justifyContent: 'center', 
              gap: 12, 
              marginBottom: 24 
            }}
          >
            {[1, 2, 3, 4, 5].map(star => (
              <TouchableOpacity 
                key={star} 
                onPress={() => setRating(star)}
                disabled={loading}
              >
                <Text style={{ fontSize: 32 }}>
                  {star <= rating ? '⭐' : '☆'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Comment Input */}
          <TextInput
            placeholder="Agrega un comentario (opcional)"
            value={comment}
            onChangeText={setComment}
            multiline
            numberOfLines={4}
            maxLength={MAX_COMMENT_LENGTH + 50} // Allow typing a bit over to show error
            editable={!loading}
            style={{
              borderWidth: 1,
              borderColor: isCommentTooLong ? '#FF0000' : '#E0E0E0',
              borderRadius: 8,
              padding: 12,
              marginBottom: 8,
              color: colors.darkGray,
              textAlignVertical: 'top',
              minHeight: 80,
            }}
            placeholderTextColor={colors.lightGray}
          />

          {/* Character Count */}
          <Text
            style={{
              fontSize: 12,
              color: isCommentTooLong ? '#FF0000' : colors.lightGray,
              textAlign: 'right',
              marginBottom: 24,
            }}
          >
            {remainingChars} caracteres restantes
          </Text>

          {/* Buttons */}
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity
              onPress={handleCancel}
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
              <Text style={{ color: colors.primary, fontWeight: '600' }}>
                Cancelar
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={loading || rating === 0 || isCommentTooLong}
              style={{
                flex: 1,
                paddingVertical: 12,
                borderRadius: 8,
                backgroundColor: (loading || rating === 0 || isCommentTooLong) 
                  ? '#CCCCCC' 
                  : colors.primary,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '600' }}>
                {loading ? 'Enviando...' : existingReview ? 'Actualizar' : 'Enviar'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
