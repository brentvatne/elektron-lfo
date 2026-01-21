/**
 * Keyboard input handling for Elektron LFO CLI
 */
import type { Waveform, TriggerMode, Multiplier } from '../engine/types';
export type KeyAction = {
    type: 'trigger';
} | {
    type: 'quit';
} | {
    type: 'bpm';
    delta: number;
} | {
    type: 'speed';
    delta: number;
} | {
    type: 'waveform';
    waveform: Waveform;
} | {
    type: 'mode';
    mode: TriggerMode;
} | {
    type: 'multiplier';
    multiplier: Multiplier;
} | {
    type: 'depth';
    delta: number;
} | {
    type: 'fade';
    delta: number;
} | {
    type: 'unknown';
};
/**
 * Parse a key input into an action
 */
export declare function parseKey(key: Buffer, currentWaveform: Waveform, currentMode: TriggerMode, currentMultiplier: Multiplier): KeyAction;
/**
 * Set up raw mode input handling
 */
export declare function setupKeyboardInput(onKey: (key: Buffer) => void, onExit: () => void): void;
/**
 * Clean up keyboard input handling
 */
export declare function cleanupKeyboardInput(): void;
