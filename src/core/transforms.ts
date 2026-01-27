/**
 * Output transformation functions for Elektron Digitakt II LFO
 *
 * These functions handle the transformation pipeline:
 * 1. Sample waveform (with speed-direction awareness)
 * 2. Apply depth scaling
 * 3. Apply fade multiplier
 */

import type { Waveform } from '../engine/types';
import {
  sampleWaveform,
  sampleExpDecay,
  sampleExpRise,
  isUnipolar,
} from './waveforms';

/**
 * Sample waveform with speed-direction awareness
 *
 * Handles the special cases:
 * - EXP with negative speed: uses rise formula instead of decay (maintains concave shape)
 * - RMP with negative speed: flips value (1 - x)
 * - Bipolar waveforms with negative speed: inverts polarity (-x)
 *
 * @param waveform - Waveform type
 * @param phase - Current phase (0-1)
 * @param speed - Speed parameter (-64 to +63)
 * @param seed - Seed for RND waveform (default 0)
 */
export function sampleWithSpeed(
  waveform: Waveform,
  phase: number,
  speed: number,
  seed: number = 0
): number {
  // EXP special case: use different formula for negative speed
  // This maintains the concave shape in both directions
  if (waveform === 'EXP') {
    if (speed < 0) {
      return sampleExpRise(phase);
    } else {
      return sampleExpDecay(phase);
    }
  }

  // Sample normally
  let value = sampleWaveform(waveform, phase, seed);

  // Apply speed polarity transform for non-EXP waveforms
  if (speed < 0) {
    if (isUnipolar(waveform)) {
      // RMP: flip value
      value = 1 - value;
    } else {
      // Bipolar: invert polarity
      value = -value;
    }
  }

  return value;
}

/**
 * Apply depth scaling to a waveform value
 *
 * Depth range is -64 to +63 (asymmetric, matching Digitakt II)
 * - Depth 63 = 100% positive modulation
 * - Depth 0 = no modulation
 * - Depth -64 = 100% inverted modulation
 *
 * @param value - Raw waveform value
 * @param depth - Depth parameter (-64 to +63)
 */
export function applyDepthScale(value: number, depth: number): number {
  // Clamp to valid range
  const d = depth < -64 ? -64 : depth > 63 ? 63 : depth;
  // Scale: negative uses /64, positive uses /63
  const scale = d >= 0 ? d / 63 : d / 64;
  return value * scale;
}

/**
 * Complete LFO output transformation pipeline
 *
 * Combines all transformations in the correct order:
 * 1. Sample waveform with speed awareness
 * 2. Apply depth scaling
 * 3. Apply fade multiplier
 *
 * @param waveform - Waveform type
 * @param phase - Current phase (0-1)
 * @param speed - Speed parameter (-64 to +63)
 * @param depth - Depth parameter (-64 to +63)
 * @param fadeMultiplier - Fade envelope multiplier (0-1, default 1)
 * @param seed - Seed for RND waveform (default 0)
 */
export function computeLFOOutput(
  waveform: Waveform,
  phase: number,
  speed: number,
  depth: number,
  fadeMultiplier: number = 1,
  seed: number = 0
): number {
  // 1. Sample with speed awareness
  let value = sampleWithSpeed(waveform, phase, speed, seed);

  // 2. Apply depth scaling
  value = applyDepthScale(value, depth);

  // 3. Apply fade
  value = value * fadeMultiplier;

  return value;
}
