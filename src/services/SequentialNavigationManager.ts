/**
 * SequentialNavigationManager
 *
 * Manages two-phase navigation: pickup → destination
 * Handles automatic transition between phases and phase-specific instructions.
 *
 * Requirements: 2.5
 */

import { mapRoutingService, Location, NavigationStep, RouteResult } from './MapRoutingService';

export type NavigationPhase = 'pickup' | 'destination' | 'completed';

export interface NavigationPhaseConfig {
  phase: NavigationPhase;
  target: Location;
  instructions: NavigationStep[];
  distance: number; // in km
  duration: number; // in minutes
  eta: Date;
}

export interface SequentialNavigationState {
  currentPhase: NavigationPhase;
  pickupConfig?: NavigationPhaseConfig;
  destinationConfig?: NavigationPhaseConfig;
  currentStepIndex: number;
  isTransitioning: boolean;
}

export interface SequentialNavigationCallbacks {
  onPhaseChange?: (phase: NavigationPhase, config: NavigationPhaseConfig) => void;
  onStepChange?: (stepIndex: number, step: NavigationStep) => void;
  onTransitionStart?: (fromPhase: NavigationPhase, toPhase: NavigationPhase) => void;
  onTransitionComplete?: (phase: NavigationPhase, config: NavigationPhaseConfig) => void;
  onNavigationComplete?: () => void;
  onError?: (error: Error, phase: NavigationPhase) => void;
}

/**
 * SequentialNavigationManager
 *
 * Manages sequential navigation from current location → pickup → destination
 * Automatically transitions between phases when proximity thresholds are met
 */
export class SequentialNavigationManager {
  private state: SequentialNavigationState;
  private callbacks: SequentialNavigationCallbacks;
  private pickupLocation?: Location;
  private destinationLocation: Location;
  private proximityThreshold: number = 50; // meters - threshold for phase completion

  constructor(
    pickupLocation: Location | undefined,
    destinationLocation: Location,
    callbacks: SequentialNavigationCallbacks = {}
  ) {
    this.pickupLocation = pickupLocation;
    this.destinationLocation = destinationLocation;
    this.callbacks = callbacks;

    // Initialize state
    this.state = {
      currentPhase: pickupLocation ? 'pickup' : 'destination',
      currentStepIndex: 0,
      isTransitioning: false,
    };
  }

  /**
   * Initialize navigation by calculating routes for all phases
   */
  async initialize(currentLocation: Location): Promise<void> {
    try {
      // If we have a pickup location, calculate pickup phase first
      if (this.pickupLocation) {
        const pickupRoute = await this.calculatePhaseRoute(
          currentLocation,
          this.pickupLocation,
          'pickup'
        );

        this.state.pickupConfig = this.createPhaseConfig(
          'pickup',
          this.pickupLocation,
          pickupRoute
        );

        // Notify phase change
        this.callbacks.onPhaseChange?.('pickup', this.state.pickupConfig);
      } else {
        // No pickup, go directly to destination
        const destinationRoute = await this.calculatePhaseRoute(
          currentLocation,
          this.destinationLocation,
          'destination'
        );

        this.state.destinationConfig = this.createPhaseConfig(
          'destination',
          this.destinationLocation,
          destinationRoute
        );

        // Notify phase change
        this.callbacks.onPhaseChange?.('destination', this.state.destinationConfig);
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to initialize navigation');
      this.callbacks.onError?.(err, this.state.currentPhase);
      throw err;
    }
  }

  /**
   * Update navigation progress based on current location
   * Handles step progression and phase transitions
   */
  async updateProgress(currentLocation: Location): Promise<void> {
    if (this.state.isTransitioning) {
      return; // Don't update during transition
    }

    const currentConfig = this.getCurrentPhaseConfig();
    if (!currentConfig) {
      return;
    }

    // Find current step based on location
    const newStepIndex = this.findCurrentStep(currentLocation, currentConfig.instructions);

    // Check if step changed
    if (newStepIndex !== this.state.currentStepIndex) {
      this.state.currentStepIndex = newStepIndex;
      const currentStep = currentConfig.instructions[newStepIndex];
      if (currentStep) {
        this.callbacks.onStepChange?.(newStepIndex, currentStep);
      }
    }

    // Check if we've reached the target for current phase
    const distanceToTarget = this.calculateDistance(currentLocation, currentConfig.target);

    if (distanceToTarget <= this.proximityThreshold) {
      await this.handlePhaseCompletion(currentLocation);
    }
  }

  /**
   * Handle completion of current phase and transition to next
   */
  private async handlePhaseCompletion(currentLocation: Location): Promise<void> {
    const currentPhase = this.state.currentPhase;

    if (currentPhase === 'pickup') {
      // Transition from pickup to destination
      await this.transitionToDestination(currentLocation);
    } else if (currentPhase === 'destination') {
      // Navigation completed
      this.state.currentPhase = 'completed';
      this.callbacks.onNavigationComplete?.();
    }
  }

  /**
   * Transition from pickup phase to destination phase
   */
  private async transitionToDestination(currentLocation: Location): Promise<void> {
    try {
      this.state.isTransitioning = true;
      this.callbacks.onTransitionStart?.('pickup', 'destination');

      // Calculate route to destination
      const destinationRoute = await this.calculatePhaseRoute(
        currentLocation,
        this.destinationLocation,
        'destination'
      );

      // Create destination phase config
      this.state.destinationConfig = this.createPhaseConfig(
        'destination',
        this.destinationLocation,
        destinationRoute
      );

      // Update state
      this.state.currentPhase = 'destination';
      this.state.currentStepIndex = 0;
      this.state.isTransitioning = false;

      // Notify callbacks
      this.callbacks.onTransitionComplete?.('destination', this.state.destinationConfig);
      this.callbacks.onPhaseChange?.('destination', this.state.destinationConfig);
    } catch (error) {
      this.state.isTransitioning = false;
      const err = error instanceof Error ? error : new Error('Failed to transition to destination');
      this.callbacks.onError?.(err, 'destination');
      throw err;
    }
  }

  /**
   * Calculate route for a specific phase
   */
  private async calculatePhaseRoute(
    origin: Location,
    destination: Location,
    phase: NavigationPhase
  ): Promise<RouteResult> {
    try {
      // Use taxi-optimized routing
      const route = await mapRoutingService.calculateTaxiRoute(origin, destination);

      // Enhance instructions with phase-specific context
      if (route.steps) {
        route.steps = this.enhanceInstructionsForPhase(route.steps, phase);
      }

      return route;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(`Failed to calculate ${phase} route`);
      this.callbacks.onError?.(err, phase);
      throw err;
    }
  }

  /**
   * Enhance navigation instructions with phase-specific context
   */
  private enhanceInstructionsForPhase(
    steps: NavigationStep[],
    phase: NavigationPhase
  ): NavigationStep[] {
    return steps.map((step, index) => {
      let enhancedInstruction = step.instruction;

      // Add phase context to first instruction
      if (index === 0) {
        if (phase === 'pickup') {
          enhancedInstruction = `[To Pickup] ${step.instruction}`;
        } else if (phase === 'destination') {
          enhancedInstruction = `[To Destination] ${step.instruction}`;
        }
      }

      return {
        ...step,
        instruction: enhancedInstruction,
      };
    });
  }

  /**
   * Create phase configuration from route result
   */
  private createPhaseConfig(
    phase: NavigationPhase,
    target: Location,
    route: RouteResult
  ): NavigationPhaseConfig {
    const eta = new Date();
    eta.setMinutes(eta.getMinutes() + route.duration);

    return {
      phase,
      target,
      instructions: route.steps || [],
      distance: route.distance,
      duration: route.duration,
      eta,
    };
  }

  /**
   * Find current step based on driver's location
   */
  private findCurrentStep(currentLocation: Location, steps: NavigationStep[]): number {
    let minDistance = Infinity;
    let currentStepIndex = 0;

    steps.forEach((step, index) => {
      const distanceToStart = this.calculateDistance(currentLocation, step.startLocation);
      if (distanceToStart < minDistance) {
        minDistance = distanceToStart;
        currentStepIndex = index;
      }
    });

    return currentStepIndex;
  }

  /**
   * Calculate distance between two locations (in meters)
   */
  private calculateDistance(point1: Location, point2: Location): number {
    const R = 6371000; // Earth's radius in meters
    const dLat = this.toRadians(point2.latitude - point1.latitude);
    const dLon = this.toRadians(point2.longitude - point1.longitude);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(point1.latitude)) *
        Math.cos(this.toRadians(point2.latitude)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Convert degrees to radians
   */
  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Get current phase configuration
   */
  getCurrentPhaseConfig(): NavigationPhaseConfig | undefined {
    if (this.state.currentPhase === 'pickup') {
      return this.state.pickupConfig;
    } else if (this.state.currentPhase === 'destination') {
      return this.state.destinationConfig;
    }
    return undefined;
  }

  /**
   * Get current navigation state
   */
  getState(): SequentialNavigationState {
    return { ...this.state };
  }

  /**
   * Get current phase
   */
  getCurrentPhase(): NavigationPhase {
    return this.state.currentPhase;
  }

  /**
   * Get current step
   */
  getCurrentStep(): NavigationStep | undefined {
    const config = this.getCurrentPhaseConfig();
    if (!config) return undefined;
    return config.instructions[this.state.currentStepIndex];
  }

  /**
   * Get remaining distance for current phase (in km)
   */
  getRemainingDistance(currentLocation: Location): number {
    const config = this.getCurrentPhaseConfig();
    if (!config) return 0;

    let remaining = 0;
    const steps = config.instructions;

    // Add distance from current location to end of current step
    if (this.state.currentStepIndex < steps.length) {
      const currentStep = steps[this.state.currentStepIndex];
      const distanceToEnd = this.calculateDistance(currentLocation, currentStep.endLocation);
      remaining += distanceToEnd;
    }

    // Add all remaining steps
    for (let i = this.state.currentStepIndex + 1; i < steps.length; i++) {
      remaining += steps[i].distance;
    }

    return remaining / 1000; // convert to km
  }

  /**
   * Get remaining duration for current phase (in minutes)
   */
  getRemainingDuration(currentLocation: Location): number {
    const config = this.getCurrentPhaseConfig();
    if (!config) return 0;

    let remaining = 0;
    const steps = config.instructions;

    // Add duration from current location to end of current step
    if (this.state.currentStepIndex < steps.length) {
      const currentStep = steps[this.state.currentStepIndex];
      const distanceToEnd = this.calculateDistance(currentLocation, currentStep.endLocation);
      const stepProgress = distanceToEnd / currentStep.distance;
      remaining += currentStep.duration * stepProgress;
    }

    // Add all remaining steps
    for (let i = this.state.currentStepIndex + 1; i < steps.length; i++) {
      remaining += steps[i].duration;
    }

    return remaining / 60; // convert to minutes
  }

  /**
   * Set proximity threshold for phase completion (in meters)
   */
  setProximityThreshold(meters: number): void {
    this.proximityThreshold = meters;
  }

  /**
   * Force transition to next phase (for testing or manual control)
   */
  async forceTransition(currentLocation: Location): Promise<void> {
    await this.handlePhaseCompletion(currentLocation);
  }

  /**
   * Cancel navigation
   */
  cancel(): void {
    this.state.currentPhase = 'completed';
    this.state.pickupConfig = undefined;
    this.state.destinationConfig = undefined;
  }
}

export default SequentialNavigationManager;
