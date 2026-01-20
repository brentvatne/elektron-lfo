/**
 * Main LFO class for Elektron Digitakt II LFO engine
 *
 * This class ties together all the components:
 * - Waveform generation
 * - Timing calculations
 * - Trigger mode handling
 * - Fade envelope
 */
import type { LFOConfig, LFOState, TimingInfo } from './types';
export declare class LFO {
    private config;
    private state;
    private bpm;
    private lastUpdateTime;
    constructor(config?: Partial<LFOConfig>, bpm?: number);
    /**
     * Update the LFO state based on elapsed time
     *
     * @param currentTimeMs - Current time in milliseconds (e.g., performance.now())
     * @returns The current LFO state
     */
    update(currentTimeMs: number): LFOState;
    /**
     * Trigger the LFO
     */
    trigger(): void;
    /**
     * Get current state
     */
    getState(): LFOState;
    /**
     * Get current configuration
     */
    getConfig(): LFOConfig;
    /**
     * Update configuration
     */
    setConfig(config: Partial<LFOConfig>): void;
    /**
     * Set BPM
     */
    setBpm(bpm: number): void;
    /**
     * Get current BPM
     */
    getBpm(): number;
    /**
     * Get timing information
     */
    getTimingInfo(): TimingInfo;
    /**
     * Reset the LFO to initial state
     */
    reset(): void;
    /**
     * Check if the LFO is running
     */
    isRunning(): boolean;
    /**
     * Get the current output value
     */
    getOutput(): number;
    /**
     * Get the current phase (0-1)
     */
    getPhase(): number;
    /**
     * Start the LFO (for ONE/HLF modes that are stopped)
     */
    start(): void;
    /**
     * Stop the LFO
     */
    stop(): void;
}
