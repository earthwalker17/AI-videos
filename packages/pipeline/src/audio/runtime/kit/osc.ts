/**
 * Oscillators. Saw, square and pulse are band-limited with PolyBLEP (a two-sample polynomial
 * correction at each jump), the triangle with PolyBLAMP (the same at each corner), so they alias
 * far less than their naive shapes. Phase is kept in float64 cycles (0..1), so a long note keeps
 * its pitch. Also the FM bell, a two-operator voice whose index falls with its amplitude.
 */
import { SR, TAU } from './dsp.ts';

/**
 * PolyBLEP residual at phase t (0..1, the jump at 0) for a phase increment dt: add it for an
 * upward jump of 2, subtract it for a downward one. From the score of "A Halloween Gift".
 */
export function blep(t: number, dt: number): number {
  if (t < dt) {
    const x = t / dt;
    return x + x - x * x - 1;
  }
  if (t > 1 - dt) {
    const x = (t - 1) / dt;
    return x * x + x + x + 1;
  }
  return 0;
}

/**
 * PolyBLAMP residual at phase t (0..1, the corner at 0) for a phase increment dt, for a slope
 * change of one unit per sample: the integral of half the BLEP residual.
 */
export function blamp(t: number, dt: number): number {
  if (t < dt) {
    const x = 1 - t / dt;
    return (x * x * x) / 6;
  }
  if (t > 1 - dt) {
    const x = 1 + (t - 1) / dt;
    return (x * x * x) / 6;
  }
  return 0;
}

export type Shape = 'sine' | 'saw' | 'square' | 'triangle' | 'pulse';

/**
 * One oscillator: tick(f) returns the sample at the current phase, then advances it by f / SR.
 * Output in [-1, 1] (about: the band-limiting rounds the jumps). A frequency at or above
 * Nyquist is held just below it. The band-limiting assumes f ≥ 0 (the phase running forwards).
 */
export class Osc {
  /** phase in cycles, 0..1 */
  phase: number;
  /** pulse width, 0..1 (the share of each cycle at +1; 0.5 is a square) */
  width: number;

  constructor(
    readonly shape: Shape,
    o: { phase?: number; width?: number } = {},
  ) {
    this.phase = (((o.phase ?? 0) % 1) + 1) % 1;
    this.width = o.width ?? 0.5;
  }

  tick(f: number): number {
    // the phase increment, in cycles per sample, held under Nyquist (so is the pitch)
    const inc = Math.min(Math.max(f / SR, -0.499), 0.499);
    const dt = Math.abs(inc);
    const p = this.phase;
    let y: number;
    switch (this.shape) {
      case 'sine':
        y = Math.sin(TAU * p);
        break;
      case 'saw':
        y = 2 * p - 1 - blep(p, dt);
        break;
      case 'square':
      case 'pulse': {
        const w = this.shape === 'square' ? 0.5 : Math.min(Math.max(this.width, dt), 1 - dt);
        y = p < w ? 1 : -1;
        y += blep(p, dt);
        y -= blep((p - w + 1) % 1, dt);
        // a pulse other than a square has a mean of 2w - 1: remove it
        y -= 2 * w - 1;
        break;
      }
      case 'triangle':
        // -1 at phase 0, +1 at 0.5: the slope changes by +8·dt per sample at 0, -8·dt at 0.5
        y = p < 0.5 ? 4 * p - 1 : 3 - 4 * p;
        y += 8 * dt * (blamp(p, dt) - blamp((p + 0.5) % 1, dt));
        break;
    }
    let q = p + inc;
    q -= Math.floor(q);
    // a tiny negative phase wraps to 1 - ε, which rounds to 1
    if (q >= 1) q = 0;
    this.phase = q;
    return y;
  }
}

/** `n` samples of an oscillator at a fixed frequency, or at f(t) Hz (t in s from the start). */
export function osc(shape: Shape, f: number | ((t: number) => number), n: number, o: { phase?: number; width?: number } = {}): Float32Array {
  const v = new Osc(shape, o);
  const out = new Float32Array(n);
  if (typeof f === 'number') for (let i = 0; i < n; i++) out[i] = v.tick(f);
  else for (let i = 0; i < n; i++) out[i] = v.tick(f(i / SR));
  return out;
}

/**
 * An FM bell: carrier and modulator at a ratio, the index falling with the amplitude (round,
 * warm). From the score of "A Halloween Gift".
 */
export function fmBell(f: number, o: { ratio: number; index: number; tau: number; len: number; attack?: number }): Float32Array {
  const n = Math.ceil(o.len * SR);
  const out = new Float32Array(n);
  let pc = 0;
  let pm = 0;
  const att = (o.attack ?? 0.002) * SR;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const e = Math.exp(-t / o.tau);
    out[i] = (i < att ? i / att : 1) * e * Math.sin(pc + o.index * e * Math.sin(pm));
    pc += (TAU * f) / SR;
    pm += (TAU * f * o.ratio) / SR;
  }
  return out;
}
