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

  test('calculates cycles based on fade value (128/|FADE|)', () => {
    // Higher |FADE| = faster fade (fewer cycles)
    expect(calculateFadeCycles(64)).toBe(2);   // 128/64 = 2 cycles
    expect(calculateFadeCycles(-64)).toBe(2);
    expect(calculateFadeCycles(32)).toBe(4);   // 128/32 = 4 cycles
    expect(calculateFadeCycles(-32)).toBe(4);
    expect(calculateFadeCycles(16)).toBe(8);   // 128/16 = 8 cycles
    expect(calculateFadeCycles(-16)).toBe(8);
    expect(calculateFadeCycles(1)).toBe(128);  // 128/1 = 128 cycles (slowest)
    expect(calculateFadeCycles(-1)).toBe(128);
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
    // fade=-64 takes 128/64 = 2 cycles
    const config = createConfig({ fade: -64, mode: 'TRG' });
    const state = createState({ fadeProgress: 0 });
    const cycleTimeMs = 2000;

    // Fade duration = 2 cycles * 2000ms = 4000ms
    // After 1000ms (1/4 of fade), progress should be ~0.25
    const result = updateFade(config, state, cycleTimeMs, 1000);
    expect(result.fadeProgress).toBeCloseTo(0.25, 1);
    expect(result.fadeMultiplier).toBeCloseTo(0.25, 1);
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
      fade: -64, // Fade in over 2 cycles (128/64)
      mode: 'TRG',
    }, 120);

    lfo.trigger();
    lfo.update(0);

    const state1 = lfo.update(100);
    expect(Math.abs(state1.output)).toBeLessThan(0.1); // Start near 0

    // Fade takes 2 cycles = 4000ms at 2000ms/cycle
    // After more time, output should increase significantly
    let maxOutput = 0;
    for (let t = 100; t < 5000; t += 100) {
      const state = lfo.update(t);
      maxOutput = Math.max(maxOutput, Math.abs(state.output));
    }
    expect(maxOutput).toBeGreaterThan(0.5);
  });

  test('fade out starts at full output and decreases', () => {
    const lfo = new LFO({
      waveform: 'SIN',
      depth: 63,
      fade: 64, // Fade out over 2 cycles (128/64)
      mode: 'TRG',
      startPhase: 32, // Start at peak
    }, 120);

    lfo.trigger();
    lfo.update(0);

    const state1 = lfo.update(10);
    // Should start near full output (at SIN peak)
    expect(Math.abs(state1.output)).toBeGreaterThan(0.8);

    // Fade takes 2 cycles = 4000ms at 2000ms/cycle
    // After fade completes, output should be near 0
    let lastOutput = 0;
    for (let t = 10; t < 5000; t += 100) {
      const state = lfo.update(t);
      lastOutput = Math.abs(state.output);
    }
    expect(lastOutput).toBeLessThan(0.2);
  });

  test('fade resets on trigger for TRG mode', () => {
    const lfo = new LFO({
      waveform: 'SIN',
      fade: -64,
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
