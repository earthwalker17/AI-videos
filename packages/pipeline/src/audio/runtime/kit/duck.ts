/**
 * Sidechain ducking: an envelope follower on one signal (the sidechain) drives the gain of
 * another, so music can step back under effects, a voice or a hit. The follower has attack and
 * release ballistics; the gain computer is a compressor's (threshold, ratio, soft knee) whose
 * reduction never exceeds the ducker's depth.
 */
import { SR, type StereoClip } from './dsp.ts';

type Signal = Float32Array | Float64Array | StereoClip;

/**
 * The envelope of a signal: |x| (stereo: the larger channel) through attack and release
 * ballistics (one-pole time constants, s). Float64, as long as the signal.
 */
export function follow(x: Signal, attack: number, release: number): Float64Array {
  const [l, r] = x instanceof Float32Array || x instanceof Float64Array ? [x, x] : [x.l, x.r];
  const aA = Math.exp(-1 / (Math.max(1e-6, attack) * SR));
  const aR = Math.exp(-1 / (Math.max(1e-6, release) * SR));
  const out = new Float64Array(l.length);
  let env = 0;
  for (let i = 0; i < l.length; i++) {
    const lvl = Math.max(Math.abs(l[i]), Math.abs(r[i]));
    const a = lvl > env ? aA : aR;
    env = a * env + (1 - a) * lvl;
    if (env < 1e-25) env = 0;
    out[i] = env;
  }
  return out;
}

export interface DuckOptions {
  /** the most gain reduction, dB (positive) */
  depthDb: number;
  /** the sidechain envelope level where ducking starts, dBFS (default -40) */
  thresholdDb?: number;
  /** reduction per dB over the threshold is 1 - 1/ratio (default Infinity: one dB per dB, up to the depth) */
  ratio?: number;
  /** soft-knee width, dB (default 6) */
  kneeDb?: number;
  /** follower ballistics, s (default 10 ms attack, 300 ms release) */
  attack?: number;
  release?: number;
}

/** The reduction (dB, ≥ 0) for an envelope level: the gain computer. */
export function duckReductionDb(levelDb: number, o: DuckOptions): number {
  const over = levelDb - (o.thresholdDb ?? -40);
  const slope = 1 - 1 / (o.ratio ?? Infinity);
  const w = o.kneeDb ?? 6;
  let gr = 0;
  if (over >= w / 2) gr = slope * over;
  else if (w > 0 && over > -w / 2) gr = (slope * (over + w / 2) ** 2) / (2 * w);
  return Math.min(o.depthDb, Math.max(0, gr));
}

/** Per-sample gain (linear, 1 = untouched) that ducks a signal under `side`. */
export function duckGain(side: Signal, o: DuckOptions): Float32Array {
  const env = follow(side, o.attack ?? 0.01, o.release ?? 0.3);
  const g = new Float32Array(env.length);
  for (let i = 0; i < env.length; i++) {
    const gr = env[i] > 0 ? duckReductionDb(20 * Math.log10(env[i]), o) : 0;
    g[i] = gr > 0 ? 10 ** (-gr / 20) : 1;
  }
  return g;
}
