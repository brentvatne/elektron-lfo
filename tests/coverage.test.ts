/**
 * Additional tests for 100% coverage
 */
import { describe, test, expect } from 'bun:test';

// Core fade functions
import {
  calculateFadeProgress,
  getInitialFadeState,
} from '../src/core/fade';

// Core waveform functions
import {
  seededRandom,
  sampleRandom,
  sampleRandomWithSlew,
  sampleWaveform,
} from '../src/core/waveforms';

// Engine types
import { clamp, isValidMultiplier } from '../src/engine/types';

// Engine LFO
import { LFO } from '../src/engine/lfo';

// Engine triggers
import { handleTrigger, checkModeStop } from '../src/engine/triggers';
import type { LFOConfig, LFOState } from '../src/engine/types';
import { DEFAULT_CONFIG } from '../src/engine/types';

// Engine fade
import { updateFade } from '../src/engine/fade';

// Engine waveforms
import { generateWaveform } from '../src/engine/waveforms';

// Helper to create config
function createConfig(overrides: Partial<LFOConfig>): LFOConfig {
  return { ...DEFAULT_CONFIG, ...overrides };
}

// Helper to create state
function createState(overrides: Partial<LFOState> = {}): LFOState {
  return {
    phase: 0.5,
    output: 0.5,
    rawOutput: 0.5,
    isRunning: true,
    fadeMultiplier: 1,
    fadeProgress: 0.5,
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

describe('core/fade - calculateFadeProgress', () => {
  test('returns 1 for fadeValue = 0', () => {
    expect(calculateFadeProgress(5, 0)).toBe(1);
  });

  test('calculates progress based on elapsed cycles', () => {
    // fade=16 takes ~2.2 cycles
    const progress = calculateFadeProgress(1.1, 16);
    expect(progress).toBeCloseTo(0.5, 1);
  });

  test('clamps progress to 1 when exceeded', () => {
    // fade=4 takes ~1 cycle, so 10 cycles should clamp to 1
    expect(calculateFadeProgress(10, 4)).toBe(1);
  });

  test('handles negative fade values', () => {
    expect(calculateFadeProgress(1.1, -16)).toBeCloseTo(0.5, 1);
  });
});

describe('core/fade - getInitialFadeState', () => {
  test('returns fadeProgress=1, fadeMultiplier=1 for fade=0', () => {
    const result = getInitialFadeState(0);
    expect(result.fadeProgress).toBe(1);
    expect(result.fadeMultiplier).toBe(1);
  });

  test('returns fadeProgress=0, fadeMultiplier=0 for negative fade (fade in)', () => {
    const result = getInitialFadeState(-32);
    expect(result.fadeProgress).toBe(0);
    expect(result.fadeMultiplier).toBe(0);
  });

  test('returns fadeProgress=0, fadeMultiplier=1 for positive fade (fade out)', () => {
    const result = getInitialFadeState(32);
    expect(result.fadeProgress).toBe(0);
    expect(result.fadeMultiplier).toBe(1);
  });
});

describe('core/waveforms - seededRandom', () => {
  test('returns values in [-1, 1] range', () => {
    for (let step = 0; step < 16; step++) {
      const value = seededRandom(step, 12345);
      expect(value).toBeGreaterThanOrEqual(-1);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  test('produces deterministic results for same seed', () => {
    const value1 = seededRandom(5, 42);
    const value2 = seededRandom(5, 42);
    expect(value1).toBe(value2);
  });

  test('produces different values for different steps', () => {
    const values = new Set<number>();
    for (let step = 0; step < 16; step++) {
      values.add(seededRandom(step, 12345));
    }
    // Most values should be unique (allow some collisions)
    expect(values.size).toBeGreaterThan(10);
  });

  test('produces different values for different seeds', () => {
    const value1 = seededRandom(0, 1);
    const value2 = seededRandom(0, 2);
    expect(value1).not.toBe(value2);
  });
});

describe('core/waveforms - sampleRandom', () => {
  test('returns values in [-1, 1] range', () => {
    for (let phase = 0; phase < 1; phase += 0.1) {
      const value = sampleRandom(phase, 42);
      expect(value).toBeGreaterThanOrEqual(-1);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  test('returns same value within same step', () => {
    // Steps are 0-15, each step is 1/16 of phase
    const value1 = sampleRandom(0.01, 42);
    const value2 = sampleRandom(0.05, 42);
    expect(value1).toBe(value2); // Both in step 0
  });

  test('returns different values for different steps', () => {
    const value1 = sampleRandom(0.01, 42); // Step 0
    const value2 = sampleRandom(0.1, 42);  // Step 1
    expect(value1).not.toBe(value2);
  });
});

describe('core/waveforms - sampleRandomWithSlew', () => {
  test('returns sharp S&H when slew=0', () => {
    const value = sampleRandomWithSlew(0.5, 0, 42);
    const expected = sampleRandom(0.5, 42);
    expect(value).toBe(expected);
  });

  test('interpolates between steps when slew > 0', () => {
    // At the beginning of a step, should be closer to previous value
    // At the end of a step, should be closer to current value
    const stepStart = sampleRandomWithSlew(0.0625, 127, 42); // Just into step 1
    const stepMid = sampleRandomWithSlew(0.09375, 127, 42);  // Middle of step 1

    // Both should be valid (between -1 and 1)
    expect(stepStart).toBeGreaterThanOrEqual(-1);
    expect(stepStart).toBeLessThanOrEqual(1);
    expect(stepMid).toBeGreaterThanOrEqual(-1);
    expect(stepMid).toBeLessThanOrEqual(1);
  });

  test('handles max slew (127)', () => {
    const value = sampleRandomWithSlew(0.5, 127, 42);
    expect(value).toBeGreaterThanOrEqual(-1);
    expect(value).toBeLessThanOrEqual(1);
  });
});

describe('core/waveforms - sampleWaveform', () => {
  test('samples TRI waveform', () => {
    expect(sampleWaveform('TRI', 0)).toBe(0);
    expect(sampleWaveform('TRI', 0.25)).toBe(1);
  });

  test('samples SIN waveform', () => {
    expect(sampleWaveform('SIN', 0)).toBeCloseTo(0);
    expect(sampleWaveform('SIN', 0.25)).toBeCloseTo(1);
  });

  test('samples SQR waveform', () => {
    expect(sampleWaveform('SQR', 0.25)).toBe(1);
    expect(sampleWaveform('SQR', 0.75)).toBe(-1);
  });

  test('samples SAW waveform', () => {
    expect(sampleWaveform('SAW', 0)).toBe(1);
    expect(sampleWaveform('SAW', 1)).toBe(-1);
  });

  test('samples EXP waveform', () => {
    const start = sampleWaveform('EXP', 0);
    const end = sampleWaveform('EXP', 1);
    expect(start).toBeCloseTo(1, 1);
    expect(end).toBeCloseTo(0, 1);
  });

  test('samples RMP waveform', () => {
    expect(sampleWaveform('RMP', 0)).toBe(0);
    expect(sampleWaveform('RMP', 1)).toBe(1);
  });

  test('samples RND waveform', () => {
    const value = sampleWaveform('RND', 0.5, 42);
    expect(value).toBeGreaterThanOrEqual(-1);
    expect(value).toBeLessThanOrEqual(1);
  });
});

describe('engine/types - clamp', () => {
  test('clamps value below min', () => {
    expect(clamp(-10, 0, 100)).toBe(0);
  });

  test('clamps value above max', () => {
    expect(clamp(150, 0, 100)).toBe(100);
  });

  test('returns value within range unchanged', () => {
    expect(clamp(50, 0, 100)).toBe(50);
  });

  test('handles edge cases at boundaries', () => {
    expect(clamp(0, 0, 100)).toBe(0);
    expect(clamp(100, 0, 100)).toBe(100);
  });
});

describe('engine/types - isValidMultiplier', () => {
  test('returns true for valid multipliers', () => {
    expect(isValidMultiplier(1)).toBe(true);
    expect(isValidMultiplier(2)).toBe(true);
    expect(isValidMultiplier(4)).toBe(true);
    expect(isValidMultiplier(8)).toBe(true);
    expect(isValidMultiplier(16)).toBe(true);
    expect(isValidMultiplier(32)).toBe(true);
    expect(isValidMultiplier(64)).toBe(true);
    expect(isValidMultiplier(128)).toBe(true);
    expect(isValidMultiplier(256)).toBe(true);
    expect(isValidMultiplier(512)).toBe(true);
    expect(isValidMultiplier(1024)).toBe(true);
    expect(isValidMultiplier(2048)).toBe(true);
  });

  test('returns false for invalid multipliers', () => {
    expect(isValidMultiplier(0)).toBe(false);
    expect(isValidMultiplier(3)).toBe(false);
    expect(isValidMultiplier(5)).toBe(false);
    expect(isValidMultiplier(100)).toBe(false);
    expect(isValidMultiplier(-1)).toBe(false);
    expect(isValidMultiplier(4096)).toBe(false);
  });
});

describe('engine/lfo - additional methods', () => {
  test('getConfig returns copy of config', () => {
    const lfo = new LFO({ waveform: 'SIN', depth: 32 });
    const config = lfo.getConfig();
    expect(config.waveform).toBe('SIN');
    expect(config.depth).toBe(32);
  });

  test('setConfig updates configuration', () => {
    const lfo = new LFO({ waveform: 'TRI' });
    lfo.setConfig({ waveform: 'SAW', depth: 50 });
    const config = lfo.getConfig();
    expect(config.waveform).toBe('SAW');
    expect(config.depth).toBe(50);
  });

  test('setConfig updates startPhase normalization', () => {
    const lfo = new LFO({ startPhase: 0 });
    lfo.setConfig({ startPhase: 64 });
    const state = lfo.getState();
    expect(state.startPhaseNormalized).toBe(0.5);
  });

  test('setConfig switching to ONE mode stops LFO', () => {
    const lfo = new LFO({ mode: 'FRE' });
    lfo.update(0);
    expect(lfo.isRunning()).toBe(true);

    lfo.setConfig({ mode: 'ONE' });
    expect(lfo.isRunning()).toBe(false);
    expect(lfo.getState().hasTriggered).toBe(false);
  });

  test('setConfig switching to HLF mode stops LFO', () => {
    const lfo = new LFO({ mode: 'FRE' });
    lfo.update(0);
    expect(lfo.isRunning()).toBe(true);

    lfo.setConfig({ mode: 'HLF' });
    expect(lfo.isRunning()).toBe(false);
  });

  test('setBpm updates BPM with clamping', () => {
    const lfo = new LFO({}, 120);
    expect(lfo.getBpm()).toBe(120);

    lfo.setBpm(140);
    expect(lfo.getBpm()).toBe(140);

    lfo.setBpm(0); // Should clamp to 1
    expect(lfo.getBpm()).toBe(1);

    lfo.setBpm(9999); // Should clamp to 999
    expect(lfo.getBpm()).toBe(999);
  });

  test('getBpm returns current BPM', () => {
    const lfo = new LFO({}, 90);
    expect(lfo.getBpm()).toBe(90);
  });

  test('reset restores initial state', () => {
    const lfo = new LFO({ mode: 'TRG', startPhase: 32 });
    lfo.update(0);
    lfo.update(1000);
    lfo.trigger();

    lfo.reset();
    const state = lfo.getState();
    expect(state.phase).toBe(0.25); // startPhase 32 / 128
    expect(state.cycleCount).toBe(0);
    expect(state.triggerCount).toBe(0);
  });

  test('reset for ONE mode sets isRunning to false', () => {
    const lfo = new LFO({ mode: 'ONE' });
    lfo.trigger();
    expect(lfo.isRunning()).toBe(true);

    lfo.reset();
    expect(lfo.isRunning()).toBe(false);
  });

  test('reset for HLF mode sets isRunning to false', () => {
    const lfo = new LFO({ mode: 'HLF' });
    lfo.trigger();
    expect(lfo.isRunning()).toBe(true);

    lfo.reset();
    expect(lfo.isRunning()).toBe(false);
  });

  test('getOutput returns current output', () => {
    const lfo = new LFO({ waveform: 'SIN', depth: 63 });
    lfo.update(0);
    lfo.update(100);
    const output = lfo.getOutput();
    expect(typeof output).toBe('number');
  });

  test('getPhase returns current phase', () => {
    const lfo = new LFO({ startPhase: 64 });
    lfo.update(0);
    expect(lfo.getPhase()).toBeCloseTo(0.5, 1);
  });

  test('start sets isRunning and hasTriggered', () => {
    const lfo = new LFO({ mode: 'ONE' });
    expect(lfo.isRunning()).toBe(false);

    lfo.start();
    expect(lfo.isRunning()).toBe(true);
    expect(lfo.getState().hasTriggered).toBe(true);
  });

  test('stop sets isRunning to false', () => {
    const lfo = new LFO({ mode: 'FRE' });
    lfo.update(0);
    expect(lfo.isRunning()).toBe(true);

    lfo.stop();
    expect(lfo.isRunning()).toBe(false);
  });

  test('resetTiming resets lastUpdateTime', () => {
    const lfo = new LFO({ mode: 'FRE' });
    lfo.update(0);
    lfo.update(1000);

    lfo.resetTiming();

    // Next update should have deltaMs = 0
    const phase1 = lfo.getPhase();
    lfo.update(5000); // Large time jump
    const phase2 = lfo.getPhase();

    // Phase should not have jumped significantly because deltaMs was 0
    expect(phase2).toBeCloseTo(phase1, 1);
  });
});

describe('engine/triggers - ONE mode with RND waveform', () => {
  test('generates new random value on trigger', () => {
    const config = createConfig({ mode: 'ONE', waveform: 'RND' });
    const state = createState({ randomValue: 0.5 });

    const newState = handleTrigger(config, state, 0.5);
    // randomStep should be set based on phase
    expect(typeof newState.randomStep).toBe('number');
  });
});

describe('engine/triggers - HLF mode with RND waveform', () => {
  test('generates new random value on trigger', () => {
    const config = createConfig({ mode: 'HLF', waveform: 'RND' });
    const state = createState({ randomValue: 0.5 });

    const newState = handleTrigger(config, state, 0.5);
    expect(typeof newState.randomStep).toBe('number');
  });
});

describe('engine/triggers - checkModeStop with hasTriggered=false', () => {
  test('returns shouldStop=true when not triggered for ONE mode', () => {
    const config = createConfig({ mode: 'ONE' });
    const state = createState({ hasTriggered: false });

    const result = checkModeStop(config, state, 0.5, 0.6);
    expect(result.shouldStop).toBe(true);
    expect(result.cycleCompleted).toBe(false);
  });

  test('returns shouldStop=true when not triggered for HLF mode', () => {
    const config = createConfig({ mode: 'HLF' });
    const state = createState({ hasTriggered: false });

    const result = checkModeStop(config, state, 0.5, 0.6);
    expect(result.shouldStop).toBe(true);
    expect(result.cycleCompleted).toBe(false);
  });
});

describe('engine/triggers - HLF backward direction', () => {
  test('stops at half cycle (backward, startPhase >= 0.5)', () => {
    const config = createConfig({ mode: 'HLF', speed: -16, startPhase: 96 });
    const state = createState({
      hasTriggered: true,
      startPhaseNormalized: 0.75, // 96/128
      cycleCount: 0,
    });

    // Half point backward from 0.75 is 0.25
    // Crossing from 0.3 to 0.2
    const result = checkModeStop(config, state, 0.3, 0.2);
    expect(result.shouldStop).toBe(true);
  });

  test('stops at half cycle (backward, startPhase < 0.5)', () => {
    const config = createConfig({ mode: 'HLF', speed: -16, startPhase: 32 });
    const state = createState({
      hasTriggered: true,
      startPhaseNormalized: 0.25, // 32/128
      cycleCount: 1, // Has wrapped
    });

    // Half point backward from 0.25 is 0.75 (wraps through 1)
    const result = checkModeStop(config, state, 0.8, 0.7);
    expect(result.shouldStop).toBe(true);
  });

  test('does not stop before half cycle (backward)', () => {
    const config = createConfig({ mode: 'HLF', speed: -16, startPhase: 96 });
    const state = createState({
      hasTriggered: true,
      startPhaseNormalized: 0.75,
      cycleCount: 0,
    });

    // Haven't reached half point yet
    const result = checkModeStop(config, state, 0.7, 0.6);
    expect(result.shouldStop).toBe(false);
  });
});

describe('engine/triggers - HLF forward with startPhase >= 0.5', () => {
  test('stops at half cycle (forward, startPhase >= 0.5, wraps)', () => {
    const config = createConfig({ mode: 'HLF', speed: 16, startPhase: 96 });
    const state = createState({
      hasTriggered: true,
      startPhaseNormalized: 0.75, // 96/128
      cycleCount: 1, // Has wrapped through 1
    });

    // Half point forward from 0.75 is 0.25 (wraps through 0)
    const result = checkModeStop(config, state, 0.2, 0.3);
    expect(result.shouldStop).toBe(true);
  });
});

describe('engine/waveforms - generateWaveform exhaustive check', () => {
  test('throws error for unknown waveform type', () => {
    const state = createState();
    // @ts-expect-error - intentionally testing with invalid waveform
    expect(() => generateWaveform('INVALID', 0.5, state)).toThrow('Unknown waveform: INVALID');
  });
});

describe('engine/fade - updateFade edge case', () => {
  test('handles fadeDurationMs = 0', () => {
    // This happens when fadeValue calculation results in 0 cycles
    // Create a mock scenario where cycleTimeMs is 0
    const config = createConfig({ fade: 1, mode: 'TRG' }); // Small fade value
    const state = createState({ fadeProgress: 0 });

    // cycleTimeMs = 0 will make fadeDurationMs = 0
    const result = updateFade(config, state, 0, 100);
    expect(result.fadeProgress).toBe(1);
    expect(result.fadeMultiplier).toBe(1); // positive fade means fade out starts at 1
  });

  test('returns multiplier 0 for negative fade when fadeDurationMs = 0', () => {
    const config = createConfig({ fade: -1, mode: 'TRG' });
    const state = createState({ fadeProgress: 0 });

    const result = updateFade(config, state, 0, 100);
    expect(result.fadeProgress).toBe(1);
    expect(result.fadeMultiplier).toBe(0); // negative fade means fade in starts at 0
  });
});
