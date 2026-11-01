/**
 * The colour test strip shared by every engine and by QA.
 *
 * A template draws TEST_SWATCHES at swatchLayout(width, height) on its swatch frames; `aiv qa`
 * decodes those frames from the FINAL delivery file with an explicit BT.709 limited-range
 * matrix and compares each patch's central 50 % mean against these values. That catches the
 * classic silent failures (BT.601 matrix, full range tagged as limited, double conversion),
 * which shift saturated patches by 10-20 code values while a correct pipeline stays within ~2.
 *
 * Values avoid 0 and 255: an extreme clips on decode and would hide a range error.
 */

export type Rgb = readonly [number, number, number];

export interface Swatch {
  id: string;
  /** sRGB-encoded 8-bit code values */
  rgb: Rgb;
}

export const TEST_SWATCHES: readonly Swatch[] = [
  { id: 'near-black', rgb: [16, 16, 16] },
  { id: 'near-white', rgb: [235, 235, 235] },
  { id: 'mid-grey', rgb: [128, 128, 128] },
  { id: 'red', rgb: [200, 40, 40] },
  { id: 'green', rgb: [40, 180, 60] },
  { id: 'blue', rgb: [40, 60, 200] },
  { id: 'skin', rgb: [194, 150, 130] },
];

/** Allowed deviation per channel (code values) of a patch mean after the delivery round trip. */
export const SWATCH_TOLERANCE = 3;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SwatchRect extends Rect {
  id: string;
  rgb: Rgb;
}

// even coordinates keep each patch aligned to 4:2:0 chroma pairs
const even = (n: number) => 2 * Math.round(n / 2);

/**
 * Pixel rectangles of the strip for a frame of width × height: patches side by side across the
 * middle 7/8 of the width, in a band at 78-92 % of the height (clear of lower-third captions
 * and of the bottom edge). Integer, even and non-overlapping, so pages and QA agree exactly.
 */
export function swatchLayout(width: number, height: number, swatches: readonly Swatch[] = TEST_SWATCHES): SwatchRect[] {
  if (!(width >= 64 && height >= 36)) throw new Error(`swatchLayout: frame ${width}x${height} is too small (min 64x36)`);
  const n = swatches.length;
  const x0 = even(width / 16);
  const pw = 2 * Math.floor((width - 2 * x0) / n / 2);
  const y0 = even(height * 0.78);
  const ph = even(height * 0.14);
  return swatches.map((s, k) => ({ id: s.id, rgb: s.rgb, x: x0 + k * pw, y: y0, w: pw, h: ph }));
}

/** The central `fraction` of a rect (default 50 % per axis): what QA averages, away from chroma bleed. */
export function centralRegion(r: Rect, fraction = 0.5): Rect {
  const w = Math.max(1, Math.round(r.w * fraction));
  const h = Math.max(1, Math.round(r.h * fraction));
  return { x: r.x + Math.floor((r.w - w) / 2), y: r.y + Math.floor((r.h - h) / 2), w, h };
}

/** CSS colour of a swatch, for pages that draw the strip with canvas/DOM. */
export const swatchCss = (rgb: Rgb): string => `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;

/**
 * Paint the strip into a tightly packed RGBA buffer (row stride width*4). Used by synthetic
 * engines and tests; pages may use it on an ImageData too.
 */
export function paintSwatches(rgba: Uint8Array | Uint8ClampedArray, width: number, height: number): void {
  for (const r of swatchLayout(width, height)) {
    for (let y = r.y; y < r.y + r.h; y++) {
      for (let x = r.x; x < r.x + r.w; x++) {
        const o = (y * width + x) * 4;
        rgba[o] = r.rgb[0];
        rgba[o + 1] = r.rgb[1];
        rgba[o + 2] = r.rgb[2];
        rgba[o + 3] = 255;
      }
    }
  }
}
