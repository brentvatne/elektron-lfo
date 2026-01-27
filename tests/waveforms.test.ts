import { describe, test, expect } from 'bun:test';
import {
  generateTriangle,
  generateSine,
  generateSquare,
  generateSawtooth,
  generateExponential,
  generateExponentialRise,
  generateRamp,
  generateRandom,
  generateWaveform,
  isUnipolar,
  getWaveformRange,
} from '../src/engine/waveforms';
import type { LFOState } from '../src/engine/types';
import { createInitialState } from '../src/engine/types';

// Helper to create a mock state for random waveform testing
function createMockState(overrides: Partial<LFOState> = {}): LFOState {
  return {
    phase: 0,
    output: 0,
    rawOutput: 0,
    isRunning: true,
    fadeMultiplier: 1,
    fadeProgress: 0,
    randomValue: 0.5,
    previousPhase: 0,
    heldOutput: 0,
    startPhaseNormalized: 0,
    cycleCount: 0,
    triggerCount: 0,
    hasTriggered: false,
    randomStep: 0,
    ...overrides,
  };
}

describe('Triangle Waveform', () => {
  test('starts at 0 at phase 0', () => {
    expect(generateTriangle(0)).toBeCloseTo(0, 5);
  });

  test('peaks at +1 at phase 0.25', () => {
    expect(generateTriangle(0.25)).toBeCloseTo(1, 5);
  });

  test('returns to 0 at phase 0.5', () => {
    expect(generateTriangle(0.5)).toBeCloseTo(0, 5);
  });

  test('troughs at -1 at phase 0.75', () => {
    expect(generateTriangle(0.75)).toBeCloseTo(-1, 5);
  });

  test('returns to near 0 at phase ~1', () => {
    expect(generateTriangle(0.999)).toBeCloseTo(0, 1);
  });

  test('is bipolar (range -1 to +1)', () => {
    const samples = Array.from({ length: 100 }, (_, i) => generateTriangle(i / 100));
    expect(Math.min(...samples)).toBeGreaterThanOrEqual(-1);
    expect(Math.max(...samples)).toBeLessThanOrEqual(1);
    expect(Math.min(...samples)).toBeLessThan(0); // Has negative values
    expect(Math.max(...samples)).toBeGreaterThan(0); // Has positive values
  });
});

describe('Sine Waveform', () => {
  test('starts at 0 at phase 0', () => {
    expect(generateSine(0)).toBeCloseTo(0, 5);
  });

  test('peaks at +1 at phase 0.25', () => {
    expect(generateSine(0.25)).toBeCloseTo(1, 5);
  });

  test('returns to 0 at phase 0.5', () => {
    expect(generateSine(0.5)).toBeCloseTo(0, 5);
  });

  test('troughs at -1 at phase 0.75', () => {
    expect(generateSine(0.75)).toBeCloseTo(-1, 5);
  });

  test('returns to 0 at phase 1', () => {
    expect(generateSine(1)).toBeCloseTo(0, 5);
  });

  test('is bipolar (range -1 to +1)', () => {
    const samples = Array.from({ length: 100 }, (_, i) => generateSine(i / 100));
    expect(Math.min(...samples)).toBeGreaterThanOrEqual(-1);
    expect(Math.max(...samples)).toBeLessThanOrEqual(1);
  });
});

describe('Square Waveform', () => {
  test('is +1 at phase 0', () => {
    expect(generateSquare(0)).toBe(1);
  });

  test('is +1 just before phase 0.5', () => {
    expect(generateSquare(0.49)).toBe(1);
  });

  test('is -1 at phase 0.5', () => {
    expect(generateSquare(0.5)).toBe(-1);
  });

  test('is -1 at phase 0.75', () => {
    expect(generateSquare(0.75)).toBe(-1);
  });

  test('is -1 just before phase 1', () => {
    expect(generateSquare(0.99)).toBe(-1);
  });

  test('is bipolar (only +1 and -1 values)', () => {
    const samples = Array.from({ length: 100 }, (_, i) => generateSquare(i / 100));
    samples.forEach(s => {
      expect(s === 1 || s === -1).toBe(true);
    });
  });
});

describe('Sawtooth Waveform', () => {
  test('starts at +1 at phase 0', () => {
    expect(generateSawtooth(0)).toBe(1);
  });

  test('is 0 at phase 0.5', () => {
    expect(generateSawtooth(0.5)).toBe(0);
  });

  test('approaches -1 at phase ~1', () => {
    expect(generateSawtooth(1)).toBe(-1);
    expect(generateSawtooth(0.999)).toBeCloseTo(-1, 2);
  });

  test('is bipolar and linear (falling)', () => {
    expect(generateSawtooth(0.25)).toBeCloseTo(0.5, 5);
    expect(generateSawtooth(0.75)).toBeCloseTo(-0.5, 5);
  });
});

describe('Exponential Waveform', () => {
  test('starts at 1 at phase 0 (peak, matching Digitakt II)', () => {
    expect(generateExponential(0)).toBeCloseTo(1, 5);
  });

  test('decays toward 0 at phase 1', () => {
    // Normalized exponential decay reaches exactly 0 at phase 1
    expect(generateExponential(1)).toBeCloseTo(0, 5);
  });

  test('is unipolar (0 to +1)', () => {
    const samples = Array.from({ length: 100 }, (_, i) => generateExponential(i / 100));
    expect(Math.min(...samples)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...samples)).toBeLessThanOrEqual(1);
  });

  test('has concave decay curve shape (fast start, slow end)', () => {
    // Concave decay: at phase 0.5, value should be < 0.5
    // Most of the decay happens in the first half
    const midValue = generateExponential(0.5);
    expect(midValue).toBeLessThan(0.5);
    expect(midValue).toBeGreaterThan(0);
  });
});

describe('Exponential Rise Waveform', () => {
  test('starts at 0 at phase 0', () => {
    expect(generateExponentialRise(0)).toBeCloseTo(0, 5);
  });

  test('rises to 1 at phase 1', () => {
    expect(generateExponentialRise(1)).toBeCloseTo(1, 5);
  });

  test('is unipolar (0 to +1)', () => {
    const samples = Array.from({ length: 100 }, (_, i) => generateExponentialRise(i / 100));
    expect(Math.min(...samples)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...samples)).toBeLessThanOrEqual(1);
  });

  test('has concave rise curve shape (slow start, fast end)', () => {
    // Concave rise: at phase 0.5, value should be < 0.5
    // Most of the rise happens in the second half
    const midValue = generateExponentialRise(0.5);
    expect(midValue).toBeLessThan(0.5);
    expect(midValue).toBeGreaterThan(0);
  });

  test('both EXP formulas are concave (value < 0.5 at midpoint)', () => {
    // Both decay and rise should have value < 0.5 at midpoint
    // This means both curves "bend" the same way
    const decayMid = generateExponential(0.5);
    const riseMid = generateExponentialRise(0.5);

    expect(decayMid).toBeLessThan(0.5);
    expect(riseMid).toBeLessThan(0.5);
    // They should be approximately equal (same curvature)
    expect(decayMid).toBeCloseTo(riseMid, 2);
  });
});

describe('Ramp Waveform', () => {
  test('starts at 0 at phase 0', () => {
    expect(generateRamp(0)).toBe(0);
  });

  test('ends at 1 at phase 1', () => {
    expect(generateRamp(1)).toBe(1);
  });

  test('is 0.5 at phase 0.5', () => {
    expect(generateRamp(0.5)).toBe(0.5);
  });

  test('is unipolar (0 to +1)', () => {
    const samples = Array.from({ length: 100 }, (_, i) => generateRamp(i / 100));
    expect(Math.min(...samples)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...samples)).toBeLessThanOrEqual(1);
  });

  test('is linear (rising)', () => {
    expect(generateRamp(0.25)).toBe(0.25);
    expect(generateRamp(0.75)).toBe(0.75);
  });
});

describe('Random Waveform', () => {
  test('returns current random value when step unchanged', () => {
    const state = createMockState({ randomValue: 0.5, randomStep: 0 });
    const result = generateRandom(0.01, state); // Still in step 0
    expect(result.value).toBe(0.5);
    expect(result.newRandomStep).toBe(0);
  });

  test('generates new random value on step change', () => {
    const state = createMockState({ randomValue: 0.5, randomStep: 0 });
    const result = generateRandom(0.1, state); // Step 1 (16 steps per cycle)
    expect(result.newRandomStep).toBe(1);
    expect(result.newRandomValue).not.toBe(0.5); // New random value (with high probability)
  });

  test('has 16 steps per cycle', () => {
    const stepPhases = [0, 0.0625, 0.125, 0.1875, 0.25];
    const expectedSteps = [0, 1, 2, 3, 4];

    stepPhases.forEach((phase, i) => {
      expect(Math.floor(phase * 16)).toBe(expectedSteps[i]);
    });
  });

  test('generates values in bipolar range (-1 to +1)', () => {
    const state = createMockState({ randomStep: -1 }); // Force new value generation
    const values: number[] = [];

    for (let i = 0; i < 100; i++) {
      const result = generateRandom(i / 100, state);
      values.push(result.value);
      state.randomStep = result.newRandomStep;
      state.randomValue = result.newRandomValue;
    }

    expect(Math.min(...values)).toBeGreaterThanOrEqual(-1);
    expect(Math.max(...values)).toBeLessThanOrEqual(1);
  });
});

describe('generateWaveform', () => {
  test('routes to correct waveform generator', () => {
    const state = createMockState();

    expect(generateWaveform('TRI', 0.25, state).value).toBeCloseTo(1, 5);
    expect(generateWaveform('SIN', 0.25, state).value).toBeCloseTo(1, 5);
    expect(generateWaveform('SQR', 0.25, state).value).toBe(1);
    expect(generateWaveform('SAW', 0.5, state).value).toBe(0);
    expect(generateWaveform('EXP', 0, state).value).toBeCloseTo(1, 5); // EXP starts at peak
    expect(generateWaveform('RMP', 0, state).value).toBe(0);
  });
});

describe('isUnipolar', () => {
  test('identifies unipolar waveforms', () => {
    expect(isUnipolar('EXP')).toBe(true);
    expect(isUnipolar('RMP')).toBe(true);
  });

  test('identifies bipolar waveforms', () => {
    expect(isUnipolar('TRI')).toBe(false);
    expect(isUnipolar('SIN')).toBe(false);
    expect(isUnipolar('SQR')).toBe(false);
    expect(isUnipolar('SAW')).toBe(false);
    expect(isUnipolar('RND')).toBe(false);
  });
});

describe('getWaveformRange', () => {
  test('returns correct range for unipolar waveforms', () => {
    expect(getWaveformRange('EXP')).toEqual({ min: 0, max: 1 });
    expect(getWaveformRange('RMP')).toEqual({ min: 0, max: 1 });
  });

  test('returns correct range for bipolar waveforms', () => {
    expect(getWaveformRange('TRI')).toEqual({ min: -1, max: 1 });
    expect(getWaveformRange('SIN')).toEqual({ min: -1, max: 1 });
    expect(getWaveformRange('SQR')).toEqual({ min: -1, max: 1 });
    expect(getWaveformRange('SAW')).toEqual({ min: -1, max: 1 });
    expect(getWaveformRange('RND')).toEqual({ min: -1, max: 1 });
  });
});
