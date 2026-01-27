/**
 * Fade envelope system for Elektron Digitakt II LFO
 *
 * This module re-exports pure fade functions from core/
 * and provides the stateful functions needed by the engine.
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

// Re-export pure functions from core
export {
  calculateFadeCycles,
  calculateFadeMultiplier,
  calculateFadeProgress,
  getInitialFadeState,
} from '../core/fade';

// Import for internal use
import {
  calculateFadeCycles,
  calculateFadeMultiplier,
} from '../core/fade';

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
