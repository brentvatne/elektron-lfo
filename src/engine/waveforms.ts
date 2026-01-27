/**
 * Waveform generators for Elektron Digitakt II LFO
 *
 * This module re-exports pure sampling functions from core/
 * and provides the stateful generateWaveform/generateRandom functions
 * needed by the engine.
 */

import type { Waveform, LFOState } from './types';

// Re-export pure sampling functions from core
export {
  sampleTriangle as generateTriangle,
  sampleSine as generateSine,
  sampleSquare as generateSquare,
  sampleSawtooth as generateSawtooth,
  sampleExpDecay as generateExponential,
  sampleExpRise as generateExponentialRise,
  sampleRamp as generateRamp,
  isUnipolar,
} from '../core/waveforms';

// Import for internal use
import {
  sampleTriangle,
  sampleSine,
  sampleSquare,
  sampleSawtooth,
  sampleExpDecay,
  sampleRamp,
  isUnipolar,
} from '../core/waveforms';

/**
 * Random waveform - Bipolar (-1 to +1)
 * Sample-and-hold with 16 steps per cycle (16x frequency)
 *
 * NOTE: This uses Math.random() for true randomness, unlike the seeded
 * version in core/ which is deterministic. The engine needs true randomness
 * to match Digitakt II behavior where each cycle produces new random values.
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
      return { value: sampleTriangle(phase) };
    case 'SIN':
      return { value: sampleSine(phase) };
    case 'SQR':
      return { value: sampleSquare(phase) };
    case 'SAW':
      return { value: sampleSawtooth(phase) };
    case 'EXP':
      return { value: sampleExpDecay(phase) };
    case 'RMP':
      return { value: sampleRamp(phase) };
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
 * Get the range of a waveform
 */
export function getWaveformRange(waveform: Waveform): { min: number; max: number } {
  if (isUnipolar(waveform)) {
    return { min: 0, max: 1 };
  }
  return { min: -1, max: 1 };
}
