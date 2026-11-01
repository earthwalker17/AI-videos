import { describe, expect, it } from 'vitest';
import { centralRegion, paintSwatches, swatchLayout, TEST_SWATCHES } from './swatches.ts';

describe('swatches', () => {
  it('values avoid the clipping extremes', () => {
    for (const s of TEST_SWATCHES) for (const c of s.rgb) expect(c > 0 && c < 255, s.id).toBe(true);
    expect(new Set(TEST_SWATCHES.map((s) => s.id)).size).toBe(TEST_SWATCHES.length);
  });

  it.each([
    [320, 180],
    [960, 540],
    [1920, 1080],
    [1080, 1920],
    [3840, 2160],
  ])('layout at %ix%i is even, inside the frame and non-overlapping', (w, h) => {
    const rects = swatchLayout(w, h);
    expect(rects).toHaveLength(TEST_SWATCHES.length);
    for (const r of rects) {
      for (const v of [r.x, r.y, r.w, r.h]) expect(Number.isInteger(v) && v % 2 === 0).toBe(true);
      expect(r.x >= 0 && r.y >= 0 && r.x + r.w <= w && r.y + r.h <= h).toBe(true);
      expect(r.w).toBeGreaterThanOrEqual(16);
      expect(r.h).toBeGreaterThanOrEqual(16);
    }
    for (let i = 1; i < rects.length; i++) expect(rects[i].x).toBeGreaterThanOrEqual(rects[i - 1].x + rects[i - 1].w);
  });

  it('is stable (pages and QA share it; a change invalidates rendered swatch frames)', () => {
    expect(swatchLayout(1920, 1080)[0]).toEqual({ id: 'near-black', rgb: [16, 16, 16], x: 120, y: 842, w: 240, h: 152 });
  });

  it('central region is the middle half', () => {
    expect(centralRegion({ x: 100, y: 50, w: 40, h: 20 })).toEqual({ x: 110, y: 55, w: 20, h: 10 });
  });

  it('paints the strip into RGBA', () => {
    const w = 320;
    const h = 180;
    const buf = new Uint8Array(w * h * 4);
    paintSwatches(buf, w, h);
    const r = swatchLayout(w, h)[3];
    const o = ((r.y + 1) * w + r.x + 1) * 4;
    expect([...buf.subarray(o, o + 4)]).toEqual([200, 40, 40, 255]);
  });

  it('rejects tiny frames', () => {
    expect(() => swatchLayout(32, 18)).toThrow(/too small/);
  });
});
