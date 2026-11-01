import { describe, expect, it } from 'vitest';
import { flipRows, unpadRows } from './index.ts';

describe('readback helpers', () => {
  it('flipRows turns bottom-up rows top-down, in place (odd and even heights)', () => {
    for (const h of [3, 4]) {
      const w = 2;
      const px = new Uint8Array(w * h * 4).map((_, k) => Math.floor(k / (w * 4)));
      flipRows(px, w, h);
      for (let y = 0; y < h; y++) expect(px[y * w * 4], `row ${y}`).toBe(h - 1 - y);
    }
  });

  it('unpadRows drops the 256-byte row alignment of WebGPU readbacks', () => {
    const w = 3;
    const h = 2;
    const raw = new Uint8Array(256 * h).fill(255);
    for (let y = 0; y < h; y++) for (let k = 0; k < w * 4; k++) raw[y * 256 + k] = y * 100 + k;
    const out = unpadRows(raw, w, h);
    expect(out.length).toBe(w * h * 4);
    expect(Array.from(out.subarray(12, 16))).toEqual([100, 101, 102, 103]);
    // already tight (width a multiple of 64): returned as is
    const tight = new Uint8Array(64 * 4 * 2);
    expect(unpadRows(tight, 64, 2)).toBe(tight);
  });
});
