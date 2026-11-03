/**
 * The score's signal primitives: units, pan law, seeded noise, filters and envelopes. Every
 * filter keeps float64 state and flushes denormals, every loop runs in a fixed order, and all
 * randomness comes from @aiv/core's hash (mix32), so a sample is a pure function of the inputs.
 */
import { hash32, hashString, mix32 } from '@aiv/core';

export const SR = 48_000;
export const TAU = 2 * Math.PI;
/** values below this are flushed to zero in recursive filters (denormals are slow and pointless) */
const TINY = 1e-25;

export const dbToGain = (db: number): number => 10 ** (db / 20);
export const midiHz = (m: number): number => 440 * 2 ** ((m - 69) / 12);
export const centsRatio = (c: number): number => 2 ** (c / 1200);
export const clamp = (x: number, a = 0, b = 1): number => (x < a ? a : x > b ? b : x);
/** 0..1 raised-cosine ease */
export const smooth = (t: number): number => {
  const u = clamp(t);
  return 0.5 - 0.5 * Math.cos(Math.PI * u);
};

/** Equal-power pan of a mono source: pan -1 (left) .. +1 (right), -3 dB each side in the centre. */
export function panGains(pan: number): [number, number] {
  const a = ((clamp(pan, -1, 1) + 1) * Math.PI) / 4;
  return [Math.cos(a), Math.sin(a)];
}

/** Balance of a stereo source: the far side drops, the near side stays at unity. */
export function balanceGains(pan: number): [number, number] {
  const a = ((clamp(pan, -1, 1) + 1) * Math.PI) / 4;
  return [Math.min(1, Math.SQRT2 * Math.cos(a)), Math.min(1, Math.SQRT2 * Math.sin(a))];
}

// --- randomness ----------------------------------------------------------------------------------

/** A seed for one named thing: hash32 of the film seed, the name and an index. */
export const seedOf = (seed: number, id: string, k = 0): number => hash32(seed, hashString(id), k);

/** Uniform [0, 1) from a seed and a counter (a Weyl sequence through mix32: counter-based, no state). */
export const uni = (s: number, k: number): number => mix32((s + Math.imul(k, 0x9e3779b9)) | 0) / 4294967296;

/** A white-noise stream in [-1, 1): call it once per sample. */
export function whiteNoise(s: number): () => number {
  let k = 0;
  return () => uni(s, k++) * 2 - 1;
}

/** Approximately normal noise (sum of four uniforms, unit variance). */
export function gaussNoise(s: number): () => number {
  let k = 0;
  return () => (uni(s, k++) + uni(s, k++) + uni(s, k++) + uni(s, k++) - 2) * 1.7320508075688772;
}

/** Smooth seeded 1D noise in [-1, 1] at `rate` lattice points per second (cosine-interpolated). */
export function slowNoise(s: number, rate: number): (t: number) => number {
  return (t: number) => {
    const x = t * rate;
    const i = Math.floor(x);
    const f = x - i;
    const a = uni(s, i) * 2 - 1;
    const b = uni(s, i + 1) * 2 - 1;
    return a + (b - a) * (0.5 - 0.5 * Math.cos(Math.PI * f));
  };
}

// --- filters -------------------------------------------------------------------------------------

export type BiquadKind = 'lowpass' | 'highpass' | 'bandpass' | 'peak' | 'lowshelf' | 'highshelf' | 'notch';

/** RBJ cookbook biquad, transposed direct form II, float64 state. */
export class Biquad {
  b0 = 1;
  b1 = 0;
  b2 = 0;
  a1 = 0;
  a2 = 0;
  private z1 = 0;
  private z2 = 0;

  constructor(kind?: BiquadKind, f?: number, q = Math.SQRT1_2, gainDb = 0) {
    if (kind && f) this.set(kind, f, q, gainDb);
  }

  set(kind: BiquadKind, f: number, q = Math.SQRT1_2, gainDb = 0): this {
    const w = (TAU * clamp(f, 1, SR * 0.49)) / SR;
    const cw = Math.cos(w);
    const sw = Math.sin(w);
    const alpha = sw / (2 * q);
    const A = 10 ** (gainDb / 40);
    let b0: number, b1: number, b2: number, a0: number, a1: number, a2: number;
    switch (kind) {
      case 'lowpass':
        b0 = (1 - cw) / 2;
        b1 = 1 - cw;
        b2 = b0;
        a0 = 1 + alpha;
        a1 = -2 * cw;
        a2 = 1 - alpha;
        break;
      case 'highpass':
        b0 = (1 + cw) / 2;
        b1 = -(1 + cw);
        b2 = b0;
        a0 = 1 + alpha;
        a1 = -2 * cw;
        a2 = 1 - alpha;
        break;
      case 'bandpass': // constant 0 dB peak gain
        b0 = alpha;
        b1 = 0;
        b2 = -alpha;
        a0 = 1 + alpha;
        a1 = -2 * cw;
        a2 = 1 - alpha;
        break;
      case 'notch':
        b0 = 1;
        b1 = -2 * cw;
        b2 = 1;
        a0 = 1 + alpha;
        a1 = -2 * cw;
        a2 = 1 - alpha;
        break;
      case 'peak':
        b0 = 1 + alpha * A;
        b1 = -2 * cw;
        b2 = 1 - alpha * A;
        a0 = 1 + alpha / A;
        a1 = -2 * cw;
        a2 = 1 - alpha / A;
        break;
      case 'lowshelf': {
        const s = 2 * Math.sqrt(A) * alpha;
        b0 = A * (A + 1 - (A - 1) * cw + s);
        b1 = 2 * A * (A - 1 - (A + 1) * cw);
        b2 = A * (A + 1 - (A - 1) * cw - s);
        a0 = A + 1 + (A - 1) * cw + s;
        a1 = -2 * (A - 1 + (A + 1) * cw);
        a2 = A + 1 + (A - 1) * cw - s;
        break;
      }
      case 'highshelf': {
        const s = 2 * Math.sqrt(A) * alpha;
        b0 = A * (A + 1 + (A - 1) * cw + s);
        b1 = -2 * A * (A - 1 + (A + 1) * cw);
        b2 = A * (A + 1 + (A - 1) * cw - s);
        a0 = A + 1 - (A - 1) * cw + s;
        a1 = 2 * (A - 1 - (A + 1) * cw);
        a2 = A + 1 - (A - 1) * cw - s;
        break;
      }
    }
    this.b0 = b0 / a0;
    this.b1 = b1 / a0;
    this.b2 = b2 / a0;
    this.a1 = a1 / a0;
    this.a2 = a2 / a0;
    return this;
  }

  /** set raw normalised coefficients (a0 = 1) */
  coeffs(b0: number, b1: number, b2: number, a1: number, a2: number): this {
    this.b0 = b0;
    this.b1 = b1;
    this.b2 = b2;
    this.a1 = a1;
    this.a2 = a2;
    return this;
  }

  reset(): void {
    this.z1 = 0;
    this.z2 = 0;
  }

  tick(x: number): number {
    const y = this.b0 * x + this.z1;
    this.z1 = this.b1 * x - this.a1 * y + this.z2;
    this.z2 = this.b2 * x - this.a2 * y;
    if (this.z1 < TINY && this.z1 > -TINY) this.z1 = 0;
    if (this.z2 < TINY && this.z2 > -TINY) this.z2 = 0;
    return y;
  }

  /** filter a buffer in place (Float32Array or Float64Array) from `from` to `to` */
  run(x: Float32Array | Float64Array, from = 0, to = x.length): void {
    for (let i = from; i < to; i++) x[i] = this.tick(x[i]);
  }
}

/**
 * Topology-preserving-transform state-variable filter (Zavalishin / Simper): stable under fast
 * modulation, so wind, whooshes and formant glides can sweep it every few samples.
 */
export class Svf {
  private ic1 = 0;
  private ic2 = 0;
  private g = 0;
  private k = 1;
  private a1 = 0;
  private a2 = 0;
  private a3 = 0;
  lp = 0;
  bp = 0;
  hp = 0;

  set(f: number, q: number): this {
    this.g = Math.tan((Math.PI * clamp(f, 5, SR * 0.45)) / SR);
    this.k = 1 / Math.max(0.05, q);
    this.a1 = 1 / (1 + this.g * (this.g + this.k));
    this.a2 = this.g * this.a1;
    this.a3 = this.g * this.a2;
    return this;
  }

  /** advance one sample; read lp / bp / hp afterwards; returns the band-pass */
  tick(x: number): number {
    const v3 = x - this.ic2;
    const v1 = this.a1 * this.ic1 + this.a2 * v3;
    const v2 = this.ic2 + this.a2 * this.ic1 + this.a3 * v3;
    this.ic1 = 2 * v1 - this.ic1;
    this.ic2 = 2 * v2 - this.ic2;
    if (this.ic1 < TINY && this.ic1 > -TINY) this.ic1 = 0;
    if (this.ic2 < TINY && this.ic2 > -TINY) this.ic2 = 0;
    this.lp = v2;
    this.bp = v1;
    this.hp = x - this.k * v1 - v2;
    return v1;
  }

  /** band-pass normalised to unity gain at the centre */
  get bpn(): number {
    return this.bp * this.k;
  }
}

/** One-pole low-pass (smoothing) with a time constant in seconds. */
export class OnePole {
  private y = 0;
  private a: number;
  constructor(tau: number, init = 0) {
    this.a = Math.exp(-1 / (Math.max(1e-6, tau) * SR));
    this.y = init;
  }
  setTau(tau: number): void {
    this.a = Math.exp(-1 / (Math.max(1e-6, tau) * SR));
  }
  tick(x: number): number {
    this.y = x + (this.y - x) * this.a;
    if (this.y < TINY && this.y > -TINY) this.y = 0;
    return this.y;
  }
  get value(): number {
    return this.y;
  }
}

/**
 * A two-pole resonator (a decaying mode): impulse response sin(2π f t)·e^(-t/τ). Exciting a
 * bank of them is how knocks, creaks, gates and bells get their bodies.
 */
export class Resonator {
  private y1 = 0;
  private y2 = 0;
  private c1: number;
  private c2: number;
  private g: number;
  constructor(f: number, decay: number, gain = 1) {
    const r = Math.exp(-1 / (Math.max(1e-4, decay) * SR));
    const w = (TAU * clamp(f, 1, SR * 0.48)) / SR;
    this.c1 = 2 * r * Math.cos(w);
    this.c2 = -r * r;
    // h[n] = g·rⁿ·sin((n+1)w)/sin(w): g = gain·sin(w) makes a unit impulse ring at amplitude `gain`
    this.g = gain * Math.sin(w);
  }
  tick(x: number): number {
    const y = this.g * x + this.c1 * this.y1 + this.c2 * this.y2;
    this.y2 = this.y1;
    this.y1 = y;
    if (this.y1 < TINY && this.y1 > -TINY) this.y1 = 0;
    return y;
  }
}

// --- envelopes -----------------------------------------------------------------------------------

/** Piecewise-linear breakpoint curve over time (s): [[t, v], …], held flat outside. */
export function curve(points: readonly (readonly [number, number])[]): (t: number) => number {
  const p = [...points].sort((a, b) => a[0] - b[0]);
  return (t: number) => {
    if (t <= p[0][0]) return p[0][1];
    for (let i = 1; i < p.length; i++) {
      if (t <= p[i][0]) {
        const [t0, v0] = p[i - 1];
        const [t1, v1] = p[i];
        return t1 > t0 ? v0 + ((v1 - v0) * (t - t0)) / (t1 - t0) : v1;
      }
    }
    return p[p.length - 1][1];
  };
}

export function peakOf(x: Float32Array | Float64Array): number {
  let p = 0;
  for (let i = 0; i < x.length; i++) {
    const a = x[i] < 0 ? -x[i] : x[i];
    if (a > p) p = a;
  }
  return p;
}

export function scale(x: Float32Array | Float64Array, g: number): void {
  for (let i = 0; i < x.length; i++) x[i] *= g;
}

/** Brown(ish) noise: leaky-integrated white noise, about unit RMS. */
export function brownNoise(s: number, n: number, leak = 0.996): Float32Array {
  const w = whiteNoise(s);
  const out = new Float32Array(n);
  let y = 0;
  const g = Math.sqrt(1 - leak * leak);
  for (let i = 0; i < n; i++) {
    y = leak * y + g * w() * 1.7320508075688772;
    out[i] = y;
  }
  return out;
}
