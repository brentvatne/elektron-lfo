/**
 * Fade envelope system for Elektron Digitakt II LFO
 *
 * Fade behavior:
 * - FADE = 0: No fade, full modulation immediately
 * - FADE < 0 (negative): Fade IN - starts at 0, increases to full over |FADE| cycles
 * - FADE > 0 (positive): Fade OUT - starts at full, decreases to 0 over FADE cycles
 *
 * Important notes from research:
 * - Fade does NOT work in FRE mode (requires trigger to initiate)
 * - Fade resets on trigger for TRG, ONE, HLF, and HLD modes
 * - Fade timing is relative to LFO cycles, not absolute time
 */

import type { LFOConfig, LFOState, TriggerMode } from './types';

/**
 * Calculate the fade multiplier based on fade progress
 *
 * @param fadeValue - The FADE parameter (-64 to +63)
 * @param fadeProgress - Progress through the fade (0.0 to 1.0)
 * @returns The fade multiplier (0.0 to 1.0)
 */
export function calculateFadeMultiplier(
  fadeValue: number,
  fadeProgress: number
): number {
  if (fadeValue === 0) {
    // No fade - always full modulation
    return 1;
  }

  // Clamp progress to 0-1 range
  const progress = Math.max(0, Math.min(1, fadeProgress));

  if (fadeValue < 0) {
    // Fade IN: starts at 0, increases to 1
    // Linear interpolation from 0 to 1
    return progress;
  } else {
    // Fade OUT: starts at 1, decreases to 0
    // Linear interpolation from 1 to 0
    return 1 - progress;
  }
}

/**
 * Calculate fade cycles - how many LFO cycles for complete fade
 *
 * Based on empirical testing against Digitakt II hardware (January 2025):
 *
 * Key observations:
 * - |FADE| <= 16: Linear region, ~1 cycle at FADE=4, ~2.2 cycles at FADE=16
 * - |FADE| > 16: Exponential slowdown, doubling every ~4.7 units
 * - NO "disabled" threshold - even |FADE|=63 continues fading, just very slowly
 *
 * Measured values:
 *   |FADE| = 4:  ~1 cycle
 *   |FADE| = 8:  ~1.6 cycles
 *   |FADE| = 16: ~2.2 cycles
 *   |FADE| = 24: ~7 cycles
 *   |FADE| = 32: ~26 cycles
 *   |FADE| = 40: ~90 cycles
 *   |FADE| = 48: ~320 cycles
 *   |FADE| = 56: ~1100 cycles
 *   |FADE| = 63: ~3300 cycles
 *
 * IMPORTANT: Higher |FADE| = SLOWER fade (opposite of what you might expect)
 */
export function calculateFadeCycles(fadeValue: number): number {
  if (fadeValue === 0) return 0;

  const absFade = Math.abs(fadeValue);

  // Linear region (|FADE| <= 16): ~1 cycle at FADE=4, ~2.2 cycles at FADE=16
  // Formula: 0.1 * |FADE| + 0.6, with minimum of 0.5
  if (absFade <= 16) {
    return Math.max(0.5, 0.1 * absFade + 0.6);
  }

  // Exponential region (|FADE| > 16): starts at 2.2 cycles at FADE=16
  // Doubles every ~4.5 units of |FADE|
  const baseAt16 = 2.2;
  return baseAt16 * Math.pow(2, (absFade - 16) / 4.5);
}

/**
 * Update fade progress based on elapsed time
 *
 * @param config - LFO configuration
 * @param state - Current LFO state
 * @param cycleTimeMs - Duration of one LFO cycle in milliseconds
 * @param deltaMs - Time elapsed since last update
 * @returns Updated fade progress and multiplier
 */
export function updateFade(
  config: LFOConfig,
  state: LFOState,
  cycleTimeMs: number,
  deltaMs: number
): { fadeProgress: number; fadeMultiplier: number } {
  // No fade or FRE mode - fade doesn't work in FRE mode
  if (config.fade === 0 || config.mode === 'FRE') {
    return {
      fadeProgress: 1,
      fadeMultiplier: 1,
    };
  }

  // Calculate how many cycles the fade takes
  const fadeCycles = calculateFadeCycles(config.fade);

  // Note: There is no "disabled" threshold - even extreme fade values
  // just result in very slow fades (thousands of cycles for |FADE|=63)

  const fadeDurationMs = fadeCycles * cycleTimeMs;

  if (fadeDurationMs === 0) {
    return {
      fadeProgress: 1,
      fadeMultiplier: config.fade < 0 ? 0 : 1,
    };
  }

  // Calculate progress increment
  const progressIncrement = deltaMs / fadeDurationMs;
  const newProgress = Math.min(1, state.fadeProgress + progressIncrement);

  return {
    fadeProgress: newProgress,
    fadeMultiplier: calculateFadeMultiplier(config.fade, newProgress),
  };
}

/**
 * Reset fade state (called on trigger for modes that reset fade)
 *
 * Note: There is no "disabled" threshold - even extreme fade values
 * will eventually complete, just over thousands of cycles.
 */
export function resetFade(config: LFOConfig): { fadeProgress: number; fadeMultiplier: number } {
  if (config.fade === 0) {
    return { fadeProgress: 1, fadeMultiplier: 1 };
  }

  if (config.fade < 0) {
    // Fade IN: start at 0
    return { fadeProgress: 0, fadeMultiplier: 0 };
  } else {
    // Fade OUT: start at 1
    return { fadeProgress: 0, fadeMultiplier: 1 };
  }
}

/**
 * Check if fade should reset on trigger for a given mode
 */
export function shouldResetFadeOnTrigger(mode: TriggerMode): boolean {
  // FRE mode never resets fade (and fade doesn't work in FRE mode)
  return mode !== 'FRE';
}

/**
 * Apply fade multiplier to output value
 */
export function applyFade(rawOutput: number, fadeMultiplier: number): number {
  return rawOutput * fadeMultiplier;
}
