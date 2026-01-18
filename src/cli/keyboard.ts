/**
 * Keyboard input handling for Elektron LFO CLI
 */

import type { Waveform, TriggerMode, Multiplier } from '../engine/types';
import { VALID_MULTIPLIERS } from '../engine/types';

const WAVEFORMS: Waveform[] = ['TRI', 'SIN', 'SQR', 'SAW', 'EXP', 'RMP', 'RND'];
const TRIGGER_MODES: TriggerMode[] = ['FRE', 'TRG', 'HLD', 'ONE', 'HLF'];

export type KeyAction =
  | { type: 'trigger' }
  | { type: 'quit' }
  | { type: 'bpm'; delta: number }
  | { type: 'speed'; delta: number }
  | { type: 'waveform'; waveform: Waveform }
  | { type: 'mode'; mode: TriggerMode }
  | { type: 'multiplier'; multiplier: Multiplier }
  | { type: 'depth'; delta: number }
  | { type: 'fade'; delta: number }
  | { type: 'unknown' };

/**
 * Parse a key input into an action
 */
export function parseKey(
  key: Buffer,
  currentWaveform: Waveform,
  currentMode: TriggerMode,
  currentMultiplier: Multiplier
): KeyAction {
  const keyStr = key.toString();

  // Check for Ctrl+C
  if (key[0] === 3) {
    return { type: 'quit' };
  }

  // Check for escape sequences (arrow keys)
  if (key[0] === 27 && key[1] === 91) {
    switch (key[2]) {
      case 65: // Up arrow
        return { type: 'bpm', delta: 1 };
      case 66: // Down arrow
        return { type: 'bpm', delta: -1 };
      case 67: // Right arrow
        return { type: 'speed', delta: 1 };
      case 68: // Left arrow
        return { type: 'speed', delta: -1 };
    }
  }

  // Single character commands
  switch (keyStr.toLowerCase()) {
    case ' ':
      return { type: 'trigger' };

    case 'q':
      return { type: 'quit' };

    case 'w': {
      // Cycle to next waveform
      const currentIndex = WAVEFORMS.indexOf(currentWaveform);
      const nextIndex = (currentIndex + 1) % WAVEFORMS.length;
      return { type: 'waveform', waveform: WAVEFORMS[nextIndex] };
    }

    case 'm': {
      // Cycle to next mode
      const currentIndex = TRIGGER_MODES.indexOf(currentMode);
      const nextIndex = (currentIndex + 1) % TRIGGER_MODES.length;
      return { type: 'mode', mode: TRIGGER_MODES[nextIndex] };
    }

    case '[': {
      // Previous multiplier
      const currentIndex = VALID_MULTIPLIERS.indexOf(currentMultiplier);
      const prevIndex = Math.max(0, currentIndex - 1);
      return { type: 'multiplier', multiplier: VALID_MULTIPLIERS[prevIndex] };
    }

    case ']': {
      // Next multiplier
      const currentIndex = VALID_MULTIPLIERS.indexOf(currentMultiplier);
      const nextIndex = Math.min(VALID_MULTIPLIERS.length - 1, currentIndex + 1);
      return { type: 'multiplier', multiplier: VALID_MULTIPLIERS[nextIndex] };
    }

    case '-':
    case '_':
      return { type: 'depth', delta: -1 };

    case '=':
    case '+':
      return { type: 'depth', delta: 1 };

    case ',':
    case '<':
      return { type: 'fade', delta: -1 };

    case '.':
    case '>':
      return { type: 'fade', delta: 1 };

    default:
      return { type: 'unknown' };
  }
}

/**
 * Set up raw mode input handling
 */
export function setupKeyboardInput(
  onKey: (key: Buffer) => void,
  onExit: () => void
): void {
  // Enable raw mode for single keypress detection
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }
  process.stdin.resume();

  process.stdin.on('data', (key: Buffer) => {
    onKey(key);
  });

  // Handle process termination
  process.on('SIGINT', onExit);
  process.on('SIGTERM', onExit);
}

/**
 * Clean up keyboard input handling
 */
export function cleanupKeyboardInput(): void {
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(false);
  }
  process.stdin.pause();

  // Clear screen and show cursor
  process.stdout.write('\x1b[2J\x1b[H\x1b[?25h');
}
