/**
 * NavigationPanel Component
 *
 * Provides real-time turn-by-turn navigation for drivers.
 * Displays current instruction, distance to next maneuver, progress, and ETA.
 *
 * Requirements: 2.4
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { NavigationStep, Location } from '../../services/MapRoutingService';
import {
  SequentialNavigationManager,
  NavigationPhase,
  NavigationPhaseConfig,
} from '../../services/SequentialNavigationManager';

export interface NavigationPanelProps {
  /** Current location of the driver */
  currentLocation: Location;
  /** Destination location */
  destination: Location;
  /** Optional pickup location (for sequential navigation) */
  pickupLocation?: Location;
  /** Callback when navigation phase changes */
  onPhaseChange?: (phase: NavigationPhase) => void;
  /** Callback when route is calculated */
  onRouteCalculated?: (steps: NavigationStep[], distance: number, duration: number) => void;
}

interface NavigationState {
  currentStepIndex: number;
  steps: NavigationStep[];
  totalDistance: number; // in km
  totalDuration: number; // in minutes
  remainingDistance: number; // in km
  remainingDuration: number; // in minutes
  phase: NavigationPhase;
  eta: Date | null;
}

// NavigationInstructionGenerator is now replaced by SequentialNavigationManager

/**
 * NavigationPanel Component
 */
export const NavigationPanel: React.FC<NavigationPanelProps> = ({
  currentLocation,
  destination,
  pickupLocation,
  onPhaseChange,
  onRouteCalculated,
}) => {
  const [navigationState, setNavigationState] = useState<NavigationState>({
    currentStepIndex: 0,
    steps: [],
    totalDistance: 0,
    totalDuration: 0,
    remainingDistance: 0,
    remainingDuration: 0,
    phase: pickupLocation ? 'pickup' : 'destination',
    eta: null,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Use ref to maintain navigation manager instance
  const navigationManagerRef = useRef<SequentialNavigationManager | null>(null);

  /**
   * Initialize SequentialNavigationManager
   */
  const initializeNavigation = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Create navigation manager
      const manager = new SequentialNavigationManager(pickupLocation, destination, {
        onPhaseChange: (phase: NavigationPhase, config: NavigationPhaseConfig) => {
          console.log('[NavigationPanel] Phase changed to:', phase);

          // Update state with new phase configuration
          setNavigationState(prev => ({
            ...prev,
            phase,
            steps: config.instructions,
            totalDistance: config.distance,
            totalDuration: config.duration,
            remainingDistance: config.distance,
            remainingDuration: config.duration,
            currentStepIndex: 0,
            eta: config.eta,
          }));

          // Notify parent
          onPhaseChange?.(phase);
          onRouteCalculated?.(config.instructions, config.distance, config.duration);
        },
        onStepChange: (stepIndex: number, step: NavigationStep) => {
          console.log('[NavigationPanel] Step changed to:', stepIndex, step.instruction);
          setNavigationState(prev => ({
            ...prev,
            currentStepIndex: stepIndex,
          }));
        },
        onTransitionStart: (fromPhase: NavigationPhase, toPhase: NavigationPhase) => {
          console.log('[NavigationPanel] Transitioning from', fromPhase, 'to', toPhase);
          setIsLoading(true);
        },
        onTransitionComplete: (phase: NavigationPhase, config: NavigationPhaseConfig) => {
          console.log('[NavigationPanel] Transition complete to:', phase);
          setIsLoading(false);
        },
        onNavigationComplete: () => {
          console.log('[NavigationPanel] Navigation completed');
          setNavigationState(prev => ({
            ...prev,
            phase: 'completed',
          }));
          onPhaseChange?.('completed');
        },
        onError: (err: Error, phase: NavigationPhase) => {
          console.error('[NavigationPanel] Error in phase', phase, ':', err);
          setError(`Navigation error: ${err.message}`);
          setIsLoading(false);
        },
      });

      // Initialize the manager
      await manager.initialize(currentLocation);

      // Store manager in ref
      navigationManagerRef.current = manager;

      setIsLoading(false);
    } catch (err) {
      console.error('[NavigationPanel] Error initializing navigation:', err);
      setError('Failed to initialize navigation. Please try again.');
      setIsLoading(false);
    }
  }, [currentLocation, destination, pickupLocation, onPhaseChange, onRouteCalculated]);

  /**
   * Update navigation progress based on current location
   */
  const updateProgress = useCallback(async () => {
    const manager = navigationManagerRef.current;
    if (!manager || navigationState.phase === 'completed') {
      return;
    }

    try {
      // Update manager with current location
      await manager.updateProgress(currentLocation);

      // Get updated state from manager
      const managerState = manager.getState();
      const remainingDistance = manager.getRemainingDistance(currentLocation);
      const remainingDuration = manager.getRemainingDuration(currentLocation);

      // Calculate updated ETA
      const eta = new Date();
      eta.setMinutes(eta.getMinutes() + remainingDuration);

      // Update local state
      setNavigationState(prev => ({
        ...prev,
        currentStepIndex: managerState.currentStepIndex,
        remainingDistance,
        remainingDuration,
        eta,
      }));
    } catch (err) {
      console.error('[NavigationPanel] Error updating progress:', err);
    }
  }, [currentLocation, navigationState.phase]);

  /**
   * Initialize navigation on mount
   */
  useEffect(() => {
    initializeNavigation();

    // Cleanup on unmount
    return () => {
      if (navigationManagerRef.current) {
        navigationManagerRef.current.cancel();
        navigationManagerRef.current = null;
      }
    };
  }, [initializeNavigation]);

  /**
   * Update progress when location changes
   */
  useEffect(() => {
    if (!isLoading && navigationManagerRef.current) {
      updateProgress();
    }
  }, [currentLocation, isLoading, updateProgress]);

  /**
   * Format distance for display
   */
  const formatDistance = (distanceKm: number): string => {
    if (distanceKm < 1) {
      return `${Math.round(distanceKm * 1000)}m`;
    }
    return `${distanceKm.toFixed(1)}km`;
  };

  /**
   * Format ETA for display
   */
  const formatETA = (eta: Date | null): string => {
    if (!eta) return '--:--';
    return eta.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  /**
   * Get maneuver icon
   */
  const getManeuverIcon = (maneuver?: string): string => {
    if (!maneuver) return '→';

    const icons: Record<string, string> = {
      'turn-left': '←',
      'turn-right': '→',
      'turn-slight-left': '↖',
      'turn-slight-right': '↗',
      'turn-sharp-left': '⬅',
      'turn-sharp-right': '➡',
      'uturn-left': '↶',
      'uturn-right': '↷',
      merge: '⤴',
      'roundabout-left': '↺',
      'roundabout-right': '↻',
      straight: '↑',
    };

    return icons[maneuver] || '→';
  };

  // Loading state
  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Calculating route...</Text>
        </View>
      </View>
    );
  }

  // Error state
  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </View>
    );
  }

  // Completed state
  if (navigationState.phase === 'completed') {
    return (
      <View style={styles.container}>
        <View style={styles.completedContainer}>
          <Text style={styles.completedIcon}>✓</Text>
          <Text style={styles.completedText}>You have arrived!</Text>
        </View>
      </View>
    );
  }

  const currentStep = navigationState.steps[navigationState.currentStepIndex];
  const nextStep = navigationState.steps[navigationState.currentStepIndex + 1];
  const progress =
    navigationState.totalDistance > 0
      ? ((navigationState.totalDistance - navigationState.remainingDistance) /
          navigationState.totalDistance) *
        100
      : 0;

  return (
    <View style={styles.container}>
      {/* Phase Indicator */}
      <View style={styles.phaseContainer}>
        <Text style={styles.phaseText}>
          {navigationState.phase === 'pickup'
            ? '📍 Navigating to Pickup'
            : '🎯 Navigating to Destination'}
        </Text>
      </View>

      {/* Current Instruction */}
      {currentStep && (
        <View style={styles.currentInstructionContainer}>
          <View style={styles.maneuverContainer}>
            <Text style={styles.maneuverIcon}>{getManeuverIcon(currentStep.maneuver)}</Text>
          </View>
          <View style={styles.instructionContent}>
            <Text style={styles.instructionText}>{currentStep.instruction}</Text>
            <Text style={styles.distanceText}>
              In {formatDistance(currentStep.distance / 1000)}
            </Text>
          </View>
        </View>
      )}

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
        <View style={styles.progressInfo}>
          <Text style={styles.progressText}>
            {formatDistance(navigationState.remainingDistance)} remaining
          </Text>
          <Text style={styles.etaText}>ETA: {formatETA(navigationState.eta)}</Text>
        </View>
      </View>

      {/* Next Maneuver */}
      {nextStep && (
        <View style={styles.nextManeuverContainer}>
          <Text style={styles.nextManeuverLabel}>Then:</Text>
          <View style={styles.nextManeuverContent}>
            <Text style={styles.nextManeuverIcon}>{getManeuverIcon(nextStep.maneuver)}</Text>
            <Text style={styles.nextManeuverText} numberOfLines={1}>
              {nextStep.instruction}
            </Text>
          </View>
        </View>
      )}

      {/* Upcoming Steps */}
      <ScrollView style={styles.upcomingStepsContainer}>
        <Text style={styles.upcomingStepsLabel}>Upcoming:</Text>
        {navigationState.steps
          .slice(navigationState.currentStepIndex + 2, navigationState.currentStepIndex + 5)
          .map((step, index) => (
            <View key={index} style={styles.upcomingStep}>
              <Text style={styles.upcomingStepIcon}>{getManeuverIcon(step.maneuver)}</Text>
              <Text style={styles.upcomingStepText} numberOfLines={1}>
                {step.instruction}
              </Text>
              <Text style={styles.upcomingStepDistance}>
                {formatDistance(step.distance / 1000)}
              </Text>
            </View>
          ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#FF0000',
    textAlign: 'center',
  },
  completedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  completedIcon: {
    fontSize: 64,
    color: '#4CAF50',
    marginBottom: 16,
  },
  completedText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  phaseContainer: {
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  phaseText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1976D2',
    textAlign: 'center',
  },
  currentInstructionContainer: {
    flexDirection: 'row',
    backgroundColor: '#F5F5F5',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    alignItems: 'center',
  },
  maneuverContainer: {
    width: 60,
    height: 60,
    backgroundColor: '#2196F3',
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  maneuverIcon: {
    fontSize: 32,
    color: '#FFFFFF',
  },
  instructionContent: {
    flex: 1,
  },
  instructionText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 4,
  },
  distanceText: {
    fontSize: 14,
    color: '#666666',
  },
  progressContainer: {
    marginBottom: 16,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
  },
  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressText: {
    fontSize: 14,
    color: '#666666',
  },
  etaText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333333',
  },
  nextManeuverContainer: {
    backgroundColor: '#FFF9C4',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  nextManeuverLabel: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 4,
  },
  nextManeuverContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nextManeuverIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  nextManeuverText: {
    fontSize: 14,
    color: '#333333',
    flex: 1,
  },
  upcomingStepsContainer: {
    flex: 1,
  },
  upcomingStepsLabel: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 8,
  },
  upcomingStep: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  upcomingStepIcon: {
    fontSize: 16,
    marginRight: 8,
    width: 24,
    textAlign: 'center',
  },
  upcomingStepText: {
    flex: 1,
    fontSize: 14,
    color: '#666666',
  },
  upcomingStepDistance: {
    fontSize: 12,
    color: '#999999',
    marginLeft: 8,
  },
});

export default NavigationPanel;
