/**
 * What QA will measure, measured on the master before it is written, so every build of the
 * score reports it (an agent cannot hear: knowledge/score-to-the-cue-sheet.md).
 *
 * A mirror of packages/pipeline/src/qa/audio.ts (the rest rule, the unweighted gated level and
 * the onset finder), which a score may not import (the audio stage loads only the score API and
 * the kit). Kept small and in this video: video #4 V1 had the same kind of mirror (`qaLines`,
 * at its archived tag), so this is the second; promote it to the kit when a third score needs it.
 * Also a high-band onset (the energy of the signal's second difference), which a low tone under
 * a hit cannot drag late.
 */
import { SR } from '@aiv/pipeline/audio/kit';

/** Per sample, the mean over the channels of the squared sample, as QA decodes a delivery. */
export function powerOf(l: Float32Array, r: Float32Array): Float32Array {
  const p = new Float32Array(l.length);
  for (let i = 0; i < l.length; i++) p[i] = (l[i] * l[i] + r[i] * r[i]) / 2;
  return p;
}

const toDb = (ms: number): number => (ms > 0 ? 10 * Math.log10(ms) : -Infinity);

/** 20·log10(RMS) of power[from, to). */
export function rmsDb(power: Float32Array, from: number, to: number): number {
  const a = Math.max(0, Math.floor(from));
  const b = Math.min(power.length, Math.floor(to));
  if (b <= a) return -Infinity;
  let sum = 0;
  for (let i = a; i < b; i++) sum += power[i];
  return toDb(sum / (b - a));
}

/** The mix's level, gated like BS.1770 but unweighted (400 ms blocks every 100 ms, -70 dB and -10 dB gates). */
export function integratedLevelDb(power: Float32Array): number | null {
  const seg = Math.round(SR * 0.1);
  const n = Math.floor(power.length / seg);
  const segPower: number[] = [];
  for (let k = 0; k < n; k++) {
    let sum = 0;
    for (let i = k * seg; i < (k + 1) * seg; i++) sum += power[i];
    segPower.push(sum / seg);
  }
  const blocks = segPower.slice(3).map((_, k) => (segPower[k] + segPower[k + 1] + segPower[k + 2] + segPower[k + 3]) / 4);
  const mean = (xs: readonly number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
  const loud = blocks.filter((p) => p > 1e-7);
  if (!loud.length) return null;
  const relative = mean(loud) * 0.1;
  return toDb(mean(loud.filter((p) => p > relative)));
}

/** The loudest 3 s (hopping 10 ms) of power[from, to); a shorter range is measured whole. */
export function loudestWindowDb(power: Float32Array, from: number, to: number, windowS = 3): number {
  const a = Math.max(0, Math.floor(from));
  const n = Math.min(power.length, Math.floor(to)) - a;
  if (n <= 0) return -Infinity;
  const w = Math.min(n, Math.round(windowS * SR));
  const hop = Math.round(SR * 0.01);
  const prefix = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) prefix[i + 1] = prefix[i] + power[a + i];
  let best = 0;
  for (let s = 0; ; s += hop) {
    const start = Math.min(s, n - w);
    best = Math.max(best, prefix[start + w] - prefix[start]);
    if (start === n - w) break;
  }
  return toDb(best / w);
}

/**
 * The onset nearest a cue as QA's finder reads it: in 5 ms blocks on a grid through the cue,
 * the block with the largest rise over the one before (at least double, and above a floor),
 * within ±120 ms. Offset in ms (negative: early), or null when nothing rises.
 */
export function onsetMs(energyOf: (from: number, to: number) => number, at: number, searchMs = 120): number | null {
  const h = Math.round(SR * 0.005);
  const reach = Math.floor(((searchMs / 1000) * SR) / h);
  const block = (k: number) => energyOf(at + k * h, at + (k + 1) * h);
  let prev = block(-reach - 1);
  let best = 0;
  let bestK: number | null = null;
  for (let k = -reach; k <= reach; k++) {
    const e = block(k);
    const rise = e - prev;
    if (e >= 2 * prev && rise / h > 1e-8 && rise > best) {
      best = rise;
      bestK = k;
    }
    prev = e;
  }
  return bestK === null ? null : (bestK * h * 1000) / SR;
}

/** Sum of power[from, to) (QA's block energy). */
export const energy =
  (power: Float32Array) =>
  (from: number, to: number): number => {
    let e = 0;
    for (let i = Math.max(0, from); i < Math.min(power.length, to); i++) e += power[i];
    return e;
  };

/** Per sample, the power of the signal's second difference: mostly what lies above a few kHz. */
export function highBandPower(l: Float32Array, r: Float32Array): Float32Array {
  const p = new Float32Array(l.length);
  for (let i = 2; i < l.length; i++) {
    const dl = l[i] - 2 * l[i - 1] + l[i - 2];
    const dr = r[i] - 2 * r[i - 1] + r[i - 2];
    p[i] = (dl * dl + dr * dr) / 2;
  }
  return p;
}
