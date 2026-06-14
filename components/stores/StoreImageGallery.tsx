import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  Dimensions,
  StatusBar,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { GestureHandlerRootView, PinchGestureHandler } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { StoreImage } from '@/types/store';
import { Colors, Typography, BorderRadius, Spacing } from '@/constants/theme';
import { getOptimizedImageUrl, getDefaultBlurhash } from '@/utils/imageUtils';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const THUMBNAIL_WIDTH = 120;
const THUMBNAIL_HEIGHT = 120;
const THUMBNAIL_MARGIN = 8;

interface StoreImageGalleryProps {
  images: StoreImage[];
  initialIndex?: number;
}

export const StoreImageGallery: React.FC<StoreImageGalleryProps> = ({
  images,
  initialIndex = 0,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const fullScreenFlatListRef = useRef<FlatList>(null);

  // Sort images by display_order
  const sortedImages = [...images].sort((a, b) => a.display_order - b.display_order);

  // Handle full-screen open
  const handleOpenFullScreen = (index: number) => {
    setCurrentIndex(index);
    setIsFullScreen(true);
  };

  // Handle full-screen close
  const handleCloseFullScreen = () => {
    setIsFullScreen(false);
  };

  // Handle scroll in gallery
  const handleScroll = (event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / (THUMBNAIL_WIDTH + THUMBNAIL_MARGIN * 2));
    setCurrentIndex(index);
  };

  // Handle scroll in full-screen
  const handleFullScreenScroll = (event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / SCREEN_WIDTH);
    setCurrentIndex(index);
  };

  // Render thumbnail item
  const renderThumbnail = ({ item, index }: { item: StoreImage; index: number }) => {
    const isActive = index === currentIndex;

    return (
      <TouchableOpacity
        style={[styles.thumbnailContainer, isActive && styles.thumbnailActive]}
        onPress={() => handleOpenFullScreen(index)}
        activeOpacity={0.8}
      >
        <Image
          source={{ uri: getOptimizedImageUrl(item.image_url, 'list') }}
          style={styles.thumbnail}
          contentFit="cover"
          transition={200}
          placeholder={{ blurhash: getDefaultBlurhash() }}
          cachePolicy="memory-disk"
          priority={isActive ? 'high' : 'normal'}
        />
        {isActive && <View style={styles.activeBorder} />}
      </TouchableOpacity>
    );
  };

  // Render full-screen image with zoom
  const renderFullScreenImage = ({ item }: { item: StoreImage }) => {
    return <ZoomableImage imageUrl={item.image_url} />;
  };

  if (sortedImages.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="images-outline" size={48} color={Colors.lightGray} />
        <Text style={styles.emptyText}>No hay imágenes disponibles</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Horizontal scrollable gallery */}
      <FlatList
        ref={flatListRef}
        data={sortedImages}
        renderItem={renderThumbnail}
        keyExtractor={item => item.image_id.toString()}
        horizontal
        showsHorizontalScrollIndicator={false}
        pagingEnabled={false}
        snapToInterval={THUMBNAIL_WIDTH + THUMBNAIL_MARGIN * 2}
        decelerationRate="fast"
        contentContainerStyle={styles.galleryContent}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        initialScrollIndex={initialIndex}
        getItemLayout={(data, index) => ({
          length: THUMBNAIL_WIDTH + THUMBNAIL_MARGIN * 2,
          offset: (THUMBNAIL_WIDTH + THUMBNAIL_MARGIN * 2) * index,
          index,
        })}
      />

      {/* Image counter */}
      <View style={styles.counterContainer}>
        <Text style={styles.counterText}>
          {currentIndex + 1}/{sortedImages.length}
        </Text>
      </View>

      {/* Full-screen modal */}
      <Modal
        visible={isFullScreen}
        transparent={false}
        animationType="fade"
        onRequestClose={handleCloseFullScreen}
      >
        <GestureHandlerRootView style={styles.fullScreenContainer}>
          <StatusBar hidden={Platform.OS !== 'web'} />

          {/* Close button */}
          <TouchableOpacity
            style={styles.closeButton}
            onPress={handleCloseFullScreen}
            activeOpacity={0.8}
          >
            <Ionicons name="close" size={32} color={Colors.white} />
          </TouchableOpacity>

          {/* Full-screen image counter */}
          <View style={styles.fullScreenCounter}>
            <Text style={styles.fullScreenCounterText}>
              {currentIndex + 1} / {sortedImages.length}
            </Text>
          </View>

          {/* Swipeable full-screen images */}
          <FlatList
            ref={fullScreenFlatListRef}
            data={sortedImages}
            renderItem={renderFullScreenImage}
            keyExtractor={item => `fullscreen-${item.image_id}`}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={handleFullScreenScroll}
            scrollEventThrottle={16}
            initialScrollIndex={currentIndex}
            getItemLayout={(data, index) => ({
              length: SCREEN_WIDTH,
              offset: SCREEN_WIDTH * index,
              index,
            })}
          />
        </GestureHandlerRootView>
      </Modal>
    </View>
  );
};

// Zoomable Image Component with Pinch Gesture
const ZoomableImage: React.FC<{ imageUrl: string }> = ({ imageUrl }) => {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const onPinchEnd = () => {
    if (scale.value < 1) {
      scale.value = withSpring(1);
      savedScale.value = 1;
    } else if (scale.value > 3) {
      scale.value = withSpring(3);
      savedScale.value = 3;
    } else {
      savedScale.value = scale.value;
    }
  };

  const handleDoubleTap = () => {
    if (scale.value > 1) {
      scale.value = withTiming(1);
      savedScale.value = 1;
    } else {
      scale.value = withTiming(2);
      savedScale.value = 2;
    }
  };

  return (
    <View style={styles.fullScreenImageContainer}>
      <PinchGestureHandler
        onGestureEvent={(event: any) => {
          if (event.nativeEvent) {
            scale.value = Math.max(1, Math.min(3, event.nativeEvent.scale));
          }
        }}
        onHandlerStateChange={(e: any) => {
          if (e.nativeEvent.state === 5) onPinchEnd();
        }}
      >
        <Animated.View style={[styles.zoomableContainer, animatedStyle]}>
          <TouchableOpacity activeOpacity={1} onPress={handleDoubleTap} style={styles.imageWrapper}>
            <Image
              source={{ uri: getOptimizedImageUrl(imageUrl, 'fullscreen') }}
              style={styles.fullScreenImage}
              contentFit="contain"
              transition={200}
              placeholder={{ blurhash: getDefaultBlurhash() }}
              cachePolicy="memory-disk"
              priority="high"
            />
          </TouchableOpacity>
        </Animated.View>
      </PinchGestureHandler>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  galleryContent: {
    paddingHorizontal: Spacing.sm,
  },
  thumbnailContainer: {
    marginHorizontal: THUMBNAIL_MARGIN,
    borderRadius: BorderRadius.sm,
    overflow: 'hidden',
    position: 'relative',
  },
  thumbnail: {
    width: THUMBNAIL_WIDTH,
    height: THUMBNAIL_HEIGHT,
    backgroundColor: Colors.lightGray,
  },
  thumbnailActive: {
    borderWidth: 3,
    borderColor: Colors.primary,
  },
  activeBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 3,
    borderColor: Colors.primary,
    borderRadius: BorderRadius.sm,
  },
  counterContainer: {
    position: 'absolute',
    bottom: Spacing.sm,
    right: Spacing.md,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.sm,
  },
  counterText: {
    ...Typography.caption,
    color: Colors.white,
    fontWeight: '600',
  },
  emptyContainer: {
    height: THUMBNAIL_HEIGHT + Spacing.md * 2,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.sm,
  },
  emptyText: {
    ...Typography.bodySmall,
    color: Colors.mediumGray,
    marginTop: Spacing.sm,
  },
  fullScreenContainer: {
    flex: 1,
    backgroundColor: Colors.black,
  },
  closeButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 20,
    right: 20,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenCounter: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 20,
    left: 20,
    zIndex: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: BorderRadius.sm,
  },
  fullScreenCounterText: {
    ...Typography.body,
    color: Colors.white,
    fontWeight: '600',
  },
  fullScreenImageContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomableContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageWrapper: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
});
