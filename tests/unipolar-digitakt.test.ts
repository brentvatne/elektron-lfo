/**
 * Expectation-based tests for EXP and RMP waveforms.
 *
 * Based on Digitakt II hardware verification, these waveforms should behave as:
 *
 * EXP (Exponential):
 * - DECAY curve: starts at 1 (peak), decays toward 0 (center)
 * - Unipolar output range: 0 to 1
 * - With positive depth: CC goes from (64+depth) down to 64
 * - Shape: Fast initial decay, slowing toward the end
 *
 * RMP (Ramp):
 * - RISE curve: starts at 0 (center), rises toward 1 (peak)
 * - Unipolar output range: 0 to 1
 * - With positive depth: CC goes from 64 up to (64+depth)
 * - Shape: Linear rise
 */

import { describe, test, expect } from 'bun:test';
import { generateExponential, generateRamp } from '../src/engine/waveforms';
import { LFO } from '../src/engine/lfo';

// Helper to convert LFO output to CC value
const outputToCC = (output: number): number => {
  return Math.max(0, Math.min(127, Math.round(64 + output * 63)));
};

describe('EXP Waveform - Expected Behavior', () => {
  describe('raw waveform generator', () => {
    test('should return 1.0 at phase 0 (starts at peak)', () => {
      expect(generateExponential(0)).toBeCloseTo(1.0, 2);
    });

    test('should return value < 0.5 at phase 0.5 (decaying)', () => {
      const value = generateExponential(0.5);
      expect(value).toBeLessThan(0.5);
      expect(value).toBeGreaterThan(0);
    });

    test('should return value near 0 at phase 1 (decayed to center)', () => {
      expect(generateExponential(1)).toBeLessThan(0.1);
    });

    test('should monotonically decrease from phase 0 to 1', () => {
      const phases = [0, 0.2, 0.4, 0.6, 0.8, 1.0];
      const values = phases.map(p => generateExponential(p));

      for (let i = 1; i < values.length; i++) {
        expect(values[i]).toBeLessThan(values[i - 1]);
      }
    });

    test('should be unipolar (output range 0 to 1)', () => {
      for (let i = 0; i <= 100; i++) {
        const value = generateExponential(i / 100);
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('full LFO with depth=40', () => {
    const BPM = 120;
    const DEPTH = 40;

    test('should produce CC near 104 at phase 0 (start at peak)', () => {
      const lfo = new LFO({
        waveform: 'EXP',
        speed: 16,
        multiplier: 4,
        depth: DEPTH,
        startPhase: 0,
        mode: 'TRG',
      }, BPM);

      lfo.trigger();
      const state = lfo.update(1);
      const cc = outputToCC(state.output);

      // At phase 0, EXP should be at peak: CC = 64 + 40 = 104
      expect(cc).toBeGreaterThan(100);
      expect(cc).toBeLessThanOrEqual(104);
    });

    test('should produce CC near 64 at phase 1 (end at center)', () => {
      const lfo = new LFO({
        waveform: 'EXP',
        speed: 16,
        multiplier: 4,
        depth: DEPTH,
        startPhase: 0,
        mode: 'TRG',
      }, BPM);

      lfo.trigger();
      // First update to set initial time (deltaMs=0 on first call)
      lfo.update(1);
      // Update to near end of cycle
      const cycleMs = 4000;
      const state = lfo.update(1 + cycleMs * 0.99);
      const cc = outputToCC(state.output);

      // At phase ~1, EXP should be near center: CC ≈ 64
      expect(cc).toBeGreaterThanOrEqual(64);
      expect(cc).toBeLessThan(75);
    });

    test('CC should decrease over time (decay behavior)', () => {
      const lfo = new LFO({
        waveform: 'EXP',
        speed: 16,
        multiplier: 4,
        depth: DEPTH,
        startPhase: 0,
        mode: 'TRG',
      }, BPM);

      lfo.trigger();
      const cycleMs = 4000;

      const ccStart = outputToCC(lfo.update(1).output);
      const ccMid = outputToCC(lfo.update(1 + cycleMs * 0.5).output);
      const ccEnd = outputToCC(lfo.update(1 + cycleMs * 0.99).output);

      expect(ccStart).toBeGreaterThan(ccMid);
      expect(ccMid).toBeGreaterThan(ccEnd);
    });
  });
});

describe('RMP Waveform - Expected Behavior', () => {
  describe('raw waveform generator', () => {
    test('should return 0 at phase 0 (starts at center)', () => {
      expect(generateRamp(0)).toBe(0);
    });

    test('should return 0.5 at phase 0.5 (linear rise)', () => {
      expect(generateRamp(0.5)).toBe(0.5);
    });

    test('should return 1.0 at phase 1 (ends at peak)', () => {
      expect(generateRamp(1)).toBe(1);
    });

    test('should rise linearly from phase 0 to 1', () => {
      for (let i = 0; i <= 100; i++) {
        const phase = i / 100;
        expect(generateRamp(phase)).toBeCloseTo(phase, 5);
      }
    });

    test('should be unipolar (output range 0 to 1)', () => {
      for (let i = 0; i <= 100; i++) {
        const value = generateRamp(i / 100);
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('full LFO with depth=40', () => {
    const BPM = 120;
    const DEPTH = 40;

    test('should produce CC near 64 at phase 0 (start at center)', () => {
      const lfo = new LFO({
        waveform: 'RMP',
        speed: 16,
        multiplier: 4,
        depth: DEPTH,
        startPhase: 0,
        mode: 'TRG',
      }, BPM);

      lfo.trigger();
      const state = lfo.update(1);
      const cc = outputToCC(state.output);

      // At phase 0, RMP should be at center: CC = 64
      expect(cc).toBe(64);
    });

    test('should produce CC near 104 at phase 1 (end at peak)', () => {
      const lfo = new LFO({
        waveform: 'RMP',
        speed: 16,
        multiplier: 4,
        depth: DEPTH,
        startPhase: 0,
        mode: 'TRG',
      }, BPM);

      lfo.trigger();
      // First update to set initial time (deltaMs=0 on first call)
      lfo.update(1);
      const cycleMs = 4000;
      const state = lfo.update(1 + cycleMs * 0.99);
      const cc = outputToCC(state.output);

      // At phase ~1, RMP should be at peak: CC = 64 + 40 = 104
      expect(cc).toBeGreaterThan(100);
      expect(cc).toBeLessThanOrEqual(104);
    });

    test('CC should increase over time (rise behavior)', () => {
      const lfo = new LFO({
        waveform: 'RMP',
        speed: 16,
        multiplier: 4,
        depth: DEPTH,
        startPhase: 0,
        mode: 'TRG',
      }, BPM);

      lfo.trigger();
      const cycleMs = 4000;

      const ccStart = outputToCC(lfo.update(1).output);
      const ccMid = outputToCC(lfo.update(1 + cycleMs * 0.5).output);
      const ccEnd = outputToCC(lfo.update(1 + cycleMs * 0.99).output);

      expect(ccStart).toBeLessThan(ccMid);
      expect(ccMid).toBeLessThan(ccEnd);
    });

    test('should produce CC range [64-104] over full cycle', () => {
      const lfo = new LFO({
        waveform: 'RMP',
        speed: 16,
        multiplier: 4,
        depth: DEPTH,
        startPhase: 0,
        mode: 'TRG',
      }, BPM);

      lfo.trigger();
      const cycleMs = 4000;
      let minCC = 127, maxCC = 0;

      for (let i = 0; i <= 100; i++) {
        const state = lfo.update(1 + (i / 100) * cycleMs);
        const cc = outputToCC(state.output);
        minCC = Math.min(minCC, cc);
        maxCC = Math.max(maxCC, cc);
      }

      expect(minCC).toBe(64);
      expect(maxCC).toBeGreaterThanOrEqual(103);
      expect(maxCC).toBeLessThanOrEqual(104);
    });
  });
});

describe('Depth Scaling Comparison', () => {
  const BPM = 120;
  const DEPTH = 40;

  test('TRI (bipolar) should swing ±40 from center [24-104]', () => {
    const lfo = new LFO({
      waveform: 'TRI',
      speed: 16,
      multiplier: 4,
      depth: DEPTH,
      startPhase: 0,
      mode: 'TRG',
    }, BPM);

    lfo.trigger();
    const cycleMs = 4000;
    let minCC = 127, maxCC = 0;

    for (let i = 0; i <= 100; i++) {
      const state = lfo.update(1 + (i / 100) * cycleMs);
      const cc = outputToCC(state.output);
      minCC = Math.min(minCC, cc);
      maxCC = Math.max(maxCC, cc);
    }

    // Bipolar: 64 - 40 = 24, 64 + 40 = 104
    expect(minCC).toBe(24);
    expect(maxCC).toBe(104);
  });

  test('RMP (unipolar) should swing +40 from center [64-104]', () => {
    const lfo = new LFO({
      waveform: 'RMP',
      speed: 16,
      multiplier: 4,
      depth: DEPTH,
      startPhase: 0,
      mode: 'TRG',
    }, BPM);

    lfo.trigger();
    const cycleMs = 4000;
    let minCC = 127, maxCC = 0;

    for (let i = 0; i <= 100; i++) {
      const state = lfo.update(1 + (i / 100) * cycleMs);
      const cc = outputToCC(state.output);
      minCC = Math.min(minCC, cc);
      maxCC = Math.max(maxCC, cc);
    }

    // Unipolar rising: 64 to 64 + 40 = 104
    expect(minCC).toBe(64);
    expect(maxCC).toBeGreaterThanOrEqual(103);
  });

  test('EXP (unipolar) should swing +40 from center [64-104]', () => {
    const lfo = new LFO({
      waveform: 'EXP',
      speed: 16,
      multiplier: 4,
      depth: DEPTH,
      startPhase: 0,
      mode: 'TRG',
    }, BPM);

    lfo.trigger();
    const cycleMs = 4000;
    let minCC = 127, maxCC = 0;

    for (let i = 0; i <= 100; i++) {
      const state = lfo.update(1 + (i / 100) * cycleMs);
      const cc = outputToCC(state.output);
      minCC = Math.min(minCC, cc);
      maxCC = Math.max(maxCC, cc);
    }

    // Unipolar decay: starts at 64 + 40 = 104, decays to 64
    expect(minCC).toBeGreaterThanOrEqual(64);
    expect(minCC).toBeLessThan(70);
    expect(maxCC).toBeGreaterThanOrEqual(103);
  });
});

describe('Negative Depth', () => {
  const BPM = 120;
  const DEPTH = -40;

  test('EXP with negative depth should produce CC below center', () => {
    const lfo = new LFO({
      waveform: 'EXP',
      speed: 16,
      multiplier: 4,
      depth: DEPTH,
      startPhase: 0,
      mode: 'TRG',
    }, BPM);

    lfo.trigger();
    const state = lfo.update(1);
    const cc = outputToCC(state.output);

    // With negative depth, peak should be BELOW center: 64 - 40 = 24
    expect(cc).toBeLessThan(30);
    expect(cc).toBeGreaterThanOrEqual(24);
  });

  test('RMP with negative depth should rise toward center', () => {
    const lfo = new LFO({
      waveform: 'RMP',
      speed: 16,
      multiplier: 4,
      depth: DEPTH,
      startPhase: 0,
      mode: 'TRG',
    }, BPM);

    lfo.trigger();
    const state = lfo.update(1);
    const cc = outputToCC(state.output);

    // At phase 0, RMP should be at center
    expect(cc).toBe(64);

    // At end of cycle, should be at negative peak
    const cycleMs = 4000;
    const stateEnd = lfo.update(1 + cycleMs * 0.99);
    const ccEnd = outputToCC(stateEnd.output);

    // 64 - 40 = 24
    expect(ccEnd).toBeLessThan(30);
    expect(ccEnd).toBeGreaterThanOrEqual(24);
  });
});
