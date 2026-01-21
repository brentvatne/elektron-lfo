/**
 * Waveform generators for Elektron Digitakt II LFO
 *
 * Waveform types:
 * - Bipolar (-1 to +1): TRI, SIN, SQR, SAW, RND
 * - Unipolar (0 to +1): EXP, RMP
 */
import type { Waveform, LFOState } from './types';
/**
 * Triangle waveform - Bipolar
 * Starts at 0, peaks at +1 at phase 0.25, troughs at -1 at phase 0.75
 */
export declare function generateTriangle(phase: number): number;
/**
 * Sine waveform - Bipolar
 * Standard sine wave starting at 0
 */
export declare function generateSine(phase: number): number;
/**
 * Square waveform - Bipolar
 * +1 for first half, -1 for second half
 */
export declare function generateSquare(phase: number): number;
/**
 * Sawtooth waveform - Bipolar
 * Linear fall from +1 to -1 (with positive depth)
 */
export declare function generateSawtooth(phase: number): number;
/**
 * Exponential waveform - Unipolar (0 to +1)
 * Accelerating curve from 0 to 1
 */
export declare function generateExponential(phase: number): number;
/**
 * Ramp waveform - Unipolar (0 to +1)
 * Linear rise from 0 to +1
 */
export declare function generateRamp(phase: number): number;
/**
 * Random waveform - Bipolar (-1 to +1)
 * Sample-and-hold with 16 steps per cycle (16x frequency)
 *
 * Returns the current random value and potentially a new random value
 * if a step boundary was crossed.
 */
export declare function generateRandom(phase: number, state: LFOState): {
    value: number;
    newRandomValue: number;
    newRandomStep: number;
};
/**
 * Generate waveform output for a given phase and waveform type
 */
export declare function generateWaveform(waveform: Waveform, phase: number, state: LFOState): {
    value: number;
    newRandomValue?: number;
    newRandomStep?: number;
};
/**
 * Check if a waveform is unipolar (0 to +1) vs bipolar (-1 to +1)
 */
export declare function isUnipolar(waveform: Waveform): boolean;
/**
 * Get the range of a waveform
 */
export declare function getWaveformRange(waveform: Waveform): {
    min: number;
    max: number;
};
