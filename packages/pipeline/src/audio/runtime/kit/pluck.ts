/**
 * Karplus–Strong: a plucked string (or, short and bright, a wood tick) from a delay line filled
 * with a seeded noise burst and fed back through a two-point average. The loop is tuned
 * exactly with a first-order all-pass for the fractional part of the period (Jaffe and Smith),
 * and its gain is set so the fundamental falls 60 dB in `t60` seconds.
 */
import { SR, clamp, seedOf, whiteNoise } from './dsp.ts';

export interface PluckOptions {
  /** seeds the excitation */
  seed: number;
  /** names the excitation: two plucks with the same seed and id start from the same burst */
  id?: string;
  /** clip length, s */
  len: number;
  /** time for the fundamental to fall 60 dB, s (default 1.5) */
  t60?: number;
  /** 0..1: the burst's brightness (default 0.8; lower is a softer, rounder pluck) */
  bright?: number;
  /** peak level of the burst (default 1) */
  amp?: number;
}

/** A plucked string at `f` Hz (held to 20 Hz .. SR / 4, where the loop is still a few samples long), `len` seconds long. */
export function pluck(f: number, o: PluckOptions): Float32Array {
  const n = Math.ceil(o.len * SR);
  const out = new Float32Array(n);
  const freq = clamp(f, 20, SR / 4);
  // the loop: L samples of line, `frac` in the all-pass, half a sample in the average
  const period = SR / freq - 0.5;
  let L = Math.floor(period);
  let frac = period - L;
  if (frac < 0.1) {
    L -= 1;
    frac += 1;
  }
  const C = (1 - frac) / (1 + frac);
  const g = Math.min(0.99999, 10 ** (-3 / (freq * (o.t60 ?? 1.5))));
  // the burst: seeded noise, low-passed by brightness, with its mean removed (no DC in the loop)
  const line = new Float64Array(L);
  const w = whiteNoise(seedOf(o.seed, o.id ?? 'pluck', Math.round(freq * 100)));
  const a = 1 - clamp(o.bright ?? 0.8, 0.02, 1);
  let lp = 0;
  let mean = 0;
  for (let i = 0; i < L; i++) {
    lp = (1 - a) * w() + a * lp;
    line[i] = lp;
    mean += lp;
  }
  mean /= L;
  let peak = 0;
  for (let i = 0; i < L; i++) {
    line[i] -= mean;
    peak = Math.max(peak, Math.abs(line[i]));
  }
  const s = peak > 0 ? (o.amp ?? 1) / peak : 0;
  for (let i = 0; i < L; i++) line[i] *= s;

  let k = 0;
  let apX = 0;
  let apY = 0;
  let last = 0;
  for (let i = 0; i < n; i++) {
    const x = line[k];
    const ap = C * x + apX - C * apY;
    apX = x;
    apY = ap;
    const y = g * 0.5 * (ap + last);
    last = ap;
    line[k] = Math.abs(y) < 1e-25 ? 0 : y;
    out[i] = x;
    if (++k === L) k = 0;
  }
  return out;
}
