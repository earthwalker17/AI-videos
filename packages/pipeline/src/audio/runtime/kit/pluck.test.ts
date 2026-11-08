import { describe, expect, it } from 'vitest';
import { SR } from './dsp.ts';
import { pluck } from './pluck.ts';

const rms = (x: Float32Array) => Math.sqrt(x.reduce((s, v) => s + v * v, 0) / x.length);

/** The lag (samples) of the largest normalised autocorrelation in [lo, hi]. */
function period(x: Float32Array, lo: number, hi: number): number {
  let best = lo;
  let bestR = -Infinity;
  for (let lag = lo; lag <= hi; lag++) {
    let s = 0;
    for (let i = 0; i + lag < x.length; i++) s += x[i] * x[i + lag];
    if (s > bestR) {
      bestR = s;
      best = lag;
    }
  }
  return best;
}

describe('kit karplus-strong', () => {
  it('rings at its pitch and decays steadily, about 60 dB over t60', () => {
    const f = 220;
    const x = pluck(f, { seed: 3, len: 1.2, t60: 1 });
    expect(x.length).toBe(Math.ceil(1.2 * SR));
    // the period, tuned with the all-pass: 48000 / 220 = 218.2 samples
    expect(Math.abs(period(x.subarray(SR / 10, SR / 10 + 4096), 150, 300) - SR / f)).toBeLessThanOrEqual(1);
    const win = (t: number) => rms(x.subarray(Math.round(t * SR), Math.round(t * SR) + 2400));
    const levels = [0.05, 0.25, 0.5, 0.75, 1].map(win);
    for (let k = 1; k < levels.length; k++) expect(levels[k]).toBeLessThan(levels[k - 1]);
    // the fundamental falls 60 dB in t60; the brighter partials fall faster still
    const drop = 20 * Math.log10(win(1) / win(0.05));
    expect(drop).toBeLessThan(-50);
    expect(drop).toBeGreaterThan(-90);
    expect(x.reduce((m, v) => Math.max(m, Math.abs(v)), 0)).toBeLessThanOrEqual(1);
  });

  it('is a pure function of its seed, id and pitch', () => {
    const a = pluck(330, { seed: 1, len: 0.2 });
    expect(pluck(330, { seed: 1, len: 0.2 })).toEqual(a);
    expect(pluck(330, { seed: 2, len: 0.2 })).not.toEqual(a);
    expect(pluck(330, { seed: 1, id: 'tick', len: 0.2 })).not.toEqual(a);
  });
});
