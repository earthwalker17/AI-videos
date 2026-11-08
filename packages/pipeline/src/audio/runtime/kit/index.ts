// @aiv/pipeline/audio/kit — the shared score kit: generic DSP a video's score builds its music
// and sound design from (docs/ARCHITECTURE.md, decision 29). It lies inside the stage's runtime,
// so every scored video's audio input hash covers it, and it has the runtime's rules: a pure
// function of its inputs (no clocks, no unseeded randomness, no Node built-ins, no files).
// Musical content (instruments, presets, arrangements, the mix) stays in the video's audio/.
//
//   dsp.ts       units, pan law, seeded noise, biquad / SVF / one-pole filters, resonators and
//                the modal bank, breakpoint curves, peak levelling (norm)
//   osc.ts       PolyBLEP / PolyBLAMP oscillators (saw, square, pulse, triangle; sine), FM bell
//   adsr.ts      the ADSR envelope          pluck.ts  Karplus–Strong strings and ticks
//   delay.ts     tempo-syncable (ping-pong) feedback delay, cut-aware
//   duck.ts      envelope follower and sidechain ducking
//   fft.ts       FFT and stereo FFT convolution, cut-aware   reverb.ts  synthetic halls and rooms
//   mixer.ts     named buses and sends, cut-aware placement, ducking, levels
//   master.ts    BS.1770-4 meter, true peak, glue, look-ahead limiter, the iterated master
//   timeline.ts  the cue sheet's bar grid and cues in samples
export * from './dsp.ts';
export * from './osc.ts';
export * from './adsr.ts';
export * from './pluck.ts';
export * from './delay.ts';
export * from './duck.ts';
export * from './fft.ts';
export * from './reverb.ts';
export * from './mixer.ts';
export * from './master.ts';
export * from './timeline.ts';
