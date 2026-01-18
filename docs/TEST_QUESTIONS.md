# Elektron Digitakt II LFO - Comprehensive Test Plan

## Test Overview

This document contains 18 specific test cases for the Digitakt II LFO system, focusing on edge cases and tricky behavioral scenarios. Each test includes the question, expected behavior based on the specification, and detailed test case procedures.

---

## Part 1: Test Questions with Expected Answers

| # | Question | Expected Answer | Difficulty |
|---|----------|-----------------|------------|
| 1 | What happens when SPD is -64 and the LFO plays backward? Does it advance the same number of phase steps as SPD=+64 forward? | Yes. Both SPD=64 and SPD=-64 produce the same cycle duration when multiplied by MULT. The difference is direction: positive plays forward (0→1→0), negative plays backward (0→-1→0). | High |
| 2 | In ONE mode with SPH=64 (middle of cycle) and SPD=-32, does the LFO stop after 1 full backward cycle from phase 0.5? | Yes. ONE mode requires exactly one complete cycle from start phase regardless of direction. With backward motion, it still travels the full cycle length before stopping. | High |
| 3 | If DEPTH=0, does the LFO still consume CPU/generate output internally even though modulation = 0? | Yes (likely). The LFO state machine continues running internally; only the final output is scaled to zero. This affects fade envelope timing and internal phase position. | Medium |
| 4 | When DEPTH is negative (e.g., -32), is the modulation simply inverted, or does it also invert the waveform itself? | Modulation is scaled by (depth/64). For negative depth, output = raw_lfo_value * (-32/64) = -0.5 * raw_value. The waveform shape stays the same; only polarity inverts. | Medium |
| 5 | In MODE=HLD (Hold), if a trigger arrives while FADE is non-zero, does the fade continue to progress in the background, or does it reset? | The fade should reset on trigger (based on handleTrigger code). HLD samples the current output at trigger time, but the underlying LFO continues running. Fade progress resets to 0. | High |
| 6 | For the RND (Random) waveform, if MULT is set very high (2048) creating audio-rate modulation, does the random step timing scale proportionally, or stay fixed at ~16 steps per cycle? | Timing scales proportionally. RND generates ~16 steps per cycle regardless of MULT. At MULT=2048, you get 16 random changes per audio-rate cycle, which translates to very rapid random modulation. | High |
| 7 | When MODE=HLF with SPH=0 and the LFO reaches phase 0.5, does it stop exactly at 0.5 or does it overshoot slightly due to discrete update intervals? | It should stop at exactly 0.5 (phase wrapping handles boundary cases). However, if update intervals are large, slight overshoot is possible. Hardware likely samples at fixed intervals. | Medium |
| 8 | If FADE=-64 (maximum fade IN) in ONE mode, does the modulation reach full depth before ONE completes its cycle, or is the fade slower than the cycle? | Fade rate is calculated as |FADE|/64 applied to cycle timing. At FADE=-64, it fades at maximum speed, likely completing fade-in before or during the ONE cycle. | Medium |
| 9 | Can LFO3 modulate LFO2's MULT, LFO2 modulate LFO1's MULT, and all three cross-modulate simultaneously without feedback loops breaking the system? | Yes, the hierarchy allows this: LFO3 can modulate LFO1 and LFO2; LFO2 can modulate LFO1. No circular dependencies exist. However, rapid changes could cause audio artifacts. | High |
| 10 | When SPD=1 and MULT=1 (slowest possible, ~4 minutes per cycle at 120 BPM), does the LFO continue updating smoothly, or does it become quantized/stepped due to low phase increment? | Updates are continuous (not quantized to phase steps). Phase increments by tiny amounts each update. Visual quantization might appear due to display resolution. | Low |
| 11 | If MODE=TRG with a very fast trigger rate and FADE=-30 (fade IN), can you trigger faster than the fade completes, stacking multiple fading envelopes? | Yes. Each trigger resets fade progress to 0. Multiple rapid triggers create overlapping fade envelopes. Without proper modulation destination mixing, only the most recent envelope is audible. | Medium |
| 12 | In FADE, is the fade duration absolute (e.g., "always 500ms to complete") or relative to the LFO cycle time? | Relative to cycle time. Fade rate = |FADE|/64 applied per update. Longer cycles = slower fade in absolute time; shorter cycles = faster fade. | High |
| 13 | When waveform is changed from TRI to RND while the LFO is mid-cycle, does it continue from the current phase position, or does it reset? | Should continue from current phase position. Changing waveform only affects the output calculation function, not the phase tracker. Output may jump abruptly. | Medium |
| 14 | For unipolar waveforms (EXP, RMP), does DEPTH=+32 produce a range of 0 to +0.5, or does it scale from the unipolar -1.0 to +1.0 range like bipolar waveforms? | Unipolar output (0 to +1) is scaled by depth/64. DEPTH=+32 produces 0 to +0.5. Unipolar waveforms never go negative regardless of depth sign (before scaling). | Medium |
| 15 | What happens when FADE switches from -30 (fade IN) to +30 (fade OUT) mid-cycle? Does the modulation fade out from its current level, or does it immediately jump back to full depth before fading out? | Should fade out from current level. Fade multiplier is already at some value; switching fade sign changes direction without resetting progress. Result: smoother envelope transition. | High |
| 16 | If MODE=HLF starting at SPH=100 going forward, is the "halfway point" at phase 0.5 from the start (0.5 + 0.78 = 1.28 wrapped = 0.28), or is it always globally at phase 0.5? | Halfway is relative to start phase: `(start_phase + 0.5) % 1.0`. From SPH=100 (0.78), halfway = 0.28. LFO stops at phase 0.28, not 0.5. | High |
| 17 | For MODE=ONE with SPD=-48 (backward), starting from SPH=0, does the LFO travel backward to reach the start phase again, or does it travel forward (interpreting "one cycle" as always going positive)? | Travels backward. ONE mode follows the direction set by SPD sign. Negative speed = backward travel. Still requires exactly one complete 360° cycle to complete. | High |
| 18 | When MODE=FRE and the LFO has been running continuously for hours, does phase wrapping at 1.0 ever cause accumulated floating-point rounding errors that gradually shift the LFO frequency? | Theoretically possible in 32-bit implementations. 64-bit double-precision should be stable indefinitely. Hardware likely uses fixed-point or integer phase math to avoid this. | Low |

---

## Part 2: Detailed Test Case Descriptions

### TEST 1: Negative Speed Symmetry
**Question:** Does SPD=-64 produce the same cycle duration as SPD=+64?

**Setup:**
- Create two identical LFO configurations
- Config A: WAVE=SIN, SPD=+64, MULT=16, MODE=FRE, all others default
- Config B: WAVE=SIN, SPD=-64, MULT=16, MODE=FRE, all others default

**Test Procedure:**
1. Start both LFOs simultaneously
2. Measure time for Config A to complete 1 full cycle
3. Measure time for Config B to complete 1 full cycle (backward)
4. Record phase direction for each (Config A: 0→1→0, Config B: 0→-1→0)

**Expected Result:**
- Both complete in identical time (128 phase steps / (64 × 16) = 0.125 bars)
- Config A phase increases, Config B phase decreases
- Both produce same frequency of modulation

**Spec Reference:** Line 96-102 (SPD range and negative behavior)

---

### TEST 2: ONE Mode with Non-Zero Start Phase (Backward)
**Question:** Does ONE mode with negative speed respect the start phase boundary?

**Setup:**
- WAVE=SIN, SPD=-32, MULT=8, MODE=ONE, SPH=64, all others default

**Test Procedure:**
1. Reset LFO to initial state
2. Trigger note (starts phase at 0.5)
3. Record phase position every 100ms until LFO stops
4. Verify stopping condition: phase returns to exactly 0.5

**Expected Result:**
- LFO travels backward from 0.5 through 0.25, 0.0, wraps to 1.0, 0.75, 0.5
- Completes exactly 360° of backward travel
- Stops at phase 0.5 (same as start phase)
- isRunning flag becomes false

**Spec Reference:** Lines 443-461 (ONE mode stop detection for both directions)

---

### TEST 3: Depth = 0 Behavior
**Question:** Does a LFO with DEPTH=0 still update internal state?

**Setup:**
- WAVE=RND, SPD=32, MULT=4, MODE=TRG, DEPTH=0, FADE=-30

**Test Procedure:**
1. Configure LFO as above
2. Trigger at t=0ms
3. Immediately change DEPTH from 0 to +32
4. Observe output

**Expected Result:**
- With DEPTH=0, output=0 before step 3 (modulation calculation scales by 0/64)
- Internal LFO is still updating: phase advancing, fade progressing
- After changing DEPTH, modulation appears immediately (not delayed by previous fade)
- This proves internal state continued updating despite DEPTH=0

**Spec Reference:** Lines 189-194 (DEP calculation)

---

### TEST 4: Negative Depth with Unipolar Waveform
**Question:** Does negative depth on EXP waveform invert the unipolar (0 to +1) shape?

**Setup:**
- Config A: WAVE=EXP, SPD=16, MULT=8, DEPTH=+32, MODE=FRE
- Config B: WAVE=EXP, SPD=16, MULT=8, DEPTH=-32, MODE=FRE
- Sample output at phase 0.0, 0.5, 1.0

**Test Procedure:**
1. Generate Config A output values at phases: 0.0, 0.25, 0.5, 0.75, 1.0
   - EXP at these phases: ~0.0, ~0.18, ~0.47, ~0.81, ~1.0
   - With DEPTH=+32: multiply each by 32/64 = 0.5
   - Expected: 0.0, 0.09, 0.235, 0.405, 0.5
2. Generate Config B same phases
   - With DEPTH=-32: multiply each by -32/64 = -0.5
   - Expected: 0.0, -0.09, -0.235, -0.405, -0.5
3. Compare values

**Expected Result:**
- Negative depth inverts the output without changing waveform shape
- EXP waveform still accelerates upward; values are simply negative
- Result: modulation destination moves in opposite direction but with same curve character

**Spec Reference:** Lines 180-187 (DEP behavior)

---

### TEST 5: HLD Mode with Fade Reset on Trigger
**Question:** Does FADE progress reset when a trigger occurs in HLD mode?

**Setup:**
- WAVE=TRI, SPD=8, MULT=4, MODE=HLD, DEPTH=+48, FADE=-16
- Trigger spacing: 250ms apart

**Test Procedure:**
1. Trigger at t=0ms
   - Capture output at t=0, 50, 100, 150, 200ms
   - Note fade progression (should fade in from 0 to some value)
2. Trigger at t=250ms
   - Immediately capture output (should sample current LFO value)
   - Continue capturing at t=250, 300, 350, 400ms
   - Note if fade resets to 0 or continues from previous value

**Expected Result:**
- First segment: fade progresses from 0 upward (fade IN starts at 0)
- Trigger at 250ms: fadeProgress resets to 0
- Second segment: fade starts ramping up again from 0
- HLD captures the held value, but fade envelope restarts

**Spec Reference:** Lines 545-561 (HLD trigger handler resets fadeProgress)

---

### TEST 6: RND Waveform at Audio-Rate Speed
**Question:** Does RND waveform generate 16 steps per cycle regardless of MULT?

**Setup:**
- WAVE=RND, SPD=32, MULT=512, MODE=FRE, DEPTH=+63
- MULT=512 creates: 32 × 512 = 16384 phase steps per bar = 128 cycles per bar

**Test Procedure:**
1. Generate RND waveform output at 16384 sample positions across one bar
2. Count number of distinct output values (steps) generated
3. Calculate average "hold time" per step

**Expected Result:**
- Approximately 128 complete "16-step" cycles in one bar
- Each cycle contains ~16 distinct random values
- Average 128 phase steps per random value (16384 / 128 ≈ 128)
- RND does NOT accelerate to 128 steps per cycle; stays at 16 steps per cycle

**Spec Reference:** Lines 38, 361-373 (RND generates new value every 1/16th of phase, ~16 steps per cycle)

---

### TEST 7: HLF Mode Boundary Precision
**Question:** Does the LFO stop exactly at the halfway point or does it overshoot?

**Setup:**
- WAVE=SIN, SPD=16, MULT=4, MODE=HLF, SPH=0
- Polling interval: 1ms (precise sampling)

**Test Procedure:**
1. Trigger at t=0 (phase = 0.0)
2. Sample phase position every 1ms until isRunning becomes false
3. Record final phase position with 4 decimal places
4. Calculate "overshoot" if any: |final_phase - 0.5|

**Expected Result:**
- Final phase should be 0.5000 (±0.001 tolerance)
- Overshoot should be < 0.01 phase units
- isRunning becomes false in the same update where phase reaches 0.5

**Spec Reference:** Lines 464-487 (HLF mode stop detection with boundary crossing)

---

### TEST 8: Maximum FADE IN with ONE Mode Completion
**Question:** Does FADE=-64 complete fade-in before ONE mode stops?

**Setup:**
- WAVE=TRI, SPD=8, MULT=16, MODE=ONE, SPH=0, FADE=-64, DEPTH=+48
- Measure fade multiplier and phase position continuously

**Test Procedure:**
1. Trigger at t=0
2. Sample (phase, fadeMultiplier, output) every 10ms
3. Record when isRunning becomes false
4. Check fadeMultiplier value at that moment

**Expected Result:**
- fadeMultiplier should reach 1.0 (or very close) before ONE mode completes
- If FADE=-64 (maximum fade rate), fade should be nearly complete by cycle end
- Fade rate = 64/64 = 1.0 (fastest possible)
- ONE cycle duration at these settings = 1 bar = ~2000ms at 120 BPM
- Fade-in should complete in << 2000ms

**Spec Reference:** Lines 496-511 (Fade envelope timing)

---

### TEST 9: Three-LFO Cross-Modulation Chain
**Question:** Can LFO3→LFO2→LFO1 modulation work simultaneously without instability?

**Setup:**
- LFO1: WAVE=SIN, SPD=16, MULT=4, MODE=FRE
  - LFO1.SPD is modulation destination for LFO2
- LFO2: WAVE=TRI, SPD=8, MULT=8, MODE=FRE
  - LFO2.MULT is modulation destination for LFO3
- LFO3: WAVE=RMP, SPD=32, MULT=2, MODE=FRE

**Test Procedure:**
1. Run all three LFOs simultaneously for 10 seconds
2. Monitor LFO1.SPD: should oscillate due to LFO2 modulation
3. Monitor LFO2.MULT: should appear to change due to LFO3 modulation
4. Observe output waveforms for discontinuities or artifacts

**Expected Result:**
- LFO3 modulates LFO2.MULT smoothly
- LFO2 (with modulated MULT) modulates LFO1.SPD
- LFO1 (with modulated SPD) produces output with dynamic modulation rate
- No feedback loops (since hierarchy only goes LFO3→LFO2→LFO1)
- Outputs remain continuous without jumps or discontinuities

**Spec Reference:** Lines 10-14 (LFO hierarchy), Lines 276-277 (modulation destinations)

---

### TEST 10: Slowest LFO Smooth Continuity
**Question:** At SPD=1, MULT=1 (~4-minute cycle), is phase smooth or stepped?

**Setup:**
- WAVE=SIN, SPD=1, MULT=1, MODE=FRE, DEPTH=+32
- Polling at 60 FPS (16.67ms intervals)

**Test Procedure:**
1. Run LFO for at least 30 seconds
2. Capture phase position and output value every frame
3. Calculate phase delta between consecutive frames
4. Verify phase delta is not quantized to discrete steps

**Expected Result:**
- Phase delta per frame: ~16.67ms ÷ 256000ms (cycle time) ≈ 0.000065 phase units
- Phase values should be smoothly increasing, not jumping to discrete steps
- Output may appear stepped on screen due to display resolution, but internal phase is continuous

**Spec Reference:** Lines 418-441 (phase update calculations use floating-point, not quantized steps)

---

### TEST 11: Overlapping Fade Envelopes with Rapid Triggers
**Question:** Can you trigger faster than a fade completes?

**Setup:**
- WAVE=EXP, SPD=32, MULT=4, MODE=TRG, DEPTH=+48, FADE=-30
- Trigger rhythm: every 100ms (faster than expected fade completion)

**Test Procedure:**
1. Trigger at t=0, 100, 200, 300ms
2. Capture output at:
   - t=0: just after trigger 1
   - t=50: before trigger 2 (fade mid-progress)
   - t=100: trigger 2 happens
   - t=150: fade resets and progresses again
   - t=200: trigger 3
   - Continue pattern
3. Verify each trigger resets fade progress

**Expected Result:**
- Each trigger resets fadeProgress to 0
- Output rises from 0 toward full depth, then resets on next trigger
- Creates a "staggered" ramp pattern, not smooth crescendo
- Each trigger is independent; no accumulated envelope

**Spec Reference:** Lines 545-572 (handleTrigger resets fadeProgress for TRG and ONE modes)

---

### TEST 12: Fade Timing Relative to Cycle, Not Absolute
**Question:** Is fade duration relative to LFO cycle, or fixed in milliseconds?

**Setup:**
- Config A: WAVE=TRI, SPD=16, MULT=8, FADE=-32, DEPTH=+48 (1-bar cycle)
- Config B: WAVE=TRI, SPD=32, MULT=16, FADE=-32, DEPTH=+48 (1/2-bar cycle)
- Both at 120 BPM

**Test Procedure:**
1. Trigger Config A at t=0
2. Measure time until fadeMultiplier reaches 0.95
   - Expected: ~50% of cycle time (fade rate = 32/64)
   - Config A cycle: 1 bar = 2000ms
   - Expected fade-to-0.95: ~1000ms
3. Repeat for Config B
   - Cycle: 1/2 bar = 1000ms
   - Expected fade-to-0.95: ~500ms
4. Compare fade completion times

**Expected Result:**
- Fade rate is 32/64 = 0.5 (half-speed)
- Each LFO reaches 95% fade in ~50% of its own cycle time
- Config A takes ~1000ms, Config B takes ~500ms
- Proves fade timing is RELATIVE to cycle, not absolute

**Spec Reference:** Lines 496-511 (fadeRate calculation uses cyclesPerMs, making fade relative to cycle time)

---

### TEST 13: Waveform Switch Mid-Cycle
**Question:** Changing waveform mid-cycle: continuous phase or reset?

**Setup:**
- WAVE=TRI, SPD=16, MULT=8, MODE=FRE
- Run for 500ms, then change WAVE to RND
- Monitor phase continuity

**Test Procedure:**
1. Start LFO at t=0 with WAVE=TRI
2. Capture phase and output every 50ms
3. At t=500ms, change WAVE to RND
4. Continue capturing every 50ms for 500ms more
5. Observe discontinuities in output values

**Expected Result:**
- Phase position continues smoothly across waveform change
- At t=500ms, if phase=0.2, output changes from TRI(0.2) to RND(0.2)
- RND may produce wildly different output value due to random sampling
- But phase itself doesn't reset; it continues from 0.2
- Output can jump abruptly, but no "pop" or discontinuity in phase

**Spec Reference:** Lines 325-373 (Waveform functions are stateless; phase is the state)

---

### TEST 14: Unipolar Waveform Depth Scaling
**Question:** Does unipolar EXP with DEPTH=+32 produce 0 to 0.5 or something else?

**Setup:**
- Config A: WAVE=EXP, SPD=16, MULT=8, DEPTH=+32, MODE=FRE
- Config B: WAVE=EXP, SPD=16, MULT=8, DEPTH=+64, MODE=FRE
- Sample output at phase 0.0, 0.5, 1.0

**Test Procedure:**
1. Generate EXP waveform raw values:
   - Phase 0.0: ~0.0
   - Phase 0.5: ~0.47 (middle of exponential)
   - Phase 1.0: ~1.0
2. For Config A, multiply by 32/64 = 0.5:
   - Expected: 0.0, 0.235, 0.5
3. For Config B, multiply by 64/64 = 1.0:
   - Expected: 0.0, 0.47, 1.0

**Expected Result:**
- EXP (unipolar 0 to 1) × (32/64) = 0 to 0.5
- EXP (unipolar 0 to 1) × (64/64) = 0 to 1.0
- Unipolar waveforms ALWAYS 0 to +1 before depth scaling
- Negative depth only applies to bipolar waveforms in a meaningful way (negating bipolar range)
- Negative depth on unipolar: scales downward from 0, producing 0 to -0.5 etc.

**Spec Reference:** Lines 36-37, 189-194 (Waveform polarity, DEP calculation)

---

### TEST 15: Fade Direction Switch Mid-Envelope
**Question:** Switching FADE from -30 to +30 mid-cycle: fade out from current, or jump?

**Setup:**
- WAVE=SIN, SPD=8, MULT=8, MODE=TRG, DEPTH=+48, FADE=-30
- Trigger at t=0
- At t=500ms, change FADE to +30

**Test Procedure:**
1. Trigger at t=0 (fades in from 0 toward 1.0)
2. Capture output at t=0, 100, 200, 300, 400, 500ms
3. At t=500ms, switch FADE from -30 to +30
4. Continue capturing at t=500, 600, 700, 800, 900ms
5. Note fadeMultiplier values

**Expected Result:**
- t=0-500ms: fadeMultiplier increases from 0 toward 1.0 (fade IN)
  - At t=500ms, fadeMultiplier ≈ 0.5 (halfway faded in)
- t=500ms: FADE changes to +30
  - fadeMultiplier does NOT jump; stays at 0.5
  - Fade direction reverses (positive FADE = fade OUT)
- t=500-1000ms: fadeMultiplier decreases from 0.5 toward 0 (fade OUT)
- Result: smooth envelope transition, no jump

**Spec Reference:** Lines 504-510 (Fade direction is determined by FADE sign; fadeMultiplier continues from current value)

---

### TEST 16: HLF Mode with Non-Zero Start Phase
**Question:** Is halfway relative to start phase, or always at global 0.5?

**Setup:**
- WAVE=SIN, SPD=16, MULT=8, MODE=HLF, SPH=100 (≈0.78 normalized), DEPTH=+48

**Test Procedure:**
1. Trigger at t=0 (phase starts at 0.78)
2. Calculate expected stop point: (0.78 + 0.5) % 1.0 = 0.28
3. Run LFO until isRunning becomes false
4. Record final phase position

**Expected Result:**
- LFO travels forward from 0.78 → 0.9 → 1.0 (wraps) → 0.0 → 0.15 → 0.28
- Stops at phase 0.28 (not at global 0.5)
- Confirms halfway calculation is `(start_phase + 0.5) % 1.0`

**Spec Reference:** Lines 464-487 (HLF mode calculation: `halfwayPhase = (startPhase + 0.5) % 1.0`)

---

### TEST 17: ONE Mode Backward with Zero Start Phase
**Question:** Does backward ONE mode travel backward through a full cycle?

**Setup:**
- WAVE=TRI, SPD=-48, MULT=4, MODE=ONE, SPH=0, DEPTH=+48

**Test Procedure:**
1. Trigger at t=0 (phase = 0.0)
2. Capture phase every 50ms until isRunning becomes false
3. Verify direction (should be negative/decreasing)

**Expected Result:**
- Phase travels backward: 0.0 → -0.1 (wraps to 0.9) → 0.8 → ... → 0.1 → 0.0
- Complete 360° backward rotation
- Stops at phase 0.0 (start phase)
- isRunning becomes false after full cycle
- Output is inverted TRI shape due to backward motion

**Spec Reference:** Lines 443-461 (ONE mode detects backward completion: `newPhase <= startPhase && prevPhase > startPhase`)

---

### TEST 18: Long-Running FRE Mode Floating-Point Stability
**Question:** Does a continuously running FRE LFO drift frequency over hours due to rounding errors?

**Setup:**
- WAVE=SIN, SPD=16, MULT=8, MODE=FRE, DEPTH=+32
- Run for simulated 24 hours at 1000 FPS (simulated time)

**Test Procedure:**
1. Calculate theoretical cycle time: 1 bar = 2000ms
2. Measure actual cycles in:
   - First hour (simulated)
   - 12th hour
   - 24th hour
3. Compare cycle counts to expected (should be identical)

**Expected Result:**
- 32-bit floating point: may accumulate small errors after many hours
- 64-bit double precision: should be stable indefinitely
- Hardware likely uses integer/fixed-point arithmetic: no drift

**Spec Reference:** Lines 429-441 (Phase wrapping uses floating-point math)

---

## Part 3: Discrepancy Analysis

### Identified Specification Ambiguities

1. **Random Waveform Step Timing at Audio Rates**
   - Spec states RND changes ~16x more frequently than other waveforms
   - Unclear if this is a fixed number of steps per cycle or a time-based rate
   - Recommendation: TEST 6 will clarify

2. **HLF Mode Backward Behavior**
   - Spec describes forward behavior clearly but backward is implied
   - Expected behavior: halfway point reverses direction (subtract 0.5 instead of add)
   - Recommendation: Verify with hardware

3. **Fade Timing During Stopped ONE/HLF**
   - Spec shows code where fade continues after ONE stops
   - Question: should fade be frozen once ONE reaches its endpoint?
   - Current spec: fade continues (line 509 shows fadeMultiplier is maintained)

4. **HLD Mode and Modulation Destinations**
   - HLD samples output at trigger time and holds it
   - Spec doesn't clarify if held value updates when modulation destination changes
   - Expected: held value is frozen; modulation to underlying LFO doesn't affect held output

5. **DEPTH Asymmetry (-64 to +63)**
   - Spec mentions SPD, DEP, FADE all have this asymmetry
   - No explanation of why hardware chose this design
   - May affect certain calculations; recommend testing edge cases at -64 vs +63

### Recommendations

1. **Validate RND behavior** at MULT=2048 (TEST 6)
2. **Test HLF backward** with SPH != 0 (TEST 16)
3. **Verify FADE behavior** when ONE mode completes (TEST 8)
4. **Test HLD and cross-modulation** to confirm held value independence
5. **Test -64 edge cases** for DEP and FADE parameters

---

## Test Execution Checklist

Use this checklist to track test completion:

- [ ] TEST 1: Negative Speed Symmetry
- [ ] TEST 2: ONE Mode with Non-Zero Start Phase (Backward)
- [ ] TEST 3: Depth = 0 Behavior
- [ ] TEST 4: Negative Depth with Unipolar Waveform
- [ ] TEST 5: HLD Mode with Fade Reset on Trigger
- [ ] TEST 6: RND Waveform at Audio-Rate Speed
- [ ] TEST 7: HLF Mode Boundary Precision
- [ ] TEST 8: Maximum FADE IN with ONE Mode Completion
- [ ] TEST 9: Three-LFO Cross-Modulation Chain
- [ ] TEST 10: Slowest LFO Smooth Continuity
- [ ] TEST 11: Overlapping Fade Envelopes with Rapid Triggers
- [ ] TEST 12: Fade Timing Relative to Cycle
- [ ] TEST 13: Waveform Switch Mid-Cycle
- [ ] TEST 14: Unipolar Waveform Depth Scaling
- [ ] TEST 15: Fade Direction Switch Mid-Envelope
- [ ] TEST 16: HLF Mode with Non-Zero Start Phase
- [ ] TEST 17: ONE Mode Backward with Zero Start Phase
- [ ] TEST 18: Long-Running FRE Mode Floating-Point Stability

---

## Document Metadata

- **Created:** Based on DIGITAKT_II_LFO_SPEC.md and DIGITAKT_II_LFO_PRESETS.md
- **Test Cases:** 18 comprehensive edge-case scenarios
- **Coverage:** LFO parameters (WAVE, SPD, MULT, SPH, MODE, DEP, FADE)
- **Focus Areas:** Negative values, unipolar waveforms, cross-modulation, boundary conditions, fade behavior, mode interactions
- **Status:** Ready for implementation and execution
