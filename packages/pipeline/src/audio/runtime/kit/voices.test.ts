import { describe, expect, it } from 'vitest';
import { Biquad, SR, gainToDb, peakOf } from './dsp.ts';
import { detunedPad, filteredBass, noiseClap, noiseHat, sec } from './voices.ts';

const energy = (x: Float32Array, from = 0, to = x.length) => x.subarray(from, to).reduce((s, v) => s + v * v, 0);
/** The share of a clip's energy under `f` Hz (two low-passes, 24 dB an octave). */
function lowShare(x: Float32Array, f: number): number {
  const y = Float64Array.from(x);
  new Biquad('lowpass', f, Math.SQRT1_2).run(y);
  new Biquad('lowpass', f, Math.SQRT1_2).run(y);
  return y.reduce((s, v) => s + v * v, 0) / energy(x);
}

describe('kit voices', () => {
  it('sec: seconds in samples, at least one', () => {
    expect(sec(1)).toBe(SR);
    expect(sec(0.0105)).toBe(504);
    expect(sec(0)).toBe(1);
  });

  it('detunedPad: as long as its gate and release, its layers on their sides, brighter when told, a pure function of its seed', () => {
    const notes = [50, 57, 62];
    const a = detunedPad(notes, 1, { seed: 3 });
    expect(a.l.length).toBe(Math.round((1 + 1.3) * SR));
    expect(a.r.length).toBe(a.l.length);
    expect(a.l.at(-1)).toBe(0);
    expect(detunedPad(notes, 1, { seed: 3 })).toEqual(a);
    expect(detunedPad(notes, 1, { seed: 4 }).l).not.toEqual(a.l);
    // one layer, all on the left
    const left = detunedPad(notes, 1, { seed: 3, layers: [{ shape: 'saw', l: 1, r: 0 }] });
    expect(energy(left.r)).toBe(0);
    expect(energy(left.l)).toBeGreaterThan(0);
    // `bright` opens the low-pass
    const dark = detunedPad(notes, 1, { seed: 3, bright: 0 });
    const open = detunedPad(notes, 1, { seed: 3, bright: 1 });
    expect(lowShare(open.l, 1000)).toBeLessThan(lowShare(dark.l, 1000));
  });

  it('detunedPad: only layers that follow the drift wander; a noise breath is seeded', () => {
    const steady = detunedPad([62], 0.5, { seed: 5 });
    // the default layers are steady: a drift moves nothing
    expect(detunedPad([62], 0.5, { seed: 5, drift: 20 })).toEqual(steady);
    const layers = [{ shape: 'triangle', cents: -5, l: 1, r: 0, drift: 1 }, { shape: 'triangle', cents: 5, l: 0, r: 1 }] as const;
    const still = detunedPad([62], 0.5, { seed: 5, layers });
    const wander = detunedPad([62], 0.5, { seed: 5, layers, drift: 20 });
    expect(wander.l).not.toEqual(still.l);
    expect(wander.r).toEqual(still.r);
    const breath = { shape: 'noise', rate: 0.35, depth: 0.15 } as const;
    expect(detunedPad([62], 0.5, { seed: 5, breath })).toEqual(detunedPad([62], 0.5, { seed: 5, breath }));
    expect(detunedPad([62], 0.5, { seed: 5, breath }).l).not.toEqual(steady.l);
  });

  it('filteredBass: held, released to zero, saturated under 1, closing as it decays', () => {
    const x = filteredBass(38, 0.2);
    expect(x.length).toBe(Math.round((0.2 + 0.06) * SR));
    expect(x.at(-1)).toBe(0);
    expect(peakOf(x)).toBeLessThan(1);
    expect(filteredBass(38, 0.2)).toEqual(x);
    // the low-pass closes with the envelope: without the sine, and nearly unsaturated, the note's
    // start has a larger share over 500 Hz than its held end
    const y = filteredBass(38, 0.2, { sub: 0, sat: 0.05 });
    const hi = Float64Array.from(y);
    new Biquad('highpass', 500, Math.SQRT1_2).run(hi);
    new Biquad('highpass', 500, Math.SQRT1_2).run(hi);
    const share = (a: number, b: number) => hi.subarray(sec(a), sec(b)).reduce((s, v) => s + v * v, 0) / energy(y, sec(a), sec(b));
    expect(share(0.005, 0.045)).toBeGreaterThan(2 * share(0.15, 0.19));
    expect(filteredBass(38, 0.2, { shape: 'pulse', width: 0.3 })).not.toEqual(x);
  });

  it('noiseClap: a burst at each onset, then the tail, levelled to -1 dB', () => {
    const bursts = [0, 0.012, 0.024];
    const x = noiseClap(7, { bursts, tailAt: 0.036 });
    expect(x.length).toBe(sec(0.24));
    expect(gainToDb(peakOf(x))).toBeCloseTo(-1, 6);
    // each burst starts louder than the end of the one before
    for (const d of bursts.slice(1)) expect(energy(x, sec(d), sec(d + 0.002))).toBeGreaterThan(energy(x, sec(d - 0.002), sec(d)));
    expect(noiseClap(7, { bursts, tailAt: 0.036 })).toEqual(x);
    expect(noiseClap(8, { bursts, tailAt: 0.036 })).not.toEqual(x);
  });

  it('noiseHat: high and short, levelled to -1 dB; a ring is an option', () => {
    const x = noiseHat(9);
    expect(x.length).toBe(sec(0.045 * 3 + 0.01));
    expect(gainToDb(peakOf(x))).toBeCloseTo(-1, 6);
    expect(lowShare(x, 2000)).toBeLessThan(0.01);
    expect(energy(x, x.length / 2)).toBeLessThan(energy(x, 0, x.length / 2) / 100);
    const short = noiseHat(9, { decay: 0.01, length: 0.08 });
    expect(short.length).toBe(sec(0.08));
    expect(noiseHat(9, { ring: { f: 9500, q: 1.4, gainDb: 4 } })).not.toEqual(x);
  });
});
