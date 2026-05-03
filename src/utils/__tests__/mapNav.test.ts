import * as fc from 'fast-check';
import {
  haversineDistance,
  computeNearestStepIndex,
  computeNearestRouteIndex,
} from '../mapNav';

// ─── Unit tests ───────────────────────────────────────────────────────────────

describe('haversineDistance', () => {
  it('mismo punto → 0', () => {
    const p = { latitude: 40.7128, longitude: -74.006 };
    expect(haversineDistance(p, p)).toBe(0);
  });

  it('(0,0) a (1,0) → ~111195 m (±500 m)', () => {
    const a = { latitude: 0, longitude: 0 };
    const b = { latitude: 1, longitude: 0 };
    const dist = haversineDistance(a, b);
    expect(dist).toBeGreaterThan(111195 - 500);
    expect(dist).toBeLessThan(111195 + 500);
  });
});

describe('computeNearestStepIndex', () => {
  it('array vacío → 0', () => {
    expect(computeNearestStepIndex([], { latitude: 0, longitude: 0 })).toBe(0);
  });

  it('steps sin location → 0', () => {
    const steps: Array<{ location?: { latitude: number; longitude: number } }> = [{}, {}];
    expect(computeNearestStepIndex(steps, { latitude: 10, longitude: 10 })).toBe(0);
  });

  it('retorna índice del step más cercano', () => {
    const steps = [
      { location: { latitude: 0, longitude: 0 } },
      { location: { latitude: 1, longitude: 0 } },
      { location: { latitude: 5, longitude: 0 } },
    ];
    const point = { latitude: 1.1, longitude: 0 };
    expect(computeNearestStepIndex(steps, point)).toBe(1);
  });
});

// ─── Property-based tests ─────────────────────────────────────────────────────

const coordArb = fc.record({
  latitude: fc.float({ min: -90, max: 90, noNaN: true }),
  longitude: fc.float({ min: -180, max: 180, noNaN: true }),
});

/**
 * Property 6: haversineDistance es simétrica y no negativa
 * Validates: Requirements 1.6, 5.1
 */
describe('Property 6: haversineDistance es simétrica y no negativa', () => {
  it('haversineDistance(A,B) === haversineDistance(B,A) y >= 0', () => {
    fc.assert(
      fc.property(coordArb, coordArb, (a, b) => {
        const ab = haversineDistance(a, b);
        const ba = haversineDistance(b, a);
        expect(ab).toBeGreaterThanOrEqual(0);
        expect(ba).toBeGreaterThanOrEqual(0);
        expect(Math.abs(ab - ba)).toBeLessThan(1e-6);
      }),
      { numRuns: 100 }
    );
  });
});

/**
 * Property 1: Nearest step index is always in bounds
 * Validates: Requirements 1.2, 5.1
 */
describe('Property 1: Nearest step index is always in bounds', () => {
  const stepArb = fc.record({
    location: fc.option(coordArb, { nil: undefined }),
  });

  it('resultado en [0, steps.length-1] o 0 cuando vacío', () => {
    fc.assert(
      fc.property(fc.array(stepArb), coordArb, (steps, point) => {
        const idx = computeNearestStepIndex(steps, point);
        if (steps.length === 0) {
          expect(idx).toBe(0);
        } else {
          expect(idx).toBeGreaterThanOrEqual(0);
          expect(idx).toBeLessThanOrEqual(steps.length - 1);
        }
      }),
      { numRuns: 100 }
    );
  });
});

/**
 * Property 2: Nearest route index is always in bounds
 * Validates: Requirements 4.1
 */
describe('Property 2: Nearest route index is always in bounds', () => {
  it('resultado en [0, coords.length-1]', () => {
    fc.assert(
      fc.property(fc.array(coordArb, { minLength: 1 }), coordArb, (coords, point) => {
        const idx = computeNearestRouteIndex(coords, point);
        expect(idx).toBeGreaterThanOrEqual(0);
        expect(idx).toBeLessThanOrEqual(coords.length - 1);
      }),
      { numRuns: 100 }
    );
  });
});

/**
 * Property 3: Remaining polyline is a suffix of the full route
 * Validates: Requirements 4.2, 4.3
 */
describe('Property 3: Remaining polyline is a suffix of the full route', () => {
  it('routeCoordinates.slice(nearestRouteIndex) es sufijo correcto', () => {
    fc.assert(
      fc.property(fc.array(coordArb, { minLength: 1 }), coordArb, (coords, point) => {
        const nearestRouteIndex = computeNearestRouteIndex(coords, point);
        const remaining = coords.slice(nearestRouteIndex);
        // Es sufijo: la longitud es correcta
        expect(remaining.length).toBe(coords.length - nearestRouteIndex);
        // Los elementos coinciden exactamente
        for (let i = 0; i < remaining.length; i++) {
          expect(remaining[i]).toBe(coords[nearestRouteIndex + i]);
        }
      }),
      { numRuns: 100 }
    );
  });
});
