/**
 * Terminal display for Elektron LFO CLI
 *
 * Renders the LFO state with ASCII waveform visualization
 */
import type { LFOConfig, LFOState, TimingInfo } from '../engine/types';
/**
 * Render the full display
 */
export declare function render(config: LFOConfig, state: LFOState, timing: TimingInfo, bpm: number): string;
