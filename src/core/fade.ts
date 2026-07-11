/**
 * Fade envelope functions for Elektron Digitakt II LFO
 *
 * Fade behavior:
 * - FADE = 0: No fade, full modulation immediately
 * - FADE < 0 (negative): Fade IN - starts at 0, increases to full
 * - FADE > 0 (positive): Fade OUT - starts at full, decreases to 0
 *
 * IMPORTANT: Higher |FADE| = SLOWER fade (more cycles to complete)
 * This formula was derived from Digitakt II hardware measurements (January 2025)
 */

/**
 * Calculate the number of LFO cycles for a complete fade
 *
 * Based on empirical testing against Digitakt II hardware:
 *
 * Key observations:
 * - |FADE| <= 16: Linear region, ~1 cycle at FADE=4, ~2.2 cycles at FADE=16
 * - |FADE| > 16: Exponential slowdown, doubling every ~4.5 units
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
 * DO NOT MODIFY without hardware verification.
 *
 * @param fadeValue - The FADE parameter (-64 to +63)
 * @returns Number of cycles for complete fade
 */
export function calculateFadeCycles(fadeValue: number): number {
  if (fadeValue === 0) {
    return 0;
  }

  const absFade = Math.abs(fadeValue);

  // Linear region (|FADE| <= 16): ~1 cycle at FADE=4, ~2.2 cycles at FADE=16
  if (absFade <= 16) {
    return Math.max(0.5, 0.1 * absFade + 0.6);
  }

  // Exponential region (|FADE| > 16): starts at 2.2 cycles at FADE=16
  // Doubles every ~4.5 units of |FADE|
  const baseAt16 = 2.2;
  return baseAt16 * Math.pow(2, (absFade - 16) / 4.5);
}

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
  const progress = fadeProgress < 0 ? 0 : fadeProgress > 1 ? 1 : fadeProgress;

  if (fadeValue < 0) {
    // Fade IN: starts at 0, increases to 1
    return progress;
  } else {
    // Fade OUT: starts at 1, decreases to 0
    return 1 - progress;
  }
}

/**
 * Calculate fade progress from elapsed cycles
 *
 * @param elapsedCycles - Number of LFO cycles elapsed since fade started
 * @param fadeValue - The FADE parameter (-64 to +63)
 * @returns Progress through fade (0.0 to 1.0)
 */
export function calculateFadeProgress(
  elapsedCycles: number,
  fadeValue: number
): number {
  if (fadeValue === 0) {
    return 1;
  }

  const totalCycles = calculateFadeCycles(fadeValue);
  const progress = elapsedCycles / totalCycles;
  return progress > 1 ? 1 : progress;
}

/**
 * Get initial fade state for a given fade value
 *
 * @param fadeValue - The FADE parameter (-64 to +63)
 * @returns Initial fadeProgress and fadeMultiplier
 */
export function getInitialFadeState(fadeValue: number): {
  fadeProgress: number;
  fadeMultiplier: number;
} {
  if (fadeValue === 0) {
    return { fadeProgress: 1, fadeMultiplier: 1 };
  }

  if (fadeValue < 0) {
    // Fade IN: start at 0
    return { fadeProgress: 0, fadeMultiplier: 0 };
  } else {
    // Fade OUT: start at 1
    return { fadeProgress: 0, fadeMultiplier: 1 };
  }
}
