import { describe, expect, it } from 'vitest';
import { SAMPLE_RATE } from '../types.ts';
import { Biquad, ModalBank, Resonator, SR, brownNoise, dbToGain, norm, panGains, peakOf, seedOf, whiteNoise } from './dsp.ts';

/** Positive-going zero crossings per second over [from, to) samples. */
const crossings = (x: Float32Array, from: number, to: number) => {
  let c = 0;
  for (let i = from + 1; i < to; i++) if (x[i - 1] < 0 && x[i] >= 0) c++;
  return (c * SR) / (to - from);
};

describe('kit dsp', () => {
  it('runs at the stage rate, with an equal-power pan law', () => {
    expect(SR).toBe(SAMPLE_RATE);
    const [l, r] = panGains(0);
    expect(l * l + r * r).toBeCloseTo(1, 12);
    expect(panGains(-1)).toEqual([1, 0]);
  });

  it('filters: a low-pass passes its pass band and cuts above the corner', () => {
    const tone = (f: number) => Float32Array.from({ length: SR / 2 }, (_, i) => Math.sin((2 * Math.PI * f * i) / SR));
    const lo = tone(100);
    const hi = tone(8000);
    new Biquad('lowpass', 1000).run(lo);
    new Biquad('lowpass', 1000).run(hi);
    expect(peakOf(lo.subarray(SR / 4))).toBeCloseTo(1, 2);
    expect(peakOf(hi.subarray(SR / 4))).toBeLessThan(0.02);
  });

  it('a resonator rings at its frequency and amplitude; a modal bank sums its modes', () => {
    const imp = Float32Array.of(1);
    const one = new ModalBank([{ f: 440, decay: 0.5, gain: 0.8 }]).render(imp, SR);
    expect(crossings(one, 0, SR / 2)).toBeCloseTo(440, -1);
    expect(peakOf(one)).toBeCloseTo(0.8, 2);
    // e^(-t/0.5): after 0.5 s the ring is 1/e of its start
    expect(peakOf(one.subarray(SR / 2 - 60, SR / 2 + 60)) / peakOf(one.subarray(0, 120))).toBeCloseTo(Math.exp(-1), 2);

    const modes = [
      { f: 300, decay: 0.3, gain: 0.5 },
      { f: 1170, decay: 0.1, gain: 0.3 },
      { f: 30_000, decay: 1, gain: 1 },
    ];
    const bank = new ModalBank(modes).render(imp, 2000);
    const a = new Resonator(300, 0.3, 0.5);
    const b = new Resonator(1170, 0.1, 0.3);
    // the mode above 0.48 · SR is dropped
    for (let i = 0; i < 2000; i++) expect(bank[i]).toBeCloseTo(a.tick(i ? 0 : 1) + b.tick(i ? 0 : 1), 6);
  });

  it('norm levels a clip to its peak and fades its end; noise is a pure function of its seed', () => {
    const w = whiteNoise(seedOf(1, 'x'));
    const clip = Float32Array.from({ length: 4800 }, (_, i) => (i === 10 ? 0.9 : w() * 0.3));
    norm(clip, -6);
    expect(peakOf(clip)).toBeCloseTo(dbToGain(-6), 5);
    expect(Math.abs(clip[clip.length - 1])).toBe(0);
    const stereo = { l: Float32Array.from({ length: 100 }, () => 0.5), r: Float32Array.from({ length: 100 }, () => 0.25) };
    norm(stereo, 0, 0);
    expect([stereo.l[0], stereo.r[0]]).toEqual([1, 0.5]);

    expect(brownNoise(seedOf(7, 'b'), 1000)).toEqual(brownNoise(seedOf(7, 'b'), 1000));
    expect(brownNoise(seedOf(7, 'b'), 1000)).not.toEqual(brownNoise(seedOf(8, 'b'), 1000));
  });
});
