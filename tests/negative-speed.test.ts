import { describe, test, expect } from 'bun:test';
import { LFO } from '../src/engine/lfo';

/**
 * Negative Speed Behavior Tests
 *
 * Current implementation: Negative speed INVERTS the output while phase still runs forward
 * - SAW at +speed: outputs +1 → -1 (falling)
 * - SAW at -speed: outputs -1 → +1 (rising, because output is negated)
 *
 * NOTE: Digitakt II behavior may differ. These tests document our current model.
 * If Digitakt tests show different behavior, we may need to update the implementation.
 */

describe('Negative Speed - SAW waveform', () => {
  test('positive speed SAW starts high and falls', () => {
    const lfo = new LFO({
      waveform: 'SAW',
      speed: 16,
      multiplier: 4,
      depth: 63,
    }, 120);

    lfo.trigger();
    lfo.update(0);
    const stateStart = lfo.update(1);

    // SAW at phase 0 should be +1, mapped to output ~+1 with depth 63
    expect(stateStart.rawOutput).toBeCloseTo(1, 1);
    expect(stateStart.output).toBeGreaterThan(0.9);

    // After some time, SAW should fall
    const stateLater = lfo.update(2000);
    expect(stateLater.rawOutput).toBeLessThan(stateStart.rawOutput);
  });

  test('negative speed SAW starts low and rises (inverted)', () => {
    const lfo = new LFO({
      waveform: 'SAW',
      speed: -16,
      multiplier: 4,
      depth: 63,
    }, 120);

    lfo.trigger();
    lfo.update(0);
    const stateStart = lfo.update(1);

    // With negative speed, output is inverted
    // rawOutput is still +1 (SAW at phase 0), but output is negated to -1
    expect(stateStart.rawOutput).toBeCloseTo(1, 1);
    expect(stateStart.output).toBeLessThan(-0.9); // Inverted!
  });

  test('SAW positive vs negative speed have inverted outputs at same time', () => {
    const lfoPos = new LFO({
      waveform: 'SAW',
      speed: 16,
      multiplier: 4,
      depth: 63,
    }, 120);

    const lfoNeg = new LFO({
      waveform: 'SAW',
      speed: -16,
      multiplier: 4,
      depth: 63,
    }, 120);

    lfoPos.trigger();
    lfoNeg.trigger();
    lfoPos.update(0);
    lfoNeg.update(0);

    // Check at several time points
    for (const time of [100, 500, 1000, 2000, 3000]) {
      const statePos = lfoPos.update(time);
      const stateNeg = lfoNeg.update(time);

      // Phase should be the same
      expect(stateNeg.phase).toBeCloseTo(statePos.phase, 3);

      // Output should be inverted (opposite sign)
      expect(stateNeg.output).toBeCloseTo(-statePos.output, 3);
    }
  });
});

describe('Negative Speed - TRI waveform', () => {
  test('positive speed TRI starts at 0, rises to peak, then falls', () => {
    const lfo = new LFO({
      waveform: 'TRI',
      speed: 16,
      multiplier: 4,
      depth: 63,
    }, 120);

    lfo.trigger();
    lfo.update(0);
    const stateStart = lfo.update(1);

    // TRI at phase 0 should be 0
    expect(stateStart.rawOutput).toBeCloseTo(0, 1);
  });

  test('negative speed TRI has inverted output', () => {
    const lfoPos = new LFO({
      waveform: 'TRI',
      speed: 16,
      multiplier: 4,
      depth: 63,
    }, 120);

    const lfoNeg = new LFO({
      waveform: 'TRI',
      speed: -16,
      multiplier: 4,
      depth: 63,
    }, 120);

    lfoPos.trigger();
    lfoNeg.trigger();

    // Initialize with time 0, then advance to 25% of cycle
    const cycleMs = lfoPos.getTimingInfo().cycleTimeMs;
    const timeAt25Percent = cycleMs * 0.25;

    // Start from time 1 to avoid sentinel value issue
    lfoPos.update(1);
    lfoNeg.update(1);

    const statePos = lfoPos.update(1 + timeAt25Percent);
    const stateNeg = lfoNeg.update(1 + timeAt25Percent);

    // At phase 0.25, TRI should be at +1, so output ~= +1 * depth/63
    // Positive should be positive, negative should be negative (inverted)
    expect(statePos.output).toBeGreaterThan(0.5);
    expect(stateNeg.output).toBeLessThan(-0.5);
  });
});

describe('Negative Speed - RMP waveform (unipolar)', () => {
  test('positive speed RMP rises from 0 to 1', () => {
    const lfo = new LFO({
      waveform: 'RMP',
      speed: 16,
      multiplier: 4,
      depth: 63,
    }, 120);

    lfo.trigger();
    lfo.update(0);
    const stateStart = lfo.update(1);

    // RMP at phase 0 should be 0
    expect(stateStart.rawOutput).toBeCloseTo(0, 1);

    // After half cycle, should be at 0.5
    const cycleMs = lfo.getTimingInfo().cycleTimeMs;
    const stateMid = lfo.update(cycleMs * 0.5);
    expect(stateMid.rawOutput).toBeCloseTo(0.5, 1);
  });

  test('negative speed RMP has inverted output (0 to -1)', () => {
    const lfo = new LFO({
      waveform: 'RMP',
      speed: -16,
      multiplier: 4,
      depth: 63,
    }, 120);

    lfo.trigger();
    lfo.update(0);
    const stateStart = lfo.update(1);

    // rawOutput is still 0 (RMP at phase 0), output is negated to 0
    expect(stateStart.rawOutput).toBeCloseTo(0, 1);
    expect(stateStart.output).toBeCloseTo(0, 1); // -0 = 0

    // After half cycle, rawOutput is 0.5, output is -0.5 * depth
    const cycleMs = lfo.getTimingInfo().cycleTimeMs;
    const stateMid = lfo.update(cycleMs * 0.5);
    expect(stateMid.rawOutput).toBeCloseTo(0.5, 1);
    expect(stateMid.output).toBeLessThan(0); // Negated
  });
});

describe('Negative Speed - EXP waveform (unipolar)', () => {
  test('positive speed EXP decays from 1 to 0', () => {
    const lfo = new LFO({
      waveform: 'EXP',
      speed: 16,
      multiplier: 4,
      depth: 63,
    }, 120);

    lfo.trigger();
    lfo.update(0);
    const stateStart = lfo.update(1);

    // EXP at phase 0 should be 1
    expect(stateStart.rawOutput).toBeCloseTo(1, 1);
    expect(stateStart.output).toBeGreaterThan(0.9);

    // Near end of cycle, should be close to 0
    const cycleMs = lfo.getTimingInfo().cycleTimeMs;
    const stateEnd = lfo.update(cycleMs * 0.95);
    expect(stateEnd.rawOutput).toBeLessThan(0.2);
  });

  test('negative speed EXP has inverted output (-1 to 0)', () => {
    const lfo = new LFO({
      waveform: 'EXP',
      speed: -16,
      multiplier: 4,
      depth: 63,
    }, 120);

    lfo.trigger();
    lfo.update(0);
    const stateStart = lfo.update(1);

    // rawOutput is still 1 (EXP at phase 0), output is negated to -1
    expect(stateStart.rawOutput).toBeCloseTo(1, 1);
    expect(stateStart.output).toBeLessThan(-0.9); // Inverted!
  });
});

describe('Negative Speed - CC value mapping', () => {
  test('SAW positive speed maps to CC 103 → 24 (high to low)', () => {
    const lfo = new LFO({
      waveform: 'SAW',
      speed: 16,
      multiplier: 4,
      depth: 40, // CC range: 64-40=24 to 64+40=104
    }, 120);

    lfo.trigger();
    lfo.update(0);
    const stateStart = lfo.update(1);

    // Convert output to CC: center (64) + output * 63
    const ccStart = Math.round(64 + stateStart.output * 63);
    expect(ccStart).toBeGreaterThan(95); // Should start near max (~103)

    // At end of cycle
    const cycleMs = lfo.getTimingInfo().cycleTimeMs;
    const stateEnd = lfo.update(cycleMs * 0.95);
    const ccEnd = Math.round(64 + stateEnd.output * 63);
    expect(ccEnd).toBeLessThan(35); // Should end near min (~24)
  });

  test('SAW negative speed maps to CC 24 → 103 (low to high)', () => {
    const lfo = new LFO({
      waveform: 'SAW',
      speed: -16,
      multiplier: 4,
      depth: 40,
    }, 120);

    lfo.trigger();
    lfo.update(0);
    const stateStart = lfo.update(1);

    // With negative speed, output is inverted
    const ccStart = Math.round(64 + stateStart.output * 63);
    expect(ccStart).toBeLessThan(35); // Should start near min (~24)

    // At end of cycle
    const cycleMs = lfo.getTimingInfo().cycleTimeMs;
    const stateEnd = lfo.update(cycleMs * 0.95);
    const ccEnd = Math.round(64 + stateEnd.output * 63);
    expect(ccEnd).toBeGreaterThan(95); // Should end near max (~103)
  });
});

describe('Negative Speed - Timing', () => {
  test('cycle time is same for positive and negative speed', () => {
    const lfoPos = new LFO({ speed: 16, multiplier: 4 }, 120);
    const lfoNeg = new LFO({ speed: -16, multiplier: 4 }, 120);

    expect(lfoPos.getTimingInfo().cycleTimeMs).toBe(lfoNeg.getTimingInfo().cycleTimeMs);
  });

  test('phase progression is forward for both positive and negative speed', () => {
    const lfoPos = new LFO({ speed: 16, multiplier: 4 }, 120);
    const lfoNeg = new LFO({ speed: -16, multiplier: 4 }, 120);

    lfoPos.trigger();
    lfoNeg.trigger();
    lfoPos.update(0);
    lfoNeg.update(0);

    let prevPhasePos = 0;
    let prevPhaseNeg = 0;

    // Check that phase always increases (modulo wrap)
    for (let time = 100; time < 2000; time += 100) {
      const statePos = lfoPos.update(time);
      const stateNeg = lfoNeg.update(time);

      // Both should have same phase
      expect(stateNeg.phase).toBeCloseTo(statePos.phase, 3);

      // Phase should increase or wrap
      if (statePos.phase < 0.1 && prevPhasePos > 0.9) {
        // Wrapped
      } else {
        expect(statePos.phase).toBeGreaterThanOrEqual(prevPhasePos - 0.01);
      }

      prevPhasePos = statePos.phase;
      prevPhaseNeg = stateNeg.phase;
    }
  });
});
