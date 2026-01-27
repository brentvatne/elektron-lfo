/**
 * Elektron LFO Engine
 *
 * A TypeScript implementation of the Elektron Digitakt II LFO engine
 */

// Main LFO class
export { LFO } from './lfo';

// Types
export type {
  Waveform,
  TriggerMode,
  Multiplier,
  LFOConfig,
  LFOState,
  TimingInfo,
} from './types';

export {
  DEFAULT_CONFIG,
  createInitialState,
  clamp,
  VALID_MULTIPLIERS,
  isValidMultiplier,
} from './types';

// Waveform functions
export {
  generateTriangle,
  generateSine,
  generateSquare,
  generateSawtooth,
  generateExponential,
  generateExponentialRise,
  generateRamp,
  generateRandom,
  generateWaveform,
  isUnipolar,
  getWaveformRange,
} from './waveforms';

// Timing functions
export {
  calculateProduct,
  calculateCycleTimeMs,
  calculateFrequencyHz,
  calculatePhaseIncrement,
  calculateCyclesPerBar,
  calculateNoteValue,
  calculateTimingInfo,
  formatCycleTime,
  formatFrequency,
} from './timing';

// Trigger functions
export {
  handleTrigger,
  checkModeStop,
  requiresTriggerToStart,
  resetsPhaseOnTrigger,
  resetsFadeOnTrigger,
} from './triggers';

// Fade functions
export {
  calculateFadeMultiplier,
  calculateFadeCycles,
  updateFade,
  resetFade,
  shouldResetFadeOnTrigger,
  applyFade,
} from './fade';
