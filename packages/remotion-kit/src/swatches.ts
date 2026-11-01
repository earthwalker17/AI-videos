/**
 * The @aiv/core swatch strip in CSS pixels. QA decodes the delivered file at the RENDER size and
 * measures swatchLayout(renderWidth, renderHeight), so the strip is laid out at that size and
 * divided by the render scale: at the draft's 0.5 every edge lands on an exact output pixel
 * (swatchLayout's coordinates are even), not on a rounded composition-size layout.
 */
import { swatchLayout, type Rgb } from '@aiv/core';

export interface CssSwatch {
  id: string;
  rgb: Rgb;
  left: number;
  top: number;
  width: number;
  height: number;
}

export function swatchRectsCss(renderWidth: number, renderHeight: number, scale: number): CssSwatch[] {
  return swatchLayout(renderWidth, renderHeight).map((r) => ({ id: r.id, rgb: r.rgb, left: r.x / scale, top: r.y / scale, width: r.w / scale, height: r.h / scale }));
}
