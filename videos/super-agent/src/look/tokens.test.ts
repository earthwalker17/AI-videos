import { describe, expect, it } from 'vitest';
import { MAX_TEXT_PX, MIN_TEXT_PX, NOTES, PALETTE, SAFE, STROKE, TYPE } from './tokens.ts';

/** BT.709 luma of an sRGB hex, in limited-range code values (16-235), as QA's blackdetect sees it. */
function limitedLuma(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return 16 + ((0.2126 * r + 0.7152 * g + 0.0722 * b) * 219) / 255;
}

describe('the palette (TREATMENT.md, Art direction)', () => {
  it('keeps the ground above QA black (luma 37.9) by its margin', () => {
    expect(limitedLuma(PALETTE.ground.hex)).toBeCloseTo(45.1, 1);
  });
  it('has nothing darker than the ground', () => {
    const ground = limitedLuma(PALETTE.ground.hex);
    for (const [name, s] of Object.entries(PALETTE)) expect(limitedLuma(s.hex), name).toBeGreaterThanOrEqual(ground);
  });
});

describe('the type scale', () => {
  it('stays between the smallest and the largest size the film allows', () => {
    for (const [name, t] of Object.entries(TYPE)) {
      expect(t.size, name).toBeGreaterThanOrEqual(MIN_TEXT_PX);
      expect(t.size, name).toBeLessThanOrEqual(MAX_TEXT_PX);
    }
  });
});

describe('the notes block', () => {
  it('sits inside title-safe, its tick spanning both lines', () => {
    expect(NOTES.tick.x).toBeGreaterThanOrEqual(SAFE.x);
    expect(NOTES.x + NOTES.maxWidth).toBeLessThanOrEqual(SAFE.right);
    expect(NOTES.tick.top + NOTES.tick.height).toBeLessThanOrEqual(SAFE.bottom);
    expect(NOTES.tick.top).toBeLessThan(NOTES.enBaseline - 0.6 * TYPE.notesEn.size);
    expect(NOTES.tick.top + NOTES.tick.height).toBeGreaterThanOrEqual(NOTES.zhBaseline);
    expect(NOTES.x).toBeGreaterThan(NOTES.tick.x + NOTES.tick.width);
  });
});

describe('stroke weights', () => {
  it('are never finer than the 2 px minimum at 1080p', () => {
    // the cased line's gap too: under 2 px it would close at draft size
    for (const k of ['trunk', 'branch', 'branchMin', 'you', 'router', 'thinkingArc', 'hairline', 'platform', 'casedRail', 'casedGap', 'proposed', 'hatch'] as const) expect(STROKE[k], k).toBeGreaterThanOrEqual(STROKE.min);
  });
});
