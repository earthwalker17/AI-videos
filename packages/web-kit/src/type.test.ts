// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest';
import { fontSpecs, layoutText, packShelves, type Glyph, type TypeStyle } from './type.ts';

const STYLE: TypeStyle = { family: 'AIV Test', weight: 600, px: 100, tracking: 0.01, leading: 1.2, chars: 'AVT .' };
const g = (adv: number, w = adv): Glyph => ({ uv: [0, 0, 0, 0], w, h: w > 0 ? 80 : 0, ox: 0, oy: -70, adv });
const GLYPHS: Record<string, Glyph> = { A: g(60), V: g(58), T: g(50), ' ': g(25, 0), '.': g(20) };
const KERN: Record<string, number> = { AV: -6, VA: -6, TA: -4 };
const glyph = (ch: string) => GLYPHS[ch];
const kern = (a: string, b: string) => KERN[a + b] ?? 0;

describe('layoutText', () => {
  it('advances by width, tracking and kerning, and skips blanks', () => {
    const lay = layoutText('AV A', STYLE, 70, glyph, kern);
    const track = STYLE.tracking * STYLE.px;
    expect(lay.glyphs.map((p) => p.x)).toEqual([0, 60 + track - 6, 60 + track - 6 + 58 + track + 25 + track]);
    expect(lay.glyphs.map((p) => p.k)).toEqual([0, 1, 2]);
    expect(lay.count).toBe(3);
    // a line ends at the last visible glyph's advance (no tracking after it)
    expect(lay.width).toBeCloseTo(lay.glyphs[2]!.x + 60, 12);
    expect(lay.cap).toBe(70);
    expect(lay.lineStep).toBe(120);
  });

  it('breaks lines at \\n and measures each', () => {
    const lay = layoutText('TA\nA.', STYLE, 70, glyph, kern);
    expect(lay.widths).toHaveLength(2);
    expect(lay.glyphs.map((p) => p.line)).toEqual([0, 0, 1, 1]);
    expect(lay.glyphs[2]!.x).toBe(0);
    expect(lay.width).toBe(Math.max(...lay.widths));
  });

  it('refuses a character the style does not hold', () => {
    expect(() => layoutText('AZ', STYLE, 70, glyph, kern)).toThrow(/no glyph for 'Z'/);
  });
});

describe('packShelves', () => {
  it('packs tallest first, ties by key, deterministically', () => {
    const cells = [
      { key: 'b', w: 10, h: 20 },
      { key: 'a', w: 10, h: 20 },
      { key: 'c', w: 30, h: 40 },
      { key: ' ', w: 0, h: 0 },
    ];
    const { pos, height } = packShelves(cells, 64);
    expect(pos.get('c')).toEqual([1, 1]);
    expect(pos.get('a')).toEqual([32, 1]);
    expect(pos.get('b')).toEqual([43, 1]);
    expect(pos.has(' ')).toBe(false);
    expect(height).toBe(64);
    expect(packShelves([...cells].reverse(), 64).pos).toEqual(pos);
  });

  it('starts a new shelf when a row is full, and rounds the height up to a power of two', () => {
    const cells = Array.from({ length: 5 }, (_, i) => ({ key: `k${i}`, w: 30, h: 10 }));
    const { pos, height } = packShelves(cells, 64);
    expect(pos.get('k0')).toEqual([1, 1]);
    expect(pos.get('k1')).toEqual([32, 1]);
    expect(pos.get('k2')).toEqual([1, 12]);
    expect(pos.get('k4')).toEqual([1, 23]);
    expect(height).toBe(64);
    // no two cells overlap
    const rects = cells.map((c) => [...pos.get(c.key)!, c.w, c.h] as const);
    for (let i = 0; i < rects.length; i++)
      for (let j = i + 1; j < rects.length; j++) {
        const [ax, ay, aw, ah] = rects[i]!;
        const [bx, by, bw, bh] = rects[j]!;
        expect(ax + aw <= bx || bx + bw <= ax || ay + ah <= by || by + bh <= ay).toBe(true);
      }
  });

  it('refuses a cell wider than the atlas', () => {
    expect(() => packShelves([{ key: 'w', w: 100, h: 10 }], 64)).toThrow(/atlas is 64/);
  });
});

describe('fontSpecs', () => {
  it('lists each weight, size and family once', () => {
    expect(fontSpecs({ a: STYLE, b: STYLE, c: { ...STYLE, px: 52 } })).toEqual(['600 100px "AIV Test"', '600 52px "AIV Test"']);
  });
});
