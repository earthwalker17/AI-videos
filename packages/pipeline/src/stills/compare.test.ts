import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ffmpeg } from '../media/bin.ts';
import { probe } from '../media/probe.ts';
import {
  ANALYSIS_SIZE,
  ciede2000,
  compareSheet,
  compareStats,
  coverCrop,
  decodeRgb,
  gridMAE,
  hex,
  imageStats,
  kmeansPalette,
  labToSrgb,
  luma709,
  matchPalettes,
  optimalMatch,
  paletteStrip,
  SHEET_STRIP_HEIGHT,
  srgbToLab,
  valueGrid,
  type Lab,
  type PaletteColour,
} from './compare.ts';

// Sharma, Wu, Dalal (2005), "The CIEDE2000 color-difference formula: implementation notes,
// supplementary test data, and mathematical observations", Table 1: all 34 pairs (L*, a*, b*) → ΔE00.
const SHARMA: [Lab, Lab, number][] = [
  [[50, 2.6772, -79.7751], [50, 0, -82.7485], 2.0425],
  [[50, 3.1571, -77.2803], [50, 0, -82.7485], 2.8615],
  [[50, 2.8361, -74.02], [50, 0, -82.7485], 3.4412],
  [[50, -1.3802, -84.2814], [50, 0, -82.7485], 1.0],
  [[50, -1.1848, -84.8006], [50, 0, -82.7485], 1.0],
  [[50, -0.9009, -85.5211], [50, 0, -82.7485], 1.0],
  [[50, 0, 0], [50, -1, 2], 2.3669],
  [[50, -1, 2], [50, 0, 0], 2.3669],
  [[50, 2.49, -0.001], [50, -2.49, 0.0009], 7.1792],
  [[50, 2.49, -0.001], [50, -2.49, 0.001], 7.1792],
  [[50, 2.49, -0.001], [50, -2.49, 0.0011], 7.2195],
  [[50, 2.49, -0.001], [50, -2.49, 0.0012], 7.2195],
  [[50, -0.001, 2.49], [50, 0.0009, -2.49], 4.8045],
  [[50, -0.001, 2.49], [50, 0.001, -2.49], 4.8045],
  [[50, -0.001, 2.49], [50, 0.0011, -2.49], 4.7461],
  [[50, 2.5, 0], [50, 0, -2.5], 4.3065],
  [[50, 2.5, 0], [73, 25, -18], 27.1492],
  [[50, 2.5, 0], [61, -5, 29], 22.8977],
  [[50, 2.5, 0], [56, -27, -3], 31.903],
  [[50, 2.5, 0], [58, 24, 15], 19.4535],
  [[50, 2.5, 0], [50, 3.1736, 0.5854], 1.0],
  [[50, 2.5, 0], [50, 3.2972, 0], 1.0],
  [[50, 2.5, 0], [50, 1.8634, 0.5757], 1.0],
  [[50, 2.5, 0], [50, 3.2592, 0.335], 1.0],
  [[60.2574, -34.0099, 36.2677], [60.4626, -34.1751, 39.4387], 1.2644],
  [[63.0109, -31.0961, -5.8663], [62.8187, -29.7946, -4.0864], 1.263],
  [[61.2901, 3.7196, -5.3901], [61.4292, 2.248, -4.962], 1.8731],
  [[35.0831, -44.1164, 3.7933], [35.0232, -40.0716, 1.5901], 1.8645],
  [[22.7233, 20.0904, -46.694], [23.0331, 14.973, -42.5619], 2.0373],
  [[36.4612, 47.858, 18.3852], [36.2715, 50.5065, 21.2231], 1.4146],
  [[90.8027, -2.0831, 1.441], [91.1528, -1.6435, 0.0447], 1.4441],
  [[90.9257, -0.5406, -0.9208], [88.6381, -0.8985, -0.7239], 1.5381],
  [[6.7747, -0.2908, -2.4247], [5.8714, -0.0985, -2.2286], 0.6377],
  [[2.0776, 0.0795, -1.135], [0.9033, -0.0636, -0.5514], 0.9082],
];

/** A packed RGB image of `colours` in vertical bands of the given pixel counts per row. */
function bands(width: number, height: number, colours: [number, number, number][], widths: number[]): Uint8Array {
  const out = new Uint8Array(width * height * 3);
  for (let y = 0; y < height; y++) {
    let x = 0;
    colours.forEach((c, k) => {
      for (let n = 0; n < widths[k]; n++, x++) out.set(c, (y * width + x) * 3);
    });
  }
  return out;
}

describe('CIEDE2000', () => {
  it('reproduces all 34 pairs of Sharma et al. (2005) to 4 decimals, symmetrically', () => {
    for (const [a, b, want] of SHARMA) {
      expect(ciede2000(a, b)).toBeCloseTo(want, 4);
      expect(ciede2000(b, a)).toBeCloseTo(want, 4);
    }
    expect(ciede2000([50, 10, -10], [50, 10, -10])).toBe(0);
  });
});

describe('sRGB ↔ CIELAB', () => {
  it('maps white, black and grey to the neutral axis, and round-trips 8-bit colours', () => {
    const [Lw, aw, bw] = srgbToLab(255, 255, 255);
    expect(Lw).toBeCloseTo(100, 3);
    expect(Math.abs(aw)).toBeLessThan(0.01);
    expect(Math.abs(bw)).toBeLessThan(0.01);
    expect(srgbToLab(0, 0, 0)[0]).toBeCloseTo(0, 6);
    // sRGB 119 is close to L* 50
    expect(srgbToLab(119, 119, 119)[0]).toBeCloseTo(50, 0);
    // sRGB red: L* 53.24, a* 80.09, b* 67.20 (D65)
    const red = srgbToLab(255, 0, 0);
    expect(red[0]).toBeCloseTo(53.24, 1);
    expect(red[1]).toBeCloseTo(80.09, 1);
    expect(red[2]).toBeCloseTo(67.2, 1);
    for (const c of [[0, 0, 0], [255, 255, 255], [12, 200, 77], [250, 128, 3], [30, 31, 90]] as [number, number, number][]) expect(labToSrgb(srgbToLab(...c))).toEqual(c);
    expect(hex([16, 18, 255])).toBe('#1012ff');
  });

  it('uses Rec.709 luma weights on the encoded values', () => {
    expect(luma709(255, 0, 0)).toBeCloseTo(0.2126, 10);
    expect(luma709(0, 255, 0)).toBeCloseTo(0.7152, 10);
    expect(luma709(255, 255, 255)).toBeCloseTo(1, 10);
  });
});

describe('value grid', () => {
  const { width: W, height: H } = ANALYSIS_SIZE;
  it('averages each of the 8x5 cells and measures the mean absolute difference', () => {
    const half = bands(W, H, [[0, 0, 0], [255, 255, 255]], [W / 2, W / 2]);
    const g = valueGrid(half, W, H);
    expect(g).toHaveLength(40);
    expect(g.slice(0, 8).map((v) => Math.round(v * 1e6) / 1e6)).toEqual([0, 0, 0, 0, 1, 1, 1, 1]);
    const white = valueGrid(bands(W, H, [[255, 255, 255]], [W]), W, H);
    expect(gridMAE(g, white)).toBeCloseTo(0.5, 10);
    expect(gridMAE(g, g)).toBe(0);
    // a cell split 30/70 between black and white has the mean of its pixels
    const mixed = valueGrid(bands(W, H, [[0, 0, 0], [255, 255, 255]], [3, W - 3]), W, H);
    expect(mixed[0]).toBeCloseTo(0.7, 10);
    expect(() => valueGrid(half, W + 1, H)).toThrow(/not/);
    expect(() => gridMAE([1], [1, 2])).toThrow();
  });
});

describe('dominant palette', () => {
  it('finds the colours of a 3-colour image with their shares, largest first, deterministically', () => {
    const W = 80;
    const H = 45;
    const img = bands(W, H, [[200, 40, 30], [20, 30, 60], [240, 220, 160]], [40, 24, 16]);
    const p = kmeansPalette(img, 6);
    // three distinct colours: the empty clusters are dropped
    expect(p.map((c) => c.hex)).toEqual(['#c8281e', '#141e3c', '#f0dca0']);
    expect(p.map((c) => c.share)).toEqual([0.5, 0.3, 0.2]);
    expect(kmeansPalette(img, 6)).toEqual(p);
    expect(kmeansPalette(bands(4, 1, [[9, 9, 9]], [4]), 6).map((c) => [c.hex, c.share])).toEqual([['#090909', 1]]);
  });

  it('splits a gradient into k clusters that cover every pixel', () => {
    const W = 80;
    const H = 45;
    const img = new Uint8Array(W * H * 3);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) img.set([x * 3, 255 - x * 3, (y * 5) & 255], (y * W + x) * 3);
    const p = kmeansPalette(img, 6);
    expect(p).toHaveLength(6);
    expect(p.reduce((s, c) => s + c.share, 0)).toBeCloseTo(1, 10);
    for (let k = 1; k < p.length; k++) expect(p[k].share).toBeLessThanOrEqual(p[k - 1].share);
  });
});

describe('palette matching', () => {
  it('finds the optimal pairing where a greedy one would not', () => {
    // greedy takes (0,0) = 1 first and is left with (1,1) = 100; optimal is (0,1) + (1,0) = 4
    const cost = [
      [1, 2],
      [2, 100],
    ];
    const m = optimalMatch(2, 2, (i, j) => cost[i][j]);
    expect(m.pairs).toEqual([
      [0, 1],
      [1, 0],
    ]);
    expect(m.total).toBe(4);
    // unequal sizes: every row of the smaller side is paired once
    const wide = optimalMatch(3, 1, (i) => [5, 1, 3][i]);
    expect(wide.pairs).toEqual([[1, 0]]);
    expect(optimalMatch(0, 3, () => 1)).toEqual({ pairs: [], total: 0 });
  });

  it('matches a permuted palette with itself at ΔE 0, in palette a order', () => {
    const col = (r: number, g: number, b: number, share: number): PaletteColour => ({ lab: srgbToLab(r, g, b), hex: hex([r, g, b]), share });
    const a = [col(200, 40, 30, 0.4), col(20, 30, 60, 0.3), col(240, 220, 160, 0.2), col(30, 160, 60, 0.1)];
    const b = [a[2], a[0], a[3], a[1]];
    const m = matchPalettes(a, b);
    expect(m.pairs.map((p) => [p.a, p.b])).toEqual([
      [0, 1],
      [1, 3],
      [2, 0],
      [3, 2],
    ]);
    expect(m.meanDeltaE).toBe(0);
    const shifted = matchPalettes(a, [col(205, 40, 30, 1)]);
    expect(shifted.pairs).toHaveLength(1);
    expect(shifted.pairs[0].a).toBe(0);
    expect(shifted.meanDeltaE).toBeGreaterThan(0);
    expect(shifted.meanDeltaE).toBeLessThan(3);
  });
});

describe('cover crop', () => {
  it('centre-crops to the aspect ratio', () => {
    expect(coverCrop(1000, 1000, 1920, 1080)).toEqual({ w: 1000, h: 563, x: 0, y: 218 });
    expect(coverCrop(3840, 1080, 1920, 1080)).toEqual({ w: 1920, h: 1080, x: 960, y: 0 });
    expect(coverCrop(1920, 1080, 960, 540)).toEqual({ w: 1920, h: 1080, x: 0, y: 0 });
  });
});

describe('palette strip', () => {
  it('draws the still palette left and the matched reference colours right, in matched order', () => {
    const col = (r: number, g: number, b: number): PaletteColour => ({ lab: srgbToLab(r, g, b), hex: hex([r, g, b]), share: 0.5 });
    const still = [col(255, 0, 0), col(0, 0, 255)];
    const ref = [col(0, 0, 250), col(250, 0, 0)];
    const half = 100;
    const s = paletteStrip(still, ref, matchPalettes(still, ref), half, 10, 4);
    const at = (x: number, y: number) => [...s.subarray((y * (2 * half + 4) + x) * 3, (y * (2 * half + 4) + x) * 3 + 3)];
    expect(s.length).toBe((2 * half + 4) * 10 * 3);
    expect(at(25, 5)).toEqual([255, 0, 0]);
    expect(at(75, 5)).toEqual([0, 0, 255]);
    expect(at(half + 2, 5)).toEqual([0x10, 0x12, 0x14]);
    // bar 0 on the right is the reference colour matched to the still's red
    expect(at(half + 4 + 25, 5)).toEqual([250, 0, 0]);
    expect(at(half + 4 + 75, 5)).toEqual([0, 0, 250]);
    // a label band leaves the top rows dark
    const banded = paletteStrip(still, ref, matchPalettes(still, ref), half, 10, 4, 3);
    const px = (x: number, y: number) => [...banded.subarray((y * (2 * half + 4) + x) * 3, (y * (2 * half + 4) + x) * 3 + 3)];
    expect(px(25, 2)).toEqual([0x10, 0x12, 0x14]);
    expect(px(25, 3)).toEqual([255, 0, 0]);
  });
});

describe('images through ffmpeg', () => {
  let dir: string | null = null;
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
    dir = null;
  });

  it('reads both images the same way and writes the three-row compare sheet', async () => {
    dir = mkdtempSync(join(tmpdir(), 'aiv-compare-'));
    const still = join(dir, 'still.png');
    const ref = join(dir, 'ref.png');
    const W = 320;
    const H = 180;
    const img = bands(W, H, [[200, 40, 30], [20, 30, 60]], [W / 2, W / 2]);
    const writePng = (rgb: Uint8Array, w: number, h: number, out: string) => ffmpeg(['-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${w}x${h}`, '-i', '-', '-frames:v', '1', '-update', '1', out], 'test png', { input: rgb });
    await writePng(img, W, H, still);
    // a square reference whose centre crop is the still
    const sq = new Uint8Array(W * W * 3).fill(255);
    sq.set(img, ((W - H) / 2) * W * 3);
    await writePng(sq, W, W, ref);

    const a = imageStats(await decodeRgb(still, ANALYSIS_SIZE.width, ANALYSIS_SIZE.height));
    const crop = coverCrop(W, W, W, H);
    const b = imageStats(await decodeRgb(ref, ANALYSIS_SIZE.width, ANALYSIS_SIZE.height, crop));
    const c = compareStats(a, b);
    expect(c.valueGridMAE).toBeCloseTo(0, 6);
    expect(c.paletteDeltaE).toBeCloseTo(0, 6);
    expect(a.palette.map((p) => p.hex)).toEqual(['#141e3c', '#c8281e']);

    const out = join(dir, 'compare.png');
    await compareSheet({ still, ref, crop, stillStats: a, refStats: b, comparison: c, stillLabel: 'still 0', refLabel: 'ref: square', out });
    const v = (await probe(out)).video!;
    expect([v.width, v.height]).toEqual([960 * 2 + 4, 540 * 2 + 4 * 2 + SHEET_STRIP_HEIGHT]);
  });
});
