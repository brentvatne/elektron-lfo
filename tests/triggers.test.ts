import { describe, test, expect } from 'bun:test';
import {
  handleTrigger,
  checkModeStop,
  requiresTriggerToStart,
  resetsPhaseOnTrigger,
  resetsFadeOnTrigger,
} from '../src/engine/triggers';
import type { LFOConfig, LFOState } from '../src/engine/types';
import { DEFAULT_CONFIG } from '../src/engine/types';

// Helper to create config with defaults
function createConfig(overrides: Partial<LFOConfig>): LFOConfig {
  return { ...DEFAULT_CONFIG, ...overrides };
}

// Helper to create state with defaults
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
    cycleCount: 2,
    triggerCount: 0,
    hasTriggered: false,
    randomStep: 8,
    ...overrides,
  };
}

describe('handleTrigger - FRE mode', () => {
  test('does not change phase', () => {
    const config = createConfig({ mode: 'FRE' });
    const state = createState({ phase: 0.75 });

    const newState = handleTrigger(config, state, 0.5);
    expect(newState.phase).toBe(0.75);
  });

  test('does not reset fade', () => {
    const config = createConfig({ mode: 'FRE', fade: -32 });
    const state = createState({ fadeProgress: 0.8, fadeMultiplier: 0.8 });

    const newState = handleTrigger(config, state, 0.5);
    expect(newState.fadeProgress).toBe(0.8);
    expect(newState.fadeMultiplier).toBe(0.8);
  });

  test('increments trigger count', () => {
    const config = createConfig({ mode: 'FRE' });
    const state = createState({ triggerCount: 5 });

    const newState = handleTrigger(config, state, 0.5);
    expect(newState.triggerCount).toBe(6);
  });
});

describe('handleTrigger - TRG mode', () => {
  test('resets phase to start phase', () => {
    const config = createConfig({ mode: 'TRG', startPhase: 32 });
    const state = createState({ phase: 0.75, startPhaseNormalized: 0.25 });

    const newState = handleTrigger(config, state, 0.5);
    expect(newState.phase).toBe(0.25);
  });

  test('resets fade for fade in', () => {
    const config = createConfig({ mode: 'TRG', fade: -32 });
    const state = createState({ fadeProgress: 0.8, fadeMultiplier: 0.8 });

    const newState = handleTrigger(config, state, 0.5);
    expect(newState.fadeProgress).toBe(0);
    expect(newState.fadeMultiplier).toBe(0); // Fade in starts at 0
  });

  test('resets fade for fade out', () => {
    const config = createConfig({ mode: 'TRG', fade: 32 });
    const state = createState({ fadeProgress: 0.8, fadeMultiplier: 0.2 });

    const newState = handleTrigger(config, state, 0.5);
    expect(newState.fadeProgress).toBe(0);
    expect(newState.fadeMultiplier).toBe(1); // Fade out starts at 1
  });

  test('resets cycle count', () => {
    const config = createConfig({ mode: 'TRG' });
    const state = createState({ cycleCount: 10 });

    const newState = handleTrigger(config, state, 0.5);
    expect(newState.cycleCount).toBe(0);
  });

  test('generates new random value for RND waveform', () => {
    const config = createConfig({ mode: 'TRG', waveform: 'RND' });
    const state = createState({ randomValue: 0.5 });

    const newState = handleTrigger(config, state, 0.5);
    // Can't guarantee different value, but randomStep should be reset
    expect(newState.randomStep).toBeDefined();
  });
});

describe('handleTrigger - HLD mode', () => {
  test('holds current output value', () => {
    const config = createConfig({ mode: 'HLD' });
    const state = createState();

    const newState = handleTrigger(config, state, 0.75);
    expect(newState.heldOutput).toBe(0.75);
  });

  test('does not reset phase', () => {
    const config = createConfig({ mode: 'HLD' });
    const state = createState({ phase: 0.6 });

    const newState = handleTrigger(config, state, 0.5);
    expect(newState.phase).toBe(0.6);
  });

  test('resets fade', () => {
    const config = createConfig({ mode: 'HLD', fade: -32 });
    const state = createState({ fadeProgress: 0.8, fadeMultiplier: 0.8 });

    const newState = handleTrigger(config, state, 0.5);
    expect(newState.fadeProgress).toBe(0);
    expect(newState.fadeMultiplier).toBe(0);
  });
});

describe('handleTrigger - ONE mode', () => {
  test('resets phase to start phase', () => {
    const config = createConfig({ mode: 'ONE', startPhase: 64 });
    const state = createState({ phase: 0.75, startPhaseNormalized: 0.5 });

    const newState = handleTrigger(config, state, 0.5);
    expect(newState.phase).toBe(0.5);
  });

  test('starts running', () => {
    const config = createConfig({ mode: 'ONE' });
    const state = createState({ isRunning: false });

    const newState = handleTrigger(config, state, 0.5);
    expect(newState.isRunning).toBe(true);
  });

  test('sets hasTriggered flag', () => {
    const config = createConfig({ mode: 'ONE' });
    const state = createState({ hasTriggered: false });

    const newState = handleTrigger(config, state, 0.5);
    expect(newState.hasTriggered).toBe(true);
  });

  test('resets fade and cycle count', () => {
    const config = createConfig({ mode: 'ONE', fade: -32 });
    const state = createState({ fadeProgress: 0.8, cycleCount: 5 });

    const newState = handleTrigger(config, state, 0.5);
    expect(newState.fadeProgress).toBe(0);
    expect(newState.cycleCount).toBe(0);
  });
});

describe('handleTrigger - HLF mode', () => {
  test('resets phase to start phase', () => {
    const config = createConfig({ mode: 'HLF', startPhase: 32 });
    const state = createState({ phase: 0.8, startPhaseNormalized: 0.25 });

    const newState = handleTrigger(config, state, 0.5);
    expect(newState.phase).toBe(0.25);
  });

  test('starts running and sets hasTriggered', () => {
    const config = createConfig({ mode: 'HLF' });
    const state = createState({ isRunning: false, hasTriggered: false });

    const newState = handleTrigger(config, state, 0.5);
    expect(newState.isRunning).toBe(true);
    expect(newState.hasTriggered).toBe(true);
  });
});

describe('checkModeStop - ONE mode', () => {
  test('stops after completing one cycle (forward)', () => {
    const config = createConfig({ mode: 'ONE', speed: 16 });
    const state = createState({
      hasTriggered: true,
      startPhaseNormalized: 0,
      cycleCount: 1,
    });

    // Phase wrapping from near 1 to near 0
    const result = checkModeStop(config, state, 0.95, 0.05);
    expect(result.shouldStop).toBe(true);
    expect(result.cycleCompleted).toBe(true);
  });

  test('does not stop before cycle completes', () => {
    const config = createConfig({ mode: 'ONE', speed: 16 });
    const state = createState({
      hasTriggered: true,
      startPhaseNormalized: 0,
      cycleCount: 0,
    });

    const result = checkModeStop(config, state, 0.4, 0.5);
    expect(result.shouldStop).toBe(false);
  });

  test('stops when phase crosses start phase (with non-zero start)', () => {
    const config = createConfig({ mode: 'ONE', speed: 16, startPhase: 64 });
    const state = createState({
      hasTriggered: true,
      startPhaseNormalized: 0.5,
      cycleCount: 0,
    });

    // Going from just before 0.5 (after wrapping) back to 0.5
    const result = checkModeStop(config, state, 0.6, 0.4);
    expect(result.shouldStop).toBe(false); // Haven't completed a full cycle yet
  });

  test('stops for negative speed (backward)', () => {
    const config = createConfig({ mode: 'ONE', speed: -16 });
    const state = createState({
      hasTriggered: true,
      startPhaseNormalized: 0,
      cycleCount: 1,
    });

    // Phase wrapping from near 0 to near 1 (backward direction)
    const result = checkModeStop(config, state, 0.05, 0.95);
    expect(result.shouldStop).toBe(true);
  });
});

describe('checkModeStop - HLF mode', () => {
  test('stops at half cycle (forward, start at 0)', () => {
    const config = createConfig({ mode: 'HLF', speed: 16 });
    const state = createState({
      hasTriggered: true,
      startPhaseNormalized: 0,
    });

    // Crossing phase 0.5
    const result = checkModeStop(config, state, 0.45, 0.55);
    expect(result.shouldStop).toBe(true);
  });

  test('stops at half cycle (start at 0.25)', () => {
    const config = createConfig({ mode: 'HLF', speed: 16, startPhase: 32 });
    const state = createState({
      hasTriggered: true,
      startPhaseNormalized: 0.25, // 32/128
    });

    // Half point is 0.25 + 0.5 = 0.75
    const result = checkModeStop(config, state, 0.7, 0.8);
    expect(result.shouldStop).toBe(true);
  });

  test('does not stop before half cycle', () => {
    const config = createConfig({ mode: 'HLF', speed: 16 });
    const state = createState({
      hasTriggered: true,
      startPhaseNormalized: 0,
    });

    const result = checkModeStop(config, state, 0.2, 0.3);
    expect(result.shouldStop).toBe(false);
  });
});

describe('checkModeStop - other modes', () => {
  test('FRE mode never stops', () => {
    const config = createConfig({ mode: 'FRE' });
    const state = createState({ hasTriggered: true });

    const result = checkModeStop(config, state, 0.9, 0.1);
    expect(result.shouldStop).toBe(false);
  });

  test('TRG mode never stops', () => {
    const config = createConfig({ mode: 'TRG' });
    const state = createState({ hasTriggered: true });

    const result = checkModeStop(config, state, 0.9, 0.1);
    expect(result.shouldStop).toBe(false);
  });

  test('HLD mode never stops', () => {
    const config = createConfig({ mode: 'HLD' });
    const state = createState({ hasTriggered: true });

    const result = checkModeStop(config, state, 0.9, 0.1);
    expect(result.shouldStop).toBe(false);
  });
});

describe('requiresTriggerToStart', () => {
  test('ONE and HLF require trigger', () => {
    expect(requiresTriggerToStart('ONE')).toBe(true);
    expect(requiresTriggerToStart('HLF')).toBe(true);
  });

  test('other modes do not require trigger', () => {
    expect(requiresTriggerToStart('FRE')).toBe(false);
    expect(requiresTriggerToStart('TRG')).toBe(false);
    expect(requiresTriggerToStart('HLD')).toBe(false);
  });
});

describe('resetsPhaseOnTrigger', () => {
  test('TRG, ONE, HLF reset phase', () => {
    expect(resetsPhaseOnTrigger('TRG')).toBe(true);
    expect(resetsPhaseOnTrigger('ONE')).toBe(true);
    expect(resetsPhaseOnTrigger('HLF')).toBe(true);
  });

  test('FRE and HLD do not reset phase', () => {
    expect(resetsPhaseOnTrigger('FRE')).toBe(false);
    expect(resetsPhaseOnTrigger('HLD')).toBe(false);
  });
});

describe('resetsFadeOnTrigger', () => {
  test('all modes except FRE reset fade', () => {
    expect(resetsFadeOnTrigger('TRG')).toBe(true);
    expect(resetsFadeOnTrigger('ONE')).toBe(true);
    expect(resetsFadeOnTrigger('HLF')).toBe(true);
    expect(resetsFadeOnTrigger('HLD')).toBe(true);
  });

  test('FRE does not reset fade', () => {
    expect(resetsFadeOnTrigger('FRE')).toBe(false);
  });
});
