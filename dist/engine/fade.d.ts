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
export declare function calculateFadeMultiplier(fadeValue: number, fadeProgress: number): number;
/**
 * Calculate fade cycles - how many LFO cycles for complete fade
 *
 * The FADE parameter (-64 to +63) maps to fade duration in cycles:
 * - |FADE| / 64 gives the number of cycles (approximately)
 * - At |FADE| = 64, fade takes 1 cycle
 * - At |FADE| = 32, fade takes 0.5 cycles
 * - At |FADE| = 1, fade takes ~1/64 of a cycle
 */
export declare function calculateFadeCycles(fadeValue: number): number;
/**
 * Update fade progress based on elapsed time
 *
 * @param config - LFO configuration
 * @param state - Current LFO state
 * @param cycleTimeMs - Duration of one LFO cycle in milliseconds
 * @param deltaMs - Time elapsed since last update
 * @returns Updated fade progress and multiplier
 */
export declare function updateFade(config: LFOConfig, state: LFOState, cycleTimeMs: number, deltaMs: number): {
    fadeProgress: number;
    fadeMultiplier: number;
};
/**
 * Reset fade state (called on trigger for modes that reset fade)
 */
export declare function resetFade(config: LFOConfig): {
    fadeProgress: number;
    fadeMultiplier: number;
};
/**
 * Check if fade should reset on trigger for a given mode
 */
export declare function shouldResetFadeOnTrigger(mode: TriggerMode): boolean;
/**
 * Apply fade multiplier to output value
 */
export declare function applyFade(rawOutput: number, fadeMultiplier: number): number;
