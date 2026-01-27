/**
 * Core pure functions for Elektron Digitakt II LFO
 *
 * These functions are:
 * - Pure (no side effects)
 * - Self-contained (no external state)
 * - Worklet-compatible (can be used in React Native Reanimated worklets)
 *
 * Usage in elektron-lfo engine:
 *   import { sampleWaveform, computeLFOOutput } from './core';
 *
 * Usage in React Native (wtlfo):
 *   import { sampleWaveform } from 'elektron-lfo/core';
 *   // Wrap in worklet directive
 *   function sampleWaveformWorklet(...) { 'worklet'; return sampleWaveform(...); }
 */

// Waveform sampling
export {
  sampleTriangle,
  sampleSine,
  sampleSquare,
  sampleSawtooth,
  sampleRamp,
  sampleExpDecay,
  sampleExpRise,
  seededRandom,
  sampleRandom,
  sampleRandomWithSlew,
  isUnipolar,
  sampleWaveform,
} from './waveforms';

// Output transformations
export {
  sampleWithSpeed,
  applyDepthScale,
  computeLFOOutput,
} from './transforms';

// Fade envelope
export {
  calculateFadeCycles,
  calculateFadeMultiplier,
  calculateFadeProgress,
  getInitialFadeState,
} from './fade';
