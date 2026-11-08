import { describe, expect, it } from 'vitest';
import { SR, seedOf, whiteNoise } from './dsp.ts';
import { MASTER, limiterGain, loudness, master, truePeakDb, truePeakEnvelope } from './master.ts';

const sine = (f: number, a: number, n: number) => Float32Array.from({ length: n }, (_, i) => a * Math.sin((2 * Math.PI * f * i) / SR));

/** 6 s: a tone and noise, a 10 ms burst 20 dB up at 3 s (too short for the glue: the limiter's), a digital silence in the last second. */
function mix(): { l: Float64Array; r: Float64Array } {
  const n = 6 * SR;
  const wl = whiteNoise(seedOf(1, 'l'));
  const wr = whiteNoise(seedOf(1, 'r'));
  const l = new Float64Array(n);
  const r = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const burst = i >= 3 * SR && i < 3.01 * SR ? 10 : 1;
    l[i] = burst * (0.3 * Math.sin((2 * Math.PI * 220 * i) / SR) + 0.05 * wl());
    r[i] = burst * (0.3 * Math.sin((2 * Math.PI * 330 * i) / SR) + 0.05 * wr());
  }
  return { l, r };
}

describe('kit master', () => {
  it('meters loudness by BS.1770: a 997 Hz sine at -20 dBFS reads -20 LUFS in both channels, -23 in one', () => {
    const x = sine(997, 0.1, SR * 4);
    expect(loudness(x, x).i).toBeCloseTo(-20, 1);
    expect(loudness(x, new Float32Array(x.length)).i).toBeCloseTo(-23.01, 1);
    expect(loudness(new Float32Array(SR * 2), new Float32Array(SR * 2)).i).toBe(-Infinity);
  });

  it('finds inter-sample peaks and limits them under the ceiling', () => {
    // fs/4 with a 45° phase: every sample is at ±0.707, the waveform peaks at 1
    const x = Float32Array.from({ length: 4800 }, (_, i) => Math.sin((Math.PI / 2) * i + Math.PI / 4));
    expect(truePeakDb(x, x)).toBeGreaterThan(-0.2);
    const w = whiteNoise(3);
    const y = Float64Array.from({ length: SR }, (_, i) => (i > 20_000 && i < 21_000 ? 3 : 0.3) * w());
    const z = Float64Array.from(y);
    const ceiling = 10 ** (-3 / 20);
    const g = limiterGain(truePeakEnvelope(y, z, 0), ceiling, 240, 0.1);
    for (let i = 0; i < y.length; i++) {
      y[i] *= g[i];
      z[i] *= g[i];
    }
    expect(truePeakDb(y, z)).toBeLessThan(-2.9);
  });

  it('masters to the target under the ceiling less the AAC margin, the silences exactly zero', () => {
    const { l, r } = mix();
    const silence = [5 * SR, 6 * SR] as const;
    const out = master(l, r, { silences: [silence], fadeOut: [4.5 * SR, 5 * SR] });
    const rep = out.report;
    expect(rep.limitDb).toBeCloseTo(MASTER.ceilingDb - MASTER.aacMarginDb, 12);
    expect(rep.limitDb).toBeCloseTo(-2.6, 12);
    expect(rep.lufs).toBeCloseTo(MASTER.targetLufs, 1);
    expect(rep.truePeakDb).toBeLessThanOrEqual(rep.limitDb + 0.02);
    expect(rep.limiterMaxGrDb).toBeGreaterThan(3);
    expect(rep.limiterEvents.length).toBeGreaterThan(0);
    expect(rep.limiterEvents[0].at).toBeGreaterThan(2.9);
    expect(rep.limiterEvents[0].at).toBeLessThan(3.1);
    expect(rep.iterations).toBeGreaterThanOrEqual(1);
    expect(rep.iterations).toBeLessThanOrEqual(8);
    for (let i = silence[0]; i < silence[1]; i++) expect(Object.is(out.l[i], 0) && Object.is(out.r[i], 0)).toBe(true);
    // the same inputs master to the same samples
    const again = mix();
    expect(master(again.l, again.r, { silences: [silence], fadeOut: [4.5 * SR, 5 * SR] }).l).toEqual(out.l);
  });

  it('takes its target, ceiling, margin, high-pass and glue as options', () => {
    const { l, r } = mix();
    const out = master(l, r, { targetLufs: -18, ceilingDb: -1, aacMarginDb: 0.5, highpassHz: 0, glue: false });
    expect(out.report.limitDb).toBeCloseTo(-1.5, 12);
    expect(out.report.lufs).toBeCloseTo(-18, 1);
    expect(out.report.truePeakDb).toBeLessThanOrEqual(-1.5 + 0.02);
    expect(out.report.glueMaxGrDb).toBe(0);
    const hard = mix();
    const plain = mix();
    expect(master(hard.l, hard.r, { glue: { thresholdDb: -40, ratio: 4 } }).report.glueMaxGrDb).toBeGreaterThan(master(plain.l, plain.r).report.glueMaxGrDb);
  });
});
