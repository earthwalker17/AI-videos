// SPDX-License-Identifier: MIT
// hallIr adapted from https://github.com/earthwalker17/map-of-middle-earth/blob/696e968/tools/music/engine.py (hall_ir)
/**
 * Synthetic spaces: a stereo hall (the score's one shared reverb) and a short room (knocks,
 * slippers). Each impulse response is seeded noise, decorrelated between the ears, split into
 * bands that decay at their own rates (lows longest, highs shortest), with a soft diffuse
 * build-up, a few early reflections and a predelay, normalised to unit energy.
 */
import { Biquad, SR, gaussNoise, seedOf } from './dsp.ts';
import type { StereoIr } from './fft.ts';

interface Band {
  lo: number | null;
  hi: number | null;
  /** RT60 of this band relative to the nominal one */
  rt: number;
}

const BANDS: Band[] = [
  { lo: null, hi: 250, rt: 1.15 },
  { lo: 250, hi: 1200, rt: 1 },
  { lo: 1200, hi: 4500, rt: 0.72 },
  { lo: 4500, hi: null, rt: 0.42 },
];

/** 4th-order Linkwitz-Riley style band (two cascaded Butterworth biquads per edge). */
function bandFilter(x: Float64Array, lo: number | null, hi: number | null): Float64Array {
  const y = Float64Array.from(x);
  const stages: Biquad[] = [];
  if (lo !== null) stages.push(new Biquad('highpass', lo), new Biquad('highpass', lo));
  if (hi !== null) stages.push(new Biquad('lowpass', hi), new Biquad('lowpass', hi));
  for (const s of stages) s.run(y);
  return y;
}

function synthIr(o: {
  seed: number;
  id: string;
  rt60: number;
  predelay: number;
  length: number;
  onset: number;
  early: readonly (readonly [number, number])[];
  bands: readonly Band[];
}): StereoIr {
  const n = Math.round(o.length * SR);
  const pre = Math.round(o.predelay * SR);
  const out: Float32Array[] = [];
  const chans: Float64Array[] = [];
  for (let c = 0; c < 2; c++) {
    const g = gaussNoise(seedOf(o.seed, o.id, c));
    const noise = new Float64Array(n);
    for (let i = 0; i < n; i++) noise[i] = g();
    const acc = new Float64Array(n);
    for (const b of o.bands) {
      const y = bandFilter(noise, b.lo, b.hi);
      const k = -6.907755278982137 / (o.rt60 * b.rt * SR);
      for (let i = 0; i < n; i++) acc[i] += y[i] * Math.exp(k * i);
    }
    for (let i = 0; i < n; i++) acc[i] *= 1 - Math.exp(-i / (o.onset * SR));
    chans.push(acc);
  }
  // early reflections: alternate sides, the far ear a little later
  o.early.forEach(([dt, g], k) => {
    const i = Math.round(dt * SR);
    if (i + 64 >= n) return;
    chans[0][i] += g * (k % 2 ? 1 : 0.7);
    chans[1][i + Math.round(0.0013 * SR)] += g * (k % 2 ? 0.7 : 1);
  });
  let e = 0;
  for (const ch of chans) for (let i = 0; i < n; i++) e += ch[i] * ch[i];
  const norm = 1 / Math.sqrt(e / 2);
  for (const ch of chans) {
    const f = new Float32Array(n + pre);
    for (let i = 0; i < n; i++) f[pre + i] = ch[i] * norm;
    out.push(f);
  }
  return { l: out[0], r: out[1] };
}

/** The hall: ~2.4 s RT60, 24 ms predelay. */
export const hallIr = (seed: number): StereoIr =>
  synthIr({
    seed,
    id: 'hall',
    rt60: 2.4,
    predelay: 0.024,
    length: 2.7,
    onset: 0.02,
    early: [
      [0.011, 0.5],
      [0.019, 0.4],
      [0.027, 0.33],
      [0.041, 0.25],
      [0.056, 0.2],
    ],
    bands: BANDS,
  });

/** A small wooden porch/room: ~0.35 s, dense early reflections, dull highs. */
export const roomIr = (seed: number): StereoIr =>
  synthIr({
    seed,
    id: 'room',
    rt60: 0.36,
    predelay: 0.002,
    length: 0.45,
    onset: 0.002,
    early: [
      [0.0031, 0.7],
      [0.0047, 0.55],
      [0.0068, 0.5],
      [0.0089, 0.4],
      [0.0123, 0.32],
      [0.0161, 0.25],
    ],
    bands: [
      { lo: null, hi: 300, rt: 1.2 },
      { lo: 300, hi: 2000, rt: 1 },
      { lo: 2000, hi: null, rt: 0.5 },
    ],
  });
