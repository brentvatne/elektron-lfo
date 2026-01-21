import { describe, test, expect } from 'bun:test';
import {
  calculateProduct,
  calculateCycleTimeMs,
  calculateFrequencyHz,
  calculatePhaseIncrement,
  calculateCyclesPerBar,
  calculateNoteValue,
  calculateTimingInfo,
  formatCycleTime,
  formatFrequency,
} from '../src/engine/timing';
import type { LFOConfig } from '../src/engine/types';
import { DEFAULT_CONFIG } from '../src/engine/types';

// Helper to create config with defaults
function createConfig(overrides: Partial<LFOConfig>): LFOConfig {
  return { ...DEFAULT_CONFIG, ...overrides };
}

describe('calculateProduct', () => {
  test('calculates |SPD| × MULT', () => {
    expect(calculateProduct(createConfig({ speed: 16, multiplier: 8 }))).toBe(128);
    expect(calculateProduct(createConfig({ speed: 32, multiplier: 64 }))).toBe(2048);
    expect(calculateProduct(createConfig({ speed: 1, multiplier: 1 }))).toBe(1);
  });

  test('uses absolute value of speed', () => {
    expect(calculateProduct(createConfig({ speed: -16, multiplier: 8 }))).toBe(128);
    expect(calculateProduct(createConfig({ speed: -32, multiplier: 64 }))).toBe(2048);
  });

  test('handles speed of 0', () => {
    expect(calculateProduct(createConfig({ speed: 0, multiplier: 8 }))).toBe(0);
  });
});

describe('calculateCycleTimeMs', () => {
  test('calculates correct cycle time for 1 bar at 120 BPM', () => {
    // Product 128 = 1 bar = 2000ms at 120 BPM
    const config = createConfig({ speed: 16, multiplier: 8 }); // 128
    expect(calculateCycleTimeMs(config, 120)).toBeCloseTo(2000, 1);
  });

  test('calculates correct cycle time for 1/16 note at 120 BPM', () => {
    // Product 2048 = 1/16 note = 125ms at 120 BPM
    const config = createConfig({ speed: 32, multiplier: 64 }); // 2048
    expect(calculateCycleTimeMs(config, 120)).toBeCloseTo(125, 1);
  });

  test('calculates correct cycle time for 128 bars at 120 BPM', () => {
    // Product 1 = 128 bars = 256000ms at 120 BPM
    const config = createConfig({ speed: 1, multiplier: 1 }); // 1
    expect(calculateCycleTimeMs(config, 120)).toBeCloseTo(256000, 1);
  });

  test('uses fixed 120 BPM when useFixedBPM is true', () => {
    const config = createConfig({ speed: 16, multiplier: 8, useFixedBPM: true });
    // Should be 2000ms regardless of passed BPM
    expect(calculateCycleTimeMs(config, 90)).toBeCloseTo(2000, 1);
    expect(calculateCycleTimeMs(config, 180)).toBeCloseTo(2000, 1);
  });

  test('returns Infinity for speed 0', () => {
    const config = createConfig({ speed: 0, multiplier: 8 });
    expect(calculateCycleTimeMs(config, 120)).toBe(Infinity);
  });

  test('scales with BPM', () => {
    const config = createConfig({ speed: 16, multiplier: 8 }); // 128 = 1 bar
    // At 60 BPM, 1 bar = 4000ms
    expect(calculateCycleTimeMs(config, 60)).toBeCloseTo(4000, 1);
    // At 240 BPM, 1 bar = 1000ms
    expect(calculateCycleTimeMs(config, 240)).toBeCloseTo(1000, 1);
  });
});

describe('calculateFrequencyHz', () => {
  test('calculates correct frequency for 1 bar at 120 BPM', () => {
    // 1 bar at 120 BPM = 2000ms cycle = 0.5 Hz
    const config = createConfig({ speed: 16, multiplier: 8 }); // 128
    expect(calculateFrequencyHz(config, 120)).toBeCloseTo(0.5, 5);
  });

  test('calculates correct frequency for 1/16 note at 120 BPM', () => {
    // 1/16 at 120 BPM = 125ms cycle = 8 Hz
    const config = createConfig({ speed: 32, multiplier: 64 }); // 2048
    expect(calculateFrequencyHz(config, 120)).toBeCloseTo(8, 5);
  });

  test('returns 0 for speed 0', () => {
    const config = createConfig({ speed: 0, multiplier: 8 });
    expect(calculateFrequencyHz(config, 120)).toBe(0);
  });
});

describe('calculatePhaseIncrement', () => {
  test('calculates positive increment for positive speed', () => {
    const config = createConfig({ speed: 16, multiplier: 8 }); // 2000ms cycle
    const increment = calculatePhaseIncrement(config, 120);
    expect(increment).toBeGreaterThan(0);
    // 1ms should give 1/2000 phase increment
    expect(increment).toBeCloseTo(1 / 2000, 8);
  });

  test('calculates positive increment for negative speed (phase always forward)', () => {
    const config = createConfig({ speed: -16, multiplier: 8 }); // 2000ms cycle
    const increment = calculatePhaseIncrement(config, 120);
    // Phase always moves forward; output inversion is handled in LFO class
    expect(increment).toBeGreaterThan(0);
    expect(increment).toBeCloseTo(1 / 2000, 8);
  });

  test('returns 0 for speed 0', () => {
    const config = createConfig({ speed: 0, multiplier: 8 });
    expect(calculatePhaseIncrement(config, 120)).toBe(0);
  });
});

describe('calculateCyclesPerBar', () => {
  test('returns 1 for product 128', () => {
    const config = createConfig({ speed: 16, multiplier: 8 }); // 128
    expect(calculateCyclesPerBar(config)).toBe(1);
  });

  test('returns 16 for product 2048', () => {
    const config = createConfig({ speed: 32, multiplier: 64 }); // 2048
    expect(calculateCyclesPerBar(config)).toBe(16);
  });

  test('returns 1/128 for product 1', () => {
    const config = createConfig({ speed: 1, multiplier: 1 }); // 1
    expect(calculateCyclesPerBar(config)).toBeCloseTo(1 / 128, 8);
  });
});

describe('calculateNoteValue', () => {
  test('returns correct note values', () => {
    expect(calculateNoteValue(2048)).toBe('1/16');
    expect(calculateNoteValue(1024)).toBe('1/8');
    expect(calculateNoteValue(512)).toBe('1/4');
    expect(calculateNoteValue(256)).toBe('1/2');
    expect(calculateNoteValue(128)).toBe('1 bar');
  });

  test('returns bar counts for slow cycles', () => {
    expect(calculateNoteValue(64)).toBe('2 bars');
    expect(calculateNoteValue(32)).toBe('4 bars');
    expect(calculateNoteValue(16)).toBe('8 bars');
    expect(calculateNoteValue(1)).toBe('128 bars');
  });

  test('returns ∞ for product 0', () => {
    expect(calculateNoteValue(0)).toBe('∞');
  });
});

describe('calculateTimingInfo', () => {
  test('returns complete timing info', () => {
    const config = createConfig({ speed: 16, multiplier: 8 });
    const info = calculateTimingInfo(config, 120);

    expect(info.product).toBe(128);
    expect(info.cycleTimeMs).toBeCloseTo(2000, 1);
    expect(info.frequencyHz).toBeCloseTo(0.5, 5);
    expect(info.cyclesPerBar).toBe(1);
    expect(info.noteValue).toBe('1 bar');
  });
});

describe('formatCycleTime', () => {
  test('formats milliseconds', () => {
    expect(formatCycleTime(125)).toBe('125.0ms');
    expect(formatCycleTime(500)).toBe('500.0ms');
  });

  test('formats seconds', () => {
    expect(formatCycleTime(2000)).toBe('2.00s');
    expect(formatCycleTime(4500)).toBe('4.50s');
  });

  test('formats minutes', () => {
    expect(formatCycleTime(120000)).toBe('2.0min');
    expect(formatCycleTime(256000)).toBe('4.3min');
  });

  test('formats infinity', () => {
    expect(formatCycleTime(Infinity)).toBe('∞');
  });
});

describe('formatFrequency', () => {
  test('formats Hz', () => {
    expect(formatFrequency(8)).toBe('8.00 Hz');
    expect(formatFrequency(0.5)).toBe('0.500 Hz');
  });

  test('formats mHz for very low frequencies', () => {
    expect(formatFrequency(0.005)).toBe('5.000 mHz');
  });

  test('formats 0 Hz', () => {
    expect(formatFrequency(0)).toBe('0 Hz');
  });
});

describe('Spec timing examples', () => {
  // Verify against the timing examples from the spec

  test('SPD=32, MULT=64: 1/16 note, 125ms at 120 BPM', () => {
    const config = createConfig({ speed: 32, multiplier: 64 });
    expect(calculateCycleTimeMs(config, 120)).toBeCloseTo(125, 1);
    expect(calculateNoteValue(32 * 64)).toBe('1/16');
  });

  test('SPD=16, MULT=8: 1 bar, 2000ms at 120 BPM', () => {
    const config = createConfig({ speed: 16, multiplier: 8 });
    expect(calculateCycleTimeMs(config, 120)).toBeCloseTo(2000, 1);
    expect(calculateNoteValue(16 * 8)).toBe('1 bar');
  });

  test('SPD=1, MULT=1: 128 bars, 256000ms at 120 BPM', () => {
    const config = createConfig({ speed: 1, multiplier: 1 });
    expect(calculateCycleTimeMs(config, 120)).toBeCloseTo(256000, 1);
    expect(calculateNoteValue(1 * 1)).toBe('128 bars');
  });

  test('SPD=8, MULT=16: 1 bar, 2000ms at 120 BPM', () => {
    const config = createConfig({ speed: 8, multiplier: 16 });
    expect(calculateCycleTimeMs(config, 120)).toBeCloseTo(2000, 1);
    expect(calculateNoteValue(8 * 16)).toBe('1 bar');
  });
});
