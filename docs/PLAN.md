# Elektron LFO - Implementation Plan

A TypeScript implementation of the Elektron Digitakt II LFO engine with real-time terminal visualization, built with Bun.

## Project Requirements

**Runtime & Build:**
- Runtime: Bun (fast TypeScript/JavaScript runtime)
- Language: TypeScript with strict type checking
- Testing: Bun's built-in test runner (`bun test`)

**Core Features:**
- Complete Digitakt II LFO engine with all 7 waveforms (TRI, SIN, SQR, SAW, EXP, RMP, RND)
- All 5 trigger modes (FRE, TRG, HLD, ONE, HLF)
- Full parameter support: SPD (-64 to +63), MULT (1 through 2k), SPH (0-127), DEP (-64 to +63), FADE (-64 to +63)
- Accurate timing mathematics matching hardware behavior
- Support for both BPM-synced and fixed 120 BPM modes

---

## 1. Project Structure

```
elektron-lfo/
├── src/
│   ├── engine/
│   │   ├── index.ts           # Main exports
│   │   ├── types.ts           # LFOConfig, LFOState, enums
│   │   ├── waveforms.ts       # All 7 waveform generators
│   │   ├── timing.ts          # Timing/phase calculations
│   │   ├── triggers.ts        # Trigger mode handling
│   │   ├── fade.ts            # Fade in/out logic
│   │   └── lfo.ts             # Main LFO class
│   ├── cli/
│   │   ├── index.ts           # CLI entry point
│   │   ├── args.ts            # Argument parsing
│   │   ├── display.ts         # Terminal visualization
│   │   └── keyboard.ts        # Keyboard input handling
│   └── index.ts               # Library exports
├── tests/
│   ├── waveforms.test.ts
│   ├── timing.test.ts
│   ├── triggers.test.ts
│   ├── phase.test.ts
│   ├── depth-fade.test.ts
│   └── presets.test.ts        # Integration tests with 5 presets
├── package.json
├── tsconfig.json
├── bunfig.toml
└── README.md
```

**Dependencies:**
- `@types/bun` (dev)
- `typescript` (dev)
- For terminal UI: Start with raw ANSI escape codes (zero dependencies)

---

## 2. Core Types (`src/engine/types.ts`)

```typescript
export type Waveform = 'TRI' | 'SIN' | 'SQR' | 'SAW' | 'EXP' | 'RMP' | 'RND';
export type TriggerMode = 'FRE' | 'TRG' | 'HLD' | 'ONE' | 'HLF';
export type Multiplier = 1 | 2 | 4 | 8 | 16 | 32 | 64 | 128 | 256 | 512 | 1024 | 2048;

export interface LFOConfig {
  waveform: Waveform;
  speed: number;              // -64.00 to +63.00
  multiplier: Multiplier;
  useFixedBPM: boolean;       // true = 120 BPM (dot suffix)
  startPhase: number;         // 0 to 127
  mode: TriggerMode;
  depth: number;              // -64.00 to +63.00
  fade: number;               // -64 to +63
}

export interface LFOState {
  phase: number;              // 0.0 to 1.0
  output: number;
  rawOutput: number;
  isRunning: boolean;
  fadeMultiplier: number;
  fadeProgress: number;
  randomValue: number;
  previousPhase: number;
  heldOutput: number;
  startPhaseNormalized: number;
  cycleCount: number;
  triggerCount: number;
}

export interface TimingInfo {
  cycleTimeMs: number;
  noteValue: string;
  frequencyHz: number;
  cyclesPerBar: number;
}
```

---

## 3. Waveform Generation (`src/engine/waveforms.ts`)

Implement exact formulas from the Digitakt II specification:

```typescript
// Triangle: Bipolar, starts at 0, peak at 0.25, trough at 0.75
function generateTriangle(phase: number): number {
  if (phase < 0.25) return phase * 4;
  if (phase < 0.75) return 1 - (phase - 0.25) * 4;
  return -1 + (phase - 0.75) * 4;
}

// Sine: Bipolar, standard sine wave
function generateSine(phase: number): number {
  return Math.sin(phase * 2 * Math.PI);
}

// Square: Bipolar, +1 first half, -1 second half
function generateSquare(phase: number): number {
  return phase < 0.5 ? 1 : -1;
}

// Sawtooth: Bipolar, linear rise -1 to +1
function generateSawtooth(phase: number): number {
  return phase * 2 - 1;
}

// Exponential: Unipolar 0 to +1, accelerating curve
function generateExponential(phase: number): number {
  const k = 4;
  return (Math.exp(phase * k) - 1) / (Math.exp(k) - 1);
}

// Ramp: Unipolar +1 to 0, linear fall
function generateRamp(phase: number): number {
  return 1 - phase;
}

// Random: Bipolar, sample-and-hold, 8 steps per cycle
function generateRandom(phase: number, state: LFOState): {
  value: number;
  newRandomValue: number
}
```

---

## 4. Timing Calculations (`src/engine/timing.ts`)

From the spec:
```
phase_steps_per_bar = |SPD| × MULT
cycle_time_ms = (60000 / BPM) × 4 × (128 / (|SPD| × MULT))
frequency_hz = (BPM / 60) × (|SPD| × MULT / 128)
```

Key functions:
- `calculatePhaseIncrement(config, bpm)` - phase change per millisecond
- `calculateTimingInfo(config, bpm)` - returns cycle time, note value, frequency
- `calculateNoteValue(product)` - converts SPD × MULT product to musical notation

---

## 5. Test Plan

### Waveform Tests (`tests/waveforms.test.ts`)

For each waveform, test:
- Starting value at phase 0
- Peak/trough positions
- End value near phase 1
- Correct polarity range (bipolar -1 to +1, unipolar 0 to +1)
- Shape characteristics (linear vs exponential)

### Timing Tests (`tests/timing.test.ts`)

Verify against spec examples:
| SPD | MULT | Expected Result |
|-----|------|-----------------|
| 32 | 64 | 1/16th note, 125ms at 120 BPM |
| 16 | 8 | 1 bar, 2000ms at 120 BPM |
| 1 | 1 | 128 bars, 256000ms at 120 BPM |
| 8 | 16 | 1 bar, 2000ms at 120 BPM |

Test fixed BPM mode (always 120 regardless of project BPM).

### Trigger Mode Tests (`tests/triggers.test.ts`)

- **FRE**: Phase unchanged after trigger
- **TRG**: Phase resets to startPhase after trigger, fade resets
- **HLD**: Output value held after trigger, LFO continues in background
- **ONE**: Runs one cycle then stops, can be retriggered
- **HLF**: Stops at phase 0.5 from start (or backward equivalent)

### Phase Tests (`tests/phase.test.ts`)

- Phase wraps correctly from 1 back to 0
- Phase stays within 0-1 range
- Negative speed runs phase backwards
- startPhase correctly positions initial phase
- ONE/HLF modes stop correctly with non-zero startPhase

### Depth/Fade Tests (`tests/depth-fade.test.ts`)

- Depth 0 produces 0 output
- Negative depth inverts output
- Negative fade starts at 0 and increases (fade IN)
- Positive fade starts at 1 and decreases (fade OUT)
- Fade resets on trigger for TRG/ONE/HLF modes

### Preset Integration Tests (`tests/presets.test.ts`)

Test all 5 presets from the DIGITAKT_II_LFO_PRESETS.md document:

1. **Fade-In One-Shot**: RMP, SPD=8, MULT=16, ONE mode, FADE=-32
   - Verify 2000ms cycle at 120 BPM
   - Verify stops after one cycle
   - Verify fade multiplier increases over time

2. **Ambient Drift**: SIN, SPD=1, MULT=1, FRE mode
   - Verify 256000ms (4+ minutes) cycle
   - Verify continuous running despite triggers

3. **Hi-Hat Humanizer**: RND, SPD=32, MULT=64, FRE mode
   - Verify 125ms cycle (1/16 note)
   - Verify random values change
   - Verify output within depth range

4. **Pumping Sidechain**: EXP, SPD=32, MULT=4, TRG mode, DEP=-63
   - Verify 2000ms cycle
   - Verify restarts on trigger
   - Verify inverted (negative) output

5. **Wobble Bass**: SIN, SPD=16, MULT=8, TRG mode, SPH=32
   - Verify 2000ms cycle (1 bar)
   - Verify starts at peak (phase 90 degrees)

---

## 6. CLI Tool

### Command-Line Arguments (`src/cli/args.ts`)

```
Usage: elektron-lfo [options]

Options:
  -w, --waveform <type>   TRI, SIN, SQR, SAW, EXP, RMP, RND (default: TRI)
  -s, --speed <value>     -64.00 to +63.00 (default: 16)
  -m, --multiplier <val>  1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048 (default: 8)
  -f, --fixed             Use fixed 120 BPM instead of project BPM
  -p, --phase <value>     0-127 start phase (default: 0)
  -M, --mode <mode>       FRE, TRG, HLD, ONE, HLF (default: FRE)
  -d, --depth <value>     -64.00 to +63.00 (default: 63)
  -F, --fade <value>      -64 to +63 (default: 0)
  -b, --bpm <value>       1-999 project BPM (default: 120)
  -h, --help              Show help
```

### Terminal Display (`src/cli/display.ts`)

Display should include:
- Parameter values (WAVE, SPD, MULT, MODE, SPH, DEP, FADE)
- BPM and timing info (cycle time in ms, note value, Hz)
- ASCII waveform with current phase indicator (vertical line)
- Current output value (numerical + visual bar)
- Phase percentage, fade percentage, cycle count
- Status (STOPPED/RUNNING/FREE RUNNING)
- Control hints

Example display:
```
=== Elektron LFO Visualizer ===

WAVE: SIN  SPD: 16.00  MULT: 8  MODE: TRG
SPH: 32 (90°)  DEP: +48.00  FADE: 0
BPM: 120  Cycle: 2000.0ms (1 bar)  Hz: 0.500

      .-""-.
     /      \
    /    |   \      <- Phase indicator
   /          \
  '-.____.____.-

Output: +0.7500 [=======|         ]
Phase: 25.0%  Fade: 100%  Cycles: 3  Triggers: 5

[RUNNING] - Press SPACE to trigger

Controls: [SPACE] Trigger  [Q] Quit  [↑/↓] BPM  [←/→] Speed
```

### Keyboard Handling (`src/cli/keyboard.ts`)

- **Space**: Send trigger
- **Q / Ctrl+C**: Quit
- **Up/Down arrows**: Adjust BPM (+/- 1)
- **Left/Right arrows**: Adjust speed (+/- 1)

Use `process.stdin.setRawMode(true)` for single-keypress detection.

---

## 7. Package Configuration

### package.json

```json
{
  "name": "elektron-lfo",
  "version": "1.0.0",
  "description": "Digitakt II LFO engine implementation with CLI visualization",
  "main": "dist/index.js",
  "module": "src/index.ts",
  "types": "dist/index.d.ts",
  "bin": {
    "elektron-lfo": "./src/cli/index.ts"
  },
  "scripts": {
    "dev": "bun run src/cli/index.ts",
    "test": "bun test",
    "test:watch": "bun test --watch",
    "build": "bun build src/index.ts --outdir dist --target node",
    "cli": "bun run src/cli/index.ts",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "typescript": "^5.0.0"
  },
  "engines": {
    "bun": ">=1.0.0"
  }
}
```

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "types": ["bun-types"]
  },
  "include": ["src/**/*"]
}
```

### bunfig.toml

```toml
[test]
coverage = true
coverageDir = "./coverage"
```

---

## 8. Implementation Order

### Phase 1: Foundation (Day 1)
1. Project setup (bun init, configs)
2. Types definition (`src/engine/types.ts`)

### Phase 2: Core Engine (Days 2-3)
3. Waveform generators + tests
4. Timing system + tests
5. Trigger handling + tests

### Phase 3: Advanced Features (Day 4)
6. Fade system + tests
7. Main LFO class + integration tests

### Phase 4: CLI (Days 5-6)
8. Argument parsing
9. Display rendering
10. Keyboard handling
11. CLI entry point with 60fps loop

### Phase 5: Verification (Day 7)
12. Preset integration tests (all 5 presets)
13. Documentation

### Dependency Graph

```
types.ts
   |
   +-- waveforms.ts
   |       |
   +-- timing.ts
   |       |
   +-- triggers.ts
   |       |
   +-- fade.ts
   |       |
   +-------+-- lfo.ts
                 |
        +--------+--------+
        |        |        |
     args.ts  display.ts  keyboard.ts
        |        |        |
        +--------+--------+
                 |
            cli/index.ts
```

---

## 9. Key Implementation Notes

1. **Phase is normalized to 0-1**, not 0-127. Convert on input/output.

2. **Random waveform state** needs special handling - must track previous phase to detect step changes.

3. **ONE mode stopping** requires careful detection of phase wrapping past the start phase. Must work for both positive AND negative speed.

4. **HLF mode** stops at the phase 0.5 beyond start phase (wrapping), not absolute 0.5.

5. **HLD mode** captures the current output when triggered and holds it until the next trigger, but the LFO continues running in the background.

6. **Fade timing** is relative to LFO cycles, not absolute time. This ensures consistency across BPM changes.

7. **Fade resets** on trigger for TRG, ONE, and HLF modes. FRE mode does not reset fade.

8. **60fps update rate** is sufficient for visualization but may need adjustment for audio-rate LFO applications.

9. **BPM can be project-synced or fixed** - the `useFixedBPM` config option determines whether to use the passed `bpm` value or always use 120 BPM.

10. **ANSI terminal codes** work on most modern terminals (macOS Terminal, iTerm2, VSCode terminal) but may need fallbacks for Windows CMD.

---

## 10. Reference Documents

- `/Users/brent/code/field-rec/DIGITAKT_II_LFO_SPEC.md` - Complete LFO specification
- `/Users/brent/code/field-rec/DIGITAKT_II_LFO_PRESETS.md` - 5 preset examples with timing calculations
- `/Users/brent/code/field-rec/EXPO_LFO_VISUALIZER_PLAN.md` - React Native Skia visualizer component plan
