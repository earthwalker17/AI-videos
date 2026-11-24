// SPDX-License-Identifier: MIT
// Promoted from videos/super-agent/src/kit (tag video/super-agent/v2): the colour helpers of look.ts.
/**
 * Colour in linear light. Palettes are written as sRGB hex (as a designer picks them) and used
 * linear, because the stage composites in a linear half-float target and encodes sRGB once, at the
 * end of its post chain.
 */

export type Rgb = readonly [number, number, number];

/** One sRGB-encoded channel (0..1) to linear light (the IEC 61966-2-1 curve). */
export const srgbToLinear = (c: number): number => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

/** One linear channel (0..1) to sRGB encoding: the inverse of srgbToLinear. */
export const linearToSrgb = (c: number): number => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);

/** '#rrggbb' to linear RGB in [0, 1]. */
export function hex(h: string): Rgb {
  if (!/^#[0-9a-fA-F]{6}$/.test(h)) throw new Error(`color: '${h}' is not a #rrggbb colour`);
  const n = Number.parseInt(h.slice(1), 16);
  return [srgbToLinear(((n >> 16) & 255) / 255), srgbToLinear(((n >> 8) & 255) / 255), srgbToLinear((n & 255) / 255)];
}

/** A colour times `k` (brighter or darker light; above 1 it can bloom). */
export const scale = (c: Rgb, k: number): Rgb => [c[0] * k, c[1] * k, c[2] * k];

/** `a` to `b` by `t`, in linear light. */
export const mix = (a: Rgb, b: Rgb, t: number): Rgb => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
