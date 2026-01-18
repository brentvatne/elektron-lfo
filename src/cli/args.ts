/**
 * Command-line argument parsing for Elektron LFO CLI
 */

import type { LFOConfig, Waveform, TriggerMode, Multiplier } from '../engine/types';
import { DEFAULT_CONFIG, VALID_MULTIPLIERS, isValidMultiplier } from '../engine/types';

export interface CLIArgs extends LFOConfig {
  bpm: number;
  help: boolean;
}

const WAVEFORMS: Waveform[] = ['TRI', 'SIN', 'SQR', 'SAW', 'EXP', 'RMP', 'RND'];
const TRIGGER_MODES: TriggerMode[] = ['FRE', 'TRG', 'HLD', 'ONE', 'HLF'];

export function printHelp(): void {
  console.log(`
Elektron LFO Visualizer - Digitakt II LFO Engine

Usage: elektron-lfo [options]

Options:
  -w, --waveform <type>   Waveform type: TRI, SIN, SQR, SAW, EXP, RMP, RND
                          (default: ${DEFAULT_CONFIG.waveform})
  -s, --speed <value>     Speed: -64.00 to +63.00 (default: ${DEFAULT_CONFIG.speed})
  -m, --multiplier <val>  Multiplier: 1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048
                          (default: ${DEFAULT_CONFIG.multiplier})
  -f, --fixed             Use fixed 120 BPM instead of project BPM
  -p, --phase <value>     Start phase: 0-127 (default: ${DEFAULT_CONFIG.startPhase})
  -M, --mode <mode>       Trigger mode: FRE, TRG, HLD, ONE, HLF
                          (default: ${DEFAULT_CONFIG.mode})
  -d, --depth <value>     Depth: -64.00 to +63.00 (default: ${DEFAULT_CONFIG.depth})
  -F, --fade <value>      Fade: -64 to +63 (default: ${DEFAULT_CONFIG.fade})
  -b, --bpm <value>       Project BPM: 1-999 (default: 120)
  -h, --help              Show this help

Controls:
  [SPACE]   Trigger the LFO
  [Q]       Quit
  [↑/↓]     Adjust BPM (+/- 1)
  [←/→]     Adjust speed (+/- 1)
  [W]       Cycle waveform
  [M]       Cycle mode

Examples:
  elektron-lfo                           # Default triangle LFO
  elektron-lfo -w SIN -s 16 -m 8         # Sine wave, 1 bar cycle at 120 BPM
  elektron-lfo -w RND -s 32 -m 64 -M FRE # Random hi-hat humanizer
  elektron-lfo -w EXP -M TRG -d -63      # Pumping sidechain effect
`);
}

export function parseArgs(args: string[]): CLIArgs {
  const result: CLIArgs = {
    ...DEFAULT_CONFIG,
    bpm: 120,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case '-h':
      case '--help':
        result.help = true;
        break;

      case '-w':
      case '--waveform': {
        const waveform = nextArg?.toUpperCase() as Waveform;
        if (!WAVEFORMS.includes(waveform)) {
          console.error(`Invalid waveform: ${nextArg}. Valid: ${WAVEFORMS.join(', ')}`);
          process.exit(1);
        }
        result.waveform = waveform;
        i++;
        break;
      }

      case '-s':
      case '--speed': {
        const speed = parseFloat(nextArg);
        if (isNaN(speed) || speed < -64 || speed > 63) {
          console.error(`Invalid speed: ${nextArg}. Must be -64.00 to +63.00`);
          process.exit(1);
        }
        result.speed = speed;
        i++;
        break;
      }

      case '-m':
      case '--multiplier': {
        const mult = parseInt(nextArg, 10);
        if (!isValidMultiplier(mult)) {
          console.error(`Invalid multiplier: ${nextArg}. Valid: ${VALID_MULTIPLIERS.join(', ')}`);
          process.exit(1);
        }
        result.multiplier = mult;
        i++;
        break;
      }

      case '-f':
      case '--fixed':
        result.useFixedBPM = true;
        break;

      case '-p':
      case '--phase': {
        const phase = parseInt(nextArg, 10);
        if (isNaN(phase) || phase < 0 || phase > 127) {
          console.error(`Invalid phase: ${nextArg}. Must be 0-127`);
          process.exit(1);
        }
        result.startPhase = phase;
        i++;
        break;
      }

      case '-M':
      case '--mode': {
        const mode = nextArg?.toUpperCase() as TriggerMode;
        if (!TRIGGER_MODES.includes(mode)) {
          console.error(`Invalid mode: ${nextArg}. Valid: ${TRIGGER_MODES.join(', ')}`);
          process.exit(1);
        }
        result.mode = mode;
        i++;
        break;
      }

      case '-d':
      case '--depth': {
        const depth = parseFloat(nextArg);
        if (isNaN(depth) || depth < -64 || depth > 63) {
          console.error(`Invalid depth: ${nextArg}. Must be -64.00 to +63.00`);
          process.exit(1);
        }
        result.depth = depth;
        i++;
        break;
      }

      case '-F':
      case '--fade': {
        const fade = parseInt(nextArg, 10);
        if (isNaN(fade) || fade < -64 || fade > 63) {
          console.error(`Invalid fade: ${nextArg}. Must be -64 to +63`);
          process.exit(1);
        }
        result.fade = fade;
        i++;
        break;
      }

      case '-b':
      case '--bpm': {
        const bpm = parseInt(nextArg, 10);
        if (isNaN(bpm) || bpm < 1 || bpm > 999) {
          console.error(`Invalid BPM: ${nextArg}. Must be 1-999`);
          process.exit(1);
        }
        result.bpm = bpm;
        i++;
        break;
      }

      default:
        if (arg.startsWith('-')) {
          console.error(`Unknown option: ${arg}`);
          printHelp();
          process.exit(1);
        }
        break;
    }
  }

  return result;
}
