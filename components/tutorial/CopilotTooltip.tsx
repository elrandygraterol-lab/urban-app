import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Dimensions } from 'react-native';
import { useCopilot } from 'react-native-copilot';

const { width, height } = Dimensions.get('window');
const TOOLTIP_HEIGHT = 180; // Approximate height of your tooltip content
const PADDING = 16; // Padding from screen edges

const defaultLabels = {
  skip: 'Saltar',
  previous: 'Atrás',
  next: 'Siguiente',
  finish: 'Finalizar',
};

export default function CopilotTooltip() {
  return null;
}

const styles = StyleSheet.create({
  container: {
    // Eliminamos position absolute fija para que Copilot lo posicione
    width: width - 32,
    alignSelf: 'center',
    zIndex: 9999,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 6,
  },
  dotContainer: {
    width: 12,
    alignItems: 'center',
  },
  stepDot: {
    fontSize: 10,
    color: '#22c55e',
  },
  stepLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#22c55e',
    letterSpacing: 1.5,
  },
  tooltipText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#1F2937',
    fontWeight: '400',
    marginBottom: 18,
  },
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  skipButton: {
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  skipText: {
    fontSize: 13,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  navButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navButtonText: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '600',
  },
  nextButton: {
    backgroundColor: '#22c55e',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
  },
  nextButtonText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  arrow: {
    position: 'absolute',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: 'transparent',
    borderTopColor: 'transparent',
    borderWidth: 10,
  },
  arrowUp: {
    borderBottomColor: '#FFFFFF',
    top: -20,
  },
  arrowDown: {
    borderTopColor: '#FFFFFF',
    bottom: -20,
  },
});
