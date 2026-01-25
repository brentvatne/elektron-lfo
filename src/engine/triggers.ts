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
export function handleTrigger(
  config: LFOConfig,
  state: LFOState,
  currentRawOutput: number
): LFOState {
  const newState = { ...state };
  newState.triggerCount++;

  switch (config.mode) {
    case 'FRE':
      // Free running - triggers are ignored
      // LFO continues without interruption
      break;

    case 'TRG':
      // Trigger mode - reset phase and fade
      newState.phase = newState.startPhaseNormalized;
      newState.previousPhase = newState.startPhaseNormalized;
      newState.fadeProgress = 0;
      newState.fadeMultiplier = config.fade < 0 ? 0 : 1;
      newState.cycleCount = 0;
      // Generate new random value on trigger for RND waveform
      if (config.waveform === 'RND') {
        newState.randomValue = Math.random() * 2 - 1;
        newState.randomStep = Math.floor(newState.phase * 16);
      }
      break;

    case 'HLD':
      // Hold mode - capture current output, LFO continues in background
      newState.heldOutput = currentRawOutput;
      // Note: Phase continues running, only output is held
      // Fade resets on trigger
      newState.fadeProgress = 0;
      newState.fadeMultiplier = config.fade < 0 ? 0 : 1;
      break;

    case 'ONE':
      // One-shot mode - reset and run one complete cycle
      newState.phase = newState.startPhaseNormalized;
      newState.previousPhase = newState.startPhaseNormalized;
      newState.isRunning = true;
      newState.hasTriggered = true;
      newState.fadeProgress = 0;
      newState.fadeMultiplier = config.fade < 0 ? 0 : 1;
      newState.cycleCount = 0;
      if (config.waveform === 'RND') {
        newState.randomValue = Math.random() * 2 - 1;
        newState.randomStep = Math.floor(newState.phase * 16);
      }
      break;

    case 'HLF':
      // Half mode - reset and run half cycle
      newState.phase = newState.startPhaseNormalized;
      newState.previousPhase = newState.startPhaseNormalized;
      newState.isRunning = true;
      newState.hasTriggered = true;
      newState.fadeProgress = 0;
      newState.fadeMultiplier = config.fade < 0 ? 0 : 1;
      newState.cycleCount = 0;
      if (config.waveform === 'RND') {
        newState.randomValue = Math.random() * 2 - 1;
        newState.randomStep = Math.floor(newState.phase * 16);
      }
      break;
  }

  return newState;
}

/**
 * Check if the LFO should stop based on mode and phase
 *
 * For ONE mode: Stop when phase wraps and returns to start phase (one complete cycle)
 * For HLF mode: Stop when phase reaches 0.5 past start phase (half cycle)
 */
export function checkModeStop(
  config: LFOConfig,
  state: LFOState,
  previousPhase: number,
  currentPhase: number
): { shouldStop: boolean; cycleCompleted: boolean } {
  // Only ONE and HLF modes can stop
  if (config.mode !== 'ONE' && config.mode !== 'HLF') {
    return { shouldStop: false, cycleCompleted: false };
  }

  // Need to have been triggered to run
  if (!state.hasTriggered) {
    return { shouldStop: true, cycleCompleted: false };
  }

  const startPhase = state.startPhaseNormalized;
  const isForward = config.speed >= 0;

  if (config.mode === 'ONE') {
    // ONE mode: Stop immediately when phase completes one wrap (cycleCount >= 1)
    // Based on Digitakt II hardware testing (January 2025):
    // - Phase runs from startPhase until it wraps (crosses 1.0→0.0 or 0.0→1.0)
    // - Stops immediately on wrap, does NOT continue back to startPhase
    // - This means non-zero startPhase values result in partial amplitude coverage:
    //   - Phase=0: full amplitude range (0→1→0, complete waveform)
    //   - Phase=32: full amplitude range (0.25→1→0, starts at peak)
    //   - Phase=64: half amplitude range (0.5→1→0, starts at middle)
    //   - Phase=96: half amplitude range (0.75→1→0, starts at trough)
    if (state.cycleCount >= 1) {
      return { shouldStop: true, cycleCompleted: true };
    }
  } else if (config.mode === 'HLF') {
    // HLF mode: Stop after half cycle (0.5 phase distance from start)
    const halfPhase = (startPhase + 0.5) % 1;

    if (isForward) {
      // Check if we crossed the half-point
      if (startPhase < 0.5) {
        // Half point is greater than start (no wrap needed)
        if (previousPhase < halfPhase && currentPhase >= halfPhase) {
          return { shouldStop: true, cycleCompleted: true };
        }
      } else {
        // Half point wraps around through 0 (halfPhase < startPhase)
        // We need to cross 1->0 boundary first, then reach halfPhase
        if (state.cycleCount >= 1 || (previousPhase < halfPhase && currentPhase >= halfPhase)) {
          return { shouldStop: true, cycleCompleted: true };
        }
      }
    } else {
      // Backward direction: halfPhase is 0.5 BEHIND start
      const halfPhaseBackward = (startPhase - 0.5 + 1) % 1;
      if (startPhase >= 0.5) {
        // Half point is less than start (no wrap needed)
        if (previousPhase > halfPhaseBackward && currentPhase <= halfPhaseBackward) {
          return { shouldStop: true, cycleCompleted: true };
        }
      } else {
        // Half point wraps around through 1
        if (state.cycleCount >= 1 || (previousPhase > halfPhaseBackward && currentPhase <= halfPhaseBackward)) {
          return { shouldStop: true, cycleCompleted: true };
        }
      }
    }
  }

  return { shouldStop: false, cycleCompleted: false };
}

/**
 * Check if a trigger mode requires a trigger to start
 */
export function requiresTriggerToStart(mode: TriggerMode): boolean {
  return mode === 'ONE' || mode === 'HLF';
}

/**
 * Check if a trigger mode resets phase on trigger
 */
export function resetsPhaseOnTrigger(mode: TriggerMode): boolean {
  return mode === 'TRG' || mode === 'ONE' || mode === 'HLF';
}

/**
 * Check if a trigger mode resets fade on trigger
 */
export function resetsFadeOnTrigger(mode: TriggerMode): boolean {
  // FRE mode doesn't reset fade (fade doesn't work in FRE mode per spec)
  return mode !== 'FRE';
}
