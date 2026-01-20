/**
 * Timing calculations for Elektron Digitakt II LFO
 *
 * Core formulas from the spec:
 * - phase_steps_per_bar = |SPD| × MULT
 * - cycle_time_ms = (60000 / BPM) × 4 × (128 / (|SPD| × MULT))
 * - frequency_hz = (BPM / 60) × (|SPD| × MULT / 128)
 */
import type { LFOConfig, TimingInfo } from './types';
/**
 * Calculate the product of |SPD| × MULT
 */
export declare function calculateProduct(config: LFOConfig): number;
/**
 * Calculate cycle time in milliseconds
 *
 * Formula: cycle_time_ms = (60000 / BPM) × 4 × (128 / product)
 */
export declare function calculateCycleTimeMs(config: LFOConfig, bpm: number): number;
/**
 * Calculate LFO frequency in Hz
 *
 * Frequency is simply 1 / cycleTime in seconds
 * frequency_hz = 1000 / cycleTimeMs
 */
export declare function calculateFrequencyHz(config: LFOConfig, bpm: number): number;
/**
 * Calculate phase increment per millisecond
 *
 * Phase goes from 0 to 1 over one cycle
 * Increment = 1 / cycle_time_ms (for positive speed)
 * Increment = -1 / cycle_time_ms (for negative speed)
 */
export declare function calculatePhaseIncrement(config: LFOConfig, bpm: number): number;
/**
 * Calculate cycles per bar
 *
 * At product = 128, we get exactly 1 cycle per bar
 * At product > 128, we get product/128 cycles per bar
 * At product < 128, we get product/128 cycles per bar (fraction)
 */
export declare function calculateCyclesPerBar(config: LFOConfig): number;
/**
 * Convert product to musical note value string
 */
export declare function calculateNoteValue(product: number): string;
/**
 * Calculate complete timing information
 */
export declare function calculateTimingInfo(config: LFOConfig, bpm: number): TimingInfo;
/**
 * Format cycle time for display
 */
export declare function formatCycleTime(cycleTimeMs: number): string;
/**
 * Format frequency for display
 */
export declare function formatFrequency(frequencyHz: number): string;
