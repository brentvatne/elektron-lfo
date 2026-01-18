#!/usr/bin/env bun
/**
 * Elektron LFO CLI - Main Entry Point
 *
 * Real-time terminal visualization of the Digitakt II LFO engine
 */

import { LFO } from '../engine/lfo';
import { clamp } from '../engine/types';
import { parseArgs, printHelp } from './args';
import { render } from './display';
import { setupKeyboardInput, cleanupKeyboardInput, parseKey } from './keyboard';

const TARGET_FPS = 60;
const FRAME_TIME_MS = 1000 / TARGET_FPS;

async function main() {
  // Parse command line arguments
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  // Create LFO instance
  const lfo = new LFO(
    {
      waveform: args.waveform,
      speed: args.speed,
      multiplier: args.multiplier,
      useFixedBPM: args.useFixedBPM,
      startPhase: args.startPhase,
      mode: args.mode,
      depth: args.depth,
      fade: args.fade,
    },
    args.bpm
  );

  let bpm = args.bpm;
  let running = true;

  // Hide cursor
  process.stdout.write('\x1b[?25l');

  // Set up keyboard input
  setupKeyboardInput(
    (key: Buffer) => {
      const config = lfo.getConfig();
      const action = parseKey(key, config.waveform, config.mode, config.multiplier);

      switch (action.type) {
        case 'quit':
          running = false;
          break;

        case 'trigger':
          lfo.trigger();
          break;

        case 'bpm':
          bpm = clamp(bpm + action.delta, 1, 999);
          lfo.setBpm(bpm);
          break;

        case 'speed': {
          const newSpeed = clamp(config.speed + action.delta, -64, 63);
          lfo.setConfig({ speed: newSpeed });
          break;
        }

        case 'waveform':
          lfo.setConfig({ waveform: action.waveform });
          break;

        case 'mode':
          lfo.setConfig({ mode: action.mode });
          break;

        case 'multiplier':
          lfo.setConfig({ multiplier: action.multiplier });
          break;

        case 'depth': {
          const newDepth = clamp(config.depth + action.delta, -64, 63);
          lfo.setConfig({ depth: newDepth });
          break;
        }

        case 'fade': {
          const newFade = clamp(config.fade + action.delta, -64, 63);
          lfo.setConfig({ fade: newFade });
          break;
        }
      }
    },
    () => {
      running = false;
    }
  );

  // Main render loop
  const startTime = performance.now();

  while (running) {
    const currentTime = performance.now();
    const state = lfo.update(currentTime - startTime);
    const config = lfo.getConfig();
    const timing = lfo.getTimingInfo();

    // Render display
    const display = render(config, state, timing, bpm);
    process.stdout.write(display);

    // Wait for next frame
    await Bun.sleep(FRAME_TIME_MS);
  }

  // Cleanup
  cleanupKeyboardInput();
  console.log('Goodbye!');
}

main().catch((error) => {
  cleanupKeyboardInput();
  console.error('Error:', error);
  process.exit(1);
});
