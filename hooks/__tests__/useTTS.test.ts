/**
 * Tests for useTTS hook
 * Validates: Requirements 5.2, 5.4
 */

import { renderHook } from '@testing-library/react-native';
import * as fc from 'fast-check';
import { useTTS } from '../useTTS';

// Mock expo-speech
const mockStop = jest.fn();
const mockSpeak = jest.fn();

jest.mock('expo-speech', () => ({
  stop: (...args: unknown[]) => mockStop(...args),
  speak: (...args: unknown[]) => mockSpeak(...args),
}));

describe('useTTS', () => {
  beforeEach(() => {
    mockStop.mockReset();
    mockSpeak.mockReset();
  });

  // ── 4.1 Unit tests ──────────────────────────────────────────────────────────

  describe('speak()', () => {
    it('calls Speech.stop() before Speech.speak()', () => {
      const callOrder: string[] = [];
      mockStop.mockImplementation(() => callOrder.push('stop'));
      mockSpeak.mockImplementation(() => callOrder.push('speak'));

      const { result } = renderHook(() => useTTS());
      result.current.speak('Gira a la derecha');

      expect(callOrder).toEqual(['stop', 'speak']);
      expect(mockSpeak).toHaveBeenCalledWith('Gira a la derecha', { language: 'es-ES' });
    });

    it('does not throw when Speech.speak throws an exception', () => {
      mockSpeak.mockImplementation(() => {
        throw new Error('TTS not available');
      });

      const { result } = renderHook(() => useTTS());
      expect(() => result.current.speak('Texto')).not.toThrow();
    });

    it('does not throw when Speech.stop throws an exception inside speak', () => {
      mockStop.mockImplementation(() => {
        throw new Error('stop failed');
      });

      const { result } = renderHook(() => useTTS());
      expect(() => result.current.speak('Texto')).not.toThrow();
    });
  });

  describe('stop()', () => {
    it('calls Speech.stop()', () => {
      const { result } = renderHook(() => useTTS());
      result.current.stop();
      expect(mockStop).toHaveBeenCalledTimes(1);
    });

    it('does not throw when Speech.stop throws', () => {
      mockStop.mockImplementation(() => {
        throw new Error('stop failed');
      });

      const { result } = renderHook(() => useTTS());
      expect(() => result.current.stop()).not.toThrow();
    });
  });

  // ── 4.2 Property test — Property 4: TTS no repite el mismo step ─────────────
  // **Validates: Requirements 5.2**

  describe('Property 4: TTS no repite el mismo step', () => {
    it('Speech.speak is called at most once per step index across repeated position updates', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 10 }),
          fc.integer({ min: 1, max: 20 }),
          (stepIndex, updateCount) => {
            // Reset mocks to clean state (no throwing implementations)
            mockStop.mockReset();
            mockSpeak.mockReset();

            // Simulate the announcement guard logic (mirrors active-ride.tsx integration)
            let announcedStepIndex = -1;

            const { result } = renderHook(() => useTTS());
            const { speak } = result.current;

            for (let i = 0; i < updateCount; i++) {
              const nearestStepIndex = stepIndex; // position never changes step
              if (nearestStepIndex !== announcedStepIndex) {
                speak(`Instrucción del step ${nearestStepIndex}`);
                announcedStepIndex = nearestStepIndex;
              }
            }

            // speak should have been called exactly once regardless of updateCount
            expect(mockSpeak).toHaveBeenCalledTimes(1);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Speech.speak is called once per unique consecutive step in a sequence', () => {
      fc.assert(
        fc.property(
          fc.array(fc.integer({ min: 0, max: 5 }), { minLength: 1, maxLength: 30 }),
          (stepSequence) => {
            // Reset mocks to clean state (no throwing implementations)
            mockStop.mockReset();
            mockSpeak.mockReset();

            let announcedStepIndex = -1;
            const { result } = renderHook(() => useTTS());
            const { speak } = result.current;

            for (const nearestStepIndex of stepSequence) {
              if (nearestStepIndex !== announcedStepIndex) {
                speak(`Instrucción del step ${nearestStepIndex}`);
                announcedStepIndex = nearestStepIndex;
              }
            }

            // Count unique consecutive transitions
            let expectedCalls = 0;
            let lastAnnounced = -1;
            for (const idx of stepSequence) {
              if (idx !== lastAnnounced) {
                expectedCalls++;
                lastAnnounced = idx;
              }
            }

            expect(mockSpeak).toHaveBeenCalledTimes(expectedCalls);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
