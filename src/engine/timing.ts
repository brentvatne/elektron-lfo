/**
 * Timing calculations for Elektron Digitakt II LFO
 *
 * Core formulas from the spec:
 * - phase_steps_per_bar = |SPD| × MULT
 * - cycle_time_ms = (60000 / BPM) × 4 × (128 / (|SPD| × MULT))
 * - frequency_hz = (BPM / 60) × (|SPD| × MULT / 128)
 */

import type { LFOConfig, TimingInfo } from './types';

/**
 * Calculate the product of |SPD| × MULT
 */
export function calculateProduct(config: LFOConfig): number {
  return Math.abs(config.speed) * config.multiplier;
}

/**
 * Calculate cycle time in milliseconds
 *
 * Formula: cycle_time_ms = (60000 / BPM) × 4 × (128 / product)
 */
export function calculateCycleTimeMs(config: LFOConfig, bpm: number): number {
  const effectiveBpm = config.useFixedBPM ? 120 : bpm;
  const product = calculateProduct(config);

  if (product === 0) {
    return Infinity; // Speed of 0 means infinite cycle time
  }

  return (60000 / effectiveBpm) * 4 * (128 / product);
}

/**
 * Calculate LFO frequency in Hz
 *
 * Frequency is simply 1 / cycleTime in seconds
 * frequency_hz = 1000 / cycleTimeMs
 */
export function calculateFrequencyHz(config: LFOConfig, bpm: number): number {
  const cycleTimeMs = calculateCycleTimeMs(config, bpm);

  if (cycleTimeMs === Infinity || cycleTimeMs === 0) {
    return 0;
  }

  return 1000 / cycleTimeMs;
}

/**
 * Calculate phase increment per millisecond
 *
 * Phase goes from 0 to 1 over one cycle
 * Increment = 1 / cycle_time_ms (for positive speed)
 * Increment = -1 / cycle_time_ms (for negative speed)
 */
export function calculatePhaseIncrement(config: LFOConfig, bpm: number): number {
  const cycleTimeMs = calculateCycleTimeMs(config, bpm);

  if (cycleTimeMs === Infinity || cycleTimeMs === 0) {
    return 0;
  }

  // Phase always moves forward; negative speed is handled by inverting waveform output
  return 1 / cycleTimeMs;
}

/**
 * Calculate cycles per bar
 *
 * At product = 128, we get exactly 1 cycle per bar
 * At product > 128, we get product/128 cycles per bar
 * At product < 128, we get product/128 cycles per bar (fraction)
 */
export function calculateCyclesPerBar(config: LFOConfig): number {
  const product = calculateProduct(config);
  if (product === 0) return 0;
  return product / 128;
}

/**
 * Convert product to musical note value string
 */
export function calculateNoteValue(product: number): string {
  if (product === 0) return '∞';

  // Product to note value mapping
  // 128 = 1 bar (whole note in 4/4)
  // 256 = 1/2 bar (half note)
  // 512 = 1/4 note
  // 1024 = 1/8 note
  // 2048 = 1/16 note

  // For products > 128: faster than 1 bar
  if (product >= 2048) return '1/16';
  if (product >= 1024) return '1/8';
  if (product >= 512) return '1/4';
  if (product >= 256) return '1/2';
  if (product >= 128) return '1 bar';

  // For products < 128: slower than 1 bar
  const bars = 128 / product;
  if (bars === Math.floor(bars)) {
    return `${bars} bars`;
  }
  return `${bars.toFixed(1)} bars`;
}

/**
 * Calculate complete timing information
 */
export function calculateTimingInfo(config: LFOConfig, bpm: number): TimingInfo {
  const product = calculateProduct(config);
  const cycleTimeMs = calculateCycleTimeMs(config, bpm);
  const frequencyHz = calculateFrequencyHz(config, bpm);
  const cyclesPerBar = calculateCyclesPerBar(config);
  const noteValue = calculateNoteValue(product);

  return {
    cycleTimeMs,
    noteValue,
    frequencyHz,
    cyclesPerBar,
    product,
  };
}

/**
 * Format cycle time for display
 */
export function formatCycleTime(cycleTimeMs: number): string {
  if (cycleTimeMs === Infinity) return '∞';
  if (cycleTimeMs >= 60000) {
    const minutes = cycleTimeMs / 60000;
    return `${minutes.toFixed(1)}min`;
  }
  if (cycleTimeMs >= 1000) {
    return `${(cycleTimeMs / 1000).toFixed(2)}s`;
  }
  return `${cycleTimeMs.toFixed(1)}ms`;
}

/**
 * Format frequency for display
 */
export function formatFrequency(frequencyHz: number): string {
  if (frequencyHz === 0) return '0 Hz';
  if (frequencyHz < 0.01) {
    return `${(frequencyHz * 1000).toFixed(3)} mHz`;
  }
  if (frequencyHz < 1) {
    return `${frequencyHz.toFixed(3)} Hz`;
  }
  return `${frequencyHz.toFixed(2)} Hz`;
}
