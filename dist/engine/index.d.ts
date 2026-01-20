/**
 * Elektron LFO Engine
 *
 * A TypeScript implementation of the Elektron Digitakt II LFO engine
 */
export { LFO } from './lfo';
export type { Waveform, TriggerMode, Multiplier, LFOConfig, LFOState, TimingInfo, } from './types';
export { DEFAULT_CONFIG, createInitialState, clamp, VALID_MULTIPLIERS, isValidMultiplier, } from './types';
export { generateTriangle, generateSine, generateSquare, generateSawtooth, generateExponential, generateRamp, generateRandom, generateWaveform, isUnipolar, getWaveformRange, } from './waveforms';
export { calculateProduct, calculateCycleTimeMs, calculateFrequencyHz, calculatePhaseIncrement, calculateCyclesPerBar, calculateNoteValue, calculateTimingInfo, formatCycleTime, formatFrequency, } from './timing';
export { handleTrigger, checkModeStop, requiresTriggerToStart, resetsPhaseOnTrigger, resetsFadeOnTrigger, } from './triggers';
export { calculateFadeMultiplier, calculateFadeCycles, updateFade, resetFade, shouldResetFadeOnTrigger, applyFade, } from './fade';
