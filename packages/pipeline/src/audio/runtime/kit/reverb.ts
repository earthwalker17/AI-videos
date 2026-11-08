// SPDX-License-Identifier: MIT
// Adapted from https://github.com/earthwalker17/map-of-middle-earth/blob/696e968/tools/music/engine.py (hall_ir: synthIr and its hall preset)
/**
 * Synthetic spaces for the convolution reverb (fft.ts). Each impulse response is seeded noise,
 * decorrelated between the ears, split into bands that decay at their own rates (lows longest,
 * highs shortest), with a soft diffuse build-up, a few early reflections and a predelay,
 * normalised to unit energy. Two presets, a hall and a small room; a score shapes its own space
 * with synthIr({ ...HALL, seed, rt60: 1.8 }).
 *
 * Copied from the score of "A Halloween Gift" (videos/halloween-gift/audio/reverb.ts, frozen):
 * the presets give the same responses for the same seed.
 */
import { Biquad, SR, gaussNoise, seedOf, type StereoClip } from './dsp.ts';
import { convolveInto, prepareIr, type StereoIr } from './fft.ts';

export interface IrBand {
  /** band edges in Hz (null: open below or above) */
  lo: number | null;
  hi: number | null;
  /** RT60 of this band relative to the nominal one */
  rt: number;
}

export interface IrOptions {
  seed: number;
  /** names the noise: two spaces with the same seed and id are the same space */
  id: string;
  /** nominal reverberation time to -60 dB, s */
  rt60: number;
  /** silence before the response, s */
  predelay: number;
  /** response length (without the predelay), s */
  length: number;
  /** time constant of the diffuse build-up, s */
  onset: number;
  /** early reflections: [time s, gain], alternating sides */
  early: readonly (readonly [number, number])[];
  bands: readonly IrBand[];
}

export type IrPreset = Omit<IrOptions, 'seed'>;

/** 4th-order Linkwitz-Riley style band (two cascaded Butterworth biquads per edge). */
function bandFilter(x: Float64Array, lo: number | null, hi: number | null): Float64Array {
  const y = Float64Array.from(x);
  const stages: Biquad[] = [];
  if (lo !== null) stages.push(new Biquad('highpass', lo), new Biquad('highpass', lo));
  if (hi !== null) stages.push(new Biquad('lowpass', hi), new Biquad('lowpass', hi));
  for (const s of stages) s.run(y);
  return y;
}

/** A stereo impulse response of unit energy (per channel, on average), `predelay + length` long. */
export function synthIr(o: IrOptions): StereoIr {
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

/** A hall: ~2.4 s RT60, 24 ms predelay. */
export const HALL: IrPreset = {
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
  bands: [
    { lo: null, hi: 250, rt: 1.15 },
    { lo: 250, hi: 1200, rt: 1 },
    { lo: 1200, hi: 4500, rt: 0.72 },
    { lo: 4500, hi: null, rt: 0.42 },
  ],
};

/** A small wooden room: ~0.35 s, dense early reflections, dull highs. */
export const ROOM: IrPreset = {
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
};

export const hallIr = (seed: number): StereoIr => synthIr({ ...HALL, seed });
export const roomIr = (seed: number): StereoIr => synthIr({ ...ROOM, seed });

/**
 * A convolution reverb as a mixer return's process: the wet signal of (l, r) through `ir`,
 * truncated at each cut with a `tailFade` s fade (default 30 ms) so no tail reaches a silence.
 * The response is transformed once, however often the process runs.
 */
export function convolver(ir: StereoIr, tailFade = 0.03): (l: Float32Array, r: Float32Array, cuts: readonly number[]) => StereoClip {
  const p = prepareIr(ir);
  const fade = Math.round(tailFade * SR);
  return (l, r, cuts) => {
    const out = { l: new Float32Array(l.length), r: new Float32Array(r.length) };
    convolveInto(l, r, p, out.l, out.r, cuts, fade);
    return out;
  };
}
