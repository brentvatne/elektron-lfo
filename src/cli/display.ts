/**
 * Terminal display for Elektron LFO CLI
 *
 * Renders the LFO state with ASCII waveform visualization
 */

import type { LFOConfig, LFOState, TimingInfo, Waveform } from '../engine/types';
import { formatCycleTime, formatFrequency } from '../engine/timing';
import { generateWaveform, isUnipolar } from '../engine/waveforms';

// ANSI escape codes
const CLEAR_SCREEN = '\x1b[2J';
const CURSOR_HOME = '\x1b[H';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RED = '\x1b[31m';
const MAGENTA = '\x1b[35m';

const WAVEFORM_WIDTH = 60;
const WAVEFORM_HEIGHT = 9;

/**
 * Generate ASCII waveform preview
 */
function generateWaveformPreview(
  waveform: Waveform,
  phase: number,
  state: LFOState
): string[] {
  const lines: string[] = [];
  const unipolar = isUnipolar(waveform);

  // Sample the waveform at WAVEFORM_WIDTH points
  const samples: number[] = [];
  const tempState = { ...state };

  for (let i = 0; i < WAVEFORM_WIDTH; i++) {
    const samplePhase = i / WAVEFORM_WIDTH;
    const result = generateWaveform(waveform, samplePhase, tempState);
    samples.push(result.value);
    if (result.newRandomValue !== undefined) {
      tempState.randomValue = result.newRandomValue;
    }
    if (result.newRandomStep !== undefined) {
      tempState.randomStep = result.newRandomStep;
    }
  }

  // Find phase position
  const phasePos = Math.floor(phase * WAVEFORM_WIDTH);

  // Build character grid
  for (let row = 0; row < WAVEFORM_HEIGHT; row++) {
    let line = '';
    const rowValue = unipolar
      ? 1 - row / (WAVEFORM_HEIGHT - 1) // 0 to 1 mapping
      : 1 - (row / (WAVEFORM_HEIGHT - 1)) * 2; // -1 to 1 mapping

    for (let col = 0; col < WAVEFORM_WIDTH; col++) {
      const sampleValue = samples[col];
      const isPhaseIndicator = col === phasePos;

      // Check if this cell should show the waveform
      const cellThreshold = unipolar
        ? rowValue - 0.5 / (WAVEFORM_HEIGHT - 1)
        : rowValue - 1 / (WAVEFORM_HEIGHT - 1);

      let char = ' ';

      if (unipolar) {
        // For unipolar, show the waveform as filled area from bottom
        if (sampleValue >= cellThreshold && rowValue <= 1) {
          char = isPhaseIndicator ? '█' : '░';
        }
      } else {
        // For bipolar, show just the line
        const nextRowValue = row < WAVEFORM_HEIGHT - 1
          ? 1 - ((row + 1) / (WAVEFORM_HEIGHT - 1)) * 2
          : -2;

        if (
          (sampleValue >= cellThreshold && sampleValue < rowValue) ||
          (sampleValue <= rowValue && sampleValue > nextRowValue)
        ) {
          char = isPhaseIndicator ? '█' : '●';
        } else if (row === Math.floor((WAVEFORM_HEIGHT - 1) / 2)) {
          // Center line (zero crossing)
          char = isPhaseIndicator ? '█' : '─';
        }
      }

      if (isPhaseIndicator && char === ' ') {
        char = '│';
      }

      line += char;
    }
    lines.push(line);
  }

  return lines;
}

/**
 * Format output bar
 */
function formatOutputBar(output: number, width: number = 30): string {
  const normalizedOutput = (output + 1) / 2; // Convert -1..1 to 0..1
  const position = Math.round(normalizedOutput * (width - 1));
  const centerPos = Math.floor(width / 2);

  let bar = '';
  for (let i = 0; i < width; i++) {
    if (i === centerPos) {
      bar += '│';
    } else if (
      (output >= 0 && i > centerPos && i <= position) ||
      (output < 0 && i >= position && i < centerPos)
    ) {
      bar += '=';
    } else {
      bar += ' ';
    }
  }

  return `[${bar}]`;
}

/**
 * Get status color based on mode and running state
 */
function getStatusColor(isRunning: boolean, mode: string): string {
  if (!isRunning) return RED;
  if (mode === 'FRE') return GREEN;
  return CYAN;
}

/**
 * Get status text
 */
function getStatusText(isRunning: boolean, mode: string): string {
  if (!isRunning) {
    return mode === 'ONE' || mode === 'HLF' ? 'STOPPED - Press SPACE to trigger' : 'STOPPED';
  }
  return mode === 'FRE' ? 'FREE RUNNING' : 'RUNNING';
}

/**
 * Render the full display
 */
export function render(
  config: LFOConfig,
  state: LFOState,
  timing: TimingInfo,
  bpm: number
): string {
  const lines: string[] = [];

  // Header
  lines.push(`${BOLD}═══ Elektron LFO Visualizer ═══${RESET}`);
  lines.push('');

  // Parameters row 1
  const waveColor = isUnipolar(config.waveform) ? MAGENTA : CYAN;
  lines.push(
    `${BOLD}WAVE:${RESET} ${waveColor}${config.waveform}${RESET}  ` +
    `${BOLD}SPD:${RESET} ${config.speed >= 0 ? '+' : ''}${config.speed.toFixed(2)}  ` +
    `${BOLD}MULT:${RESET} ${config.multiplier}  ` +
    `${BOLD}MODE:${RESET} ${YELLOW}${config.mode}${RESET}`
  );

  // Parameters row 2
  const phaseDegrees = Math.round((config.startPhase / 128) * 360);
  const fadeSign = config.fade > 0 ? '+' : config.fade < 0 ? '' : ' ';
  const fadeLabel = config.fade < 0 ? 'IN' : config.fade > 0 ? 'OUT' : '';
  lines.push(
    `${BOLD}SPH:${RESET} ${config.startPhase} (${phaseDegrees}°)  ` +
    `${BOLD}DEP:${RESET} ${config.depth >= 0 ? '+' : ''}${config.depth.toFixed(2)}  ` +
    `${BOLD}FADE:${RESET} ${fadeSign}${config.fade} ${fadeLabel}`
  );

  // Timing info
  const effectiveBpm = config.useFixedBPM ? 120 : bpm;
  const bpmSuffix = config.useFixedBPM ? ' (fixed)' : '';
  lines.push(
    `${BOLD}BPM:${RESET} ${effectiveBpm}${bpmSuffix}  ` +
    `${BOLD}Cycle:${RESET} ${formatCycleTime(timing.cycleTimeMs)} (${timing.noteValue})  ` +
    `${BOLD}Hz:${RESET} ${formatFrequency(timing.frequencyHz)}`
  );

  lines.push('');

  // Waveform visualization
  const waveformLines = generateWaveformPreview(config.waveform, state.phase, state);
  for (const line of waveformLines) {
    lines.push(`  ${DIM}${line}${RESET}`);
  }

  lines.push('');

  // Output display
  const outputSign = state.output >= 0 ? '+' : '';
  const outputBar = formatOutputBar(state.output);
  lines.push(
    `${BOLD}Output:${RESET} ${outputSign}${state.output.toFixed(4)} ${outputBar}`
  );

  // State info
  const fadePercent = Math.round(state.fadeMultiplier * 100);
  const phasePercent = (state.phase * 100).toFixed(1);
  lines.push(
    `${BOLD}Phase:${RESET} ${phasePercent}%  ` +
    `${BOLD}Fade:${RESET} ${fadePercent}%  ` +
    `${BOLD}Cycles:${RESET} ${state.cycleCount}  ` +
    `${BOLD}Triggers:${RESET} ${state.triggerCount}`
  );

  lines.push('');

  // Status
  const statusColor = getStatusColor(state.isRunning, config.mode);
  const statusText = getStatusText(state.isRunning, config.mode);
  lines.push(`${statusColor}[${statusText}]${RESET}`);

  lines.push('');

  // Controls
  lines.push(
    `${DIM}Controls: [SPACE] Trigger  [Q] Quit  [↑/↓] BPM  [←/→] Speed  [W] Wave  [M] Mode${RESET}`
  );

  return CLEAR_SCREEN + CURSOR_HOME + lines.join('\n');
}
