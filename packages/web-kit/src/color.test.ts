// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest';
import { hex, linearToSrgb, mix, scale, srgbToLinear } from './color.ts';

describe('colour helpers', () => {
  it('decodes sRGB hex to linear light', () => {
    expect(hex('#000000')).toEqual([0, 0, 0]);
    expect(hex('#ffffff')).toEqual([1, 1, 1]);
    // sRGB 0.5 is about 0.214 linear
    expect(hex('#808080')[0]).toBeCloseTo(0.2158605, 6);
    const c = hex('#ff8674');
    expect(c[0]).toBe(1);
    expect(c[1]).toBeCloseTo(srgbToLinear(0x86 / 255), 12);
    expect(c[2]).toBeCloseTo(srgbToLinear(0x74 / 255), 12);
  });

  it('refuses what is not #rrggbb', () => {
    expect(() => hex('#fff')).toThrow(/#rrggbb/);
    expect(() => hex('ff8674')).toThrow(/#rrggbb/);
  });

  it('round-trips every 8-bit code value through linear light', () => {
    for (let v = 0; v < 256; v++) expect(Math.round(linearToSrgb(srgbToLinear(v / 255)) * 255)).toBe(v);
  });

  it('scales and mixes in linear light', () => {
    expect(scale([0.2, 0.4, 0.6], 2)).toEqual([0.4, 0.8, 1.2]);
    expect(mix([0, 0, 0], [1, 0.5, 0.25], 0.5)).toEqual([0.5, 0.25, 0.125]);
    expect(mix([0.1, 0.2, 0.3], [0.9, 0.8, 0.7], 0)).toEqual([0.1, 0.2, 0.3]);
  });
});
