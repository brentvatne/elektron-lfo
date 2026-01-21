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
import { DEFAULT_CONFIG, createInitialState, clamp } from './types';
import { generateWaveform, isUnipolar } from './waveforms';
import {
  calculatePhaseIncrement,
  calculateTimingInfo,
  calculateCycleTimeMs,
} from './timing';
import { handleTrigger, checkModeStop } from './triggers';
import { updateFade, resetFade } from './fade';

export class LFO {
  private config: LFOConfig;
  private state: LFOState;
  private bpm: number;
  private lastUpdateTime: number;

  constructor(config: Partial<LFOConfig> = {}, bpm: number = 120) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.bpm = bpm;
    this.state = createInitialState(this.config);
    this.lastUpdateTime = 0;

    // For FRE mode, fade is always 1 (fade doesn't work in FRE mode)
    if (this.config.mode === 'FRE') {
      this.state.fadeMultiplier = 1;
      this.state.fadeProgress = 1;
    }

    // For ONE/HLF modes, don't run until triggered
    if (this.config.mode === 'ONE' || this.config.mode === 'HLF') {
      this.state.isRunning = false;
    }
  }

  /**
   * Update the LFO state based on elapsed time
   *
   * @param currentTimeMs - Current time in milliseconds (e.g., performance.now())
   * @returns The current LFO state
   */
  update(currentTimeMs: number): LFOState {
    // Calculate delta time
    const deltaMs = this.lastUpdateTime === 0 ? 0 : currentTimeMs - this.lastUpdateTime;
    this.lastUpdateTime = currentTimeMs;

    // Skip phase update if not running (but still generate output)
    const shouldUpdatePhase = this.state.isRunning && deltaMs > 0;

    // Calculate timing
    const cycleTimeMs = calculateCycleTimeMs(this.config, this.bpm);
    const phaseIncrement = calculatePhaseIncrement(this.config, this.bpm);

    // Update phase if running
    if (shouldUpdatePhase) {
      const previousPhase = this.state.phase;
      let newPhase = this.state.phase + phaseIncrement * deltaMs;

      // Wrap phase to 0-1 range
      if (newPhase >= 1) {
        newPhase = newPhase % 1;
        this.state.cycleCount++;
      } else if (newPhase < 0) {
        newPhase = 1 + (newPhase % 1);
        if (newPhase === 1) newPhase = 0;
        this.state.cycleCount++;
      }

      // Check for mode-based stopping (ONE/HLF)
      const stopCheck = checkModeStop(
        this.config,
        this.state,
        previousPhase,
        newPhase
      );

      if (stopCheck.shouldStop) {
        this.state.isRunning = false;
        // Snap to stop position
        if (this.config.mode === 'ONE') {
          newPhase = this.state.startPhaseNormalized;
        } else if (this.config.mode === 'HLF') {
          newPhase = (this.state.startPhaseNormalized + 0.5) % 1;
        }
      }

      this.state.previousPhase = previousPhase;
      this.state.phase = newPhase;
    }

    // Generate waveform output
    const waveformResult = generateWaveform(
      this.config.waveform,
      this.state.phase,
      this.state
    );

    // Update random state if needed
    if (waveformResult.newRandomValue !== undefined) {
      this.state.randomValue = waveformResult.newRandomValue;
    }
    if (waveformResult.newRandomStep !== undefined) {
      this.state.randomStep = waveformResult.newRandomStep;
    }

    this.state.rawOutput = waveformResult.value;

    // Update fade (only if running and time has passed)
    if (shouldUpdatePhase) {
      const fadeResult = updateFade(
        this.config,
        this.state,
        cycleTimeMs,
        deltaMs
      );
      this.state.fadeProgress = fadeResult.fadeProgress;
      this.state.fadeMultiplier = fadeResult.fadeMultiplier;
    }

    // Calculate final output
    // For HLD mode, use held output
    let effectiveRawOutput = this.state.rawOutput;
    if (this.config.mode === 'HLD' && this.state.triggerCount > 0) {
      effectiveRawOutput = this.state.heldOutput;
    }

    // Invert output for negative speed (phase still runs forward)
    if (this.config.speed < 0) {
      effectiveRawOutput = -effectiveRawOutput;
    }

    // Apply depth
    // Depth scales the output: depth of 63 = 100%, depth of 0 = 0%
    // Negative depth inverts the waveform
    const depthScale = this.config.depth / 63;
    let scaledOutput = effectiveRawOutput * depthScale;

    // Apply fade
    scaledOutput *= this.state.fadeMultiplier;

    // For unipolar waveforms with negative depth, clamp to valid range
    if (isUnipolar(this.config.waveform)) {
      // Unipolar waveforms output 0 to 1
      // With negative depth, they output 0 to -1
      // The output range becomes -1 to +1 depending on depth sign
    }

    this.state.output = scaledOutput;

    return { ...this.state };
  }

  /**
   * Trigger the LFO
   *
   * For HLD mode, this computes the current waveform value at the current phase
   * to ensure the held value is accurate, even if trigger() is called before
   * any update() calls.
   */
  trigger(): void {
    // For HLD mode, compute fresh waveform output at current phase.
    // This is necessary because rawOutput may be stale if trigger() is called
    // before update() has been called (e.g., when initializing an HLD mode LFO).
    let rawOutputForTrigger = this.state.rawOutput;
    if (this.config.mode === 'HLD') {
      const waveformResult = generateWaveform(
        this.config.waveform,
        this.state.phase,
        this.state
      );
      rawOutputForTrigger = waveformResult.value;
      // Update random state if needed (for RND waveform)
      if (waveformResult.newRandomValue !== undefined) {
        this.state.randomValue = waveformResult.newRandomValue;
      }
      if (waveformResult.newRandomStep !== undefined) {
        this.state.randomStep = waveformResult.newRandomStep;
      }
    }
    this.state = handleTrigger(this.config, this.state, rawOutputForTrigger);
  }

  /**
   * Get current state
   */
  getState(): LFOState {
    return { ...this.state };
  }

  /**
   * Get current configuration
   */
  getConfig(): LFOConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<LFOConfig>): void {
    const previousMode = this.config.mode;
    this.config = { ...this.config, ...config };

    // Update start phase normalization if startPhase changed
    if (config.startPhase !== undefined) {
      this.state.startPhaseNormalized = config.startPhase / 128;
    }

    // If switching to ONE/HLF mode, stop until triggered
    if (
      (config.mode === 'ONE' || config.mode === 'HLF') &&
      previousMode !== config.mode
    ) {
      this.state.isRunning = false;
      this.state.hasTriggered = false;
    }
  }

  /**
   * Set BPM
   */
  setBpm(bpm: number): void {
    this.bpm = clamp(bpm, 1, 999);
  }

  /**
   * Get current BPM
   */
  getBpm(): number {
    return this.bpm;
  }

  /**
   * Get timing information
   */
  getTimingInfo(): TimingInfo {
    return calculateTimingInfo(this.config, this.bpm);
  }

  /**
   * Reset the LFO to initial state
   */
  reset(): void {
    this.state = createInitialState(this.config);

    // For ONE/HLF modes, don't run until triggered
    if (this.config.mode === 'ONE' || this.config.mode === 'HLF') {
      this.state.isRunning = false;
    }
  }

  /**
   * Check if the LFO is running
   */
  isRunning(): boolean {
    return this.state.isRunning;
  }

  /**
   * Get the current output value
   */
  getOutput(): number {
    return this.state.output;
  }

  /**
   * Get the current phase (0-1)
   */
  getPhase(): number {
    return this.state.phase;
  }

  /**
   * Start the LFO (for ONE/HLF modes that are stopped)
   */
  start(): void {
    this.state.isRunning = true;
    this.state.hasTriggered = true;
  }

  /**
   * Stop the LFO
   */
  stop(): void {
    this.state.isRunning = false;
  }
}
