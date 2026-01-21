import { describe, test, expect } from 'bun:test';
import { LFO } from '../src/engine/lfo';

describe('Phase wrapping', () => {
  test('phase wraps from 1 back to 0 (forward)', () => {
    const lfo = new LFO({ speed: 32, multiplier: 64 }, 120); // Fast cycle

    // Simulate time passing
    let lastTime = 0;
    let wrappedFromOne = false;
    let previousPhase = 0;

    for (let i = 0; i < 200; i++) {
      const state = lfo.update(lastTime);
      if (previousPhase > 0.9 && state.phase < 0.1) {
        wrappedFromOne = true;
        break;
      }
      previousPhase = state.phase;
      lastTime += 10; // 10ms per step
    }

    expect(wrappedFromOne).toBe(true);
  });

  test('phase wraps from 1 to 0 (negative speed - phase still runs forward)', () => {
    const lfo = new LFO({ speed: -32, multiplier: 64 }, 120); // Fast cycle, negative speed

    let lastTime = 0;
    let wrappedFromOne = false;
    let previousPhase = 0;

    // First update to initialize
    lfo.update(lastTime);
    lastTime += 10;

    for (let i = 0; i < 200; i++) {
      const state = lfo.update(lastTime);
      // Phase still runs forward even with negative speed
      if (previousPhase > 0.9 && state.phase < 0.1) {
        wrappedFromOne = true;
        break;
      }
      previousPhase = state.phase;
      lastTime += 10;
    }

    expect(wrappedFromOne).toBe(true);
  });

  test('phase stays within 0-1 range', () => {
    const lfo = new LFO({ speed: 32, multiplier: 64 }, 120);

    let lastTime = 0;
    for (let i = 0; i < 500; i++) {
      const state = lfo.update(lastTime);
      expect(state.phase).toBeGreaterThanOrEqual(0);
      expect(state.phase).toBeLessThan(1);
      lastTime += 5;
    }
  });
});

describe('Negative speed', () => {
  test('negative speed inverts output (phase still runs forward)', () => {
    // Positive speed LFO
    const lfoPos = new LFO({ speed: 16, multiplier: 8, waveform: 'TRI' }, 120);
    // Negative speed LFO (same magnitude)
    const lfoNeg = new LFO({ speed: -16, multiplier: 8, waveform: 'TRI' }, 120);

    // Initialize both
    lfoPos.update(0);
    lfoNeg.update(0);

    const statePos = lfoPos.update(500);
    const stateNeg = lfoNeg.update(500);

    // Phase should be the same (both run forward)
    expect(stateNeg.phase).toBeCloseTo(statePos.phase, 4);
    // Output should be inverted
    expect(stateNeg.output).toBeCloseTo(-statePos.output, 4);
  });

  test('positive speed runs phase forwards', () => {
    const lfo = new LFO({ speed: 16, multiplier: 8 }, 120);

    lfo.update(0);
    const state1 = lfo.update(100);
    const state2 = lfo.update(200);

    // Phase should increase
    expect(state2.phase).toBeGreaterThan(state1.phase);
  });

  test('negative speed has same cycle time as positive speed', () => {
    const lfoPos = new LFO({ speed: 16, multiplier: 8 }, 120);
    const lfoNeg = new LFO({ speed: -16, multiplier: 8 }, 120);

    expect(lfoPos.getTimingInfo().cycleTimeMs).toBe(lfoNeg.getTimingInfo().cycleTimeMs);
  });
});

describe('Start phase', () => {
  test('startPhase 0 starts at phase 0', () => {
    const lfo = new LFO({ startPhase: 0 }, 120);
    expect(lfo.getState().phase).toBe(0);
  });

  test('startPhase 64 starts at phase 0.5', () => {
    const lfo = new LFO({ startPhase: 64 }, 120);
    expect(lfo.getState().phase).toBeCloseTo(0.5, 5);
  });

  test('startPhase 127 starts at phase ~0.992', () => {
    const lfo = new LFO({ startPhase: 127 }, 120);
    expect(lfo.getState().phase).toBeCloseTo(127 / 128, 3);
  });

  test('startPhase 32 (90 degrees) affects waveform starting position', () => {
    // SIN at phase 0.25 (90 degrees) should be at peak (+1)
    const lfo = new LFO({ waveform: 'SIN', startPhase: 32 }, 120);
    lfo.update(0);
    const state = lfo.update(1); // Minimal time for initial output

    // Phase should be at ~0.25, SIN should be near peak
    expect(state.phase).toBeCloseTo(0.25, 2);
  });
});

describe('ONE mode with non-zero startPhase', () => {
  test('ONE mode stops after returning to start phase', () => {
    const lfo = new LFO({
      mode: 'ONE',
      speed: 32,
      multiplier: 64, // Fast 125ms cycle
      startPhase: 32, // Start at 0.25
    }, 120);

    lfo.trigger();

    let lastTime = 0;
    let stopped = false;

    // Run for long enough to complete at least one cycle
    for (let i = 0; i < 100; i++) {
      lfo.update(lastTime);
      lastTime += 10;
    }

    stopped = !lfo.isRunning();
    expect(stopped).toBe(true);
  });
});

describe('HLF mode with non-zero startPhase', () => {
  test('HLF mode stops at phase 0.5 beyond start', () => {
    const lfo = new LFO({
      mode: 'HLF',
      speed: 32,
      multiplier: 64, // Fast cycle
      startPhase: 32, // Start at 0.25
    }, 120);

    lfo.trigger();

    let lastTime = 0;
    let stoppedAtPhase: number | null = null;

    for (let i = 0; i < 100; i++) {
      const state = lfo.update(lastTime);
      if (!state.isRunning && stoppedAtPhase === null) {
        stoppedAtPhase = state.phase;
        break;
      }
      lastTime += 5;
    }

    // Should stop at 0.25 + 0.5 = 0.75
    expect(stoppedAtPhase).toBeCloseTo(0.75, 1);
  });

  test('HLF mode with startPhase 96 stops correctly (wraps through 0)', () => {
    const lfo = new LFO({
      mode: 'HLF',
      speed: 32,
      multiplier: 64,
      startPhase: 96, // Start at 0.75
    }, 120);

    lfo.trigger();

    let lastTime = 0;
    let stoppedAtPhase: number | null = null;

    for (let i = 0; i < 100; i++) {
      const state = lfo.update(lastTime);
      if (!state.isRunning && stoppedAtPhase === null) {
        stoppedAtPhase = state.phase;
        break;
      }
      lastTime += 5;
    }

    // Should stop at 0.75 + 0.5 = 1.25 -> wraps to 0.25
    expect(stoppedAtPhase).toBeCloseTo(0.25, 1);
  });
});

describe('Cycle counting', () => {
  test('cycle count increments on wrap', () => {
    const lfo = new LFO({ speed: 32, multiplier: 64 }, 120); // 125ms cycle

    lfo.update(0);

    let lastTime = 0;
    let maxCycles = 0;

    // Run for 500ms (should complete ~4 cycles)
    for (let i = 0; i < 100; i++) {
      const state = lfo.update(lastTime);
      maxCycles = Math.max(maxCycles, state.cycleCount);
      lastTime += 5;
    }

    expect(maxCycles).toBeGreaterThanOrEqual(3);
  });
});
