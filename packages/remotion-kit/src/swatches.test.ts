import { swatchLayout } from '@aiv/core';
import { describe, expect, it } from 'vitest';
import { swatchRectsCss } from './swatches.ts';

describe('swatchRectsCss', () => {
  it('lays the strip out at the render size and lands on whole output pixels', () => {
    for (const [w, h, s] of [
      [960, 540, 0.5],
      [1920, 1080, 1],
      [1280, 720, 2 / 3],
    ] as const) {
      const css = swatchRectsCss(w, h, s);
      const px = swatchLayout(w, h);
      expect(css.length).toBe(px.length);
      css.forEach((c, k) => {
        // back to output pixels: exactly the layout QA measures
        for (const [a, b] of [
          [c.left, px[k].x],
          [c.top, px[k].y],
          [c.width, px[k].w],
          [c.height, px[k].h],
        ])
          expect(Math.abs(a * s - b)).toBeLessThan(1e-9);
      });
    }
    // the draft layout is not the final one halved: why the render size matters
    // (draft strip at y = 422 px, the final one at 842 px, whose half is 421)
    expect(swatchRectsCss(960, 540, 0.5)[0].top * 0.5).toBe(422);
    expect(swatchLayout(1920, 1080)[0].y / 2).toBe(421);
  });
});
