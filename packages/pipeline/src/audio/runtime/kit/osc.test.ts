import { describe, expect, it } from 'vitest';
import { SR } from './dsp.ts';
import { fft } from './fft.ts';
import { Osc, blep, fmBell, osc, type Shape } from './osc.ts';

const N = 8192;
/** 397 cycles in N samples (about 2.3 kHz): harmonics fall on multiples of bin 397, aliases between them */
const K = 397;
const F = (K * SR) / N;

/** Power in the harmonic bins and in every other bin (aliases), from one N-sample period. */
function spectrum(x: Float32Array): { harmonic: number; alias: number; dc: number } {
  const re = Float64Array.from(x.subarray(0, N));
  const im = new Float64Array(N);
  fft(re, im);
  let harmonic = 0;
  let alias = 0;
  for (let k = 1; k < N / 2; k++) {
    const p = re[k] * re[k] + im[k] * im[k];
    if (k % K === 0) harmonic += p;
    else alias += p;
  }
  return { harmonic, alias, dc: Math.abs(re[0]) / N };
}

/** The naive shape at phase p, for comparison. */
const naive: Record<Exclude<Shape, 'sine'>, (p: number) => number> = {
  saw: (p) => 2 * p - 1,
  square: (p) => (p < 0.5 ? 1 : -1),
  pulse: (p) => (p < 0.25 ? 1 : -1) + 0.5,
  triangle: (p) => (p < 0.5 ? 4 * p - 1 : 3 - 4 * p),
};

const db = (x: number) => 10 * Math.log10(x);

describe('kit oscillators', () => {
  it('saw, square, pulse and triangle alias far less than their naive shapes, with no DC', () => {
    for (const shape of ['saw', 'square', 'pulse', 'triangle'] as const) {
      const bl = spectrum(osc(shape, F, N, { width: 0.25 }));
      const nv = spectrum(Float32Array.from({ length: N }, (_, i) => naive[shape](((i * K) / N) % 1)));
      const blRatio = db(bl.alias / bl.harmonic);
      const nvRatio = db(nv.alias / nv.harmonic);
      expect(blRatio, shape).toBeLessThan(nvRatio - 10);
      // measured at this pitch: about -29 dB (naive -12 to -14) for the jumps, -50 dB (naive -38) for the triangle
      expect(blRatio, shape).toBeLessThan(shape === 'triangle' ? -45 : -25);
      expect(bl.dc, shape).toBeLessThan(1e-3);
    }
  });

  it('a sine is a sine; the phase wraps, and a frequency function is followed', () => {
    const x = osc('sine', 1000, 480, { phase: 0.25 });
    for (const i of [0, 12, 100, 479]) expect(x[i]).toBeCloseTo(Math.cos((2 * Math.PI * 1000 * i) / SR), 6);
    const v = new Osc('saw');
    for (let i = 0; i < 10 * SR; i++) v.tick(997.3);
    expect(v.phase).toBeGreaterThanOrEqual(0);
    expect(v.phase).toBeLessThan(1);
    // a glide 200 → 400 Hz over 1 s averages 300 cycles
    const g = osc('sine', (t) => 200 + 200 * t, SR);
    let c = 0;
    for (let i = 1; i < SR; i++) if (g[i - 1] < 0 && g[i] >= 0) c++;
    expect(Math.abs(c - 300)).toBeLessThanOrEqual(1);
    // over Nyquist the pitch is held just under it: the phase advances 0.499 a sample, not 0.75
    const hi = new Osc('saw');
    hi.tick(0.75 * SR);
    expect(hi.phase).toBeCloseTo(0.499, 12);
    for (let i = 0; i < 1000; i++) hi.tick(-SR);
    expect(hi.phase).toBeGreaterThanOrEqual(0);
    expect(hi.phase).toBeLessThan(1);
  });

  it('blep is the halloween-gift residual; the FM bell decays; both deterministic', () => {
    expect(blep(0, 0.1)).toBe(-1);
    expect(blep(0.5, 0.1)).toBe(0);
    expect(blep(0.95, 0.1)).toBeCloseTo(0.25, 12);
    const bell = fmBell(440, { ratio: 3.5, index: 2, tau: 0.3, len: 1 });
    const head = Math.max(...bell.subarray(0, 4800).map(Math.abs));
    const tail = Math.max(...bell.subarray(SR - 4800).map(Math.abs));
    expect(tail / head).toBeLessThan(Math.exp(-2.5));
    expect(fmBell(440, { ratio: 3.5, index: 2, tau: 0.3, len: 1 })).toEqual(bell);
    expect(osc('triangle', 123.4, 5000)).toEqual(osc('triangle', 123.4, 5000));
  });
});
