import { describe, expect, it } from 'vitest';
import { SR, whiteNoise } from './dsp.ts';
import { convolveInto, fft, prepareIr } from './fft.ts';
import { HALL, ROOM, convolver, hallIr, roomIr, synthIr } from './reverb.ts';

describe('kit fft and convolution', () => {
  it('fft round-trips, and convolveInto equals direct convolution, truncated at the cuts', () => {
    const re = Float64Array.from({ length: 64 }, (_, i) => Math.sin(i * 0.3) + (i % 5));
    const im = new Float64Array(64);
    const keep = Float64Array.from(re);
    fft(re, im);
    fft(re, im, true);
    for (let i = 0; i < 64; i++) expect(re[i]).toBeCloseTo(keep[i], 9);
    expect(() => fft(new Float64Array(12), new Float64Array(12))).toThrow(/power of two/);

    const n = 3000;
    const w = whiteNoise(7);
    const inL = Float32Array.from({ length: n }, () => w());
    const inR = Float32Array.from({ length: n }, () => w());
    const ir = { l: Float32Array.from({ length: 300 }, (_, i) => Math.exp(-i / 40) * Math.cos(i)), r: Float32Array.from({ length: 300 }, (_, i) => Math.exp(-i / 60) * Math.sin(i + 1)) };
    const outL = new Float32Array(n);
    const outR = new Float32Array(n);
    const cut = 2000;
    convolveInto(inL, inR, prepareIr(ir), outL, outR, [cut], 0);
    const direct = (x: Float32Array, h: Float32Array, i: number, from: number, to: number) => {
      let s = 0;
      for (let k = 0; k < h.length; k++) if (i - k >= from && i - k < to) s += x[i - k] * h[k];
      return s;
    };
    for (const i of [0, 1, 250, 1999, 2000, 2001, 2500, 2999]) {
      const seg = i < cut ? [0, cut] : [cut, n];
      expect(outL[i]).toBeCloseTo(direct(inL, ir.l, i, seg[0], seg[1]), 4);
      expect(outR[i]).toBeCloseTo(direct(inR, ir.r, i, seg[0], seg[1]), 4);
    }
    // cuts in any order, repeated or outside the input, segment it the same way
    const messyL = new Float32Array(n);
    const messyR = new Float32Array(n);
    convolveInto(inL, inR, prepareIr(ir), messyL, messyR, [n + 5, cut, 0, cut], 0);
    expect(messyL).toEqual(outL);
    expect(messyR).toEqual(outR);
    // the mixer's return does the same, with a fade before each cut
    const wet = convolver(ir, 0)(inL, inR, [cut]);
    expect(wet.l).toEqual(outL);
    const faded = convolver(ir, 100 / SR)(inL, inR, [cut]);
    expect(Math.abs(faded.l[cut - 1])).toBe(0);
    expect(faded.l[cut - 200]).toBe(outL[cut - 200]);
  });

  it('synthesises seeded spaces of unit energy: the presets, and a space of its own', () => {
    const hall = hallIr(11);
    expect(hall.l.length).toBe(Math.round(HALL.length * SR) + Math.round(HALL.predelay * SR));
    // silent through the predelay, then sounding
    expect(hall.l.subarray(0, Math.round(HALL.predelay * SR)).every((v) => v === 0)).toBe(true);
    let e = 0;
    for (const ch of [hall.l, hall.r]) for (const v of ch) e += v * v;
    expect(e / 2).toBeCloseTo(1, 3);
    expect(hallIr(11)).toEqual(hall);
    expect(hallIr(12).l).not.toEqual(hall.l);
    expect(hall.l).not.toEqual(hall.r);
    expect(roomIr(11).l.length).toBeLessThan(hall.l.length);
    const short = synthIr({ ...ROOM, seed: 11, rt60: 0.2, length: 0.25 });
    expect(short.l.length).toBe(Math.round(0.25 * SR) + Math.round(ROOM.predelay * SR));
  });
});
