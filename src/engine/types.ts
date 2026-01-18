/**
 * Elektron Digitakt II LFO Engine Types
 */

/** Available LFO waveform types */
export type Waveform = 'TRI' | 'SIN' | 'SQR' | 'SAW' | 'EXP' | 'RMP' | 'RND';

/** LFO trigger/behavior modes */
export type TriggerMode = 'FRE' | 'TRG' | 'HLD' | 'ONE' | 'HLF';

/** Available tempo multiplier values */
export type Multiplier = 1 | 2 | 4 | 8 | 16 | 32 | 64 | 128 | 256 | 512 | 1024 | 2048;

/** LFO configuration parameters */
export interface LFOConfig {
  /** Waveform type */
  waveform: Waveform;
  /** Speed parameter: -64.00 to +63.00 */
  speed: number;
  /** Tempo multiplier */
  multiplier: Multiplier;
  /** Use fixed 120 BPM instead of project BPM */
  useFixedBPM: boolean;
  /** Start phase: 0 to 127 (maps to 0-360 degrees) */
  startPhase: number;
  /** Trigger/behavior mode */
  mode: TriggerMode;
  /** Modulation depth: -64.00 to +63.00 */
  depth: number;
  /** Fade amount: -64 to +63 (negative = fade in, positive = fade out) */
  fade: number;
}

/** LFO runtime state */
export interface LFOState {
  /** Current phase position: 0.0 to 1.0 */
  phase: number;
  /** Final output value after depth and fade processing */
  output: number;
  /** Raw waveform output before depth/fade processing */
  rawOutput: number;
  /** Whether the LFO is currently running */
  isRunning: boolean;
  /** Current fade envelope multiplier: 0.0 to 1.0 */
  fadeMultiplier: number;
  /** Fade envelope progress: 0.0 to 1.0 */
  fadeProgress: number;
  /** Current random value for RND waveform */
  randomValue: number;
  /** Previous phase value for detecting step changes */
  previousPhase: number;
  /** Held output value for HLD mode */
  heldOutput: number;
  /** Normalized start phase: 0.0 to 1.0 */
  startPhaseNormalized: number;
  /** Number of complete cycles */
  cycleCount: number;
  /** Number of triggers received */
  triggerCount: number;
  /** Whether the LFO has been triggered at least once (for ONE/HLF modes) */
  hasTriggered: boolean;
  /** Current random step (0-15 for 16 steps per cycle) */
  randomStep: number;
}

/** Timing information for an LFO configuration */
export interface TimingInfo {
  /** Duration of one complete cycle in milliseconds */
  cycleTimeMs: number;
  /** Musical note value representation (e.g., "1/4", "1 bar", "4 bars") */
  noteValue: string;
  /** LFO frequency in Hz */
  frequencyHz: number;
  /** Number of LFO cycles per bar */
  cyclesPerBar: number;
  /** Product of |SPD| × MULT */
  product: number;
}

/** Default LFO configuration */
export const DEFAULT_CONFIG: LFOConfig = {
  waveform: 'TRI',
  speed: 16,
  multiplier: 8,
  useFixedBPM: false,
  startPhase: 0,
  mode: 'FRE',
  depth: 63,
  fade: 0,
};

/** Create initial LFO state */
export function createInitialState(config: LFOConfig): LFOState {
  const startPhaseNormalized = config.startPhase / 128;
  return {
    phase: startPhaseNormalized,
    output: 0,
    rawOutput: 0,
    isRunning: true,
    fadeMultiplier: config.fade < 0 ? 0 : 1, // Fade in starts at 0, fade out starts at 1
    fadeProgress: 0,
    randomValue: Math.random() * 2 - 1, // Initial random value: -1 to +1
    previousPhase: startPhaseNormalized,
    heldOutput: 0,
    startPhaseNormalized,
    cycleCount: 0,
    triggerCount: 0,
    hasTriggered: false,
    randomStep: 0,
  };
}

/** Clamp a value to a range */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Valid multiplier values for validation */
export const VALID_MULTIPLIERS: readonly Multiplier[] = [
  1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048,
] as const;

/** Check if a number is a valid multiplier */
export function isValidMultiplier(value: number): value is Multiplier {
  return VALID_MULTIPLIERS.includes(value as Multiplier);
}
