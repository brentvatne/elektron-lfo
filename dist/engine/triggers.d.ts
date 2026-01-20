/**
 * Trigger mode handling for Elektron Digitakt II LFO
 *
 * Trigger Modes:
 * - FRE (Free): LFO runs continuously, triggers ignored
 * - TRG (Trigger): Restarts LFO phase and fade on trigger
 * - HLD (Hold): Captures and holds output on trigger, LFO continues in background
 * - ONE (One-shot): Runs one complete cycle then stops, can be retriggered
 * - HLF (Half): Runs half cycle then stops, can be retriggered
 */
import type { LFOConfig, LFOState, TriggerMode } from './types';
/**
 * Handle a trigger event based on the current mode
 * Returns updated state after trigger processing
 */
export declare function handleTrigger(config: LFOConfig, state: LFOState, currentRawOutput: number): LFOState;
/**
 * Check if the LFO should stop based on mode and phase
 *
 * For ONE mode: Stop when phase wraps and returns to start phase (one complete cycle)
 * For HLF mode: Stop when phase reaches 0.5 past start phase (half cycle)
 */
export declare function checkModeStop(config: LFOConfig, state: LFOState, previousPhase: number, currentPhase: number): {
    shouldStop: boolean;
    cycleCompleted: boolean;
};
/**
 * Check if a trigger mode requires a trigger to start
 */
export declare function requiresTriggerToStart(mode: TriggerMode): boolean;
/**
 * Check if a trigger mode resets phase on trigger
 */
export declare function resetsPhaseOnTrigger(mode: TriggerMode): boolean;
/**
 * Check if a trigger mode resets fade on trigger
 */
export declare function resetsFadeOnTrigger(mode: TriggerMode): boolean;
