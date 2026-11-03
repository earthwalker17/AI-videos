// SPDX-License-Identifier: MIT
// glue() and the chain in master() adapted from https://github.com/earthwalker17/map-of-middle-earth/blob/696e968/tools/music/engine.py (glue_compress, master)
/**
 * The master: a 28 Hz high-pass, a stereo-linked glue compressor, loudness to the target and a
 * look-ahead limiter driven by a 4× oversampled (true-peak) detector, iterated until the
 * integrated loudness lands on the target under the ceiling. The loudness meter is ITU-R
 * BS.1770-4 (K-weighting, 400 ms blocks with 75 % overlap, absolute and relative gates).
 *
 * The glue's ballistics and the chain's order (high-pass, glue, normalise, limit, trim) follow
 * the MAP engine; here they run per sample (the glue with a soft knee), and the limiter is new:
 * a per-sample true-peak bound held over the look-ahead, released, then box-smoothed.
 */
import { Biquad, SR, dbToGain } from './dsp.ts';

// --- loudness ------------------------------------------------------------------------------------

/** K-weighting at 48 kHz (BS.1770-4, table 1 and 2): a high shelf and the RLB high-pass. */
function kWeight(x: Float32Array | Float64Array): Float64Array {
  const y = Float64Array.from(x);
  new Biquad().coeffs(1.53512485958697, -2.69169618940638, 1.19839281085285, -1.69065929318241, 0.73248077421585).run(y);
  new Biquad().coeffs(1.0, -2.0, 1.0, -1.99004745483398, 0.99007225036621).run(y);
  return y;
}

export interface Loudness {
  /** integrated loudness, LUFS (-Infinity for silence) */
  i: number;
  /** loudness range, LU (EBU Tech 3342: short-term 3 s, -20 LU relative gate, 10th..95th percentile) */
  lra: number;
  /** the loudest momentary (400 ms) block, LUFS */
  maxMomentary: number;
}

const lufs = (ms: number) => -0.691 + 10 * Math.log10(ms);

export function loudness(l: Float32Array | Float64Array, r: Float32Array | Float64Array): Loudness {
  const kl = kWeight(l);
  const kr = kWeight(r);
  const hop = SR / 10;
  const hops = Math.floor(kl.length / hop);
  const e = new Float64Array(hops);
  for (let h = 0; h < hops; h++) {
    let s = 0;
    for (let i = h * hop; i < (h + 1) * hop; i++) s += kl[i] * kl[i] + kr[i] * kr[i];
    e[h] = s;
  }
  const block = (from: number, count: number) => {
    let s = 0;
    for (let k = from; k < from + count; k++) s += e[k];
    return s / (count * hop);
  };
  const blocks: number[] = [];
  for (let h = 0; h + 4 <= hops; h++) blocks.push(block(h, 4));
  const abs = blocks.filter((z) => z > 0 && lufs(z) > -70);
  let i = -Infinity;
  if (abs.length) {
    const ungated = abs.reduce((a, b) => a + b, 0) / abs.length;
    const rel = abs.filter((z) => lufs(z) > lufs(ungated) - 10);
    if (rel.length) i = lufs(rel.reduce((a, b) => a + b, 0) / rel.length);
  }
  const maxMomentary = blocks.length ? Math.max(...blocks.map((z) => (z > 0 ? lufs(z) : -Infinity))) : -Infinity;
  // short-term 3 s windows every 100 ms
  const st: number[] = [];
  for (let h = 0; h + 30 <= hops; h++) {
    const z = block(h, 30);
    if (z > 0 && lufs(z) > -70) st.push(z);
  }
  let lra = 0;
  if (st.length) {
    const mean = st.reduce((a, b) => a + b, 0) / st.length;
    const g = st.filter((z) => lufs(z) > lufs(mean) - 20).map(lufs).sort((a, b) => a - b);
    if (g.length > 1) {
      const p = (q: number) => g[Math.min(g.length - 1, Math.max(0, Math.round(q * (g.length - 1))))];
      lra = p(0.95) - p(0.1);
    }
  }
  return { i, lra, maxMomentary };
}

// --- true peak -----------------------------------------------------------------------------------

const TAPS = 16;
/** 4× polyphase interpolator: phases 1..3 between each pair of samples (Blackman-Harris windowed sinc). */
const PHASES: Float64Array[] = [1, 2, 3].map((p) => {
  const h = new Float64Array(TAPS);
  let sum = 0;
  for (let k = 0; k < TAPS; k++) {
    // tap k multiplies x[i + k - TAPS/2 + 1]; the point sits at i + p/4
    const d = k - TAPS / 2 + 1 - p / 4;
    const sinc = d === 0 ? 1 : Math.sin(Math.PI * d) / (Math.PI * d);
    const u = (d + TAPS / 2) / TAPS;
    const w = 0.35875 - 0.48829 * Math.cos(2 * Math.PI * u) + 0.14128 * Math.cos(4 * Math.PI * u) - 0.01168 * Math.cos(6 * Math.PI * u);
    h[k] = sinc * w;
    sum += h[k];
  }
  for (let k = 0; k < TAPS; k++) h[k] /= sum;
  return h;
});

/**
 * The true-peak envelope: per sample i, the largest |value| over both channels at i and at the
 * three interpolated points between i and i+1. Quiet stretches (no sample above `floor`) skip the
 * interpolation: their peaks cannot reach the ceiling.
 */
export function truePeakEnvelope(l: Float32Array | Float64Array, r: Float32Array | Float64Array, floor: number): Float64Array {
  const n = l.length;
  const out = new Float64Array(n);
  const B = 256;
  for (let b0 = 0; b0 < n; b0 += B) {
    const b1 = Math.min(n, b0 + B);
    let mx = 0;
    for (let i = Math.max(0, b0 - TAPS); i < Math.min(n, b1 + TAPS); i++) {
      const a = Math.max(Math.abs(l[i]), Math.abs(r[i]));
      if (a > mx) mx = a;
    }
    for (let i = b0; i < b1; i++) out[i] = Math.max(Math.abs(l[i]), Math.abs(r[i]));
    if (mx < floor) continue;
    for (let i = b0; i < b1; i++) {
      let m = out[i];
      for (const h of PHASES) {
        let yl = 0;
        let yr = 0;
        for (let k = 0; k < TAPS; k++) {
          const j = i + k - TAPS / 2 + 1;
          if (j < 0 || j >= n) continue;
          yl += h[k] * l[j];
          yr += h[k] * r[j];
        }
        const a = Math.max(Math.abs(yl), Math.abs(yr));
        if (a > m) m = a;
      }
      out[i] = m;
    }
  }
  return out;
}

export const truePeakDb = (l: Float32Array | Float64Array, r: Float32Array | Float64Array): number => {
  const env = truePeakEnvelope(l, r, 0);
  let m = 0;
  for (let i = 0; i < env.length; i++) if (env[i] > m) m = env[i];
  return m > 0 ? 20 * Math.log10(m) : -Infinity;
};

// --- dynamics ------------------------------------------------------------------------------------

/**
 * Look-ahead limiter gain: g[i] ≤ ceiling / truePeak[i] everywhere. The needed gain is held as a
 * minimum over the next `lookahead` samples, released exponentially, then smoothed by a moving
 * average of the same length, which keeps the bound (every average is of values that already
 * respect it) while turning each attack into a ramp.
 */
export function limiterGain(tp: Float64Array, ceiling: number, lookahead: number, releaseS: number): Float64Array {
  const n = tp.length;
  const need = new Float64Array(n);
  for (let i = 0; i < n; i++) need[i] = tp[i] > ceiling ? ceiling / tp[i] : 1;
  // forward window minimum over [i, i + lookahead] (monotonic deque, scanning backwards)
  const m = new Float64Array(n);
  const dq = new Int32Array(n);
  let head = 0;
  let tail = 0;
  for (let i = n - 1; i >= 0; i--) {
    while (tail > head && need[dq[tail - 1]] >= need[i]) tail--;
    dq[tail++] = i;
    while (dq[head] > i + lookahead) head++;
    m[i] = need[dq[head]];
  }
  const rel = 1 - Math.exp(-1 / (releaseS * SR));
  let g = 1;
  for (let i = 0; i < n; i++) {
    g = Math.min(m[i], g + (1 - g) * rel);
    m[i] = g;
  }
  const out = new Float64Array(n);
  let sum = 0;
  const w = lookahead + 1;
  for (let i = 0; i < n; i++) {
    sum += m[i];
    if (i >= w) sum -= m[i - w];
    // the first samples average fewer values: still a mean of values that respect the bound
    out[i] = sum / Math.min(w, i + 1);
  }
  return out;
}

/** Stereo-linked glue compressor (peak detector with attack/release ballistics, soft knee). */
export function glue(l: Float64Array, r: Float64Array, o: { thresholdDb: number; ratio: number; attack: number; release: number; kneeDb: number }): number {
  const aA = Math.exp(-1 / (o.attack * SR));
  const aR = Math.exp(-1 / (o.release * SR));
  const slope = 1 / o.ratio - 1;
  const W = o.kneeDb;
  let env = 0;
  let maxGr = 0;
  for (let i = 0; i < l.length; i++) {
    const lvl = Math.max(Math.abs(l[i]), Math.abs(r[i]));
    const a = lvl > env ? aA : aR;
    env = a * env + (1 - a) * lvl;
    if (env < 1e-12) continue;
    const over = 20 * Math.log10(env) - o.thresholdDb;
    let gr = 0;
    if (over >= W / 2) gr = slope * over;
    else if (over > -W / 2) gr = (slope * (over + W / 2) ** 2) / (2 * W);
    if (gr < 0) {
      const g = 10 ** (gr / 20);
      l[i] *= g;
      r[i] *= g;
      if (-gr > maxGr) maxGr = -gr;
    }
  }
  return maxGr;
}

// --- the chain -----------------------------------------------------------------------------------

export interface MasterOptions {
  targetLufs: number;
  /** true-peak ceiling of this meter, dBTP (set below the delivery's limit for ffmpeg's meter) */
  ceilingDb: number;
  /** [from, to) sample spans that must be exactly 0.0 */
  silences: readonly (readonly [number, number])[];
  /** a fade to silence ending where the last silence starts: [from, to) samples */
  fadeOut?: readonly [number, number];
}

export interface MasterReport {
  lufs: number;
  lra: number;
  truePeakDb: number;
  samplePeakDb: number;
  gainDb: number;
  glueMaxGrDb: number;
  limiterMaxGrDb: number;
  /** where the limiter reduced the most (s from the film start) */
  limiterMaxAt: number;
  /** how long the limiter reduced more than 3 dB and more than 6 dB (s) */
  limitedOver3: number;
  limitedOver6: number;
  /** each stretch where the limiter reduced more than 3 dB (gaps under 0.25 s merged): where it reduced most, and how much */
  limiterEvents: { at: number; grDb: number }[];
  iterations: number;
}

function fade(l: Float64Array, r: Float64Array, o: MasterOptions): void {
  if (!o.fadeOut) return;
  const [a, b] = o.fadeOut;
  for (let i = a; i < b && i < l.length; i++) {
    const g = 0.5 + 0.5 * Math.cos((Math.PI * (i - a)) / (b - a));
    l[i] *= g;
    r[i] *= g;
  }
}

function silence(l: Float64Array, r: Float64Array, o: MasterOptions): void {
  for (const [a, b] of o.silences)
    for (let i = Math.max(0, a); i < Math.min(l.length, b); i++) {
      l[i] = 0;
      r[i] = 0;
    }
}

/** Master the mix in place (float64 in), return the delivery (float32) and what was measured. */
export function master(l: Float64Array, r: Float64Array, o: MasterOptions): { l: Float32Array; r: Float32Array; report: MasterReport } {
  const n = l.length;
  // 28 Hz high-pass (2nd-order Butterworth)
  for (const x of [l, r]) new Biquad('highpass', 28, Math.SQRT1_2).run(x);
  fade(l, r, o);
  silence(l, r, o);
  // bring to a working level, then glue
  const pre = loudness(l, r).i;
  const work = Number.isFinite(pre) ? dbToGain(-20 - pre) : 1;
  for (let i = 0; i < n; i++) {
    l[i] *= work;
    r[i] *= work;
  }
  const glueGr = glue(l, r, { thresholdDb: -17, ratio: 2, attack: 0.025, release: 0.25, kneeDb: 6 });
  const base = loudness(l, r).i;
  let gainDb = o.targetLufs - base;
  let ceiling = dbToGain(o.ceilingDb);
  const outL = new Float64Array(n);
  const outR = new Float64Array(n);
  let it = 0;
  let measured = loudness(l, r);
  let limGr = 0;
  let limAt = 0;
  let over3 = 0;
  let over6 = 0;
  let events: { at: number; grDb: number }[] = [];
  let tp = 0;
  for (; it < 8; it++) {
    const g = dbToGain(gainDb);
    for (let i = 0; i < n; i++) {
      outL[i] = l[i] * g;
      outR[i] = r[i] * g;
    }
    const env = truePeakEnvelope(outL, outR, ceiling * 0.35);
    const lg = limiterGain(env, ceiling, Math.round(0.005 * SR), 0.12);
    let minG = 1;
    over3 = 0;
    over6 = 0;
    const g3 = dbToGain(-3);
    const g6 = dbToGain(-6);
    events = [];
    let ev: { at: number; g: number; last: number } | null = null;
    const close = () => {
      if (ev) events.push({ at: ev.at / SR, grDb: -20 * Math.log10(ev.g) });
    };
    for (let i = 0; i < n; i++) {
      outL[i] *= lg[i];
      outR[i] *= lg[i];
      if (lg[i] < minG) {
        minG = lg[i];
        limAt = i / SR;
      }
      if (lg[i] < g3) {
        over3++;
        if (!ev || i - ev.last > 0.25 * SR) {
          close();
          ev = { at: i, g: lg[i], last: i };
        } else {
          ev.last = i;
          if (lg[i] < ev.g) {
            ev.g = lg[i];
            ev.at = i;
          }
        }
      }
      if (lg[i] < g6) over6++;
    }
    close();
    limGr = -20 * Math.log10(minG);
    silence(outL, outR, o);
    measured = loudness(outL, outR);
    tp = truePeakDb(outL, outR);
    const over = tp - o.ceilingDb;
    // a residual inter-sample over (the gain moved under the interpolator): pull the ceiling in
    if (over > 0.02) ceiling *= dbToGain(-over - 0.02);
    const miss = o.targetLufs - measured.i;
    if (Math.abs(miss) < 0.03 && over <= 0.02) break;
    gainDb += miss;
  }
  let sp = 0;
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    L[i] = outL[i];
    R[i] = outR[i];
    sp = Math.max(sp, Math.abs(L[i]), Math.abs(R[i]));
  }
  // the silences again, after the float32 rounding: +0.0, not -0.0
  for (const [a, b] of o.silences)
    for (let i = Math.max(0, a); i < Math.min(n, b); i++) {
      L[i] = 0;
      R[i] = 0;
    }
  return {
    l: L,
    r: R,
    report: {
      lufs: measured.i,
      lra: measured.lra,
      truePeakDb: tp,
      samplePeakDb: 20 * Math.log10(sp),
      gainDb: gainDb + 20 * Math.log10(work),
      glueMaxGrDb: glueGr,
      limiterMaxGrDb: limGr,
      limiterMaxAt: limAt,
      limitedOver3: over3 / SR,
      limitedOver6: over6 / SR,
      limiterEvents: events,
      iterations: it + 1,
    },
  };
}
