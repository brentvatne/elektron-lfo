/**
 * Waveform generators for Elektron Digitakt II LFO
 *
 * Most waveforms are bipolar (-1 to +1).
 * RMP and EXP are unipolar (0 to +1) - depth parameter handles negative modulation.
 */

import type { Waveform, LFOState } from './types';

/**
 * Triangle waveform - Bipolar
 * Starts at 0, peaks at +1 at phase 0.25, troughs at -1 at phase 0.75
 */
export function generateTriangle(phase: number): number {
  if (phase < 0.25) {
    return phase * 4; // 0 to +1
  }
  if (phase < 0.75) {
    return 1 - (phase - 0.25) * 4; // +1 to -1
  }
  return -1 + (phase - 0.75) * 4; // -1 to 0
}

/**
 * Sine waveform - Bipolar
 * Standard sine wave starting at 0
 */
export function generateSine(phase: number): number {
  return Math.sin(phase * 2 * Math.PI);
}

/**
 * Square waveform - Bipolar
 * +1 for first half, -1 for second half
 */
export function generateSquare(phase: number): number {
  return phase < 0.5 ? 1 : -1;
}

/**
 * Sawtooth waveform - Bipolar
 * Linear fall from +1 to -1 (matches Digitakt II behavior)
 */
export function generateSawtooth(phase: number): number {
  return 1 - phase * 2;
}

/**
 * Exponential waveform - Unipolar (0 to +1)
 * Decaying curve from +1 to 0 (matches Digitakt II behavior)
 * Fast initial decay, slowing toward the end (true exponential decay shape)
 */
export function generateExponential(phase: number): number {
  const k = 3; // Decay rate - controls steepness of decay
  // True exponential decay normalized to [1, 0]
  const expK = Math.exp(-k);
  return (Math.exp(-phase * k) - expK) / (1 - expK);
}

/**
 * Ramp waveform - Unipolar (0 to +1)
 * Linear rise from 0 to +1 (matches Digitakt II behavior)
 */
export function generateRamp(phase: number): number {
  return phase;
}

/**
 * Random waveform - Bipolar (-1 to +1)
 * Sample-and-hold with 16 steps per cycle (16x frequency)
 *
 * Returns the current random value and potentially a new random value
 * if a step boundary was crossed.
 */
export function generateRandom(
  phase: number,
  state: LFOState
): { value: number; newRandomValue: number; newRandomStep: number } {
  // 16 steps per cycle
  const stepsPerCycle = 16;
  const currentStep = Math.floor(phase * stepsPerCycle);

  // Check if we crossed a step boundary
  if (currentStep !== state.randomStep) {
    // Generate new random value between -1 and +1
    const newRandomValue = Math.random() * 2 - 1;
    return {
      value: newRandomValue,
      newRandomValue,
      newRandomStep: currentStep,
    };
  }

  // No step change, return current value
  return {
    value: state.randomValue,
    newRandomValue: state.randomValue,
    newRandomStep: state.randomStep,
  };
}

/**
 * Generate waveform output for a given phase and waveform type
 */
export function generateWaveform(
  waveform: Waveform,
  phase: number,
  state: LFOState
): { value: number; newRandomValue?: number; newRandomStep?: number } {
  switch (waveform) {
    case 'TRI':
      return { value: generateTriangle(phase) };
    case 'SIN':
      return { value: generateSine(phase) };
    case 'SQR':
      return { value: generateSquare(phase) };
    case 'SAW':
      return { value: generateSawtooth(phase) };
    case 'EXP':
      return { value: generateExponential(phase) };
    case 'RMP':
      return { value: generateRamp(phase) };
    case 'RND': {
      const result = generateRandom(phase, state);
      return {
        value: result.value,
        newRandomValue: result.newRandomValue,
        newRandomStep: result.newRandomStep,
      };
    }
    default: {
      // Exhaustive check
      const _exhaustive: never = waveform;
      throw new Error(`Unknown waveform: ${_exhaustive}`);
    }
  }
}

/**
 * Check if a waveform is unipolar (0 to +1) vs bipolar (-1 to +1)
 * RMP and EXP are unipolar - depth parameter handles negative modulation
 */
export function isUnipolar(waveform: Waveform): boolean {
  return waveform === 'RMP' || waveform === 'EXP';
}

/**
 * Get the range of a waveform
 */
export function getWaveformRange(waveform: Waveform): { min: number; max: number } {
  if (isUnipolar(waveform)) {
    return { min: 0, max: 1 };
  }
  return { min: -1, max: 1 };
}
