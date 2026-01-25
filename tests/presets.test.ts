import { describe, test, expect } from 'bun:test';
import { LFO } from '../src/engine/lfo';

/**
 * Integration tests for the 5 presets from DIGITAKT_II_LFO_PRESETS.md
 */

describe('Preset 1: Fade-In One-Shot', () => {
  // RMP, SPD=8, MULT=16, ONE mode, FADE=-32
  // 1 bar cycle (2000ms at 120 BPM), stops after one cycle

  test('has correct timing (2000ms at 120 BPM)', () => {
    const lfo = new LFO({
      waveform: 'RMP',
      speed: 8,
      multiplier: 16, // 8 * 16 = 128 = 1 bar
      mode: 'ONE',
      fade: -32,
      depth: 63,
    }, 120);

    const timing = lfo.getTimingInfo();
    expect(timing.cycleTimeMs).toBeCloseTo(2000, 0);
    expect(timing.noteValue).toBe('1 bar');
    expect(timing.product).toBe(128);
  });

  test('stops after one cycle', () => {
    const lfo = new LFO({
      waveform: 'RMP',
      speed: 8,
      multiplier: 16,
      mode: 'ONE',
      fade: -32,
      depth: 63,
    }, 120);

    lfo.trigger();
    lfo.update(0);

    // Run for 2500ms (more than one 2000ms cycle)
    let lastTime = 0;
    for (let t = 0; t < 2500; t += 50) {
      lfo.update(t);
      lastTime = t;
    }

    expect(lfo.isRunning()).toBe(false);
  });

  test('fade multiplier increases over time (fade in)', () => {
    // Use TRG mode instead of ONE so LFO keeps running for fade to progress
    const lfo = new LFO({
      waveform: 'RMP',
      speed: 8,
      multiplier: 8,  // product=64, cycle=4000ms
      mode: 'TRG',
      fade: -16, // Fast fade-in (~2.67 cycles)
      depth: 63,
    }, 120);

    lfo.trigger();
    lfo.update(0);

    const state1 = lfo.update(100);
    expect(state1.fadeMultiplier).toBeLessThan(0.1);

    // Fade -16 = ~2.67 cycles (new formula)
    // With speed=8, mult=8, product=64, cycle time = 4000ms at 120 BPM
    // Total fade duration = ~2.67 * 4000ms = ~10680ms
    // After ~8000ms (2 cycles), should be at ~75%
    let laterFadeMultiplier = 0;
    for (let t = 100; t < 8100; t += 100) {
      const state = lfo.update(t);
      laterFadeMultiplier = state.fadeMultiplier;
    }
    expect(laterFadeMultiplier).toBeGreaterThan(0.6);
    expect(laterFadeMultiplier).toBeLessThan(0.9);
  });
});

describe('Preset 2: Ambient Drift', () => {
  // SIN, SPD=1, MULT=1, FRE mode
  // 128 bars cycle (256000ms at 120 BPM)

  test('has correct timing (256000ms at 120 BPM)', () => {
    const lfo = new LFO({
      waveform: 'SIN',
      speed: 1,
      multiplier: 1, // 1 * 1 = 1 = 128 bars
      mode: 'FRE',
      depth: 24,
      fade: 0,
    }, 120);

    const timing = lfo.getTimingInfo();
    expect(timing.cycleTimeMs).toBeCloseTo(256000, 0);
    expect(timing.noteValue).toBe('128 bars');
    expect(timing.product).toBe(1);
  });

  test('continues running despite triggers', () => {
    const lfo = new LFO({
      waveform: 'SIN',
      speed: 1,
      multiplier: 1,
      mode: 'FRE',
      depth: 24,
    }, 120);

    lfo.update(0);
    const state1 = lfo.update(1000);
    const phase1 = state1.phase;

    // Trigger should not affect phase in FRE mode
    lfo.trigger();
    const state2 = lfo.update(1100);

    // Phase should have continued from where it was
    expect(state2.phase).toBeGreaterThan(phase1);
    expect(lfo.isRunning()).toBe(true);
  });

  test('output is within moderate depth range', () => {
    const lfo = new LFO({
      waveform: 'SIN',
      speed: 1,
      multiplier: 1,
      mode: 'FRE',
      depth: 24, // Moderate depth
    }, 120);

    lfo.update(0);
    let maxOutput = 0;

    // Sample some outputs
    for (let t = 0; t < 10000; t += 500) {
      const state = lfo.update(t);
      maxOutput = Math.max(maxOutput, Math.abs(state.output));
    }

    // Depth 24/63 ≈ 0.38
    expect(maxOutput).toBeLessThanOrEqual(24 / 63 + 0.05);
  });
});

describe('Preset 3: Hi-Hat Humanizer', () => {
  // RND, SPD=32, MULT=64, FRE mode
  // 1/16 note cycle (125ms at 120 BPM)

  test('has correct timing (125ms at 120 BPM)', () => {
    const lfo = new LFO({
      waveform: 'RND',
      speed: 32,
      multiplier: 64, // 32 * 64 = 2048 = 1/16
      mode: 'FRE',
      depth: 12,
    }, 120);

    const timing = lfo.getTimingInfo();
    expect(timing.cycleTimeMs).toBeCloseTo(125, 0);
    expect(timing.noteValue).toBe('1/16');
    expect(timing.product).toBe(2048);
  });

  test('random values change over time', () => {
    const lfo = new LFO({
      waveform: 'RND',
      speed: 32,
      multiplier: 64,
      mode: 'FRE',
      depth: 12,
    }, 120);

    lfo.update(0);
    const values = new Set<number>();

    // Collect random values over 500ms (4 cycles)
    for (let t = 0; t < 500; t += 5) {
      const state = lfo.update(t);
      values.add(Math.round(state.rawOutput * 1000) / 1000);
    }

    // Should have multiple different values
    expect(values.size).toBeGreaterThan(5);
  });

  test('output within depth range', () => {
    const lfo = new LFO({
      waveform: 'RND',
      speed: 32,
      multiplier: 64,
      mode: 'FRE',
      depth: 12, // Subtle depth
    }, 120);

    lfo.update(0);
    let maxOutput = 0;

    for (let t = 0; t < 500; t += 5) {
      const state = lfo.update(t);
      maxOutput = Math.max(maxOutput, Math.abs(state.output));
    }

    // Depth 12/63 ≈ 0.19
    expect(maxOutput).toBeLessThanOrEqual(12 / 63 + 0.02);
  });
});

describe('Preset 4: Pumping Sidechain', () => {
  // EXP, SPD=32, MULT=4, TRG mode, DEP=-63
  // 1 bar cycle (2000ms at 120 BPM)

  test('has correct timing (2000ms at 120 BPM)', () => {
    const lfo = new LFO({
      waveform: 'EXP',
      speed: 32,
      multiplier: 4, // 32 * 4 = 128 = 1 bar
      mode: 'TRG',
      depth: -63, // Inverted
    }, 120);

    const timing = lfo.getTimingInfo();
    expect(timing.cycleTimeMs).toBeCloseTo(2000, 0);
    expect(timing.product).toBe(128);
  });

  test('restarts on trigger', () => {
    const lfo = new LFO({
      waveform: 'EXP',
      speed: 32,
      multiplier: 4,
      mode: 'TRG',
      depth: -63,
    }, 120);

    lfo.trigger();
    lfo.update(0);

    // Let it run partway through
    for (let t = 0; t < 1000; t += 50) {
      lfo.update(t);
    }

    const stateBefore = lfo.update(1000);
    const phaseBefore = stateBefore.phase;

    // Trigger again
    lfo.trigger();
    const stateAfter = lfo.update(1050);

    // Phase should have reset to near 0
    expect(stateAfter.phase).toBeLessThan(phaseBefore);
    expect(stateAfter.phase).toBeLessThan(0.1);
  });

  test('produces inverted (negative) output', () => {
    const lfo = new LFO({
      waveform: 'EXP',
      speed: 32,
      multiplier: 4,
      mode: 'TRG',
      depth: -63, // Negative depth inverts
      startPhase: 0,
    }, 120);

    lfo.trigger();
    lfo.update(0);

    // EXP goes 0 to 1, with -63 depth it should go 0 to -1
    let minOutput = Infinity;
    for (let t = 0; t < 2000; t += 50) {
      const state = lfo.update(t);
      minOutput = Math.min(minOutput, state.output);
    }

    expect(minOutput).toBeLessThan(-0.8);
  });
});

describe('Preset 5: Wobble Bass', () => {
  // SIN, SPD=16, MULT=8, TRG mode, SPH=32, DEP=+48
  // 1 bar cycle (2000ms at 120 BPM), starts at peak

  test('has correct timing (2000ms at 120 BPM)', () => {
    const lfo = new LFO({
      waveform: 'SIN',
      speed: 16,
      multiplier: 8, // 16 * 8 = 128 = 1 bar
      mode: 'TRG',
      startPhase: 32, // 90 degrees = peak
      depth: 48,
    }, 120);

    const timing = lfo.getTimingInfo();
    expect(timing.cycleTimeMs).toBeCloseTo(2000, 0);
    expect(timing.noteValue).toBe('1 bar');
  });

  test('starts at peak (phase 90 degrees)', () => {
    const lfo = new LFO({
      waveform: 'SIN',
      speed: 16,
      multiplier: 8,
      mode: 'TRG',
      startPhase: 32, // 32/128 = 0.25 = 90 degrees
      depth: 48,
    }, 120);

    lfo.trigger();
    lfo.update(0);

    const state = lfo.update(1);
    // At phase 0.25, SIN should be at +1
    expect(state.phase).toBeCloseTo(0.25, 2);
    // Raw output should be near peak
    expect(state.rawOutput).toBeGreaterThan(0.95);
  });

  test('strong depth produces dramatic sweep', () => {
    const lfo = new LFO({
      waveform: 'SIN',
      speed: 16,
      multiplier: 8,
      mode: 'TRG',
      startPhase: 32,
      depth: 48, // Strong depth
    }, 120);

    lfo.trigger();
    lfo.update(0);

    let maxOutput = 0;
    let minOutput = Infinity;

    for (let t = 0; t < 2500; t += 50) {
      const state = lfo.update(t);
      maxOutput = Math.max(maxOutput, state.output);
      minOutput = Math.min(minOutput, state.output);
    }

    // Depth 48/63 ≈ 0.76
    const expectedRange = 48 / 63;
    expect(maxOutput).toBeGreaterThan(expectedRange * 0.9);
    expect(minOutput).toBeLessThan(-expectedRange * 0.9);
  });
});
