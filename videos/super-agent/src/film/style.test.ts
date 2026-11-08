import { describe, expect, it } from 'vitest';
import { DETAIL, ZOOM } from '../look/tokens.ts';
import { detailOpacity } from './style.ts';
import { FRAMINGS } from './world.ts';

describe('the small glyphs’ level of detail', () => {
  it('shows them whole from DETAIL.hideBelow up and not at all a fade range further out', () => {
    expect(detailOpacity(DETAIL.hideBelow)).toBe(1);
    expect(detailOpacity(ZOOM.max)).toBe(1);
    expect(detailOpacity(DETAIL.hideBelow - DETAIL.fadeRange)).toBe(0);
    expect(detailOpacity(ZOOM.min)).toBe(0);
  });

  it('fades them out smoothly, never back in, as the camera pulls out', () => {
    let last = 0;
    for (let s = ZOOM.min; s <= ZOOM.max + 1e-9; s += 0.005) {
      const o = detailOpacity(s);
      expect(o).toBeGreaterThanOrEqual(last);
      expect(o).toBeLessThanOrEqual(1);
      last = o;
    }
  });

  it('shows them in every still, the summary map too: the rest stays alive', () => {
    expect(detailOpacity(FRAMINGS.still1.scale)).toBe(1);
    expect(detailOpacity(FRAMINGS.still2.scale)).toBe(1);
    expect(detailOpacity(FRAMINGS.still3.scale)).toBe(1);
  });
});
