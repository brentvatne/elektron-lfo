/**
 * Elektron LFO
 *
 * A TypeScript implementation of the Elektron Digitakt II LFO engine
 * with real-time terminal visualization.
 *
 * @example
 * ```typescript
 * import { LFO } from 'elektron-lfo';
 *
 * const lfo = new LFO({
 *   waveform: 'SIN',
 *   speed: 16,
 *   multiplier: 8,
 *   mode: 'TRG',
 *   depth: 63,
 * }, 120);
 *
 * // Update at 60fps
 * setInterval(() => {
 *   const state = lfo.update(performance.now());
 *   console.log('Output:', state.output);
 * }, 1000 / 60);
 *
 * // Trigger the LFO
 * lfo.trigger();
 * ```
 */
export * from './engine';
