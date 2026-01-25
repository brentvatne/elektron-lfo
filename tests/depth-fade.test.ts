import { describe, test, expect } from 'bun:test';
import {
  calculateFadeMultiplier,
  calculateFadeCycles,
  updateFade,
  resetFade,
  shouldResetFadeOnTrigger,
  applyFade,
} from '../src/engine/fade';
import { LFO } from '../src/engine/lfo';
import type { LFOConfig, LFOState } from '../src/engine/types';
import { DEFAULT_CONFIG } from '../src/engine/types';

function createConfig(overrides: Partial<LFOConfig>): LFOConfig {
  return { ...DEFAULT_CONFIG, ...overrides };
}

function createState(overrides: Partial<LFOState> = {}): LFOState {
  return {
    phase: 0.5,
    output: 0.5,
    rawOutput: 0.5,
    isRunning: true,
    fadeMultiplier: 1,
    fadeProgress: 0,
    randomValue: 0.5,
    previousPhase: 0.4,
    heldOutput: 0,
    startPhaseNormalized: 0,
    cycleCount: 0,
    triggerCount: 0,
    hasTriggered: false,
    randomStep: 8,
    ...overrides,
  };
}

describe('Depth', () => {
  test('depth 0 produces 0 output', () => {
    const lfo = new LFO({ waveform: 'SIN', depth: 0 }, 120);

    lfo.update(0);
    // Run for a bit to get various waveform positions
    for (let t = 0; t < 500; t += 50) {
      const state = lfo.update(t);
      expect(state.output).toBe(0);
    }
  });

  test('depth 63 produces full output', () => {
    const lfo = new LFO({ waveform: 'SIN', depth: 63, mode: 'FRE' }, 120);

    lfo.update(0);
    let maxOutput = 0;

    // Run through a full cycle
    for (let t = 0; t < 2500; t += 10) {
      const state = lfo.update(t);
      maxOutput = Math.max(maxOutput, Math.abs(state.output));
    }

    // Should reach near 1.0 at peak
    expect(maxOutput).toBeGreaterThan(0.9);
  });

  test('depth 32 produces ~half output', () => {
    const lfo = new LFO({ waveform: 'SIN', depth: 32, mode: 'FRE' }, 120);

    lfo.update(0);
    let maxOutput = 0;

    for (let t = 0; t < 2500; t += 10) {
      const state = lfo.update(t);
      maxOutput = Math.max(maxOutput, Math.abs(state.output));
    }

    // Should be approximately 32/63 ≈ 0.5
    expect(maxOutput).toBeCloseTo(32 / 63, 1);
  });

  test('negative depth inverts output', () => {
    const lfoPos = new LFO({ waveform: 'SIN', depth: 63, startPhase: 32 }, 120);
    const lfoNeg = new LFO({ waveform: 'SIN', depth: -63, startPhase: 32 }, 120);

    lfoPos.update(0);
    lfoNeg.update(0);

    const statePos = lfoPos.update(10);
    const stateNeg = lfoNeg.update(10);

    // Should have opposite signs
    expect(statePos.output * stateNeg.output).toBeLessThan(0);
  });

  test('negative depth with unipolar waveform (EXP)', () => {
    const lfo = new LFO({ waveform: 'EXP', depth: -63, mode: 'FRE' }, 120);

    lfo.update(0);
    let minOutput = Infinity;

    for (let t = 0; t < 2500; t += 10) {
      const state = lfo.update(t);
      minOutput = Math.min(minOutput, state.output);
    }

    // EXP goes 0 to 1, with negative depth should go 0 to -1
    expect(minOutput).toBeLessThan(-0.8);
  });
});

describe('calculateFadeMultiplier', () => {
  test('returns 1 for fade = 0', () => {
    expect(calculateFadeMultiplier(0, 0)).toBe(1);
    expect(calculateFadeMultiplier(0, 0.5)).toBe(1);
    expect(calculateFadeMultiplier(0, 1)).toBe(1);
  });

  test('fade in (negative fade) increases from 0 to 1', () => {
    expect(calculateFadeMultiplier(-32, 0)).toBe(0);
    expect(calculateFadeMultiplier(-32, 0.5)).toBe(0.5);
    expect(calculateFadeMultiplier(-32, 1)).toBe(1);
  });

  test('fade out (positive fade) decreases from 1 to 0', () => {
    expect(calculateFadeMultiplier(32, 0)).toBe(1);
    expect(calculateFadeMultiplier(32, 0.5)).toBe(0.5);
    expect(calculateFadeMultiplier(32, 1)).toBe(0);
  });
});

describe('calculateFadeCycles', () => {
  test('returns 0 for fade = 0', () => {
    expect(calculateFadeCycles(0)).toBe(0);
  });

  test('calculates cycles based on fade value (empirical formula from Digitakt II)', () => {
    // Based on Digitakt II hardware testing (January 2025):
    // - Higher |FADE| = SLOWER fade (more cycles)
    // - NO disabled threshold - even extreme values fade, just slowly

    // Linear region (|FADE| <= 16): 0.1 * |FADE| + 0.6
    expect(calculateFadeCycles(4)).toBeCloseTo(1.0, 1);    // ~1 cycle
    expect(calculateFadeCycles(-4)).toBeCloseTo(1.0, 1);
    expect(calculateFadeCycles(8)).toBeCloseTo(1.4, 1);    // ~1.4 cycles
    expect(calculateFadeCycles(-8)).toBeCloseTo(1.4, 1);
    expect(calculateFadeCycles(16)).toBeCloseTo(2.2, 1);   // ~2.2 cycles
    expect(calculateFadeCycles(-16)).toBeCloseTo(2.2, 1);

    // Exponential region (|FADE| > 16): 2.2 * 2^((|FADE| - 16) / 4.5)
    expect(calculateFadeCycles(24)).toBeCloseTo(7.5, 0);   // ~7-8 cycles
    expect(calculateFadeCycles(-24)).toBeCloseTo(7.5, 0);
    expect(calculateFadeCycles(32)).toBeCloseTo(26, 0);    // ~26 cycles
    expect(calculateFadeCycles(-32)).toBeCloseTo(26, 0);

    // Extreme values - NOT disabled, just very slow
    // Using loose precision since exact values are less critical at extremes
    const fade40 = calculateFadeCycles(40);
    const fade48 = calculateFadeCycles(48);
    const fade56 = calculateFadeCycles(56);
    const fade63 = calculateFadeCycles(63);

    expect(fade40).toBeGreaterThan(70);
    expect(fade40).toBeLessThan(120);      // ~90 cycles
    expect(fade48).toBeGreaterThan(250);
    expect(fade48).toBeLessThan(400);      // ~300 cycles
    expect(fade56).toBeGreaterThan(800);
    expect(fade56).toBeLessThan(1400);     // ~1000 cycles
    expect(fade63).toBeGreaterThan(2500);
    expect(fade63).toBeLessThan(4000);     // ~3000 cycles
  });

  test('is symmetric for positive and negative fade values', () => {
    expect(calculateFadeCycles(-16)).toBe(calculateFadeCycles(16));
    expect(calculateFadeCycles(-32)).toBe(calculateFadeCycles(32));
    expect(calculateFadeCycles(-48)).toBe(calculateFadeCycles(48));
  });

  test('extreme fade values return finite (large) cycle counts', () => {
    // Verify no Infinity values - Digitakt continues fading even at extremes
    expect(isFinite(calculateFadeCycles(48))).toBe(true);
    expect(isFinite(calculateFadeCycles(63))).toBe(true);
    expect(isFinite(calculateFadeCycles(-64))).toBe(true);
  });
});

describe('updateFade', () => {
  test('returns full fade for fade = 0', () => {
    const config = createConfig({ fade: 0 });
    const state = createState();

    const result = updateFade(config, state, 2000, 100);
    expect(result.fadeMultiplier).toBe(1);
    expect(result.fadeProgress).toBe(1);
  });

  test('does not update fade in FRE mode', () => {
    const config = createConfig({ fade: -32, mode: 'FRE' });
    const state = createState({ fadeProgress: 0.5 });

    const result = updateFade(config, state, 2000, 100);
    expect(result.fadeMultiplier).toBe(1);
    expect(result.fadeProgress).toBe(1);
  });

  test('progresses fade over time', () => {
    // fade=-16 takes ~2.2 cycles (based on new empirical formula)
    const config = createConfig({ fade: -16, mode: 'TRG' });
    const state = createState({ fadeProgress: 0 });
    const cycleTimeMs = 1000;

    // Fade duration = ~2.2 cycles * 1000ms = ~2200ms
    // After 1000ms (~45% of fade), progress should be ~0.45
    const result = updateFade(config, state, cycleTimeMs, 1000);
    expect(result.fadeProgress).toBeCloseTo(0.45, 1);
    expect(result.fadeMultiplier).toBeCloseTo(0.45, 1);
  });

  test('extreme fade values still progress, just very slowly', () => {
    // fade=-64 takes ~3500+ cycles - NOT disabled, just very slow
    const config = createConfig({ fade: -64, mode: 'TRG' });
    const state = createState({ fadeProgress: 0 });
    const cycleTimeMs = 1000;

    // After 1000ms (1 cycle), progress should be 1/3500 = ~0.0003
    const result = updateFade(config, state, cycleTimeMs, 1000);
    expect(result.fadeProgress).toBeGreaterThan(0);
    expect(result.fadeProgress).toBeLessThan(0.01);
    expect(result.fadeMultiplier).toBeGreaterThan(0);
  });
});

describe('resetFade', () => {
  test('resets fade in to 0', () => {
    const config = createConfig({ fade: -32 });
    const result = resetFade(config);
    expect(result.fadeProgress).toBe(0);
    expect(result.fadeMultiplier).toBe(0);
  });

  test('resets fade out to 1', () => {
    const config = createConfig({ fade: 32 });
    const result = resetFade(config);
    expect(result.fadeProgress).toBe(0);
    expect(result.fadeMultiplier).toBe(1);
  });

  test('returns 1 for no fade', () => {
    const config = createConfig({ fade: 0 });
    const result = resetFade(config);
    expect(result.fadeProgress).toBe(1);
    expect(result.fadeMultiplier).toBe(1);
  });
});

describe('shouldResetFadeOnTrigger', () => {
  test('returns true for all modes except FRE', () => {
    expect(shouldResetFadeOnTrigger('TRG')).toBe(true);
    expect(shouldResetFadeOnTrigger('ONE')).toBe(true);
    expect(shouldResetFadeOnTrigger('HLF')).toBe(true);
    expect(shouldResetFadeOnTrigger('HLD')).toBe(true);
  });

  test('returns false for FRE', () => {
    expect(shouldResetFadeOnTrigger('FRE')).toBe(false);
  });
});

describe('applyFade', () => {
  test('scales output by fade multiplier', () => {
    expect(applyFade(1, 1)).toBe(1);
    expect(applyFade(1, 0.5)).toBe(0.5);
    expect(applyFade(1, 0)).toBe(0);
    expect(applyFade(-1, 0.5)).toBe(-0.5);
  });
});

describe('Fade with LFO integration', () => {
  test('fade in starts at 0 output and increases', () => {
    const lfo = new LFO({
      waveform: 'SIN',
      depth: 63,
      fade: -16, // Fade in over ~2.2 cycles
      mode: 'TRG',
    }, 120);

    lfo.trigger();
    lfo.update(0);

    const state1 = lfo.update(100);
    expect(Math.abs(state1.output)).toBeLessThan(0.2); // Start near 0

    // Fade takes ~2.2 cycles = ~4400ms at 2000ms/cycle
    // After more time, output should increase significantly
    let maxOutput = 0;
    for (let t = 100; t < 6000; t += 100) {
      const state = lfo.update(t);
      maxOutput = Math.max(maxOutput, Math.abs(state.output));
    }
    expect(maxOutput).toBeGreaterThan(0.5);
  });

  test('extreme fade values progress very slowly but are not disabled', () => {
    const lfo = new LFO({
      waveform: 'SIN',
      depth: 63,
      fade: -64, // Very slow fade (~3500 cycles), NOT disabled
      mode: 'TRG',
    }, 120);

    lfo.trigger();
    lfo.update(0);

    // With extreme fade, output starts near 0 and increases VERY slowly
    // After 10 seconds (~5 cycles), fade is only 5/3500 = 0.14% complete
    let maxOutput = 0;
    for (let t = 100; t < 10000; t += 100) {
      const state = lfo.update(t);
      maxOutput = Math.max(maxOutput, Math.abs(state.output));
    }
    // Should have some tiny output (not zero) since fade is progressing
    expect(maxOutput).toBeGreaterThan(0);
    expect(maxOutput).toBeLessThan(0.05); // But still very small
  });

  test('fade out starts at full output and decreases', () => {
    const lfo = new LFO({
      waveform: 'SIN',
      depth: 63,
      fade: 16, // Fade out over ~2.2 cycles
      mode: 'TRG',
      startPhase: 32, // Start at peak
    }, 120);

    lfo.trigger();
    lfo.update(0);

    const state1 = lfo.update(10);
    // Should start near full output (at SIN peak)
    expect(Math.abs(state1.output)).toBeGreaterThan(0.8);

    // Fade takes ~2.2 cycles = ~4400ms at 2000ms/cycle
    // After fade completes, output should be near 0
    let lastOutput = 0;
    for (let t = 10; t < 6000; t += 100) {
      const state = lfo.update(t);
      lastOutput = Math.abs(state.output);
    }
    expect(lastOutput).toBeLessThan(0.2);
  });

  test('fade resets on trigger for TRG mode', () => {
    const lfo = new LFO({
      waveform: 'SIN',
      fade: -16, // Use non-disabled fade value
      mode: 'TRG',
    }, 120);

    lfo.trigger();
    lfo.update(0);

    // Let fade progress
    for (let t = 0; t < 1500; t += 100) {
      lfo.update(t);
    }

    // Trigger again
    lfo.trigger();
    const stateAfterTrigger = lfo.update(1600);

    // Fade should have reset (multiplier back to 0 for fade in)
    expect(stateAfterTrigger.fadeMultiplier).toBeLessThan(0.2);
  });

  test('fade does not work in FRE mode', () => {
    const lfo = new LFO({
      waveform: 'SIN',
      depth: 63,
      fade: -64, // Would be fade in
      mode: 'FRE',
      startPhase: 32,
    }, 120);

    lfo.update(0);
    const state = lfo.update(10);

    // In FRE mode, fade is always 1 (full output immediately)
    expect(state.fadeMultiplier).toBe(1);
  });
});
