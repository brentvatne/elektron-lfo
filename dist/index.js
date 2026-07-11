// src/engine/types.ts
var DEFAULT_CONFIG = {
  waveform: "TRI",
  speed: 16,
  multiplier: 8,
  useFixedBPM: false,
  startPhase: 0,
  mode: "FRE",
  depth: 63,
  fade: 0
};
function createInitialState(config) {
  const startPhaseNormalized = config.startPhase / 128;
  return {
    phase: startPhaseNormalized,
    output: 0,
    rawOutput: 0,
    isRunning: true,
    fadeMultiplier: config.fade < 0 ? 0 : 1,
    fadeProgress: 0,
    randomValue: Math.random() * 2 - 1,
    previousPhase: startPhaseNormalized,
    heldOutput: 0,
    startPhaseNormalized,
    cycleCount: 0,
    triggerCount: 0,
    hasTriggered: false,
    randomStep: 0
  };
}
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
var VALID_MULTIPLIERS = [
  1,
  2,
  4,
  8,
  16,
  32,
  64,
  128,
  256,
  512,
  1024,
  2048
];
function isValidMultiplier(value) {
  return VALID_MULTIPLIERS.includes(value);
}

// src/core/waveforms.ts
function sampleTriangle(phase) {
  if (phase < 0.25) {
    return phase * 4;
  }
  if (phase < 0.75) {
    return 1 - (phase - 0.25) * 4;
  }
  return -1 + (phase - 0.75) * 4;
}
function sampleSine(phase) {
  return Math.sin(phase * 2 * Math.PI);
}
function sampleSquare(phase) {
  return phase < 0.5 ? 1 : -1;
}
function sampleSawtooth(phase) {
  return 1 - phase * 2;
}
function sampleRamp(phase) {
  return phase;
}
function sampleExpDecay(phase) {
  const k = 3;
  const decay = Math.exp(-phase * k);
  const endValue = Math.exp(-k);
  return (decay - endValue) / (1 - endValue);
}
function sampleExpRise(phase) {
  const k = 3;
  return (Math.exp(phase * k) - 1) / (Math.exp(k) - 1);
}
function isUnipolar(waveform) {
  return waveform === "EXP" || waveform === "RMP";
}
// src/engine/waveforms.ts
function generateRandom(phase, state) {
  const stepsPerCycle = 16;
  const currentStep = Math.floor(phase * stepsPerCycle);
  if (currentStep !== state.randomStep) {
    const newRandomValue = Math.random() * 2 - 1;
    return {
      value: newRandomValue,
      newRandomValue,
      newRandomStep: currentStep
    };
  }
  return {
    value: state.randomValue,
    newRandomValue: state.randomValue,
    newRandomStep: state.randomStep
  };
}
function generateWaveform(waveform, phase, state) {
  switch (waveform) {
    case "TRI":
      return { value: sampleTriangle(phase) };
    case "SIN":
      return { value: sampleSine(phase) };
    case "SQR":
      return { value: sampleSquare(phase) };
    case "SAW":
      return { value: sampleSawtooth(phase) };
    case "EXP":
      return { value: sampleExpDecay(phase) };
    case "RMP":
      return { value: sampleRamp(phase) };
    case "RND": {
      const result = generateRandom(phase, state);
      return {
        value: result.value,
        newRandomValue: result.newRandomValue,
        newRandomStep: result.newRandomStep
      };
    }
    default: {
      const _exhaustive = waveform;
      throw new Error(`Unknown waveform: ${_exhaustive}`);
    }
  }
}
function getWaveformRange(waveform) {
  if (isUnipolar(waveform)) {
    return { min: 0, max: 1 };
  }
  return { min: -1, max: 1 };
}

// src/engine/timing.ts
function calculateProduct(config) {
  return Math.abs(config.speed) * config.multiplier;
}
function calculateCycleTimeMs(config, bpm) {
  const effectiveBpm = config.useFixedBPM ? 120 : bpm;
  const product = calculateProduct(config);
  if (product === 0) {
    return Infinity;
  }
  return 60000 / effectiveBpm * 4 * (128 / product);
}
function calculateFrequencyHz(config, bpm) {
  const cycleTimeMs = calculateCycleTimeMs(config, bpm);
  if (cycleTimeMs === Infinity || cycleTimeMs === 0) {
    return 0;
  }
  return 1000 / cycleTimeMs;
}
function calculatePhaseIncrement(config, bpm) {
  const cycleTimeMs = calculateCycleTimeMs(config, bpm);
  if (cycleTimeMs === Infinity || cycleTimeMs === 0) {
    return 0;
  }
  return 1 / cycleTimeMs;
}
function calculateCyclesPerBar(config) {
  const product = calculateProduct(config);
  if (product === 0)
    return 0;
  return product / 128;
}
function calculateNoteValue(product) {
  if (product === 0)
    return "∞";
  if (product >= 2048)
    return "1/16";
  if (product >= 1024)
    return "1/8";
  if (product >= 512)
    return "1/4";
  if (product >= 256)
    return "1/2";
  if (product >= 128)
    return "1 bar";
  const bars = 128 / product;
  const rounded = Math.round(bars * 10) / 10;
  const isWhole = rounded === Math.floor(rounded);
  const barsStr = isWhole ? String(Math.floor(rounded)) : rounded.toFixed(1);
  return `${barsStr} bars`;
}
function calculateTimingInfo(config, bpm) {
  const product = calculateProduct(config);
  const cycleTimeMs = calculateCycleTimeMs(config, bpm);
  const frequencyHz = calculateFrequencyHz(config, bpm);
  const cyclesPerBar = calculateCyclesPerBar(config);
  const noteValue = calculateNoteValue(product);
  return {
    cycleTimeMs,
    noteValue,
    frequencyHz,
    cyclesPerBar,
    product
  };
}
function formatCycleTime(cycleTimeMs) {
  if (cycleTimeMs === Infinity)
    return "∞";
  if (cycleTimeMs >= 60000) {
    const minutes = cycleTimeMs / 60000;
    return `${minutes.toFixed(1)}min`;
  }
  if (cycleTimeMs >= 1000) {
    return `${(cycleTimeMs / 1000).toFixed(2)}s`;
  }
  return `${cycleTimeMs.toFixed(1)}ms`;
}
function formatFrequency(frequencyHz) {
  if (frequencyHz === 0)
    return "0 Hz";
  if (frequencyHz < 0.01) {
    return `${(frequencyHz * 1000).toFixed(3)} mHz`;
  }
  if (frequencyHz < 1) {
    return `${frequencyHz.toFixed(3)} Hz`;
  }
  return `${frequencyHz.toFixed(2)} Hz`;
}

// src/engine/triggers.ts
function handleTrigger(config, state, currentRawOutput) {
  const newState = { ...state };
  newState.triggerCount++;
  switch (config.mode) {
    case "FRE":
      break;
    case "TRG":
      newState.phase = newState.startPhaseNormalized;
      newState.previousPhase = newState.startPhaseNormalized;
      newState.fadeProgress = 0;
      newState.fadeMultiplier = config.fade < 0 ? 0 : 1;
      newState.cycleCount = 0;
      if (config.waveform === "RND") {
        newState.randomValue = Math.random() * 2 - 1;
        newState.randomStep = Math.floor(newState.phase * 16);
      }
      break;
    case "HLD":
      newState.heldOutput = currentRawOutput;
      newState.fadeProgress = 0;
      newState.fadeMultiplier = config.fade < 0 ? 0 : 1;
      break;
    case "ONE":
      newState.phase = newState.startPhaseNormalized;
      newState.previousPhase = newState.startPhaseNormalized;
      newState.isRunning = true;
      newState.hasTriggered = true;
      newState.fadeProgress = 0;
      newState.fadeMultiplier = config.fade < 0 ? 0 : 1;
      newState.cycleCount = 0;
      if (config.waveform === "RND") {
        newState.randomValue = Math.random() * 2 - 1;
        newState.randomStep = Math.floor(newState.phase * 16);
      }
      break;
    case "HLF":
      newState.phase = newState.startPhaseNormalized;
      newState.previousPhase = newState.startPhaseNormalized;
      newState.isRunning = true;
      newState.hasTriggered = true;
      newState.fadeProgress = 0;
      newState.fadeMultiplier = config.fade < 0 ? 0 : 1;
      newState.cycleCount = 0;
      if (config.waveform === "RND") {
        newState.randomValue = Math.random() * 2 - 1;
        newState.randomStep = Math.floor(newState.phase * 16);
      }
      break;
  }
  return newState;
}
function checkModeStop(config, state, previousPhase, currentPhase) {
  if (config.mode !== "ONE" && config.mode !== "HLF") {
    return { shouldStop: false, cycleCompleted: false };
  }
  if (!state.hasTriggered) {
    return { shouldStop: true, cycleCompleted: false };
  }
  const startPhase = state.startPhaseNormalized;
  const isForward = config.speed >= 0;
  if (config.mode === "ONE") {
    if (state.cycleCount >= 1) {
      return { shouldStop: true, cycleCompleted: true };
    }
  } else if (config.mode === "HLF") {
    const halfPhase = (startPhase + 0.5) % 1;
    if (isForward) {
      if (startPhase < 0.5) {
        if (previousPhase < halfPhase && currentPhase >= halfPhase) {
          return { shouldStop: true, cycleCompleted: true };
        }
      } else {
        if (state.cycleCount >= 1 || previousPhase < halfPhase && currentPhase >= halfPhase) {
          return { shouldStop: true, cycleCompleted: true };
        }
      }
    } else {
      const halfPhaseBackward = (startPhase - 0.5 + 1) % 1;
      if (startPhase >= 0.5) {
        if (previousPhase > halfPhaseBackward && currentPhase <= halfPhaseBackward) {
          return { shouldStop: true, cycleCompleted: true };
        }
      } else {
        if (state.cycleCount >= 1 || previousPhase > halfPhaseBackward && currentPhase <= halfPhaseBackward) {
          return { shouldStop: true, cycleCompleted: true };
        }
      }
    }
  }
  return { shouldStop: false, cycleCompleted: false };
}
function requiresTriggerToStart(mode) {
  return mode === "ONE" || mode === "HLF";
}
function resetsPhaseOnTrigger(mode) {
  return mode === "TRG" || mode === "ONE" || mode === "HLF";
}
function resetsFadeOnTrigger(mode) {
  return mode !== "FRE";
}

// src/core/fade.ts
function calculateFadeCycles(fadeValue) {
  if (fadeValue === 0) {
    return 0;
  }
  const absFade = Math.abs(fadeValue);
  if (absFade <= 16) {
    return Math.max(0.5, 0.1 * absFade + 0.6);
  }
  const baseAt16 = 2.2;
  return baseAt16 * Math.pow(2, (absFade - 16) / 4.5);
}
function calculateFadeMultiplier(fadeValue, fadeProgress) {
  if (fadeValue === 0) {
    return 1;
  }
  const progress = fadeProgress < 0 ? 0 : fadeProgress > 1 ? 1 : fadeProgress;
  if (fadeValue < 0) {
    return progress;
  } else {
    return 1 - progress;
  }
}
// src/engine/fade.ts
function updateFade(config, state, cycleTimeMs, deltaMs) {
  if (config.fade === 0 || config.mode === "FRE") {
    return {
      fadeProgress: 1,
      fadeMultiplier: 1
    };
  }
  const fadeCycles = calculateFadeCycles(config.fade);
  const fadeDurationMs = fadeCycles * cycleTimeMs;
  if (fadeDurationMs === 0) {
    return {
      fadeProgress: 1,
      fadeMultiplier: config.fade < 0 ? 0 : 1
    };
  }
  const progressIncrement = deltaMs / fadeDurationMs;
  const newProgress = Math.min(1, state.fadeProgress + progressIncrement);
  return {
    fadeProgress: newProgress,
    fadeMultiplier: calculateFadeMultiplier(config.fade, newProgress)
  };
}
function resetFade(config) {
  if (config.fade === 0) {
    return { fadeProgress: 1, fadeMultiplier: 1 };
  }
  if (config.fade < 0) {
    return { fadeProgress: 0, fadeMultiplier: 0 };
  } else {
    return { fadeProgress: 0, fadeMultiplier: 1 };
  }
}
function shouldResetFadeOnTrigger(mode) {
  return mode !== "FRE";
}
function applyFade(rawOutput, fadeMultiplier) {
  return rawOutput * fadeMultiplier;
}

// src/engine/lfo.ts
class LFO {
  config;
  state;
  bpm;
  lastUpdateTime;
  constructor(config = {}, bpm = 120) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.bpm = bpm;
    this.state = createInitialState(this.config);
    this.lastUpdateTime = 0;
    if (this.config.mode === "FRE") {
      this.state.fadeMultiplier = 1;
      this.state.fadeProgress = 1;
    }
    if (this.config.mode === "ONE" || this.config.mode === "HLF") {
      this.state.isRunning = false;
    }
  }
  update(currentTimeMs) {
    const deltaMs = this.lastUpdateTime === 0 ? 0 : currentTimeMs - this.lastUpdateTime;
    this.lastUpdateTime = currentTimeMs;
    const shouldUpdatePhase = this.state.isRunning && deltaMs > 0;
    const cycleTimeMs = calculateCycleTimeMs(this.config, this.bpm);
    const phaseIncrement = calculatePhaseIncrement(this.config, this.bpm);
    if (shouldUpdatePhase) {
      const previousPhase = this.state.phase;
      let newPhase = this.state.phase + phaseIncrement * deltaMs;
      let cycleCompleted = false;
      if (newPhase >= 1) {
        newPhase = newPhase % 1;
        this.state.cycleCount++;
        cycleCompleted = true;
      } else if (newPhase < 0) {
        newPhase = 1 + newPhase % 1;
        if (newPhase === 1)
          newPhase = 0;
        this.state.cycleCount++;
        cycleCompleted = true;
      }
      if (cycleCompleted && this.config.waveform === "RND") {
        if (this.config.mode === "FRE" || this.config.mode === "TRG") {
          this.state.randomValue = Math.random() * 2 - 1;
          this.state.randomStep = Math.floor(newPhase * 16);
        }
      }
      const stopCheck = checkModeStop(this.config, this.state, previousPhase, newPhase);
      if (stopCheck.shouldStop) {
        this.state.isRunning = false;
        if (this.config.mode === "ONE") {
          newPhase = 1;
        } else if (this.config.mode === "HLF") {
          newPhase = (this.state.startPhaseNormalized + 0.5) % 1;
        }
      }
      this.state.previousPhase = previousPhase;
      this.state.phase = newPhase;
    }
    const waveformResult = generateWaveform(this.config.waveform, this.state.phase, this.state);
    if (waveformResult.newRandomValue !== undefined) {
      this.state.randomValue = waveformResult.newRandomValue;
    }
    if (waveformResult.newRandomStep !== undefined) {
      this.state.randomStep = waveformResult.newRandomStep;
    }
    this.state.rawOutput = waveformResult.value;
    if (shouldUpdatePhase) {
      const fadeResult = updateFade(this.config, this.state, cycleTimeMs, deltaMs);
      this.state.fadeProgress = fadeResult.fadeProgress;
      this.state.fadeMultiplier = fadeResult.fadeMultiplier;
    }
    let effectiveRawOutput = this.state.rawOutput;
    if (this.config.mode === "HLD" && this.state.triggerCount > 0) {
      effectiveRawOutput = this.state.heldOutput;
    }
    if (this.config.speed < 0) {
      if (this.config.waveform === "EXP") {
        effectiveRawOutput = sampleExpRise(this.state.phase);
      } else if (isUnipolar(this.config.waveform)) {
        effectiveRawOutput = 1 - effectiveRawOutput;
      } else {
        effectiveRawOutput = -effectiveRawOutput;
      }
    }
    const depthScale = this.config.depth / 63;
    let scaledOutput = effectiveRawOutput * depthScale;
    scaledOutput *= this.state.fadeMultiplier;
    if (isUnipolar(this.config.waveform)) {}
    this.state.output = scaledOutput;
    return { ...this.state };
  }
  trigger() {
    let rawOutputForTrigger = this.state.rawOutput;
    if (this.config.mode === "HLD") {
      const waveformResult = generateWaveform(this.config.waveform, this.state.phase, this.state);
      rawOutputForTrigger = waveformResult.value;
      if (waveformResult.newRandomValue !== undefined) {
        this.state.randomValue = waveformResult.newRandomValue;
      }
      if (waveformResult.newRandomStep !== undefined) {
        this.state.randomStep = waveformResult.newRandomStep;
      }
    }
    this.state = handleTrigger(this.config, this.state, rawOutputForTrigger);
  }
  getState() {
    return { ...this.state };
  }
  getConfig() {
    return { ...this.config };
  }
  setConfig(config) {
    const previousMode = this.config.mode;
    this.config = { ...this.config, ...config };
    if (config.startPhase !== undefined) {
      this.state.startPhaseNormalized = config.startPhase / 128;
    }
    if ((config.mode === "ONE" || config.mode === "HLF") && previousMode !== config.mode) {
      this.state.isRunning = false;
      this.state.hasTriggered = false;
    }
  }
  setBpm(bpm) {
    this.bpm = clamp(bpm, 1, 999);
  }
  getBpm() {
    return this.bpm;
  }
  getTimingInfo() {
    return calculateTimingInfo(this.config, this.bpm);
  }
  reset() {
    this.state = createInitialState(this.config);
    if (this.config.mode === "ONE" || this.config.mode === "HLF") {
      this.state.isRunning = false;
    }
  }
  isRunning() {
    return this.state.isRunning;
  }
  getOutput() {
    return this.state.output;
  }
  getPhase() {
    return this.state.phase;
  }
  start() {
    this.state.isRunning = true;
    this.state.hasTriggered = true;
  }
  stop() {
    this.state.isRunning = false;
  }
  resetTiming() {
    this.lastUpdateTime = 0;
  }
}
export {
  updateFade,
  shouldResetFadeOnTrigger,
  resetsPhaseOnTrigger,
  resetsFadeOnTrigger,
  resetFade,
  requiresTriggerToStart,
  isValidMultiplier,
  isUnipolar,
  handleTrigger,
  getWaveformRange,
  generateWaveform,
  sampleTriangle as generateTriangle,
  sampleSquare as generateSquare,
  sampleSine as generateSine,
  sampleSawtooth as generateSawtooth,
  generateRandom,
  sampleRamp as generateRamp,
  sampleExpRise as generateExponentialRise,
  sampleExpDecay as generateExponential,
  formatFrequency,
  formatCycleTime,
  createInitialState,
  clamp,
  checkModeStop,
  calculateTimingInfo,
  calculateProduct,
  calculatePhaseIncrement,
  calculateNoteValue,
  calculateFrequencyHz,
  calculateFadeMultiplier,
  calculateFadeCycles,
  calculateCyclesPerBar,
  calculateCycleTimeMs,
  applyFade,
  VALID_MULTIPLIERS,
  LFO,
  DEFAULT_CONFIG
};
