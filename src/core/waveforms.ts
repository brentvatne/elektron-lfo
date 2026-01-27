/**
 * Pure waveform sampling functions for Elektron Digitakt II LFO
 *
 * All functions are:
 * - Pure (no side effects, no mutation)
 * - Self-contained (no imports of non-primitive values)
 * - Worklet-compatible (no closures, inline constants)
 *
 * Waveform ranges:
 * - Bipolar (-1 to +1): TRI, SIN, SQR, SAW, RND
 * - Unipolar (0 to +1): EXP, RMP
 */

import type { Waveform } from '../engine/types';

// ===== BIPOLAR WAVEFORMS (-1 to +1) =====

/**
 * Triangle waveform - Bipolar
 * Starts at 0, peaks at +1 at phase 0.25, troughs at -1 at phase 0.75
 */
export function sampleTriangle(phase: number): number {
  if (phase < 0.25) {
    return phase * 4;
  }
  if (phase < 0.75) {
    return 1 - (phase - 0.25) * 4;
  }
  return -1 + (phase - 0.75) * 4;
}

/**
 * Sine waveform - Bipolar
 * Standard sine wave starting at 0
 */
export function sampleSine(phase: number): number {
  return Math.sin(phase * 2 * Math.PI);
}

/**
 * Square waveform - Bipolar
 * +1 for first half, -1 for second half
 */
export function sampleSquare(phase: number): number {
  return phase < 0.5 ? 1 : -1;
}

/**
 * Sawtooth waveform - Bipolar
 * Linear fall from +1 to -1 (matches Digitakt II behavior)
 */
export function sampleSawtooth(phase: number): number {
  return 1 - phase * 2;
}

// ===== UNIPOLAR WAVEFORMS (0 to +1) =====

/**
 * Ramp waveform - Unipolar (0 to +1)
 * Linear rise from 0 to +1 (matches Digitakt II behavior)
 */
export function sampleRamp(phase: number): number {
  return phase;
}

/**
 * Exponential decay - Unipolar (1 to 0)
 * Concave curve: fast initial drop, slow approach to 0
 * Used for positive speed
 */
export function sampleExpDecay(phase: number): number {
  const k = 3;
  const decay = Math.exp(-phase * k);
  const endValue = Math.exp(-k);
  return (decay - endValue) / (1 - endValue);
}

/**
 * Exponential rise - Unipolar (0 to 1)
 * Concave curve: slow initial rise, fast acceleration to 1
 * Used for negative speed to maintain concave shape
 */
export function sampleExpRise(phase: number): number {
  const k = 3;
  return (Math.exp(phase * k) - 1) / (Math.exp(k) - 1);
}

// ===== RANDOM WAVEFORM =====

/**
 * Seeded PRNG for reproducible random values
 * Uses mulberry32-inspired bit mixing for good distribution
 *
 * @param step - Step number (0-15 for standard 16-step S&H)
 * @param seed - Seed value for reproducibility
 * @returns Value in range [-1, 1]
 */
export function seededRandom(step: number, seed: number): number {
  // Combine step and seed with large primes for good mixing
  let h = ((step * 2654435761) ^ (seed * 1597334677)) >>> 0;
  // Mix bits
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  h = (h ^ (h >>> 16)) >>> 0;
  // Convert to [-1, 1] range
  return (h / 2147483648) - 1;
}

/**
 * Random waveform - Bipolar (-1 to +1)
 * Sample-and-hold with 16 steps per cycle
 *
 * @param phase - Current phase (0-1)
 * @param seed - Seed for reproducibility (default 0)
 */
export function sampleRandom(phase: number, seed: number = 0): number {
  const steps = 16;
  const step = Math.floor(phase * steps) % steps;
  return seededRandom(step, seed);
}

/**
 * Random waveform with SLEW (smoothing between steps)
 * Interpolates from previous to current value using smoothstep
 *
 * @param phase - Current phase (0-1)
 * @param slew - Slew amount (0-127). 0 = sharp S&H, 127 = max smoothing
 * @param seed - Seed for reproducibility
 */
export function sampleRandomWithSlew(
  phase: number,
  slew: number,
  seed: number = 0
): number {
  const steps = 16;
  const step = Math.floor(phase * steps) % steps;
  const prevStep = (step - 1 + steps) % steps;
  const stepProgress = (phase * steps) % 1;

  const currentValue = seededRandom(step, seed);
  const prevValue = seededRandom(prevStep, seed);

  // slew: 0 = sharp S&H, 127 = maximum smoothing
  const slewAmount = slew / 127;
  if (slewAmount <= 0) {
    return currentValue;
  }

  // Smoothstep interpolation
  const t = stepProgress;
  const smoothT = t * t * (3 - 2 * t);
  const interpT = smoothT * slewAmount;

  return prevValue + (currentValue - prevValue) * interpT;
}

// ===== UTILITY FUNCTIONS =====

/**
 * Check if a waveform is unipolar (0 to +1) vs bipolar (-1 to +1)
 */
export function isUnipolar(waveform: Waveform): boolean {
  return waveform === 'EXP' || waveform === 'RMP';
}

/**
 * Sample any waveform by type
 * Note: Does NOT handle negative speed transformation - use sampleWithSpeed for that
 *
 * @param waveform - Waveform type
 * @param phase - Current phase (0-1)
 * @param seed - Seed for RND waveform (default 0)
 */
export function sampleWaveform(
  waveform: Waveform,
  phase: number,
  seed: number = 0
): number {
  switch (waveform) {
    case 'TRI':
      return sampleTriangle(phase);
    case 'SIN':
      return sampleSine(phase);
    case 'SQR':
      return sampleSquare(phase);
    case 'SAW':
      return sampleSawtooth(phase);
    case 'EXP':
      return sampleExpDecay(phase);
    case 'RMP':
      return sampleRamp(phase);
    case 'RND':
      return sampleRandom(phase, seed);
  }
}
