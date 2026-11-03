/**
 * Still ↔ reference comparison for lookdev: two numbers and a sheet, so "closer to the
 * reference" is something an agent can measure as well as look at. The numbers are reported,
 * never gating: a reference is a direction, not a target to hit pixel for pixel.
 *
 *  - valueGridMAE: the mean absolute difference of an 8x5 grid of mean luma (0..1) between the
 *    still and the reference. Luma is Rec.709 luma on the sRGB-ENCODED values,
 *    Y' = 0.2126 R' + 0.7152 G' + 0.0722 B' (not linear luminance): it is linear in the stored
 *    values, so an area downscale averages it exactly, and it matches how a value study reads.
 *  - paletteDeltaE: the mean CIEDE2000 (Sharma, Wu, Dalal 2005; kL = kC = kH = 1) between the
 *    two dominant palettes (6 colours each), matched optimally (minimum total ΔE00 over all
 *    pairings, not greedily).
 *
 * Both images are read through one path (decodeRgb): the reference is centre-cropped to the
 * still's aspect ratio (never letterboxed: bars would count as dark values and a black colour),
 * and both are area-downscaled by ffmpeg to ANALYSIS_SIZE (80x45, so the 8x5 grid cells are
 * exactly 10x9 pixels). The palette is a deterministic k-means (k = 6, Lloyd iterations,
 * Euclidean distance in CIELAB D65) on those 3600 pixels, seeded at luminance quantiles: the
 * same pixels give the same palette, without randomness.
 */
import { renameSync, rmSync } from 'node:fs';
import { ffmpeg, ffmpegBin } from '../media/bin.ts';
import { filterValue } from '../media/escape.ts';
import { probe } from '../media/probe.ts';
import { execBuffer } from '../util/proc.ts';
import { partPath } from '../util/paths.ts';
import type { Log } from '../util/log.ts';

/** CIELAB (D65): [L*, a*, b*]. */
export type Lab = readonly [number, number, number];

/** The size both images are reduced to for the numbers (16:9; 8x5 cells of 10x9 pixels). */
export const ANALYSIS_SIZE = { width: 80, height: 45 } as const;
export const GRID = { cols: 8, rows: 5 } as const;
export const PALETTE_SIZE = 6;
/** How the numbers are defined, recorded next to them in stills.json. */
export const METRICS = {
  valueGridMAE: "mean |Δ| of an 8x5 grid of mean Rec.709 luma of the sRGB-encoded values (Y' = 0.2126 R' + 0.7152 G' + 0.0722 B', 0..1), on an 80x45 area downscale",
  paletteDeltaE: 'mean CIEDE2000 (kL=kC=kH=1) between two 6-colour palettes, matched optimally; palette = k-means k=6 in CIELAB D65 on the 80x45 downscale, seeded at luminance quantiles',
  reference: "centre-cropped to the still's aspect ratio",
} as const;

// sRGB → linear, one entry per 8-bit code value (IEC 61966-2-1)
const LINEAR = Float64Array.from({ length: 256 }, (_, c) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
});
// the D65 white point of the sRGB matrix, Y = 1
const WX = 0.95047;
const WZ = 1.08883;
const EPS = (6 / 29) ** 3;
const f = (t: number) => (t > EPS ? Math.cbrt(t) : t / (3 * (6 / 29) ** 2) + 4 / 29);
const fInv = (t: number) => (t > 6 / 29 ? t ** 3 : 3 * (6 / 29) ** 2 * (t - 4 / 29));

/** 8-bit sRGB → CIELAB (D65). */
export function srgbToLab(r: number, g: number, b: number): Lab {
  const R = LINEAR[r];
  const G = LINEAR[g];
  const B = LINEAR[b];
  const x = (0.4124564 * R + 0.3575761 * G + 0.1804375 * B) / WX;
  const y = 0.2126729 * R + 0.7151522 * G + 0.072175 * B;
  const z = (0.0193339 * R + 0.119192 * G + 0.9503041 * B) / WZ;
  const fy = f(y);
  return [116 * fy - 16, 500 * (f(x) - fy), 200 * (fy - f(z))];
}

/** CIELAB (D65) → 8-bit sRGB, clamped to the gamut. */
export function labToSrgb([L, a, b]: Lab): [number, number, number] {
  const fy = (L + 16) / 116;
  const x = WX * fInv(fy + a / 500);
  const y = fInv(fy);
  const z = WZ * fInv(fy - b / 200);
  const lin = [3.2404542 * x - 1.5371385 * y - 0.4985314 * z, -0.969266 * x + 1.8760108 * y + 0.041556 * z, 0.0556434 * x - 0.2040259 * y + 1.0572252 * z];
  return lin.map((v) => {
    const c = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.max(0, v) ** (1 / 2.4) - 0.055;
    return Math.round(Math.min(1, Math.max(0, c)) * 255);
  }) as [number, number, number];
}

export const hex = (rgb: readonly number[]): string => `#${rgb.map((c) => c.toString(16).padStart(2, '0')).join('')}`;

const RAD = Math.PI / 180;
const POW25_7 = 25 ** 7;

/** CIEDE2000 colour difference (Sharma, Wu, Dalal 2005, with kL = kC = kH = 1). */
export function ciede2000(lab1: Lab, lab2: Lab): number {
  const [L1, a1, b1] = lab1;
  const [L2, a2, b2] = lab2;
  const Cbar = (Math.hypot(a1, b1) + Math.hypot(a2, b2)) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cbar ** 7 / (Cbar ** 7 + POW25_7)));
  const a1p = (1 + G) * a1;
  const a2p = (1 + G) * a2;
  const C1p = Math.hypot(a1p, b1);
  const C2p = Math.hypot(a2p, b2);
  const hue = (b: number, ap: number) => {
    if (b === 0 && ap === 0) return 0;
    const h = Math.atan2(b, ap) / RAD;
    return h < 0 ? h + 360 : h;
  };
  const h1p = hue(b1, a1p);
  const h2p = hue(b2, a2p);
  const dLp = L2 - L1;
  const dCp = C2p - C1p;
  const chroma0 = C1p * C2p === 0;
  let dhp = 0;
  if (!chroma0) {
    dhp = h2p - h1p;
    if (dhp > 180) dhp -= 360;
    else if (dhp < -180) dhp += 360;
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp / 2) * RAD);
  const Lbp = (L1 + L2) / 2;
  const Cbp = (C1p + C2p) / 2;
  let hbp: number;
  if (chroma0) hbp = h1p + h2p;
  else if (Math.abs(h1p - h2p) <= 180) hbp = (h1p + h2p) / 2;
  else hbp = h1p + h2p < 360 ? (h1p + h2p + 360) / 2 : (h1p + h2p - 360) / 2;
  const T = 1 - 0.17 * Math.cos((hbp - 30) * RAD) + 0.24 * Math.cos(2 * hbp * RAD) + 0.32 * Math.cos((3 * hbp + 6) * RAD) - 0.2 * Math.cos((4 * hbp - 63) * RAD);
  const dTheta = 30 * Math.exp(-(((hbp - 275) / 25) ** 2));
  const RC = 2 * Math.sqrt(Cbp ** 7 / (Cbp ** 7 + POW25_7));
  const SL = 1 + (0.015 * (Lbp - 50) ** 2) / Math.sqrt(20 + (Lbp - 50) ** 2);
  const SC = 1 + 0.045 * Cbp;
  const SH = 1 + 0.015 * Cbp * T;
  const RT = -Math.sin(2 * dTheta * RAD) * RC;
  const l = dLp / SL;
  const c = dCp / SC;
  const h = dHp / SH;
  return Math.sqrt(l * l + c * c + h * h + RT * c * h);
}

/** Rec.709 luma of 8-bit sRGB-encoded values, 0..1 (see the header: not linear luminance). */
export const luma709 = (r: number, g: number, b: number): number => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

/** Mean luma per cell of a cols x rows grid over a packed RGB image, row by row. */
export function valueGrid(rgb: Uint8Array, width: number, height: number, cols: number = GRID.cols, rows: number = GRID.rows): number[] {
  if (rgb.length !== width * height * 3) throw new Error(`valueGrid: ${rgb.length} bytes is not ${width}x${height} RGB`);
  const out: number[] = [];
  for (let r = 0; r < rows; r++) {
    const y0 = Math.floor((r * height) / rows);
    const y1 = Math.floor(((r + 1) * height) / rows);
    for (let c = 0; c < cols; c++) {
      const x0 = Math.floor((c * width) / cols);
      const x1 = Math.floor(((c + 1) * width) / cols);
      let sum = 0;
      for (let y = y0; y < y1; y++)
        for (let x = x0; x < x1; x++) {
          const o = (y * width + x) * 3;
          sum += luma709(rgb[o], rgb[o + 1], rgb[o + 2]);
        }
      out.push(sum / Math.max(1, (x1 - x0) * (y1 - y0)));
    }
  }
  return out;
}

/** Mean absolute difference of two equally long value lists. */
export function gridMAE(a: readonly number[], b: readonly number[]): number {
  if (a.length !== b.length || !a.length) throw new Error(`gridMAE: grids of ${a.length} and ${b.length} cells`);
  return a.reduce((s, v, k) => s + Math.abs(v - b[k]), 0) / a.length;
}

export interface PaletteColour {
  lab: Lab;
  hex: string;
  /** share of the pixels in this cluster, 0..1 */
  share: number;
}

const dist2 = (L: Float64Array, A: Float64Array, B: Float64Array, p: number, c: Lab) => (L[p] - c[0]) ** 2 + (A[p] - c[1]) ** 2 + (B[p] - c[2]) ** 2;

/**
 * The dominant colours of a packed RGB image: k-means in CIELAB, Lloyd iterations until no
 * pixel changes cluster (at most maxIter). Seeds are the pixels at the luminance quantiles
 * (j + 0.5) / k, ties by pixel index; an empty cluster is reseeded with the pixel farthest from
 * its centre (first on ties). Fully deterministic. Empty clusters (an image with fewer distinct
 * colours than k) are dropped; the rest are sorted by share, largest first (ties: darker first).
 */
export function kmeansPalette(rgb: Uint8Array, k: number = PALETTE_SIZE, maxIter = 100): PaletteColour[] {
  const n = rgb.length / 3;
  if (!Number.isInteger(n) || n < 1) throw new Error(`kmeansPalette: ${rgb.length} bytes is not packed RGB`);
  const L = new Float64Array(n);
  const A = new Float64Array(n);
  const B = new Float64Array(n);
  for (let p = 0; p < n; p++) [L[p], A[p], B[p]] = srgbToLab(rgb[p * 3], rgb[p * 3 + 1], rgb[p * 3 + 2]);
  const order = Array.from({ length: n }, (_, p) => p).sort((p, q) => L[p] - L[q] || p - q);
  const kk = Math.min(k, n);
  let centres: Lab[] = Array.from({ length: kk }, (_, j) => {
    const p = order[Math.floor(((j + 0.5) * n) / kk)];
    return [L[p], A[p], B[p]] as Lab;
  });
  const assign = new Int32Array(n).fill(-1);
  for (let iter = 0; iter < maxIter; iter++) {
    let changed = false;
    for (let p = 0; p < n; p++) {
      let best = 0;
      let bd = Infinity;
      for (let j = 0; j < kk; j++) {
        const d = dist2(L, A, B, p, centres[j]);
        if (d < bd) {
          bd = d;
          best = j;
        }
      }
      if (assign[p] !== best) {
        assign[p] = best;
        changed = true;
      }
    }
    if (!changed) break;
    const sum = Array.from({ length: kk }, () => [0, 0, 0, 0]);
    for (let p = 0; p < n; p++) {
      const s = sum[assign[p]];
      s[0] += L[p];
      s[1] += A[p];
      s[2] += B[p];
      s[3]++;
    }
    const next = sum.map((s, j) => (s[3] ? ([s[0] / s[3], s[1] / s[3], s[2] / s[3]] as Lab) : centres[j]));
    for (let j = 0; j < kk; j++) {
      if (sum[j][3]) continue;
      // reseed an empty cluster with the worst-fitting pixel, if any pixel fits imperfectly
      let far = -1;
      let fd = 0;
      for (let p = 0; p < n; p++) {
        const d = dist2(L, A, B, p, next[assign[p]]);
        if (d > fd) {
          fd = d;
          far = p;
        }
      }
      if (far >= 0) next[j] = [L[far], A[far], B[far]];
    }
    centres = next;
  }
  const count = new Array<number>(kk).fill(0);
  for (let p = 0; p < n; p++) count[assign[p]]++;
  return centres
    .map((c, j) => ({ lab: c, hex: hex(labToSrgb(c)), share: count[j] / n }))
    .filter((c) => c.share > 0)
    .sort((a, b) => b.share - a.share || a.lab[0] - b.lab[0]);
}

/**
 * The pairing of n rows with m columns (each used at most once, min(n, m) pairs) with the
 * smallest total cost, by exhaustive search with pruning: fine for palettes (6! = 720), so at
 * most 8 on the smaller side. Ties keep the first pairing found (lexicographic).
 */
export function optimalMatch(n: number, m: number, cost: (i: number, j: number) => number): { pairs: [number, number][]; total: number } {
  const swap = n > m;
  const rows = swap ? m : n;
  const cols = swap ? n : m;
  if (rows > 8) throw new Error(`optimalMatch: ${rows} items is too many for exhaustive matching`);
  const c = (r: number, k: number) => (swap ? cost(k, r) : cost(r, k));
  let best = Infinity;
  let bestCols: number[] = [];
  const used = new Array<boolean>(cols).fill(false);
  const cur: number[] = [];
  const dfs = (r: number, acc: number) => {
    if (acc >= best) return;
    if (r === rows) {
      best = acc;
      bestCols = [...cur];
      return;
    }
    for (let k = 0; k < cols; k++) {
      if (used[k]) continue;
      used[k] = true;
      cur.push(k);
      dfs(r + 1, acc + c(r, k));
      cur.pop();
      used[k] = false;
    }
  };
  dfs(0, 0);
  return { pairs: bestCols.map((k, r) => (swap ? [k, r] : [r, k])), total: rows ? best : 0 };
}

export interface PaletteMatch {
  /** index into palette a, index into palette b, their ΔE00 */
  pairs: { a: number; b: number; deltaE: number }[];
  meanDeltaE: number;
}

/** Match two palettes optimally by CIEDE2000; pairs are listed in palette a's order. */
export function matchPalettes(a: readonly PaletteColour[], b: readonly PaletteColour[]): PaletteMatch {
  const m = optimalMatch(a.length, b.length, (i, j) => ciede2000(a[i].lab, b[j].lab));
  const pairs = m.pairs.map(([i, j]) => ({ a: i, b: j, deltaE: ciede2000(a[i].lab, b[j].lab) })).sort((p, q) => p.a - q.a);
  return { pairs, meanDeltaE: pairs.length ? m.total / pairs.length : 0 };
}

/** The centred crop of a srcW x srcH image to the aspect ratio aspectW:aspectH (integer pixels). */
export function coverCrop(srcW: number, srcH: number, aspectW: number, aspectH: number): { w: number; h: number; x: number; y: number } {
  const wide = srcW * aspectH > srcH * aspectW;
  const w = wide ? Math.max(1, Math.round((srcH * aspectW) / aspectH)) : srcW;
  const h = wide ? srcH : Math.max(1, Math.round((srcW * aspectH) / aspectW));
  return { w, h, x: Math.floor((srcW - w) / 2), y: Math.floor((srcH - h) / 2) };
}

export interface ImageCrop {
  w: number;
  h: number;
  x: number;
  y: number;
}

/** Read an image file (PNG, JPEG, …) as packed RGB at width x height, area-downscaled, after an optional crop. */
export async function decodeRgb(file: string, width: number, height: number, crop?: ImageCrop): Promise<Uint8Array> {
  const vf = [...(crop ? [`crop=${crop.w}:${crop.h}:${crop.x}:${crop.y}`] : []), `scale=${width}:${height}:flags=area`, 'format=rgb24'].join(',');
  const r = await execBuffer(ffmpegBin(), ['-hide_banner', '-loglevel', 'error', '-nostdin', '-i', file, '-map', '0:v:0', '-frames:v', '1', '-vf', vf, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { timeoutMs: 120_000 });
  if (r.code !== 0) throw new Error(`reading ${file} failed: ${r.stderr.trim().split('\n').slice(-3).join(' ')}`);
  if (r.stdout.length !== width * height * 3) throw new Error(`reading ${file}: got ${r.stdout.length} bytes, expected ${width * height * 3}`);
  return new Uint8Array(r.stdout.buffer, r.stdout.byteOffset, r.stdout.length);
}

/** An image's size (ffprobe). */
export async function imageSize(file: string): Promise<{ width: number; height: number }> {
  const v = (await probe(file)).video;
  if (!v || !(v.width > 0) || !(v.height > 0)) throw new Error(`${file} is not an image ffmpeg can read`);
  return { width: v.width, height: v.height };
}

/** One image's numbers: its 8x5 value grid and its dominant palette. */
export interface ImageStats {
  grid: number[];
  palette: PaletteColour[];
}

export function imageStats(rgb: Uint8Array): ImageStats {
  return { grid: valueGrid(rgb, ANALYSIS_SIZE.width, ANALYSIS_SIZE.height), palette: kmeansPalette(rgb) };
}

export interface Comparison {
  valueGridMAE: number;
  paletteDeltaE: number;
  match: PaletteMatch;
}

export function compareStats(still: ImageStats, ref: ImageStats): Comparison {
  const match = matchPalettes(still.palette, ref.palette);
  return { valueGridMAE: gridMAE(still.grid, ref.grid), paletteDeltaE: match.meanDeltaE, match };
}

/**
 * Row 3 of the sheet as packed RGB: the still's palette (by share) in equal bars on the left
 * half, the reference's colours on the right half in the order matched to them (bar k on the
 * right is the reference colour paired with bar k on the left; unmatched ones follow). The top
 * `band` rows stay dark, for the label: drawn over a bar it would hide a colour.
 */
export function paletteStrip(still: readonly PaletteColour[], ref: readonly PaletteColour[], match: PaletteMatch, half: number, height: number, gap = 4, band = 0): Uint8Array {
  const width = half * 2 + gap;
  const out = new Uint8Array(width * height * 3);
  const paint = (x0: number, x1: number, rgb: readonly number[], y0 = band) => {
    for (let y = y0; y < height; y++)
      for (let x = x0; x < x1; x++) {
        const o = (y * width + x) * 3;
        out[o] = rgb[0];
        out[o + 1] = rgb[1];
        out[o + 2] = rgb[2];
      }
  };
  paint(0, width, [0x10, 0x12, 0x14], 0);
  const bars = (cols: readonly PaletteColour[], x0: number) =>
    cols.forEach((c, k) => {
      const a = x0 + Math.floor((k * half) / cols.length);
      const b = x0 + Math.floor(((k + 1) * half) / cols.length);
      // a 2 px seam between bars keeps two similar colours apart
      paint(a + (k ? 1 : 0), b - (k < cols.length - 1 ? 1 : 0), labToSrgb(c.lab));
    });
  bars(still, 0);
  const matched = match.pairs.map((p) => p.b);
  const refOrder = [...matched, ...ref.map((_, j) => j).filter((j) => !matched.includes(j))];
  bars(
    refOrder.map((j) => ref[j]),
    half + gap,
  );
  return out;
}

/** The sheet's panel size: one still or reference at 960x540 (half of 1080p). */
export const SHEET_PANEL = { width: 960, height: 540 } as const;
/** Row 3: a label band over the palette bars. */
const STRIP_BAND = 32;
export const SHEET_STRIP_HEIGHT = STRIP_BAND + 96;
const LUMA_MIX = 'colorchannelmixer=rr=.2126:rg=.7152:rb=.0722:gr=.2126:gg=.7152:gb=.0722:br=.2126:bg=.7152:bb=.0722';

export interface SheetOptions {
  still: string;
  ref: string;
  /** the reference crop to the still's aspect */
  crop: ImageCrop;
  stillStats: ImageStats;
  refStats: ImageStats;
  comparison: Comparison;
  /** labels drawn on the sheet */
  stillLabel: string;
  refLabel: string;
  out: string;
  log?: Log;
}

let drawtextOk = true;

/**
 * compare-<NNNNN>.png: row 1 the still and the reference side by side (960x540 each, the
 * reference centre-cropped), row 2 their value maps (the same Rec.709 luma as the numbers,
 * gaussian-blurred, with the 8x5 grid drawn), row 3 their palettes (paletteStrip). Labelled
 * with the numbers when drawtext has a font; unlabelled otherwise (like the contact sheet).
 */
export async function compareSheet(o: SheetOptions): Promise<{ labels: boolean }> {
  const { width: W, height: H } = SHEET_PANEL;
  const gap = 4;
  const strip = paletteStrip(o.stillStats.palette, o.refStats.palette, o.comparison.match, W, SHEET_STRIP_HEIGHT, gap, STRIP_BAND);
  const valueMap = `${LUMA_MIX},format=gbrp,gblur=sigma=${Math.round(W / 80)},format=rgb24,drawgrid=w=${W / GRID.cols}:h=${H / GRID.rows}:t=1:c=white@0.35`;
  const text = (s: string, x: string, y: string) => `drawtext=text=${filterValue(s)}:x=${x}:y=${y}:fontsize=18:fontcolor=white:box=1:boxcolor=black@0.6:boxborderw=4`;
  const c = o.comparison;
  const labels = [
    text(o.stillLabel, '8', '8'),
    text(o.refLabel, `${W + gap + 8}`, '8'),
    text(`value maps  |  valueGridMAE ${c.valueGridMAE.toFixed(4)}`, '8', `${H + gap + 8}`),
    text(`still palette (k-means 6, by share)  |  paletteDeltaE ${c.paletteDeltaE.toFixed(2)}`, '8', `${2 * (H + gap) + 6}`),
    text('reference palette (in matched order)', `${W + gap + 8}`, `${2 * (H + gap) + 6}`),
  ].join(',');
  const graph = (withLabels: boolean) =>
    [
      `[0:v]scale=${W}:${H}:flags=bicubic,format=rgb24,split=2[s][s2]`,
      `[1:v]crop=${o.crop.w}:${o.crop.h}:${o.crop.x}:${o.crop.y},scale=${W}:${H}:flags=bicubic,format=rgb24,split=2[r][r2]`,
      `[s2]${valueMap}[sv]`,
      `[r2]${valueMap}[rv]`,
      `[s][r]xstack=inputs=2:layout=0_0|${W + gap}_0:fill=0x101214[top]`,
      `[sv][rv]xstack=inputs=2:layout=0_0|${W + gap}_0:fill=0x101214[mid]`,
      `[top][mid][2:v]xstack=inputs=3:layout=0_0|0_${H + gap}|0_${2 * (H + gap)}:fill=0x101214,format=rgb24${withLabels ? `,${labels}` : ''}[out]`,
    ].join(';');
  const args = (withLabels: boolean) => [
    '-loglevel',
    'error',
    '-i',
    o.still,
    '-i',
    o.ref,
    '-f',
    'rawvideo',
    '-pix_fmt',
    'rgb24',
    '-s',
    `${2 * W + gap}x${SHEET_STRIP_HEIGHT}`,
    '-i',
    '-',
    '-filter_complex',
    graph(withLabels),
    '-map',
    '[out]',
    '-frames:v',
    '1',
    '-update',
    '1',
    partPath(o.out),
  ];
  rmSync(partPath(o.out), { force: true });
  let labelled = drawtextOk;
  try {
    if (!labelled) throw new Error('labels off');
    await ffmpeg(args(true), 'compare sheet', { timeoutMs: 120_000, input: strip });
  } catch {
    // drawtext needs a usable font; an unlabelled sheet still beats none
    if (labelled) o.log?.warn('compare sheet: drawtext unavailable, the sheet is unlabelled (the numbers are in the log and stills.json)');
    drawtextOk = labelled = false;
    await ffmpeg(args(false), 'compare sheet', { timeoutMs: 120_000, input: strip });
  }
  renameSync(partPath(o.out), o.out);
  return { labels: labelled };
}
